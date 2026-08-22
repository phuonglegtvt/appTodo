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

describe('mapToSnapshot — dữ liệu bất thường mà DB không chặn', () => {
  // Fix round 1, finding Minor #1: constraint earmark_chi_cho_cash trong DB
  // chỉ đòi "earmarked_for is null or asset_class = 'CASH'" — không cấm
  // earmarked_for = 'CASH'. Một túi CASH "đặt tên cho chính CASH" là vô nghĩa
  // nghiệp vụ và vi phạm hợp đồng domain (earmarkedPots.CASH luôn = 0). Phải
  // ném lỗi, không được âm thầm cộng vào earmarkedPots.CASH.
  it('túi CASH có earmarked_for = CASH → ném lỗi rõ ràng tiếng Việt', () => {
    expect(() => mapToSnapshot(buildSourceData({
      allocation: [
        row({ symbol: 'VND-DCA-CASH', asset_class: 'CASH', earmarked_for: 'CASH',
              cash_balance_vnd: 2_000_000, market_value_vnd: 2_000_000 }),
      ],
    }))).toThrow(/earmarked_for/);
  });

  // Fix round 1, finding Minor #2: `isHeld = (quantity ?? 0) > 0` cũ coi
  // quantity âm giống hệt "chưa mua" (quantity 0/null) rồi bỏ qua bằng
  // continue — tài sản biến mất khỏi classValues mà không ai biết. Số lượng
  // âm nghĩa là sổ giao dịch có SELL vượt quá số đang giữ, một lỗi dữ liệu
  // thật, phải được báo tường minh, không được nuốt im lặng.
  it('quantity âm (SELL vượt số đang giữ) → ném lỗi rõ ràng, không âm thầm bỏ qua', () => {
    expect(() => mapToSnapshot(buildSourceData({
      allocation: [
        row({ symbol: 'FPT', asset_class: 'STOCKS', quantity: -10,
              price_vnd: 100_000, market_value_vnd: -1_000_000 }),
      ],
    }))).toThrow(/FPT/);
  });

  // Final review Việc 1 (Important I-1), ca (a): trigger tx_validate không kiểm
  // số dư nên một túi CASH (kể cả túi DCA) đạt tới được cash_balance_vnd âm thật
  // trên DB. Lọt qua sẽ cộng thẳng vào earmarkedPots, sinh một kế hoạch TRÔNG
  // hợp lệ mà tỷ trọng các nhóm khác đã sai hẳn.
  it('cash_balance_vnd của túi CASH âm → ném lỗi rõ ràng, nêu túi và số dư', () => {
    expect(() => mapToSnapshot(buildSourceData({
      allocation: [
        row({ symbol: 'VND-DCA-STOCKS', asset_class: 'CASH', earmarked_for: 'STOCKS',
              cash_balance_vnd: -200_000_000, market_value_vnd: -200_000_000 }),
      ],
    }))).toThrow(/cash_balance_vnd/);
  });

  // Final review Việc 1, ca (d) — nửa đầu: cash_balance_vnd là NaN thì `< 0`
  // không bắt được (NaN < 0 luôn false), nhưng vẫn phải chặn vì nó biến cả
  // classValues.CASH lẫn earmarkedPots thành NaN một cách âm thầm.
  it('cash_balance_vnd là NaN → ném lỗi rõ ràng, không lọt qua vì NaN < 0 là false', () => {
    expect(() => mapToSnapshot(buildSourceData({
      allocation: [
        row({ symbol: 'VND-RESERVE', asset_class: 'CASH', cash_balance_vnd: NaN,
              market_value_vnd: NaN }),
      ],
    }))).toThrow(/cash_balance_vnd/);
  });

  // Final review Việc 1, ca (d) — nửa sau: market_value_vnd là NaN không phải
  // null nên không rơi vào nhánh missingPriceSymbols — nó cộng thẳng vào
  // classValues. Hậu quả kín hơn cả throw: `gaps[c] > 0` với NaN luôn false,
  // allocate coi như "không nhóm nào thiếu" và trả unallocatedVnd = pool —
  // TRÔNG như một kế hoạch hợp lệ bình thường (xem allocate.ts).
  it('market_value_vnd là NaN → ném lỗi rõ ràng, không âm thầm lan NaN vào classValues', () => {
    expect(() => mapToSnapshot(buildSourceData({
      allocation: [
        row({ symbol: 'FPT', asset_class: 'STOCKS', quantity: 100,
              price_vnd: 100_000, market_value_vnd: NaN }),
      ],
    }))).toThrow(/market_value_vnd/);
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

  // Final review Việc 1, ca (b): cột monthly_contribution_vnd không có CHECK
  // constraint (core.sql:114) nên DB nhận giá trị âm. Lọt qua sẽ ném exception
  // KHÔNG AI BẮT từ allocate.ts, thay vì một lỗi tiếng Việt rõ ràng ngay ở biên.
  it('monthly_contribution_vnd âm trong settings → ném lỗi rõ ràng, không tụt về mặc định', () => {
    expect(() => mapToSnapshot(buildSourceData({
      settings: { ...buildSourceData().settings!, monthly_contribution_vnd: -3_000_000 },
    }))).toThrow(/monthly_contribution_vnd/);
  });

  it('thiếu target của một nhóm → NÉM lỗi rõ ràng, không đoán bừa', () => {
    expect(() => mapToSnapshot(buildSourceData({
      targets: [{ asset_class: 'STOCKS', target_pct: 50, min_pct: 40, max_pct: 55 }],
    }))).toThrow(/CRYPTO/);
  });

  // Final review Việc 1, ca (c): core.sql:100-109 chỉ có constraint band_hop_le
  // (min ≤ target ≤ max của TỪNG nhóm) — không ép tổng bốn target_pct = 100.
  // Với Σ=90%, allocate từng chia vượt cả gap thật của một nhóm (STOCKS nhận
  // 58,9tr cho gap chỉ 50tr) mà không có dấu hiệu gì lộ ra là kế hoạch sai.
  it('tổng target_pct khác 100 → ném lỗi rõ ràng, không âm thầm chạy tiếp', () => {
    expect(() => mapToSnapshot(buildSourceData({
      targets: [
        { asset_class: 'STOCKS', target_pct: 40, min_pct: 30, max_pct: 50 },
        { asset_class: 'CRYPTO', target_pct: 20, min_pct: 15, max_pct: 25 },
        { asset_class: 'GOLD',   target_pct: 15, min_pct: 10, max_pct: 20 },
        { asset_class: 'CASH',   target_pct: 15, min_pct: 7,  max_pct: 20 },
      ],
    }))).toThrow(/target_pct/);
  });
});
