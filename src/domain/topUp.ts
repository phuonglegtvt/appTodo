// "Cần bổ sung bao nhiêu vốn để đạt tỷ trọng mục tiêu" (§18 mục tiêu 2, phía nạp thêm).
//
// Khác allocate.ts ở chiều của câu hỏi:
//   · allocate: có Z đồng rồi — chia thế nào?
//   · topUp:    muốn về đúng target mà KHÔNG bán gì — cần bao nhiêu đồng?
//
// Suy ra công thức: cần v_c + a_c = t_c × (T + M) với mọi nhóm, a_c ≥ 0.
//   a_c ≥ 0  ⟺  t_c × (T + M) ≥ v_c  ⟺  T + M ≥ v_c / t_c
//   ⇒ tổng đích nhỏ nhất = max_c (v_c / t_c)  ⇒ M = max(0, đó − T)
//   ⇒ a_c = t_c × (T + M) − v_c
// Nhóm có v_c/t_c lớn nhất là nhóm đang vượt xa nhất — nó ấn định tổng, và tự nó
// nhận thêm 0 đồng.
//
// KHÔNG làm tròn ở đây: bất biến Σa_c = M chỉ đúng khi giữ số thực. Làm tròn là
// việc của tầng hiển thị, không phải của phép tính.

import { ASSET_CLASSES } from './types';
import type { AssetClass, TargetBand } from './types';

export type TopUpStatus = 'OK' | 'IMPOSSIBLE_WITHOUT_SELLING' | 'EMPTY_PORTFOLIO';

export interface TopUpPlan {
  status: TopUpStatus;
  /** Tổng tiền mới cần nạp. 0 khi đã đúng target, khi rỗng, hoặc khi bị chặn. */
  totalNeededVnd: number;
  /** Chia tổng đó ra từng nhóm. Nhóm ấn định tổng nhận 0. */
  perClass: Record<AssetClass, number>;
  /**
   * Nhóm có target 0% mà đang giữ tiền: nạp thêm bao nhiêu cũng không kéo tỷ
   * trọng của nó về 0. Chỉ bán mới được. Khác rỗng ⇒ status IMPOSSIBLE.
   */
  blockingClasses: AssetClass[];
}

const zeroPerClass = (): Record<AssetClass, number> =>
  ({ STOCKS: 0, CRYPTO: 0, GOLD: 0, CASH: 0 });

/**
 * Chặn dữ liệu bất thường NGAY ĐẦU HÀM thay vì để nó chảy xuống thành `NaN`
 * trong một con số tiền hiện lên màn hình. `NaN < 0` là false nên phép so sánh
 * âm KHÔNG bắt được NaN — phải kiểm Number.isFinite riêng.
 */
function assertInputSane(
  classValues: Record<AssetClass, number>,
  targets: Record<AssetClass, TargetBand>,
): void {
  for (const c of ASSET_CLASSES) {
    const v = classValues[c];
    if (!Number.isFinite(v)) {
      throw new Error(`Giá trị nhóm ${c} không phải số hợp lệ: ${v}.`);
    }
    if (v < 0) {
      throw new Error(`Giá trị nhóm ${c} đang âm: ${v} đ. Giá trị nắm giữ không thể âm.`);
    }
    const t = targets[c].targetPct;
    if (!Number.isFinite(t)) {
      throw new Error(`Tỷ trọng mục tiêu của nhóm ${c} không phải số hợp lệ: ${t}.`);
    }
    if (t < 0) {
      throw new Error(`Tỷ trọng mục tiêu của nhóm ${c} đang âm: ${t}%.`);
    }
  }

  const sum = ASSET_CLASSES.reduce((s, c) => s + targets[c].targetPct, 0);
  if (Math.abs(sum - 100) > 0.01) {
    throw new Error(
      `Tổng tỷ trọng mục tiêu là ${sum}%, phải bằng 100%. Sửa lại cấu hình phân bổ.`,
    );
  }
}

export function planTopUp(
  classValues: Record<AssetClass, number>,
  targets: Record<AssetClass, TargetBand>,
): TopUpPlan {
  assertInputSane(classValues, targets);

  const totalVnd = ASSET_CLASSES.reduce((s, c) => s + classValues[c], 0);

  // Chưa đầu tư gì thì không có tỷ trọng thực tế nào để đuổi theo — mọi con số
  // "cần bổ sung" đều là bịa. Nói thẳng trạng thái, để UI hướng dẫn nhập liệu.
  if (totalVnd === 0) {
    return {
      status: 'EMPTY_PORTFOLIO',
      totalNeededVnd: 0,
      perClass: zeroPerClass(),
      blockingClasses: [],
    };
  }

  const blockingClasses = ASSET_CLASSES.filter(
    (c) => targets[c].targetPct === 0 && classValues[c] > 0,
  );
  if (blockingClasses.length > 0) {
    // Trả 0 chứ KHÔNG trả một con số gần đúng: không tồn tại số tiền nạp thêm
    // nào đưa nhóm này về 0%. Một con số ở đây sẽ là lời nói dối có định dạng
    // đẹp — đúng loại lỗi khó phát hiện nhất.
    return {
      status: 'IMPOSSIBLE_WITHOUT_SELLING',
      totalNeededVnd: 0,
      perClass: zeroPerClass(),
      blockingClasses,
    };
  }

  // Tổng đích nhỏ nhất thoả mãn MỌI nhóm. Nhóm target 0% (và giá trị 0, vì ca
  // còn lại đã bị chặn ở trên) không ràng buộc gì nên bỏ khỏi phép max.
  const targetTotalVnd = Math.max(
    ...ASSET_CLASSES
      .filter((c) => targets[c].targetPct > 0)
      .map((c) => classValues[c] / (targets[c].targetPct / 100)),
  );

  const totalNeededVnd = Math.max(0, targetTotalVnd - totalVnd);
  const newTotalVnd = totalVnd + totalNeededVnd;

  const perClass = zeroPerClass();
  for (const c of ASSET_CLASSES) {
    // Math.max(0, …) chỉ để dọn nhiễu dấu phẩy động (cỡ 1e-9), không phải để
    // che một giá trị âm thật — âm thật đã bị chặn bởi phép max ở trên.
    perClass[c] = Math.max(0, (targets[c].targetPct / 100) * newTotalVnd - classValues[c]);
  }

  return { status: 'OK', totalNeededVnd, perClass, blockingClasses: [] };
}
