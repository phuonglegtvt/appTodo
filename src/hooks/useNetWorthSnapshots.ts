import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { NetWorthSnapshot } from '../lib/netWorth';

// Lịch sử tài sản ròng theo tháng (`public.net_worth_snapshots`,
// migration 2026-11-27-net-worth.sql). `save` upsert theo (user, tháng).

function dienGiaiLoi(msg: string): string {
  if (/net_worth_snapshots/i.test(msg) && /does not exist|Could not find/i.test(msg)) {
    return 'Chưa chạy migration tài sản ròng. Vào Supabase → SQL Editor, chạy file '
      + `supabase/migrations/2026-11-27-net-worth.sql rồi tải lại trang. (Chi tiết: ${msg})`;
  }
  return msg;
}

export function useNetWorthSnapshots(userId: string): {
  snapshots: NetWorthSnapshot[];
  loading: boolean;
  error: string | null;
  save: (s: NetWorthSnapshot) => Promise<void>;
  clearError: () => void;
} {
  const [snapshots, setSnapshots] = useState<NetWorthSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    supabase
      .from('net_worth_snapshots')
      .select('month,stocks_vnd,crypto_vnd,gold_vnd,cash_vnd,debt_vnd,assets_vnd,net_vnd,captured_at')
      .order('month', { ascending: true })
      .then(({ data, error: err }) => {
        if (!active) return;
        if (err) {
          console.error('Lỗi tải lịch sử tài sản ròng:', err);
          setError('Không tải được lịch sử tài sản ròng: ' + dienGiaiLoi(err.message));
        } else {
          setSnapshots(((data ?? []) as NetWorthSnapshot[]).map((r) => ({
            ...r,
            stocks_vnd: Number(r.stocks_vnd), crypto_vnd: Number(r.crypto_vnd), gold_vnd: Number(r.gold_vnd),
            cash_vnd: Number(r.cash_vnd), debt_vnd: Number(r.debt_vnd), assets_vnd: Number(r.assets_vnd), net_vnd: Number(r.net_vnd),
          })));
        }
        setLoading(false);
      });
    return () => { active = false; };
  }, [userId]);

  const save = useCallback(async (s: NetWorthSnapshot) => {
    const { error: err } = await supabase
      .from('net_worth_snapshots')
      .upsert({ ...s, user_id: userId, captured_at: new Date().toISOString() }, { onConflict: 'user_id,month' });
    if (err) throw new Error(dienGiaiLoi(err.message));
    setSnapshots((prev) => [...prev.filter((p) => p.month !== s.month), s].sort((a, b) => (a.month < b.month ? -1 : 1)));
  }, [userId]);

  const clearError = useCallback(() => setError(null), []);

  return { snapshots, loading, error, save, clearError };
}
