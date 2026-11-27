import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Debt, DebtUpdate, NewDebt } from '../types/debt';

// Nợ & thẻ tín dụng (`public.debts`, migration 2026-11-27-debts.sql).
// Khuôn y hệt useGolds: tải lần đầu + realtime + CRUD, KHÔNG nuốt lỗi.
// Thêm/sửa/xoá NÉM lỗi ra cho form hiện cạnh ô nhập (để không mất số đang gõ).

interface UseDebts {
  debts: Debt[];
  loading: boolean;
  error: string | null;
  addDebt: (input: NewDebt) => Promise<void>;
  updateDebt: (id: string, patch: DebtUpdate) => Promise<void>;
  deleteDebt: (id: string) => Promise<void>;
  clearError: () => void;
}

function sapXep(list: Debt[]): Debt[] {
  // Thẻ trước, vay sau; trong mỗi loại theo sort_order rồi tên.
  return [...list].sort((a, b) =>
    a.kind !== b.kind ? (a.kind === 'CARD' ? -1 : 1)
      : a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'vi'));
}

function dienGiaiLoi(msg: string): string {
  if (/debts/i.test(msg) && /does not exist|Could not find/i.test(msg)) {
    return 'Chưa chạy migration Nợ & thẻ. Vào Supabase → SQL Editor, chạy file '
      + `supabase/migrations/2026-11-27-debts.sql rồi tải lại trang. (Chi tiết: ${msg})`;
  }
  return msg;
}

export function useDebts(userId: string): UseDebts {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    supabase
      .from('debts')
      .select('*')
      .then(({ data, error: err }) => {
        if (!active) return;
        if (err) {
          console.error('Lỗi tải nợ:', err);
          setError('Không tải được danh sách nợ: ' + dienGiaiLoi(err.message));
        } else {
          setDebts(sapXep((data ?? []) as Debt[]));
        }
        setLoading(false);
      });
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    const channel = supabase
      .channel('debts-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'debts', filter: `user_id=eq.${userId}` },
        (payload) => {
          setDebts((prev) => {
            if (payload.eventType === 'INSERT') {
              const row = payload.new as Debt;
              return prev.some((d) => d.id === row.id) ? prev : sapXep([...prev, row]);
            }
            if (payload.eventType === 'UPDATE') {
              const row = payload.new as Debt;
              return sapXep(prev.map((d) => (d.id === row.id ? row : d)));
            }
            if (payload.eventType === 'DELETE') {
              const old = payload.old as { id: string };
              return prev.filter((d) => d.id !== old.id);
            }
            return prev;
          });
        },
      )
      .subscribe((status, err) => {
        const s = String(status);
        if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') {
          console.error('Lỗi kênh đồng bộ realtime (debts):', status, err);
          setError('Mất kết nối đồng bộ thời gian thực — hãy tải lại trang.');
        }
      });
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const addDebt = useCallback(async (input: NewDebt) => {
    const { data, error: err } = await supabase.from('debts').insert({ ...input, user_id: userId }).select().single();
    if (err) throw new Error(dienGiaiLoi(err.message));
    // Không đợi realtime: thêm ngay để form thấy kết quả tức thì.
    setDebts((prev) => (prev.some((d) => d.id === (data as Debt).id) ? prev : sapXep([...prev, data as Debt])));
  }, [userId]);

  const updateDebt = useCallback(async (id: string, patch: DebtUpdate) => {
    const { data, error: err } = await supabase.from('debts').update(patch).eq('id', id).select().single();
    if (err) throw new Error(dienGiaiLoi(err.message));
    setDebts((prev) => sapXep(prev.map((d) => (d.id === id ? (data as Debt) : d))));
  }, []);

  const deleteDebt = useCallback(async (id: string) => {
    const { error: err } = await supabase.from('debts').delete().eq('id', id);
    if (err) throw new Error(dienGiaiLoi(err.message));
    setDebts((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { debts, loading, error, addDebt, updateDebt, deleteDebt, clearError };
}
