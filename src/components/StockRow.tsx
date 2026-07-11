import { useState } from 'react';
import type { Stock, StockUpdate } from '../types/stock';
import { computeYield, isBelowThreshold } from '../lib/stockCalc';
import { parseVnNumber } from '../lib/parseNumber';

function fmt(n: number | null): string {
  return n == null ? '—' : n.toLocaleString('vi-VN');
}

interface Props {
  stock: Stock;
  onUpdate: (id: string, patch: StockUpdate) => void;
  onDelete: (id: string) => void;
}

/** Một dòng cổ phiếu: hiển thị hoặc sửa inline. Mã "chạm ngưỡng" tô đỏ. */
export function StockRow({ stock, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  // Bản nháp khi sửa (giữ dạng chuỗi để nhập được thoải mái).
  const [priceThreshold, setPriceThreshold] = useState('');
  const [priceProtect, setPriceProtect] = useState('');
  const [dividend, setDividend] = useState('');
  const [invested, setInvested] = useState('');

  function startEdit() {
    setPriceThreshold(stock.price_threshold?.toString() ?? '');
    setPriceProtect(stock.price_protect?.toString() ?? '');
    setDividend(stock.dividend?.toString() ?? '');
    setInvested(stock.invested_amount?.toString() ?? '');
    setEditing(true);
  }

  function save() {
    onUpdate(stock.id, {
      price_threshold: parseVnNumber(priceThreshold),
      price_protect: parseVnNumber(priceProtect),
      dividend: parseVnNumber(dividend),
      invested_amount: parseVnNumber(invested),
    });
    setEditing(false);
  }

  const yieldPct = computeYield(stock);
  const below = isBelowThreshold(stock);
  const cell = 'px-2 py-2 text-sm text-text dark:text-text-dark';
  const editInput =
    'w-24 rounded border border-border bg-surface px-1.5 py-1 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-2dark dark:text-text-dark';

  if (editing) {
    return (
      <tr className="border-t border-border dark:border-border-dark">
        <td className={`${cell} font-semibold`}>{stock.ticker}</td>
        <td className={cell}>{stock.company_name}</td>
        <td className={cell}>
          <input value={priceThreshold} onChange={(e) => setPriceThreshold(e.target.value)} className={editInput} aria-label="Giá ngưỡng" />
        </td>
        <td className={cell}>
          <input value={priceProtect} onChange={(e) => setPriceProtect(e.target.value)} className={editInput} aria-label="Giá bảo vệ" />
        </td>
        <td className={cell}>{fmt(stock.current_price)}</td>
        <td className={cell}>
          <input value={dividend} onChange={(e) => setDividend(e.target.value)} className={editInput} aria-label="Cổ tức" />
        </td>
        <td className={cell}>{yieldPct == null ? '—' : yieldPct.toFixed(1) + '%'}</td>
        <td className={cell}>
          <input value={invested} onChange={(e) => setInvested(e.target.value)} className={editInput} aria-label="Số tiền đầu tư" />
        </td>
        <td className={cell}>
          <button onClick={save} className="mr-2 font-semibold text-primary dark:text-primary-dark">Lưu</button>
          <button onClick={() => setEditing(false)} className="text-text-muted dark:text-text-muted-dark">Hủy</button>
        </td>
      </tr>
    );
  }

  return (
    <tr className={`border-t border-border dark:border-border-dark ${below ? 'bg-red-50 dark:bg-red-950/30' : ''}`}>
      <td className={`${cell} font-semibold ${below ? 'text-red-600 dark:text-red-400' : ''}`}>{stock.ticker}</td>
      <td className={cell}>{stock.company_name}</td>
      <td className={cell}>{fmt(stock.price_threshold)}</td>
      <td className={cell}>{fmt(stock.price_protect)}</td>
      <td className={`${cell} ${below ? 'font-semibold text-red-600 dark:text-red-400' : ''}`}>{fmt(stock.current_price)}</td>
      <td className={cell}>{fmt(stock.dividend)}</td>
      <td className={cell}>{yieldPct == null ? '—' : yieldPct.toFixed(1) + '%'}</td>
      <td className={cell}>{fmt(stock.invested_amount)}</td>
      <td className={cell}>
        <button onClick={startEdit} className="mr-2 text-text-muted hover:text-primary dark:text-text-muted-dark dark:hover:text-primary-dark" aria-label="Sửa">✎</button>
        <button onClick={() => onDelete(stock.id)} className="text-text-muted hover:text-red-500 dark:text-text-muted-dark" aria-label="Xóa">✕</button>
      </td>
    </tr>
  );
}
