import { useState } from 'react';
import { applyStockTx, avgCostThousand } from '../lib/stockTransaction';
import { parseVnNumber } from '../lib/parseNumber';
import type { TxSide } from '../lib/cryptoTransaction';
import type { StockTxResult } from '../lib/stockTransaction';
import type { Stock } from '../types/stock';
import { SearchSelect } from './SearchSelect';
import type { NewStockTransaction } from '../types/stockTransaction';

// Form ghi một giao dịch MUA / BÁN cổ phiếu. Giá và tiền theo NGHÌN ĐỒNG như cả
// tab Cổ phiếu. Ô "Số tiền" tự gợi ý = số lượng × giá; sửa lại được để gồm phí,
// thuế (đó mới là số tiền thật đã chi / nhận về).

interface Props {
  stocks: Stock[];
  onRecord: (stock: Stock, input: NewStockTransaction) => Promise<number | null>;
}

const inputClass =
  'rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none transition-colors placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-border-dark dark:bg-surface-2dark dark:text-text-dark dark:placeholder:text-text-muted-dark dark:focus:border-primary-dark dark:focus:ring-primary-dark/30';
const nhanClass = 'text-[11px] font-bold uppercase tracking-[0.06em] text-text-muted dark:text-text-muted-dark';

/** Ngày hôm nay theo giờ máy, dạng YYYY-MM-DD. */
function homNay(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Số nghìn đồng → chuỗi đồng đầy đủ, để người đọc không phải tự nhân 1.000. */
function dong(thousand: number | null): string {
  return thousand === null ? '—' : Math.round(thousand * 1_000).toLocaleString('vi-VN') + ' đ';
}

function so(v: number | null): string {
  return v === null ? '—' : v.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
}

export function StockTransactionForm({ stocks, onRecord }: Props) {
  const [stockId, setStockId] = useState('');
  const [side, setSide] = useState<TxSide>('BUY');
  const [ngay, setNgay] = useState(homNay);
  const [soLuong, setSoLuong] = useState('');
  const [gia, setGia] = useState('');
  // Chuỗi rỗng = chưa sửa tay ⇒ dùng gợi ý SL × giá.
  const [tien, setTien] = useState('');
  const [ghiChu, setGhiChu] = useState('');
  const [dangGhi, setDangGhi] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  const [xong, setXong] = useState<string | null>(null);

  const stock = stocks.find((s) => s.id === stockId) ?? null;
  const q = parseVnNumber(soLuong);
  const p = parseVnNumber(gia);
  const goiY = q !== null && p !== null ? q * p : null;
  const a = tien.trim() === '' ? goiY : parseVnNumber(tien);

  let xemTruoc: StockTxResult | null = null;
  let loiXemTruoc: string | null = null;
  if (stock && q !== null && p !== null && a !== null) {
    try {
      xemTruoc = applyStockTx(stock, { side, quantity: q, price_thousand: p, amount_thousand: a });
    } catch (err) {
      loiXemTruoc = err instanceof Error ? err.message : String(err);
    }
  }

  function doi<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); setXong(null); setLoi(null); };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoi(null);
    setXong(null);
    if (!stock) { setLoi('Chọn mã cổ phiếu.'); return; }
    if (!ngay) { setLoi('Chọn ngày giao dịch.'); return; }
    if (q === null) { setLoi('Số lượng chưa nhập hoặc không phải số.'); return; }
    if (p === null) { setLoi('Giá (nghìn đồng/cổ) chưa nhập hoặc không phải số.'); return; }
    if (a === null) { setLoi('Số tiền (nghìn đồng) không phải số hợp lệ.'); return; }

    setDangGhi(true);
    try {
      const laiLo = await onRecord(stock, {
        side, trade_date: ngay, quantity: q, price_thousand: p, amount_thousand: a, note: ghiChu.trim(),
      });
      setXong(
        `Đã ghi ${side === 'BUY' ? 'mua' : 'bán'} ${so(q)} cổ ${stock.ticker}.`
        + (laiLo !== null ? ` Lãi/lỗ đã chốt: ${laiLo >= 0 ? '+' : ''}${dong(laiLo)}.` : ''),
      );
      setSoLuong('');
      setGia('');
      setTien('');
      setGhiChu('');
    } catch (err) {
      console.error('Lỗi ghi giao dịch cổ phiếu:', err);
      setLoi(err instanceof Error ? err.message : String(err));
    } finally {
      setDangGhi(false);
    }
  }

  const nutSide = (s: TxSide, label: string) => (
    <button
      type="button"
      onClick={() => doi(setSide)(s)}
      aria-pressed={side === s}
      className={`rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
        side === s
          ? s === 'BUY'
            ? 'bg-green-600 text-white dark:bg-green-500'
            : 'bg-red-600 text-white dark:bg-red-500'
          : 'text-text-muted dark:text-text-muted-dark'
      }`}
    >
      {label}
    </button>
  );

  const manh = 'text-text dark:text-text-dark';

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-text dark:text-text-dark">Ghi giao dịch</h3>
        <div className="flex gap-0.5 rounded-lg border border-border bg-surface-2 p-0.5 dark:border-border-dark dark:bg-surface-2dark">
          {nutSide('BUY', 'Mua')}
          {nutSide('SELL', 'Bán')}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <span className={nhanClass}>Mã</span>
          <SearchSelect
            options={stocks.map((s) => ({ value: s.id, symbol: s.ticker, name: s.company_name }))}
            value={stockId}
            onChange={doi(setStockId)}
            ariaLabel="Mã cổ phiếu"
            placeholder="Gõ mã / tên…"
            className={`w-40 ${inputClass}`}
          />
        </div>
        <label className="flex flex-col gap-1">
          <span className={nhanClass}>Ngày</span>
          <input
            type="date"
            value={ngay}
            onChange={(e) => doi(setNgay)(e.target.value)}
            aria-label="Ngày giao dịch"
            className={`w-40 ${inputClass}`}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={nhanClass}>Số lượng (cổ)</span>
          <input
            value={soLuong}
            onChange={(e) => doi(setSoLuong)(e.target.value)}
            inputMode="numeric"
            placeholder="1000"
            aria-label="Số lượng cổ phiếu"
            className={`w-28 ${inputClass}`}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={nhanClass}>Giá (nghìn/cổ)</span>
          <input
            value={gia}
            onChange={(e) => doi(setGia)(e.target.value)}
            inputMode="decimal"
            placeholder="25,5"
            aria-label="Giá mỗi cổ (nghìn đồng)"
            className={`w-32 ${inputClass}`}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={nhanClass}>{side === 'BUY' ? 'Tiền đã chi (nghìn)' : 'Tiền nhận về (nghìn)'}</span>
          <input
            value={tien}
            onChange={(e) => doi(setTien)(e.target.value)}
            inputMode="decimal"
            placeholder={goiY === null ? 'SL × giá' : so(goiY)}
            aria-label={side === 'BUY' ? 'Số tiền đã chi (nghìn đồng)' : 'Số tiền nhận về (nghìn đồng)'}
            className={`w-40 ${inputClass}`}
          />
        </label>
        <label className="flex min-w-[10rem] flex-1 flex-col gap-1">
          <span className={nhanClass}>Ghi chú</span>
          <input
            value={ghiChu}
            onChange={(e) => doi(setGhiChu)(e.target.value)}
            placeholder="Công ty CK, lý do… (không bắt buộc)"
            aria-label="Ghi chú"
            className={inputClass}
          />
        </label>
        <button
          disabled={dangGhi || stocks.length === 0}
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:shadow-md active:scale-95 disabled:opacity-50 dark:bg-primary-dark dark:shadow-soft-dark"
        >
          {dangGhi ? 'Đang ghi…' : 'Ghi giao dịch'}
        </button>
      </div>

      <p className="text-[12px] text-text-muted dark:text-text-muted-dark">
        Để trống ô tiền thì app lấy <strong>số lượng × giá</strong>. Có phí / thuế thì
        nhập số tiền thật đã chi (mua) hoặc thực nhận (bán).
      </p>

      {stock && xemTruoc && (
        <p className="text-[13px] leading-relaxed text-text-muted dark:text-text-muted-dark">
          Sau giao dịch, <strong className={manh}>{stock.ticker}</strong>:{' '}
          số lượng {so(stock.quantity)} → <strong className={manh}>{so(xemTruoc.after.quantity)}</strong>
          {' · '}vốn {dong(stock.invested_amount)} → <strong className={manh}>{dong(xemTruoc.after.invested_amount)}</strong>
          {' · '}giá vốn TB {so(avgCostThousand(stock))} →{' '}
          <strong className={manh}>{so(avgCostThousand(xemTruoc.after))}</strong> nghìn/cổ
          {xemTruoc.realizedPnlThousand !== null && (
            <>
              {' · '}lãi/lỗ đã chốt{' '}
              <strong className={xemTruoc.realizedPnlThousand >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                {xemTruoc.realizedPnlThousand >= 0 ? '+' : ''}{dong(xemTruoc.realizedPnlThousand)}
              </strong>
            </>
          )}
        </p>
      )}

      {loiXemTruoc !== null && (
        <p role="alert" className="text-[13px] text-amber-700 dark:text-amber-400">⚠ {loiXemTruoc}</p>
      )}
      {loi !== null && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">⚠ {loi}</p>
      )}
      {xong !== null && (
        <p role="status" className="text-sm text-green-600 dark:text-green-400">✓ {xong}</p>
      )}
    </form>
  );
}
