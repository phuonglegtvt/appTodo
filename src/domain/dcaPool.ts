// Số tiền app đem đi chia cho các nhóm mỗi tháng — hàm THUẦN, không I/O.
//
//   pool = tiền góp hàng tháng + vốn bổ sung
//   vốn bổ sung = vốn có sẵn ÷ số tháng DCA
//
// Nằm ở `src/domain/` vì đúng luật tầng này: 0 dependency ngoài `./types`, không
// I/O, không gọi Date. Đây là logic nghiệp vụ "tháng này có bao nhiêu tiền để
// mua", không phải chuyện đọc DB.
//
// Vì sao trả CẢ BA phần chứ không chỉ tổng: engine chỉ nhận một số
// (`snapshot.monthlyContributionVnd`), nên nếu ở đây chỉ trả tổng thì UI không có
// đường nào lấy lại từng phần. Mà UI buộc phải nói được "13tr = 3tr góp + 10tr
// vốn bổ sung" — thiếu dòng đó thì cột "Góp tháng này" tự nhiên to lên và không
// ai biết vì sao.

import type { MonthlyPool } from './types';

export interface DcaPlanInput {
  /** Tiền góp hàng tháng (đồng). */
  contributionVnd: number;
  /** Vốn có sẵn để rải (đồng). */
  capitalVnd: number;
  /** Số tháng rải hết vốn. `null` = chưa đặt. */
  months: number | null;
}

/** Số tiền hợp lệ = hữu hạn và không âm. */
function laSoTienHopLe(v: number): boolean {
  return Number.isFinite(v) && v >= 0;
}

/**
 * Ghép ba tham số thành số tiền chia tháng này.
 *
 * NaN / số âm thì NÉM lỗi thay vì âm thầm coi là 0: pool sai làm CẢ kế hoạch phân
 * bổ sai mà vẫn trông như một kế hoạch bình thường — đúng loại lỗi mà các guard
 * `Number.isFinite` trong buildSnapshot.ts đang chặn.
 *
 * Chia cho 0 thì KHÔNG ném lỗi, trả 0 kèm lý do: "có vốn mà chưa nhập số tháng"
 * là trạng thái bình thường của một form đang điền dở, không phải dữ liệu hỏng.
 */
export function monthlyPool(input: DcaPlanInput): MonthlyPool {
  const { contributionVnd, capitalVnd, months } = input;

  if (!laSoTienHopLe(contributionVnd)) {
    throw new Error(
      `Tiền góp hàng tháng không phải số tiền hợp lệ: ${contributionVnd}.`,
    );
  }
  if (!laSoTienHopLe(capitalVnd)) {
    throw new Error(`Vốn DCA không phải số tiền hợp lệ: ${capitalVnd}.`);
  }

  const khongCoDca = (lyDo: MonthlyPool['lyDoKhongCoDca']): MonthlyPool => ({
    contributionVnd,
    dcaSliceVnd: 0,
    totalVnd: contributionVnd,
    lyDoKhongCoDca: lyDo,
  });

  // Vốn = 0 thì số tháng bao nhiêu cũng không sinh ra đồng nào ⇒ không phải
  // trạng thái thiếu cấu hình, không cần nhắc người dùng điền gì.
  if (capitalVnd === 0) return khongCoDca(null);

  if (months === null || !Number.isFinite(months) || months <= 0) {
    return khongCoDca('chua-dat-thang');
  }

  // Làm tròn XUỐNG về đồng: đây là số tiền thật sẽ đem đi mua, đồng không có số
  // lẻ. Xuống chứ không lên — thà rải thiếu vài đồng hơn vượt vốn có thật.
  const dcaSliceVnd = Math.floor(capitalVnd / months);
  return {
    contributionVnd,
    dcaSliceVnd,
    totalVnd: contributionVnd + dcaSliceVnd,
    lyDoKhongCoDca: null,
  };
}
