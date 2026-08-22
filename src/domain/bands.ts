// §7 — phân loại trạng thái band. Hàm thuần.
//
// GIẢI MÂU THUẪN CỦA §7: spec nói cả "do nothing while inside the band" và
// "strong rebalance khi lệch ≥ 5đ%". Hai câu đá nhau vì Cash có band 7–20%
// quanh target 15% ⇒ lệch −8đ% mà vẫn trong band.
//
// Cách giải (spec mục 4.3): BAND LÀ CỔNG, điểm % chỉ NÂNG MỨC ĐỘ.
// Lệnh bán chỉ mở khi ra ngoài band VÀ lệch ≥ strongRebalancePp.
// Nhờ đó tái lập đúng kết luận của §21: Crypto +4,8đ% → cảnh báo, KHÔNG bán.
//
// GHI NHẬN: với bộ band mặc định của §2, khoảng cách từ target tới rìa band
// đúng bằng 5đ% ở Stocks và Crypto ⇒ hầu như mọi lần ra ngoài band đều đã
// lệch ≥ 5đ%, nên OUT_OF_BAND là trạng thái ít khi đạt tới. Nó vẫn cần thiết
// cho band do người dùng tự nới rộng trong Settings.

import { ASSET_CLASSES } from './types';
import type { AssetClass, BandStatus, EngineConfig, TargetBand, Weight } from './types';

export function classifyBand(
  weight: Weight,
  band: TargetBand,
  config: EngineConfig,
): BandStatus {
  // Biên bao gồm hai đầu: đúng 25,0% với band 15–25 vẫn là TRONG band.
  const inBand = weight.weightPct >= band.minPct && weight.weightPct <= band.maxPct;
  const deviation = Math.abs(weight.deviationPp);

  if (inBand) {
    return deviation >= config.watchDeviationPp ? 'WATCH' : 'OK';
  }
  return deviation >= config.strongRebalancePp ? 'REBALANCE_REQUIRED' : 'OUT_OF_BAND';
}

export function classifyAll(
  weights: Weight[],
  targets: Record<AssetClass, TargetBand>,
  config: EngineConfig,
): Record<AssetClass, BandStatus> {
  const out = {} as Record<AssetClass, BandStatus>;
  for (const c of ASSET_CLASSES) {
    const w = weights.find((x) => x.assetClass === c);
    if (!w) {
      throw new Error(`Thiếu tỷ trọng của nhóm tài sản ${c} — không thể phân loại band.`);
    }
    out[c] = classifyBand(w, targets[c], config);
  }
  return out;
}
