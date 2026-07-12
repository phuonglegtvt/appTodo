import { useState } from 'react';
import type { Crypto, CryptoUpdate, Currency } from '../types/crypto';
import { value, pnl, pnlPercent } from '../lib/cryptoCalc';
import { formatMoney } from '../lib/money';
import { parseVnNumber } from '../lib/parseNumber';

/** '—' nếu null, ngược lại định dạng tiền theo currency. */
function money(n: number | null, currency: Currency, rate: number | null): string {
  return n == null ? '—' : formatMoney(n, currency, rate);
}

interface Props {
  crypto: Crypto;
  currency: Currency;
  rate: number | null;
  onUpdate: (id: string, patch: CryptoUpdate) => void;
  onDelete: (id: string) => void;
}

/** Một dòng coin: hiển thị hoặc sửa inline (số lượng, giá mua TB). Lời xanh, lỗ đỏ. */
export function CryptoRow({ crypto, currency, rate, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [quantity, setQuantity] = useState('');
  const [avgBuy, setAvgBuy] = useState('');

  function startEdit() {
    setQuantity(crypto.quantity?.toString() ?? '');
    setAvgBuy(crypto.avg_buy_price?.toString() ?? '');
    setEditing(true);
  }

  function save() {
    onUpdate(crypto.id, {
      quantity: parseVnNumber(quantity),
      avg_buy_price: parseVnNumber(avgBuy),
    });
    setEditing(false);
  }

  const cell = 'px-2 py-2 text-sm text-text dark:text-text-dark';
  const editInput =
    'w-24 rounded border border-border bg-surface px-1.5 py-1 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-2dark dark:text-text-dark';

  if (editing) {
    return (
      <tr className="border-t border-border dark:border-border-dark">
        <td className={`${cell} font-semibold`}>{crypto.symbol}</td>
        <td className={cell}>{crypto.name || '—'}</td>
        <td className={cell}>
          <input value={quantity} onChange={(e) => setQuantity(e.target.value)} className={editInput} aria-label="Số lượng" />
        </td>
        <td className={cell}>
          <input value={avgBuy} onChange={(e) => setAvgBuy(e.target.value)} className={editInput} aria-label="Giá mua TB" />
        </td>
        <td className={cell}>{money(crypto.current_price, currency, rate)}</td>
        <td className={cell}>{money(value(crypto), currency, rate)}</td>
        <td className={cell}>—</td>
        <td className={cell}>
          <button onClick={save} className="mr-2 font-semibold text-primary dark:text-primary-dark">Lưu</button>
          <button onClick={() => setEditing(false)} className="text-text-muted dark:text-text-muted-dark">Hủy</button>
        </td>
      </tr>
    );
  }

  const p = pnl(crypto);
  const pPct = pnlPercent(crypto);
  const pnlColor =
    p == null ? '' : p >= 0 ? 'font-semibold text-green-600 dark:text-green-400' : 'font-semibold text-red-600 dark:text-red-400';
  const pnlText =
    p == null
      ? '—'
      : `${p >= 0 ? '+' : ''}${money(p, currency, rate)}` +
        (pPct != null ? ` (${p >= 0 ? '+' : ''}${pPct.toFixed(1)}%)` : '');

  return (
    <tr className="border-t border-border dark:border-border-dark">
      <td className={`${cell} font-semibold`}>{crypto.symbol}</td>
      <td className={cell}>{crypto.name || '—'}</td>
      <td className={cell}>{crypto.quantity ?? '—'}</td>
      <td className={cell}>{money(crypto.avg_buy_price, currency, rate)}</td>
      <td className={cell}>{money(crypto.current_price, currency, rate)}</td>
      <td className={cell}>{money(value(crypto), currency, rate)}</td>
      <td className={`${cell} ${pnlColor}`}>{pnlText}</td>
      <td className={cell}>
        <button onClick={startEdit} className="mr-2 text-text-muted hover:text-primary dark:text-text-muted-dark dark:hover:text-primary-dark" aria-label="Sửa">✎</button>
        <button onClick={() => onDelete(crypto.id)} className="text-text-muted hover:text-red-500 dark:text-text-muted-dark" aria-label="Xóa">✕</button>
      </td>
    </tr>
  );
}
