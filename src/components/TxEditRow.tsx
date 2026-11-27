import { useState, type ReactNode } from 'react';
import { parseVnNumber } from '../lib/parseNumber';
import type { TxSide } from '../lib/cryptoTransaction';
import { SearchSelect, type SearchOption } from './SearchSelect';

// Form sửa một giao dịch, mở ngay dưới dòng trong bảng lịch sử. Dùng chung cho
// sổ cổ phiếu và sổ crypto — hai bên chỉ khác đơn vị và phần xem trước, được
// truyền vào qua props. Đổi được cả mã/coin (chuyển giao dịch sang tài sản khác).
//
// `preview` chạy ĐÚNG phép tính sẽ gửi lên DB, nên số hiện ra là số sẽ lưu; lỗi
// (bán quá số đang có, dây chuyền bị sửa tay) hiện trước khi bấm Lưu.

export interface TxEditValues {
  assetId: string;
  side: TxSide;
  trade_date: string;
  quantity: number;
  price: number;
  amount: number;
  note: string;
}

interface Props {
  title: string;
  colSpan: number;
  assetLabel: string;
  assetOptions: SearchOption[];
  initial: TxEditValues;
  labels: { price: string; amountBuy: string; amountSell: string };
  /** Trả nội dung xem trước; ném lỗi tiếng Việt nếu số liệu mới không hợp lệ. */
  preview: (v: Omit<TxEditValues, 'trade_date' | 'note'>) => ReactNode;
  onSave: (v: TxEditValues) => Promise<void>;
  onClose: () => void;
}

const o = 'rounded-md border border-border bg-surface px-2 py-1.5 text-[13px] text-text outline-none focus:border-primary dark:border-border-dark dark:bg-surface-2dark dark:text-text-dark dark:focus:border-primary-dark';
const nhan = 'text-[11px] font-bold uppercase tracking-[0.06em] text-text-muted dark:text-text-muted-dark';

/** Số → chuỗi để sửa, dấu phẩy thập phân kiểu VN, không dấu nhóm nghìn. */
const sua = (v: number) => String(v).replace('.', ',');

export function TxEditRow({ title, colSpan, assetLabel, assetOptions, initial, labels, preview, onSave, onClose }: Props) {
  const [assetId, setAssetId] = useState(initial.assetId);
  const [side, setSide] = useState<TxSide>(initial.side);
  const [ngay, setNgay] = useState(initial.trade_date);
  const [soLuong, setSoLuong] = useState(sua(initial.quantity));
  const [gia, setGia] = useState(sua(initial.price));
  const [tien, setTien] = useState(sua(initial.amount));
  const [ghiChu, setGhiChu] = useState(initial.note);
  const [dangLuu, setDangLuu] = useState(false);
  const [loiLuu, setLoiLuu] = useState<string | null>(null);

  const q = parseVnNumber(soLuong);
  const p = parseVnNumber(gia);
  const a = parseVnNumber(tien);

  let xemTruoc: ReactNode = null;
  let loiXemTruoc: string | null = null;
  if (!ngay) loiXemTruoc = 'Chọn ngày giao dịch.';
  else if (q === null || p === null || a === null) loiXemTruoc = 'Số lượng, giá và số tiền phải là số.';
  else {
    try {
      xemTruoc = preview({ assetId, side, quantity: q, price: p, amount: a });
    } catch (err) {
      loiXemTruoc = err instanceof Error ? err.message : String(err);
    }
  }

  async function luu() {
    if (loiXemTruoc !== null || q === null || p === null || a === null) return;
    setDangLuu(true);
    setLoiLuu(null);
    try {
      await onSave({ assetId, side, trade_date: ngay, quantity: q, price: p, amount: a, note: ghiChu.trim() });
      onClose();
    } catch (err) {
      console.error('Lỗi sửa giao dịch:', err);
      setLoiLuu(err instanceof Error ? err.message : String(err));
    } finally {
      setDangLuu(false);
    }
  }

  const doiMa = assetId !== initial.assetId;

  return (
    <tr className="border-b border-border bg-surface-2 dark:border-border-dark dark:bg-surface-2dark">
      <td colSpan={colSpan} className="px-3 py-3">
        <div className="flex flex-col gap-3 text-left">
          <div className="text-[13px] font-semibold text-text dark:text-text-dark">{title}</div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <span className={nhan}>{assetLabel}</span>
              <SearchSelect options={assetOptions} value={assetId} onChange={setAssetId}
                ariaLabel={assetLabel} placeholder="Gõ để tìm…" className={`w-28 font-semibold ${o}`} />
            </div>
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
              <input value={soLuong} onChange={(e) => setSoLuong(e.target.value)} inputMode="decimal" className={`w-28 text-right font-mono ${o}`} />
            </label>
            <label className="flex flex-col gap-1">
              <span className={nhan}>{labels.price}</span>
              <input value={gia} onChange={(e) => setGia(e.target.value)} inputMode="decimal" className={`w-28 text-right font-mono ${o}`} />
            </label>
            <label className="flex flex-col gap-1">
              <span className={nhan}>{side === 'BUY' ? labels.amountBuy : labels.amountSell}</span>
              <input value={tien} onChange={(e) => setTien(e.target.value)} inputMode="decimal" className={`w-36 text-right font-mono ${o}`} />
            </label>
            <label className="flex min-w-[10rem] flex-1 flex-col gap-1">
              <span className={nhan}>Ghi chú</span>
              <input value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} placeholder="Công ty CK, lý do…" className={o} />
            </label>
          </div>

          {doiMa && (
            <p className="text-[12px] text-amber-700 dark:text-amber-400">
              Đổi {assetLabel.toLowerCase()}: giao dịch được chuyển sang mã mới. Số liệu của CẢ mã cũ và mã mới sẽ được tính lại.
            </p>
          )}
          {xemTruoc !== null && loiXemTruoc === null && (
            <div className="text-[13px] leading-relaxed text-text-muted dark:text-text-muted-dark">{xemTruoc}</div>
          )}
          {loiXemTruoc !== null && (
            <p role="alert" className="text-[13px] text-amber-700 dark:text-amber-400">⚠ {loiXemTruoc}</p>
          )}
          {loiLuu !== null && (
            <p role="alert" className="text-[13px] text-red-600 dark:text-red-400">⚠ {loiLuu}</p>
          )}

          <div className="flex gap-2">
            <button type="button" onClick={() => void luu()} disabled={loiXemTruoc !== null || dangLuu}
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
