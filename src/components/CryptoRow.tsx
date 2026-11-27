import { useState } from 'react';
import { nhapTien, dinhDangSoTien } from '../lib/moneyTyping';
import type { Crypto, CryptoUpdate, Currency } from '../types/crypto';
import { value, pnl, pnlPercent } from '../lib/cryptoCalc';
import { drawdownFromPeakPct } from '../lib/peakDrawdown';
import { formatMoney } from '../lib/money';
import { parseVnNumber, parseVndAmount } from '../lib/parseNumber';
import { formatVnd } from '../lib/portfolioClassMeta';
import { formatPctBoDauTru } from '../lib/formatPercent';

/** '—' nếu null, ngược lại định dạng tiền theo currency. */
function money(n: number | null, currency: Currency, rate: number | null): string {
  return n == null ? '—' : formatMoney(n, currency, rate);
}

/**
 * Ô "% so đỉnh" — cùng luật với bảng Cổ phiếu (xem StockRow): `null` hiện '—' chứ
 * không hiện 0%, và số DƯƠNG nghĩa là giá đã vượt đỉnh đang lưu (đỉnh đã cũ).
 */
function OSoDinh({ pct }: { pct: number | null }) {
  if (pct == null) {
    return <span className="text-text-muted dark:text-text-muted-dark">—</span>;
  }
  const mau =
    pct > 0
      ? 'font-semibold text-red-600 dark:text-red-400'
      : pct <= -30
        ? 'font-semibold text-green-600 dark:text-green-400'
        : 'text-text dark:text-text-dark';
  return (
    <span
      className={mau}
      title={pct > 0 ? 'Giá đã vượt đỉnh đang lưu — số đỉnh này đã cũ' : undefined}
    >
      {formatPctBoDauTru(pct)}
    </span>
  );
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
  const [peak, setPeak] = useState('');
  const [invested, setInvested] = useState('');

  function startEdit() {
    setQuantity(crypto.quantity?.toString() ?? '');
    setAvgBuy(crypto.avg_buy_price?.toString() ?? '');
    setPeak(crypto.peak_price?.toString() ?? '');
    setInvested(dinhDangSoTien(crypto.invested_amount));
    setEditing(true);
  }

  function save() {
    onUpdate(crypto.id, {
      quantity: parseVnNumber(quantity),
      avg_buy_price: parseVnNumber(avgBuy),
      peak_price: parseVnNumber(peak),
      // parseVndAmount (không phải parseVnNumber): ô này là số tiền VND nên
      // phải đọc được '42.000.000'. parseVnNumber chỉ thay dấu phẩy ĐẦU TIÊN
      // nên chuỗi đó ra NaN.
      invested_amount: parseVndAmount(invested),
    });
    setEditing(false);
  }

  // Cả hai đều là USD nên so trực tiếp, không cần tỷ giá.
  const soDinhPct = drawdownFromPeakPct(crypto.current_price, crypto.peak_price);

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
        <td className={cell}>
          <input value={peak} onChange={(e) => setPeak(e.target.value)} className={editInput} aria-label="Đỉnh lịch sử (USD)" />
        </td>
        <td className={cell}><OSoDinh pct={soDinhPct} /></td>
        <td className={cell}>
          <input
            value={invested}
            onChange={nhapTien(setInvested)}
            placeholder="42,000,000"
            inputMode="numeric"
            className={editInput}
            aria-label="Đã đầu tư (đồng)"
          />
        </td>
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
      <td className={cell}>{money(crypto.peak_price, currency, rate)}</td>
      <td className={cell}><OSoDinh pct={soDinhPct} /></td>
      {/* Luôn VND, KHÔNG theo `currency` như các ô khác — cột này lưu đồng. */}
      <td className={cell}>
        {crypto.invested_amount === null ? '—' : formatVnd(crypto.invested_amount)}
      </td>
      <td className={cell}>{money(value(crypto), currency, rate)}</td>
      <td className={`${cell} ${pnlColor}`}>{pnlText}</td>
      <td className={cell}>
        <button onClick={startEdit} className="mr-2 text-text-muted hover:text-primary dark:text-text-muted-dark dark:hover:text-primary-dark" aria-label="Sửa">✎</button>
        <button onClick={() => onDelete(crypto.id)} className="text-text-muted hover:text-red-500 dark:text-text-muted-dark" aria-label="Xóa">✕</button>
      </td>
    </tr>
  );
}
