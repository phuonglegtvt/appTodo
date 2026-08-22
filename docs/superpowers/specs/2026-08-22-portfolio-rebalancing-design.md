# Thiết kế — Portfolio Rebalancing (Cân bằng danh mục đầu tư)

> **Ngày:** 2026-08-22 · **Trạng thái:** đã chốt, chờ chuyển sang implementation plan
> **Nhà:** module mới trong repo `appTodo` (tab `portfolio`), KHÔNG phải app riêng
> **Nguồn yêu cầu:** spec "Personal Investment Portfolio Rebalancing Dashboard" (25 mục)
>
> **Ký hiệu:** `§n` = mục thứ n của **spec gốc**. `mục n` = mục thứ n của **tài liệu này**.

---

## 0. Bảy quyết định nền tảng

| # | Quyết định | Vì sao |
|---|---|---|
| 1 | Module mới **trong appTodo**, không phải app riêng | ~40% hạ tầng (auth, price provider, FX, theme, deploy, design token) đã có và đã có test. Và NewPL mở appTodo hàng ngày — kế hoạch tháng nằm trong app không ai mở thì vô giá trị. |
| 2 | Stack: **React + Vite + Supabase + Cloudflare** (đúng repo hiện tại) | Không migrate framework. Bỏ Next.js / NestJS / TypeORM / Docker của §22 — không cần cho app 1 người dùng. |
| 3 | Schema Postgres riêng: **`portfolio`** | Tách hẳn khỏi `public` (todos/goals/stocks/cryptos). Bảng cũ không bị đụng. |
| 4 | **Domain layer thuần TypeScript**, 0 dependency | Toán tiền phải test được không cần mock / DB / mạng. Đây là ràng buộc cứng, không phải sở thích. |
| 5 | **Dual-weight**: tính tỷ trọng theo cả `earmarked` và `deployed` | Giải quyết 465tr "staged for DCA" của §3 mà không báo động giả suốt 1–2 năm đầu. |
| 6 | Action Center **2 tầng**: asset class + gợi ý mã cụ thể | Tận dụng `public.stocks.price_threshold` sẵn có (kỷ luật "chỉ mua khi dưới ngưỡng"). |
| 7 | Scope v1 = **P0 + 3 mảnh P1 bắt buộc** (drawdown, dividend, CSV) | §25 xếp Crash Reserve vào P0 nhưng Drawdown vào P1, trong khi P0 phụ thuộc P1 → phải gộp. |

**Hoãn sang v2:** TWR / MWR / XIRR, biểu đồ hiệu suất theo thời gian, push notification, mapper CSV theo định dạng broker, provider giá vàng tự động.

---

## 1. Kiến trúc

```
Browser (React + Vite, repo appTodo)
  │
  ├─ supabase-js ──→ Supabase Postgres  ── schema portfolio, RLS theo user_id
  │
  └─ fetch trực tiếp từ browser (CORS đã kiểm chứng trong appTodo)
        ├─ dchart-api.vndirect.com.vn   giá + lịch sử cổ phiếu VN, VNINDEX
        ├─ api.binance.com              giá crypto (USDT)
        ├─ api.coingecko.com            dự phòng cho coin không có trên Binance
        ├─ open.er-api.com              tỷ giá USD→VND
        └─ giá vàng: NHẬP TAY (§16) — v1 không có provider tự động

Deploy: npm run build → wrangler (đã cấu hình sẵn)
```

Không thêm: Docker, backend tự viết, Supabase Edge Function, project Supabase mới, pipeline CI mới.

### 1.1 Phân tầng (mỗi tầng một trách nhiệm, phụ thuộc chỉ đi xuống)

```
components/portfolio/   React, chỉ render + gọi hook
hooks/                  state + gọi data & providers
data/                   CRUD Supabase THUẦN — không có một dòng logic nghiệp vụ
providers/              PriceProvider §15 + ManualProvider §16 — nơi duy nhất quy đổi đơn vị
domain/                 ⭐ hàm thuần. import: KHÔNG GÌ CẢ.
```

`domain/` không được import `supabase`, `react`, `fetch`, và **không được gọi `Date.now()`** — thời điểm luôn truyền vào qua `snapshot.asOf`. Nhờ vậy tháng 12 vẫn tính lại đúng kế hoạch tháng 8.

### 1.2 Hai bước cấu hình thủ công (một lần, vì dùng schema ngoài `public`)

1. Supabase Dashboard → Settings → API → **Exposed schemas** → thêm `portfolio`
2. Chạy `grant usage on schema portfolio to anon, authenticated;` (đã nằm trong migration)

Client truy cập: `supabase.schema('portfolio').from('transactions')`

---

## 2. Quy tắc đơn vị (chỗ dễ sinh bug tiền nhất)

Bảng cũ **trộn đơn vị**: `public.stocks.price_threshold` = *nghìn đồng*, `public.stocks.dividend` = *đồng*, `public.cryptos.*` = *USD*.

> **Quy tắc cứng:** mọi cột tiền trong schema `portfolio` lưu bằng **VND (đồng)**, không ngoại lệ.
> Quy đổi chỉ được xảy ra trong `providers/` — đúng một tầng biên, có unit test riêng cho phép quy đổi.

- `stockPrice.ts` trả nghìn đồng → `× 1000`
- `cryptoPrice.ts` trả USD → `× fx_rate`
- `prices` lưu **cả hai**: `price_vnd` (dùng để tính) và `price_original` + `currency` (để truy vết)

Số lượng dùng `numeric` không giới hạn precision — crypto cần 8+ chữ số thập phân.

---

## 3. Database

### 3.1 Ánh xạ 13 entity của §13 → 11 bảng + 3 view

| §13 | Hiện thực | Ghi chú |
|---|---|---|
| Portfolio | *(không cần)* | 1 user = 1 danh mục |
| AssetClass | `enum portfolio.asset_class` | 4 giá trị cố định → enum, không join |
| Instrument | `instruments` | |
| **Holding** | **view `v_positions`** | §14 cấm ghi đè ⇒ vị thế phải SUY RA từ transactions |
| Transaction | `transactions` | bất biến |
| Price | `prices` | |
| Dividend | gộp → `transactions` type=`DIVIDEND` | |
| CashFlow | gộp → `transactions` `DEPOSIT`/`WITHDRAWAL` | |
| AllocationTarget | `allocation_targets` | gồm min/max band §2 |
| RebalanceRule | gộp → `settings` | 3 tham số, không xứng một bảng |
| MonthlyContribution | gộp → `settings.monthly_contribution_vnd` | "tháng này đã nộp chưa" suy từ transactions |
| CrashReserve | `crash_reserve_levels` + `crash_reserve_events` | levels = cấu hình; events = bậc đã dùng |
| Benchmark | `benchmarks` + `benchmark_prices` | |
| *(thêm)* | `snapshots` | §9 high-water mark của danh mục |
| *(thêm)* | `action_plans` | lưu kế hoạch từng tháng để đối chiếu về sau |

### 3.2 Ba quyết định thiết kế cốt lõi

#### ① `earmarked_for` — một cột giải quyết trọn bài toán DCA

DCA Pending **không phải bảng mới** — nó là các *túi tiền* trong `instruments`:

| symbol | asset_class | earmarked_for | Ý nghĩa |
|---|---|---|---|
| `VND-RESERVE` | CASH | `NULL` | Cash thật 15%, chứa Crash Reserve |
| `VND-DCA-STOCKS` | CASH | `STOCKS` | tiền đã đặt tên cho Stocks, chưa giải ngân |
| `VND-DCA-CRYPTO` | CASH | `CRYPTO` | |
| `VND-DCA-GOLD` | CASH | `GOLD` | |

Hai con số ra từ **cùng một dữ liệu**, chỉ khác `group by`:

```
weight DEPLOYED  (đã giải ngân thật)  →  group by asset_class
weight EARMARKED (đã phân bổ)         →  group by coalesce(earmarked_for, asset_class)
```

- `EARMARKED` → dùng để **cảnh báo band §7 và sinh kế hoạch** (không báo động giả)
- `DEPLOYED` → dùng để **theo dõi tiến độ DCA** ("còn 465tr chưa xuống tiền")

Khi mua FPT bằng tiền từ `VND-DCA-STOCKS`, túi pending **tự động giảm**. Không cần bảng lịch DCA, không cần đồng bộ tay. Cơ chế **dồn tiền (carryover)** khi chưa mua nổi 1 lô cũng miễn phí: tiền cứ nằm lại trong túi.

#### ② `transactions` bất biến + `cash_instrument_id` cho hai chân bút toán

`amount_vnd` **luôn là số dương** (độ lớn). Dấu (+/−) do view suy ra từ `type` — dấu chỉ tồn tại ở **một chỗ duy nhất**, loại bỏ hẳn lỗi lệch quy ước dấu.

Một dòng `BUY FPT` với `cash_instrument_id = VND-DCA-STOCKS` sinh **2 chân**: `+100 FPT` và `−10.000.000` ở túi tiền. UX chỉ một form, sổ vẫn cân như kế toán kép.

**Không có policy UPDATE** → không sửa được bản ghi (§14). Ghi sai thì ghi một dòng `ADJUSTMENT` bù.

**Ngoại lệ có chủ đích:** cho phép DELETE trong **24 giờ** đầu kể từ `created_at`. Lý do: một lỗi bấm sai lúc nhập không nên trở thành một dòng rác + một dòng điều chỉnh tồn tại vĩnh viễn. Sau 24h thì lịch sử bất biến tuyệt đối.

#### ③ Ba view — nơi duy nhất biết "đang sở hữu gì"

```
v_legs        tách mỗi transaction thành các chân (UNION ALL 3 nhánh)
v_positions   group theo instrument → quantity, cost_basis_vnd, cash_balance_vnd
v_allocation  join giá mới nhất → market_value_vnd + earmarked_for
```

> ⚠️ **Bắt buộc** `with (security_invoker = true)` trên cả 3 view.
> Thiếu nó, view chạy bằng quyền owner và **RLS bị vô hiệu hoàn toàn** — lỗi bảo mật im lặng, không có triệu chứng.

### 3.3 DDL — `supabase/migrations/2026-08-22-portfolio-core.sql`

Chạy lại nhiều lần được (idempotent), theo đúng khuôn các migration hiện có của repo.

```sql
create schema if not exists portfolio;
grant usage on schema portfolio to anon, authenticated;

do $$ begin create type portfolio.asset_class as enum
  ('STOCKS','CRYPTO','GOLD','CASH');
exception when duplicate_object then null; end $$;

do $$ begin create type portfolio.currency as enum ('VND','USD','USDT');
exception when duplicate_object then null; end $$;

do $$ begin create type portfolio.tx_type as enum
  ('BUY','SELL','DIVIDEND','INTEREST','DEPOSIT','WITHDRAWAL','TRANSFER','FEE','ADJUSTMENT');
exception when duplicate_object then null; end $$;

-- ---------- instruments ----------
create table if not exists portfolio.instruments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_class portfolio.asset_class not null,
  symbol text not null,                       -- FPT | BTC | SJC-1L | VND-DCA-STOCKS
  name text not null default '',
  currency portfolio.currency not null default 'VND',
  price_source text not null default 'MANUAL',    -- VNDIRECT|BINANCE|COINGECKO|MANUAL
  earmarked_for portfolio.asset_class,             -- chỉ cho túi CASH
  lot_size integer not null default 1,             -- HOSE/HNX = 100, crypto = 1
  watchlist_stock_id uuid references public.stocks(id) on delete set null,
  is_active boolean not null default true,
  sort_order numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, symbol),
  constraint earmark_chi_cho_cash
    check (earmarked_for is null or asset_class = 'CASH')
);

-- ---------- transactions (BẤT BIẾN) ----------
create table if not exists portfolio.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  traded_at date not null,
  type portfolio.tx_type not null,
  instrument_id      uuid not null references portfolio.instruments(id),
  cash_instrument_id uuid          references portfolio.instruments(id),
  quantity numeric,
  price    numeric,                              -- 1 đơn vị, theo `currency`
  currency portfolio.currency not null default 'VND',
  fx_rate  numeric not null default 1,           -- → VND, ĐÓNG BĂNG theo ngày giao dịch
  fee      numeric not null default 0,
  amount_vnd numeric not null check (amount_vnd >= 0),   -- §14 Total value, LUÔN DƯƠNG
  note text,
  created_at timestamptz not null default now(),
  -- KHÔNG có updated_at: bản ghi bất biến
  constraint buy_sell_du_truong
    check (type not in ('BUY','SELL')
           or (quantity is not null and price is not null
               and cash_instrument_id is not null))
);
create index if not exists idx_tx_user_date
  on portfolio.transactions (user_id, traded_at desc);

-- ---------- prices ----------
create table if not exists portfolio.prices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instrument_id uuid not null references portfolio.instruments(id) on delete cascade,
  as_of date not null,
  price_vnd numeric not null,                    -- đã quy đổi, dùng để tính
  price_original numeric,                        -- giá gốc để truy vết
  currency portfolio.currency not null default 'VND',
  fx_rate numeric not null default 1,
  source text not null default 'MANUAL',
  created_at timestamptz not null default now(),
  unique (user_id, instrument_id, as_of)
);

-- ---------- allocation_targets (§2) ----------
create table if not exists portfolio.allocation_targets (
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_class portfolio.asset_class not null,
  target_pct numeric not null,
  min_pct numeric not null,
  max_pct numeric not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, asset_class),
  constraint band_hop_le check (min_pct <= target_pct and target_pct <= max_pct)
);

-- ---------- settings ----------
create table if not exists portfolio.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  monthly_contribution_vnd numeric not null default 3000000,   -- Z §4
  base_currency portfolio.currency not null default 'VND',
  manual_usd_vnd numeric,                        -- §16 fallback tỷ giá
  watch_deviation_pp    numeric not null default 3,   -- ngưỡng WATCH §7
  strong_rebalance_pp   numeric not null default 5,   -- ngưỡng cho phép BÁN §7
  min_sell_amount_vnd   numeric not null default 5000000,  -- §18 không bán vụn
  rounding_step_vnd     numeric not null default 100000,
  allocation_formula text not null default 'PROPORTIONAL_GAP',
  cash_eligible_for_new_capital boolean not null default true,
  sell_to text not null default 'TARGET',        -- TARGET | BAND_EDGE
  updated_at timestamptz not null default now()
);

-- ---------- crash reserve (§8) ----------
create table if not exists portfolio.crash_reserve_levels (
  user_id uuid not null references auth.users(id) on delete cascade,
  level integer not null,
  drawdown_pct numeric not null,                 -- 15 / 25 / 35 / 45 / 55
  deploy_pct_of_reserve numeric not null,        -- 10 / 15 / 20 / 25 / 30
  primary key (user_id, level)
);

create table if not exists portfolio.crash_reserve_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  level integer not null,
  episode_start date not null,                   -- ngày lập ATH gần nhất trước đợt sụt
  reserve_at_episode_start_vnd numeric not null, -- CHỤP ẢNH — mọi % tính trên số này
  triggered_at date not null,
  drawdown_pct numeric not null,
  deployed_vnd numeric,
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, episode_start, level)
);

-- ---------- benchmarks (§9) ----------
create table if not exists portfolio.benchmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_class portfolio.asset_class not null,
  symbol text not null,                          -- VNINDEX | BTC | XAU
  name text not null default '',
  price_source text not null default 'MANUAL',
  is_default boolean not null default true,
  unique (user_id, asset_class, symbol)
);

create table if not exists portfolio.benchmark_prices (
  benchmark_id uuid not null
    references portfolio.benchmarks(id) on delete cascade,
  as_of date not null,
  close numeric not null,
  primary key (benchmark_id, as_of)
);

-- ---------- snapshots (§9 high-water mark) ----------
create table if not exists portfolio.snapshots (
  user_id uuid not null references auth.users(id) on delete cascade,
  as_of date not null,
  total_value_vnd numeric not null,
  invested_capital_vnd numeric not null,
  primary key (user_id, as_of)
);

-- ---------- action_plans (§20 §21) ----------
create table if not exists portfolio.action_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period date not null,                          -- 2026-09-01 = kế hoạch tháng 9
  generated_at timestamptz not null default now(),
  plan jsonb not null,
  status text not null default 'DRAFT',          -- DRAFT | DONE | SKIPPED
  updated_at timestamptz not null default now(),
  unique (user_id, period)
);
```

### 3.4 Trigger kiểm tra tính toàn vẹn

CHECK constraint không tra được bảng khác, nên các ràng buộc liên bảng đi bằng trigger. Đây là app tiền — thà chặn ở DB.

```sql
create or replace function portfolio.tx_validate() returns trigger
language plpgsql as $fn$
declare
  ac_main portfolio.asset_class;
  ac_cash portfolio.asset_class;
begin
  select asset_class into ac_main
    from portfolio.instruments where id = new.instrument_id;

  -- dòng tiền thuần: instrument_id PHẢI là túi CASH và không có chân đối ứng
  if new.type in ('DEPOSIT','WITHDRAWAL','INTEREST') then
    if ac_main <> 'CASH' then
      raise exception '% phải ghi trên một túi CASH', new.type;
    end if;
    if new.cash_instrument_id is not null then
      raise exception '% không được có cash_instrument_id', new.type;
    end if;
  end if;

  -- BUY/SELL: tài sản không được là CASH, chân tiền phải là CASH
  if new.type in ('BUY','SELL') then
    if ac_main = 'CASH' then
      raise exception 'BUY/SELL không áp dụng cho túi CASH — dùng TRANSFER';
    end if;
    select asset_class into ac_cash
      from portfolio.instruments where id = new.cash_instrument_id;
    if ac_cash <> 'CASH' then
      raise exception 'cash_instrument_id phải trỏ tới một túi CASH';
    end if;
  end if;

  -- TRANSFER: chỉ giữa hai túi CASH (dùng để đặt tên tiền cho DCA)
  if new.type = 'TRANSFER' then
    select asset_class into ac_cash
      from portfolio.instruments where id = new.cash_instrument_id;
    if ac_main <> 'CASH' or ac_cash <> 'CASH' then
      raise exception 'TRANSFER chỉ dùng giữa hai túi CASH';
    end if;
    if new.instrument_id = new.cash_instrument_id then
      raise exception 'TRANSFER phải giữa hai túi khác nhau';
    end if;
  end if;

  return new;
end $fn$;

drop trigger if exists trg_tx_validate on portfolio.transactions;
create trigger trg_tx_validate before insert on portfolio.transactions
  for each row execute function portfolio.tx_validate();
```

### 3.5 View

```sql
create or replace view portfolio.v_legs
with (security_invoker = true) as
  -- chân 1: số lượng + giá vốn của TÀI SẢN (không phải CASH)
  select t.user_id, t.instrument_id,
         case t.type when 'BUY'        then  coalesce(t.quantity,0)
                     when 'SELL'       then -coalesce(t.quantity,0)
                     when 'ADJUSTMENT' then  coalesce(t.quantity,0)
                     else 0 end                          as qty_delta,
         case t.type when 'BUY'        then  t.amount_vnd
                     when 'SELL'       then -t.amount_vnd
                     when 'ADJUSTMENT' then  t.amount_vnd
                     else 0 end                          as cost_delta_vnd,
         0::numeric                                      as cash_delta_vnd
    from portfolio.transactions t
    join portfolio.instruments i on i.id = t.instrument_id
   where i.asset_class <> 'CASH'

union all
  -- chân 2: tiền đối ứng (BUY/SELL/DIVIDEND/FEE/TRANSFER-nguồn)
  select t.user_id, t.cash_instrument_id, 0::numeric, 0::numeric,
         case t.type when 'BUY'      then -t.amount_vnd
                     when 'SELL'     then  t.amount_vnd
                     when 'DIVIDEND' then  t.amount_vnd
                     when 'FEE'      then -t.amount_vnd
                     when 'TRANSFER' then -t.amount_vnd
                     else 0 end
    from portfolio.transactions t
   where t.cash_instrument_id is not null

union all
  -- chân 3: dòng tiền thuần trên chính túi CASH (gồm TRANSFER-đích)
  select t.user_id, t.instrument_id, 0::numeric, 0::numeric,
         case t.type when 'DEPOSIT'    then  t.amount_vnd
                     when 'WITHDRAWAL' then -t.amount_vnd
                     when 'INTEREST'   then  t.amount_vnd
                     when 'TRANSFER'   then  t.amount_vnd
                     when 'ADJUSTMENT' then  t.amount_vnd
                     when 'FEE'        then -t.amount_vnd
                     else 0 end
    from portfolio.transactions t
    join portfolio.instruments i on i.id = t.instrument_id
   where i.asset_class = 'CASH';

create or replace view portfolio.v_positions
with (security_invoker = true) as
select l.user_id, l.instrument_id,
       i.asset_class, i.symbol, i.name, i.currency,
       i.earmarked_for, i.price_source, i.lot_size, i.watchlist_stock_id,
       sum(l.qty_delta)        as quantity,
       sum(l.cost_delta_vnd)   as cost_basis_vnd,
       sum(l.cash_delta_vnd)   as cash_balance_vnd
  from portfolio.v_legs l
  join portfolio.instruments i on i.id = l.instrument_id
 group by l.user_id, l.instrument_id, i.asset_class, i.symbol, i.name,
          i.currency, i.earmarked_for, i.price_source, i.lot_size,
          i.watchlist_stock_id;

create or replace view portfolio.v_allocation
with (security_invoker = true) as
with latest as (
  select distinct on (user_id, instrument_id)
         user_id, instrument_id, price_vnd, as_of
    from portfolio.prices
   order by user_id, instrument_id, as_of desc
)
select p.*, lp.price_vnd, lp.as_of as price_as_of,
       case when p.asset_class = 'CASH' then p.cash_balance_vnd
            else coalesce(p.quantity,0) * lp.price_vnd end as market_value_vnd
  from portfolio.v_positions p
  left join latest lp
    on lp.user_id = p.user_id and lp.instrument_id = p.instrument_id;
```

Tài sản đang giữ mà **thiếu giá** → `market_value_vnd = NULL`. Engine phát hiện và **từ chối tạo kế hoạch** (xem mục 6.4) thay vì âm thầm coi là 0đ.

### 3.6 RLS

11 bảng, mỗi bảng theo đúng khuôn đã dùng trong repo: cột `user_id` + 4 policy `select/insert/update/delete own` + trigger `public.set_updated_at()`.

Ba ngoại lệ có chủ đích:

| Bảng | Khác biệt |
|---|---|
| `transactions` | **không tạo policy UPDATE**. DELETE giới hạn: `using (auth.uid() = user_id and created_at > now() - interval '24 hours')` |
| `benchmark_prices` | không có `user_id` → policy đi qua `exists (select 1 from portfolio.benchmarks b where b.id = benchmark_id and b.user_id = auth.uid())` |
| 3 view | `security_invoker = true` (bắt buộc, xem mục 3.2③) |

Realtime: chỉ bật cho `transactions`, `prices`, `action_plans` (những bảng thay đổi khi dùng), kèm `replica identity full` như các bảng cũ.

---

## 4. Domain layer

### 4.1 Input duy nhất

```ts
// src/domain/types.ts
export type AssetClass = 'STOCKS' | 'CRYPTO' | 'GOLD' | 'CASH';

export interface TargetBand { targetPct: number; minPct: number; maxPct: number }

export interface WatchlistItem {
  symbol: string; name: string; group: 'attack' | 'balance' | 'defense';
  currentPriceVnd: number | null; thresholdVnd: number | null;
  protectVnd: number | null; lotSize: number;
}

export interface EngineConfig {
  formula: 'PROPORTIONAL_GAP' | 'PROPORTIONAL_PP' | 'PRIORITY_WATERFALL';
  watchDeviationPp: number;        // 3
  strongRebalancePp: number;       // 5
  minSellAmountVnd: number;        // 5_000_000
  roundingStepVnd: number;         // 100_000
  cashEligibleForNewCapital: boolean;
  sellTo: 'TARGET' | 'BAND_EDGE';
  classPriority?: Record<AssetClass, number>;
}

export interface PortfolioSnapshot {
  asOf: string;                                    // ISO date — KHÔNG dùng Date.now()
  classValues:   Record<AssetClass, number>;       // VND, đã giải ngân
  earmarkedPots: Record<AssetClass, number>;       // VND trong túi DCA từng class
  cashReserveVnd: number;                          // túi VND-RESERVE
  targets: Record<AssetClass, TargetBand>;
  monthlyContributionVnd: number;                  // Z
  incomeReceivedVnd: number;                       // cổ tức/lãi đã nhận trong kỳ
  drawdowns: Record<AssetClass, number>;           // % theo benchmark
  portfolioDrawdownPct: number;
  crashLevels: { level: number; drawdownPct: number; deployPctOfReserve: number }[];
  crashHistory: { level: number; episodeStart: string;
                  reserveAtEpisodeStartVnd: number }[];
  currentEpisodeStart: string;                     // ngày ATH gần nhất
  missingPriceSymbols: string[];                   // ⚠ tài sản đang giữ mà thiếu giá
  watchlist: WatchlistItem[];
  config: EngineConfig;
}
```

### 4.2 Tám module

| Module | Spec | Chữ ký |
|---|---|---|
| `weights.ts` | §17 | `computeWeights(values, targets, extraVnd?) → Weight[]` |
| `bands.ts` | §7 | `classifyBand(weight, band, cfg) → BandStatus` |
| `allocate.ts` | §4 §5 | `allocate(snapshot, { poolVnd, addsToTotal }) → Allocation[]` |
| `rebalanceSell.ts` | §6 Mode B | `planSellRebalance(weights, statuses, cfg) → SellPlan` |
| `crashReserve.ts` | §8 | `evaluateCrashReserve(snapshot) → CrashRecommendation` |
| `drawdown.ts` | §9 | `computeDrawdown(series) → DrawdownStats` |
| `tickerCandidates.ts` | §11 | `pickCandidates(watchlist, budgetVnd) → Candidate[]` |
| `actionPlan.ts` | §20 §21 | `buildActionPlan(snapshot) → ActionPlan` |

**§4 và §5 dùng CHUNG một hàm.** Khác biệt duy nhất: tiền mới `Z` làm *tăng* tổng danh mục, còn cổ tức *đã nằm trong* Cash.

```ts
export const allocateNewCapital = (s: PortfolioSnapshot) =>
  allocate(s, { poolVnd: s.monthlyContributionVnd, addsToTotal: true  });

export const allocateIncome = (s: PortfolioSnapshot) =>
  allocate(s, { poolVnd: s.incomeReceivedVnd,      addsToTotal: false });
```

Một engine, hai wrapper một dòng — thay vì hai thuật toán phải giữ đồng bộ mãi mãi.

### 4.3 `bands.ts` — bốn mức, giải mâu thuẫn của §7

§7 nói cả *"do nothing while inside the band"* và *"strong rebalance khi lệch ≥ 5đ%"*. Hai câu đá nhau: Cash có band 7–20% quanh target 15% ⇒ lệch **−8đ% mà vẫn trong band**.

Cách giải: đọc §21 làm chuẩn. §21 hiện *"REBALANCE WARNING: Crypto overweight 4.8pp"* **nhưng** *"NO SELL REQUIRED"* ⇒ spec ngầm có **4 mức**, không phải 2.

| Trạng thái | Điều kiện | App làm gì |
|---|---|---|
| `OK` | trong band, \|lệch\| < `watchDeviationPp` (3) | im lặng |
| `WATCH` | trong band, \|lệch\| ≥ 3đ% | cảnh báo mềm, ưu tiên dùng tiền mới. **Không bán.** |
| `OUT_OF_BAND` | ra ngoài [min, max] | cảnh báo, dồn toàn bộ tiền mới vào |
| `REBALANCE_REQUIRED` | ngoài band **VÀ** \|lệch\| ≥ `strongRebalancePp` (5) | **mở khoá lệnh BÁN** (Mode B) |

> **Band là cổng, điểm % chỉ nâng mức độ.** Lệnh bán chỉ sinh khi *cả hai* điều kiện đúng ⇒ đúng §18 mục tiêu 1 "MINIMIZE SELLING", đúng §7 "do nothing while inside the band", và tái lập chính xác kết luận của §21.

### 4.4 `allocate.ts` — công thức `PROPORTIONAL_GAP` (mặc định)

```
newTotal      = total + (addsToTotal ? pool : 0)
targetValue_c = newTotal × targetPct_c
baseline_c    = currentValue_c                                 -- mọi class trừ CASH
baseline_CASH = currentValue_CASH − (addsToTotal ? 0 : pool)   -- pool LUÔN ngoài baseline
gap_c         = targetValue_c − baseline_c

ứng viên      = { c : gap_c > 0 }
                (loại CASH nếu cfg.cashEligibleForNewCapital = false)
phânBổ_c      = pool × gap_c / Σ gap(ứng viên)
→ làm tròn xuống bội số roundingStepVnd; phần dư dồn vào class có gap lớn nhất
```

**`pool` LUÔN nằm NGOÀI baseline tính `gap`.** Vì phần phân bổ cho CASH cũng được **cộng vào** CASH y như mọi class khác, baseline của CASH phải là "CASH **chưa** có pool". Cộng pool vào baseline là đếm pool hai lần: với `addsToTotal = true` (§4, pool còn ở ngoài `classValues`) thì CASH bị bỏ đói và một danh mục đúng y target lại bị đẩy ra khỏi target; với `addsToTotal = false` (§5, pool đã nằm trong CASH) thì CASH bị coi là đã đủ nên tiền đáng để lại trong ví bị giải ngân hết. `addsToTotal` chỉ quyết định `newTotal` có tăng hay không, **không** quyết định baseline.

Kiểm bằng mô phỏng 24 tháng, Z = 3tr/tháng, bắt đầu từ đúng 500/200/150/150tr: cộng pool vào baseline cho ra `50,271 / 20,009 / 15,000 / 14,720` (%) — CASH rò rỉ thường trực ~0,28đ%, đúng kiểu làm Crash Reserve §8 cạn dần. Để pool ngoài baseline cho ra đúng `50,000 / 20,000 / 15,000 / 15,000`.

`addsToTotal = false` mà `pool > currentValue_CASH` là đầu vào tự mâu thuẫn (cổ tức không thể lớn hơn toàn bộ tiền trong ví) ⇒ **ném lỗi**, không nuốt im lặng. `pool < 0` cũng **ném lỗi** — quy về 0 sẽ phá bất biến `Σ phân bổ + chưa phân bổ = pool`. `pool = 0` là hợp lệ (không có gì để phân bổ).

**Vì sao đây là mặc định:** chia tỷ lệ theo khoảng thiếu tính bằng VND là phân bổ **duy nhất tối thiểu hoá tổng bình phương độ lệch** sau khi giải ngân — tức chính xác mục tiêu số 2 của §18 *"MINIMIZE DEVIATION FROM TARGET"*. Chứng minh được, không phải chọn cảm tính.

Hai công thức thay thế có sẵn trong Settings (`allocation_formula`): `PROPORTIONAL_PP` (chia theo điểm % lệch — khớp ví dụ §4) và `PRIORITY_WATERFALL` (đổ đầy theo thứ tự ưu tiên do người dùng đặt).

**Phân bổ cho CASH nghĩa là "để lại trong túi, không tiêu"** — không phải "đi mua tiền". CASH phải được nhận phân bổ, nếu không Crash Reserve §8 sẽ cạn dần và mất tác dụng.

### 4.5 ⚠️ Ví dụ §4, §5, §21 KHÔNG cùng một công thức

Đã kiểm tay cả ba — kể cả chạy qua engine thật (`allocate.ts`), không chỉ suy luận tỷ lệ:

| Ví dụ | Lệch của các class underweight | Spec kỳ vọng | Engine tính ra |
|---|---|---|---|
| §4 | Stocks −3, Crypto −3 | 1,5tr / 1,5tr | **1,6tr / 1,4tr** (Stocks / Crypto) |
| §5 | Stocks −3, Crypto −3 | 3tr / 2tr | **2,4tr / 2,3tr / 0,3tr** (Stocks / Crypto / Cash) |
| §21 | Stocks −2,8 · Cash −3,5 | 2tr / 1tr | **1,3tr / 1,7tr** (Stocks / Cash) |

**Cả ba ví dụ đều không tái lập được**, mỗi ví dụ lệch theo một hướng khác nhau —
xác nhận rằng đây là số minh hoạ viết tay, không phải kết quả của một công thức.
Riêng §4 lệch vì §17 bắt tính khoảng thiếu trên `newTotal = tổng cũ + Z`: phần Z
chia theo target làm khoảng thiếu của Stocks (31,5tr) lớn hơn Crypto (30,6tr),
nên không còn chia đều nữa.

Ở §5, cổ tức 5tr bị **trừ khỏi** baseline Cash (150tr − 5tr = 145tr) nên Cash
đang thiếu đúng 5tr và **cũng là ứng viên** — 0,3tr cổ tức được giữ lại trong ví
thay vì giải ngân hết. Xem quy tắc "pool luôn ngoài baseline" ở mục 4.4.

**Không có công thức đơn nào cho ra cả ba.** §4 nói *"The exact formula should be configurable"* — đây chính là chỗ đó.

**Quyết định:** `PROPORTIONAL_GAP` là chuẩn. Test case ghi theo số engine tính, **kèm comment dẫn chiếu mục này** để người đọc sau không tưởng là bug.

#### Chạy tay bộ số §21 (dùng làm test case chính)

```
total 1.087.500.000 · Z 3.000.000 · income 0 · newTotal 1.090.500.000

class    hiện có         %      target VND      gap VND
Stocks   513.300.000   47,2%   545.250.000   +31.950.000   ← ứng viên
Crypto   269.700.000   24,8%   218.100.000   −51.600.000   ← loại
Gold     179.437.500   16,5%   163.575.000   −15.862.500   ← loại
Cash     125.062.500*  11,5%   163.575.000   +38.512.500   ← ứng viên
                                 Σ gap(+) =    70.462.500
   (*) Z nằm NGOÀI baseline — KHÔNG cộng vào Cash (mục 4.4)

Stocks = 3.000.000 × 31.950.000 / 70.462.500 = 1.360.298 → làm tròn 1.300.000
Cash   = 3.000.000 × 38.512.500 / 70.462.500 = 1.639.702 → làm tròn 1.600.000
dư = 3.000.000 − 2.900.000 = 100.000 → dồn vào gap lớn nhất (Cash) = 1.700.000
```

**Kết quả:** `MUA Stocks 1.300.000` · `GIỮ Cash 1.700.000` · `KHÔNG MUA Crypto, Gold`

Đối chiếu §21:

| Kết luận | §21 | Engine | |
|---|---|---|---|
| Không mua Crypto | ✓ | ✓ | khớp |
| Không mua Gold | ✓ | ✓ | khớp |
| Crypto cảnh báo +4,8đ% | ✓ | ✓ `WATCH` | khớp |
| Gold trong band | ✓ | ✓ `OK` | khớp |
| Chưa cần bán | ✓ | ✓ | khớp |
| Số tiền Stocks | 2.000.000 | **1.300.000** | lệch |
| Số tiền Cash | 1.000.000 | **1.700.000** | lệch |

Engine khớp **toàn bộ kết luận định tính** của §21; chỉ lệch hai con số — mà hai con số đó không suy ra được từ bất cứ công thức nào.

### 4.6 `tickerCandidates.ts` — ràng buộc lô chẵn

HOSE/HNX giao dịch **lô chẵn 100 cổ phiếu**. Với ngân sách 1.400.000đ cho Stocks, giá tối đa mua được là 14.000đ/cp. Soi 56 mã watchlist hiện có:

| Mua nổi 1 lô với 1,4tr | Không mua nổi |
|---|---|
| HND 13,3 → 1,33tr · QTP 13,5 → 1,35tr · OCB 13,8 → 1,38tr · POW 13,8 → 1,38tr | FPT 100 → **10tr** · DHG 130 → 13tr · BMP 129 → 12,9tr · MWG 95 → 9,5tr · VCB 71 → 7,1tr … (52/56 mã) |

Nếu engine chỉ nói *"mua Stocks 1,4tr"*, NewPL **không thực hiện được** với 52/56 mã. Nên phải lọc **hai** điều kiện:

```ts
ứngViên = watchlist.filter(m =>
  m.currentPriceVnd !== null && m.thresholdVnd !== null
  && m.currentPriceVnd <= m.thresholdVnd            // dưới ngưỡng tích sản
  && m.currentPriceVnd * m.lotSize <= budgetVnd     // ⭐ mua nổi 1 lô
);
```

Với mã dưới ngưỡng nhưng chưa đủ tiền, hiện thông tin dồn tiền:
`"FPT dưới ngưỡng nhưng 1 lô cần 10.000.000 — còn thiếu 8.600.000, dồn thêm ~6 tháng"`.

**Cơ chế dồn tiền không cần code mới:** tiền chưa mua nằm lại trong túi `VND-DCA-STOCKS` (mục 3.2①).

App **không tự chọn mã** — chỉ lọc ra danh sách ứng viên để NewPL quyết (§23).

### 4.7 `rebalanceSell.ts` — Mode B (§6)

Chỉ chạy khi có class ở `REBALANCE_REQUIRED`.

1. Class overweight: `excessVnd = currentValue − targetValue`
2. **Bán về đúng `targetValue`** (`sellTo = 'TARGET'`, mặc định). Lý do: ít **lần** bán hơn — cắt sát rìa band sẽ bật ra ngoài lại ngay và sinh chuỗi bán lắt nhắt, tổng phí cao hơn. Đây là cách chuẩn của band rebalancing. Đổi được sang `BAND_EDGE` trong Settings.
3. Bỏ lệnh có `sellVnd < minSellAmountVnd` (5tr) — §18 không bán vụn.
4. Đích đến = các class underweight, **chia bằng chính `allocate.ts`** (tái dùng, không viết lại logic phân bổ lần thứ hai).

### 4.8 `crashReserve.ts` — khái niệm "đợt sụt giảm" (episode)

§8 nói *"Level 1: dùng 10% Crash Reserve, Level 2: dùng thêm 15%"* nhưng bỏ trống hai điều mà thiếu là sai tiền:

**(a) 10% của cái gì?** → của số dư reserve **tại lúc đợt sụt giảm bắt đầu** (`reserve_at_episode_start_vnd`, chụp ảnh lại). Nếu tính theo số dư *hiện tại*, mỗi bậc sau sẽ nhỏ dần vô lý.

**(b) Bậc đã dùng có kích hoạt lại?** → **Một đợt = từ khi phá đỉnh cũ (ATH) tới khi lập đỉnh mới.** Trong cùng một đợt, mỗi bậc chỉ kích hoạt một lần (unique key `(user_id, episode_start, level)`). Khi danh mục lập ATH mới ⇒ đợt mới, 5 bậc reset. Không có cái này thì hoặc app lải nhải "dùng bậc 1" mỗi tháng, hoặc lần khủng hoảng sau không kích hoạt được nữa.

Tổng 5 bậc = 10+15+20+25+**30** = 100% (§8 nói bậc 5 dùng "phần còn lại"). Tất cả sửa được trong `crash_reserve_levels`.

**Không bao giờ tự thực hiện lệnh** — chỉ ra đề xuất (§23).

### 4.9 `drawdown.ts` (§9)

```ts
computeDrawdown(series: { date: string; value: number }[]) → {
  currentPct: number;      // (ath − current) / ath × 100
  maxPct: number;          // sụt giảm sâu nhất trong lịch sử
  ath: { date: string; value: number };
  trough: { date: string; value: number };
  daysSinceHigh: number;
  recoveryPct: number;     // (current − trough) / (ath − trough) × 100
}
```

Một hàm dùng cho cả bốn nguồn: chuỗi giá benchmark (VNINDEX / BTC / vàng) và chuỗi `snapshots` của danh mục.

### 4.10 `actionPlan.ts` — bộ điều phối

Thứ tự đúng theo §18:

```
1. weights (EARMARKED) + bands
2. crashReserve  → nếu có bậc kích hoạt, đây là việc ưu tiên cao nhất
3. pool = Z + incomeReceived  → allocate MỘT LẦN (không chia hai vòng)
4. rebalanceSell → CHỈ khi có class REBALANCE_REQUIRED
5. tickerCandidates cho phần ngân sách Stocks
6. alerts §19 (chính là phần cảnh báo của plan — không tách module thứ 9)
```

Bước 3 gộp `Z` và cổ tức thành **một pool**, `allocate` một lần. Ít mảnh động hơn, tránh nguy cơ đếm trùng; plan vẫn hiển thị riêng hai nguồn.

Kiểu trả về của `buildActionPlan` **chính là** shape mà UI render và lưu vào `action_plans.plan` (jsonb) — một định nghĩa, ba nơi dùng.

---

## 5. Price layer (§15 §16)

```ts
// src/providers/types.ts
export interface Quote {
  symbol: string; priceVnd: number; priceOriginal: number;
  currency: Currency; fxRate: number; asOf: string; source: string;
}
export interface PriceProvider {
  readonly name: string;
  supports(inst: Instrument): boolean;
  getQuotes(symbols: string[]): Promise<{ quotes: Quote[]; failed: Failure[] }>;
  getHistoricalPrices?(symbol: string, from: string, to: string): Promise<Candle[]>;
}
export interface FxProvider { getFXRate(from: Currency, to: Currency): Promise<number> }
```

| Provider | Bọc quanh code sẵn có | Việc thêm |
|---|---|---|
| `VnDirectProvider` | `src/lib/stockPrice.ts` *(có test)* | `× 1000` → VND; nới cửa sổ nến để có `getHistoricalPrices` |
| `BinanceProvider` / `CoinGeckoProvider` | `src/lib/cryptoPrice.ts` *(có test)* | USD → `× fxRate` |
| `ErApiFxProvider` | `src/lib/fxRate.ts` *(có test)* | fallback → `settings.manual_usd_vnd` |
| `ManualProvider` | *(mới, ~20 dòng)* | đọc dòng mới nhất trong `portfolio.prices` — **luôn là lớp chót §16** |

`resolveProvider(instrument)` chọn theo `instruments.price_source`; thất bại → tụt xuống `ManualProvider`.

`getHistoricalPrices` gần như miễn phí: dchart **đã** trả cả chuỗi nến, code hiện tại chỉ lấy phần tử cuối. Nới `from` là có ngay dữ liệu drawdown §9 cho VNINDEX và BTC.

*Cần verify khi implement:* symbol `VNINDEX` trên endpoint dchart. Nếu không có, dùng `ManualProvider` + nhập tay chỉ số hàng tháng.

**Quy tắc giá cũ:** mỗi giá hiện trên UI kèm ngày. Quá 3 ngày → badge `giá cũ 22/08`. **Không bao giờ** hiện giá cũ như giá hiện tại.

---

## 6. Giao diện

Thêm đúng một giá trị vào `Page` trong `src/pages/AppPage.tsx`:

```ts
type Page = 'todos' | 'plan' | 'stocks' | 'crypto' | 'portfolio';
```

### 6.1 Năm mục bên trong tab `portfolio`

| Mục | Spec | Nội dung |
|---|---|---|
| **Dashboard** | §10 | tổng giá trị · tổng vốn · lãi/lỗ chưa & đã thực hiện · cổ tức · lợi nhuận % · 4 thanh tỷ trọng (**bật/tắt Earmarked ⇄ Deployed**) · bảng Target vs Actual + badge trạng thái · dải drawdown |
| **Kế hoạch tháng** | §20 §21 | xem mục 6.2 |
| **Sổ giao dịch** | §14 | danh sách + form thêm. **Không có nút Sửa** — chỉ "Ghi bút toán điều chỉnh". Nút Xoá chỉ hiện với dòng < 24h |
| **Tài sản** | §11 §16 | instruments + vị thế từ `v_positions` · nhập giá tay (vàng, mã lạ) |
| **Cấu hình** | §2 §7 §8 | target/band · Z · 5 bậc crash · công thức chia · lô chẵn · bước làm tròn |

`AllocationBars.tsx` mở rộng từ `src/components/PortfolioSummary.tsx` — đổi 3 nhóm thành 4 asset class, giữ nguyên cách vẽ (thanh thực tế + vạch mốc target + chênh lệch màu). Mobile theo pattern tab ngang đã có trong `AppPage.tsx`.

### 6.2 Màn hình Kế hoạch tháng

```
┌─ THÁNG 09/2026 ───────────────────── [Tạo lại] [Đánh dấu đã xong] ┐
│ Tổng danh mục  1.087.500.000 đ          giá cập nhật 22/08 14:30  │
├─ ① VIỆC CẦN LÀM ─────────────────────────────────────────────────┤
│ 1  MUA Stocks   1.400.000 đ    ← túi VND-DCA-STOCKS               │
│      ứng viên dưới ngưỡng VÀ mua nổi 1 lô:                       │
│        OCB 13,8 → lô 1.380.000    HND 13,3 → 1.330.000            │
│        POW 13,8 → lô 1.380.000    QTP 13,5 → 1.350.000            │
│      ⓘ FPT dưới ngưỡng nhưng 1 lô cần 10.000.000                 │
│        — còn thiếu 8.600.000, dồn thêm ~6 tháng                   │
│ 2  GIỮ Cash     1.600.000 đ    ← để trong VND-RESERVE             │
│ 3  KHÔNG MUA Crypto   (đang +4,8đ%)                               │
│ 4  KHÔNG MUA Gold     (trong band)                                │
├─ ② CẢNH BÁO §19 ─────────────────────────────────────────────────┤
│ ⚠ Crypto 24,8% / target 20% — vượt 4,8đ%. Trong band → chưa bán  │
│ ⚠ Cash 11,5% / target 15% — thiếu 3,5đ%                          │
├─ ③ CRASH RESERVE §8 ─────────────────────────────────────────────┤
│ Reserve 128.062.500 đ · đợt hiện tại: chưa bậc nào kích hoạt      │
│ Bậc 1 mở khi thị trường giảm ≥15%  (hiện −3,2%)                  │
├─ ④ CHƯA CẦN BÁN §6 ──────────────────────────────────────────────┤
│ Không class nào vừa ra ngoài band vừa lệch ≥5đ%                  │
└─ ⑤ [ Ghi các giao dịch đã thực hiện → ] ─────────────────────────┘
```

Nút ⑤ **điền sẵn form giao dịch từ chính kế hoạch** — đóng vòng §20 bước 11 mà không phải nhập lại. Đây là chi tiết quyết định app có được dùng thật hay không.

Kế hoạch **lưu vào `action_plans`** (jsonb + status) ⇒ tháng 12 xem lại được "tháng 9 app bảo gì, mình có làm không", và alert §19 *"tháng này chưa nộp tiền"* = chưa có plan `DONE`.

### 6.3 Alerts §19 — không có module thứ chín

Tám loại alert của §19 **chính là** phần cảnh báo mà `actionPlan.ts` đã sinh ra. Gộp vào output của nó. v1 **không có push notification** (cần server + cron) — alert hiện dưới dạng badge số trên tab `portfolio` + danh sách trên Dashboard.

### 6.4 Xử lý lỗi

Theo đúng nguyên tắc *"KHÔNG nuốt lỗi im lặng"* trong `CLAUDE.md` của repo:

| Tình huống | App làm |
|---|---|
| Lấy giá lỗi | `ErrorBanner` + badge `giá cũ` — **không** hiện 0đ |
| Danh mục rỗng | engine trả `EMPTY_PORTFOLIO`, UI hiện hướng dẫn khởi tạo — **không** ra `NaN%` |
| **Thiếu giá của tài sản đang giữ** | **từ chối tạo kế hoạch**: *"2 tài sản chưa có giá: SJC-1L, VEA. Nhập giá rồi tạo lại."* Kế hoạch tính trên giá thiếu còn tệ hơn không có kế hoạch. |
| Tỷ giá lỗi | dùng `settings.manual_usd_vnd` + nhãn `tỷ giá nhập tay 22/08` trên mọi số đã quy đổi |

---

## 7. CSV (§24)

- **Export:** `transactions.csv` (đủ 10 cột §14), `holdings.csv`, `prices.csv`. Hàm thuần `toCsv()` + tải blob. Đây cũng là cơ chế backup.
- **Import:** parse → **validate → hiện bảng preview → mới confirm**. Không bao giờ import im lặng. Validator là hàm thuần có test: sai định dạng ngày, symbol lạ, thiếu trường bắt buộc theo `type`, trùng dòng (cùng ngày+symbol+qty+price → cảnh báo).
- Mapper theo định dạng CSV của từng broker: **hoãn sang v2**, cần file mẫu thật.

---

## 8. Nhập dữ liệu ban đầu

`supabase/migrations/2026-08-22-portfolio-seed.sql` tạo: 4 túi tiền · `settings` · `allocation_targets` (50/20/15/15 + band §2) · 5 bậc crash · 3 benchmark · **56 instruments từ `public.stocks`** (kèm `watchlist_stock_id`, `lot_size = 100`, `price_source = 'VNDIRECT'`).

56 mã này vào làm **watchlist** — chưa có giao dịch thì vị thế = 0, hoàn toàn đúng.

| Nguồn | Chuyển được? | Mất gì |
|---|---|---|
| `stocks.ticker/company_name/group/price_threshold/price_protect` | ✅ nguyên vẹn | — |
| `cryptos.quantity + avg_buy_price` | ⚠️ tạo **1 dòng BUY xấp xỉ** | `avg_buy_price` là giá **trung bình** ⇒ không dựng lại được từng lần mua. Mất lịch sử P/L đã thực hiện trước ngày nhập. Không tránh được: bảng cũ chưa bao giờ lưu từng giao dịch. |
| `stocks.invested_amount` | ❌ không đủ | chỉ có *"đã bỏ vào bao nhiêu"* — **không có số lượng, giá, ngày** ⇒ không tính được giá trị hiện tại |

**Giải pháp cho ô thứ ba: màn "Nạp vị thế ban đầu"** (một lần, ~5 phút). Liệt kê các mã có `invested_amount`, NewPL điền số lượng + giá mua TB + ngày (ước lượng được). App sinh một dòng `BUY` cho mỗi mã, `note = 'nạp ban đầu từ appTodo'`. Từ thời điểm đó mọi tính toán chính xác.

Bảng `public.stocks` và `public.cryptos` **giữ nguyên, không xoá, không sửa** — appTodo vẫn chạy bình thường; `stocks` tiếp tục đóng vai watchlist (nguồn `price_threshold`).

---

## 9. Test

```
src/domain/*.test.ts     Vitest — 0 mock, 0 DB, 0 mạng, chạy < 50ms
```

| Nhóm | Nội dung |
|---|---|
| Ví dụ trong spec | §4, §5, §21 chạy qua engine. Chỗ lệch **ghi rõ trong comment kèm dẫn chiếu mục 4.5** — không sửa engine cho vừa số viết tay |
| Biên | `total = 0` (không được ra `NaN`) · mọi class đều overweight (pool đi đâu?) · `pool = 0` · `reserve = 0` · watchlist rỗng · thiếu giá |
| Bất biến | `Σ phân bổ === pool` **luôn đúng sau làm tròn** · không class nào bị phân bổ số âm · `Σ weight === 100%` · không class nào `REBALANCE_REQUIRED` ⇒ `sells.length === 0` |
| Property-based | 1.000 snapshot random → kiểm 3 bất biến trên. Bắt lỗi làm tròn mà test tay bỏ sót. |
| Quy đổi đơn vị | `providers/`: nghìn đồng → VND, USD → VND. Nhóm test riêng vì đây là nơi duy nhất được quy đổi. |
| CSV | round-trip: export → import → dữ liệu giống hệt |

Bất biến `Σ phân bổ === pool` là quan trọng nhất — sai làm tròn ở đây là **mất tiền thật hoặc thừa tiền ảo**.

---

## 10. Cây file

```
appTodo/
├── supabase/migrations/
│   ├── 2026-08-22-portfolio-core.sql      11 bảng + trigger + 3 view + RLS
│   └── 2026-08-22-portfolio-seed.sql      targets, crash levels, 4 túi, benchmark, 56 instruments
├── src/
│   ├── domain/                            ⭐ 0 dependency
│   │   ├── types.ts  weights.ts  bands.ts  allocate.ts  rebalanceSell.ts
│   │   ├── crashReserve.ts  drawdown.ts  tickerCandidates.ts  actionPlan.ts
│   │   └── *.test.ts                      (8 file test)
│   ├── providers/
│   │   ├── types.ts  registry.ts  vndirect.ts  binance.ts
│   │   ├── coingecko.ts  manual.ts  fx.ts
│   │   └── *.test.ts
│   ├── data/portfolioRepo.ts              CRUD thuần, không logic
│   ├── hooks/  usePortfolio.ts  usePrices.ts  useTransactions.ts
│   ├── lib/csv/  exportCsv.ts  importCsv.ts  *.test.ts
│   ├── types/portfolio.ts
│   └── components/portfolio/
│       ├── PortfolioTab.tsx  Dashboard.tsx  MonthlyPlan.tsx
│       ├── TransactionLog.tsx  TransactionForm.tsx  AdjustmentForm.tsx
│       ├── AssetsTable.tsx  PortfolioSettings.tsx
│       ├── AllocationBars.tsx  DrawdownStrip.tsx
│       └── InitialPositionsWizard.tsx
├── CLAUDE.md                              cập nhật: thêm module đầu tư vào phạm vi
└── prd.md                                 thêm Phase 3
```

**Không sửa một dòng nào** của todos / goals / plan / stocks / crypto hiện có.

---

## 11. Sáu đợt triển khai

| Đợt | Nội dung | Xong thì thấy gì |
|---|---|---|
| 1 | migration + seed + `portfolioRepo` + types | đăng nhập, thấy 4 túi tiền và 56 watchlist |
| 2 | **8 module domain + test** | engine chạy đúng §21 (bằng test, chưa có UI) |
| 3 | `TransactionForm` + `TransactionLog` + `InitialPositionsWizard` + CSV import | **nạp được danh mục thật vào** |
| 4 | `Dashboard` + `AllocationBars` + providers giá | nhìn thấy tỷ trọng thật |
| 5 | `MonthlyPlan` + `tickerCandidates` + crash reserve + alerts | **kế hoạch tháng dùng được** |
| 6 | `drawdown` + `snapshots` + CSV export + `PortfolioSettings` | đủ v1 |

Đợt 2 làm **trước** UI — engine phải đúng bằng test trước khi có gì để nhìn. Mỗi đợt tự nó đã có ích, không phải đợi tới cuối.

---

## 12. An toàn (§23)

- App **không** đặt lệnh mua/bán tự động. Mọi output là **đề xuất**; NewPL tự thực hiện rồi ghi lại.
- Không lưu API key sàn/broker trong v1. Mọi tích hợp ngoài đều **read-only**.
- Frontend chỉ dùng Supabase `anon` key (an toàn nhờ RLS). **Tuyệt đối không** đưa `service_role` key vào frontend hay commit.

---

## 13. Bảng tra: 25 mục spec → nơi hiện thực

| § | Chủ đề | Hiện thực ở |
|---|---|---|
| 1 | Mục tiêu | toàn bộ tài liệu |
| 2 | Portfolio target + band | `allocation_targets` · mục 3.3 |
| 3 | Initial capital + DCA staging | `earmarked_for` · mục 3.2① |
| 4 | Monthly Z | `allocate.ts` · mục 4.4 |
| 5 | Dividend / passive income | `allocateIncome` (cùng engine) · mục 4.2 |
| 6 | Rebalancing Mode A / Mode B | `allocate.ts` / `rebalanceSell.ts` · mục 4.7 |
| 7 | Rebalancing threshold | `bands.ts` — 4 mức · mục 4.3 |
| 8 | Crash Reserve | `crashReserve.ts` + 2 bảng · mục 4.8 |
| 9 | Drawdown | `drawdown.ts` + `benchmark_prices` + `snapshots` · mục 4.9 |
| 10 | Dashboard | mục 6.1 *(TWR/MWR/XIRR hoãn v2)* |
| 11 | Asset structure | `instruments.asset_class` + `tickerCandidates.ts` · mục 4.6 |
| 12 | Currency | quy tắc đơn vị mục 2 + `prices.price_original`/`fx_rate` |
| 13 | Data model | ánh xạ mục 3.1 |
| 14 | Transaction history | `transactions` bất biến · mục 3.2② |
| 15 | Price update | `PriceProvider` · mục 5 |
| 16 | Manual fallback | `ManualProvider` + màn Tài sản · mục 5, mục 6.1 |
| 17 | Rebalance calculation | `weights.ts` · mục 4.4 |
| 18 | Optimization rule | thứ tự trong `actionPlan.ts` · mục 4.10 |
| 19 | Alerts | output của `actionPlan.ts` · mục 6.3 |
| 20 | Monthly workflow | màn Kế hoạch tháng · mục 6.2 |
| 21 | Example action plan | test case chính · mục 4.5 |
| 22 | Technology | thay bằng stack repo hiện tại · §0 quyết định 2 |
| 23 | Safety | mục 12 |
| 24 | Future integration | CSV v1 · mục 7; broker mapper v2 |
| 25 | MVP priority | scope v1 · mục 0, quyết định 7 |

---

## 14. Ba mâu thuẫn đã phát hiện trong spec và cách xử lý

| # | Mâu thuẫn | Xử lý |
|---|---|---|
| 1 | **§7**: "do nothing while inside the band" **vs** "rebalance mạnh khi lệch ≥5đ%". Cash band 7–20% quanh target 15% ⇒ lệch −8đ% mà vẫn trong band | 4 mức trạng thái, **band là cổng, đ% chỉ nâng mức độ**. Tái lập chính xác kết luận §21. Xem mục 4.3 |
| 2 | **§4 / §5 / §21**: số trong ba ví dụ không cùng một công thức (§5 chia 60:40 khi hai class lệch bằng nhau; §21 ưu tiên class lệch ÍT hơn) | `PROPORTIONAL_GAP` là chuẩn (chứng minh được là tối thiểu hoá độ lệch). **CẢ BA** §4/§5/§21 ghi nhận là minh hoạ viết tay (§4 lệch vì §17 bắt tính khoảng thiếu trên `newTotal`). Công thức đổi được trong Settings. Xem mục 4.5 |
| 3 | **§25**: Crash Reserve ở P0 nhưng Drawdown ở P1, trong khi P0 phụ thuộc P1 | gộp drawdown, dividend, CSV vào v1. Xem mục 0, quyết định 7 |

## 15. Việc spec không nhắc mà thiếu thì app không dùng được thật

| Vấn đề | Xử lý |
|---|---|
| **Lô chẵn 100 cổ phiếu**: Z = 3tr không mua nổi 1 lô của 52/56 mã watchlist | `tickerCandidates.ts` lọc theo affordability; dồn tiền qua túi `VND-DCA-*`; hiện "còn thiếu bao nhiêu, mấy tháng nữa". Xem mục 4.6 |
| **Trộn đơn vị** giữa bảng cũ (nghìn đồng / đồng / USD) | quy tắc VND tuyệt đối trong schema mới, quy đổi ở đúng một tầng biên. Xem mục 2 |
| **`security_invoker`** trên view — thiếu là RLS bị vô hiệu, không có triệu chứng | bắt buộc trên cả 3 view. Xem mục 3.2③ |
| **Reset bậc Crash Reserve** giữa các đợt sụt giảm | khái niệm episode + `reserve_at_episode_start_vnd`. Xem mục 4.8 |
| **Sửa nhầm khi nhập** với sổ bất biến | cho DELETE trong 24h; sau đó chỉ `ADJUSTMENT`. Xem mục 3.2② |
| **Giá cũ hiện như giá hiện tại** | badge ngày; thiếu giá thì **từ chối tạo kế hoạch**. Xem mục 5 và 6.4 |
