// Máy tính lãi kép: tiền gốc ban đầu + góp đều hàng tháng, lãi nhập gốc theo kỳ.
//
// Mô hình (khớp công cụ của TopCV ở chế độ "Hàng năm"):
// - Một năm chia thành `kyMoiNam` kỳ ghép lãi (1 = năm, 4 = quý, 12 = tháng).
// - Lãi suất mỗi kỳ = laiSuatNam / kyMoiNam (lãi suất danh nghĩa, như ngân hàng niêm yết).
// - Tiền góp của cả kỳ (= góp tháng × số tháng trong kỳ) cộng vào CUỐI kỳ, nên
//   kỳ đó chưa sinh lãi. Đây là giả định thận trọng: tiền góp tháng 1 phải đợi
//   hết kỳ mới bắt đầu ghép lãi.
// Ví dụ đối chiếu: 10 tr gốc, 10 tr/tháng, 10 năm, 10%/năm, ghép năm → 1.938.428.376 đ.

export type KyGhepLai = 1 | 4 | 12;

export interface CompoundInput {
  /** Tiền gốc ban đầu (đồng). */
  gocBanDau: number;
  /** Số tiền góp thêm mỗi tháng (đồng). */
  gopMoiThang: number;
  /** Số năm gửi (nguyên dương). */
  soNam: number;
  /** Lãi suất danh nghĩa theo năm, đơn vị % (10 = 10%/năm). */
  laiSuatNamPct: number;
  kyMoiNam: KyGhepLai;
}

export interface CompoundYearRow {
  nam: number;
  /** Tổng tiền đã bỏ ra tính đến cuối năm này. */
  tienGoc: number;
  /** Giá trị tài khoản cuối năm này. */
  giaTri: number;
  /** giaTri - tienGoc. */
  tienLai: number;
}

export interface CompoundResult {
  /** Năm 0 (lúc bắt đầu) tới năm soNam. */
  rows: CompoundYearRow[];
  giaTriCuoi: number;
  tongGoc: number;
  tongLai: number;
}

/** Ném lỗi tiếng Việt nếu đầu vào không dùng được — không lặng lẽ coi là 0. */
function kiemTra(input: CompoundInput): void {
  const { gocBanDau, gopMoiThang, soNam, laiSuatNamPct, kyMoiNam } = input;
  if (!Number.isFinite(gocBanDau) || gocBanDau < 0) throw new Error('Tiền gốc ban đầu phải là số ≥ 0.');
  if (!Number.isFinite(gopMoiThang) || gopMoiThang < 0) throw new Error('Tiền góp mỗi tháng phải là số ≥ 0.');
  if (!Number.isInteger(soNam) || soNam < 1 || soNam > 100) throw new Error('Số năm phải là số nguyên từ 1 đến 100.');
  if (!Number.isFinite(laiSuatNamPct) || laiSuatNamPct < 0 || laiSuatNamPct > 1000) {
    throw new Error('Lãi suất phải là số từ 0 đến 1000 (%/năm).');
  }
  if (![1, 4, 12].includes(kyMoiNam)) throw new Error('Kỳ ghép lãi không hợp lệ.');
}

export function tinhLaiKep(input: CompoundInput): CompoundResult {
  kiemTra(input);
  const { gocBanDau, gopMoiThang, soNam, laiSuatNamPct, kyMoiNam } = input;
  const laiMoiKy = laiSuatNamPct / 100 / kyMoiNam;
  const gopMoiKy = gopMoiThang * (12 / kyMoiNam);

  let giaTri = gocBanDau;
  let tienGoc = gocBanDau;
  const rows: CompoundYearRow[] = [{ nam: 0, tienGoc, giaTri, tienLai: 0 }];

  for (let nam = 1; nam <= soNam; nam++) {
    for (let ky = 0; ky < kyMoiNam; ky++) {
      giaTri = giaTri * (1 + laiMoiKy) + gopMoiKy;
      tienGoc += gopMoiKy;
    }
    rows.push({ nam, tienGoc, giaTri, tienLai: giaTri - tienGoc });
  }

  return { rows, giaTriCuoi: giaTri, tongGoc: tienGoc, tongLai: giaTri - tienGoc };
}
