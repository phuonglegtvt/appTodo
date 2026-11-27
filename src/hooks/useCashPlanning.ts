import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { KhoanDinhKy } from '../lib/cashPlanning';

// Ngân sách tháng + khoản định kỳ của tab Thu–Chi
// (migration 2026-11-27-cash-budget-recurring.sql). Ghi NÉM lỗi cho chỗ gọi
// hiện tại chỗ; lỗi tải hiện qua `error`.

function dienGiaiLoi(msg: string): string {
  if (/cash_budgets|cash_recurring/i.test(msg) && /does not exist|Could not find/i.test(msg)) {
    return 'Chưa chạy migration ngân sách & khoản định kỳ. Vào Supabase → SQL Editor, chạy file '
      + `supabase/migrations/2026-11-27-cash-budget-recurring.sql rồi tải lại trang. (Chi tiết: ${msg})`;
  }
  return msg;
}

export type NewKhoanDinhKy = Omit<KhoanDinhKy, 'id'>;

export function useCashPlanning(userId: string): {
  budgets: Record<string, number>;
  recurring: KhoanDinhKy[];
  loading: boolean;
  error: string | null;
  setBudget: (category: string, amount: number | null) => Promise<void>;
  addRecurring: (k: NewKhoanDinhKy) => Promise<void>;
  updateRecurring: (id: string, patch: Partial<NewKhoanDinhKy>) => Promise<void>;
  deleteRecurring: (id: string) => Promise<void>;
  clearError: () => void;
} {
  const [budgets, setBudgets] = useState<Record<string, number>>({});
  const [recurring, setRecurring] = useState<KhoanDinhKy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      supabase.from('cash_budgets').select('category,amount_vnd'),
      supabase.from('cash_recurring').select('id,kind,category,amount_vnd,day_of_month,note,active').order('day_of_month'),
    ]).then(([b, r]) => {
      if (!active) return;
      const err = b.error ?? r.error;
      if (err) {
        console.error('Lỗi tải ngân sách / khoản định kỳ:', err);
        setError('Không tải được ngân sách / khoản định kỳ: ' + dienGiaiLoi(err.message));
      } else {
        setBudgets(Object.fromEntries((b.data ?? []).map((x) => [x.category as string, Number(x.amount_vnd)])));
        setRecurring(((r.data ?? []) as KhoanDinhKy[]).map((k) => ({ ...k, amount_vnd: Number(k.amount_vnd) })));
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, [userId]);

  const setBudget = useCallback(async (category: string, amount: number | null) => {
    const { error: err } = amount === null || amount <= 0
      ? await supabase.from('cash_budgets').delete().eq('category', category)
      : await supabase.from('cash_budgets').upsert({ user_id: userId, category, amount_vnd: amount, updated_at: new Date().toISOString() }, { onConflict: 'user_id,category' });
    if (err) throw new Error(dienGiaiLoi(err.message));
    setBudgets((prev) => {
      const n = { ...prev };
      if (amount === null || amount <= 0) delete n[category]; else n[category] = amount;
      return n;
    });
  }, [userId]);

  const addRecurring = useCallback(async (k: NewKhoanDinhKy) => {
    const { data, error: err } = await supabase.from('cash_recurring').insert({ ...k, user_id: userId })
      .select('id,kind,category,amount_vnd,day_of_month,note,active').single();
    if (err) throw new Error(dienGiaiLoi(err.message));
    setRecurring((prev) => [...prev, { ...(data as KhoanDinhKy), amount_vnd: Number((data as KhoanDinhKy).amount_vnd) }]
      .sort((a, b) => a.day_of_month - b.day_of_month));
  }, [userId]);

  const updateRecurring = useCallback(async (id: string, patch: Partial<NewKhoanDinhKy>) => {
    const { error: err } = await supabase.from('cash_recurring').update(patch).eq('id', id);
    if (err) throw new Error(dienGiaiLoi(err.message));
    setRecurring((prev) => prev.map((k) => (k.id === id ? { ...k, ...patch } : k)));
  }, []);

  const deleteRecurring = useCallback(async (id: string) => {
    const { error: err } = await supabase.from('cash_recurring').delete().eq('id', id);
    if (err) throw new Error(dienGiaiLoi(err.message));
    setRecurring((prev) => prev.filter((k) => k.id !== id));
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { budgets, recurring, loading, error, setBudget, addRecurring, updateRecurring, deleteRecurring, clearError };
}
