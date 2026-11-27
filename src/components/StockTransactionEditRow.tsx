import { useState } from 'react';
import { parseVnNumber } from '../lib/parseNumber';
import { avgCostThousand, planStockTxEdit, recordedChainOf, type StockTxEditPlan } from '../lib/stockTransaction';
import type { TxSide } from '../lib/cryptoTransaction';
import type { NewStockTransaction, StockTransaction } from '../types/stockTransaction';

// Form sửa một giao dịch, mở ngay dưới dòng trong bảng lịch sử.
// Xem trước dùng ĐÚNG phép tính sẽ gửi lên DB (planStockTxEdit), nên số hiện ở
// đây là số sẽ được lưu — và lỗi (bán quá số đang có, dây chuyền bị sửa tay)
// hiện ra trước khi bấm Lưu.

interface Props {
  tx: StockTransaction;
  ticker: string;
  transactions: StockTransaction[];
  colSpan: number;
  onSave: (txId: string, input: NewStockTransaction) => Promise<void>;
  onClose: () => void;
}

const o = 'rounded-md border border-border bg-surface px-2 py-1.5 text-[13px] text-text outline-none focus:border-primary dark:border-border-dark dark:bg-surface-2dark dark:text-text-dark dark:focus:border-primary-dark';
const nhan = 'text-[11px] font-bold uppercase tracking-[0.06em] text-text-muted dark:text-text-muted-dark';

const fmt = (v: number | null, d = 2) => (v === null ? '—' : v.toLocaleString('vi-VN', { maximumFractionDigits: d }));
const dong = (thousand: number | null) => (thousand === null ? '—' : Math.round(thousand * 1000).toLocaleString('vi-VN') + ' đ');

export function StockTransactionEditRow({ tx, ticker, transactions, colSpan, onSave, onClose }: Props) {
  const [side, setSide] = useState<TxSide>(tx.side);
  const [ngay, setNgay] = useState(tx.trade_date);
  const [soLuong, setSoLuong] = useState(String(Number(tx.quantity)).replace('.', ','));
  const [gia, setGia] = useState(String(Number(tx.price_thousand)).replace('.', ','));
  const [tien, setTien] = useState(String(Number(tx.amount_thousand)).replace('.', ','));
  const [ghiChu, setGhiChu] = useState(tx.note);
  const [dangLuu, setDangLuu] = useState(false);
  const [loiLuu, setLoiLuu] = useState<string | null>(null);

  const q = parseVnNumber(soLuong);
  const p = parseVnNumber(gia);
  const a = parseVnNumber(tien);

  let plan: StockTxEditPlan | null = null;
  let loiXemTruoc: string | null = null;
  if (!ngay) loiXemTruoc = 'Chọn ngày giao dịch.';
  else if (q === null || p === null || a === null) loiXemTruoc = 'Số lượng, giá và số tiền phải là số.';
  else {
    try {
      plan = planStockTxEdit(recordedChainOf(transactions, tx.stock_id), tx.id, {
        side, quantity: q, price_thousand: p, amount_thousand: a,
      });
    } catch (err) {
      loiXemTruoc = err instanceof Error ? err.message : String(err);
    }
  }

  async function luu() {
    if (plan === null || q === null || p === null || a === null) return;
    setDangLuu(true);
    setLoiLuu(null);
    try {
      await onSave(tx.id, { side, trade_date: ngay, quantity: q, price_thousand: p, amount_thousand: a, note: ghiChu.trim() });
      onClose();
    } catch (err) {
      console.error('Lỗi sửa giao dịch cổ phiếu:', err);
      setLoiLuu(err instanceof Error ? err.message : String(err));
    } finally {
      setDangLuu(false);
    }
  }

  const sauGd = plan?.updates.length ?? 1;

  return (
    <tr className="border-b border-border bg-surface-2 dark:border-border-dark dark:bg-surface-2dark">
      <td colSpan={colSpan} className="px-3 py-3">
        <div className="flex flex-col gap-3 text-left">
          <div className="text-[13px] font-semibold text-text dark:text-text-dark">Sửa giao dịch {ticker}</div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <span className={nhan}>Loại</span>
              <div className="flex gap-0.5 rounded-lg border border-border bg-surface p-0.5 dark:border-border-dark dark:bg-surface-dark">
                {(['BUY', 'SELL'] as const).map((s) => (
                  <button key={s} type="button" onClick={() => setSide(s)} aria-pressed={side === s}
                    className={`rounded-md px-3 py-1 text-[12.5px] font-semibold ${
                      side === s
                        ? s === 'BUY' ? 'bg-green-600 text-white dark:bg-green-500' : 'bg-red-600 text-white dark:bg-red-500'
                        : 'text-text-muted dark:text-text-muted-dark'
                    }`}>
                    {s === 'BUY' ? 'Mua' : 'Bán'}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex flex-col gap-1">
              <span className={nhan}>Ngày</span>
              <input type="date" value={ngay} onChange={(e) => setNgay(e.target.value)} className={`w-36 ${o}`} />
            </label>
            <label className="flex flex-col gap-1">
              <span className={nhan}>Số lượng</span>
              <input value={soLuong} onChange={(e) => setSoLuong(e.target.value)} inputMode="numeric" className={`w-24 text-right font-mono ${o}`} />
            </label>
            <label className="flex flex-col gap-1">
              <span className={nhan}>Giá (nghìn)</span>
              <input value={gia} onChange={(e) => setGia(e.target.value)} inputMode="decimal" className={`w-24 text-right font-mono ${o}`} />
            </label>
            <label className="flex flex-col gap-1">
              <span className={nhan}>{side === 'BUY' ? 'Tiền đã chi (nghìn)' : 'Tiền nhận (nghìn)'}</span>
              <div className="flex gap-1">
                <input value={tien} onChange={(e) => setTien(e.target.value)} inputMode="decimal" className={`w-32 text-right font-mono ${o}`} />
                <button type="button" disabled={q === null || p === null}
                  onClick={() => q !== null && p !== null && setTien(String(Math.round(q * p * 1000) / 1000).replace('.', ','))}
                  title="Đặt lại bằng số lượng × giá"
                  className="rounded-md px-2 text-[12px] font-semibold text-primary hover:underline disabled:opacity-40 dark:text-primary-dark">
                  = SL×giá
                </button>
              </div>
            </label>
            <label className="flex min-w-[10rem] flex-1 flex-col gap-1">
              <span className={nhan}>Ghi chú</span>
              <input value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} placeholder="Công ty CK, lý do…" className={o} />
            </label>
          </div>

          {plan !== null && (
            <p className="text-[13px] leading-relaxed text-text-muted dark:text-text-muted-dark">
              Sau khi sửa, <strong className="text-text dark:text-text-dark">{ticker}</strong>: số lượng{' '}
              {fmt(plan.expectedCurrent.quantity)} → <strong className="text-text dark:text-text-dark">{fmt(plan.final.quantity)}</strong>
              {' · '}vốn {dong(plan.expectedCurrent.invested_amount)} →{' '}
              <strong className="text-text dark:text-text-dark">{dong(plan.final.invested_amount)}</strong>
              {' · '}giá vốn TB {fmt(avgCostThousand(plan.expectedCurrent))} →{' '}
              <strong className="text-text dark:text-text-dark">{fmt(avgCostThousand(plan.final))}</strong> nghìn/cổ.
              {sauGd > 1 && <> Tự tính lại {sauGd - 1} giao dịch ghi sau giao dịch này.</>}
            </p>
          )}
          {loiXemTruoc !== null && (
            <p role="alert" className="text-[13px] text-amber-700 dark:text-amber-400">⚠ {loiXemTruoc}</p>
          )}
          {loiLuu !== null && (
            <p role="alert" className="text-[13px] text-red-600 dark:text-red-400">⚠ {loiLuu}</p>
          )}

          <div className="flex gap-2">
            <button type="button" onClick={() => void luu()} disabled={plan === null || dangLuu}
              className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-white transition hover:opacity-90 active:scale-95 disabled:opacity-50 dark:bg-primary-dark dark:text-bg-dark">
              {dangLuu ? 'Đang lưu…' : 'Lưu'}
            </button>
            <button type="button" onClick={onClose} disabled={dangLuu}
              className="rounded-lg px-4 py-1.5 text-sm font-semibold text-text-muted hover:bg-surface hover:text-text dark:text-text-muted-dark dark:hover:bg-surface-dark dark:hover:text-text-dark">
              Huỷ
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
}
