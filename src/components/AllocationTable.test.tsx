// Test render bảng bằng dữ liệu THẬT chạy qua buildPortfolioView — 0 mock.
// Bắt hai loại lỗi tsc không thấy: crash lúc render, và số hiện sai/NaN.

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AllocationTable } from './AllocationTable';
import { buildPortfolioView } from '../data/portfolioView';
import type { SettingsRow, TargetRow } from '../types/portfolio';
import type { Stock } from '../types/stock';

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
};

const stock = (over: Partial<Stock>): Stock => ({
  id: 's1', user_id: 'u1', ticker: 'FPT', company_name: 'FPT Corp',
  group: 'balance', price_threshold: null, price_protect: null,
  current_price: null, dividend: null, invested_amount: null, quantity: null, peak_price: null,
  sort_order: 0, created_at: '2026-01-01', updated_at: '2026-08-20', ...over,
});

describe('AllocationTable', () => {
  const view = buildPortfolioView({
    asOf: '2026-08-23',
    // 350tr hiện tại, 300tr vốn ⇒ lãi 50tr. `invested_amount` theo NGHÌN ĐỒNG.
    stocks: [stock({ quantity: 100_000, current_price: 3.5, invested_amount: 300_000 })],
    cryptos: [], golds: [], targets: TARGETS, settings: SETTINGS, usdVnd: 26_000,
  });

  it('render không crash và hiện đủ ba nhóm hiển thị', () => {
    render(<AllocationTable view={view} />);
    expect(screen.getByText('Cổ phiếu')).toBeInTheDocument();
    expect(screen.getByText('Crypto')).toBeInTheDocument();
    expect(screen.getByText('Vàng')).toBeInTheDocument();
  });

  it('KHÔNG hiện Tiền mặt — target 0% và không giữ đồng nào', () => {
    render(<AllocationTable view={view} />);
    expect(screen.queryByText('Tiền mặt')).toBeNull();
  });

  it('hiện lãi chưa thực hiện có dấu +', () => {
    render(<AllocationTable view={view} />);
    expect(screen.getByText('+50.000.000 đ')).toBeInTheDocument();
  });

  it('không có ô nào chứa NaN hay undefined', () => {
    const { container } = render(<AllocationTable view={view} />);
    const chu = container.textContent ?? '';
    expect(chu).not.toMatch(/NaN/);
    expect(chu).not.toMatch(/undefined/);
  });

  it('nhóm chưa có gì hiện "—" cho vốn, không phải "0 đ"', () => {
    // Vàng chưa nhập gì: vốn đã bỏ phải là "—" (chưa biết), KHÔNG phải 0 đ
    // (đã biết là không). Hai thứ khác nhau và người đọc phải phân biệt được.
    const { container } = render(<AllocationTable view={view} />);
    const hangVang = Array.from(container.querySelectorAll('tbody tr')).find(
      (tr) => tr.textContent?.includes('Vàng'),
    );
    expect(hangVang?.textContent).toContain('—');
  });

  it('kế hoạch bị chặn vì thiếu giá vẫn render được, không ra NaN', () => {
    // Ca THẬT của 56 mã watchlist hiện tại: đã bỏ tiền, đã nhập số lượng, chưa
    // có giá ⇒ engine từ chối tạo kế hoạch. Bảng vẫn phải đọc được.
    const chan = buildPortfolioView({
      asOf: '2026-08-23',
      stocks: [stock({ quantity: 100, current_price: null, invested_amount: 9_000_000 })],
      cryptos: [], golds: [], targets: TARGETS, settings: SETTINGS, usdVnd: 26_000,
    });
    expect(chan.plan.status).not.toBe('READY');
    const { container } = render(<AllocationTable view={chan} />);
    const chu = container.textContent ?? '';
    expect(chu).not.toMatch(/NaN/);
    expect(chu).not.toMatch(/undefined/);
  });

  it('danh mục rỗng vẫn render được, không ra NaN%', () => {
    const rong = buildPortfolioView({
      asOf: '2026-08-23', stocks: [], cryptos: [], golds: [],
      targets: TARGETS, settings: SETTINGS, usdVnd: 26_000,
    });
    const { container } = render(<AllocationTable view={rong} />);
    expect(container.textContent ?? '').not.toMatch(/NaN/);
  });
});
