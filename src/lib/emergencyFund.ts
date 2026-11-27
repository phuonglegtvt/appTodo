// Quỹ dự phòng khẩn cấp: tiền mặt đủ sống mấy tháng (hàm thuần, có test).
// ĐƠN VỊ: đồng. Tháng 'YYYY-MM'. Hôm nay truyền vào qua tham số.

import type { CashEntry } from '../types/cashEntry';
import { locTheoThang, thangCua, thangTruoc, tongHop } from './cashFlow';

export interface ChiTrungBinh {
  /** Chi THẬT trung bình mỗi tháng (không gồm vòng tiền, chuyển đầu tư). null = chưa đủ dữ liệu. */
  trungBinh: number | null;
  /** Các tháng đã dùng để tính (có ghi khoản chi). */
  thangDung: string[];
}

/**
 * Trung bình chi của tối đa `soThang` tháng TRỌN gần nhất TRƯỚC tháng hiện tại,
 * chỉ lấy tháng CÓ ghi khoản chi — tháng chưa ghi gì mà tính là 0đ sẽ kéo trung
 * bình xuống, làm quỹ dự phòng trông đủ hơn thực tế.
 */
export function chiTrungBinh(entries: CashEntry[], homNay: string, soThang = 3, timLui = 12): ChiTrungBinh {
  const thangDung: string[] = [];
  let tong = 0;
  let t = thangTruoc(thangCua(homNay));
  for (let i = 0; i < timLui && thangDung.length < soThang; i++, t = thangTruoc(t)) {
    const cua = locTheoThang(entries, t).filter((e) => e.kind === 'CHI');
    if (cua.length === 0) continue;
    const chi = tongHop(cua).chi;
    if (chi <= 0) continue;
    thangDung.push(t);
    tong += chi;
  }
  return { trungBinh: thangDung.length === 0 ? null : tong / thangDung.length, thangDung };
}

export interface QuyDuPhong {
  soThangDuSong: number | null;
  /** Còn thiếu bao nhiêu để đủ `mucTieuThang` tháng (0 nếu đã đủ). */
  conThieu: number | null;
  muc: 'THIEU' | 'TAM_DUOC' | 'DU' | 'CHUA_BIET';
}

/** < 3 tháng: thiếu · 3–6: tạm được · ≥ mục tiêu: đủ. */
export function danhGiaQuyDuPhong(tienMat: number, chiThang: number | null, mucTieuThang = 6): QuyDuPhong {
  if (chiThang === null || !(chiThang > 0)) return { soThangDuSong: null, conThieu: null, muc: 'CHUA_BIET' };
  const soThangDuSong = tienMat / chiThang;
  return {
    soThangDuSong,
    conThieu: Math.max(0, mucTieuThang * chiThang - tienMat),
    muc: soThangDuSong >= mucTieuThang ? 'DU' : soThangDuSong >= 3 ? 'TAM_DUOC' : 'THIEU',
  };
}
