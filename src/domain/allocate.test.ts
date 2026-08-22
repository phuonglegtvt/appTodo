import { describe, it, expect } from 'vitest';
import { allocate, allocateNewCapital, allocateIncome } from './allocate';
import { DEFAULT_CONFIG } from './types';
import type { AssetClass, TargetBand } from './types';

const TARGETS: Record<AssetClass, TargetBand> = {
  STOCKS: { targetPct: 50, minPct: 40, maxPct: 55 },
  CRYPTO: { targetPct: 20, minPct: 15, maxPct: 25 },
  GOLD:   { targetPct: 15, minPct: 10, maxPct: 20 },
  CASH:   { targetPct: 15, minPct: 7,  maxPct: 20 },
};

const EXAMPLE_21: Record<AssetClass, number> = {
  STOCKS: 513_300_000,
  CRYPTO: 269_700_000,
  GOLD:   179_437_500,
  CASH:   125_062_500,
};

/** Đổi kết quả thành map để assert gọn. Class không được phân bổ thì vắng mặt. */
function toMap(r: { allocations: { assetClass: AssetClass; amountVnd: number }[] }) {
  return Object.fromEntries(r.allocations.map((a) => [a.assetClass, a.amountVnd]));
}

describe('allocate — ví dụ §21, công thức PROPORTIONAL_GAP', () => {
  // total 1.087.500.000 · Z 3.000.000 · newTotal 1.090.500.000
  // gap: Stocks +31.950.000 · Crypto −51.600.000 · Gold −15.862.500 · Cash +35.512.500
  // Σ gap(+) = 67.462.500
  // Stocks = 3tr × 31.950.000/67.462.500 = 1.420.789 → làm tròn 1.400.000
  // Cash   = 3tr × 35.512.500/67.462.500 = 1.579.211 → 1.500.000 + dư 100.000 = 1.600.000
  const r = allocateNewCapital(EXAMPLE_21, TARGETS, 3_000_000, DEFAULT_CONFIG);

  it('chỉ phân bổ cho Stocks và Cash', () => {
    expect(Object.keys(toMap(r)).sort()).toEqual(['CASH', 'STOCKS']);
  });

  it('Stocks 1.400.000 — KHÁC §21 (2.000.000), xem spec mục 4.5', () => {
    expect(toMap(r).STOCKS).toBe(1_400_000);
  });

  it('Cash 1.600.000 — KHÁC §21 (1.000.000), xem spec mục 4.5', () => {
    expect(toMap(r).CASH).toBe(1_600_000);
  });

  it('KHÔNG phân bổ cho Crypto và Gold (khoảng thiếu âm) — khớp §21', () => {
    expect(toMap(r).CRYPTO).toBeUndefined();
    expect(toMap(r).GOLD).toBeUndefined();
  });

  it('BẤT BIẾN: tổng phân bổ + chưa phân bổ === pool', () => {
    const total = r.allocations.reduce((s, a) => s + a.amountVnd, 0);
    expect(total + r.unallocatedVnd).toBe(3_000_000);
  });

  it('mọi khoản phân bổ là bội số của 100.000', () => {
    for (const a of r.allocations) expect(a.amountVnd % 100_000).toBe(0);
  });
});

describe('allocate — ví dụ §4 (tiền mới hàng tháng)', () => {
  // Spec §4: hiện tại Stocks 47% Crypto 17% Gold 20% Cash 16%, Z = 3tr.
  // §4 kỳ vọng 1,5tr/1,5tr — nhưng đó là tính trên TỔNG CŨ.
  // §17 bắt dùng newTotal ⇒ gap Stocks 31,5tr, Crypto 30,6tr (không bằng nhau).
  const values: Record<AssetClass, number> = {
    STOCKS: 470_000_000, CRYPTO: 170_000_000, GOLD: 200_000_000, CASH: 160_000_000,
  };
  const r = allocateNewCapital(values, TARGETS, 3_000_000, DEFAULT_CONFIG);

  it('chỉ Stocks và Crypto được nhận (Gold, Cash đang thừa)', () => {
    expect(Object.keys(toMap(r)).sort()).toEqual(['CRYPTO', 'STOCKS']);
  });

  it('ra 1.600.000 / 1.400.000 — KHÁC §4 (1,5tr/1,5tr), xem spec mục 4.5', () => {
    expect(toMap(r).STOCKS).toBe(1_600_000);
    expect(toMap(r).CRYPTO).toBe(1_400_000);
  });

  it('BẤT BIẾN tổng', () => {
    const total = r.allocations.reduce((s, a) => s + a.amountVnd, 0);
    expect(total + r.unallocatedVnd).toBe(3_000_000);
  });
});

describe('allocateIncome — ví dụ §5 (cổ tức đã nằm trong Cash)', () => {
  // Spec §5: Stocks 47 Crypto 17 Gold 21 Cash 15, cổ tức 5tr ĐÃ nằm trong Cash.
  // addsToTotal = false ⇒ tổng KHÔNG tăng, gap tính trên tổng hiện tại.
  // gap Stocks +30tr, Crypto +30tr (bằng nhau) ⇒ chia đều 2,5tr/2,5tr.
  const values: Record<AssetClass, number> = {
    STOCKS: 470_000_000, CRYPTO: 170_000_000, GOLD: 210_000_000, CASH: 150_000_000,
  };
  const r = allocateIncome(values, TARGETS, 5_000_000, DEFAULT_CONFIG);

  it('chia đều 2.500.000 / 2.500.000 — KHÁC §5 (3tr/2tr), xem spec mục 4.5', () => {
    expect(toMap(r)).toEqual({ STOCKS: 2_500_000, CRYPTO: 2_500_000 });
  });

  it('Cash có gap = 0 nên KHÔNG được nhận (chỉ nhận khi gap > 0)', () => {
    expect(toMap(r).CASH).toBeUndefined();
  });

  it('BẤT BIẾN tổng', () => {
    const total = r.allocations.reduce((s, a) => s + a.amountVnd, 0);
    expect(total + r.unallocatedVnd).toBe(5_000_000);
  });
});

describe('allocate — biên: tiền không được biến mất', () => {
  it('pool = 0 → không phân bổ gì, không dư', () => {
    const r = allocateNewCapital(EXAMPLE_21, TARGETS, 0, DEFAULT_CONFIG);
    expect(r.allocations).toEqual([]);
    expect(r.unallocatedVnd).toBe(0);
  });

  it('pool âm → coi như 0 (không sinh lệnh mua âm)', () => {
    const r = allocateNewCapital(EXAMPLE_21, TARGETS, -1_000_000, DEFAULT_CONFIG);
    expect(r.allocations).toEqual([]);
    expect(r.unallocatedVnd).toBe(0);
  });

  it('không có ứng viên nào → TOÀN BỘ pool vào unallocatedVnd, không biến mất', () => {
    // Mọi tài sản đều thừa, chỉ Cash thiếu — nhưng Cash bị loại bằng cấu hình.
    const values: Record<AssetClass, number> = {
      STOCKS: 550_000_000, CRYPTO: 220_000_000, GOLD: 165_000_000, CASH: 65_000_000,
    };
    const cfg = { ...DEFAULT_CONFIG, cashEligibleForNewCapital: false };
    const r = allocateNewCapital(values, TARGETS, 3_000_000, cfg);
    expect(r.allocations).toEqual([]);
    expect(r.unallocatedVnd).toBe(3_000_000);
  });

  it('danh mục rỗng: chia theo đúng target, không ra NaN', () => {
    const empty: Record<AssetClass, number> = { STOCKS: 0, CRYPTO: 0, GOLD: 0, CASH: 0 };
    const r = allocateNewCapital(empty, TARGETS, 10_000_000, DEFAULT_CONFIG);
    for (const a of r.allocations) expect(Number.isNaN(a.amountVnd)).toBe(false);
    const total = r.allocations.reduce((s, a) => s + a.amountVnd, 0);
    expect(total + r.unallocatedVnd).toBe(10_000_000);
  });

  it('pool không phải bội số của bước làm tròn: BẤT BIẾN vẫn đúng tuyệt đối', () => {
    const r = allocateNewCapital(EXAMPLE_21, TARGETS, 3_000_001, DEFAULT_CONFIG);
    const total = r.allocations.reduce((s, a) => s + a.amountVnd, 0);
    expect(total + r.unallocatedVnd).toBe(3_000_001);
  });
});

describe('allocate — cấu hình', () => {
  it('cashEligibleForNewCapital = false → Stocks nhận trọn 3tr (ví dụ §21)', () => {
    const cfg = { ...DEFAULT_CONFIG, cashEligibleForNewCapital: false };
    const r = allocateNewCapital(EXAMPLE_21, TARGETS, 3_000_000, cfg);
    expect(toMap(r)).toEqual({ STOCKS: 3_000_000 });
  });

  it('PRIORITY_WATERFALL → đổ đầy Stocks trước (ưu tiên cao nhất)', () => {
    const cfg = { ...DEFAULT_CONFIG, formula: 'PRIORITY_WATERFALL' as const };
    const r = allocateNewCapital(EXAMPLE_21, TARGETS, 3_000_000, cfg);
    expect(toMap(r)).toEqual({ STOCKS: 3_000_000 });
  });

  it('PRIORITY_WATERFALL: pool lớn hơn gap của class đầu → tràn sang class sau', () => {
    // Bộ số riêng cho ca này, KHÁC ví dụ §21: với danh mục §21, gap của Stocks
    // trên newTotal luôn lớn hơn mọi pool đủ nhỏ để Cash còn là ứng viên (gap
    // Stocks tăng 0,5đ/1đ pool, còn gap Cash giảm 0,85đ/1đ pool vì Z được cộng
    // thẳng vào Cash trước khi chia) — nên KHÔNG có pool nào tràn sang Cash được.
    // Bộ số dưới đây: Crypto và Gold đã ở đúng/thừa target (gap ≤ 0, bị loại),
    // chỉ còn Stocks (gap 8.000.000) và Cash (gap 8.500.000) là ứng viên.
    const values: Record<AssetClass, number> = {
      STOCKS: 497_000_000, CRYPTO: 210_000_000, GOLD: 160_000_000, CASH: 133_000_000,
    };
    const cfg = { ...DEFAULT_CONFIG, formula: 'PRIORITY_WATERFALL' as const };
    const r = allocateNewCapital(values, TARGETS, 10_000_000, cfg);
    // Stocks lấy đúng gap của nó (8.000.000), phần dư (2.000.000) tràn sang Cash.
    expect(toMap(r)).toEqual({ STOCKS: 8_000_000, CASH: 2_000_000 });
    const total = r.allocations.reduce((s, a) => s + a.amountVnd, 0);
    expect(total + r.unallocatedVnd).toBe(10_000_000);
  });

  it('bước làm tròn 1.000.000 → mọi khoản là bội số của 1tr', () => {
    const cfg = { ...DEFAULT_CONFIG, roundingStepVnd: 1_000_000 };
    const r = allocateNewCapital(EXAMPLE_21, TARGETS, 3_000_000, cfg);
    for (const a of r.allocations) expect(a.amountVnd % 1_000_000).toBe(0);
    const total = r.allocations.reduce((s, a) => s + a.amountVnd, 0);
    expect(total + r.unallocatedVnd).toBe(3_000_000);
  });
});

describe('allocate — dùng trực tiếp', () => {
  it('addsToTotal quyết định tổng có tăng hay không', () => {
    const args = { classValues: EXAMPLE_21, targets: TARGETS, poolVnd: 3_000_000,
                   config: DEFAULT_CONFIG };
    const newCapital = allocate({ ...args, addsToTotal: true });
    const income = allocate({ ...args, addsToTotal: false });
    // Cùng pool nhưng khác cách tính ⇒ kết quả khác nhau.
    expect(toMap(newCapital)).not.toEqual(toMap(income));
  });
});
