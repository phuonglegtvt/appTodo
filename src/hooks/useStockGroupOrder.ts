import { useEffect, useState } from 'react';
import { moveGroup, normalizeGroupOrder } from '../lib/groupOrder';
import type { StockGroup } from '../types/stock';

const STORAGE_KEY = 'apptodo-stock-group-order';

/** Đọc bản lưu; localStorage có thể bị chặn (chế độ riêng tư) hoặc chứa rác. */
function docBanLuu(): StockGroup[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return normalizeGroupOrder(raw === null ? null : JSON.parse(raw));
  } catch (err) {
    console.warn('Không đọc được thứ tự bảng cổ phiếu đã lưu, dùng mặc định:', err);
    return normalizeGroupOrder(null);
  }
}

/**
 * Thứ tự các bảng nhóm cổ phiếu, nhớ qua localStorage — đây là cách xem của
 * riêng trình duyệt này, không đồng bộ sang thiết bị khác.
 */
export function useStockGroupOrder(): {
  order: StockGroup[];
  move: (g: StockGroup, dir: -1 | 1, visible?: StockGroup[]) => void;
} {
  const [order, setOrder] = useState<StockGroup[]>(docBanLuu);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
    } catch (err) {
      // Không lưu được thì thứ tự vẫn đúng trong phiên này; chỉ mất khi tải lại.
      console.warn('Không lưu được thứ tự bảng cổ phiếu:', err);
    }
  }, [order]);

  const move = (g: StockGroup, dir: -1 | 1, visible?: StockGroup[]) =>
    setOrder((o) => moveGroup(o, g, dir, visible));
  return { order, move };
}
