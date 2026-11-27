import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

// Tỷ trọng mục tiêu từng mã của nhóm "Đầu tư dài hạn", lưu ở
// `public.user_prefs.longterm_targets` (migration 2026-11-27-longterm-targets.sql)
// để đồng bộ giữa các máy. `targets === null` = chưa lưu bao giờ ⇒ trang dùng
// tỷ trọng mặc định. Lỗi đọc/ghi được báo lên, không im lặng.

type Targets = Record<string, number>;

function dienGiaiLoi(msg: string): string {
  if (/longterm_targets|user_prefs/i.test(msg) && /does not exist|Could not find/i.test(msg)) {
    return 'Chưa chạy migration lưu tỷ trọng dài hạn. Vào Supabase → SQL Editor, chạy file '
      + `supabase/migrations/2026-11-27-longterm-targets.sql rồi tải lại trang. (Chi tiết: ${msg})`;
  }
  return msg;
}

/** Chỉ giữ cặp id → số hữu hạn ≥ 0; dữ liệu lạ trong DB không làm vỡ trang. */
function chuanHoa(raw: unknown): Targets | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out: Targets = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = typeof v === 'number' ? v : Number(v);
    if (Number.isFinite(n) && n >= 0) out[k] = n;
  }
  return out;
}

export function useLongtermTargets(userId: string): {
  targets: Targets | null;
  loading: boolean;
  error: string | null;
  save: (t: Targets) => Promise<void>;
  clearError: () => void;
} {
  const [targets, setTargets] = useState<Targets | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      const { data, error: err } = await supabase
        .from('user_prefs')
        .select('longterm_targets')
        .eq('user_id', userId)
        .maybeSingle();
      if (err) throw new Error(dienGiaiLoi(err.message));
      if (active) setTargets(chuanHoa((data as { longterm_targets: unknown } | null)?.longterm_targets ?? null));
    })()
      .catch((err: unknown) => {
        if (!active) return;
        console.error('Lỗi tải tỷ trọng dài hạn:', err);
        setError('Không tải được tỷ trọng mục tiêu đã lưu: ' + (err instanceof Error ? err.message : String(err)));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId]);

  // Ném lỗi cho form tự hiện cạnh nút Lưu (để không mất số đang gõ).
  const save = useCallback(async (t: Targets) => {
    const { error: err } = await supabase
      .from('user_prefs')
      .upsert({ user_id: userId, longterm_targets: t }, { onConflict: 'user_id' });
    if (err) throw new Error(dienGiaiLoi(err.message));
    setTargets(t);
  }, [userId]);

  const clearError = useCallback(() => setError(null), []);

  return { targets, loading, error, save, clearError };
}
