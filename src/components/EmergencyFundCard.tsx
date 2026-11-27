import { useCashEntries } from '../hooks/useCashEntries';
import { chiTrungBinh, danhGiaQuyDuPhong } from '../lib/emergencyFund';
import { formatVnd } from '../lib/portfolioClassMeta';

// Quỹ dự phòng khẩn cấp: tiền mặt (màn Cấu hình) ÷ chi tiêu trung bình 3 tháng
// gần nhất có ghi (tab Thu–Chi) = đủ sống bao nhiêu tháng. Mục tiêu 6 tháng.
// Phép tính ở src/lib/emergencyFund.ts (có test).

interface Props {
  userId: string;
  tienMat: number;
  homNay: string;
}

const MUC_TIEU = 6;
const mo = 'text-text-muted dark:text-text-muted-dark';

export function EmergencyFundCard({ userId, tienMat, homNay }: Props) {
  const { entries, loading, error } = useCashEntries(userId);
  const ctb = chiTrungBinh(entries, homNay);
  const q = danhGiaQuyDuPhong(tienMat, ctb.trungBinh, MUC_TIEU);
  const mau = q.muc === 'DU' ? 'bg-green-500' : q.muc === 'TAM_DUOC' ? 'bg-amber-500' : 'bg-red-500';

  return (
    <section className="surface-card flex flex-col gap-2 p-4">
      <div className="text-[15px] font-bold text-text dark:text-text-dark">Quỹ dự phòng khẩn cấp</div>
      {error ? (
        <p role="alert" className="text-[13px] text-red-600 dark:text-red-400">⚠ Không tải được Thu–Chi để tính chi tiêu: {error}</p>
      ) : loading ? (
        <p className={`text-[13px] ${mo}`}>Đang tải…</p>
      ) : q.muc === 'CHUA_BIET' ? (
        <p className={`text-[13px] ${mo}`}>
          Chưa đủ dữ liệu chi tiêu: cần ít nhất một tháng trọn đã ghi khoản chi ở tab Thu–Chi. Tiền mặt hiện có {formatVnd(tienMat)}.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline gap-x-3">
            <span className="text-[26px] font-bold tracking-tight text-text dark:text-text-dark">
              {(q.soThangDuSong ?? 0).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tháng
            </span>
            <span className={`text-[13px] ${mo}`}>
              = tiền mặt {formatVnd(tienMat)} ÷ chi trung bình {formatVnd(ctb.trungBinh ?? 0)}/tháng
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2 dark:bg-surface-2dark">
            <div className={`h-full rounded-full ${mau}`} style={{ width: `${Math.min(100, ((q.soThangDuSong ?? 0) / MUC_TIEU) * 100)}%` }} />
          </div>
          <p className="text-[13px] text-text dark:text-text-dark">
            {q.muc === 'DU'
              ? `Đã đủ quỹ dự phòng ${MUC_TIEU} tháng.`
              : <>Mục tiêu {MUC_TIEU} tháng: cần thêm <strong>{formatVnd(q.conThieu ?? 0)}</strong> tiền mặt{q.muc === 'THIEU' && ' — đang dưới 3 tháng, nên ưu tiên trước khi đầu tư thêm'}.</>}
          </p>
          <p className={`text-[12px] ${mo}`}>
            Chi trung bình tính từ {ctb.thangDung.map((t) => `${Number(t.slice(5))}/${t.slice(0, 4)}`).join(', ')} (tháng trọn có ghi chi;
            không gồm đáo hạn và chuyển đầu tư). Tiền mặt sửa ở màn Cấu hình.
          </p>
        </>
      )}
    </section>
  );
}
