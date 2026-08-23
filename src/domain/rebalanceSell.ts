// §6 Mode B — chỉ dùng khi tỷ trọng lệch nghiêm trọng. Hàm thuần.
//
// KHOÁ AN TOÀN: chỉ sinh lệnh bán cho class vừa NGOÀI BAND vừa lệch ≥ 5đ%
// (trạng thái REBALANCE_REQUIRED) VÀ đang thừa. Đúng mục tiêu 1 của §18
// "MINIMIZE SELLING" — mọi trường hợp nhẹ hơn thì dùng tiền mới, không bán.
//
// MỨC BÁN (spec mục 4.7): mặc định bán về đúng TARGET, không phải về rìa band.
// Cắt sát rìa sẽ bật ra ngoài lại ngay và sinh chuỗi bán lắt nhắt — ít LẦN bán
// hơn thì tổng phí thấp hơn. Đổi được sang BAND_EDGE trong Settings.
//
// Tiền bán được chia bằng CHÍNH allocate.ts — không viết lại logic phân bổ.
//
// GỌI allocate NHƯ THẾ NÀO (xem addendum của Task 9): sau khi allocate.ts đổi
// semantics, pool LUÔN nằm NGOÀI baseline dùng để tính khoảng thiếu — cờ
// `addsToTotal` chỉ quyết định newTotal có tăng hay không, KHÔNG quyết định
// baseline. Tiền bán không làm tăng tổng danh mục (nó vẫn nằm trong danh mục,
// chỉ đổi chỗ từ class bị bán sang Cash), nên trước khi gọi allocate phải MÔ
// PHỎNG TRỌN VẸN lệnh bán: trừ sellVnd khỏi từng class bị bán, CỘNG đúng pool
// vào Cash (tiền bán về ví), rồi mới gọi allocate với addsToTotal = false trên
// bộ giá trị SAU-KHI-BÁN đó. Nhờ vậy addsToTotal: false đúng theo nghĩa đen
// (tiền đã thật sự nằm trong Cash), không bao giờ kích hoạt nhánh ném lỗi
// poolVnd > classValues.CASH (sau khi cộng pool vào Cash thì Cash luôn ≥
// pool), và class vừa bán tự nhiên có gap = 0 (đã bán về đúng target) nên bị
// loại khỏi ứng viên nhận lại tiền của chính nó.

import { allocate } from './allocate';
import { totalVnd } from './weights';
import { sumVnd } from './money';
import type {
  AssetClass, BandStatus, EngineConfig, SellOrder, SellPlan, TargetBand, Weight,
} from './types';

export interface SellRebalanceInput {
  weights: Weight[];
  statuses: Record<AssetClass, BandStatus>;
  classValues: Record<AssetClass, number>;
  targets: Record<AssetClass, TargetBand>;
  config: EngineConfig;
}

export function planSellRebalance(input: SellRebalanceInput): SellPlan {
  const { weights, statuses, classValues, targets, config } = input;
  const total = totalVnd(classValues);

  const sells: SellOrder[] = [];
  const skipped: { assetClass: AssetClass; wouldSellVnd: number }[] = [];

  for (const w of weights) {
    // Hai khoá: phải REBALANCE_REQUIRED, và phải đang THỪA.
    if (statuses[w.assetClass] !== 'REBALANCE_REQUIRED') continue;
    if (w.deviationPp <= 0) continue;

    const sellDownToVnd = config.sellTo === 'BAND_EDGE'
      ? total * (targets[w.assetClass].maxPct / 100)
      : w.targetValueVnd;

    const sellVnd = w.valueVnd - sellDownToVnd;
    if (sellVnd <= 0) continue;

    // §18: không bán vụn. Nhưng PHẢI báo, không nuốt im lặng.
    if (sellVnd < config.minSellAmountVnd) {
      skipped.push({ assetClass: w.assetClass, wouldSellVnd: sellVnd });
      continue;
    }
    sells.push({ assetClass: w.assetClass, sellVnd });
  }

  if (sells.length === 0) {
    return { sells: [], destinations: [], unallocatedVnd: 0, skipped };
  }

  // Mô phỏng trọn vẹn lệnh bán TRƯỚC khi gọi allocate (xem comment đầu file):
  // trừ tiền bán khỏi từng class bị bán, cộng đúng pool vào Cash.
  const pool = sumVnd(sells.map((s) => s.sellVnd));
  const postSellValues = { ...classValues };
  for (const s of sells) {
    postSellValues[s.assetClass] -= s.sellVnd;
  }
  postSellValues.CASH += pool;

  const { allocations, unallocatedVnd } = allocate({
    classValues: postSellValues, targets, poolVnd: pool, addsToTotal: false, config,
  });

  return { sells, destinations: allocations, unallocatedVnd, skipped };
}
