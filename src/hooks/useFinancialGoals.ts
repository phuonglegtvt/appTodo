import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { FinancialGoal } from '../lib/financialGoals';

// Mục tiêu tài chính (`public.financial_goals`, migration 2026-11-27-financial-goals.sql).
// Ghi NÉM lỗi cho form hiện tại chỗ; lỗi tải hiện qua `error`.

export type NewFinancialGoal = Omit<FinancialGoal, 'id'>;

const COT = 'id,name,target_amount_vnd,target_date,saved_vnd,monthly_contribution_vnd,expected_return_pct,note';

function dienGiaiLoi(msg: string): string {
  if (/financial_goals/i.test(msg) && /does not exist|Could not find/i.test(msg)) {
    return 'Chưa chạy migration mục tiêu tài chính. Vào Supabase → SQL Editor, chạy file '
      + `supabase/migrations/2026-11-27-financial-goals.sql rồi tải lại trang. (Chi tiết: ${msg})`;
  }
  return msg;
}

function so(g: FinancialGoal): FinancialGoal {
  return {
    ...g,
    target_amount_vnd: Number(g.target_amount_vnd), saved_vnd: Number(g.saved_vnd),
    monthly_contribution_vnd: Number(g.monthly_contribution_vnd), expected_return_pct: Number(g.expected_return_pct),
  };
}

export function useFinancialGoals(userId: string): {
  goals: FinancialGoal[];
  loading: boolean;
  error: string | null;
  addGoal: (g: NewFinancialGoal) => Promise<void>;
  updateGoal: (id: string, patch: Partial<NewFinancialGoal>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  clearError: () => void;
} {
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    supabase.from('financial_goals').select(COT).order('target_date').then(({ data, error: err }) => {
      if (!active) return;
      if (err) {
        console.error('Lỗi tải mục tiêu tài chính:', err);
        setError('Không tải được mục tiêu tài chính: ' + dienGiaiLoi(err.message));
      } else {
        setGoals(((data ?? []) as FinancialGoal[]).map(so));
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, [userId]);

  const sapXep = (l: FinancialGoal[]) => [...l].sort((a, b) => a.target_date.localeCompare(b.target_date));

  const addGoal = useCallback(async (g: NewFinancialGoal) => {
    const { data, error: err } = await supabase.from('financial_goals').insert({ ...g, user_id: userId }).select(COT).single();
    if (err) throw new Error(dienGiaiLoi(err.message));
    setGoals((prev) => sapXep([...prev, so(data as FinancialGoal)]));
  }, [userId]);

  const updateGoal = useCallback(async (id: string, patch: Partial<NewFinancialGoal>) => {
    const { data, error: err } = await supabase.from('financial_goals').update(patch).eq('id', id).select(COT).single();
    if (err) throw new Error(dienGiaiLoi(err.message));
    setGoals((prev) => sapXep(prev.map((g) => (g.id === id ? so(data as FinancialGoal) : g))));
  }, []);

  const deleteGoal = useCallback(async (id: string) => {
    const { error: err } = await supabase.from('financial_goals').delete().eq('id', id);
    if (err) throw new Error(dienGiaiLoi(err.message));
    setGoals((prev) => prev.filter((g) => g.id !== id));
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { goals, loading, error, addGoal, updateGoal, deleteGoal, clearError };
}
