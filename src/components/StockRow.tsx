import { useState } from 'react';
import type { Stock, StockGroup, StockUpdate } from '../types/stock';
import { computeYield, isBelowThreshold, isAboveProtect } from '../lib/stockCalc';
import { drawdownFromPeakPct, gapToPricePct } from '../lib/peakDrawdown';
import { parseVnNumber } from '../lib/parseNumber';
import { formatPctBoDauTru } from '../lib/formatPercent';
import { avgCostThousand } from '../lib/stockTransaction';

function fmt(n: number | null): string {
  return n == null ? '—' : n.toLocaleString('vi-VN');
}

/** Giá vốn TB là số chia ra nên thường lẻ — giữ 2 chữ số thập phân là đủ đọc. */
function fmtGiaVon(n: number | null): string {
  return n == null ? '—' : n.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
}

/**
 * Ô "% so ngưỡng" — còn cách giá ngưỡng tích sản bao nhiêu %.
 * Màu ngược với ô "% so đỉnh" vì ý nghĩa ngược: ở ĐÂY số ÂM là tin tốt (đã xuống
 * dưới ngưỡng ⇒ đáng mua), số dương là còn đắt hơn ngưỡng.
 *
 * HIỂN THỊ bỏ dấu trừ (`formatPctBoDauTru`) nhưng GIÁ TRỊ vẫn có dấu — màu sắc
 * và dấu '+' là hai thứ phân biệt hai chiều. Sort vẫn dùng số CÓ dấu.
 */
function OSoNguong({ pct }: { pct: number | null }) {
  if (pct == null) {
    return <span className="text-text-muted dark:text-text-muted-dark">—</span>;
  }
  const mau =
    pct <= 0
      ? 'font-semibold text-green-600 dark:text-green-400'
      : 'font-semibold text-red-600 dark:text-red-400';
  return (
    <span
      className={mau}
      title={
        pct <= 0
          ? 'Đã ở dưới giá ngưỡng tích sản'
          : `Còn phải giảm ${pct.toFixed(1)}% mới về giá ngưỡng`
      }
    >
      {formatPctBoDauTru(pct)}
    </span>
  );
}

/**
 * Ô "% so đỉnh". `null` (chưa biết đỉnh, hoặc chưa có giá) hiện '—' — KHÔNG hiện
 * 0%, vì 0% có nghĩa hẳn hoi là "đang đúng ở đỉnh".
 * Càng xa đỉnh càng đáng chú ý nên tô: ≤ −30% xanh (vùng tích sản), > 0 đỉnh đỏ
 * (giá đã vượt đỉnh đang lưu ⇒ số đỉnh đã cũ, cần cập nhật).
 *
 * HIỂN THỊ bỏ dấu trừ; số mang dấu '+' nghĩa là đã VƯỢT đỉnh.
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
  stock: Stock;
  onUpdate: (id: string, patch: StockUpdate) => void;
  onDelete: (id: string) => void;
}

/** Một dòng cổ phiếu: hiển thị hoặc sửa inline. Mã "đắt" (trên giá bảo vệ) tô đỏ, mã "đáng mua" (dưới giá ngưỡng) tô xanh. */
export function StockRow({ stock, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  // Bản nháp khi sửa (giữ dạng chuỗi để nhập được thoải mái).
  const [ticker, setTicker] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [group, setGroup] = useState<StockGroup>('balance');
  const [loiSua, setLoiSua] = useState<string | null>(null);
  const [priceThreshold, setPriceThreshold] = useState('');
  const [priceProtect, setPriceProtect] = useState('');
  const [dividend, setDividend] = useState('');
  const [invested, setInvested] = useState('');
  const [quantity, setQuantity] = useState('');
  const [peak, setPeak] = useState('');

  function startEdit() {
    setTicker(stock.ticker);
    setCompanyName(stock.company_name);
    setGroup(stock.group);
    setLoiSua(null);
    setPriceThreshold(stock.price_threshold?.toString() ?? '');
    setPriceProtect(stock.price_protect?.toString() ?? '');
    setDividend(stock.dividend?.toString() ?? '');
    setInvested(stock.invested_amount?.toString() ?? '');
    setQuantity(stock.quantity?.toString() ?? '');
    setPeak(stock.peak_price?.toString() ?? '');
    setEditing(true);
  }

  function save() {
    // Mã là khoá để lấy giá tự động — để trống thì "Cập nhật giá" gọi nguồn với
    // mã rỗng. Chặn ngay tại dòng, không lưu.
    const ma = ticker.trim().toUpperCase();
    if (!ma) {
      setLoiSua('Mã không được để trống.');
      return;
    }
    onUpdate(stock.id, {
      ticker: ma,
      company_name: companyName.trim(),
      group,
      price_threshold: parseVnNumber(priceThreshold),
      price_protect: parseVnNumber(priceProtect),
      dividend: parseVnNumber(dividend),
      invested_amount: parseVnNumber(invested),
      quantity: parseVnNumber(quantity),
      peak_price: parseVnNumber(peak),
    });
    setEditing(false);
  }

  const yieldPct = computeYield(stock);
  // Cùng đơn vị NGHÌN ĐỒNG nên so trực tiếp, không quy đổi.
  const soDinhPct = drawdownFromPeakPct(stock.current_price, stock.peak_price);
  const soNguongPct = gapToPricePct(stock.current_price, stock.price_threshold);
  const above = isAboveProtect(stock);
  // "đáng mua" chỉ khi không đồng thời "đắt" (đỏ ưu tiên nếu dữ liệu bất thường).
  const cheap = !above && isBelowThreshold(stock);
  const cell = 'px-2 py-2 text-sm text-text dark:text-text-dark';
  const editInput =
    'w-24 rounded border border-border bg-surface px-1.5 py-1 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-2dark dark:text-text-dark';

  if (editing) {
    return (
      <tr className="border-t border-border dark:border-border-dark">
        <td className={`${cell} font-semibold`}>
          <input
            value={ticker}
            onChange={(e) => { setTicker(e.target.value); setLoiSua(null); }}
            className={`${editInput} w-20 uppercase`}
            aria-label="Mã cổ phiếu"
          />
          {loiSua && <div role="alert" className="mt-1 text-[11px] font-normal text-red-600 dark:text-red-400">{loiSua}</div>}
        </td>
        <td className={cell}>
          <input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className={`${editInput} w-40`}
            aria-label="Tên công ty"
          />
          {/* Đổi nhóm ngay tại đây — cách duy nhất để chuyển một mã đang có sang
              bảng khác (VD sang Đầu tư dài hạn) mà không phải xoá rồi thêm lại. */}
          <select
            value={group}
            onChange={(e) => setGroup(e.target.value as StockGroup)}
            className={`${editInput} mt-1 w-40`}
            aria-label="Nhóm"
          >
            <option value="attack">Tấn công</option>
            <option value="balance">Cân bằng</option>
            <option value="defense">Phòng thủ</option>
            <option value="longterm">Dài hạn</option>
          </select>
        </td>
        <td className={cell}>
          <input value={priceThreshold} onChange={(e) => setPriceThreshold(e.target.value)} className={editInput} aria-label="Giá ngưỡng" />
        </td>
        <td className={cell}><OSoNguong pct={soNguongPct} /></td>
        <td className={cell}>
          <input value={priceProtect} onChange={(e) => setPriceProtect(e.target.value)} className={editInput} aria-label="Giá bảo vệ" />
        </td>
        <td className={cell}>{fmt(stock.current_price)}</td>
        <td className={cell}>
          <input value={peak} onChange={(e) => setPeak(e.target.value)} className={editInput} aria-label="Đỉnh lịch sử (nghìn đồng)" />
        </td>
        <td className={cell}><OSoDinh pct={soDinhPct} /></td>
        <td className={cell}>
          <input value={dividend} onChange={(e) => setDividend(e.target.value)} className={editInput} aria-label="Cổ tức" />
        </td>
        <td className={cell}>{yieldPct == null ? '—' : yieldPct.toFixed(1) + '%'}</td>
        <td className={cell}>
          <input value={invested} onChange={(e) => setInvested(e.target.value)} className={editInput} aria-label="Số tiền đầu tư" />
        </td>
        <td className={cell}>
          <input value={quantity} onChange={(e) => setQuantity(e.target.value)} className={editInput} aria-label="Số lượng cổ phiếu" />
        </td>
        <td className={cell}>{fmtGiaVon(avgCostThousand(stock))}</td>
        <td className={cell}>
          <button onClick={save} className="mr-2 font-semibold text-primary dark:text-primary-dark">Lưu</button>
          <button onClick={() => setEditing(false)} className="text-text-muted dark:text-text-muted-dark">Hủy</button>
        </td>
      </tr>
    );
  }

  const rowTint = above
    ? 'bg-red-50 dark:bg-red-950/30'
    : cheap
      ? 'bg-green-50 dark:bg-green-950/30'
      : '';
  const emphasize = above
    ? 'font-semibold text-red-600 dark:text-red-400'
    : cheap
      ? 'font-semibold text-green-600 dark:text-green-400'
      : '';

  return (
    <tr className={`border-t border-border dark:border-border-dark ${rowTint}`}>
      <td className={`${cell} font-semibold ${emphasize}`}>{stock.ticker}</td>
      <td className={cell}>{stock.company_name}</td>
      <td className={cell}>{fmt(stock.price_threshold)}</td>
      <td className={cell}><OSoNguong pct={soNguongPct} /></td>
      <td className={cell}>{fmt(stock.price_protect)}</td>
      <td className={`${cell} ${emphasize}`}>{fmt(stock.current_price)}</td>
      <td className={cell}>{fmt(stock.peak_price)}</td>
      <td className={cell}><OSoDinh pct={soDinhPct} /></td>
      <td className={cell}>{fmt(stock.dividend)}</td>
      <td className={cell}>{yieldPct == null ? '—' : yieldPct.toFixed(1) + '%'}</td>
      <td className={cell}>{fmt(stock.invested_amount)}</td>
      <td className={cell}>
        {stock.quantity != null ? (
          fmt(stock.quantity)
        ) : stock.invested_amount != null && stock.invested_amount > 0 ? (
          // Đã bỏ tiền mà chưa có số lượng ⇒ tab Danh mục không tính được giá
          // trị mã này. Nói ra ngay tại dòng, không để người dùng phải suy ra.
          <span
            title="Chưa nhập số lượng nên tab Danh mục không tính được giá trị mã này"
            className="font-semibold text-amber-600 dark:text-amber-400"
          >
            ⚠ chưa nhập
          </span>
        ) : (
          '—'
        )}
      </td>
      <td className={cell} title="Giá vốn TB = Đã đầu tư ÷ Số lượng (nghìn đồng/cổ)">
        {fmtGiaVon(avgCostThousand(stock))}
      </td>
      <td className={cell}>
        <button onClick={startEdit} className="mr-2 text-text-muted hover:text-primary dark:text-text-muted-dark dark:hover:text-primary-dark" aria-label="Sửa">✎</button>
        <button onClick={() => onDelete(stock.id)} className="text-text-muted hover:text-red-500 dark:text-text-muted-dark" aria-label="Xóa">✕</button>
      </td>
    </tr>
  );
}
