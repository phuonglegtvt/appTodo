// §8 — Crash Reserve. Hàm thuần. CHỈ ĐƯA ĐỀ XUẤT, không bao giờ tự mua (§23).
//
// §8 bỏ trống hai điều mà thiếu là sai tiền (spec mục 4.8):
//
// (a) "dùng 10% Crash Reserve" — 10% của SỐ DƯ TẠI LÚC ĐỢT SỤT GIẢM BẮT ĐẦU,
//     đã chụp ảnh lại. Nếu tính theo số dư hiện tại thì mỗi bậc sau nhỏ dần
//     một cách vô lý (10%, rồi 15% của phần còn lại...).
//
// (b) MỘT ĐỢT = từ khi phá đỉnh cũ tới khi lập đỉnh mới. Trong cùng một đợt,
//     mỗi bậc chỉ kích hoạt MỘT LẦN. Lập đỉnh mới ⇒ đợt mới, 5 bậc reset.
//     Không có khái niệm này thì hoặc app lải nhải "dùng bậc 1" mỗi tháng,
//     hoặc lần khủng hoảng sau không kích hoạt được nữa.

import type { CrashEventRecord, CrashLevel, CrashRecommendation } from './types';

/** §8. Tổng 10+15+20+25+30 = 100% — bậc 5 dùng "phần còn lại". */
export const DEFAULT_CRASH_LEVELS: CrashLevel[] = [
  { level: 1, drawdownPct: 15, deployPctOfReserve: 10 },
  { level: 2, drawdownPct: 25, deployPctOfReserve: 15 },
  { level: 3, drawdownPct: 35, deployPctOfReserve: 20 },
  { level: 4, drawdownPct: 45, deployPctOfReserve: 25 },
  { level: 5, drawdownPct: 55, deployPctOfReserve: 30 },
];

export interface CrashReserveInput {
  portfolioDrawdownPct: number;
  /** Ngày lập đỉnh gần nhất — mốc bắt đầu đợt sụt giảm hiện tại. */
  currentEpisodeStart: string;
  /** Số dư túi VND-RESERVE hiện tại. */
  cashReserveVnd: number;
  levels: CrashLevel[];
  history: CrashEventRecord[];
}

export function evaluateCrashReserve(input: CrashReserveInput): CrashRecommendation {
  const { portfolioDrawdownPct, currentEpisodeStart, cashReserveVnd, levels, history } = input;

  const suKienDotNay = history.filter((h) => h.episodeStart === currentEpisodeStart);

  // (a) Mốc tính %: số dư lúc đợt bắt đầu. Đợt chưa có sự kiện nào thì chụp ảnh bây giờ.
  const reserveAtEpisodeStartVnd = suKienDotNay.length > 0
    ? suKienDotNay[0].reserveAtEpisodeStartVnd
    : cashReserveVnd;

  // (b) Bậc đã dùng TRONG ĐỢT NÀY. Đợt khác không tính.
  const daDung = new Set(suKienDotNay.map((h) => h.level));

  const theoThuTu = [...levels].sort((a, b) => a.drawdownPct - b.drawdownPct);

  const triggeredLevels: CrashRecommendation['triggeredLevels'] = [];
  let conLai = cashReserveVnd;

  for (const l of theoThuTu) {
    if (l.drawdownPct > portfolioDrawdownPct) continue;   // chưa tới ngưỡng
    if (daDung.has(l.level)) continue;                    // đã dùng trong đợt này

    const muon = reserveAtEpisodeStartVnd * (l.deployPctOfReserve / 100);
    // Không giải ngân quá số tiền đang thực có. Hết tiền vẫn BÁO bậc đã đạt
    // (deployVnd = 0) để người dùng biết, không nuốt im lặng.
    const cho = Math.max(0, Math.min(muon, conLai));
    conLai -= cho;

    triggeredLevels.push({ level: l.level, drawdownPct: l.drawdownPct, deployVnd: cho });
  }

  const bacKeTiep = theoThuTu.find((l) => l.drawdownPct > portfolioDrawdownPct);

  return {
    episodeStart: currentEpisodeStart,
    reserveAtEpisodeStartVnd,
    triggeredLevels,
    totalDeployVnd: triggeredLevels.reduce((s, t) => s + t.deployVnd, 0),
    nextLevel: bacKeTiep
      ? {
          level: bacKeTiep.level,
          drawdownPct: bacKeTiep.drawdownPct,
          gapPp: bacKeTiep.drawdownPct - portfolioDrawdownPct,
        }
      : null,
  };
}
