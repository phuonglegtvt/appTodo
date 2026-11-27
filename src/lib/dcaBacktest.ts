// Giả lập DCA (mua đều hàng tháng) trên chuỗi giá LỊCH SỬ thật của một tài sản.
//
// Hàm thuần: nhận chuỗi giá đã tải sẵn, không gọi mạng, không đọc đồng hồ —
// "đến ngày" truyền vào qua tham số để test tái lập được.
//
// ĐƠN VỊ: phép tính không phụ thuộc đơn vị giá. Số đơn vị mua = tiền / giá, giá
// trị = số đơn vị × giá ⇒ đơn vị giá triệt tiêu. Vì vậy cổ phiếu (nghìn đồng),
// chỉ số (điểm), BTC (USD) đều chạy chung một hàm. Với BTC, điều đó tương đương
// giả định tỷ giá USD/VND cố định suốt kỳ — UI phải nói rõ giả định này.

export interface PricePoint {
  /** Ngày giao dịch dạng YYYY-MM-DD. */
  date: string;
  /** Giá đóng cửa (đơn vị tuỳ nguồn, xem ghi chú đầu file). */
  close: number;
}

export interface DcaInput {
  /** Chuỗi giá, sắp tăng dần theo ngày. */
  prices: PricePoint[];
  /** Số tiền mua mỗi tháng (đồng). */
  soTienMoiKy: number;
  /** Ngày bắt đầu (YYYY-MM-DD). */
  tuNgay: string;
  /** Ngày kết thúc (YYYY-MM-DD), tính cả ngày này. */
  denNgay: string;
  /** Ngày mua trong tháng, 1–28 (tránh tháng 2 không có ngày 30). */
  ngayTrongThang: number;
  /** Phí mua, % trên số tiền mỗi lần mua (0.15 = 0,15%). */
  phiMuaPct: number;
  /** Lãi suất gửi tiết kiệm để so sánh, %/năm, ghép lãi liên tục theo ngày. */
  laiGuiPct: number;
}

export interface DcaBuy {
  date: string;
  price: number;
  soTien: number;
  donVi: number;
}

export interface DcaPoint {
  date: string;
  /** Tổng tiền đã bỏ ra tới ngày này. */
  von: number;
  /** Giá trị danh mục theo giá đóng cửa ngày này. */
  giaTri: number;
  /** Cùng dòng tiền nếu gửi tiết kiệm `laiGuiPct`. */
  guiTietKiem: number;
}

export interface DcaResult {
  buys: DcaBuy[];
  series: DcaPoint[];
  /** Ngày có giá đầu tiên trong chuỗi — có thể muộn hơn `tuNgay` (mã lên sàn sau). */
  ngayDauDuLieu: string;
  /** Ngày giá cuối cùng dùng để định giá. */
  ngayDinhGia: string;
  giaCuoi: number;
  tongVon: number;
  giaTriCuoi: number;
  laiLo: number;
  laiLoPct: number;
  /** Lợi nhuận năm hoá theo dòng tiền (XIRR). null nếu không giải được. */
  xirrPct: number | null;
  tongDonVi: number;
  /** Giá vốn trung bình = tổng tiền (gồm phí) / tổng đơn vị. */
  giaVonTb: number;
  tongPhi: number;
  giaTriGuiTietKiem: number;
  /** Lãi cao nhất từng đạt (% trên vốn) và ngày đạt. */
  laiCaoNhat: { pct: number; date: string };
  /** Lỗ sâu nhất từng chịu (% trên vốn, âm hoặc 0) và ngày. */
  loSauNhat: { pct: number; date: string };
}

const MS_NGAY = 86_400_000;

/** YYYY-MM-DD → số ngày kể từ 1970-01-01 (UTC, không lệch múi giờ). */
export function soNgay(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / MS_NGAY;
}

function isoTuNgay(n: number): string {
  return new Date(n * MS_NGAY).toISOString().slice(0, 10);
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

function kiemTra(input: DcaInput): void {
  const { soTienMoiKy, tuNgay, denNgay, ngayTrongThang, phiMuaPct, laiGuiPct } = input;
  if (!Number.isFinite(soTienMoiKy) || soTienMoiKy <= 0) throw new Error('Số tiền mỗi kỳ phải lớn hơn 0.');
  if (!ISO_RE.test(tuNgay) || !ISO_RE.test(denNgay)) throw new Error('Ngày phải có dạng YYYY-MM-DD.');
  if (tuNgay > denNgay) throw new Error('“Từ ngày” phải trước “Đến ngày”.');
  if (!Number.isInteger(ngayTrongThang) || ngayTrongThang < 1 || ngayTrongThang > 28) {
    throw new Error('Ngày mua trong tháng phải từ 1 đến 28.');
  }
  if (!Number.isFinite(phiMuaPct) || phiMuaPct < 0 || phiMuaPct >= 100) throw new Error('Phí mua phải từ 0 đến dưới 100%.');
  if (!Number.isFinite(laiGuiPct) || laiGuiPct < 0 || laiGuiPct > 100) throw new Error('Lãi gửi tiết kiệm phải từ 0 đến 100%.');
}

/** Danh sách ngày mua dự kiến: ngày `ngay` của mỗi tháng nằm trong [tu, den]. */
export function lichMua(tu: string, den: string, ngay: number): string[] {
  const [y0, m0] = tu.split('-').map(Number);
  const out: string[] = [];
  for (let y = y0, m = m0; ; m === 12 ? (y++, m = 1) : m++) {
    const iso = `${y}-${String(m).padStart(2, '0')}-${String(ngay).padStart(2, '0')}`;
    if (iso > den) break;
    if (iso >= tu) out.push(iso);
  }
  return out;
}

/**
 * XIRR: lãi suất năm r sao cho tổng giá trị hiện tại của dòng tiền = 0.
 * Giải bằng chia đôi trên (-99%, +1000%) — chậm hơn Newton nhưng không bao
 * giờ phân kỳ. Không có nghiệm trong khoảng ⇒ null (UI hiện "—", không bịa số).
 */
export function xirr(flows: { day: number; amount: number }[]): number | null {
  if (flows.length < 2) return null;
  const d0 = flows[0].day;
  const npv = (r: number) =>
    flows.reduce((s, f) => s + f.amount / Math.pow(1 + r, (f.day - d0) / 365), 0);
  let lo = -0.99;
  let hi = 10;
  let fLo = npv(lo);
  const fHi = npv(hi);
  if (!Number.isFinite(fLo) || !Number.isFinite(fHi) || fLo * fHi > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid);
    if (Math.abs(fMid) < 1e-6 || hi - lo < 1e-10) return mid;
    if (fLo * fMid < 0) {
      hi = mid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }
  return (lo + hi) / 2;
}

export function chayDca(input: DcaInput): DcaResult {
  kiemTra(input);
  const { soTienMoiKy, tuNgay, denNgay, ngayTrongThang, phiMuaPct, laiGuiPct } = input;

  const prices = input.prices.filter(
    (p) => ISO_RE.test(p.date) && Number.isFinite(p.close) && p.close > 0 && p.date <= denNgay,
  );
  if (prices.length === 0) throw new Error('Không có dữ liệu giá trong khoảng đã chọn.');
  const ngayDauDuLieu = prices[0].date;

  // Mã lên sàn sau "Từ ngày": KHÔNG dồn các kỳ trước đó vào phiên đầu tiên (sẽ
  // thành mua một cục, sai bản chất DCA) — bắt đầu từ THÁNG có dữ liệu. Lấy
  // ngày 1 của tháng đó chứ không lấy đúng ngày đầu dữ liệu: phiên đầu tiên có
  // thể chỉ là ngày làm việc sau kỳ nghỉ, kỳ của tháng đó vẫn phải được mua.
  const dauThangDuLieu = `${ngayDauDuLieu.slice(0, 7)}-01`;
  const batDau = tuNgay > dauThangDuLieu ? tuNgay : dauThangDuLieu;

  // Mỗi ngày dự kiến khớp vào phiên giao dịch ĐẦU TIÊN từ ngày đó trở đi
  // (ngày nghỉ, cuối tuần). Hai kỳ rơi vào cùng phiên (dữ liệu thủng) thì mua
  // hai lần ở phiên đó — vẫn giữ đúng tổng tiền đã bỏ.
  const tyLePhi = phiMuaPct / 100;
  const buys: DcaBuy[] = [];
  let j = 0;
  for (const ngay of lichMua(batDau, denNgay, ngayTrongThang)) {
    while (j < prices.length && prices[j].date < ngay) j++;
    if (j >= prices.length) break;
    const p = prices[j];
    buys.push({ date: p.date, price: p.close, soTien: soTienMoiKy, donVi: (soTienMoiKy * (1 - tyLePhi)) / p.close });
  }
  if (buys.length === 0) {
    throw new Error(`Chưa có kỳ mua nào: dữ liệu giá chỉ có từ ${ngayDauDuLieu}.`);
  }

  // Đi qua từng phiên từ lần mua đầu, tích luỹ vốn / đơn vị / tiền gửi.
  const laiNgay = Math.log(1 + laiGuiPct / 100) / 365;
  const series: DcaPoint[] = [];
  let von = 0;
  let donVi = 0;
  let gui = 0;
  let k = 0;
  let ngayTruoc = soNgay(buys[0].date);
  const iDau = prices.findIndex((p) => p.date === buys[0].date);
  for (let i = iDau; i < prices.length; i++) {
    const p = prices[i];
    const n = soNgay(p.date);
    gui *= Math.exp(laiNgay * (n - ngayTruoc));
    ngayTruoc = n;
    while (k < buys.length && buys[k].date === p.date) {
      von += buys[k].soTien;
      donVi += buys[k].donVi;
      gui += buys[k].soTien;
      k++;
    }
    series.push({ date: p.date, von, giaTri: donVi * p.close, guiTietKiem: gui });
  }

  const cuoi = series[series.length - 1];
  const giaCuoi = prices[prices.length - 1].close;

  let laiCaoNhat = { pct: -Infinity, date: cuoi.date };
  let loSauNhat = { pct: Infinity, date: cuoi.date };
  for (const s of series) {
    const pct = (s.giaTri / s.von - 1) * 100;
    if (pct > laiCaoNhat.pct) laiCaoNhat = { pct, date: s.date };
    if (pct < loSauNhat.pct) loSauNhat = { pct, date: s.date };
  }
  // "Lỗ sâu nhất" mà chưa từng lỗ thì là 0, không phải một con số dương.
  if (loSauNhat.pct > 0) loSauNhat = { pct: 0, date: loSauNhat.date };

  const flows = [
    ...buys.map((b) => ({ day: soNgay(b.date), amount: -b.soTien })),
    { day: soNgay(cuoi.date), amount: cuoi.giaTri },
  ];
  const r = xirr(flows);

  return {
    buys,
    series,
    ngayDauDuLieu,
    ngayDinhGia: cuoi.date,
    giaCuoi,
    tongVon: cuoi.von,
    giaTriCuoi: cuoi.giaTri,
    laiLo: cuoi.giaTri - cuoi.von,
    laiLoPct: (cuoi.giaTri / cuoi.von - 1) * 100,
    xirrPct: r === null ? null : r * 100,
    tongDonVi: donVi,
    giaVonTb: cuoi.von / donVi,
    tongPhi: cuoi.von * tyLePhi,
    giaTriGuiTietKiem: cuoi.guiTietKiem,
    laiCaoNhat,
    loSauNhat,
  };
}

/** Ngày lùi `soNam` năm từ `iso` (dùng cho nút 1/3/5/10 năm). */
export function luiNam(iso: string, soNam: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  // 29/2 lùi về năm không nhuận → 28/2 (Date.UTC sẽ tự đẩy sang 1/3).
  const ngay = m === 2 && d === 29 ? 28 : d;
  return isoTuNgay(Date.UTC(y - soNam, m - 1, ngay) / MS_NGAY);
}
