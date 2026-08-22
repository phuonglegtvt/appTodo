import { describe, it, expect } from 'vitest';
import { mapToSnapshot } from './buildSnapshot';
import type { AllocationRow, SnapshotSourceData } from '../types/portfolio';

function row(over: Partial<AllocationRow>): AllocationRow {
  return {
    instrument_id: 'i1', asset_class: 'STOCKS', symbol: 'X', earmarked_for: null,
    quantity: null, cost_basis_vnd: null, cash_balance_vnd: null,
    price_vnd: null, price_as_of: null, market_value_vnd: null, ...over,
  };
}

function buildSourceData(over: Partial<SnapshotSourceData> = {}): SnapshotSourceData {
  return {
    asOf: '2026-09-01',
    allocation: [],
    targets: [
      { asset_class: 'STOCKS', target_pct: 50, min_pct: 40, max_pct: 55 },
      { asset_class: 'CRYPTO', target_pct: 20, min_pct: 15, max_pct: 25 },
      { asset_class: 'GOLD',   target_pct: 15, min_pct: 10, max_pct: 20 },
      { asset_class: 'CASH',   target_pct: 15, min_pct: 7,  max_pct: 20 },
    ],
    settings: {
      monthly_contribution_vnd: 3_000_000, watch_deviation_pp: 3,
      strong_rebalance_pp: 5, min_sell_amount_vnd: 5_000_000,
      rounding_step_vnd: 100_000, allocation_formula: 'PROPORTIONAL_GAP',
      cash_eligible_for_new_capital: true, sell_to: 'TARGET',
    },
    crashLevels: [{ level: 1, drawdown_pct: 15, deploy_pct_of_reserve: 10 }],
    crashEvents: [],
    watchlist: [],
    incomeReceivedVnd: 0,
    portfolioDrawdownPct: 0,
    drawdowns: { STOCKS: 0, CRYPTO: 0, GOLD: 0, CASH: 0 },
    currentEpisodeStart: '2026-06-01',
    contributionRecordedThisPeriod: true,
    ...over,
  };
}

describe('mapToSnapshot — gom giá trị theo nhóm tài sản', () => {
  const s = mapToSnapshot(buildSourceData({
    allocation: [
      row({ symbol: 'FPT', asset_class: 'STOCKS', quantity: 100,
            price_vnd: 100_000, market_value_vnd: 10_000_000 }),
      row({ symbol: 'VCB', asset_class: 'STOCKS', quantity: 200,
            price_vnd: 70_000, market_value_vnd: 14_000_000 }),
      row({ symbol: 'BTC', asset_class: 'CRYPTO', quantity: 0.1,
            price_vnd: 2_500_000_000, market_value_vnd: 250_000_000 }),
      row({ symbol: 'VND-RESERVE', asset_class: 'CASH', earmarked_for: null,
            cash_balance_vnd: 50_000_000, market_value_vnd: 50_000_000 }),
      row({ symbol: 'VND-DCA-STOCKS', asset_class: 'CASH', earmarked_for: 'STOCKS',
            cash_balance_vnd: 8_000_000, market_value_vnd: 8_000_000 }),
    ],
  }));

  it('cộng dồn nhiều mã về cùng một nhóm', () => {
    expect(s.classValues.STOCKS).toBe(24_000_000);
    expect(s.classValues.CRYPTO).toBe(250_000_000);
  });

  it('túi DCA vẫn nằm trong CASH ở classValues (đây là số DEPLOYED)', () => {
    expect(s.classValues.CASH).toBe(58_000_000);
  });

  it('tách riêng số tiền trong từng túi DCA', () => {
    expect(s.earmarkedPots.STOCKS).toBe(8_000_000);
    expect(s.earmarkedPots.CRYPTO).toBe(0);
    expect(s.earmarkedPots.CASH).toBe(0);
  });

  it('cashReserveVnd chỉ tính túi VND-RESERVE (earmarked_for = null)', () => {
    expect(s.cashReserveVnd).toBe(50_000_000);
  });

  it('nhóm không có mã nào → 0, không undefined', () => {
    expect(s.classValues.GOLD).toBe(0);
  });
});

describe('mapToSnapshot — danh mục mới toanh (chưa có giao dịch)', () => {
  // Addendum Task 14 mục 2: v_positions/v_allocation KHÔNG trả dòng nào cho
  // instrument chưa có giao dịch (không phải dòng với quantity = 0). Với danh
  // mục hoàn toàn mới, allocation rỗng — mapper phải tự default 0 cho CẢ BỐN
  // asset class, KỂ CẢ 4 túi CASH, không được để domain nhận undefined.
  it('allocation rỗng → mọi classValues/earmarkedPots = 0, cashReserveVnd = 0, không có missingPriceSymbols', () => {
    const s = mapToSnapshot(buildSourceData({ allocation: [] }));
    expect(s.classValues).toEqual({ STOCKS: 0, CRYPTO: 0, GOLD: 0, CASH: 0 });
    expect(s.earmarkedPots).toEqual({ STOCKS: 0, CRYPTO: 0, GOLD: 0, CASH: 0 });
    expect(s.cashReserveVnd).toBe(0);
    expect(s.missingPriceSymbols).toEqual([]);
  });
});

describe('mapToSnapshot — phát hiện tài sản thiếu giá', () => {
  it('mã ĐANG GIỮ mà market_value null → vào missingPriceSymbols', () => {
    const s = mapToSnapshot(buildSourceData({
      allocation: [
        row({ symbol: 'SJC-1L', asset_class: 'GOLD', quantity: 2,
              price_vnd: null, market_value_vnd: null }),
      ],
    }));
    expect(s.missingPriceSymbols).toEqual(['SJC-1L']);
  });

  it('mã KHÔNG giữ (quantity 0 hoặc null) thiếu giá thì BỎ QUA, không chặn kế hoạch', () => {
    // 56 mã watchlist đều thuộc loại này — không được để chúng chặn kế hoạch.
    const s = mapToSnapshot(buildSourceData({
      allocation: [
        row({ symbol: 'ACB', quantity: 0, market_value_vnd: null }),
        row({ symbol: 'HPG', quantity: null, market_value_vnd: null }),
      ],
    }));
    expect(s.missingPriceSymbols).toEqual([]);
  });

  it('túi CASH không bao giờ bị coi là thiếu giá', () => {
    const s = mapToSnapshot(buildSourceData({
      allocation: [
        row({ symbol: 'VND-RESERVE', asset_class: 'CASH',
              cash_balance_vnd: 1_000_000, price_vnd: null, market_value_vnd: 1_000_000 }),
      ],
    }));
    expect(s.missingPriceSymbols).toEqual([]);
  });
});

describe('mapToSnapshot — cấu hình', () => {
  it('đọc đúng settings từ DB', () => {
    const s = mapToSnapshot(buildSourceData());
    expect(s.monthlyContributionVnd).toBe(3_000_000);
    expect(s.config.formula).toBe('PROPORTIONAL_GAP');
    expect(s.config.roundingStepVnd).toBe(100_000);
    expect(s.config.sellTo).toBe('TARGET');
  });

  it('settings = null → dùng DEFAULT_CONFIG, KHÔNG ném lỗi', () => {
    const s = mapToSnapshot(buildSourceData({ settings: null }));
    expect(s.monthlyContributionVnd).toBe(3_000_000);
    expect(s.config.formula).toBe('PROPORTIONAL_GAP');
  });

  // Addendum Task 14 mục 4: `settings.allocation_formula` là cột `text` KHÔNG
  // có CHECK constraint trong DB — DB nhận bất cứ chuỗi nào. Union type của
  // domain sẽ từ chối ⇒ mapper phải validate và NÉM lỗi tiếng Việt rõ ràng,
  // không được âm thầm tụt về giá trị mặc định (đó vẫn là nuốt lỗi im lặng)
  // và không được ép kiểu bừa bằng `as`.
  //
  // LƯU Ý: task-14-brief.md Step 2 viết test này mong đợi hành vi NGƯỢC LẠI
  // ("tụt về PROPORTIONAL_GAP, không crash"). Addendum ghi rõ nó override
  // brief khi hai bên mâu thuẫn — xem giải thích đầy đủ trong task-14-report.md.
  it('allocation_formula lạ trong DB → ném lỗi rõ ràng tiếng Việt, không tụt về mặc định', () => {
    expect(() => mapToSnapshot(buildSourceData({
      settings: { ...buildSourceData().settings!, allocation_formula: 'CONG_THUC_LA' },
    }))).toThrow(/allocation_formula/);
  });

  it('sell_to lạ trong DB → ném lỗi rõ ràng tiếng Việt, không ép kiểu bừa', () => {
    expect(() => mapToSnapshot(buildSourceData({
      settings: { ...buildSourceData().settings!, sell_to: 'SOMEWHERE_ELSE' },
    }))).toThrow(/sell_to/);
  });

  it('thiếu target của một nhóm → NÉM lỗi rõ ràng, không đoán bừa', () => {
    expect(() => mapToSnapshot(buildSourceData({
      targets: [{ asset_class: 'STOCKS', target_pct: 50, min_pct: 40, max_pct: 55 }],
    }))).toThrow(/CRYPTO/);
  });
});
