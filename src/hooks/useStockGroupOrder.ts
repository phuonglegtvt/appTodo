import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { moveGroup, normalizeGroupOrder } from '../lib/groupOrder';
import type { StockGroup } from '../types/stock';

// Thứ tự các bảng nhóm cổ phiếu (nút ▲▼), đồng bộ giữa các máy qua
// `public.user_prefs.stock_group_order` (migration 2026-11-26-user-prefs.sql).
//
// localStorage chỉ còn là BẢN NHỚ ĐỆM để trang vẽ đúng thứ tự ngay lần đầu,
// trước khi Supabase trả về — nguồn thật là Supabase. Lỗi đọc/ghi Supabase
// được báo lên (`error`), không im lặng quay về bản đệm.

const CACHE_KEY = 'apptodo-stock-group-order';

function docBanDem(): StockGroup[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw === null ? null : normalizeGroupOrder(JSON.parse(raw));
  } catch (err) {
    console.warn('Bản đệm thứ tự bảng cổ phiếu hỏng, bỏ qua:', err);
    return null;
  }
}

function ghiBanDem(order: StockGroup[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(order));
  } catch (err) {
    console.warn('Không ghi được bản đệm thứ tự bảng cổ phiếu:', err);
  }
}

async function luuLenSupabase(userId: string, order: StockGroup[]): Promise<void> {
  const { error } = await supabase
    .from('user_prefs')
    .upsert({ user_id: userId, stock_group_order: order }, { onConflict: 'user_id' });
  if (error) throw new Error(error.message);
}

/** Dịch lỗi "chưa chạy migration" thành việc người dùng làm được. */
function dienGiaiLoi(msg: string): string {
  if (/user_prefs/i.test(msg) && /does not exist|Could not find/i.test(msg)) {
    return 'Chưa chạy migration user_prefs nên thứ tự bảng chưa đồng bộ được giữa các máy. '
      + 'Chạy file supabase/migrations/2026-11-26-user-prefs.sql trong Supabase SQL Editor. '
      + `(Chi tiết: ${msg})`;
  }
  return msg;
}

export function useStockGroupOrder(userId: string): {
  order: StockGroup[];
  move: (g: StockGroup, dir: -1 | 1, visible?: StockGroup[]) => void;
  error: string | null;
  clearError: () => void;
} {
  const [order, setOrder] = useState<StockGroup[]>(() => docBanDem() ?? normalizeGroupOrder(null));
  const [error, setError] = useState<string | null>(null);

  // Tải thứ tự từ Supabase. Chưa có dòng nào mà máy này có bản đệm (thứ tự đã
  // sắp từ trước khi có đồng bộ) ⇒ đẩy bản đệm lên, để công sắp không mất.
  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error: err } = await supabase
        .from('user_prefs')
        .select('stock_group_order')
        .eq('user_id', userId)
        .maybeSingle();
      if (err) throw new Error(err.message);
      if (!active) return;

      const tuDb = (data as { stock_group_order: unknown } | null)?.stock_group_order ?? null;
      if (tuDb !== null) {
        const o = normalizeGroupOrder(tuDb);
        setOrder(o);
        ghiBanDem(o);
        return;
      }
      const banDem = docBanDem();
      if (banDem !== null) await luuLenSupabase(userId, banDem);
    })().catch((err: unknown) => {
      if (!active) return;
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Lỗi tải thứ tự bảng cổ phiếu:', err);
      setError('Không tải được thứ tự bảng từ máy chủ: ' + dienGiaiLoi(msg));
    });
    return () => { active = false; };
  }, [userId]);

  // Tính thứ tự mới từ `order` hiện tại, KHÔNG gọi mạng bên trong updater của
  // setState (React có thể chạy updater hai lần ở StrictMode ⇒ ghi hai lần).
  const move = useCallback((g: StockGroup, dir: -1 | 1, visible?: StockGroup[]) => {
    const moi = moveGroup(order, g, dir, visible);
    if (moi === order) return;
    // Đổi ngay trên màn hình rồi mới lưu: bấm ▲▼ phải thấy tức thì. Lưu thất
    // bại thì báo — máy khác sẽ không thấy thứ tự này cho tới khi lưu được.
    setOrder(moi);
    ghiBanDem(moi);
    luuLenSupabase(userId, moi).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Lỗi lưu thứ tự bảng cổ phiếu:', err);
      setError('Không lưu được thứ tự bảng lên máy chủ: ' + dienGiaiLoi(msg));
    });
  }, [order, userId]);

  const clearError = useCallback(() => setError(null), []);

  return { order, move, error, clearError };
}
