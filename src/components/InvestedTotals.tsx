import { formatVnd } from '../lib/portfolioClassMeta';
import type { VonDaBo } from '../data/holdingsMap';

interface Props {
  von: VonDaBo;
  /** Đang chờ tỷ giá về (khác hẳn "lấy tỷ giá thất bại"). */
  dangChoTyGia: boolean;
}

const O = 'flex flex-col gap-0.5 rounded-lg bg-surface-2 px-3 py-2 dark:bg-surface-2dark';
const NHAN = 'text-[11px] font-semibold tracking-[0.04em] text-text-muted dark:text-text-muted-dark';
const SO = 'font-mono text-[15px] font-bold tabular-nums text-text dark:text-text-dark';

/**
 * Khối "Lũy kế đã đầu tư" — CHỈ ĐỌC, tự động từ 3 tab Cổ phiếu / Crypto / Vàng.
 *
 * ⚠️ Đây là số LŨY KẾ từ trước tới nay, KHÔNG phải số của tháng đang xem, và
 * KHÔNG trừ vào cân đối thu–chi. Ba bảng nguồn không có cột ngày nên không tách
 * được theo tháng — nói thẳng ngay trên khối thay vì để người đọc tự đoán.
 */
export function InvestedTotals({ von, dangChoTyGia }: Props) {
  const tienCrypto = von.cryptoVnd === null
    ? (dangChoTyGia ? 'đang lấy tỷ giá…' : 'chưa quy đổi được')
    : formatVnd(von.cryptoVnd);

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3 dark:border-border-dark dark:bg-surface-dark">
      <div>
        <h3 className="text-sm font-bold text-text dark:text-text-dark">Lũy kế đã đầu tư</h3>
        <p className="mt-0.5 text-[12px] leading-relaxed text-text-muted dark:text-text-muted-dark">
          Tự động cộng từ tab Cổ phiếu, Crypto và Vàng. Đây là tổng{' '}
          <strong>từ trước tới nay</strong>, không phải của tháng đang xem, nên{' '}
          <strong>không</strong> trừ vào ô "Còn lại" phía trên.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className={O}>
          <span className={NHAN}>Cổ phiếu</span>
          <span className={SO}>{formatVnd(von.stocksVnd)}</span>
        </div>
        <div className={O}>
          <span className={NHAN}>Crypto</span>
          <span
            className={
              von.cryptoVnd === null
                ? 'font-mono text-[13px] text-amber-600 dark:text-amber-400'
                : SO
            }
          >
            {tienCrypto}
          </span>
        </div>
        <div className={O}>
          <span className={NHAN}>Vàng</span>
          <span className={SO}>{formatVnd(von.goldVnd)}</span>
        </div>
        <div className={`${O} bg-primary-soft dark:bg-primary-soft-dark`}>
          <span className={NHAN}>Tổng</span>
          <span className={von.tongVnd === null ? 'font-mono text-[13px] text-amber-600 dark:text-amber-400' : SO}>
            {von.tongVnd === null ? 'thiếu phần crypto' : formatVnd(von.tongVnd)}
          </span>
        </div>
      </div>

      {von.boSotSymbols.length > 0 && (
        <p role="alert" className="text-[12px] leading-relaxed text-amber-700 dark:text-amber-400">
          ⚠ Chưa tính được vào tổng: <strong>{von.boSotSymbols.join(', ')}</strong> —
          các dòng này mới có giá mua mà chưa có số lượng. Cách sửa nhanh nhất: điền cột{' '}
          <strong>"Đã đầu tư (đ)"</strong> ở tab tương ứng (nhập thẳng số tiền đã bỏ ra,
          không cần số lượng, không phụ thuộc tỷ giá).
        </p>
      )}
    </section>
  );
}
