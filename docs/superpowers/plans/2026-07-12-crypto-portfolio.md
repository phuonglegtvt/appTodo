# Crypto Portfolio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm trang **Crypto** theo dõi danh mục tiền mã hóa với lời/lỗ (P&L), giá live từ Binance, hiển thị USD mặc định và chuyển được sang VND theo tỷ giá live.

**Architecture:** Tạo bộ file song song với trang Cổ phiếu đã có (`stocks`) — **không sửa** code stocks. Dữ liệu ở bảng Supabase `cryptos` (RLS + realtime). Giá lấy thẳng từ Binance trong browser; tỷ giá USD→VND từ open.er-api.com. Logic thuần (tính P&L, parse giá/tỷ giá, lọc, format tiền) tách ra `src/lib/` và test bằng Vitest. UI mô phỏng `StocksPage`.

**Tech Stack:** React + Vite + TypeScript, Tailwind CSS, Supabase (Postgres + Realtime + RLS), Vitest.

## Global Constraints

- TypeScript mọi nơi; **tránh `any`** (dùng `unknown` + thu hẹp kiểu, như `stockPrice.ts`).
- **KHÔNG nuốt lỗi im lặng:** mọi lỗi mạng/CORS/HTTP/Supabase → `console.error` + hiển thị `ErrorBanner`. Người dùng vẫn nhập giá tay được.
- Phase 1 **không server tự viết** — gọi API thẳng từ browser bằng `fetch`.
- Chỉ dùng Supabase `anon` key (đã cấu hình ở `src/lib/supabaseClient.ts`); bảo vệ bằng RLS theo `user_id`.
- Đơn vị lưu trong DB **luôn là USD**; quy đổi VND chỉ ở tầng hiển thị.
- Số nhập từ form/inline dùng `parseVnNumber` (chấp nhận dấu phẩy thập phân kiểu VN).
- Ngôn ngữ UI: tiếng Việt; thuật ngữ kỹ thuật giữ tiếng Anh.
- Style: class Tailwind, hỗ trợ dark mode qua `dark:` — copy đúng class từ component stocks tương ứng.
- Commit tiếng Việt theo quy ước repo: `feat(crypto): …`, `test(crypto): …`, `chore(crypto): …`.
- Xác minh cuối mỗi task: `npm test` và `npm run build` phải pass thật.

---

### Task 1: Types + Migration bảng `cryptos`

**Files:**
- Create: `src/types/crypto.ts`
- Create: `supabase/migrations/2026-07-12-cryptos.sql`

**Interfaces:**
- Consumes: (không có)
- Produces:
  - `interface Crypto { id: string; user_id: string; symbol: string; name: string; quantity: number | null; avg_buy_price: number | null; current_price: number | null; sort_order: number; created_at: string; updated_at: string }`
  - `interface NewCrypto { symbol: string; name?: string; quantity?: number | null; avg_buy_price?: number | null; current_price?: number | null }`
  - `type CryptoUpdate = Partial<Pick<Crypto, 'symbol' | 'name' | 'quantity' | 'avg_buy_price' | 'current_price' | 'sort_order'>>`
  - `type Currency = 'USD' | 'VND'`

- [ ] **Step 1: Tạo file types**

Tạo `src/types/crypto.ts`:

```ts
export type Currency = 'USD' | 'VND';

export interface Crypto {
  id: string;
  user_id: string;
  symbol: string;
  name: string;
  quantity: number | null;
  avg_buy_price: number | null;
  current_price: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** Dữ liệu để thêm một coin mới (giá hiện tại điền sau qua "Cập nhật giá"). */
export interface NewCrypto {
  symbol: string;
  name?: string;
  quantity?: number | null;
  avg_buy_price?: number | null;
  current_price?: number | null;
}

/** Các trường được phép sửa. */
export type CryptoUpdate = Partial<
  Pick<Crypto, 'symbol' | 'name' | 'quantity' | 'avg_buy_price' | 'current_price' | 'sort_order'>
>;
```

- [ ] **Step 2: Tạo migration SQL**

Tạo `supabase/migrations/2026-07-12-cryptos.sql` (y khuôn `2026-07-11-stocks.sql`, idempotent):

```sql
-- Migration: tạo bảng `cryptos` (danh mục tiền mã hóa) trên database thực tế.
-- Cùng khuôn với stocks/goals/todos: RLS theo user_id, realtime đa thiết bị, trigger updated_at.
-- Đơn vị lưu: quantity = số lượng coin; avg_buy_price, current_price = USD.
--
-- An toàn chạy lại nhiều lần (idempotent): "if not exists" / "drop ... if exists"
-- và bọc lệnh thêm publication trong khối kiểm tra để không lỗi khi đã thêm rồi.
-- CÁCH DÙNG: Supabase Dashboard → SQL Editor → dán file này → Run.

create table if not exists public.cryptos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  symbol text not null,
  name text not null default '',
  quantity numeric,
  avg_buy_price numeric,
  current_price numeric,
  sort_order numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Hàm set_updated_at() đã tạo cùng bảng todos; ở đây chỉ gắn trigger cho cryptos.
drop trigger if exists trg_cryptos_updated_at on public.cryptos;
create trigger trg_cryptos_updated_at
  before update on public.cryptos
  for each row execute function public.set_updated_at();

-- Bật Row Level Security: mỗi người chỉ thao tác coin của mình.
alter table public.cryptos enable row level security;

drop policy if exists "cryptos_select_own" on public.cryptos;
create policy "cryptos_select_own" on public.cryptos
  for select using (auth.uid() = user_id);

drop policy if exists "cryptos_insert_own" on public.cryptos;
create policy "cryptos_insert_own" on public.cryptos
  for insert with check (auth.uid() = user_id);

drop policy if exists "cryptos_update_own" on public.cryptos;
create policy "cryptos_update_own" on public.cryptos
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "cryptos_delete_own" on public.cryptos;
create policy "cryptos_delete_own" on public.cryptos
  for delete using (auth.uid() = user_id);

-- Bật Realtime cho cryptos (chỉ thêm nếu chưa có trong publication — tránh lỗi khi chạy lại).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'cryptos'
  ) then
    alter publication supabase_realtime add table public.cryptos;
  end if;
end $$;

-- REPLICA IDENTITY FULL: để sự kiện realtime DELETE/UPDATE mang đủ cột (gồm user_id).
alter table public.cryptos replica identity full;
```

- [ ] **Step 3: Xác minh biên dịch**

Run: `npx tsc --noEmit`
Expected: không lỗi (file types hợp lệ).

- [ ] **Step 4: Commit**

```bash
git add src/types/crypto.ts supabase/migrations/2026-07-12-cryptos.sql
git commit -m "feat(crypto): type Crypto + migration bảng cryptos (RLS + realtime)"
```

> **Lưu ý người dùng:** migration này phải **chạy tay** trên Supabase SQL Editor trước khi trang Crypto hoạt động thật. Nhắc NewPL sau khi merge.

---

### Task 2: Logic P&L thuần — `cryptoCalc.ts`

**Files:**
- Create: `src/lib/cryptoCalc.ts`
- Test: `src/lib/cryptoCalc.test.ts`

**Interfaces:**
- Consumes: `Crypto` từ `src/types/crypto.ts`
- Produces:
  - `cost(c): number | null`
  - `value(c): number | null`
  - `pnl(c): number | null`
  - `pnlPercent(c): number | null`
  - `interface PortfolioTotals { totalCost: number; totalValue: number; totalPnl: number; totalPnlPercent: number | null }`
  - `portfolioTotals(list: Crypto[]): PortfolioTotals`
  - `allocationPercent(c: Crypto, totalValue: number): number | null`

- [ ] **Step 1: Viết test thất bại**

Tạo `src/lib/cryptoCalc.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { cost, value, pnl, pnlPercent, portfolioTotals, allocationPercent } from './cryptoCalc';
import type { Crypto } from '../types/crypto';

/** Tạo một Crypto tối thiểu cho test (các cột không dùng để giá trị mặc định). */
function mk(partial: Partial<Crypto>): Crypto {
  return {
    id: 'x',
    user_id: 'u',
    symbol: 'BTC',
    name: '',
    quantity: null,
    avg_buy_price: null,
    current_price: null,
    sort_order: 0,
    created_at: '',
    updated_at: '',
    ...partial,
  };
}

describe('cost/value/pnl/pnlPercent', () => {
  it('đủ dữ liệu: tính vốn, giá trị, lời/lỗ, %', () => {
    const c = mk({ quantity: 2, avg_buy_price: 100, current_price: 150 });
    expect(cost(c)).toBe(200);
    expect(value(c)).toBe(300);
    expect(pnl(c)).toBe(100);
    expect(pnlPercent(c)).toBeCloseTo(50);
  });

  it('lỗ ra số âm', () => {
    const c = mk({ quantity: 1, avg_buy_price: 200, current_price: 150 });
    expect(pnl(c)).toBe(-50);
    expect(pnlPercent(c)).toBeCloseTo(-25);
  });

  it('thiếu current_price → value/pnl/pnlPercent null (cost vẫn tính)', () => {
    const c = mk({ quantity: 2, avg_buy_price: 100 });
    expect(cost(c)).toBe(200);
    expect(value(c)).toBeNull();
    expect(pnl(c)).toBeNull();
    expect(pnlPercent(c)).toBeNull();
  });

  it('thiếu quantity → tất cả null', () => {
    const c = mk({ avg_buy_price: 100, current_price: 150 });
    expect(cost(c)).toBeNull();
    expect(value(c)).toBeNull();
    expect(pnl(c)).toBeNull();
  });

  it('cost = 0 → pnlPercent null (tránh chia cho 0)', () => {
    const c = mk({ quantity: 5, avg_buy_price: 0, current_price: 10 });
    expect(cost(c)).toBe(0);
    expect(pnl(c)).toBe(50);
    expect(pnlPercent(c)).toBeNull();
  });
});

describe('portfolioTotals', () => {
  it('cộng dồn, bỏ qua coin thiếu dữ liệu', () => {
    const list = [
      mk({ quantity: 2, avg_buy_price: 100, current_price: 150 }), // cost 200, value 300
      mk({ quantity: 1, avg_buy_price: 50, current_price: 40 }),   // cost 50, value 40
      mk({ quantity: 3, avg_buy_price: 10 }),                       // cost 30, value bỏ qua
    ];
    const t = portfolioTotals(list);
    expect(t.totalCost).toBe(280);
    expect(t.totalValue).toBe(340);
    expect(t.totalPnl).toBe(60);
    expect(t.totalPnlPercent).toBeCloseTo((60 / 280) * 100);
  });

  it('danh mục rỗng → 0 và pnlPercent null', () => {
    const t = portfolioTotals([]);
    expect(t).toEqual({ totalCost: 0, totalValue: 0, totalPnl: 0, totalPnlPercent: null });
  });
});

describe('allocationPercent', () => {
  it('tỷ trọng theo giá trị hiện tại', () => {
    const c = mk({ quantity: 2, current_price: 150 }); // value 300
    expect(allocationPercent(c, 600)).toBeCloseTo(50);
  });
  it('thiếu value hoặc tổng 0 → null', () => {
    expect(allocationPercent(mk({ quantity: 2 }), 600)).toBeNull();
    expect(allocationPercent(mk({ quantity: 2, current_price: 150 }), 0)).toBeNull();
  });
});
```

- [ ] **Step 2: Chạy test — phải fail**

Run: `npm test -- src/lib/cryptoCalc.test.ts`
Expected: FAIL (`cryptoCalc` chưa tồn tại / hàm chưa định nghĩa).

- [ ] **Step 3: Viết implementation tối thiểu**

Tạo `src/lib/cryptoCalc.ts`:

```ts
import type { Crypto } from '../types/crypto';

/** Vốn = số lượng × giá mua TB (USD). Null nếu thiếu dữ liệu. */
export function cost(c: Pick<Crypto, 'quantity' | 'avg_buy_price'>): number | null {
  return c.quantity != null && c.avg_buy_price != null ? c.quantity * c.avg_buy_price : null;
}

/** Giá trị hiện tại = số lượng × giá hiện tại (USD). Null nếu thiếu dữ liệu. */
export function value(c: Pick<Crypto, 'quantity' | 'current_price'>): number | null {
  return c.quantity != null && c.current_price != null ? c.quantity * c.current_price : null;
}

/** Lời/lỗ = giá trị hiện tại − vốn (USD). Null nếu thiếu một trong hai. */
export function pnl(
  c: Pick<Crypto, 'quantity' | 'avg_buy_price' | 'current_price'>,
): number | null {
  const v = value(c);
  const co = cost(c);
  return v != null && co != null ? v - co : null;
}

/** % lời/lỗ = pnl / cost × 100. Null nếu thiếu dữ liệu hoặc cost ≤ 0 (tránh chia cho 0). */
export function pnlPercent(
  c: Pick<Crypto, 'quantity' | 'avg_buy_price' | 'current_price'>,
): number | null {
  const co = cost(c);
  const p = pnl(c);
  return co != null && co > 0 && p != null ? (p / co) * 100 : null;
}

export interface PortfolioTotals {
  totalCost: number;
  totalValue: number;
  totalPnl: number;
  totalPnlPercent: number | null;
}

/** Tổng danh mục theo USD; bỏ qua coin thiếu dữ liệu. */
export function portfolioTotals(list: Crypto[]): PortfolioTotals {
  let totalCost = 0;
  let totalValue = 0;
  for (const c of list) {
    const co = cost(c);
    if (co != null) totalCost += co;
    const v = value(c);
    if (v != null) totalValue += v;
  }
  const totalPnl = totalValue - totalCost;
  const totalPnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : null;
  return { totalCost, totalValue, totalPnl, totalPnlPercent };
}

/** Tỷ trọng coin theo giá trị hiện tại (%). Null nếu thiếu value hoặc tổng = 0. */
export function allocationPercent(c: Crypto, totalValue: number): number | null {
  const v = value(c);
  return v != null && totalValue > 0 ? (v / totalValue) * 100 : null;
}
```

- [ ] **Step 4: Chạy test — phải pass**

Run: `npm test -- src/lib/cryptoCalc.test.ts`
Expected: PASS (tất cả).

- [ ] **Step 5: Commit**

```bash
git add src/lib/cryptoCalc.ts src/lib/cryptoCalc.test.ts
git commit -m "feat(crypto): cryptoCalc — vốn/giá trị/lời-lỗ + tổng danh mục"
```

---

### Task 3: Lọc tìm kiếm — `cryptoFilters.ts`

**Files:**
- Create: `src/lib/cryptoFilters.ts`
- Test: `src/lib/cryptoFilters.test.ts`

**Interfaces:**
- Consumes: `Crypto`
- Produces: `filterCryptos(list: Crypto[], query: string): Crypto[]`

- [ ] **Step 1: Viết test thất bại**

Tạo `src/lib/cryptoFilters.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { filterCryptos } from './cryptoFilters';
import type { Crypto } from '../types/crypto';

function mk(symbol: string, name: string): Crypto {
  return {
    id: symbol, user_id: 'u', symbol, name,
    quantity: null, avg_buy_price: null, current_price: null,
    sort_order: 0, created_at: '', updated_at: '',
  };
}

const list = [mk('BTC', 'Bitcoin'), mk('ETH', 'Ethereum'), mk('BNB', 'Binance Coin')];

describe('filterCryptos', () => {
  it('query rỗng → trả nguyên danh sách', () => {
    expect(filterCryptos(list, '   ')).toHaveLength(3);
  });
  it('khớp theo mã, không phân biệt hoa/thường', () => {
    expect(filterCryptos(list, 'btc').map((c) => c.symbol)).toEqual(['BTC']);
  });
  it('khớp theo tên', () => {
    expect(filterCryptos(list, 'ethereum').map((c) => c.symbol)).toEqual(['ETH']);
  });
  it('khớp một phần trên cả mã lẫn tên', () => {
    expect(filterCryptos(list, 'bin').map((c) => c.symbol)).toEqual(['BNB']);
  });
});
```

- [ ] **Step 2: Chạy test — phải fail**

Run: `npm test -- src/lib/cryptoFilters.test.ts`
Expected: FAIL (`filterCryptos` chưa tồn tại).

- [ ] **Step 3: Viết implementation**

Tạo `src/lib/cryptoFilters.ts`:

```ts
import type { Crypto } from '../types/crypto';

/** Lọc coin có symbol HOẶC tên chứa từ khóa (không phân biệt hoa/thường). */
export function filterCryptos(cryptos: Crypto[], query: string): Crypto[] {
  const q = query.trim().toLowerCase();
  if (!q) return cryptos;
  return cryptos.filter(
    (c) => c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q),
  );
}
```

- [ ] **Step 4: Chạy test — phải pass**

Run: `npm test -- src/lib/cryptoFilters.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cryptoFilters.ts src/lib/cryptoFilters.test.ts
git commit -m "feat(crypto): filterCryptos — tìm theo mã/tên coin"
```

---

### Task 4: Nguồn giá Binance — `cryptoPrice.ts`

**Files:**
- Create: `src/lib/cryptoPrice.ts`
- Test: `src/lib/cryptoPrice.test.ts`

**Interfaces:**
- Consumes: (không có)
- Produces:
  - `parseTickerPrice(json: unknown): number` (ném lỗi khi shape sai)
  - `interface FetchCryptoPricesResult { prices: Record<string, number>; failed: { symbol: string; message: string }[] }`
  - `fetchCryptoPrices(symbols: string[]): Promise<FetchCryptoPricesResult>` — `prices` khóa theo symbol viết hoa (BTC), giá trị USD.

- [ ] **Step 1: Viết test thất bại**

Tạo `src/lib/cryptoPrice.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseTickerPrice, fetchCryptoPrices } from './cryptoPrice';

function okJson(json: unknown): Response {
  return { ok: true, status: 200, json: async () => json } as Response;
}

describe('parseTickerPrice', () => {
  it('lấy price dạng chuỗi (kiểu Binance) → số', () => {
    expect(parseTickerPrice({ symbol: 'BTCUSDT', price: '64832.10' })).toBeCloseTo(64832.1);
  });
  it('chấp nhận price dạng số', () => {
    expect(parseTickerPrice({ symbol: 'ETHUSDT', price: 3200 })).toBe(3200);
  });
  it('ném lỗi khi không phải object', () => {
    expect(() => parseTickerPrice('oops')).toThrow(/không đúng định dạng/i);
  });
  it('ném lỗi khi price không phải số hữu hạn', () => {
    expect(() => parseTickerPrice({ symbol: 'X', price: 'abc' })).toThrow(/không hợp lệ/i);
  });
});

describe('fetchCryptoPrices (Promise.allSettled)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('danh sách rỗng → không gọi mạng, trả kết quả rỗng', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchCryptoPrices([]);
    expect(result).toEqual({ prices: {}, failed: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ghép USDT + chuẩn hóa hoa; một coin lỗi không làm hỏng cả lần', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('symbol=BTCUSDT')) return okJson({ symbol: 'BTCUSDT', price: '64000' });
      if (url.includes('symbol=DOGEUSDT')) return { ok: false, status: 400 } as Response;
      throw new Error('không mong đợi');
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchCryptoPrices(['btc', 'doge']);
    expect(result.prices).toEqual({ BTC: 64000 });
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].symbol).toBe('DOGE');
    expect(result.failed[0].message).toMatch(/400/);
  });
});
```

- [ ] **Step 2: Chạy test — phải fail**

Run: `npm test -- src/lib/cryptoPrice.test.ts`
Expected: FAIL (`cryptoPrice` chưa tồn tại).

- [ ] **Step 3: Viết implementation**

Tạo `src/lib/cryptoPrice.ts`:

```ts
// Lấy giá crypto gọi trực tiếp từ trình duyệt (Phase 1: không server tự viết).
// Nguồn: Binance public ticker (api.binance.com/api/v3/ticker/price) — CORS mở, trả USDT (≈USD).
// CORS/HTTP lỗi → NÉM lỗi rõ để trang hiện ErrorBanner, KHÔNG nuốt. Người dùng vẫn nhập giá tay được.

/**
 * Trích giá (USD) từ một response ticker của Binance: { symbol, price }.
 * price có thể là chuỗi ("64832.10") hoặc số. Sai shape / không hữu hạn → NÉM lỗi.
 */
export function parseTickerPrice(json: unknown): number {
  if (!json || typeof json !== 'object') {
    throw new Error('Dữ liệu giá không đúng định dạng (mong đợi một đối tượng).');
  }
  const raw = (json as Record<string, unknown>).price;
  const n = typeof raw === 'string' || typeof raw === 'number' ? Number(raw) : NaN;
  if (!Number.isFinite(n)) {
    throw new Error('Nguồn giá trả giá không hợp lệ.');
  }
  return n;
}

/** Kết quả lấy giá: giá lấy được + danh sách coin lỗi (kèm lý do) để báo rõ, không nuốt. */
export interface FetchCryptoPricesResult {
  /** Map symbol (viết hoa, VD BTC) → giá USD. Chỉ chứa coin lấy được giá. */
  prices: Record<string, number>;
  /** Các coin lỗi (mã sai/mạng/CORS/HTTP/shape) kèm lý do. */
  failed: { symbol: string; message: string }[];
}

/** Lấy giá USD cho một coin: ghép symbol + 'USDT'. Ném lỗi rõ khi HTTP/CORS/shape lỗi. */
async function fetchOnePrice(symbol: string): Promise<number> {
  const url = `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}USDT`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const body: unknown = await res.json();
  return parseTickerPrice(body);
}

/**
 * Lấy giá hiện tại (USD) cho danh sách coin. Mỗi coin một request tới Binance, gom song song.
 * Dùng `Promise.allSettled`: một coin lỗi (VD mã không có trên Binance → HTTP 400) KHÔNG làm
 * hỏng cả lần — các coin còn lại vẫn cập nhật, coin lỗi gom vào `failed` để báo rõ (không nuốt).
 */
export async function fetchCryptoPrices(symbols: string[]): Promise<FetchCryptoPricesResult> {
  const syms = symbols.map((s) => s.trim().toUpperCase()).filter(Boolean);
  if (syms.length === 0) return { prices: {}, failed: [] };

  const settled = await Promise.allSettled(syms.map((s) => fetchOnePrice(s)));

  const prices: Record<string, number> = {};
  const failed: { symbol: string; message: string }[] = [];
  settled.forEach((result, i) => {
    const sym = syms[i];
    if (result.status === 'fulfilled') {
      prices[sym] = result.value;
    } else {
      const reason = result.reason;
      failed.push({ symbol: sym, message: reason instanceof Error ? reason.message : String(reason) });
    }
  });
  return { prices, failed };
}
```

- [ ] **Step 4: Chạy test — phải pass**

Run: `npm test -- src/lib/cryptoPrice.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cryptoPrice.ts src/lib/cryptoPrice.test.ts
git commit -m "feat(crypto): fetchCryptoPrices — giá Binance, 1 coin lỗi không hỏng cả lần"
```

---

### Task 5: Tỷ giá USD→VND — `fxRate.ts`

**Files:**
- Create: `src/lib/fxRate.ts`
- Test: `src/lib/fxRate.test.ts`

**Interfaces:**
- Consumes: (không có)
- Produces:
  - `parseUsdVndRate(json: unknown): number` (ném lỗi khi shape sai / thiếu VND)
  - `fetchUsdVndRate(): Promise<number>`

- [ ] **Step 1: Viết test thất bại**

Tạo `src/lib/fxRate.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseUsdVndRate, fetchUsdVndRate } from './fxRate';

function okJson(json: unknown): Response {
  return { ok: true, status: 200, json: async () => json } as Response;
}

describe('parseUsdVndRate', () => {
  it('result=success + rates.VND hợp lệ → trả tỷ giá', () => {
    expect(parseUsdVndRate({ result: 'success', rates: { VND: 26000, EUR: 0.9 } })).toBe(26000);
  });
  it('ném lỗi khi result != success', () => {
    expect(() => parseUsdVndRate({ result: 'error', rates: { VND: 26000 } })).toThrow(/trạng thái không hợp lệ/i);
  });
  it('ném lỗi khi thiếu VND', () => {
    expect(() => parseUsdVndRate({ result: 'success', rates: { EUR: 0.9 } })).toThrow(/VND/i);
  });
  it('ném lỗi khi không phải object', () => {
    expect(() => parseUsdVndRate(null)).toThrow(/không đúng định dạng/i);
  });
});

describe('fetchUsdVndRate', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetch OK → trả tỷ giá', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => okJson({ result: 'success', rates: { VND: 25500 } })));
    await expect(fetchUsdVndRate()).resolves.toBe(25500);
  });

  it('HTTP lỗi → ném lỗi kèm status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503 }) as Response));
    await expect(fetchUsdVndRate()).rejects.toThrow(/503/);
  });
});
```

- [ ] **Step 2: Chạy test — phải fail**

Run: `npm test -- src/lib/fxRate.test.ts`
Expected: FAIL (`fxRate` chưa tồn tại).

- [ ] **Step 3: Viết implementation**

Tạo `src/lib/fxRate.ts`:

```ts
// Lấy tỷ giá USD→VND gọi trực tiếp từ trình duyệt (Phase 1: không server tự viết).
// Nguồn: open.er-api.com (miễn phí, không cần key, CORS mở).
// Lỗi mạng/CORS/HTTP/shape → NÉM lỗi rõ để trang hiện ErrorBanner, KHÔNG nuốt.

/**
 * Trích tỷ giá VND từ response open.er-api.com: { result: 'success', rates: { VND: ... } }.
 * result != 'success' / thiếu VND / không dương → NÉM lỗi rõ.
 */
export function parseUsdVndRate(json: unknown): number {
  if (!json || typeof json !== 'object') {
    throw new Error('Dữ liệu tỷ giá không đúng định dạng (mong đợi một đối tượng).');
  }
  const obj = json as Record<string, unknown>;
  if (obj.result !== 'success') {
    throw new Error(`Nguồn tỷ giá trả trạng thái không hợp lệ: ${String(obj.result)}`);
  }
  const rates = obj.rates;
  const vnd =
    rates && typeof rates === 'object' ? (rates as Record<string, unknown>).VND : undefined;
  const n = typeof vnd === 'number' ? vnd : NaN;
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error('Nguồn tỷ giá thiếu VND hợp lệ.');
  }
  return n;
}

/** Lấy tỷ giá USD→VND. Ném lỗi rõ khi mạng/CORS/HTTP/shape lỗi. */
export async function fetchUsdVndRate(): Promise<number> {
  const res = await fetch('https://open.er-api.com/v6/latest/USD');
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const body: unknown = await res.json();
  return parseUsdVndRate(body);
}
```

- [ ] **Step 4: Chạy test — phải pass**

Run: `npm test -- src/lib/fxRate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/fxRate.ts src/lib/fxRate.test.ts
git commit -m "feat(crypto): fetchUsdVndRate — tỷ giá live open.er-api, không nuốt lỗi"
```

---

### Task 6: Định dạng tiền — `money.ts`

**Files:**
- Create: `src/lib/money.ts`
- Test: `src/lib/money.test.ts`

**Interfaces:**
- Consumes: `Currency` từ `src/types/crypto.ts`
- Produces: `formatMoney(usdAmount: number, currency: Currency, rate: number | null): string`

- [ ] **Step 1: Viết test thất bại**

Tạo `src/lib/money.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formatMoney } from './money';

describe('formatMoney', () => {
  it('USD → tiền tệ $ với tối đa 2 số lẻ', () => {
    expect(formatMoney(64832.1, 'USD', null)).toBe('$64,832.1');
    expect(formatMoney(1000, 'USD', 26000)).toBe('$1,000');
  });
  it('VND có tỷ giá → quy đổi, làm tròn, hậu tố đ (vi-VN dùng dấu . ngăn nghìn)', () => {
    expect(formatMoney(10, 'VND', 26000)).toBe('260.000 đ');
  });
  it('VND nhưng chưa có tỷ giá → fallback hiển thị USD', () => {
    expect(formatMoney(10, 'VND', null)).toBe('$10');
  });
  it('số 0', () => {
    expect(formatMoney(0, 'USD', null)).toBe('$0');
  });
});
```

- [ ] **Step 2: Chạy test — phải fail**

Run: `npm test -- src/lib/money.test.ts`
Expected: FAIL (`money` chưa tồn tại).

- [ ] **Step 3: Viết implementation**

Tạo `src/lib/money.ts`:

```ts
import type { Currency } from '../types/crypto';

/**
 * Định dạng số tiền (lưu theo USD) để hiển thị.
 * - VND + có tỷ giá: nhân tỷ giá, làm tròn, hậu tố " đ" (định dạng nhóm ngàn kiểu VN).
 * - USD, hoặc VND nhưng chưa có tỷ giá: hiển thị "$" (tối đa 2 số lẻ).
 */
export function formatMoney(usdAmount: number, currency: Currency, rate: number | null): string {
  if (currency === 'VND' && rate != null) {
    return Math.round(usdAmount * rate).toLocaleString('vi-VN') + ' đ';
  }
  return '$' + usdAmount.toLocaleString('en-US', { maximumFractionDigits: 2 });
}
```

- [ ] **Step 4: Chạy test — phải pass**

Run: `npm test -- src/lib/money.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/money.ts src/lib/money.test.ts
git commit -m "feat(crypto): formatMoney — hiển thị USD/VND theo tỷ giá"
```

---

### Task 7: Hook dữ liệu — `useCryptos.ts`

**Files:**
- Create: `src/hooks/useCryptos.ts`

**Interfaces:**
- Consumes: `supabase` từ `src/lib/supabaseClient.ts`; `Crypto, NewCrypto, CryptoUpdate` từ types.
- Produces:
  - `interface UseCryptos { cryptos: Crypto[]; loading: boolean; error: string | null; addCrypto: (input: NewCrypto) => Promise<void>; updateCrypto: (id: string, patch: CryptoUpdate) => Promise<void>; deleteCrypto: (id: string) => Promise<void>; clearError: () => void }`
  - `useCryptos(userId: string): UseCryptos`

- [ ] **Step 1: Viết hook (mô phỏng `useStocks.ts`)**

Tạo `src/hooks/useCryptos.ts`:

```ts
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Crypto, NewCrypto, CryptoUpdate } from '../types/crypto';

interface UseCryptos {
  cryptos: Crypto[];
  loading: boolean;
  error: string | null;
  addCrypto: (input: NewCrypto) => Promise<void>;
  updateCrypto: (id: string, patch: CryptoUpdate) => Promise<void>;
  deleteCrypto: (id: string) => Promise<void>;
  clearError: () => void;
}

function sortCryptos(list: Crypto[]): Crypto[] {
  return [...list].sort((a, b) => a.sort_order - b.sort_order);
}

export function useCryptos(userId: string): UseCryptos {
  const [cryptos, setCryptos] = useState<Crypto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tải lần đầu.
  useEffect(() => {
    let active = true;
    setLoading(true);
    supabase
      .from('cryptos')
      .select('*')
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error('Lỗi tải crypto:', error);
          setError('Không tải được danh mục crypto: ' + error.message);
        } else {
          setCryptos(sortCryptos((data ?? []) as Crypto[]));
        }
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  // Đồng bộ realtime: nghe thay đổi trên bảng cryptos của user này.
  useEffect(() => {
    const channel = supabase
      .channel('cryptos-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cryptos', filter: `user_id=eq.${userId}` },
        (payload) => {
          setCryptos((prev) => {
            if (payload.eventType === 'INSERT') {
              const row = payload.new as Crypto;
              if (prev.some((c) => c.id === row.id)) return prev;
              return sortCryptos([...prev, row]);
            }
            if (payload.eventType === 'UPDATE') {
              const row = payload.new as Crypto;
              return sortCryptos(prev.map((c) => (c.id === row.id ? row : c)));
            }
            if (payload.eventType === 'DELETE') {
              const old = payload.old as { id: string };
              return prev.filter((c) => c.id !== old.id);
            }
            return prev;
          });
        },
      )
      .subscribe((status, err) => {
        const s = String(status);
        if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') {
          console.error('Lỗi kênh đồng bộ realtime (cryptos):', status, err);
          setError('Mất kết nối đồng bộ thời gian thực — hãy tải lại trang.');
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const addCrypto = useCallback(
    async (input: NewCrypto) => {
      const { error } = await supabase.from('cryptos').insert({
        user_id: userId,
        symbol: input.symbol,
        name: input.name ?? '',
        quantity: input.quantity ?? null,
        avg_buy_price: input.avg_buy_price ?? null,
        current_price: input.current_price ?? null,
      });
      if (error) {
        console.error('Lỗi thêm crypto:', error);
        setError('Không thêm được coin: ' + error.message);
      }
    },
    [userId],
  );

  const updateCrypto = useCallback(async (id: string, patch: CryptoUpdate) => {
    const { error } = await supabase.from('cryptos').update(patch).eq('id', id);
    if (error) {
      console.error('Lỗi cập nhật crypto:', error);
      setError('Không cập nhật được coin: ' + error.message);
    }
  }, []);

  const deleteCrypto = useCallback(async (id: string) => {
    const { error } = await supabase.from('cryptos').delete().eq('id', id);
    if (error) {
      console.error('Lỗi xóa crypto:', error);
      setError('Không xóa được coin: ' + error.message);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { cryptos, loading, error, addCrypto, updateCrypto, deleteCrypto, clearError };
}
```

- [ ] **Step 2: Xác minh biên dịch**

Run: `npx tsc --noEmit`
Expected: không lỗi.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useCryptos.ts
git commit -m "feat(crypto): useCryptos — CRUD + realtime bảng cryptos"
```

---

### Task 8: Hook lựa chọn tiền tệ — `useCurrency.ts`

**Files:**
- Create: `src/hooks/useCurrency.ts`

**Interfaces:**
- Consumes: `fetchUsdVndRate` từ `src/lib/fxRate.ts`; `Currency` từ types.
- Produces:
  - `interface UseCurrency { currency: Currency; setCurrency: (c: Currency) => void; rate: number | null; refreshRate: () => Promise<void>; loadingRate: boolean; rateError: string | null; clearRateError: () => void }`
  - `useCurrency(): UseCurrency`

- [ ] **Step 1: Viết hook (mẫu localStorage như `useTheme.ts`)**

Tạo `src/hooks/useCurrency.ts`:

```ts
import { useCallback, useState } from 'react';
import { fetchUsdVndRate } from '../lib/fxRate';
import type { Currency } from '../types/crypto';

const CURRENCY_KEY = 'apptodo-currency';
const RATE_KEY = 'apptodo-usdvnd-rate';

interface UseCurrency {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  rate: number | null;
  refreshRate: () => Promise<void>;
  loadingRate: boolean;
  rateError: string | null;
  clearRateError: () => void;
}

function readInitialRate(): number | null {
  const raw = localStorage.getItem(RATE_KEY);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Nhớ lựa chọn tiền tệ + tỷ giá USD→VND gần nhất trong localStorage. Lấy tỷ giá live khi cần. */
export function useCurrency(): UseCurrency {
  const [currency, setCurrencyState] = useState<Currency>(() =>
    localStorage.getItem(CURRENCY_KEY) === 'VND' ? 'VND' : 'USD',
  );
  const [rate, setRate] = useState<number | null>(readInitialRate);
  const [loadingRate, setLoadingRate] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);

  const setCurrency = useCallback((c: Currency) => {
    setCurrencyState(c);
    localStorage.setItem(CURRENCY_KEY, c);
  }, []);

  const refreshRate = useCallback(async () => {
    setLoadingRate(true);
    setRateError(null);
    try {
      const r = await fetchUsdVndRate();
      setRate(r);
      localStorage.setItem(RATE_KEY, String(r));
    } catch (err) {
      // KHÔNG nuốt lỗi: log + set thông báo để trang hiện ErrorBanner.
      console.error('Lỗi lấy tỷ giá USD/VND:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setRateError('Không lấy được tỷ giá USD→VND: ' + msg + '. Tạm hiển thị USD.');
    } finally {
      setLoadingRate(false);
    }
  }, []);

  const clearRateError = useCallback(() => setRateError(null), []);

  return { currency, setCurrency, rate, refreshRate, loadingRate, rateError, clearRateError };
}
```

- [ ] **Step 2: Xác minh biên dịch**

Run: `npx tsc --noEmit`
Expected: không lỗi.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useCurrency.ts
git commit -m "feat(crypto): useCurrency — nhớ USD/VND + tỷ giá live (localStorage)"
```

---

### Task 9: Form thêm coin — `CryptoForm.tsx`

**Files:**
- Create: `src/components/CryptoForm.tsx`

**Interfaces:**
- Consumes: `NewCrypto` từ types; `parseVnNumber` từ `src/lib/parseNumber.ts`.
- Produces: `CryptoForm({ onAdd }: { onAdd: (c: NewCrypto) => void })`

- [ ] **Step 1: Viết component (mô phỏng `StockForm.tsx`)**

Tạo `src/components/CryptoForm.tsx`:

```tsx
import { useState } from 'react';
import type { NewCrypto } from '../types/crypto';
import { parseVnNumber } from '../lib/parseNumber';

const inputClass =
  'rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none transition-colors placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-border-dark dark:bg-surface-2dark dark:text-text-dark dark:placeholder:text-text-muted-dark dark:focus:border-primary-dark dark:focus:ring-primary-dark/30';

/** Form thêm coin: mã (bắt buộc), tên, số lượng, giá mua TB (USD). */
export function CryptoForm({ onAdd }: { onAdd: (c: NewCrypto) => void }) {
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [avgBuy, setAvgBuy] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const sym = symbol.trim().toUpperCase();
    if (!sym) return;
    onAdd({
      symbol: sym,
      name: name.trim(),
      quantity: parseVnNumber(quantity),
      avg_buy_price: parseVnNumber(avgBuy),
    });
    setSymbol('');
    setName('');
    setQuantity('');
    setAvgBuy('');
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-3 dark:border-border-dark dark:bg-surface-dark"
    >
      <input
        value={symbol}
        onChange={(e) => setSymbol(e.target.value)}
        placeholder="Mã (VD BTC)"
        aria-label="Mã coin"
        className={`w-28 ${inputClass}`}
      />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Tên (VD Bitcoin)"
        aria-label="Tên coin"
        className={`min-w-[10rem] flex-1 ${inputClass}`}
      />
      <input
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        placeholder="Số lượng"
        aria-label="Số lượng nắm giữ"
        inputMode="decimal"
        className={`w-32 ${inputClass}`}
      />
      <input
        value={avgBuy}
        onChange={(e) => setAvgBuy(e.target.value)}
        placeholder="Giá mua TB (USD)"
        aria-label="Giá mua trung bình (USD)"
        inputMode="decimal"
        className={`w-40 ${inputClass}`}
      />
      <button className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:shadow-md active:scale-95 dark:bg-primary-dark dark:shadow-soft-dark dark:hover:shadow-md-dark">
        Thêm coin
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Xác minh biên dịch**

Run: `npx tsc --noEmit`
Expected: không lỗi.

- [ ] **Step 3: Commit**

```bash
git add src/components/CryptoForm.tsx
git commit -m "feat(crypto): CryptoForm — thêm coin (mã/tên/số lượng/giá mua)"
```

---

### Task 10: Tổng danh mục — `CryptoSummary.tsx`

**Files:**
- Create: `src/components/CryptoSummary.tsx`

**Interfaces:**
- Consumes: `Crypto, Currency` từ types; `portfolioTotals, value, allocationPercent` từ `cryptoCalc`; `formatMoney` từ `money`.
- Produces: `CryptoSummary({ cryptos, currency, rate }: { cryptos: Crypto[]; currency: Currency; rate: number | null })`

- [ ] **Step 1: Viết component**

Tạo `src/components/CryptoSummary.tsx`:

```tsx
import type { Crypto, Currency } from '../types/crypto';
import { portfolioTotals, value, allocationPercent } from '../lib/cryptoCalc';
import { formatMoney } from '../lib/money';

/** Kẹp phần trăm về [0, 100] để phòng dữ liệu bất thường. */
function clampPercent(v: number): number {
  return Math.max(0, Math.min(v, 100));
}

interface Props {
  cryptos: Crypto[];
  currency: Currency;
  rate: number | null;
}

/** Tổng vốn / tổng giá trị / lời-lỗ (màu) + tỷ trọng mỗi coin theo giá trị. */
export function CryptoSummary({ cryptos, currency, rate }: Props) {
  const totals = portfolioTotals(cryptos);
  const gain = totals.totalPnl >= 0;
  const pnlColor = gain ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';

  // Coin có giá trị hiện tại, sắp theo tỷ trọng giảm dần (cho thanh tỷ trọng).
  const withValue = cryptos
    .map((c) => ({ c, v: value(c) }))
    .filter((x): x is { c: Crypto; v: number } => x.v != null)
    .sort((a, b) => b.v - a.v);

  const stat = (label: string, text: string, color = 'text-text dark:text-text-dark') => (
    <div>
      <div className="text-[11px] font-bold tracking-[0.09em] text-text-muted dark:text-text-muted-dark">
        {label}
      </div>
      <div className={`text-[22px] font-bold tracking-tight ${color}`}>{text}</div>
    </div>
  );

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
      <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3">
        {stat('TỔNG VỐN', formatMoney(totals.totalCost, currency, rate))}
        {stat('GIÁ TRỊ HIỆN TẠI', formatMoney(totals.totalValue, currency, rate))}
        {stat(
          'LỜI/LỖ',
          `${gain ? '+' : ''}${formatMoney(totals.totalPnl, currency, rate)}` +
            (totals.totalPnlPercent != null
              ? ` (${gain ? '+' : ''}${totals.totalPnlPercent.toFixed(1)}%)`
              : ''),
          pnlColor,
        )}
      </div>

      {withValue.length > 0 && (
        <div className="flex flex-col gap-2">
          {withValue.map(({ c, v }) => {
            const pct = allocationPercent(c, totals.totalValue) ?? 0;
            return (
              <div key={c.id} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between text-[13px]">
                  <span className="font-medium text-text dark:text-text-dark">{c.symbol}</span>
                  <span className="text-text-muted dark:text-text-muted-dark">
                    {pct.toFixed(0)}% · {formatMoney(v, currency, rate)}
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-2 dark:bg-surface-2dark">
                  <div
                    className="h-full rounded-full bg-primary dark:bg-primary-dark"
                    style={{ width: `${clampPercent(pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Xác minh biên dịch**

Run: `npx tsc --noEmit`
Expected: không lỗi.

- [ ] **Step 3: Commit**

```bash
git add src/components/CryptoSummary.tsx
git commit -m "feat(crypto): CryptoSummary — tổng vốn/giá trị/lời-lỗ + tỷ trọng"
```

---

### Task 11: Dòng + bảng coin — `CryptoRow.tsx`, `CryptoTable.tsx`

**Files:**
- Create: `src/components/CryptoRow.tsx`
- Create: `src/components/CryptoTable.tsx`

**Interfaces:**
- Consumes: `Crypto, CryptoUpdate, Currency` từ types; `value, pnl, pnlPercent` từ `cryptoCalc`; `formatMoney` từ `money`; `parseVnNumber` từ `parseNumber`.
- Produces:
  - `CryptoRow({ crypto, currency, rate, onUpdate, onDelete }: { crypto: Crypto; currency: Currency; rate: number | null; onUpdate: (id: string, patch: CryptoUpdate) => void; onDelete: (id: string) => void })`
  - `CryptoTable({ cryptos, currency, rate, onUpdate, onDelete }: { cryptos: Crypto[]; currency: Currency; rate: number | null; onUpdate: (id: string, patch: CryptoUpdate) => void; onDelete: (id: string) => void })`

- [ ] **Step 1: Viết `CryptoRow.tsx` (mô phỏng `StockRow.tsx`)**

Tạo `src/components/CryptoRow.tsx`:

```tsx
import { useState } from 'react';
import type { Crypto, CryptoUpdate, Currency } from '../types/crypto';
import { value, pnl, pnlPercent } from '../lib/cryptoCalc';
import { formatMoney } from '../lib/money';
import { parseVnNumber } from '../lib/parseNumber';

/** '—' nếu null, ngược lại định dạng tiền theo currency. */
function money(n: number | null, currency: Currency, rate: number | null): string {
  return n == null ? '—' : formatMoney(n, currency, rate);
}

interface Props {
  crypto: Crypto;
  currency: Currency;
  rate: number | null;
  onUpdate: (id: string, patch: CryptoUpdate) => void;
  onDelete: (id: string) => void;
}

/** Một dòng coin: hiển thị hoặc sửa inline (số lượng, giá mua TB). Lời xanh, lỗ đỏ. */
export function CryptoRow({ crypto, currency, rate, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [quantity, setQuantity] = useState('');
  const [avgBuy, setAvgBuy] = useState('');

  function startEdit() {
    setQuantity(crypto.quantity?.toString() ?? '');
    setAvgBuy(crypto.avg_buy_price?.toString() ?? '');
    setEditing(true);
  }

  function save() {
    onUpdate(crypto.id, {
      quantity: parseVnNumber(quantity),
      avg_buy_price: parseVnNumber(avgBuy),
    });
    setEditing(false);
  }

  const cell = 'px-2 py-2 text-sm text-text dark:text-text-dark';
  const editInput =
    'w-24 rounded border border-border bg-surface px-1.5 py-1 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-2dark dark:text-text-dark';

  if (editing) {
    return (
      <tr className="border-t border-border dark:border-border-dark">
        <td className={`${cell} font-semibold`}>{crypto.symbol}</td>
        <td className={cell}>{crypto.name || '—'}</td>
        <td className={cell}>
          <input value={quantity} onChange={(e) => setQuantity(e.target.value)} className={editInput} aria-label="Số lượng" />
        </td>
        <td className={cell}>
          <input value={avgBuy} onChange={(e) => setAvgBuy(e.target.value)} className={editInput} aria-label="Giá mua TB" />
        </td>
        <td className={cell}>{money(crypto.current_price, currency, rate)}</td>
        <td className={cell}>{money(value(crypto), currency, rate)}</td>
        <td className={cell}>—</td>
        <td className={cell}>
          <button onClick={save} className="mr-2 font-semibold text-primary dark:text-primary-dark">Lưu</button>
          <button onClick={() => setEditing(false)} className="text-text-muted dark:text-text-muted-dark">Hủy</button>
        </td>
      </tr>
    );
  }

  const p = pnl(crypto);
  const pPct = pnlPercent(crypto);
  const pnlColor =
    p == null ? '' : p >= 0 ? 'font-semibold text-green-600 dark:text-green-400' : 'font-semibold text-red-600 dark:text-red-400';
  const pnlText =
    p == null
      ? '—'
      : `${p >= 0 ? '+' : ''}${money(p, currency, rate)}` +
        (pPct != null ? ` (${p >= 0 ? '+' : ''}${pPct.toFixed(1)}%)` : '');

  return (
    <tr className="border-t border-border dark:border-border-dark">
      <td className={`${cell} font-semibold`}>{crypto.symbol}</td>
      <td className={cell}>{crypto.name || '—'}</td>
      <td className={cell}>{crypto.quantity ?? '—'}</td>
      <td className={cell}>{money(crypto.avg_buy_price, currency, rate)}</td>
      <td className={cell}>{money(crypto.current_price, currency, rate)}</td>
      <td className={cell}>{money(value(crypto), currency, rate)}</td>
      <td className={`${cell} ${pnlColor}`}>{pnlText}</td>
      <td className={cell}>
        <button onClick={startEdit} className="mr-2 text-text-muted hover:text-primary dark:text-text-muted-dark dark:hover:text-primary-dark" aria-label="Sửa">✎</button>
        <button onClick={() => onDelete(crypto.id)} className="text-text-muted hover:text-red-500 dark:text-text-muted-dark" aria-label="Xóa">✕</button>
      </td>
    </tr>
  );
}
```

- [ ] **Step 2: Viết `CryptoTable.tsx` (mô phỏng `StockTable.tsx`, không gom nhóm)**

Tạo `src/components/CryptoTable.tsx`:

```tsx
import type { Crypto, CryptoUpdate, Currency } from '../types/crypto';
import { CryptoRow } from './CryptoRow';

interface Props {
  cryptos: Crypto[];
  currency: Currency;
  rate: number | null;
  onUpdate: (id: string, patch: CryptoUpdate) => void;
  onDelete: (id: string) => void;
}

const th = 'px-2 py-2 text-left text-[11px] font-bold tracking-[0.06em] text-text-muted dark:text-text-muted-dark';

/** Bảng coin: mã, tên, số lượng, giá mua TB, giá hiện tại, giá trị, lời/lỗ. */
export function CryptoTable({ cryptos, currency, rate, onUpdate, onDelete }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-xl border border-border dark:border-border-dark">
        <table className="w-full min-w-[760px] border-collapse">
          <thead>
            <tr className="bg-surface-2 dark:bg-surface-2dark">
              <th className={th}>Mã</th>
              <th className={th}>Tên</th>
              <th className={th}>Số lượng</th>
              <th className={th}>Giá mua TB</th>
              <th className={th}>Giá hiện tại</th>
              <th className={th}>Giá trị</th>
              <th className={th}>Lời/Lỗ</th>
              <th className={th}></th>
            </tr>
          </thead>
          <tbody className="bg-surface dark:bg-surface-dark">
            {cryptos.map((c) => (
              <CryptoRow
                key={c.id}
                crypto={c}
                currency={currency}
                rate={rate}
                onUpdate={onUpdate}
                onDelete={onDelete}
              />
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-text-muted dark:text-text-muted-dark">
        <span className="font-semibold text-green-600 dark:text-green-400">Xanh</span> = lãi ·{' '}
        <span className="font-semibold text-red-600 dark:text-red-400">Đỏ</span> = lỗ
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Xác minh biên dịch**

Run: `npx tsc --noEmit`
Expected: không lỗi.

- [ ] **Step 4: Commit**

```bash
git add src/components/CryptoRow.tsx src/components/CryptoTable.tsx
git commit -m "feat(crypto): CryptoRow + CryptoTable — bảng coin, lời xanh lỗ đỏ, sửa inline"
```

---

### Task 12: Trang Crypto — `CryptoPage.tsx`

**Files:**
- Create: `src/components/CryptoPage.tsx`

**Interfaces:**
- Consumes: `useCryptos, useCurrency`; `fetchCryptoPrices`; `filterCryptos`; `CryptoSummary, CryptoForm, CryptoTable, ErrorBanner`.
- Produces: `CryptoPage({ userId }: { userId: string })`

- [ ] **Step 1: Viết trang (mô phỏng `StocksPage.tsx`)**

Tạo `src/components/CryptoPage.tsx`:

```tsx
import { useState } from 'react';
import { useCryptos } from '../hooks/useCryptos';
import { useCurrency } from '../hooks/useCurrency';
import { fetchCryptoPrices } from '../lib/cryptoPrice';
import { filterCryptos } from '../lib/cryptoFilters';
import type { Currency } from '../types/crypto';
import { CryptoSummary } from './CryptoSummary';
import { CryptoForm } from './CryptoForm';
import { CryptoTable } from './CryptoTable';
import { ErrorBanner } from './ErrorBanner';

interface Props {
  userId: string;
}

/** Trang Crypto: tổng danh mục + cập nhật giá Binance + chuyển USD/VND + form + bảng. */
export function CryptoPage({ userId }: Props) {
  const { cryptos, loading, error, addCrypto, updateCrypto, deleteCrypto, clearError } = useCryptos(userId);
  const { currency, setCurrency, rate, refreshRate, loadingRate, rateError, clearRateError } = useCurrency();
  const [priceError, setPriceError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [query, setQuery] = useState('');

  async function handleUpdatePrices() {
    setPriceError(null);
    const symbols = cryptos.map((c) => c.symbol);
    if (symbols.length === 0) return;
    setUpdating(true);
    try {
      const { prices, failed } = await fetchCryptoPrices(symbols);
      await Promise.all(
        cryptos
          .filter((c) => prices[c.symbol.toUpperCase()] != null)
          .map((c) => updateCrypto(c.id, { current_price: prices[c.symbol.toUpperCase()] })),
      );
      if (failed.length > 0) {
        const detail = failed.map((f) => `${f.symbol} (${f.message})`).join(', ');
        setPriceError(`Không lấy được giá ${failed.length} coin: ${detail}. Có thể nhập giá tay.`);
      }
    } catch (err) {
      console.error('Lỗi cập nhật giá crypto:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setPriceError('Không cập nhật được giá (có thể bị chặn CORS hoặc nguồn đổi). ' + msg);
    } finally {
      setUpdating(false);
    }
  }

  // Chuyển tiền tệ; khi bật VND mà chưa có tỷ giá thì lấy tỷ giá live ngay.
  async function handleCurrency(c: Currency) {
    setCurrency(c);
    if (c === 'VND' && rate == null) await refreshRate();
  }

  const removeCrypto = (id: string) => {
    if (confirm('Xóa coin này?')) deleteCrypto(id);
  };

  const visible = filterCryptos(cryptos, query);
  const currencyBtn = (c: Currency, label: string) => (
    <button
      onClick={() => handleCurrency(c)}
      aria-pressed={currency === c}
      className={`rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
        currency === c
          ? 'bg-surface text-text shadow-sm dark:bg-surface-dark dark:text-text-dark'
          : 'text-text-muted dark:text-text-muted-dark'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-auto p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[22px] font-bold tracking-tight text-text dark:text-text-dark">Crypto</div>
          <div className="mt-0.5 text-[13px] text-text-muted dark:text-text-muted-dark">
            {query.trim()
              ? `${visible.length}/${cryptos.length} coin khớp "${query.trim()}"`
              : `${cryptos.length} coin · giá gốc USD${
                  currency === 'VND' ? (rate != null ? ` · tỷ giá ${rate.toLocaleString('vi-VN')}đ/USD` : ' · chưa có tỷ giá') : ''
                }`}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5 rounded-lg border border-border bg-surface-2 p-0.5 dark:border-border-dark dark:bg-surface-2dark">
            {currencyBtn('USD', 'USD')}
            {currencyBtn('VND', loadingRate ? 'VND…' : 'VND')}
          </div>
          <button
            onClick={handleUpdatePrices}
            disabled={updating || cryptos.length === 0}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:shadow-md active:scale-95 disabled:opacity-50 dark:bg-primary-dark dark:shadow-soft-dark"
          >
            {updating ? 'Đang cập nhật…' : 'Cập nhật giá'}
          </button>
        </div>
      </div>

      {error && <ErrorBanner message={error} onClose={clearError} />}
      {priceError && <ErrorBanner message={priceError} onClose={() => setPriceError(null)} />}
      {rateError && <ErrorBanner message={rateError} onClose={clearRateError} />}

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Tìm theo mã hoặc tên coin…"
        aria-label="Tìm coin"
        className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none transition-colors placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-border-dark dark:bg-surface-2dark dark:text-text-dark dark:placeholder:text-text-muted-dark dark:focus:border-primary-dark"
      />

      <CryptoSummary cryptos={cryptos} currency={currency} rate={rate} />

      <CryptoForm onAdd={addCrypto} />

      {loading ? (
        <p className="py-8 text-center text-sm text-text-muted dark:text-text-muted-dark">Đang tải…</p>
      ) : cryptos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-text-muted dark:border-border-dark dark:text-text-muted-dark">
          Chưa có coin nào. Thêm coin đầu tiên ở form trên.
        </p>
      ) : visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-text-muted dark:border-border-dark dark:text-text-muted-dark">
          Không có coin nào khớp "{query.trim()}".
        </p>
      ) : (
        <CryptoTable cryptos={visible} currency={currency} rate={rate} onUpdate={updateCrypto} onDelete={removeCrypto} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Xác minh biên dịch**

Run: `npx tsc --noEmit`
Expected: không lỗi.

- [ ] **Step 3: Commit**

```bash
git add src/components/CryptoPage.tsx
git commit -m "feat(crypto): CryptoPage — cập nhật giá Binance + chuyển USD/VND"
```

---

### Task 13: Gắn vào điều hướng — `Sidebar.tsx`, `AppPage.tsx`

**Files:**
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/pages/AppPage.tsx`

**Interfaces:**
- Consumes: `CryptoPage` từ `src/components/CryptoPage.tsx`.
- Produces: union `page` mở rộng thành `'todos' | 'plan' | 'stocks' | 'crypto'` ở cả `Sidebar` và `AppPage`.

- [ ] **Step 1: Mở rộng type `page` trong `Sidebar.tsx`**

Trong `src/components/Sidebar.tsx`, sửa `interface Props` (2 dòng dùng union):

```tsx
  page: 'todos' | 'plan' | 'stocks' | 'crypto';
  onPage: (p: 'todos' | 'plan' | 'stocks' | 'crypto') => void;
```

- [ ] **Step 2: Thêm mục Crypto vào `PAGES`**

Trong `src/components/Sidebar.tsx`, thêm phần tử vào mảng `PAGES` (sau `stocks`):

```tsx
const PAGES: { key: Props['page']; label: string; icon: string }[] = [
  { key: 'todos', label: 'Việc', icon: '✓' },
  { key: 'plan', label: 'Kế hoạch', icon: '◎' },
  { key: 'stocks', label: 'Cổ phiếu', icon: '▤' },
  { key: 'crypto', label: 'Crypto', icon: '₿' },
];
```

- [ ] **Step 3: Mở rộng `Page` + import trong `AppPage.tsx`**

Trong `src/pages/AppPage.tsx`:

Thêm import cạnh import `StocksPage`:

```tsx
import { CryptoPage } from '../components/CryptoPage';
```

Sửa dòng khai báo type `Page`:

```tsx
type Page = 'todos' | 'plan' | 'stocks' | 'crypto';
```

- [ ] **Step 4: Render `CryptoPage` khi `page === 'crypto'`**

Trong `src/pages/AppPage.tsx`, đổi nhánh đầu của khối render trong `<main>` từ:

```tsx
        {page === 'stocks' ? (
          <StocksPage userId={userId} />
        ) : page === 'plan' ? (
```

thành:

```tsx
        {page === 'crypto' ? (
          <CryptoPage userId={userId} />
        ) : page === 'stocks' ? (
          <StocksPage userId={userId} />
        ) : page === 'plan' ? (
```

- [ ] **Step 5: Xác minh toàn bộ — test + build**

Run: `npm test`
Expected: PASS (tất cả test cũ + crypto mới).

Run: `npm run build`
Expected: build thành công, không lỗi TypeScript.

- [ ] **Step 6: Commit**

```bash
git add src/components/Sidebar.tsx src/pages/AppPage.tsx
git commit -m "feat(crypto): thêm trang Crypto vào điều hướng (Sidebar + AppPage)"
```

---

## Ghi chú vận hành sau khi hoàn tất

- **Migration:** nhắc NewPL chạy `supabase/migrations/2026-07-12-cryptos.sql` trên Supabase SQL Editor — trước đó trang Crypto sẽ báo lỗi tải (đúng tinh thần không nuốt lỗi).
- **Rủi ro thật cần kiểm chứng khi chạy dev:**
  - CORS của `api.binance.com` và `open.er-api.com` từ domain deploy (Netlify) — nếu bị chặn, ErrorBanner sẽ hiện; người dùng vẫn nhập giá tay được.
  - Binance có thể chặn theo vùng địa lý; nếu 451/403, thông báo lỗi rõ.
- **Kiểm thử thủ công gợi ý:** thêm BTC/ETH/BNB, bấm "Cập nhật giá", nhập số lượng + giá mua, xác nhận lời/lỗ đổi màu; chuyển USD↔VND xem quy đổi; thử coin sai mã (VD "ZZZ") xem báo lỗi coin đó mà không hỏng các coin khác.

## Self-review (đã rà)

- **Spec coverage:** mục 3→11 của spec đều có task tương ứng (types+migration T1; calc T2; filters T3; price T4; fx T5; money T6; useCryptos T7; useCurrency T8; UI T9–T12; nav T13; test rải theo từng lib). ✅
- **Placeholder:** không có TBD/TODO; mọi step có code/command thật. ✅
- **Type consistency:** `Crypto/NewCrypto/CryptoUpdate/Currency` (T1) dùng nhất quán ở mọi task; `FetchCryptoPricesResult.failed[].symbol` khớp cách đọc ở CryptoPage; `formatMoney(usd, currency, rate)` cùng chữ ký ở money/summary/row. ✅
