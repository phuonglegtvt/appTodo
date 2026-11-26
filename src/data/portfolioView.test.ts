// Test cho portfolioView.ts — seam nối holdings thật với engine domain.
//
// Đây là chỗ duy nhất ghép: holdings → AllocationRow[] → PortfolioSnapshot →
// ActionPlan + TopUpPlan. Component chỉ hiển thị, không tính gì.

import { describe, it, expect } from 'vitest';
import { buildPortfolioView } from './portfolioView';
import type { Stock } from '../types/stock';
import type { Crypto } from '../types/crypto';
import type { Gold } from '../types/gold';
import type { SettingsRow, TargetRow } from '../types/portfolio';

const TARGETS: TargetRow[] = [
  { asset_class: 'STOCKS', target_pct: 60, min_pct: 55, max_pct: 65 },
  { asset_class: 'CRYPTO', target_pct: 30, min_pct: 25, max_pct: 35 },
  { asset_class: 'GOLD',   target_pct: 10, min_pct: 5,  max_pct: 15 },
  { asset_class: 'CASH',   target_pct: 0,  min_pct: 0,  max_pct: 0 },
];

const SETTINGS: SettingsRow = {
  monthly_contribution_vnd: 3_000_000, watch_deviation_pp: 3,
  strong_rebalance_pp: 5, min_sell_amount_vnd: 5_000_000,
  rounding_step_vnd: 100_000, allocation_formula: 'PROPORTIONAL_GAP',
  cash_eligible_for_new_capital: true, sell_to: 'TARGET',
  dca_capital_vnd: 0, dca_months: null, cash_on_hand_vnd: 0,
};

function stock(over: Partial<Stock> = {}): Stock {
  return {
    id: 's1', user_id: 'u1', ticker: 'FPT', company_name: 'FPT Corp',
    group: 'balance', price_threshold: null, price_protect: null,
    current_price: null, dividend: null, invested_amount: null, quantity: null, peak_price: null,
    sort_order: 0, created_at: '2026-01-01', updated_at: '2026-08-20', ...over,
  };
}
function crypto(over: Partial<Crypto> = {}): Crypto {
  return {
    id: 'c1', user_id: 'u1', symbol: 'BTC', name: 'Bitcoin',
    quantity: null, avg_buy_price: null, current_price: null, peak_price: null,
    invested_amount: null, sort_order: 0, created_at: '2026-01-01', updated_at: '2026-08-21', ...over,
  };
}
function gold(over: Partial<Gold> = {}): Gold {
  return {
    id: 'g1', user_id: 'u1', label: 'SJC 1 lượng',
    quantity: null, avg_buy_price: null, current_price: null,
    invested_amount: null, sort_order: 0, created_at: '2026-01-01', updated_at: '2026-08-22', ...over,
  };
}

const base = {
  asOf: '2026-08-23',
  targets: TARGETS,
  settings: SETTINGS,
  usdVnd: 26_000,
  stocks: [] as Stock[],
  cryptos: [] as Crypto[],
  golds: [] as Gold[],
};

describe('buildPortfolioView — danh mục 35:20:0 mà NewPL nêu', () => {
  // 350tr cổ phiếu (100.000 cổ × 3,5 nghìn), 200tr crypto, 0 vàng.
  const view = buildPortfolioView({
    ...base,
    stocks: [stock({ quantity: 100_000, current_price: 3.5, invested_amount: 300_000 })],
    cryptos: [crypto({ quantity: 1, current_price: 200_000_000 / 26_000,
                       avg_buy_price: 150_000_000 / 26_000 })],
  });

  it('tổng danh mục = tổng giá trị thị trường ba nhóm', () => {
    expect(view.snapshot.classValues.STOCKS).toBe(350_000_000);
    expect(view.snapshot.classValues.CRYPTO).toBeCloseTo(200_000_000, 6);
    expect(view.snapshot.classValues.GOLD).toBe(0);
    expect(view.snapshot.classValues.CASH).toBe(0);
  });

  it('tạo được kế hoạch, không bị chặn', () => {
    expect(view.plan.status).toBe('READY');
    expect(view.plan.blockedReason).toBeNull();
  });

  it('tính được số vốn cần bổ sung để về 60:30:10', () => {
    expect(view.topUp.status).toBe('OK');
    expect(Math.round(view.topUp.totalNeededVnd)).toBe(116_666_667);
  });

  it('hiện lãi/lỗ chưa thực hiện mà KHÔNG cần sổ giao dịch', () => {
    // cổ phiếu: 350tr hiện tại − 300tr vốn = +50tr
    const cp = view.byClass.STOCKS;
    expect(cp.marketValueVnd).toBe(350_000_000);
    expect(cp.costBasisVnd).toBe(300_000_000);
    expect(cp.unrealizedPnlVnd).toBe(50_000_000);
  });

  it('không hiện alert CONTRIBUTION_MISSING — đợt này không theo dõi tiền vào', () => {
    expect(view.plan.alerts.some((a) => a.code === 'CONTRIBUTION_MISSING')).toBe(true);
    expect(view.alerts.some((a) => a.code === 'CONTRIBUTION_MISSING')).toBe(false);
  });
});

describe('buildPortfolioView — cổ phiếu đã bỏ tiền mà chưa nhập số lượng', () => {
  const view = buildPortfolioView({
    ...base,
    stocks: [
      stock({ id: 's1', ticker: 'FPT', quantity: 100_000, current_price: 3.5,
              invested_amount: 300_000 }),
      stock({ id: 's2', ticker: 'VNM', quantity: null, current_price: 60,
              invested_amount: 50_000 }),
    ],
  });

  it('báo đích danh mã thiếu số lượng, không âm thầm bỏ qua', () => {
    expect(view.missingQuantitySymbols).toEqual(['VNM']);
  });

  it('tỷ trọng tính trên phần đã biết — và nói rõ đang thiếu phần nào', () => {
    // VNM không vào tổng: 350tr, không phải 400tr.
    expect(view.snapshot.classValues.STOCKS).toBe(350_000_000);
    expect(view.incompleteData).toBe(true);
  });
});

describe('buildPortfolioView — vàng vào đúng nhóm, đúng đơn vị', () => {
  // Đủ ba nhóm, đúng tỷ lệ 60:30:10 để kiểm cả đường vàng lẫn ca "đã ở target".
  const view = buildPortfolioView({
    ...base,
    stocks: [stock({ quantity: 100_000, current_price: 6, invested_amount: 500_000 })],
    cryptos: [crypto({ quantity: 1, current_price: 300_000_000 / 26_000,
                       avg_buy_price: 200_000_000 / 26_000 })],
    // 100tr vàng = 2 lượng × 50tr/lượng. ĐỒNG/lượng, KHÔNG nhân 1.000.
    golds: [gold({ quantity: 2, current_price: 50_000_000, avg_buy_price: 40_000_000 })],
  });

  it('vàng tính bằng ĐỒNG/lượng, không bị nhân 1.000 như cổ phiếu', () => {
    expect(view.snapshot.classValues.GOLD).toBe(100_000_000);
    expect(view.byClass.GOLD.costBasisVnd).toBe(80_000_000);
    expect(view.byClass.GOLD.unrealizedPnlVnd).toBe(20_000_000);
  });

  it('đã đúng target thì không cần bổ sung đồng nào', () => {
    expect(Math.round(view.topUp.totalNeededVnd)).toBe(0);
  });

  it('CASH không hiện lên bảng khi vừa target 0% vừa không giữ đồng nào', () => {
    expect(view.visibleClasses).toEqual(['STOCKS', 'CRYPTO', 'GOLD']);
  });
});

describe('buildPortfolioView — danh mục rỗng', () => {
  const view = buildPortfolioView(base);

  it('không ném lỗi, không ra NaN%', () => {
    expect(view.snapshot.classValues).toEqual(
      { STOCKS: 0, CRYPTO: 0, GOLD: 0, CASH: 0 },
    );
    expect(view.weights.every((w) => Number.isFinite(w.weightPct))).toBe(true);
  });

  it('topUp nói thẳng là chưa có gì để tính', () => {
    expect(view.topUp.status).toBe('EMPTY_PORTFOLIO');
  });
});

describe('buildPortfolioView — thiếu giá thì chặn kế hoạch, không đoán', () => {
  it('đang giữ mà chưa có giá → kế hoạch bị chặn, nêu tên mã', () => {
    const view = buildPortfolioView({
      ...base,
      stocks: [stock({ quantity: 100, current_price: null, invested_amount: 9_000 })],
    });
    expect(view.plan.status).not.toBe('READY');
    expect(view.plan.blockedReason).toMatch(/FPT/);
  });
});

describe('buildPortfolioView — thiếu cấu hình', () => {
  it('chưa chạy seed (targets rỗng) → ném lỗi chỉ rõ phải chạy file nào', () => {
    expect(() => buildPortfolioView({ ...base, targets: [] })).toThrow(/seed/);
  });
});

describe('buildPortfolioView — chi tiết tiền chia tháng này (cho UI giải thích)', () => {
  it('nêu được cả ba phần: tổng, tiền góp, vốn DCA rải ra', () => {
    const view = buildPortfolioView({
      ...base,
      settings: { ...SETTINGS, monthly_contribution_vnd: 3_000_000,
                  dca_capital_vnd: 120_000_000, dca_months: 12 },
    });
    expect(view.monthlyPool.contributionVnd).toBe(3_000_000);
    expect(view.monthlyPool.dcaSliceVnd).toBe(10_000_000);
    expect(view.monthlyPool.totalVnd).toBe(13_000_000);
    // Và đúng bằng số engine dùng để chia — hai chỗ không được lệch nhau.
    expect(view.snapshot.monthlyContributionVnd).toBe(view.monthlyPool.totalVnd);
  });

  it('có vốn mà chưa nhập số tháng: nêu lý do để UI nói ra', () => {
    const view = buildPortfolioView({
      ...base,
      settings: { ...SETTINGS, dca_capital_vnd: 120_000_000, dca_months: null },
    });
    expect(view.monthlyPool.dcaSliceVnd).toBe(0);
    expect(view.monthlyPool.lyDoKhongCoDca).toBe('chua-dat-thang');
  });

  it('settings = null: pool mặc định, không lỗi', () => {
    const view = buildPortfolioView({ ...base, settings: null });
    expect(view.monthlyPool.totalVnd).toBe(3_000_000);
    expect(view.monthlyPool.dcaSliceVnd).toBe(0);
  });
});

describe('buildPortfolioView — tiền mặt nhập ở màn Cấu hình', () => {
  // 90tr cổ phiếu (1.000 cổ × 90 nghìn) + 10tr tiền mặt ⇒ tiền mặt = 10%.
  const view = buildPortfolioView({
    ...base,
    settings: { ...SETTINGS, cash_on_hand_vnd: 10_000_000 },
    stocks: [stock({ quantity: 1_000, current_price: 90, invested_amount: 80_000 })],
  });

  it('tiền mặt vào nhóm CASH của snapshot', () => {
    expect(view.snapshot.classValues.CASH).toBe(10_000_000);
    expect(view.byClass.CASH.marketValueVnd).toBe(10_000_000);
  });

  it('tỷ trọng tính trên tổng có cả tiền mặt', () => {
    const cash = view.weights.find((w) => w.assetClass === 'CASH');
    expect(cash?.weightPct).toBeCloseTo(10, 5);
  });

  it('nhóm CASH hiện lên bảng khi đang giữ tiền mặt, dù mục tiêu 0%', () => {
    expect(view.visibleClasses).toContain('CASH');
  });
});
