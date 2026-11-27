import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { moiNhatTruoc } from '../lib/cashFlow';
import type { CashEntry, CashEntryUpdate, NewCashEntry } from '../types/cashEntry';

// Khuôn y hệt useGolds: tải lần đầu + realtime + CRUD, KHÔNG nuốt lỗi.
// ĐƠN VỊ: amount_vnd là VND (đồng) tuyệt đối, LUÔN DƯƠNG.

interface UseCashEntries {
  entries: CashEntry[];
  loading: boolean;
  error: string | null;
  addEntry: (input: NewCashEntry) => Promise<void>;
  updateEntry: (id: string, patch: CashEntryUpdate) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  /** Ghi nhiều khoản một lần (khoản định kỳ). NÉM lỗi để nút bấm báo tại chỗ. */
  addMany: (inputs: NewCashEntry[]) => Promise<void>;
  clearError: () => void;
}

export function useCashEntries(userId: string): UseCashEntries {
  const [entries, setEntries] = useState<CashEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    supabase
      .from('cash_entries')
      .select('*')
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error('Lỗi tải thu-chi:', error);
          setError('Không tải được sổ thu-chi: ' + error.message);
        } else {
          setEntries(moiNhatTruoc((data ?? []) as CashEntry[]));
        }
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    const channel = supabase
      .channel('cash-entries-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cash_entries', filter: `user_id=eq.${userId}` },
        (payload) => {
          setEntries((prev) => {
            if (payload.eventType === 'INSERT') {
              const row = payload.new as CashEntry;
              if (prev.some((e) => e.id === row.id)) return prev;
              return moiNhatTruoc([...prev, row]);
            }
            if (payload.eventType === 'UPDATE') {
              const row = payload.new as CashEntry;
              return moiNhatTruoc(prev.map((e) => (e.id === row.id ? row : e)));
            }
            if (payload.eventType === 'DELETE') {
              const old = payload.old as { id: string };
              return prev.filter((e) => e.id !== old.id);
            }
            return prev;
          });
        },
      )
      .subscribe((status, err) => {
        const s = String(status);
        if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') {
          console.error('Lỗi kênh đồng bộ realtime (cash_entries):', status, err);
          setError('Mất kết nối đồng bộ thời gian thực — hãy tải lại trang.');
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const addEntry = useCallback(
    async (input: NewCashEntry) => {
      const { error } = await supabase.from('cash_entries').insert({
        user_id: userId,
        occurred_on: input.occurred_on,
        kind: input.kind,
        category: input.category,
        amount_vnd: input.amount_vnd,
        note: input.note ?? '',
      });
      if (error) {
        console.error('Lỗi thêm khoản thu-chi:', error);
        setError('Không thêm được khoản: ' + error.message);
      }
    },
    [userId],
  );

  const updateEntry = useCallback(async (id: string, patch: CashEntryUpdate) => {
    const { error } = await supabase.from('cash_entries').update(patch).eq('id', id);
    if (error) {
      console.error('Lỗi cập nhật khoản thu-chi:', error);
      setError('Không cập nhật được khoản: ' + error.message);
    }
  }, []);

  const deleteEntry = useCallback(async (id: string) => {
    const { error } = await supabase.from('cash_entries').delete().eq('id', id);
    if (error) {
      console.error('Lỗi xoá khoản thu-chi:', error);
      setError('Không xoá được khoản: ' + error.message);
    }
  }, []);

  const addMany = useCallback(async (inputs: NewCashEntry[]) => {
    if (inputs.length === 0) return;
    const { data, error: err } = await supabase.from('cash_entries').insert(inputs.map((i) => ({
      user_id: userId, occurred_on: i.occurred_on, kind: i.kind, category: i.category,
      amount_vnd: i.amount_vnd, note: i.note ?? '', recurring_id: i.recurring_id ?? null,
    }))).select();
    if (err) {
      if (/recurring_id/i.test(err.message)) {
        throw new Error('Chưa chạy migration khoản định kỳ. Vào Supabase → SQL Editor, chạy file '
          + `supabase/migrations/2026-11-27-cash-budget-recurring.sql. (Chi tiết: ${err.message})`);
      }
      throw new Error(err.message);
    }
    // Không đợi realtime: gộp ngay, bỏ trùng theo id.
    setEntries((prev) => moiNhatTruoc([...prev, ...((data ?? []) as CashEntry[]).filter((r) => !prev.some((p) => p.id === r.id))]));
  }, [userId]);

  const clearError = useCallback(() => setError(null), []);

  return { entries, loading, error, addEntry, updateEntry, deleteEntry, addMany, clearError };
}
