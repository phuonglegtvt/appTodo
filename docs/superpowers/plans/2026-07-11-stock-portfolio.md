# Danh mục cổ phiếu tích sản — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm trang **Cổ phiếu** vào app todo để quản lý danh mục cổ phiếu tích sản theo mẫu AzFin — watchlist 3 nhóm rủi ro + theo dõi số tiền đã đầu tư + tỷ trọng vốn so với khẩu vị rủi ro.

**Architecture:** Bảng Supabase `stocks` mới (RLS theo `user_id`, realtime đa thiết bị) cùng khuôn `goals`/`todos`. Logic thuần (`stockCalc.ts`) và parse giá (`stockPrice.ts`) viết TDD trước. Hook `useStocks` sao khuôn `useGoals`. UI là một trang React gom nhóm cổ phiếu + summary tỷ trọng, thêm nút chuyển trang thứ 3 trong Sidebar.

**Tech Stack:** React 18 + Vite + TypeScript, Tailwind CSS, Supabase JS v2 (Postgres + Realtime + RLS), Vitest.

## Global Constraints

- **TypeScript ở mọi nơi, tránh `any`** (CLAUDE.md quy ước code).
- **KHÔNG nuốt lỗi im lặng:** lỗi mạng/lưu/fetch phải `console.error` + hiện `ErrorBanner`; người dùng vẫn nhập tay được. Không fallback che lỗi.
- **Bảo mật:** chỉ dùng Supabase `anon` key ở frontend (an toàn nhờ RLS). Không đưa `service_role` key vào frontend.
- **Phase 1 = không server tự viết:** truy cập dữ liệu đi thẳng Supabase; lấy giá gọi trực tiếp từ trình duyệt.
- **Ngôn ngữ giao diện: tiếng Việt** (thuật ngữ kỹ thuật giữ tiếng Anh).
- **Style bằng class Tailwind, hỗ trợ dark mode qua `dark:`.** Dùng design tokens có sẵn: `bg-bg`/`bg-surface`/`bg-surface-2`, `text-text`/`text-text-muted`, `border-border`, `primary`/`primary-soft`, mỗi token có biến thể `*-dark`.
- **Đơn vị (đã chốt):** `price_threshold`/`price_protect`/`current_price` = **nghìn đồng**; `dividend`/`invested_amount` = **đồng**. Tỷ suất = `dividend / (price_threshold × 1000) × 100`, KHÔNG lưu DB.
- **3 khẩu vị rủi ro (TC/CB/PT):** attack 30/30/40 · balance 20/40/40 · defense 10/40/50.
- **Lệnh kiểm chứng:** `npm test` (Vitest, chạy 1 lần) và `npm run build` (`tsc -b && vite build`). Trước khi báo "xong" phải chạy cả hai và xác nhận pass.

## File Structure

Thêm mới:
- `supabase/migrations/2026-07-11-stocks.sql` — migration idempotent tạo bảng + RLS + realtime.
- `src/types/stock.ts` — kiểu `Stock`, `NewStock`, `StockUpdate`, `StockGroup`.
- `src/lib/stockCalc.ts` (+ `.test.ts`) — logic thuần: tỷ suất, tỷ trọng nhóm, so mục tiêu, chạm ngưỡng.
- `src/lib/stockPrice.ts` (+ `.test.ts`) — `fetchPrices` gọi nguồn CORS + `parsePriceResponse` (test được, không gọi mạng).
- `src/lib/parseNumber.ts` — `parseVnNumber` dùng chung cho form/row (tránh lặp).
- `src/hooks/useStocks.ts` — tải + realtime + add/update/delete.
- `src/components/PortfolioSummary.tsx` — tổng vốn + 3 thanh tỷ trọng + so khẩu vị.
- `src/components/StockForm.tsx` — form thêm mã.
- `src/components/StockRow.tsx` — một dòng cổ phiếu (hiển thị + sửa inline + xóa).
- `src/components/StockTable.tsx` — gom 3 nhóm, mỗi nhóm một khối màu.
- `src/components/StocksPage.tsx` — trang gộp: summary + nút "Cập nhật giá" + form + table.

Sửa:
- `supabase/schema.sql` — thêm định nghĩa bảng `stocks`.
- `src/pages/AppPage.tsx` — mở rộng `Page`, dùng `useStocks`, render `StocksPage`.
- `src/components/Sidebar.tsx` — thêm nút chuyển trang thứ 3 "Cổ phiếu".

---

### Task 1: Migration + schema bảng `stocks`

**Files:**
- Create: `supabase/migrations/2026-07-11-stocks.sql`
- Modify: `supabase/schema.sql` (thêm khối bảng `stocks` — nối vào cuối file)

**Interfaces:**
- Consumes: hàm `public.set_updated_at()` đã tạo cùng bảng `todos` (chỉ gắn trigger, không tạo lại).
- Produces: bảng `public.stocks` với các cột `id, user_id, ticker, company_name, group, price_threshold, price_protect, current_price, dividend, invested_amount, sort_order, created_at, updated_at`. Các task sau (types, hook) dựa đúng tên cột này.

- [ ] **Step 1: Tạo file migration**

Create `supabase/migrations/2026-07-11-stocks.sql`:

```sql
-- Migration: tạo bảng `stocks` (danh mục cổ phiếu tích sản) trên database thực tế.
-- Cùng khuôn với goals/todos: RLS theo user_id, realtime đa thiết bị, trigger updated_at.
--
-- An toàn chạy lại nhiều lần (idempotent): dùng "if not exists" / "drop ... if exists"
-- và bọc lệnh thêm publication trong khối kiểm tra để không lỗi khi đã thêm rồi.

-- Bảng danh mục cổ phiếu. Đơn vị: price_* = nghìn đồng; dividend, invested_amount = đồng.
create table if not exists public.stocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ticker text not null,
  company_name text not null,
  "group" text not null check ("group" in ('attack', 'balance', 'defense')),
  price_threshold numeric,
  price_protect numeric,
  current_price numeric,
  dividend numeric,
  invested_amount numeric,
  sort_order numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Hàm set_updated_at() đã tạo cùng bảng todos; ở đây chỉ gắn trigger cho stocks.
drop trigger if exists trg_stocks_updated_at on public.stocks;
create trigger trg_stocks_updated_at
  before update on public.stocks
  for each row execute function public.set_updated_at();

-- Bật Row Level Security: mỗi người chỉ thao tác cổ phiếu của mình.
alter table public.stocks enable row level security;

drop policy if exists "stocks_select_own" on public.stocks;
create policy "stocks_select_own" on public.stocks
  for select using (auth.uid() = user_id);

drop policy if exists "stocks_insert_own" on public.stocks;
create policy "stocks_insert_own" on public.stocks
  for insert with check (auth.uid() = user_id);

drop policy if exists "stocks_update_own" on public.stocks;
create policy "stocks_update_own" on public.stocks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "stocks_delete_own" on public.stocks;
create policy "stocks_delete_own" on public.stocks
  for delete using (auth.uid() = user_id);

-- Bật Realtime cho stocks (chỉ thêm nếu chưa có trong publication — tránh lỗi khi chạy lại).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'stocks'
  ) then
    alter publication supabase_realtime add table public.stocks;
  end if;
end $$;

-- REPLICA IDENTITY FULL: để sự kiện realtime DELETE/UPDATE mang đủ cột (gồm user_id)
-- cho việc lọc theo user và đồng bộ đa thiết bị (giống bảng todos/goals).
alter table public.stocks replica identity full;
```

> **Lưu ý:** `group` là từ khóa SQL → phải bọc trong `"group"` mọi nơi trong migration/schema.

- [ ] **Step 2: Thêm bảng vào `supabase/schema.sql`**

Đọc cuối `supabase/schema.sql`, nối thêm khối định nghĩa `create table if not exists public.stocks (...)` **giống hệt** phần `create table` ở Step 1 (chỉ phần bảng + RLS + realtime; giữ đúng phong cách các bảng khác trong file). Nếu file schema đã có mẫu cho goals thì đặt khối stocks ngay sau, cùng thứ tự trình bày.

- [ ] **Step 3: Xác minh cú pháp bằng mắt**

Không có DB local để chạy. Đọc lại file, xác nhận: 4 policy đủ select/insert/update/delete; `"group"` được quote; khối publication idempotent; `replica identity full` có mặt.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/2026-07-11-stocks.sql supabase/schema.sql
git commit -m "feat(stocks): migration + schema bảng cổ phiếu (RLS + realtime)"
```

> **Sau khi merge:** cần chạy file migration này trong Supabase Dashboard > SQL Editor (giống goals). Đây là bước thủ công của người dùng, không tự động.

---

### Task 2: Kiểu dữ liệu + logic thuần `stockCalc.ts` (TDD)

**Files:**
- Create: `src/types/stock.ts`
- Create: `src/lib/stockCalc.ts`
- Test: `src/lib/stockCalc.test.ts`

**Interfaces:**
- Consumes: (không có — task nền tảng)
- Produces:
  - Type `StockGroup = 'attack' | 'balance' | 'defense'`
  - Interface `Stock` (đúng cột DB Task 1), `NewStock`, `StockUpdate`
  - `computeYield(stock: Pick<Stock, 'dividend' | 'price_threshold'>): number | null`
  - `groupWeights(stocks: Stock[]): { total: number; byGroup: Record<StockGroup, { amount: number; percent: number }> }`
  - `TARGET_PROFILES: Record<StockGroup, Record<StockGroup, number>>`
  - `compareToTarget(weights: GroupWeights, profile: StockGroup): Record<StockGroup, number>`
  - `isBelowThreshold(stock: Pick<Stock, 'current_price' | 'price_threshold'>): boolean`

- [ ] **Step 1: Tạo file types**

Create `src/types/stock.ts`:

```ts
export type StockGroup = 'attack' | 'balance' | 'defense';

export interface Stock {
  id: string;
  user_id: string;
  ticker: string;
  company_name: string;
  group: StockGroup;
  price_threshold: number | null;
  price_protect: number | null;
  current_price: number | null;
  dividend: number | null;
  invested_amount: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** Dữ liệu để thêm một mã mới (giá hiện tại điền sau qua "Cập nhật giá" hoặc sửa inline). */
export interface NewStock {
  ticker: string;
  company_name: string;
  group: StockGroup;
  price_threshold?: number | null;
  price_protect?: number | null;
  current_price?: number | null;
  dividend?: number | null;
  invested_amount?: number | null;
}

/** Các trường được phép sửa. */
export type StockUpdate = Partial<
  Pick<
    Stock,
    | 'ticker'
    | 'company_name'
    | 'group'
    | 'price_threshold'
    | 'price_protect'
    | 'current_price'
    | 'dividend'
    | 'invested_amount'
    | 'sort_order'
  >
>;
```

- [ ] **Step 2: Viết test thất bại**

Create `src/lib/stockCalc.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  computeYield,
  groupWeights,
  compareToTarget,
  isBelowThreshold,
  TARGET_PROFILES,
} from './stockCalc';
import type { Stock, StockGroup } from '../types/stock';

// Tạo Stock mẫu; chỉ cần override phần liên quan cho từng test.
function makeStock(over: Partial<Stock> = {}): Stock {
  return {
    id: 'id-' + (over.ticker ?? 'x'),
    user_id: 'u1',
    ticker: 'ACB',
    company_name: 'Ngân hàng ACB',
    group: 'balance',
    price_threshold: null,
    price_protect: null,
    current_price: null,
    dividend: null,
    invested_amount: null,
    sort_order: 0,
    created_at: '2026-07-11T00:00:00Z',
    updated_at: '2026-07-11T00:00:00Z',
    ...over,
  };
}

describe('computeYield', () => {
  it('khớp ví dụ AzFin: ACB 700đ cổ tức / giá ngưỡng 30,1 nghìn ≈ 2,3%', () => {
    const y = computeYield({ dividend: 700, price_threshold: 30.1 });
    expect(y).not.toBeNull();
    expect(y!).toBeCloseTo(2.326, 2);
  });

  it('trả null khi thiếu cổ tức', () => {
    expect(computeYield({ dividend: null, price_threshold: 30.1 })).toBeNull();
  });

  it('trả null khi thiếu giá ngưỡng', () => {
    expect(computeYield({ dividend: 700, price_threshold: null })).toBeNull();
  });

  it('trả null khi giá ngưỡng = 0 (không chia cho 0)', () => {
    expect(computeYield({ dividend: 700, price_threshold: 0 })).toBeNull();
  });
});

describe('groupWeights', () => {
  it('tính tổng vốn và % mỗi nhóm theo invested_amount', () => {
    const stocks = [
      makeStock({ ticker: 'A', group: 'attack', invested_amount: 30 }),
      makeStock({ ticker: 'B', group: 'balance', invested_amount: 30 }),
      makeStock({ ticker: 'C', group: 'defense', invested_amount: 40 }),
    ];
    const w = groupWeights(stocks);
    expect(w.total).toBe(100);
    expect(w.byGroup.attack.percent).toBeCloseTo(30, 5);
    expect(w.byGroup.balance.percent).toBeCloseTo(30, 5);
    expect(w.byGroup.defense.percent).toBeCloseTo(40, 5);
  });

  it('bỏ qua mã chưa nhập số tiền (null)', () => {
    const stocks = [
      makeStock({ ticker: 'A', group: 'attack', invested_amount: 50 }),
      makeStock({ ticker: 'B', group: 'balance', invested_amount: null }),
    ];
    const w = groupWeights(stocks);
    expect(w.total).toBe(50);
    expect(w.byGroup.attack.percent).toBeCloseTo(100, 5);
    expect(w.byGroup.balance.amount).toBe(0);
  });

  it('total = 0 thì mọi percent = 0, không chia cho 0', () => {
    const w = groupWeights([makeStock({ invested_amount: null })]);
    expect(w.total).toBe(0);
    expect(w.byGroup.attack.percent).toBe(0);
    expect(w.byGroup.balance.percent).toBe(0);
    expect(w.byGroup.defense.percent).toBe(0);
  });

  it('danh sách rỗng: total = 0', () => {
    const w = groupWeights([]);
    expect(w.total).toBe(0);
    expect(w.byGroup.defense.amount).toBe(0);
  });
});

describe('TARGET_PROFILES', () => {
  it('3 khẩu vị đã chốt, mỗi khẩu vị cộng đủ 100', () => {
    const keys: StockGroup[] = ['attack', 'balance', 'defense'];
    for (const k of keys) {
      const p = TARGET_PROFILES[k];
      expect(p.attack + p.balance + p.defense).toBe(100);
    }
    expect(TARGET_PROFILES.attack).toEqual({ attack: 30, balance: 30, defense: 40 });
    expect(TARGET_PROFILES.balance).toEqual({ attack: 20, balance: 40, defense: 40 });
    expect(TARGET_PROFILES.defense).toEqual({ attack: 10, balance: 40, defense: 50 });
  });
});

describe('compareToTarget', () => {
  it('chênh lệch = thực tế − mục tiêu, theo từng nhóm', () => {
    const weights = groupWeights([
      makeStock({ group: 'attack', invested_amount: 50 }),
      makeStock({ group: 'balance', invested_amount: 30 }),
      makeStock({ group: 'defense', invested_amount: 20 }),
    ]);
    // thực tế 50/30/20 so khẩu vị Cân bằng 20/40/40 → +30 / -10 / -20
    const diff = compareToTarget(weights, 'balance');
    expect(diff.attack).toBeCloseTo(30, 5);
    expect(diff.balance).toBeCloseTo(-10, 5);
    expect(diff.defense).toBeCloseTo(-20, 5);
  });
});

describe('isBelowThreshold', () => {
  it('true khi giá hiện tại <= giá ngưỡng', () => {
    expect(isBelowThreshold({ current_price: 29, price_threshold: 30.1 })).toBe(true);
    expect(isBelowThreshold({ current_price: 30.1, price_threshold: 30.1 })).toBe(true);
  });
  it('false khi giá hiện tại > giá ngưỡng', () => {
    expect(isBelowThreshold({ current_price: 31, price_threshold: 30.1 })).toBe(false);
  });
  it('false khi thiếu dữ liệu', () => {
    expect(isBelowThreshold({ current_price: null, price_threshold: 30.1 })).toBe(false);
    expect(isBelowThreshold({ current_price: 29, price_threshold: null })).toBe(false);
  });
});
```

- [ ] **Step 3: Chạy test để xác nhận thất bại**

Run: `npm test -- src/lib/stockCalc.test.ts`
Expected: FAIL — "Cannot find module './stockCalc'" / các hàm chưa định nghĩa.

- [ ] **Step 4: Viết implementation tối thiểu**

Create `src/lib/stockCalc.ts`:

```ts
import type { Stock, StockGroup } from '../types/stock';

const GROUPS: StockGroup[] = ['attack', 'balance', 'defense'];

export interface GroupWeights {
  total: number;
  byGroup: Record<StockGroup, { amount: number; percent: number }>;
}

/**
 * Tỷ suất cổ tức (%) = dividend (đồng) / (price_threshold nghìn đồng × 1000) × 100.
 * Trả null nếu thiếu dữ liệu hoặc giá ngưỡng = 0 (tránh chia cho 0).
 */
export function computeYield(
  stock: Pick<Stock, 'dividend' | 'price_threshold'>,
): number | null {
  const { dividend, price_threshold } = stock;
  if (dividend == null || price_threshold == null || price_threshold === 0) return null;
  return (dividend / (price_threshold * 1000)) * 100;
}

/** Tổng vốn đã đầu tư và % mỗi nhóm theo invested_amount (bỏ qua mã chưa nhập). */
export function groupWeights(stocks: Stock[]): GroupWeights {
  const amounts: Record<StockGroup, number> = { attack: 0, balance: 0, defense: 0 };
  for (const s of stocks) {
    if (s.invested_amount != null) amounts[s.group] += s.invested_amount;
  }
  const total = amounts.attack + amounts.balance + amounts.defense;
  const byGroup = {} as GroupWeights['byGroup'];
  for (const g of GROUPS) {
    byGroup[g] = {
      amount: amounts[g],
      percent: total === 0 ? 0 : (amounts[g] / total) * 100,
    };
  }
  return { total, byGroup };
}

/** 3 khẩu vị rủi ro đã chốt (theo hàng trên ảnh AzFin), % cho TC/CB/PT. */
export const TARGET_PROFILES: Record<StockGroup, Record<StockGroup, number>> = {
  attack: { attack: 30, balance: 30, defense: 40 },
  balance: { attack: 20, balance: 40, defense: 40 },
  defense: { attack: 10, balance: 40, defense: 50 },
};

/** Chênh lệch (thực tế − mục tiêu) theo % cho từng nhóm. */
export function compareToTarget(
  weights: GroupWeights,
  profile: StockGroup,
): Record<StockGroup, number> {
  const target = TARGET_PROFILES[profile];
  const diff = {} as Record<StockGroup, number>;
  for (const g of GROUPS) {
    diff[g] = weights.byGroup[g].percent - target[g];
  }
  return diff;
}

/** Mã "chạm ngưỡng" khi giá hiện tại đã về tới/dưới giá ngưỡng tích sản. */
export function isBelowThreshold(
  stock: Pick<Stock, 'current_price' | 'price_threshold'>,
): boolean {
  const { current_price, price_threshold } = stock;
  return current_price != null && price_threshold != null && current_price <= price_threshold;
}
```

- [ ] **Step 5: Chạy test để xác nhận pass**

Run: `npm test -- src/lib/stockCalc.test.ts`
Expected: PASS (tất cả case).

- [ ] **Step 6: Commit**

```bash
git add src/types/stock.ts src/lib/stockCalc.ts src/lib/stockCalc.test.ts
git commit -m "feat(stocks): types + logic thuần (tỷ suất, tỷ trọng, so mục tiêu) + test"
```

---

### Task 3: Lấy giá `stockPrice.ts` (TDD phần parse)

**Files:**
- Create: `src/lib/stockPrice.ts`
- Test: `src/lib/stockPrice.test.ts`

**Interfaces:**
- Consumes: (không có type nội bộ mới)
- Produces:
  - `parsePriceResponse(json: unknown): Record<string, number>` — chuẩn hóa response nguồn giá về map `ticker → giá (nghìn đồng)`. Tách riêng để test không cần mạng.
  - `fetchPrices(tickers: string[]): Promise<Record<string, number>>` — gọi nguồn CORS thật, ném lỗi rõ ràng khi hỏng.

> **Ghi chú CORS (rủi ro thật):** frontend gọi API giá VN thường bị chặn CORS và không có API miễn phí chính thức. `fetchPrices` phải **được kiểm chứng CORS thật khi chạy app** (Task 8). Nếu nguồn TCBS bị chặn hoặc đổi shape → hàm ném lỗi, trang hiện `ErrorBanner`, người dùng nhập tay. KHÔNG fallback im lặng.

- [ ] **Step 1: Viết test thất bại (chỉ test parse, không gọi mạng)**

Create `src/lib/stockPrice.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parsePriceResponse } from './stockPrice';

describe('parsePriceResponse', () => {
  it('chuẩn hóa mảng {ticker, price} về map ticker → giá (nghìn đồng)', () => {
    // TCBS trả giá theo nghìn đồng (VD ACB ~ 30.1). Giữ nguyên đơn vị nghìn đồng.
    const json = [
      { ticker: 'ACB', price: 30.1 },
      { ticker: 'FPT', price: 120.5 },
    ];
    expect(parsePriceResponse(json)).toEqual({ ACB: 30.1, FPT: 120.5 });
  });

  it('viết hoa ticker để khớp mã lưu trong DB', () => {
    expect(parsePriceResponse([{ ticker: 'acb', price: 30.1 }])).toEqual({ ACB: 30.1 });
  });

  it('bỏ qua phần tử thiếu ticker hoặc price không phải số', () => {
    const json = [
      { ticker: 'ACB', price: 30.1 },
      { ticker: 'BAD' }, // thiếu price
      { price: 10 }, // thiếu ticker
      { ticker: 'X', price: 'n/a' }, // price không hợp lệ
    ];
    expect(parsePriceResponse(json)).toEqual({ ACB: 30.1 });
  });

  it('ném lỗi rõ ràng khi response không phải mảng (nguồn đổi shape)', () => {
    expect(() => parsePriceResponse({ oops: true })).toThrow(/không đúng định dạng/i);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npm test -- src/lib/stockPrice.test.ts`
Expected: FAIL — "Cannot find module './stockPrice'".

- [ ] **Step 3: Viết implementation**

Create `src/lib/stockPrice.ts`:

```ts
// Lấy giá cổ phiếu VN gọi trực tiếp từ trình duyệt (Phase 1: không server tự viết).
// Nguồn ứng viên: TCBS (apipubaws.tcbs.com.vn) — endpoint công khai cộng đồng hay dùng.
// CORS là rủi ro thật: nếu bị chặn / đổi shape, các hàm ở đây NÉM LỖI rõ ràng để
// trang hiện ErrorBanner, KHÔNG nuốt lỗi. Người dùng vẫn nhập giá tay được.

/** Chuẩn hóa response nguồn giá về map ticker (viết hoa) → giá (nghìn đồng). */
export function parsePriceResponse(json: unknown): Record<string, number> {
  if (!Array.isArray(json)) {
    throw new Error('Dữ liệu giá không đúng định dạng (mong đợi một mảng).');
  }
  const out: Record<string, number> = {};
  for (const item of json) {
    if (item && typeof item === 'object') {
      const ticker = (item as Record<string, unknown>).ticker;
      const price = (item as Record<string, unknown>).price;
      if (typeof ticker === 'string' && typeof price === 'number' && Number.isFinite(price)) {
        out[ticker.toUpperCase()] = price;
      }
    }
  }
  return out;
}

/**
 * Lấy giá hiện tại cho danh sách mã. Trả map ticker → giá (nghìn đồng).
 * Ném lỗi rõ ràng khi mạng/CORS/nguồn đổi shape (không fallback im lặng).
 */
export async function fetchPrices(tickers: string[]): Promise<Record<string, number>> {
  const symbols = tickers.map((t) => t.trim().toUpperCase()).filter(Boolean);
  if (symbols.length === 0) return {};

  // TCBS: một request/mã. Gom song song. Nếu endpoint/shape đổi, việc parse sẽ ném lỗi.
  const results = await Promise.all(
    symbols.map(async (sym) => {
      const url = `https://apipubaws.tcbs.com.vn/stock-insight/v1/stock/second-tc-price?tickers=${sym}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Lỗi lấy giá ${sym}: HTTP ${res.status}`);
      }
      const body = await res.json();
      // TCBS bọc dữ liệu trong { data: [...] }. Tùy nguồn, có thể là mảng thẳng.
      const arr = Array.isArray(body) ? body : (body?.data ?? body);
      return parsePriceResponse(arr);
    }),
  );

  return Object.assign({}, ...results);
}
```

> **Lưu ý cho người triển khai:** shape thật của TCBS có thể khác `{ticker, price}` — Task 8 phải mở app, bấm "Cập nhật giá", xem console/network. Nếu shape khác, chỉnh `parsePriceResponse` (và cập nhật test tương ứng) hoặc đổi nguồn. Không được để lỗi bị nuốt.

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npm test -- src/lib/stockPrice.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stockPrice.ts src/lib/stockPrice.test.ts
git commit -m "feat(stocks): lấy giá + parse response có test (không nuốt lỗi CORS)"
```

---

### Task 4: Hook `useStocks`

**Files:**
- Create: `src/hooks/useStocks.ts`

**Interfaces:**
- Consumes: `Stock`, `NewStock`, `StockUpdate` từ `src/types/stock.ts` (Task 2); `supabase` từ `src/lib/supabaseClient`.
- Produces: `useStocks(userId: string): { stocks: Stock[]; loading: boolean; error: string | null; addStock(input: NewStock): Promise<void>; updateStock(id: string, patch: StockUpdate): Promise<void>; deleteStock(id: string): Promise<void>; clearError(): void }`. `stocks` đã sắp theo `group` rồi `sort_order`.

- [ ] **Step 1: Viết hook (sao khuôn `useGoals`)**

Create `src/hooks/useStocks.ts`:

```ts
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Stock, NewStock, StockUpdate, StockGroup } from '../types/stock';

interface UseStocks {
  stocks: Stock[];
  loading: boolean;
  error: string | null;
  addStock: (input: NewStock) => Promise<void>;
  updateStock: (id: string, patch: StockUpdate) => Promise<void>;
  deleteStock: (id: string) => Promise<void>;
  clearError: () => void;
}

// Thứ tự hiển thị các nhóm: Tấn công → Cân bằng → Phòng thủ.
const GROUP_ORDER: Record<StockGroup, number> = { attack: 0, balance: 1, defense: 2 };

function sortStocks(list: Stock[]): Stock[] {
  return [...list].sort((a, b) => {
    if (a.group !== b.group) return GROUP_ORDER[a.group] - GROUP_ORDER[b.group];
    return a.sort_order - b.sort_order;
  });
}

export function useStocks(userId: string): UseStocks {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tải lần đầu.
  useEffect(() => {
    let active = true;
    setLoading(true);
    supabase
      .from('stocks')
      .select('*')
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error('Lỗi tải cổ phiếu:', error);
          setError('Không tải được danh mục cổ phiếu: ' + error.message);
        } else {
          setStocks(sortStocks((data ?? []) as Stock[]));
        }
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  // Đồng bộ realtime: nghe thay đổi trên bảng stocks của user này.
  useEffect(() => {
    const channel = supabase
      .channel('stocks-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stocks', filter: `user_id=eq.${userId}` },
        (payload) => {
          setStocks((prev) => {
            if (payload.eventType === 'INSERT') {
              const row = payload.new as Stock;
              if (prev.some((s) => s.id === row.id)) return prev;
              return sortStocks([...prev, row]);
            }
            if (payload.eventType === 'UPDATE') {
              const row = payload.new as Stock;
              return sortStocks(prev.map((s) => (s.id === row.id ? row : s)));
            }
            if (payload.eventType === 'DELETE') {
              const old = payload.old as { id: string };
              return prev.filter((s) => s.id !== old.id);
            }
            return prev;
          });
        },
      )
      .subscribe((status, err) => {
        const s = String(status);
        if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') {
          console.error('Lỗi kênh đồng bộ realtime (stocks):', status, err);
          setError('Mất kết nối đồng bộ thời gian thực — hãy tải lại trang.');
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const addStock = useCallback(
    async (input: NewStock) => {
      const { error } = await supabase.from('stocks').insert({
        user_id: userId,
        ticker: input.ticker,
        company_name: input.company_name,
        group: input.group,
        price_threshold: input.price_threshold ?? null,
        price_protect: input.price_protect ?? null,
        current_price: input.current_price ?? null,
        dividend: input.dividend ?? null,
        invested_amount: input.invested_amount ?? null,
      });
      if (error) {
        console.error('Lỗi thêm cổ phiếu:', error);
        setError('Không thêm được cổ phiếu: ' + error.message);
      }
    },
    [userId],
  );

  const updateStock = useCallback(async (id: string, patch: StockUpdate) => {
    const { error } = await supabase.from('stocks').update(patch).eq('id', id);
    if (error) {
      console.error('Lỗi cập nhật cổ phiếu:', error);
      setError('Không cập nhật được cổ phiếu: ' + error.message);
    }
  }, []);

  const deleteStock = useCallback(async (id: string) => {
    const { error } = await supabase.from('stocks').delete().eq('id', id);
    if (error) {
      console.error('Lỗi xóa cổ phiếu:', error);
      setError('Không xóa được cổ phiếu: ' + error.message);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { stocks, loading, error, addStock, updateStock, deleteStock, clearError };
}
```

- [ ] **Step 2: Xác minh biên dịch**

Run: `npm run build`
Expected: PASS (không lỗi type). Nếu lỗi `group` là reserved trong insert → giữ nguyên (Supabase JS chấp nhận key `group` bình thường; chỉ SQL cần quote).

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useStocks.ts
git commit -m "feat(stocks): hook useStocks (tải + realtime + add/update/delete)"
```

---

### Task 5: `PortfolioSummary` — tổng vốn + tỷ trọng + so khẩu vị

**Files:**
- Create: `src/components/PortfolioSummary.tsx`

**Interfaces:**
- Consumes: `groupWeights`, `compareToTarget`, `TARGET_PROFILES` từ `stockCalc.ts` (Task 2); type `Stock`, `StockGroup`.
- Produces: `PortfolioSummary({ stocks, profile, onProfile })` với props `stocks: Stock[]`, `profile: StockGroup`, `onProfile: (p: StockGroup) => void`.

- [ ] **Step 1: Viết component**

Create `src/components/PortfolioSummary.tsx`:

```tsx
import type { Stock, StockGroup } from '../types/stock';
import { groupWeights, compareToTarget, TARGET_PROFILES } from '../lib/stockCalc';

const GROUP_META: Record<StockGroup, { label: string; bar: string }> = {
  attack: { label: 'Tấn công', bar: 'bg-red-500' },
  balance: { label: 'Cân bằng', bar: 'bg-green-500' },
  defense: { label: 'Phòng thủ', bar: 'bg-blue-500' },
};

const GROUPS: StockGroup[] = ['attack', 'balance', 'defense'];

const PROFILE_LABEL: Record<StockGroup, string> = {
  attack: 'Tấn công',
  balance: 'Cân bằng',
  defense: 'Phòng thủ',
};

/** Định dạng tiền VND (đơn vị đồng). */
function formatVnd(amount: number): string {
  return amount.toLocaleString('vi-VN') + ' đ';
}

interface Props {
  stocks: Stock[];
  profile: StockGroup;
  onProfile: (p: StockGroup) => void;
}

/** Tổng vốn đã đầu tư + 3 thanh tỷ trọng thực tế + so với khẩu vị rủi ro mục tiêu. */
export function PortfolioSummary({ stocks, profile, onProfile }: Props) {
  const weights = groupWeights(stocks);
  const diff = compareToTarget(weights, profile);
  const target = TARGET_PROFILES[profile];

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="text-[11px] font-bold tracking-[0.09em] text-text-muted dark:text-text-muted-dark">
            TỔNG VỐN ĐÃ ĐẦU TƯ
          </div>
          <div className="text-[22px] font-bold tracking-tight text-text dark:text-text-dark">
            {formatVnd(weights.total)}
          </div>
        </div>

        {/* Bộ chọn khẩu vị rủi ro */}
        <div className="flex gap-0.5 rounded-lg border border-border bg-surface-2 p-0.5 dark:border-border-dark dark:bg-surface-2dark">
          {GROUPS.map((g) => (
            <button
              key={g}
              onClick={() => onProfile(g)}
              aria-pressed={profile === g}
              className={`rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
                profile === g
                  ? 'bg-surface text-text shadow-sm dark:bg-surface-dark dark:text-text-dark'
                  : 'text-text-muted dark:text-text-muted-dark'
              }`}
            >
              {PROFILE_LABEL[g]}
            </button>
          ))}
        </div>
      </div>

      {/* 3 thanh tỷ trọng: thực tế (đậm) + mục tiêu (mờ) + chênh lệch */}
      <div className="flex flex-col gap-2.5">
        {GROUPS.map((g) => {
          const actual = weights.byGroup[g].percent;
          const d = diff[g];
          return (
            <div key={g} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between text-[13px]">
                <span className="font-medium text-text dark:text-text-dark">{GROUP_META[g].label}</span>
                <span className="text-text-muted dark:text-text-muted-dark">
                  {actual.toFixed(0)}% <span className="opacity-60">/ mục tiêu {target[g]}%</span>{' '}
                  <span className={d >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                    ({d >= 0 ? '+' : ''}
                    {d.toFixed(0)})
                  </span>
                </span>
              </div>
              {/* Rãnh chứa cả thanh mục tiêu (mờ) và thanh thực tế (đậm chồng lên) */}
              <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-surface-2 dark:bg-surface-2dark">
                <div
                  className={`absolute inset-y-0 left-0 rounded-full ${GROUP_META[g].bar} opacity-30`}
                  style={{ width: `${Math.min(target[g], 100)}%` }}
                />
                <div
                  className={`absolute inset-y-0 left-0 rounded-full ${GROUP_META[g].bar}`}
                  style={{ width: `${Math.min(actual, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Xác minh biên dịch**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/PortfolioSummary.tsx
git commit -m "feat(stocks): PortfolioSummary (tổng vốn + tỷ trọng + so khẩu vị)"
```

---

### Task 6: helper `parseNumber` + `StockForm` — thêm mã mới

**Files:**
- Create: `src/lib/parseNumber.ts`
- Create: `src/components/StockForm.tsx`

**Interfaces:**
- Consumes: `NewStock`, `StockGroup` từ types.
- Produces:
  - `parseVnNumber(v: string): number | null` — chuỗi rỗng → null; ngược lại parse số (chấp nhận dấu phẩy thập phân kiểu VN). Dùng chung bởi `StockForm` (Task 6) và `StockRow` (Task 7) — tránh lặp code.
  - `StockForm({ onAdd })` với `onAdd: (s: NewStock) => void`.

- [ ] **Step 1: Viết helper dùng chung**

Create `src/lib/parseNumber.ts`:

```ts
/** Chuỗi rỗng → null; ngược lại parse số (chấp nhận dấu phẩy thập phân kiểu VN). */
export function parseVnNumber(v: string): number | null {
  const t = v.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
```

- [ ] **Step 2: Viết component (theo khuôn `TodoForm`)**

Create `src/components/StockForm.tsx`:

```tsx
import { useState } from 'react';
import type { NewStock, StockGroup } from '../types/stock';
import { parseVnNumber } from '../lib/parseNumber';

const inputClass =
  'rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none transition-colors placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-border-dark dark:bg-surface-2dark dark:text-text-dark dark:placeholder:text-text-muted-dark dark:focus:border-primary-dark dark:focus:ring-primary-dark/30';

/** Form thêm mã cổ phiếu: mã, tên, nhóm, giá ngưỡng, giá bảo vệ, cổ tức, số tiền đầu tư. */
export function StockForm({ onAdd }: { onAdd: (s: NewStock) => void }) {
  const [ticker, setTicker] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [group, setGroup] = useState<StockGroup>('balance');
  const [priceThreshold, setPriceThreshold] = useState('');
  const [priceProtect, setPriceProtect] = useState('');
  const [dividend, setDividend] = useState('');
  const [invested, setInvested] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const tk = ticker.trim().toUpperCase();
    const name = companyName.trim();
    if (!tk || !name) return;
    onAdd({
      ticker: tk,
      company_name: name,
      group,
      price_threshold: parseVnNumber(priceThreshold),
      price_protect: parseVnNumber(priceProtect),
      dividend: parseVnNumber(dividend),
      invested_amount: parseVnNumber(invested),
    });
    setTicker('');
    setCompanyName('');
    setGroup('balance');
    setPriceThreshold('');
    setPriceProtect('');
    setDividend('');
    setInvested('');
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-3 dark:border-border-dark dark:bg-surface-dark"
    >
      <input
        value={ticker}
        onChange={(e) => setTicker(e.target.value)}
        placeholder="Mã (VD ACB)"
        aria-label="Mã cổ phiếu"
        className={`w-28 ${inputClass}`}
      />
      <input
        value={companyName}
        onChange={(e) => setCompanyName(e.target.value)}
        placeholder="Tên công ty"
        aria-label="Tên công ty"
        className={`min-w-[10rem] flex-1 ${inputClass}`}
      />
      <select
        value={group}
        onChange={(e) => setGroup(e.target.value as StockGroup)}
        aria-label="Nhóm rủi ro"
        className={inputClass}
      >
        <option value="attack">Tấn công</option>
        <option value="balance">Cân bằng</option>
        <option value="defense">Phòng thủ</option>
      </select>
      <input
        value={priceThreshold}
        onChange={(e) => setPriceThreshold(e.target.value)}
        placeholder="Giá ngưỡng (nghìn)"
        aria-label="Giá ngưỡng tích sản (nghìn đồng)"
        inputMode="decimal"
        className={`w-36 ${inputClass}`}
      />
      <input
        value={priceProtect}
        onChange={(e) => setPriceProtect(e.target.value)}
        placeholder="Giá bảo vệ (nghìn)"
        aria-label="Giá bảo vệ (nghìn đồng)"
        inputMode="decimal"
        className={`w-36 ${inputClass}`}
      />
      <input
        value={dividend}
        onChange={(e) => setDividend(e.target.value)}
        placeholder="Cổ tức (đồng)"
        aria-label="Cổ tức tiền/năm (đồng)"
        inputMode="numeric"
        className={`w-32 ${inputClass}`}
      />
      <input
        value={invested}
        onChange={(e) => setInvested(e.target.value)}
        placeholder="Số tiền đầu tư (đồng)"
        aria-label="Số tiền đã đầu tư (đồng)"
        inputMode="numeric"
        className={`w-40 ${inputClass}`}
      />
      <button className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:shadow-md active:scale-95 dark:bg-primary-dark dark:shadow-soft-dark dark:hover:shadow-md-dark">
        Thêm mã
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Xác minh biên dịch**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/parseNumber.ts src/components/StockForm.tsx
git commit -m "feat(stocks): parseVnNumber dùng chung + StockForm (thêm mã mới)"
```

---

### Task 7: `StockRow` + `StockTable`

**Files:**
- Create: `src/components/StockRow.tsx`
- Create: `src/components/StockTable.tsx`

**Interfaces:**
- Consumes: `Stock`, `StockUpdate`, `StockGroup`; `computeYield`, `isBelowThreshold` từ `stockCalc.ts`; `parseVnNumber` từ `parseNumber.ts` (Task 6).
- Produces:
  - `StockRow({ stock, onUpdate, onDelete })` — props `stock: Stock`, `onUpdate: (id, patch: StockUpdate) => void`, `onDelete: (id: string) => void`.
  - `StockTable({ stocks, onUpdate, onDelete })` — cùng props (trừ 1 stock → mảng), gom 3 nhóm.

- [ ] **Step 1: Viết `StockRow`**

Create `src/components/StockRow.tsx`:

```tsx
import { useState } from 'react';
import type { Stock, StockUpdate } from '../types/stock';
import { computeYield, isBelowThreshold } from '../lib/stockCalc';
import { parseVnNumber } from '../lib/parseNumber';

function fmt(n: number | null): string {
  return n == null ? '—' : n.toLocaleString('vi-VN');
}

interface Props {
  stock: Stock;
  onUpdate: (id: string, patch: StockUpdate) => void;
  onDelete: (id: string) => void;
}

/** Một dòng cổ phiếu: hiển thị hoặc sửa inline. Mã "chạm ngưỡng" tô đỏ. */
export function StockRow({ stock, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  // Bản nháp khi sửa (giữ dạng chuỗi để nhập được thoải mái).
  const [priceThreshold, setPriceThreshold] = useState('');
  const [priceProtect, setPriceProtect] = useState('');
  const [dividend, setDividend] = useState('');
  const [invested, setInvested] = useState('');

  function startEdit() {
    setPriceThreshold(stock.price_threshold?.toString() ?? '');
    setPriceProtect(stock.price_protect?.toString() ?? '');
    setDividend(stock.dividend?.toString() ?? '');
    setInvested(stock.invested_amount?.toString() ?? '');
    setEditing(true);
  }

  function save() {
    onUpdate(stock.id, {
      price_threshold: parseVnNumber(priceThreshold),
      price_protect: parseVnNumber(priceProtect),
      dividend: parseVnNumber(dividend),
      invested_amount: parseVnNumber(invested),
    });
    setEditing(false);
  }

  const yieldPct = computeYield(stock);
  const below = isBelowThreshold(stock);
  const cell = 'px-2 py-2 text-sm text-text dark:text-text-dark';
  const editInput =
    'w-24 rounded border border-border bg-surface px-1.5 py-1 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-2dark dark:text-text-dark';

  if (editing) {
    return (
      <tr className="border-t border-border dark:border-border-dark">
        <td className={`${cell} font-semibold`}>{stock.ticker}</td>
        <td className={cell}>{stock.company_name}</td>
        <td className={cell}>
          <input value={priceThreshold} onChange={(e) => setPriceThreshold(e.target.value)} className={editInput} aria-label="Giá ngưỡng" />
        </td>
        <td className={cell}>
          <input value={priceProtect} onChange={(e) => setPriceProtect(e.target.value)} className={editInput} aria-label="Giá bảo vệ" />
        </td>
        <td className={cell}>{fmt(stock.current_price)}</td>
        <td className={cell}>
          <input value={dividend} onChange={(e) => setDividend(e.target.value)} className={editInput} aria-label="Cổ tức" />
        </td>
        <td className={cell}>{yieldPct == null ? '—' : yieldPct.toFixed(1) + '%'}</td>
        <td className={cell}>
          <input value={invested} onChange={(e) => setInvested(e.target.value)} className={editInput} aria-label="Số tiền đầu tư" />
        </td>
        <td className={cell}>
          <button onClick={save} className="mr-2 font-semibold text-primary dark:text-primary-dark">Lưu</button>
          <button onClick={() => setEditing(false)} className="text-text-muted dark:text-text-muted-dark">Hủy</button>
        </td>
      </tr>
    );
  }

  return (
    <tr className={`border-t border-border dark:border-border-dark ${below ? 'bg-red-50 dark:bg-red-950/30' : ''}`}>
      <td className={`${cell} font-semibold ${below ? 'text-red-600 dark:text-red-400' : ''}`}>{stock.ticker}</td>
      <td className={cell}>{stock.company_name}</td>
      <td className={cell}>{fmt(stock.price_threshold)}</td>
      <td className={cell}>{fmt(stock.price_protect)}</td>
      <td className={`${cell} ${below ? 'font-semibold text-red-600 dark:text-red-400' : ''}`}>{fmt(stock.current_price)}</td>
      <td className={cell}>{fmt(stock.dividend)}</td>
      <td className={cell}>{yieldPct == null ? '—' : yieldPct.toFixed(1) + '%'}</td>
      <td className={cell}>{fmt(stock.invested_amount)}</td>
      <td className={cell}>
        <button onClick={startEdit} className="mr-2 text-text-muted hover:text-primary dark:text-text-muted-dark dark:hover:text-primary-dark" aria-label="Sửa">✎</button>
        <button onClick={() => onDelete(stock.id)} className="text-text-muted hover:text-red-500 dark:text-text-muted-dark" aria-label="Xóa">✕</button>
      </td>
    </tr>
  );
}
```

- [ ] **Step 2: Viết `StockTable`**

Create `src/components/StockTable.tsx`:

```tsx
import type { Stock, StockUpdate, StockGroup } from '../types/stock';
import { StockRow } from './StockRow';

const GROUP_META: Record<StockGroup, { label: string; head: string }> = {
  attack: { label: 'Tấn công (rủi ro cao)', head: 'text-red-600 dark:text-red-400' },
  balance: { label: 'Cân bằng (rủi ro trung bình)', head: 'text-green-600 dark:text-green-400' },
  defense: { label: 'Phòng thủ (rủi ro thấp)', head: 'text-blue-600 dark:text-blue-400' },
};

const GROUPS: StockGroup[] = ['attack', 'balance', 'defense'];

interface Props {
  stocks: Stock[];
  onUpdate: (id: string, patch: StockUpdate) => void;
  onDelete: (id: string) => void;
}

const th = 'px-2 py-2 text-left text-[11px] font-bold tracking-[0.06em] text-text-muted dark:text-text-muted-dark';

/** Bảng cổ phiếu gom theo 3 nhóm rủi ro, mỗi nhóm một khối có tiêu đề màu. */
export function StockTable({ stocks, onUpdate, onDelete }: Props) {
  return (
    <div className="flex flex-col gap-5">
      {GROUPS.map((g) => {
        const rows = stocks.filter((s) => s.group === g);
        if (rows.length === 0) return null;
        return (
          <section key={g} className="flex flex-col gap-1.5">
            <div className={`text-[12px] font-bold ${GROUP_META[g].head}`}>{GROUP_META[g].label}</div>
            <div className="overflow-x-auto rounded-xl border border-border dark:border-border-dark">
              <table className="w-full min-w-[760px] border-collapse">
                <thead>
                  <tr className="bg-surface-2 dark:bg-surface-2dark">
                    <th className={th}>Mã</th>
                    <th className={th}>Tên công ty</th>
                    <th className={th}>Giá ngưỡng</th>
                    <th className={th}>Giá bảo vệ</th>
                    <th className={th}>Giá hiện tại</th>
                    <th className={th}>Cổ tức</th>
                    <th className={th}>Tỷ suất</th>
                    <th className={th}>Đã đầu tư</th>
                    <th className={th}></th>
                  </tr>
                </thead>
                <tbody className="bg-surface dark:bg-surface-dark">
                  {rows.map((s) => (
                    <StockRow key={s.id} stock={s} onUpdate={onUpdate} onDelete={onDelete} />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Xác minh biên dịch**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/StockRow.tsx src/components/StockTable.tsx
git commit -m "feat(stocks): StockTable + StockRow (gom nhóm, sửa inline, chạm ngưỡng tô đỏ)"
```

---

### Task 8: `StocksPage` — gộp summary + cập nhật giá + form + table

**Files:**
- Create: `src/components/StocksPage.tsx`

**Interfaces:**
- Consumes: `useStocks` (Task 4); `PortfolioSummary` (Task 5); `StockForm` (Task 6); `StockTable` (Task 7); `fetchPrices` (Task 3); `ErrorBanner`; types.
- Produces: `StocksPage({ userId })` với `userId: string`. Tự quản state khẩu vị rủi ro và trạng thái "đang cập nhật giá".

- [ ] **Step 1: Viết component**

Create `src/components/StocksPage.tsx`:

```tsx
import { useState } from 'react';
import { useStocks } from '../hooks/useStocks';
import { fetchPrices } from '../lib/stockPrice';
import type { StockGroup } from '../types/stock';
import { PortfolioSummary } from './PortfolioSummary';
import { StockForm } from './StockForm';
import { StockTable } from './StockTable';
import { ErrorBanner } from './ErrorBanner';

interface Props {
  userId: string;
}

/** Trang Cổ phiếu: summary tỷ trọng + nút cập nhật giá + form thêm mã + bảng gom nhóm. */
export function StocksPage({ userId }: Props) {
  const { stocks, loading, error, addStock, updateStock, deleteStock, clearError } = useStocks(userId);
  const [profile, setProfile] = useState<StockGroup>('balance');
  const [priceError, setPriceError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  async function handleUpdatePrices() {
    setPriceError(null);
    const tickers = stocks.map((s) => s.ticker);
    if (tickers.length === 0) return;
    setUpdating(true);
    try {
      const prices = await fetchPrices(tickers);
      // Cập nhật current_price cho từng mã có giá trả về.
      await Promise.all(
        stocks
          .filter((s) => prices[s.ticker.toUpperCase()] != null)
          .map((s) => updateStock(s.id, { current_price: prices[s.ticker.toUpperCase()] })),
      );
    } catch (err) {
      // KHÔNG nuốt lỗi: log + hiện banner; người dùng vẫn nhập tay được.
      console.error('Lỗi cập nhật giá:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setPriceError('Không cập nhật được giá (có thể bị chặn CORS hoặc nguồn đổi). ' + msg);
    } finally {
      setUpdating(false);
    }
  }

  const removeStock = (id: string) => {
    if (confirm('Xóa mã này?')) deleteStock(id);
  };

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-auto p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[22px] font-bold tracking-tight text-text dark:text-text-dark">Cổ phiếu</div>
          <div className="mt-0.5 text-[13px] text-text-muted dark:text-text-muted-dark">
            {stocks.length} mã · giá theo nghìn đồng, số tiền theo đồng
          </div>
        </div>
        <button
          onClick={handleUpdatePrices}
          disabled={updating || stocks.length === 0}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:shadow-md active:scale-95 disabled:opacity-50 dark:bg-primary-dark dark:shadow-soft-dark"
        >
          {updating ? 'Đang cập nhật…' : 'Cập nhật giá'}
        </button>
      </div>

      {error && <ErrorBanner message={error} onClose={clearError} />}
      {priceError && <ErrorBanner message={priceError} onClose={() => setPriceError(null)} />}

      <PortfolioSummary stocks={stocks} profile={profile} onProfile={setProfile} />

      <StockForm onAdd={addStock} />

      {loading ? (
        <p className="py-8 text-center text-sm text-text-muted dark:text-text-muted-dark">Đang tải…</p>
      ) : stocks.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-text-muted dark:border-border-dark dark:text-text-muted-dark">
          Chưa có mã nào. Thêm mã đầu tiên ở form trên.
        </p>
      ) : (
        <StockTable stocks={stocks} onUpdate={updateStock} onDelete={removeStock} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Xác minh biên dịch**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/StocksPage.tsx
git commit -m "feat(stocks): StocksPage (summary + cập nhật giá + form + table)"
```

---

### Task 9: Điều hướng — Sidebar + AppPage

**Files:**
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/pages/AppPage.tsx`

**Interfaces:**
- Consumes: `StocksPage` (Task 8).
- Produces: kiểu `Page = 'todos' | 'plan' | 'stocks'` dùng chung ở Sidebar + AppPage; nút trang thứ 3 "Cổ phiếu".

- [ ] **Step 1: Mở rộng type `Page` trong Sidebar**

Modify `src/components/Sidebar.tsx` — đổi 2 dòng props (dòng 5-6):

```tsx
  page: 'todos' | 'plan' | 'stocks';
  onPage: (p: 'todos' | 'plan' | 'stocks') => void;
```

- [ ] **Step 2: Thêm nút "Cổ phiếu" vào cụm chuyển trang**

Modify `src/components/Sidebar.tsx` — trong khối `<div className="mb-2 flex gap-0.5 ...">` (sau nút "Kế hoạch", trước `</div>` đóng cụm), thêm:

```tsx
        <button
          onClick={() => onPage('stocks')}
          aria-pressed={page === 'stocks'}
          className={`flex-1 rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
            page === 'stocks'
              ? 'bg-surface text-text shadow-sm dark:bg-surface-dark dark:text-text-dark'
              : 'text-text-muted dark:text-text-muted-dark'
          }`}
        >
          Cổ phiếu
        </button>
```

- [ ] **Step 3: Mở rộng type `Page` + import `StocksPage` trong AppPage**

Modify `src/pages/AppPage.tsx`:

Dòng 24 đổi thành:

```tsx
type Page = 'todos' | 'plan' | 'stocks';
```

Thêm import (cạnh import `PlanPage` dòng 22):

```tsx
import { StocksPage } from '../components/StocksPage';
```

- [ ] **Step 4: Render `StocksPage` khi `page === 'stocks'`**

Modify `src/pages/AppPage.tsx` — khối render trong `<main>` hiện là `{page === 'plan' ? (...) : (...)}`. Đổi thành ưu tiên `stocks` trước, giữ nhánh `plan` và mặc định todos:

Thay dòng `{page === 'plan' ? (` bằng:

```tsx
        {page === 'stocks' ? (
          <StocksPage userId={userId} />
        ) : page === 'plan' ? (
```

(Phần còn lại của biểu thức 3 ngôi giữ nguyên: nhánh `plan` và nhánh `else` todos.)

- [ ] **Step 5: Xác minh biên dịch + test toàn bộ**

Run: `npm run build && npm test`
Expected: build PASS, tất cả test PASS.

- [ ] **Step 6: Kiểm chứng chạy thật (BẮT BUỘC — CORS là rủi ro thật)**

Run: `npm run dev`, mở trình duyệt:
1. Vào tab **Cổ phiếu** — thấy summary + form + bảng rỗng.
2. Thêm mã ACB (tên "Ngân hàng ACB", nhóm Cân bằng, giá ngưỡng 30.1, cổ tức 700, số tiền 10000000). Xác nhận dòng hiện ra, cột **Tỷ suất ≈ 2.3%**.
3. Thêm 2 mã khác nhóm khác, kiểm tra 3 thanh tỷ trọng + so khẩu vị đổi đúng.
4. Bấm **Cập nhật giá**, mở DevTools > Network/Console:
   - Nếu giá điền vào → CORS OK, kiểm tra mã có giá ≤ ngưỡng bị tô đỏ.
   - Nếu lỗi CORS/shape → phải thấy `ErrorBanner` rõ ràng (KHÔNG im lặng). Ghi lại shape thật của response; nếu khác `{ticker, price}` → chỉnh `parsePriceResponse` + test ở Task 3, hoặc báo lại để đổi nguồn.
5. Thử sửa inline một dòng và xóa một dòng (có `confirm`).

- [ ] **Step 7: Commit**

```bash
git add src/components/Sidebar.tsx src/pages/AppPage.tsx
git commit -m "feat(stocks): thêm trang Cổ phiếu vào điều hướng (Sidebar + AppPage)"
```

---

## Self-Review

**1. Spec coverage:**
- Mục 2 (bảng `stocks`, đơn vị, tỷ suất không lưu) → Task 1 + Task 2 ✓
- Mục 3 (types) → Task 2 ✓
- Mục 4 (`stockPrice.ts`, không nuốt lỗi CORS, test parse) → Task 3 + Task 8 Step 6 ✓
- Mục 5 (`stockCalc.ts`: computeYield, groupWeights + ca total=0, TARGET_PROFILES, compareToTarget, isBelowThreshold) → Task 2 ✓
- Mục 6 (`useStocks` sao khuôn useGoals) → Task 4 ✓
- Mục 7 điều hướng (Page + Sidebar nút 3) → Task 9 ✓
- Mục 7 PortfolioSummary (tổng vốn + 3 thanh + so khẩu vị) → Task 5 ✓
- Mục 7 StockTable/StockRow (gom nhóm, màu nhóm, chạm ngưỡng tô đỏ, cuộn ngang, dark mode) → Task 7 ✓
- Mục 7 StockForm + xóa có confirm → Task 6 + Task 8 (`confirm`) ✓
- Mục 7 nút "Cập nhật giá" (loading, ErrorBanner) → Task 8 ✓
- Mục 8 (test calc + parse, chạy npm test/build) → Task 2, 3, 9 ✓
- Mục 9 danh sách file → khớp đủ ✓

**2. Placeholder scan:** Không có TBD/TODO; mọi step có code hoặc lệnh cụ thể. ✓

**3. Type consistency:** `StockGroup`, `Stock`, `NewStock`, `StockUpdate` định nghĩa ở Task 2, dùng nhất quán ở Task 4-9. `groupWeights`/`compareToTarget`/`TARGET_PROFILES`/`computeYield`/`isBelowThreshold` tên khớp giữa Task 2 (định nghĩa) và Task 5/7 (dùng). `fetchPrices`/`parsePriceResponse` khớp Task 3 ↔ Task 8. `Page` mở rộng đồng bộ ở Sidebar + AppPage (Task 9). ✓

**Lưu ý còn treo (không chặn plan):** shape thật của TCBS chưa kiểm chứng — Task 8 Step 6 xử lý, có đường lùi rõ ràng (chỉnh parse/đổi nguồn/nhập tay), không nuốt lỗi.
