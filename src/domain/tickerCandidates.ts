// §11 — lọc mã ứng viên trong watchlist. Hàm thuần.
//
// LỌC HAI ĐIỀU KIỆN (spec mục 4.6):
//   1. giá hiện tại <= giá ngưỡng tích sản  (kỷ luật sẵn có của người dùng)
//   2. giá × lô chẵn <= ngân sách           (MUA NỔI KHÔNG)
//
// Thiếu điều kiện 2 thì đề xuất không thực hiện được: HOSE giao dịch lô chẵn
// 100 cổ phiếu, nên với ngân sách 1,4tr chỉ mua nổi mã dưới 14.000đ/cp —
// tức 4/56 mã trong watchlist hiện tại.
//
// App KHÔNG tự chọn mã (§23). Nó chỉ lọc ra ứng viên để người dùng quyết.

import type { Candidate, CandidateResult, ShortfallNote, WatchlistItem } from './types';

export function pickCandidates(
  watchlist: WatchlistItem[],
  budgetVnd: number,
  monthlyBudgetVnd: number,
): CandidateResult {
  const affordable: Candidate[] = [];
  const shortfalls: ShortfallNote[] = [];

  for (const item of watchlist) {
    const { currentPriceVnd: gia, thresholdVnd: nguong, lotSize } = item;

    // Thiếu dữ liệu hoặc dữ liệu xấu → bỏ qua, KHÔNG đoán bừa.
    if (gia === null || nguong === null) continue;
    if (lotSize <= 0 || nguong <= 0) continue;

    // Trên ngưỡng tích sản → không phải ứng viên, loại hẳn.
    if (gia > nguong) continue;

    const lotCostVnd = gia * lotSize;

    if (lotCostVnd <= budgetVnd) {
      affordable.push({
        symbol: item.symbol,
        name: item.name,
        group: item.group,
        priceVnd: gia,
        lotCostVnd,
        belowThresholdPct: ((nguong - gia) / nguong) * 100,
      });
    } else {
      const shortfallVnd = lotCostVnd - budgetVnd;
      shortfalls.push({
        symbol: item.symbol,
        lotCostVnd,
        shortfallVnd,
        // Không có tiền vào hàng tháng thì không suy ra được bao lâu — trả null.
        monthsToAfford: monthlyBudgetVnd > 0
          ? Math.ceil(shortfallVnd / monthlyBudgetVnd)
          : null,
      });
    }
  }

  // Mua được: rẻ so với ngưỡng nhiều nhất lên đầu.
  affordable.sort((a, b) => b.belowThresholdPct - a.belowThresholdPct);
  // Chưa đủ tiền: gần mua được nhất lên đầu (để biết nên dồn cho mã nào).
  shortfalls.sort((a, b) => a.shortfallVnd - b.shortfallVnd);

  return { affordable, shortfalls };
}
