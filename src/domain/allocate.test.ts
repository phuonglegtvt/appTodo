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
  // Z nằm NGOÀI baseline ⇒ baseline Cash giữ nguyên 125.062.500.
  // gap = newTotal × targetPct − baseline:
  //   Stocks 545.250.000 − 513.300.000 = +31.950.000  ← ứng viên
  //   Crypto 218.100.000 − 269.700.000 = −51.600.000  ← loại
  //   Gold   163.575.000 − 179.437.500 = −15.862.500  ← loại
  //   Cash   163.575.000 − 125.062.500 = +38.512.500  ← ứng viên
  // Σ gap(+) = 31.950.000 + 38.512.500 = 70.462.500
  // Stocks = 3tr × 31.950.000/70.462.500 = 1.360.298,03 → làm tròn xuống 1.300.000
  // Cash   = 3tr × 38.512.500/70.462.500 = 1.639.701,97 → làm tròn xuống 1.600.000
  // dư = 3.000.000 − 2.900.000 = 100.000 → dồn vào gap lớn nhất (Cash)
  //   ⇒ Stocks 1.300.000 · Cash 1.700.000
  const r = allocateNewCapital(EXAMPLE_21, TARGETS, 3_000_000, DEFAULT_CONFIG);

  it('chỉ phân bổ cho Stocks và Cash', () => {
    expect(Object.keys(toMap(r)).sort()).toEqual(['CASH', 'STOCKS']);
  });

  it('Stocks 1.300.000 — KHÁC §21 (2.000.000), xem spec mục 4.5', () => {
    expect(toMap(r).STOCKS).toBe(1_300_000);
  });

  it('Cash 1.700.000 — KHÁC §21 (1.000.000), xem spec mục 4.5', () => {
    expect(toMap(r).CASH).toBe(1_700_000);
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
  // §17 bắt dùng newTotal = 1.003.000.000 ⇒ gap:
  //   Stocks 501.500.000 − 470.000.000 = +31.500.000  ← ứng viên
  //   Crypto 200.600.000 − 170.000.000 = +30.600.000  ← ứng viên
  //   Gold   150.450.000 − 200.000.000 = −49.550.000  ← loại
  //   Cash   150.450.000 − 160.000.000 =  −9.550.000  ← loại (thừa Cash)
  // Σ gap(+) = 62.100.000
  // Stocks = 3tr × 31.500.000/62.100.000 = 1.521.739,13 → 1.500.000
  // Crypto = 3tr × 30.600.000/62.100.000 = 1.478.260,87 → 1.400.000
  // dư 100.000 → gap lớn nhất là Stocks ⇒ Stocks 1.600.000 · Crypto 1.400.000.
  // Ca này KHÔNG đổi khi sửa baseline Cash: Cash vẫn thừa nên vẫn bị loại.
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
  // addsToTotal = false ⇒ newTotal = total = 1.000.000.000 (tổng KHÔNG tăng),
  // và cổ tức phải được TRỪ khỏi baseline Cash: 150.000.000 − 5.000.000
  // = 145.000.000 (pool luôn nằm ngoài baseline).
  // gap = 1.000.000.000 × targetPct − baseline:
  //   Stocks 500.000.000 − 470.000.000 = +30.000.000  ← ứng viên
  //   Crypto 200.000.000 − 170.000.000 = +30.000.000  ← ứng viên
  //   Gold   150.000.000 − 210.000.000 = −60.000.000  ← loại
  //   Cash   150.000.000 − 145.000.000 =  +5.000.000  ← ứng viên (MỚI)
  // Σ gap(+) = 65.000.000
  // Stocks = 5tr × 30.000.000/65.000.000 = 2.307.692,31 → 2.300.000
  // Crypto = 5tr × 30.000.000/65.000.000 = 2.307.692,31 → 2.300.000
  // Cash   = 5tr ×  5.000.000/65.000.000 =   384.615,38 →   300.000
  // dư = 5.000.000 − 4.900.000 = 100.000 → gap lớn nhất (Stocks, so sánh dùng
  // `>` nên Stocks giữ chỗ khi bằng Crypto) ⇒ Stocks 2.400.000.
  const values: Record<AssetClass, number> = {
    STOCKS: 470_000_000, CRYPTO: 170_000_000, GOLD: 210_000_000, CASH: 150_000_000,
  };
  const r = allocateIncome(values, TARGETS, 5_000_000, DEFAULT_CONFIG);

  it('chia 2.400.000 / 2.300.000 / 300.000 — KHÁC §5 (3tr/2tr), xem spec mục 4.5', () => {
    expect(toMap(r)).toEqual({ STOCKS: 2_400_000, CRYPTO: 2_300_000, CASH: 300_000 });
  });

  it('Cash CŨNG là ứng viên: cổ tức nằm ngoài baseline nên Cash thiếu đúng 5tr', () => {
    // Trước đây cổ tức được tính vào baseline Cash ⇒ gap Cash = 0 ⇒ Cash không
    // bao giờ được nhận, toàn bộ cổ tức bị giải ngân hết ra khỏi ví.
    expect(toMap(r).CASH).toBe(300_000);
  });

  it('cổ tức KHÔNG làm tăng tổng, và phần để lại nằm đúng trong Cash', () => {
    const m = toMap(r);
    const boughtVnd = (m.STOCKS ?? 0) + (m.CRYPTO ?? 0) + (m.GOLD ?? 0);
    const after = {
      STOCKS: values.STOCKS + (m.STOCKS ?? 0),
      CRYPTO: values.CRYPTO + (m.CRYPTO ?? 0),
      GOLD: values.GOLD + (m.GOLD ?? 0),
      // Cổ tức đã nằm trong Cash; chỉ phần chuyển sang class khác bị trừ ra.
      CASH: values.CASH - boughtVnd,
    };
    expect(after.STOCKS + after.CRYPTO + after.GOLD + after.CASH).toBe(1_000_000_000);
    // baseline 145.000.000 + phần Cash được giữ 300.000
    expect(after.CASH).toBe(145_300_000);
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

  it('pool âm → NÉM LỖI, không được lặng lẽ coi như 0', () => {
    // Coi như 0 sẽ phá bất biến tổng (0 + 0 ≠ −1.000.000) và làm một
    // monthly_contribution_vnd âm trong DB biến mất im lặng.
    expect(() => allocateNewCapital(EXAMPLE_21, TARGETS, -1_000_000, DEFAULT_CONFIG))
      .toThrow(/không được âm/);
  });

  it('cổ tức lớn hơn số dư Cash → NÉM LỖI (đầu vào tự mâu thuẫn)', () => {
    // addsToTotal = false nghĩa là cổ tức ĐÃ nằm trong Cash, nên nó không thể
    // lớn hơn toàn bộ Cash đang có — baseline Cash sẽ âm ⇒ dữ liệu sai.
    const values: Record<AssetClass, number> = {
      STOCKS: 470_000_000, CRYPTO: 170_000_000, GOLD: 210_000_000, CASH: 1_000_000,
    };
    expect(() => allocateIncome(values, TARGETS, 5_000_000, DEFAULT_CONFIG))
      .toThrow(/lớn hơn số dư Cash/);
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

  it('danh mục rỗng: chia theo đúng target 50/20/15/15, không ra NaN', () => {
    // total 0 ⇒ newTotal = pool = 10.000.000, baseline mọi class = 0
    // ⇒ gap_c = 10.000.000 × targetPct_c, Σ gap = 10.000.000
    // ⇒ phân bổ_c = pool × gap_c / Σ gap = gap_c, tức ĐÚNG target.
    const empty: Record<AssetClass, number> = { STOCKS: 0, CRYPTO: 0, GOLD: 0, CASH: 0 };
    const r = allocateNewCapital(empty, TARGETS, 10_000_000, DEFAULT_CONFIG);
    for (const a of r.allocations) expect(Number.isNaN(a.amountVnd)).toBe(false);
    expect(toMap(r)).toEqual({
      STOCKS: 5_000_000, CRYPTO: 2_000_000, GOLD: 1_500_000, CASH: 1_500_000,
    });
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
    // Bộ số riêng cho ca này, KHÁC ví dụ §21: với danh mục §21 phải cần pool
    // > 60.900.000 mới tràn được sang Cash (gap Stocks = 30.450.000 + 0,5×Z),
    // to hơn nhiều so với quy mô tiền vào hàng tháng nên không đại diện.
    // Bộ số dưới đây, newTotal = 1.010.000.000, Z nằm ngoài baseline:
    //   Stocks 505.000.000 − 497.000.000 =  +8.000.000  ← ứng viên, ưu tiên 4
    //   Crypto 202.000.000 − 210.000.000 =  −8.000.000  ← loại
    //   Gold   151.500.000 − 160.000.000 =  −8.500.000  ← loại
    //   Cash   151.500.000 − 133.000.000 = +18.500.000  ← ứng viên, ưu tiên 1
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

  it('PRIORITY_WATERFALL: pool LỚN HƠN tổng gap của mọi ứng viên → phần dư dồn vào class ưu tiên cao nhất, VƯỢT gap của nó', () => {
    // Nhánh này chỉ chạy được khi một ứng viên có gap dương bị loại bằng cấu
    // hình: với addsToTotal = true, Σ gap của MỌI class luôn đúng bằng pool
    // (Σ target = 100%), nên nếu không loại ai thì Σ gap(ứng viên) ≥ pool và
    // phần dư luôn bằng 0.
    // Ở đây Cash thiếu 27.000.000 nhưng bị loại ⇒ chỉ còn Stocks (gap
    // 2.000.000) và Crypto (gap 1.000.000), tổng 3.000.000 < pool 10.000.000.
    const values: Record<AssetClass, number> = {
      STOCKS: 503_000_000, CRYPTO: 201_000_000, GOLD: 171_500_000, CASH: 124_500_000,
    };
    const cfg = {
      ...DEFAULT_CONFIG,
      formula: 'PRIORITY_WATERFALL' as const,
      cashEligibleForNewCapital: false,
    };
    const r = allocateNewCapital(values, TARGETS, 10_000_000, cfg);
    // Stocks lấy hết gap 2.000.000, Crypto lấy hết gap 1.000.000, phần dư
    // 7.000.000 dồn vào Stocks (ưu tiên 4, cao nhất) ⇒ Stocks 9.000.000.
    expect(toMap(r)).toEqual({ STOCKS: 9_000_000, CRYPTO: 1_000_000 });
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
