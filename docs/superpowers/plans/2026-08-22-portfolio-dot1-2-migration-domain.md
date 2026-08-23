# Portfolio Rebalancing — Đợt 1+2 (Migration + Domain Engine) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng xong tầng database (schema `portfolio`) và toàn bộ engine tính toán thuần TypeScript, để đến cuối plan này engine tái lập chính xác mọi kết luận định tính của ví dụ §21 bằng test — chưa có UI.

**Architecture:** Hai tầng độc lập nhau. (1) Postgres schema `portfolio` trong project Supabase hiện có: 11 bảng, sổ giao dịch bất biến, vị thế suy ra từ 3 view, RLS theo `user_id`. (2) `src/domain/` — hàm thuần, **0 dependency**, không import supabase/react/fetch, không gọi `Date.now()`. Tầng nối giữa hai bên (`portfolioRepo` + `buildSnapshot`) là task cuối.

**Tech Stack:** TypeScript strict · React 18 + Vite (không đụng tới ở plan này) · Supabase Postgres + RLS · Vitest (`vite.config.ts`, `globals: true`, jsdom)

**Spec:** `docs/superpowers/specs/2026-08-22-portfolio-rebalancing-design.md`

## Global Constraints

- **Ngôn ngữ:** comment, tên test, message lỗi → **tiếng Việt**. Tên biến/hàm/type → tiếng Anh.
  > ⚠️ **Ruling 2026-08-22 (sau review Batch A):** các khối code trong plan này vi phạm chính
  > ràng buộc trên — chúng dùng identifier cục bộ tiếng Việt (`trongBand`, `conLai`, `nguongVe`,
  > `taoRandom`, `docConfig`…). Convention THẬT của repo là identifier tiếng Anh + comment tiếng
  > Việt (xem `src/lib/stockCalc.ts`, `cryptoCalc.ts`, `todoFilters.ts`). **Ràng buộc thắng, khối
  > code thua:** khi hiện thực, đổi mọi biến cục bộ và hàm helper không export sang tiếng Anh.
  > **Tên export giữ nguyên đúng như khối code** (task sau import theo tên đó). Comment, tên test,
  > message lỗi giữ tiếng Việt.
- **Đơn vị tiền:** mọi cột và mọi biến trong `portfolio.*` và `src/domain/` là **VND (đồng)**. Không có nghìn đồng, không có USD. Quy đổi CHỈ xảy ra trong `src/providers/` (không thuộc plan này).
- **`src/domain/` cấm import:** `@supabase/supabase-js`, `react`, bất kỳ thứ gì gọi `fetch`. **Cấm gọi `Date.now()` và `new Date()` không tham số** — thời điểm luôn truyền vào qua tham số.
- **KHÔNG nuốt lỗi im lặng** (theo `CLAUDE.md` của repo): thiếu dữ liệu thì trả trạng thái tường minh hoặc ném lỗi có message tiếng Việt rõ ràng. Không bao giờ trả `0` hay `NaN` thay cho "không biết".
- **Migration idempotent:** mọi file SQL phải chạy lại nhiều lần được (`if not exists` / `drop ... if exists` / bọc trong `do $$ ... $$`).
- **Không sửa** một dòng nào trong: `src/components/Todo*`, `src/components/Goal*`, `src/components/Kanban*`, `src/components/Stock*`, `src/components/Crypto*`, `src/hooks/useTodos.ts`, `src/hooks/useGoals.ts`, `src/hooks/useStocks.ts`, `src/hooks/useCryptos.ts`, `src/lib/*Calc.ts`, `src/lib/*Filters.ts`. Bảng `public.stocks` / `public.cryptos` **chỉ đọc**.
- **Lệnh xác minh:** `npm test` (toàn bộ) · `npx vitest run <file>` (một file) · `npm run build` (đây là bước typecheck, repo không có script `typecheck` riêng).
- **Commit:** tiếng Việt, tiền tố `feat(portfolio):` / `test(portfolio):` / `docs(portfolio):` theo đúng style repo. Branch: `feat/portfolio-rebalancing` (đã tồn tại).
- **Ngưỡng mặc định:** `watchDeviationPp = 3` · `strongRebalancePp = 5` · `minSellAmountVnd = 5_000_000` · `roundingStepVnd = 100_000` · `monthlyContributionVnd = 3_000_000` · target 50/20/15/15 · band Stocks 40–55, Crypto 15–25, Gold 10–20, Cash 7–20.
- **Bậc Crash Reserve:** (1, 15%, 10%) (2, 25%, 15%) (3, 35%, 20%) (4, 45%, 25%) (5, 55%, 30%).

## File Structure

| File | Trách nhiệm | Task |
|---|---|---|
| `supabase/migrations/2026-08-22-portfolio-core.sql` | schema, 4 enum, 11 bảng, trigger toàn vẹn, RLS, grant | 1 |
| `supabase/migrations/2026-08-22-portfolio-views.sql` | `v_legs`, `v_positions`, `v_allocation` | 2 |
| `supabase/migrations/2026-08-22-portfolio-seed.sql` | 4 túi tiền, targets, crash levels, benchmark, 56 instrument từ `public.stocks` | 3 |
| `src/domain/types.ts` | toàn bộ type + `DEFAULT_CONFIG` + `ASSET_CLASSES` | 4 |
| `src/domain/money.ts` | `roundDownTo`, `sumVnd`, `daysBetween` | 4 |
| `src/domain/weights.ts` | §17 — tỷ trọng, target value, difference | 5 |
| `src/domain/bands.ts` | §7 — 4 trạng thái | 6 |
| `src/domain/allocate.ts` | §4 §5 — chia tiền mới / cổ tức | 7 |
| `src/domain/tickerCandidates.ts` | §11 — lọc mã dưới ngưỡng VÀ mua nổi lô | 8 |
| `src/domain/rebalanceSell.ts` | §6 Mode B | 9 |
| `src/domain/drawdown.ts` | §9 | 10 |
| `src/domain/crashReserve.ts` | §8 — episode + snapshot reserve | 11 |
| `src/domain/actionPlan.ts` | §18 §19 §20 — bộ điều phối + alerts | 12 |
| `src/domain/invariants.test.ts` | bất biến qua 1.000 snapshot sinh bằng LCG có seed | 13 |
| `src/data/portfolioRepo.ts` | CRUD Supabase thuần | 14 |
| `src/data/buildSnapshot.ts` | DB rows → `PortfolioSnapshot` | 14 |

Mỗi file domain có `*.test.ts` cạnh nó, theo đúng pattern `src/lib/stockCalc.test.ts` hiện có.

---

### Task 1: Migration core — schema, enum, 11 bảng, trigger, RLS

**Files:**
- Create: `supabase/migrations/2026-08-22-portfolio-core.sql`
- Modify: `CLAUDE.md` (thêm mục về module portfolio + luật `src/domain/`)
- Modify: `prd.md` (thêm Phase 3)

**Interfaces:**
- Consumes: bảng `public.stocks` (chỉ để tham chiếu FK `watchlist_stock_id`), hàm `public.set_updated_at()` (đã có, tạo cùng bảng `todos`)
- Produces: schema `portfolio` với 11 bảng và 4 enum — `portfolio.asset_class`, `portfolio.currency`, `portfolio.tx_type`; các bảng `instruments`, `transactions`, `prices`, `allocation_targets`, `settings`, `crash_reserve_levels`, `crash_reserve_events`, `benchmarks`, `benchmark_prices`, `snapshots`, `action_plans`

- [ ] **Step 1: NewPL bật schema `portfolio` trên Supabase Dashboard**

Việc này **con người phải làm tay**, code không làm thay được. Dừng lại và yêu cầu NewPL:

> Supabase Dashboard → **Settings → API → Exposed schemas** → thêm `portfolio` → Save.

Không có bước này thì `supabase.schema('portfolio')` sẽ trả lỗi `The schema must be one of the following: public`. Xác nhận NewPL đã làm xong rồi mới đi tiếp.

- [ ] **Step 2: Viết file migration core**

Tạo `supabase/migrations/2026-08-22-portfolio-core.sql` với nội dung sau. Phần DDL 11 bảng copy **nguyên văn** từ mục 3.3 của spec; phần grant/trigger/RLS bên dưới là phần bổ sung.

```sql
-- Migration: schema `portfolio` — nền tảng module cân bằng danh mục đầu tư.
-- Spec: docs/superpowers/specs/2026-08-22-portfolio-rebalancing-design.md
--
-- CÁCH DÙNG: Supabase Dashboard → SQL Editor → dán toàn bộ file → Run.
-- ĐIỀU KIỆN TIÊN QUYẾT: đã thêm `portfolio` vào Settings → API → Exposed schemas.
--
-- ĐƠN VỊ: MỌI cột tiền trong schema này là VND (đồng). Không có nghìn đồng, không có USD.
-- An toàn chạy lại nhiều lần (idempotent).

create schema if not exists portfolio;
grant usage on schema portfolio to anon, authenticated;

-- ---------- enum ----------
do $$ begin create type portfolio.asset_class as enum
  ('STOCKS','CRYPTO','GOLD','CASH');
exception when duplicate_object then null; end $$;

do $$ begin create type portfolio.currency as enum ('VND','USD','USDT');
exception when duplicate_object then null; end $$;

do $$ begin create type portfolio.tx_type as enum
  ('BUY','SELL','DIVIDEND','INTEREST','DEPOSIT','WITHDRAWAL','TRANSFER','FEE','ADJUSTMENT');
exception when duplicate_object then null; end $$;
```

Sau đó dán tiếp **toàn bộ 11 khối `create table`** từ mục 3.3 của spec (từ `create table if not exists portfolio.instruments (` tới hết `portfolio.action_plans`), rồi **toàn bộ khối trigger** `portfolio.tx_validate()` từ mục 3.4 của spec.

- [ ] **Step 3: Thêm trigger `updated_at` cho 4 bảng có cột đó**

Nối tiếp vào cuối file:

```sql
-- ---------- trigger updated_at ----------
-- Hàm public.set_updated_at() đã tạo cùng bảng todos; ở đây chỉ gắn trigger.
do $$
declare t text;
begin
  foreach t in array array['instruments','allocation_targets','settings','action_plans']
  loop
    execute format('drop trigger if exists %I on portfolio.%I', 'trg_'||t||'_updated_at', t);
    execute format(
      'create trigger %I before update on portfolio.%I
         for each row execute function public.set_updated_at()',
      'trg_'||t||'_updated_at', t);
  end loop;
end $$;
```

- [ ] **Step 4: Thêm RLS cho 9 bảng thường (vòng lặp, DRY)**

```sql
-- ---------- RLS: 9 bảng theo khuôn chuẩn (select/insert/update/delete own) ----------
do $$
declare t text;
begin
  foreach t in array array['instruments','prices','allocation_targets','settings',
                           'crash_reserve_levels','crash_reserve_events','benchmarks',
                           'snapshots','action_plans']
  loop
    execute format('alter table portfolio.%I enable row level security', t);

    execute format('drop policy if exists %I on portfolio.%I', t||'_select_own', t);
    execute format('create policy %I on portfolio.%I for select
                      using (auth.uid() = user_id)', t||'_select_own', t);

    execute format('drop policy if exists %I on portfolio.%I', t||'_insert_own', t);
    execute format('create policy %I on portfolio.%I for insert
                      with check (auth.uid() = user_id)', t||'_insert_own', t);

    execute format('drop policy if exists %I on portfolio.%I', t||'_update_own', t);
    execute format('create policy %I on portfolio.%I for update
                      using (auth.uid() = user_id)
                      with check (auth.uid() = user_id)', t||'_update_own', t);

    execute format('drop policy if exists %I on portfolio.%I', t||'_delete_own', t);
    execute format('create policy %I on portfolio.%I for delete
                      using (auth.uid() = user_id)', t||'_delete_own', t);
  end loop;
end $$;
```

- [ ] **Step 5: RLS đặc biệt cho `transactions` (bất biến) và `benchmark_prices` (không có user_id)**

```sql
-- ---------- RLS: transactions — CỐ TÌNH KHÔNG CÓ POLICY UPDATE ----------
-- §14 "Never overwrite historical transactions": ghi sai thì ghi một dòng
-- ADJUSTMENT bù, KHÔNG sửa bản ghi cũ. Thiếu policy UPDATE ⇒ mọi lệnh
-- UPDATE từ client đều bị RLS chặn.
alter table portfolio.transactions enable row level security;

drop policy if exists "transactions_select_own" on portfolio.transactions;
create policy "transactions_select_own" on portfolio.transactions
  for select using (auth.uid() = user_id);

drop policy if exists "transactions_insert_own" on portfolio.transactions;
create policy "transactions_insert_own" on portfolio.transactions
  for insert with check (auth.uid() = user_id);

-- Ngoại lệ có chủ đích: cho xoá trong 24 GIỜ đầu để sửa lỗi bấm sai lúc nhập.
-- Quá 24h thì lịch sử bất biến tuyệt đối.
drop policy if exists "transactions_delete_moi" on portfolio.transactions;
create policy "transactions_delete_moi" on portfolio.transactions
  for delete using (
    auth.uid() = user_id
    and created_at > now() - interval '24 hours'
  );

-- ---------- RLS: benchmark_prices — không có user_id, đi qua bảng cha ----------
alter table portfolio.benchmark_prices enable row level security;

do $$
declare
  act text;
begin
  foreach act in array array['select','insert','update','delete']
  loop
    execute format('drop policy if exists %I on portfolio.benchmark_prices',
                   'benchmark_prices_'||act||'_own');
  end loop;
end $$;

create policy "benchmark_prices_select_own" on portfolio.benchmark_prices
  for select using (exists (
    select 1 from portfolio.benchmarks b
    where b.id = benchmark_id and b.user_id = auth.uid()));

create policy "benchmark_prices_insert_own" on portfolio.benchmark_prices
  for insert with check (exists (
    select 1 from portfolio.benchmarks b
    where b.id = benchmark_id and b.user_id = auth.uid()));

create policy "benchmark_prices_update_own" on portfolio.benchmark_prices
  for update using (exists (
    select 1 from portfolio.benchmarks b
    where b.id = benchmark_id and b.user_id = auth.uid()));

create policy "benchmark_prices_delete_own" on portfolio.benchmark_prices
  for delete using (exists (
    select 1 from portfolio.benchmarks b
    where b.id = benchmark_id and b.user_id = auth.uid()));
```

- [ ] **Step 6: Grant quyền bảng cho role `authenticated`**

⚠️ Bước này **bắt buộc và dễ bị bỏ sót**. Trong schema `public`, Supabase grant sẵn cho `authenticated`; với schema mới thì **không**. Thiếu nó, RLS đúng nhưng client vẫn nhận `permission denied for table instruments`.

```sql
-- ---------- Grant (schema mới KHÔNG được Supabase grant sẵn) ----------
grant select, insert, update, delete
  on all tables in schema portfolio to authenticated;

-- Áp cho cả bảng/view tạo về sau (ví dụ 3 view ở migration kế tiếp).
alter default privileges in schema portfolio
  grant select, insert, update, delete on tables to authenticated;
```

- [ ] **Step 7: Chạy migration và xác minh**

Dán toàn bộ file vào Supabase SQL Editor → Run. Kỳ vọng: `Success. No rows returned`.

Rồi chạy truy vấn kiểm tra:

```sql
select table_name from information_schema.tables
 where table_schema = 'portfolio' order by table_name;
```
Kỳ vọng **đúng 11 dòng**: `action_plans, allocation_targets, benchmark_prices, benchmarks, crash_reserve_events, crash_reserve_levels, instruments, prices, settings, snapshots, transactions`.

```sql
select tablename, count(*) as so_policy
  from pg_policies where schemaname = 'portfolio'
 group by tablename order by tablename;
```
Kỳ vọng: mọi bảng có **4 policy**, riêng `transactions` có **3** (không có UPDATE).

- [ ] **Step 8: Chạy lại lần hai để chứng minh idempotent**

Dán lại đúng file đó → Run lần nữa. Kỳ vọng: **vẫn Success, không có lỗi nào**. Nếu lỗi `already exists` thì sửa chỗ đó thành `if not exists` / `drop ... if exists` rồi làm lại từ Step 7.

- [ ] **Step 9: Cập nhật `CLAUDE.md` — hợp thức hoá việc mở rộng phạm vi**

`CLAUDE.md` hiện ghi *"Không tự ý mở rộng phạm vi. Bám Phase 1 trong prd.md"*. Module portfolio là mở rộng **có chủ đích**, phải ghi vào để lần sau không bị coi là vi phạm. Thêm vào cuối file:

```markdown
## Module Portfolio (Phase 3)

Module cân bằng danh mục đầu tư, nằm ở tab `portfolio`.
- Yêu cầu & thiết kế: `docs/superpowers/specs/2026-08-22-portfolio-rebalancing-design.md`
- Dữ liệu: schema Postgres riêng `portfolio` (KHÔNG dùng `public`). Bảng
  `public.stocks` / `public.cryptos` giữ nguyên, chỉ đọc, đóng vai watchlist.

### Luật cứng cho `src/domain/`
- **0 dependency.** Cấm import `@supabase/supabase-js`, `react`, và mọi thứ gọi `fetch`.
- **Cấm `Date.now()` và `new Date()` không tham số.** Thời điểm truyền vào qua tham số
  (`snapshot.asOf`) để test tái lập được và để tính lại kế hoạch tháng cũ.
- **Đơn vị: VND (đồng) tuyệt đối.** Quy đổi nghìn đồng / USD chỉ được xảy ra trong
  `src/providers/`.
- Mỗi module một trách nhiệm, mỗi module một file test cạnh nó.

### Sổ giao dịch bất biến
`portfolio.transactions` không có policy UPDATE. Ghi sai thì ghi thêm một dòng
`ADJUSTMENT` bù, không sửa bản ghi cũ. Chỉ được xoá trong 24h đầu.
```

- [ ] **Step 10: Cập nhật `prd.md` — thêm Phase 3**

Thêm một mục sau `### 6.2 Phase 2b`:

```markdown
### 6.3 Phase 3 — Cân bằng danh mục đầu tư (đang triển khai)

Tab `portfolio`: theo dõi danh mục 4 nhóm tài sản (Stocks 50% / Crypto 20% /
Gold 15% / Cash 15%), so tỷ trọng thực tế với mục tiêu, và mỗi tháng sinh một
"kế hoạch hành động" nói rõ tháng này cần mua gì, bao nhiêu, mã nào.

- Không tự đặt lệnh mua/bán. App chỉ đưa đề xuất; người dùng tự thực hiện rồi ghi lại.
- Yêu cầu & thiết kế đầy đủ:
  `docs/superpowers/specs/2026-08-22-portfolio-rebalancing-design.md`
```

Đồng thời sửa dòng đánh số phiên bản ở đầu `prd.md` từ `1.1` thành `1.2` và cập nhật ghi chú trạng thái thành `(Phase 1 hoàn tất / Phase 2a hoàn tất / Phase 3 đang triển khai)`.

- [ ] **Step 11: Commit**

```bash
git add supabase/migrations/2026-08-22-portfolio-core.sql CLAUDE.md prd.md
git commit -m "feat(portfolio): schema portfolio — 11 bảng, trigger toàn vẹn, RLS

Sổ giao dịch bất biến: không có policy UPDATE, chỉ cho DELETE trong 24h.
Grant tường minh cho role authenticated vì schema ngoài public không được
Supabase grant sẵn.

Cập nhật CLAUDE.md + prd.md để hợp thức hoá Phase 3 và ghi luật cứng
cho src/domain/ (0 dependency, cấm Date.now, đơn vị VND tuyệt đối)."
```

---

### Task 2: Ba view — vị thế suy ra từ sổ giao dịch

**Files:**
- Create: `supabase/migrations/2026-08-22-portfolio-views.sql`

**Interfaces:**
- Consumes: `portfolio.transactions`, `portfolio.instruments`, `portfolio.prices` (Task 1)
- Produces: view `portfolio.v_legs` (cột `user_id, instrument_id, qty_delta, cost_delta_vnd, cash_delta_vnd`) · `portfolio.v_positions` (thêm `quantity, cost_basis_vnd, cash_balance_vnd, asset_class, symbol, name, currency, earmarked_for, price_source, lot_size, watchlist_stock_id`) · `portfolio.v_allocation` (thêm `price_vnd, price_as_of, market_value_vnd`)

- [ ] **Step 1: Viết file view**

Tạo `supabase/migrations/2026-08-22-portfolio-views.sql`, mở đầu bằng header rồi dán **nguyên văn** 3 khối `create or replace view` từ mục 3.5 của spec:

```sql
-- Migration: 3 view suy ra vị thế từ sổ giao dịch bất biến.
-- Spec mục 3.2③ và 3.5.
--
-- ⚠️ BẮT BUỘC `with (security_invoker = true)` trên CẢ BA view.
-- Thiếu nó, view chạy bằng quyền owner ⇒ RLS bị vô hiệu hoàn toàn,
-- và lỗi này KHÔNG có triệu chứng nào nhìn thấy được.
--
-- Quy ước dấu: `transactions.amount_vnd` LUÔN DƯƠNG. Dấu (+/−) chỉ tồn tại
-- ở đây — một chỗ duy nhất trong toàn hệ thống.
```

Rồi `create or replace view portfolio.v_legs ...`, `v_positions`, `v_allocation` y như mục 3.5.

Kết thúc file bằng grant (view mới tạo cần quyền tường minh):

```sql
grant select on portfolio.v_legs, portfolio.v_positions, portfolio.v_allocation
  to authenticated;
```

- [ ] **Step 2: Chạy file trong SQL Editor**

Kỳ vọng `Success. No rows returned`.

- [ ] **Step 3: Xác minh `security_invoker` đã bật trên cả 3 view**

Đây là kiểm tra bảo mật quan trọng nhất của task này — thiếu nó không có triệu chứng.

```sql
select c.relname, c.reloptions
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'portfolio' and c.relkind = 'v'
 order by c.relname;
```

Kỳ vọng **đúng 3 dòng**, mỗi dòng `reloptions = {security_invoker=true}`:

```
v_allocation  | {security_invoker=true}
v_legs        | {security_invoker=true}
v_positions   | {security_invoker=true}
```

Nếu `reloptions` là `NULL` ở bất kỳ dòng nào → view đó thiếu `with (security_invoker = true)`. Sửa file rồi làm lại từ Step 2. **Không đi tiếp khi chưa đủ 3 dòng đúng.**

- [ ] **Step 4: Kiểm chứng bút toán kép bằng một kịch bản thật (có ROLLBACK)**

Đây là phần rủi ro nhất của cả plan: quy ước dấu trong `v_legs`. Phải kiểm bằng dữ liệu thật, không được suy luận.

Kịch bản dùng đẳng thức kế toán để tự chứng minh:
```
1. DEPOSIT 10.000.000 vào VND-RESERVE
2. TRANSFER 6.000.000  VND-RESERVE → VND-DCA-STOCKS
3. BUY 100 HND @ 13.300 = 1.330.000, trả bằng VND-DCA-STOCKS
4. DIVIDEND HND 80.000 vào VND-RESERVE

Kỳ vọng: RESERVE 4.080.000 · DCA-STOCKS 4.670.000 · HND qty 100, giá vốn 1.330.000
Đẳng thức: (4.080.000 + 4.670.000) + 1.330.000 = 10.080.000 = 10.000.000 nạp + 80.000 cổ tức
```

Chạy trọn khối sau trong SQL Editor. Nó **tự ROLLBACK**, không để lại dữ liệu rác nào trong sổ thật:

```sql
begin;

-- Dùng đúng user thật (đổi email nếu NewPL đăng nhập bằng địa chỉ khác).
create temporary table _u as
  select id from auth.users where email = 'phuonglegtvt92@gmail.com';

insert into portfolio.instruments (user_id, asset_class, symbol, name, earmarked_for, lot_size)
select u.id, 'CASH', '_T_RESERVE', 'test', null, 1 from _u u;

insert into portfolio.instruments (user_id, asset_class, symbol, name, earmarked_for, lot_size)
select u.id, 'CASH', '_T_DCA_STOCKS', 'test', 'STOCKS', 1 from _u u;

insert into portfolio.instruments (user_id, asset_class, symbol, name, lot_size)
select u.id, 'STOCKS', '_T_HND', 'test', 100 from _u u;

-- 1) nạp 10tr vào RESERVE
insert into portfolio.transactions
  (user_id, traded_at, type, instrument_id, amount_vnd, currency)
select u.id, '2026-08-01', 'DEPOSIT', i.id, 10000000, 'VND'
  from _u u join portfolio.instruments i
    on i.user_id = u.id and i.symbol = '_T_RESERVE';

-- 2) chuyển 6tr sang túi DCA Stocks (đích = instrument_id, nguồn = cash_instrument_id)
insert into portfolio.transactions
  (user_id, traded_at, type, instrument_id, cash_instrument_id, amount_vnd, currency)
select u.id, '2026-08-02', 'TRANSFER', d.id, s.id, 6000000, 'VND'
  from _u u
  join portfolio.instruments d on d.user_id = u.id and d.symbol = '_T_DCA_STOCKS'
  join portfolio.instruments s on s.user_id = u.id and s.symbol = '_T_RESERVE';

-- 3) mua 100 HND @ 13.300 bằng tiền túi DCA Stocks
insert into portfolio.transactions
  (user_id, traded_at, type, instrument_id, cash_instrument_id,
   quantity, price, amount_vnd, currency)
select u.id, '2026-08-03', 'BUY', h.id, d.id, 100, 13300, 1330000, 'VND'
  from _u u
  join portfolio.instruments h on h.user_id = u.id and h.symbol = '_T_HND'
  join portfolio.instruments d on d.user_id = u.id and d.symbol = '_T_DCA_STOCKS';

-- 4) cổ tức HND 80.000 về RESERVE
insert into portfolio.transactions
  (user_id, traded_at, type, instrument_id, cash_instrument_id, amount_vnd, currency)
select u.id, '2026-08-20', 'DIVIDEND', h.id, s.id, 80000, 'VND'
  from _u u
  join portfolio.instruments h on h.user_id = u.id and h.symbol = '_T_HND'
  join portfolio.instruments s on s.user_id = u.id and s.symbol = '_T_RESERVE';

-- ---- KIỂM: sai thì RAISE, đúng thì im lặng ----
do $$
declare
  v_reserve numeric; v_dca numeric; v_qty numeric; v_cost numeric;
begin
  select cash_balance_vnd into v_reserve
    from portfolio.v_positions where symbol = '_T_RESERVE';
  select cash_balance_vnd into v_dca
    from portfolio.v_positions where symbol = '_T_DCA_STOCKS';
  select quantity, cost_basis_vnd into v_qty, v_cost
    from portfolio.v_positions where symbol = '_T_HND';

  if v_reserve <> 4080000 then
    raise exception 'RESERVE sai: mong 4080000, thực %', v_reserve; end if;
  if v_dca <> 4670000 then
    raise exception 'DCA-STOCKS sai: mong 4670000, thực %', v_dca; end if;
  if v_qty <> 100 then
    raise exception 'HND quantity sai: mong 100, thực %', v_qty; end if;
  if v_cost <> 1330000 then
    raise exception 'HND cost_basis sai: mong 1330000, thực %', v_cost; end if;
  if (v_reserve + v_dca + v_cost) <> 10080000 then
    raise exception 'Đẳng thức kế toán KHÔNG cân: % <> 10080000',
      v_reserve + v_dca + v_cost; end if;

  raise notice '✓ Bút toán kép đúng. RESERVE=% DCA=% HND qty=% cost=%',
    v_reserve, v_dca, v_qty, v_cost;
end $$;

rollback;
```

Kỳ vọng: output có dòng `NOTICE: ✓ Bút toán kép đúng. RESERVE=4080000 DCA=4670000 HND qty=100 cost=1330000`.

Nếu có `ERROR` → quy ước dấu trong `v_legs` sai. Đọc message để biết chân nào lệch, sửa `v_legs` rồi làm lại từ Step 2.

- [ ] **Step 5: Kiểm `v_allocation` xử lý đúng trường hợp thiếu giá**

Tài sản đang giữ mà chưa có giá **phải** ra `market_value_vnd = NULL`, không phải `0`. Đây là điều kiện để engine từ chối tạo kế hoạch (spec mục 6.4).

Chạy lại khối ở Step 4 nhưng đổi hai dòng cuối thành:

```sql
do $$
declare v_mv numeric;
begin
  select market_value_vnd into v_mv
    from portfolio.v_allocation where symbol = '_T_HND';
  if v_mv is not null then
    raise exception 'Thiếu giá phải ra NULL, không phải %', v_mv;
  end if;
  raise notice '✓ Thiếu giá → market_value_vnd = NULL, đúng như thiết kế';
end $$;

rollback;
```

Kỳ vọng dòng `NOTICE: ✓ Thiếu giá → market_value_vnd = NULL, đúng như thiết kế`.

- [ ] **Step 6: Xác minh không còn dữ liệu test sót lại**

```sql
select count(*) from portfolio.instruments where symbol like '\_T\_%';
```
Kỳ vọng `0`. Nếu khác 0 thì có khối nào đã commit — xoá bằng
`delete from portfolio.instruments where symbol like '\_T\_%';` (các transaction liên quan bị xoá theo FK... **không**, FK `transactions.instrument_id` không có `on delete cascade` → xoá transaction trước, rồi mới xoá instrument).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/2026-08-22-portfolio-views.sql
git commit -m "feat(portfolio): 3 view suy vị thế từ sổ giao dịch

v_legs tách mỗi transaction thành các chân bút toán — đây là nơi DUY NHẤT
trong hệ thống có dấu (+/-); amount_vnd luôn dương.

Đã kiểm chứng bút toán kép bằng kịch bản thật có ROLLBACK: nạp 10tr →
chuyển 6tr sang túi DCA → mua 100 HND 1,33tr → cổ tức 80k. Đẳng thức kế
toán cân đúng 10.080.000.

Cả 3 view có security_invoker=true — thiếu là RLS bị vô hiệu không triệu chứng."
```

---

### Task 3: Seed — cấu hình, 4 túi tiền, benchmark, instrument từ watchlist cũ

**Files:**
- Create: `supabase/migrations/2026-08-22-portfolio-seed.sql`

**Interfaces:**
- Consumes: `public.stocks`, `public.cryptos` (**chỉ đọc**), 11 bảng từ Task 1
- Produces: 1 dòng `settings`, 4 dòng `allocation_targets`, 5 dòng `crash_reserve_levels`, 4 túi tiền + 1 instrument vàng + N instrument crypto + 56 instrument cổ phiếu trong `instruments`, 3 dòng `benchmarks`

**Lưu ý phạm vi:** task này **chỉ tạo instrument**, không tạo `transactions`. Việc nạp vị thế thật (số lượng, giá mua, ngày) cần con người nhập — thuộc đợt 3, màn `InitialPositionsWizard`. Không được bịa ngày giao dịch.

- [ ] **Step 1: Viết header + settings + targets + crash levels**

Tạo `supabase/migrations/2026-08-22-portfolio-seed.sql`:

```sql
-- Seed: cấu hình khởi tạo + túi tiền + instrument cho module portfolio.
-- Spec mục 8.
--
-- CÁCH DÙNG: Supabase Dashboard → SQL Editor → dán toàn bộ → Run.
-- Chạy với tài khoản có email dưới đây (đổi nếu NewPL đăng nhập bằng email khác).
-- AN TOÀN CHẠY LẠI: chỉ thêm cái CHƯA có (on conflict do nothing / not exists).
--
-- KHÔNG tạo transactions. Nạp vị thế thật làm ở màn InitialPositionsWizard (đợt 3).

-- ---------- settings ----------
insert into portfolio.settings (user_id)
select u.id from auth.users u where u.email = 'phuonglegtvt92@gmail.com'
on conflict (user_id) do nothing;

-- ---------- allocation_targets: 50/20/15/15 + band §2 ----------
insert into portfolio.allocation_targets
  (user_id, asset_class, target_pct, min_pct, max_pct)
select u.id, v.ac, v.t, v.mn, v.mx
  from auth.users u
 cross join (values
   ('STOCKS'::portfolio.asset_class, 50, 40, 55),
   ('CRYPTO'::portfolio.asset_class, 20, 15, 25),
   ('GOLD'::portfolio.asset_class,   15, 10, 20),
   ('CASH'::portfolio.asset_class,   15,  7, 20)
 ) as v(ac, t, mn, mx)
 where u.email = 'phuonglegtvt92@gmail.com'
on conflict (user_id, asset_class) do nothing;

-- ---------- crash_reserve_levels §8 ----------
-- Tổng 10+15+20+25+30 = 100% (bậc 5 dùng "phần còn lại").
insert into portfolio.crash_reserve_levels
  (user_id, level, drawdown_pct, deploy_pct_of_reserve)
select u.id, v.lv, v.dd, v.dep
  from auth.users u
 cross join (values (1,15,10),(2,25,15),(3,35,20),(4,45,25),(5,55,30))
   as v(lv, dd, dep)
 where u.email = 'phuonglegtvt92@gmail.com'
on conflict (user_id, level) do nothing;
```

- [ ] **Step 2: Bốn túi tiền + instrument vàng**

Nối tiếp. `earmarked_for` là cột giải quyết bài toán DCA (spec mục 3.2①).

```sql
-- ---------- 4 túi tiền + 1 instrument vàng ----------
insert into portfolio.instruments
  (user_id, asset_class, symbol, name, currency, price_source, earmarked_for, lot_size)
select u.id, v.ac::portfolio.asset_class, v.sym, v.nm,
       v.cur::portfolio.currency, v.src, v.ear::portfolio.asset_class, v.lot
  from auth.users u
 cross join (values
   ('CASH','VND-RESERVE',    'Tiền mặt dự phòng (chứa Crash Reserve)', 'VND','MANUAL', null,     1),
   ('CASH','VND-DCA-STOCKS', 'Tiền đã đặt tên cho Stocks',             'VND','MANUAL','STOCKS',  1),
   ('CASH','VND-DCA-CRYPTO', 'Tiền đã đặt tên cho Crypto',             'VND','MANUAL','CRYPTO',  1),
   ('CASH','VND-DCA-GOLD',   'Tiền đã đặt tên cho Gold',               'VND','MANUAL','GOLD',    1),
   ('GOLD','SJC-1L',         'Vàng miếng SJC 1 lượng',                 'VND','MANUAL', null,     1)
 ) as v(ac, sym, nm, cur, src, ear, lot)
 where u.email = 'phuonglegtvt92@gmail.com'
on conflict (user_id, symbol) do nothing;
```

- [ ] **Step 3: Ba benchmark §9**

```sql
-- ---------- benchmarks §9 ----------
-- VNINDEX qua dchart (cần verify khi làm providers, đợt 4). XAU nhập tay.
insert into portfolio.benchmarks (user_id, asset_class, symbol, name, price_source)
select u.id, v.ac::portfolio.asset_class, v.sym, v.nm, v.src
  from auth.users u
 cross join (values
   ('STOCKS','VNINDEX','Chỉ số VN-Index',      'VNDIRECT'),
   ('CRYPTO','BTC',    'Bitcoin (đo từ ATH)',  'BINANCE'),
   ('GOLD',  'XAU',    'Giá vàng tham chiếu',  'MANUAL')
 ) as v(ac, sym, nm, src)
 where u.email = 'phuonglegtvt92@gmail.com'
on conflict (user_id, asset_class, symbol) do nothing;
```

- [ ] **Step 4: Chuyển 56 mã watchlist + coin từ bảng cũ thành instrument**

```sql
-- ---------- instrument cổ phiếu, lấy từ watchlist public.stocks ----------
-- lot_size = 100: HOSE/HNX giao dịch lô chẵn 100 cổ phiếu. Đây là ràng buộc
-- quyết định trong tickerCandidates.ts (spec mục 4.6).
insert into portfolio.instruments
  (user_id, asset_class, symbol, name, currency, price_source,
   watchlist_stock_id, lot_size, sort_order)
select s.user_id, 'STOCKS', s.ticker, s.company_name, 'VND', 'VNDIRECT',
       s.id, 100, s.sort_order
  from public.stocks s
  join auth.users u on u.id = s.user_id
 where u.email = 'phuonglegtvt92@gmail.com'
on conflict (user_id, symbol) do nothing;

-- ---------- instrument crypto, lấy từ public.cryptos ----------
insert into portfolio.instruments
  (user_id, asset_class, symbol, name, currency, price_source, lot_size, sort_order)
select c.user_id, 'CRYPTO', c.symbol,
       case when c.name = '' then c.symbol else c.name end,
       'USD', 'BINANCE', 1, c.sort_order
  from public.cryptos c
  join auth.users u on u.id = c.user_id
 where u.email = 'phuonglegtvt92@gmail.com'
on conflict (user_id, symbol) do nothing;
```

- [ ] **Step 5: Chạy seed và xác minh**

Dán file vào SQL Editor → Run.

```sql
select asset_class, count(*) from portfolio.instruments group by asset_class order by 1;
```
Kỳ vọng: `CASH 4` · `GOLD 1` · `STOCKS 56` · `CRYPTO <số coin trong bảng cryptos>`.

```sql
select asset_class, target_pct, min_pct, max_pct
  from portfolio.allocation_targets order by asset_class;
```
Kỳ vọng 4 dòng: `CASH 15/7/20` · `CRYPTO 20/15/25` · `GOLD 15/10/20` · `STOCKS 50/40/55`.

```sql
select symbol, earmarked_for from portfolio.instruments
 where asset_class = 'CASH' order by symbol;
```
Kỳ vọng: `VND-DCA-CRYPTO→CRYPTO` · `VND-DCA-GOLD→GOLD` · `VND-DCA-STOCKS→STOCKS` · `VND-RESERVE→NULL`.

```sql
select count(*) from portfolio.crash_reserve_levels;
select sum(deploy_pct_of_reserve) from portfolio.crash_reserve_levels;
```
Kỳ vọng `5` và `100`.

- [ ] **Step 6: Chạy lại lần hai để chứng minh idempotent**

Run lại đúng file. Kỳ vọng: Success, và `select count(*) from portfolio.instruments;` **không đổi** so với Step 5.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/2026-08-22-portfolio-seed.sql
git commit -m "feat(portfolio): seed cấu hình, 4 túi tiền, benchmark, instrument từ watchlist

56 mã từ public.stocks vào làm watchlist (lot_size=100 — HOSE giao dịch lô chẵn).
Chưa có giao dịch thì vị thế = 0, đúng như thiết kế.

Bốn túi CASH mang earmarked_for để tính được cả tỷ trọng earmarked và deployed
từ cùng một dữ liệu (spec mục 3.2①).

KHÔNG tạo transactions — nạp vị thế thật cần con người nhập, làm ở đợt 3."
```

---

### Task 4: `types.ts` + `money.ts` — hợp đồng của cả tầng domain

**Files:**
- Create: `src/domain/types.ts`
- Create: `src/domain/money.ts`
- Test: `src/domain/money.test.ts`

**Interfaces:**
- Consumes: không gì cả (đây là đáy của tầng)
- Produces: `AssetClass`, `ASSET_CLASSES`, `BandStatus`, `TargetBand`, `EngineConfig`, `DEFAULT_CONFIG`, `Weight`, `Allocation`, `AllocationResult`, `WatchlistItem`, `Candidate`, `ShortfallNote`, `CandidateResult`, `SellOrder`, `SellPlan`, `CrashLevel`, `CrashEventRecord`, `CrashRecommendation`, `DrawdownStats`, `Alert`, `ActionPlan`, `PortfolioSnapshot` · `roundDownTo(value, step)`, `sumVnd(values)`, `daysBetween(fromIso, toIso)`

**Hai điều chỉnh so với spec, có lý do:**

1. **Bỏ công thức `PROPORTIONAL_PP`.** Spec mục 4.1 liệt kê 3 công thức. Nhưng "chia tỷ lệ theo điểm % lệch" và "chia tỷ lệ theo khoảng thiếu VND" là **cùng một đại lượng nhân với một hằng số** (`gap = total/100 × (targetPct − weightPct)`) ⇒ cho ra tỷ lệ y hệt nhau. Biến thể duy nhất còn khác là bản *naive* tính trên tổng cũ và bỏ qua chỗ Z đang nằm — tức là một phiên bản **kém hơn** của cùng công thức. Giữ nó chỉ tạo một lựa chọn cấu hình chết. Chỉ hiện thực 2: `PROPORTIONAL_GAP` (mặc định) và `PRIORITY_WATERFALL` (hành vi thật sự khác). Cột DB là `text` nên thêm lại sau không cần migration.
2. **Thêm field `contributionRecordedThisPeriod: boolean` vào `PortfolioSnapshot`.** §19 yêu cầu alert *"Monthly contribution missing"* nhưng `PortfolioSnapshot` trong spec mục 4.1 không có dữ liệu nào để biết điều đó. Đây là lỗ hổng trong spec — bổ sung một field.

- [ ] **Step 1: Viết `src/domain/types.ts`**

```ts
// Hợp đồng kiểu của toàn bộ tầng domain.
// LUẬT: file này (và mọi file trong src/domain/) KHÔNG import gì cả.
// Không supabase, không react, không fetch, không Date.now().

export type AssetClass = 'STOCKS' | 'CRYPTO' | 'GOLD' | 'CASH';

/** Thứ tự cố định dùng cho mọi vòng lặp — để kết quả luôn tái lập được. */
export const ASSET_CLASSES: readonly AssetClass[] = ['STOCKS', 'CRYPTO', 'GOLD', 'CASH'];

/**
 * Bốn mức trạng thái, giải mâu thuẫn của §7 (spec mục 4.3).
 * Band là CỔNG, điểm % chỉ nâng mức độ. Lệnh bán chỉ mở ở REBALANCE_REQUIRED.
 */
export type BandStatus = 'OK' | 'WATCH' | 'OUT_OF_BAND' | 'REBALANCE_REQUIRED';

export interface TargetBand {
  targetPct: number;
  minPct: number;
  maxPct: number;
}

export type AllocationFormula = 'PROPORTIONAL_GAP' | 'PRIORITY_WATERFALL';

export interface EngineConfig {
  formula: AllocationFormula;
  /** Trong band nhưng lệch ≥ ngưỡng này → WATCH (cảnh báo mềm, không bán). */
  watchDeviationPp: number;
  /** Ngoài band VÀ lệch ≥ ngưỡng này → REBALANCE_REQUIRED (mở khoá lệnh bán). */
  strongRebalancePp: number;
  /** §18: không sinh lệnh bán vụn dưới mức này. */
  minSellAmountVnd: number;
  roundingStepVnd: number;
  /** false = tiền mới luôn đi vào tài sản, không để lại Cash. */
  cashEligibleForNewCapital: boolean;
  sellTo: 'TARGET' | 'BAND_EDGE';
  /** Chỉ dùng khi formula = PRIORITY_WATERFALL. Số lớn = ưu tiên trước. */
  classPriority: Record<AssetClass, number>;
}

export const DEFAULT_CONFIG: EngineConfig = {
  formula: 'PROPORTIONAL_GAP',
  watchDeviationPp: 3,
  strongRebalancePp: 5,
  minSellAmountVnd: 5_000_000,
  roundingStepVnd: 100_000,
  cashEligibleForNewCapital: true,
  sellTo: 'TARGET',
  classPriority: { STOCKS: 4, CRYPTO: 3, GOLD: 2, CASH: 1 },
};

/** §17. Tất cả tính trên TỔNG HIỆN TẠI (không cộng tiền mới). */
export interface Weight {
  assetClass: AssetClass;
  valueVnd: number;
  weightPct: number;
  targetPct: number;
  deviationPp: number;
  targetValueVnd: number;
  /** targetValueVnd − valueVnd. Dương = thiếu, âm = thừa. */
  differenceVnd: number;
}

export interface Allocation {
  assetClass: AssetClass;
  amountVnd: number;
  /** Khoảng thiếu đã dùng để chia — giữ lại để giải thích trên UI. */
  gapVnd: number;
}

/**
 * BẤT BIẾN: sum(allocations.amountVnd) + unallocatedVnd === poolVnd, LUÔN LUÔN.
 * Khi mọi class đều thừa (không có ứng viên), toàn bộ pool rơi vào unallocatedVnd
 * — tiền không được phép biến mất.
 */
export interface AllocationResult {
  allocations: Allocation[];
  unallocatedVnd: number;
}

export type StockGroupVi = 'attack' | 'balance' | 'defense';

export interface WatchlistItem {
  symbol: string;
  name: string;
  group: StockGroupVi;
  currentPriceVnd: number | null;
  thresholdVnd: number | null;
  lotSize: number;
}

export interface Candidate {
  symbol: string;
  name: string;
  group: StockGroupVi;
  priceVnd: number;
  /** priceVnd × lotSize — số tiền tối thiểu để mua được 1 lô. */
  lotCostVnd: number;
  /** Giá đang thấp hơn ngưỡng bao nhiêu %. Càng lớn càng "rẻ". */
  belowThresholdPct: number;
}

export interface ShortfallNote {
  symbol: string;
  lotCostVnd: number;
  shortfallVnd: number;
  /** null khi không có tiền vào hàng tháng (không suy ra được bao lâu). */
  monthsToAfford: number | null;
}

export interface CandidateResult {
  affordable: Candidate[];
  shortfalls: ShortfallNote[];
}

export interface SellOrder {
  assetClass: AssetClass;
  sellVnd: number;
}

/**
 * BẤT BIẾN: sum(destinations) + unallocatedVnd === sum(sells), LUÔN LUÔN.
 * unallocatedVnd > 0 xảy ra khi mọi nhóm còn lại đều thừa và Cash bị loại bằng
 * cấu hình — tiền bán được vẫn phải hiện ra, không được biến mất im lặng.
 */
export interface SellPlan {
  sells: SellOrder[];
  /** Tiền bán được phân bổ vào đâu. */
  destinations: Allocation[];
  /** Tiền bán được mà không có nhóm nào nhận — nằm lại trong VND-RESERVE. */
  unallocatedVnd: number;
  /** Lệnh bị bỏ vì dưới minSellAmountVnd — vẫn phải báo, không nuốt im lặng. */
  skipped: { assetClass: AssetClass; wouldSellVnd: number }[];
}

export interface CrashLevel {
  level: number;
  drawdownPct: number;
  deployPctOfReserve: number;
}

export interface CrashEventRecord {
  level: number;
  episodeStart: string;
  reserveAtEpisodeStartVnd: number;
}

export interface CrashRecommendation {
  episodeStart: string;
  /** Số dư reserve tại lúc đợt sụt giảm bắt đầu. MỌI % tính trên số này. */
  reserveAtEpisodeStartVnd: number;
  triggeredLevels: { level: number; drawdownPct: number; deployVnd: number }[];
  totalDeployVnd: number;
  /** Bậc kế tiếp chưa tới, để UI hiện "còn cách bao nhiêu". */
  nextLevel: { level: number; drawdownPct: number; gapPp: number } | null;
}

export interface DrawdownStats {
  currentPct: number;
  maxPct: number;
  ath: { date: string; value: number };
  trough: { date: string; value: number };
  daysSinceHigh: number;
  recoveryPct: number;
}

export type AlertCode =
  | 'OUT_OF_BAND'
  | 'REBALANCE_REQUIRED'
  | 'STOCK_DRAWDOWN'
  | 'CRYPTO_DRAWDOWN'
  | 'GOLD_DRAWDOWN'
  | 'PORTFOLIO_DRAWDOWN'
  | 'CASH_BELOW_MIN'
  | 'CONTRIBUTION_MISSING';

export interface Alert {
  code: AlertCode;
  severity: 'INFO' | 'WARN' | 'ACTION';
  message: string;
}

export type PlanStatus = 'READY' | 'EMPTY_PORTFOLIO' | 'MISSING_PRICES';

export interface ActionPlan {
  asOf: string;
  status: PlanStatus;
  /** Lý do không tạo được kế hoạch, tiếng Việt, hiện thẳng cho người dùng. */
  blockedReason: string | null;
  totalVnd: number;
  weights: Weight[];
  statuses: Record<AssetClass, BandStatus>;
  sources: {
    monthlyContributionVnd: number;
    incomeReceivedVnd: number;
    poolVnd: number;
  };
  buys: Allocation[];
  unallocatedVnd: number;
  doNotBuy: { assetClass: AssetClass; reason: string }[];
  tickerCandidates: CandidateResult;
  sellPlan: SellPlan | null;
  crash: CrashRecommendation | null;
  alerts: Alert[];
}

export interface PortfolioSnapshot {
  /** ISO date. LUÔN truyền vào — domain không được gọi Date.now(). */
  asOf: string;
  /** Giá trị đã giải ngân theo asset_class (VND). Túi DCA nằm ở CASH. */
  classValues: Record<AssetClass, number>;
  /** Tiền trong từng túi DCA (VND). earmarkedPots.CASH luôn = 0. */
  earmarkedPots: Record<AssetClass, number>;
  /** Số dư túi VND-RESERVE (VND). */
  cashReserveVnd: number;
  targets: Record<AssetClass, TargetBand>;
  monthlyContributionVnd: number;
  incomeReceivedVnd: number;
  drawdowns: Record<AssetClass, number>;
  portfolioDrawdownPct: number;
  crashLevels: CrashLevel[];
  crashHistory: CrashEventRecord[];
  currentEpisodeStart: string;
  /** Tài sản ĐANG GIỮ mà thiếu giá. Khác rỗng ⇒ từ chối tạo kế hoạch. */
  missingPriceSymbols: string[];
  /** §19 CONTRIBUTION_MISSING: kỳ này đã ghi nhận tiền vào chưa. */
  contributionRecordedThisPeriod: boolean;
  watchlist: WatchlistItem[];
  config: EngineConfig;
}
```

- [ ] **Step 2: Viết test cho `money.ts` (chưa có file nguồn — test phải fail)**

Tạo `src/domain/money.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { roundDownTo, sumVnd, daysBetween } from './money';

describe('roundDownTo', () => {
  it('làm tròn XUỐNG bội số gần nhất', () => {
    expect(roundDownTo(1_420_789, 100_000)).toBe(1_400_000);
    expect(roundDownTo(1_579_211, 100_000)).toBe(1_500_000);
  });

  it('giữ nguyên khi đã là bội số', () => {
    expect(roundDownTo(1_400_000, 100_000)).toBe(1_400_000);
  });

  it('trả 0 khi nhỏ hơn một bước', () => {
    expect(roundDownTo(99_999, 100_000)).toBe(0);
  });

  it('trả nguyên giá trị khi bước <= 0 (không chia cho 0)', () => {
    expect(roundDownTo(1_234_567, 0)).toBe(1_234_567);
    expect(roundDownTo(1_234_567, -5)).toBe(1_234_567);
  });

  it('kết quả luôn là bội số đúng của bước (không lệch dấu phẩy động)', () => {
    for (const v of [1, 333_333, 999_999_999, 1_000_000_001]) {
      expect(roundDownTo(v, 100_000) % 100_000).toBe(0);
    }
  });
});

describe('sumVnd', () => {
  it('cộng chính xác, mảng rỗng ra 0', () => {
    expect(sumVnd([])).toBe(0);
    expect(sumVnd([1_400_000, 1_600_000])).toBe(3_000_000);
  });
});

describe('daysBetween', () => {
  it('đếm đúng số ngày giữa hai mốc ISO', () => {
    expect(daysBetween('2026-08-01', '2026-08-22')).toBe(21);
    expect(daysBetween('2026-08-22', '2026-08-22')).toBe(0);
  });

  it('trả số âm khi mốc sau nằm trước mốc trước', () => {
    expect(daysBetween('2026-08-22', '2026-08-01')).toBe(-21);
  });

  it('không bị lệch vì giờ trong ngày', () => {
    expect(daysBetween('2026-08-01T23:00:00Z', '2026-08-02T01:00:00Z')).toBe(0);
  });
});
```

- [ ] **Step 3: Chạy test để chắc chắn nó fail**

Run: `npx vitest run src/domain/money.test.ts`
Kỳ vọng: FAIL với `Failed to resolve import "./money"`.

- [ ] **Step 4: Viết `src/domain/money.ts`**

```ts
// Tiện ích số/ngày cho tầng domain. Hàm thuần, không import gì.

/**
 * Làm tròn XUỐNG bội số của `step`. Dùng để không sinh lệnh mua lẻ đồng.
 * `step <= 0` → trả nguyên giá trị (không chia cho 0).
 */
export function roundDownTo(value: number, step: number): number {
  if (step <= 0) return value;
  return Math.floor(value / step) * step;
}

/** Tổng một danh sách số tiền VND. Mảng rỗng → 0. */
export function sumVnd(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0);
}

/**
 * Số ngày từ `fromIso` tới `toIso`, tính theo NGÀY LỊCH (bỏ phần giờ)
 * để không bị lệch vì múi giờ hay giờ trong ngày. Âm nếu `toIso` sớm hơn.
 *
 * Dùng Date.parse trên chuỗi truyền vào — KHÔNG phải Date.now(), nên vẫn
 * tái lập được hoàn toàn.
 */
export function daysBetween(fromIso: string, toIso: string): number {
  const dayOf = (iso: string): number => {
    const ms = Date.parse(iso.slice(0, 10));
    if (Number.isNaN(ms)) {
      throw new Error(`Ngày không hợp lệ: "${iso}". Cần định dạng ISO (YYYY-MM-DD).`);
    }
    return Math.round(ms / 86_400_000);
  };
  return dayOf(toIso) - dayOf(fromIso);
}
```

- [ ] **Step 5: Chạy test để xác nhận pass**

Run: `npx vitest run src/domain/money.test.ts`
Kỳ vọng: PASS, 10 test.

- [ ] **Step 6: Kiểm typecheck (types.ts chưa có test riêng nên phải kiểm bằng tsc)**

Run: `npm run build`
Kỳ vọng: build thành công, không có lỗi TypeScript. Nếu báo `noUnusedLocals` ở `types.ts` thì bỏ qua — file chỉ export type, không có local.

- [ ] **Step 7: Commit**

```bash
git add src/domain/types.ts src/domain/money.ts src/domain/money.test.ts
git commit -m "feat(portfolio): types + tiện ích tiền/ngày cho tầng domain

BẤT BIẾN đặt ngay trong kiểu: AllocationResult luôn thoả
sum(allocations) + unallocatedVnd === poolVnd — tiền không được biến mất.

Hai điều chỉnh so với spec, đã ghi lý do trong plan:
- bỏ công thức PROPORTIONAL_PP (trùng PROPORTIONAL_GAP về mặt toán học)
- thêm contributionRecordedThisPeriod vào snapshot (§19 cần mà spec thiếu)"
```

---

### Task 5: `weights.ts` — §17 tỷ trọng, target value, difference

**Files:**
- Create: `src/domain/weights.ts`
- Test: `src/domain/weights.test.ts`

**Interfaces:**
- Consumes: `AssetClass`, `ASSET_CLASSES`, `TargetBand`, `Weight` (Task 4)
- Produces: `computeWeights(values: Record<AssetClass, number>, targets: Record<AssetClass, TargetBand>): Weight[]` — trả mảng theo đúng thứ tự `ASSET_CLASSES`. `totalVnd(values: Record<AssetClass, number>): number`

**Quyết định thiết kế:** `computeWeights` **không** nhận tiền mới. Nó tính trên tổng hiện tại, đúng công thức §17 nguyên văn, dùng cho hiển thị và cho `bands.ts`. Việc tính khoảng thiếu trên `newTotal` (có cộng tiền mới) là việc của `allocate.ts` — hai mục đích khác nhau, không nhồi vào một hàm.

- [ ] **Step 1: Viết test (chưa có file nguồn)**

Tạo `src/domain/weights.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeWeights, totalVnd } from './weights';
import { ASSET_CLASSES } from './types';
import type { AssetClass, TargetBand } from './types';

const TARGETS: Record<AssetClass, TargetBand> = {
  STOCKS: { targetPct: 50, minPct: 40, maxPct: 55 },
  CRYPTO: { targetPct: 20, minPct: 15, maxPct: 25 },
  GOLD:   { targetPct: 15, minPct: 10, maxPct: 20 },
  CASH:   { targetPct: 15, minPct: 7,  maxPct: 20 },
};

// Bộ số của ví dụ §21 trong spec gốc — dùng xuyên suốt các test engine.
const VI_DU_21: Record<AssetClass, number> = {
  STOCKS: 513_300_000,
  CRYPTO: 269_700_000,
  GOLD:   179_437_500,
  CASH:   125_062_500,
};

describe('totalVnd', () => {
  it('cộng đúng 4 class', () => {
    expect(totalVnd(VI_DU_21)).toBe(1_087_500_000);
  });

  it('danh mục rỗng ra 0', () => {
    expect(totalVnd({ STOCKS: 0, CRYPTO: 0, GOLD: 0, CASH: 0 })).toBe(0);
  });
});

describe('computeWeights — ví dụ §21', () => {
  const ws = computeWeights(VI_DU_21, TARGETS);
  const by = (c: AssetClass) => ws.find((w) => w.assetClass === c)!;

  it('trả đúng 4 dòng, đúng thứ tự ASSET_CLASSES', () => {
    expect(ws.map((w) => w.assetClass)).toEqual([...ASSET_CLASSES]);
  });

  it('tỷ trọng khớp §21: 47,2 / 24,8 / 16,5 / 11,5', () => {
    expect(by('STOCKS').weightPct).toBeCloseTo(47.2, 6);
    expect(by('CRYPTO').weightPct).toBeCloseTo(24.8, 6);
    expect(by('GOLD').weightPct).toBeCloseTo(16.5, 6);
    expect(by('CASH').weightPct).toBeCloseTo(11.5, 6);
  });

  it('độ lệch điểm % khớp §21: −2,8 / +4,8 / +1,5 / −3,5', () => {
    expect(by('STOCKS').deviationPp).toBeCloseTo(-2.8, 6);
    expect(by('CRYPTO').deviationPp).toBeCloseTo(+4.8, 6);
    expect(by('GOLD').deviationPp).toBeCloseTo(+1.5, 6);
    expect(by('CASH').deviationPp).toBeCloseTo(-3.5, 6);
  });

  it('target_value và difference tính trên TỔNG HIỆN TẠI (đúng §17)', () => {
    expect(by('STOCKS').targetValueVnd).toBeCloseTo(543_750_000, 3);
    expect(by('STOCKS').differenceVnd).toBeCloseTo(+30_450_000, 3);
    expect(by('CRYPTO').differenceVnd).toBeCloseTo(-52_200_000, 3);
    expect(by('GOLD').differenceVnd).toBeCloseTo(-16_312_500, 3);
    expect(by('CASH').differenceVnd).toBeCloseTo(+38_062_500, 3);
  });

  it('tổng tỷ trọng bằng 100%', () => {
    const tong = ws.reduce((s, w) => s + w.weightPct, 0);
    expect(tong).toBeCloseTo(100, 6);
  });
});

describe('computeWeights — biên', () => {
  it('danh mục rỗng: mọi tỷ trọng = 0, KHÔNG ra NaN', () => {
    const ws = computeWeights({ STOCKS: 0, CRYPTO: 0, GOLD: 0, CASH: 0 }, TARGETS);
    for (const w of ws) {
      expect(Number.isNaN(w.weightPct)).toBe(false);
      expect(w.weightPct).toBe(0);
      expect(w.targetValueVnd).toBe(0);
      expect(w.differenceVnd).toBe(0);
    }
  });

  it('dồn hết vào một class: class đó 100%, còn lại 0', () => {
    const ws = computeWeights(
      { STOCKS: 1_000_000_000, CRYPTO: 0, GOLD: 0, CASH: 0 }, TARGETS);
    expect(ws.find((w) => w.assetClass === 'STOCKS')!.weightPct).toBe(100);
    expect(ws.find((w) => w.assetClass === 'CRYPTO')!.weightPct).toBe(0);
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn fail**

Run: `npx vitest run src/domain/weights.test.ts`
Kỳ vọng: FAIL với `Failed to resolve import "./weights"`.

- [ ] **Step 3: Viết `src/domain/weights.ts`**

```ts
// §17 — công thức tỷ trọng. Hàm thuần, không import gì ngoài type.
import { ASSET_CLASSES } from './types';
import type { AssetClass, TargetBand, Weight } from './types';

/** Tổng giá trị danh mục (VND). */
export function totalVnd(values: Record<AssetClass, number>): number {
  let sum = 0;
  for (const c of ASSET_CLASSES) sum += values[c];
  return sum;
}

/**
 * §17 nguyên văn, tính trên TỔNG HIỆN TẠI (không cộng tiền mới):
 *   current_weight = current_value / portfolio_total
 *   target_value   = portfolio_total × target_weight
 *   difference     = target_value − current_value
 *
 * Tổng = 0 (danh mục rỗng) → mọi số ra 0, KHÔNG ra NaN. Người dùng thấy
 * danh mục rỗng, không thấy "NaN%".
 */
export function computeWeights(
  values: Record<AssetClass, number>,
  targets: Record<AssetClass, TargetBand>,
): Weight[] {
  const total = totalVnd(values);

  return ASSET_CLASSES.map((assetClass): Weight => {
    const valueVnd = values[assetClass];
    const targetPct = targets[assetClass].targetPct;
    const weightPct = total === 0 ? 0 : (valueVnd / total) * 100;
    const targetValueVnd = total * (targetPct / 100);

    return {
      assetClass,
      valueVnd,
      weightPct,
      targetPct,
      deviationPp: total === 0 ? 0 : weightPct - targetPct,
      targetValueVnd,
      differenceVnd: targetValueVnd - valueVnd,
    };
  });
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npx vitest run src/domain/weights.test.ts`
Kỳ vọng: PASS, 8 test.

- [ ] **Step 5: Commit**

```bash
git add src/domain/weights.ts src/domain/weights.test.ts
git commit -m "feat(portfolio): weights.ts — §17 tỷ trọng, target value, difference

Tính trên tổng hiện tại, đúng §17 nguyên văn. Việc tính khoảng thiếu trên
tổng ĐÃ CỘNG tiền mới là việc của allocate.ts — hai mục đích khác nhau.

Test khớp đúng bộ số ví dụ §21: 47,2/24,8/16,5/11,5 và độ lệch
−2,8/+4,8/+1,5/−3,5. Danh mục rỗng ra 0, không ra NaN."
```

---

### Task 6: `bands.ts` — §7 bốn trạng thái, giải mâu thuẫn của spec

**Files:**
- Create: `src/domain/bands.ts`
- Test: `src/domain/bands.test.ts`

**Interfaces:**
- Consumes: `Weight`, `TargetBand`, `EngineConfig`, `BandStatus`, `AssetClass`, `ASSET_CLASSES` (Task 4)
- Produces: `classifyBand(weight: Weight, band: TargetBand, config: EngineConfig): BandStatus` · `classifyAll(weights: Weight[], targets: Record<AssetClass, TargetBand>, config: EngineConfig): Record<AssetClass, BandStatus>`

**Luật (spec mục 4.3):** band là **cổng**, điểm % chỉ **nâng mức độ**.
- trong band + \|lệch\| < `watchDeviationPp` → `OK`
- trong band + \|lệch\| ≥ `watchDeviationPp` → `WATCH` (cảnh báo mềm, **không bán**)
- ngoài band + \|lệch\| < `strongRebalancePp` → `OUT_OF_BAND`
- ngoài band + \|lệch\| ≥ `strongRebalancePp` → `REBALANCE_REQUIRED` (**mở khoá lệnh bán**)

Biên band tính **bao gồm hai đầu**: đúng 25,0% với band 15–25 vẫn là *trong band*.

- [ ] **Step 1: Viết test (chưa có file nguồn)**

Tạo `src/domain/bands.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { classifyBand, classifyAll } from './bands';
import { DEFAULT_CONFIG } from './types';
import type { AssetClass, BandStatus, TargetBand, Weight } from './types';

const TARGETS: Record<AssetClass, TargetBand> = {
  STOCKS: { targetPct: 50, minPct: 40, maxPct: 55 },
  CRYPTO: { targetPct: 20, minPct: 15, maxPct: 25 },
  GOLD:   { targetPct: 15, minPct: 10, maxPct: 20 },
  CASH:   { targetPct: 15, minPct: 7,  maxPct: 20 },
};

/** Chỉ cần weightPct + deviationPp cho bands; các trường khác không ảnh hưởng. */
function makeWeight(assetClass: AssetClass, weightPct: number): Weight {
  const targetPct = TARGETS[assetClass].targetPct;
  return {
    assetClass, valueVnd: 0, weightPct, targetPct,
    deviationPp: weightPct - targetPct,
    targetValueVnd: 0, differenceVnd: 0,
  };
}

const xet = (c: AssetClass, pct: number): BandStatus =>
  classifyBand(makeWeight(c, pct), TARGETS[c], DEFAULT_CONFIG);

describe('classifyBand — trong band', () => {
  it('lệch nhỏ → OK', () => {
    expect(xet('STOCKS', 47.2)).toBe('OK');   // lệch −2,8
    expect(xet('GOLD', 16.5)).toBe('OK');     // lệch +1,5
    expect(xet('CRYPTO', 20)).toBe('OK');     // lệch 0
  });

  it('lệch ≥ 3đ% nhưng vẫn trong band → WATCH (cảnh báo mềm, KHÔNG bán)', () => {
    // Chính là Crypto của ví dụ §21: +4,8đ%, band 15–25 → cảnh báo, chưa bán.
    expect(xet('CRYPTO', 24.8)).toBe('WATCH');
    expect(xet('CASH', 11.5)).toBe('WATCH');  // lệch −3,5
  });

  it('GIẢI MÂU THUẪN §7: Cash 9% lệch −6đ% mà vẫn trong band 7–20 → WATCH, KHÔNG phải REBALANCE_REQUIRED', () => {
    // §7 nói "do nothing while inside the band" VÀ "rebalance khi lệch ≥5đ%".
    // Band là cổng ⇒ trong band thì không bao giờ mở khoá lệnh bán.
    expect(xet('CASH', 9)).toBe('WATCH');
  });

  it('đúng biên band vẫn tính là TRONG band (bao gồm hai đầu)', () => {
    expect(xet('CRYPTO', 25)).toBe('WATCH');   // đúng maxPct, lệch +5
    expect(xet('CRYPTO', 15)).toBe('WATCH');   // đúng minPct, lệch −5
    expect(xet('STOCKS', 55)).toBe('WATCH');
    expect(xet('STOCKS', 40)).toBe('WATCH');
  });
});

describe('classifyBand — ngoài band', () => {
  it('ngoài band nhưng lệch < 5đ% → OUT_OF_BAND (chưa mở khoá bán)', () => {
    // Cần band HẸP HƠN 5đ% mới đạt tới được trạng thái này — xem ghi nhận
    // trong comment đầu bands.ts. Band mặc định của §2 không tạo ra ca này.
    const bandHep: TargetBand = { targetPct: 15, minPct: 13, maxPct: 17 };
    const w: Weight = { ...makeWeight('GOLD', 18), deviationPp: 3 };
    expect(classifyBand(w, bandHep, DEFAULT_CONFIG)).toBe('OUT_OF_BAND');
  });

  it('ngoài band VÀ lệch ≥ 5đ% → REBALANCE_REQUIRED (mở khoá lệnh bán)', () => {
    expect(xet('CRYPTO', 26)).toBe('REBALANCE_REQUIRED');    // lệch +6
    expect(xet('CRYPTO', 25.5)).toBe('REBALANCE_REQUIRED');  // lệch +5,5
    expect(xet('STOCKS', 56)).toBe('REBALANCE_REQUIRED');    // lệch +6
    expect(xet('STOCKS', 38)).toBe('REBALANCE_REQUIRED');    // lệch −12
    expect(xet('CASH', 6)).toBe('REBALANCE_REQUIRED');       // lệch −9
  });
});

describe('classifyAll', () => {
  it('ví dụ §21 ra đúng bộ trạng thái spec mô tả', () => {
    const weights: Weight[] = [
      makeWeight('STOCKS', 47.2),
      makeWeight('CRYPTO', 24.8),
      makeWeight('GOLD', 16.5),
      makeWeight('CASH', 11.5),
    ];
    expect(classifyAll(weights, TARGETS, DEFAULT_CONFIG)).toEqual({
      STOCKS: 'OK',
      CRYPTO: 'WATCH',
      GOLD: 'OK',
      CASH: 'WATCH',
    });
  });
});

describe('classifyBand — ngưỡng cấu hình được', () => {
  it('watchDeviationPp = 0 → mọi lệch khác 0 trong band đều WATCH', () => {
    const cfg = { ...DEFAULT_CONFIG, watchDeviationPp: 0 };
    expect(classifyBand(makeWeight('STOCKS', 49.9), TARGETS.STOCKS, cfg)).toBe('WATCH');
  });

  it('strongRebalancePp = 100 → không bao giờ REBALANCE_REQUIRED', () => {
    const cfg = { ...DEFAULT_CONFIG, strongRebalancePp: 100 };
    expect(classifyBand(makeWeight('CRYPTO', 30), TARGETS.CRYPTO, cfg)).toBe('OUT_OF_BAND');
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn fail**

Run: `npx vitest run src/domain/bands.test.ts`
Kỳ vọng: FAIL với `Failed to resolve import "./bands"`.

**Một phát hiện cần biết trước khi viết code:** với bộ band mặc định của §2, khoảng cách từ target tới rìa band đúng bằng 5đ% ở Stocks (50 → 55) và Crypto (20 → 25). Nghĩa là **mọi lần ra ngoài band đều đã lệch ≥ 5đ%** ⇒ trạng thái `OUT_OF_BAND` gần như không đạt tới với cấu hình mặc định. Nó vẫn cần thiết cho band do người dùng tự nới hẹp trong Settings — nên ca test của nó dùng band hẹp `13/15/17`. Ghi nhận xét này vào comment đầu `bands.ts`.

- [ ] **Step 3: Viết `src/domain/bands.ts`**

```ts
// §7 — phân loại trạng thái band. Hàm thuần.
//
// GIẢI MÂU THUẪN CỦA §7: spec nói cả "do nothing while inside the band" và
// "strong rebalance khi lệch ≥ 5đ%". Hai câu đá nhau vì Cash có band 7–20%
// quanh target 15% ⇒ lệch −8đ% mà vẫn trong band.
//
// Cách giải (spec mục 4.3): BAND LÀ CỔNG, điểm % chỉ NÂNG MỨC ĐỘ.
// Lệnh bán chỉ mở khi ra ngoài band VÀ lệch ≥ strongRebalancePp.
// Nhờ đó tái lập đúng kết luận của §21: Crypto +4,8đ% → cảnh báo, KHÔNG bán.
//
// GHI NHẬN: với bộ band mặc định của §2, khoảng cách từ target tới rìa band
// đúng bằng 5đ% ở Stocks và Crypto ⇒ hầu như mọi lần ra ngoài band đều đã
// lệch ≥ 5đ%, nên OUT_OF_BAND là trạng thái ít khi đạt tới. Nó vẫn cần thiết
// cho band do người dùng tự nới rộng trong Settings.

import { ASSET_CLASSES } from './types';
import type { AssetClass, BandStatus, EngineConfig, TargetBand, Weight } from './types';

export function classifyBand(
  weight: Weight,
  band: TargetBand,
  config: EngineConfig,
): BandStatus {
  // Biên bao gồm hai đầu: đúng 25,0% với band 15–25 vẫn là TRONG band.
  const trongBand = weight.weightPct >= band.minPct && weight.weightPct <= band.maxPct;
  const lech = Math.abs(weight.deviationPp);

  if (trongBand) {
    return lech >= config.watchDeviationPp ? 'WATCH' : 'OK';
  }
  return lech >= config.strongRebalancePp ? 'REBALANCE_REQUIRED' : 'OUT_OF_BAND';
}

export function classifyAll(
  weights: Weight[],
  targets: Record<AssetClass, TargetBand>,
  config: EngineConfig,
): Record<AssetClass, BandStatus> {
  const out = {} as Record<AssetClass, BandStatus>;
  for (const c of ASSET_CLASSES) {
    const w = weights.find((x) => x.assetClass === c);
    if (!w) {
      throw new Error(`Thiếu tỷ trọng của nhóm tài sản ${c} — không thể phân loại band.`);
    }
    out[c] = classifyBand(w, targets[c], config);
  }
  return out;
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npx vitest run src/domain/bands.test.ts`
Kỳ vọng: PASS toàn bộ (13 test).

- [ ] **Step 5: Chạy toàn bộ test để chắc chắn không phá gì**

Run: `npm test`
Kỳ vọng: toàn bộ PASS, gồm cả test cũ của todos/goals/stocks/crypto.

- [ ] **Step 6: Commit**

```bash
git add src/domain/bands.ts src/domain/bands.test.ts
git commit -m "feat(portfolio): bands.ts — 4 trạng thái, giải mâu thuẫn §7

§7 nói cả 'không làm gì khi trong band' và 'rebalance khi lệch ≥5đ%'.
Cash band 7–20 quanh target 15 ⇒ lệch −8đ% mà vẫn trong band: hai câu đá nhau.

Cách giải: band là CỔNG, điểm % chỉ nâng mức độ. Lệnh bán chỉ mở khi ra
ngoài band VÀ lệch ≥ 5đ%. Tái lập đúng kết luận §21 (Crypto +4,8đ% →
cảnh báo, chưa bán)."
```

---

### Task 7: `allocate.ts` — §4 §5 chia tiền mới và cổ tức

**Files:**
- Create: `src/domain/allocate.ts`
- Test: `src/domain/allocate.test.ts`

**Interfaces:**
- Consumes: `ASSET_CLASSES`, `AssetClass`, `TargetBand`, `EngineConfig`, `Allocation`, `AllocationResult` (Task 4) · `roundDownTo`, `sumVnd` (Task 4)
- Produces:
  - `interface AllocateInput { classValues: Record<AssetClass, number>; targets: Record<AssetClass, TargetBand>; poolVnd: number; addsToTotal: boolean; config: EngineConfig }`
  - `allocate(input: AllocateInput): AllocationResult`
  - `allocateNewCapital(classValues, targets, monthlyVnd, config): AllocationResult`
  - `allocateIncome(classValues, targets, incomeVnd, config): AllocationResult`

**Đây là task quan trọng nhất của plan.** Sai một dấu ở đây là sai tiền thật.

**⚠️ Phát hiện khi soạn task này — cần sửa spec:** spec mục 4.5 ghi ví dụ §4 là "50:50 ✅ hợp lý", nhưng đó chỉ đúng nếu tính khoảng thiếu trên **tổng cũ**. §17 nói rõ phải dùng `new_portfolio_total = current_total + new_capital`. Với `newTotal`, ví dụ §4 ra **1.600.000 / 1.400.000** chứ không phải 1.500.000/1.500.000 — vì phần Z chia theo target làm khoảng thiếu của Stocks lớn hơn Crypto (31,5tr so với 30,6tr). Nghĩa là **cả ba ví dụ §4, §5, §21 đều không tái lập được**, không phải chỉ hai. Step 8 của task này sửa lại bảng trong spec.

- [ ] **Step 1: Viết test — ví dụ §21 (ca chính)**

Tạo `src/domain/allocate.test.ts`:

```ts
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

const VI_DU_21: Record<AssetClass, number> = {
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
  const r = allocateNewCapital(VI_DU_21, TARGETS, 3_000_000, DEFAULT_CONFIG);

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
    const tong = r.allocations.reduce((s, a) => s + a.amountVnd, 0);
    expect(tong + r.unallocatedVnd).toBe(3_000_000);
  });

  it('mọi khoản phân bổ là bội số của 100.000', () => {
    for (const a of r.allocations) expect(a.amountVnd % 100_000).toBe(0);
  });
});
```

- [ ] **Step 2: Viết test — ví dụ §4 và §5 (hai ca lệch có chủ đích)**

Nối tiếp vào cùng file:

```ts
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
    const tong = r.allocations.reduce((s, a) => s + a.amountVnd, 0);
    expect(tong + r.unallocatedVnd).toBe(3_000_000);
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
    const tong = r.allocations.reduce((s, a) => s + a.amountVnd, 0);
    expect(tong + r.unallocatedVnd).toBe(5_000_000);
  });
});
```

- [ ] **Step 3: Viết test — biên và cấu hình**

Nối tiếp vào cùng file:

```ts
describe('allocate — biên: tiền không được biến mất', () => {
  it('pool = 0 → không phân bổ gì, không dư', () => {
    const r = allocateNewCapital(VI_DU_21, TARGETS, 0, DEFAULT_CONFIG);
    expect(r.allocations).toEqual([]);
    expect(r.unallocatedVnd).toBe(0);
  });

  it('pool âm → coi như 0 (không sinh lệnh mua âm)', () => {
    const r = allocateNewCapital(VI_DU_21, TARGETS, -1_000_000, DEFAULT_CONFIG);
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
    const rong: Record<AssetClass, number> = { STOCKS: 0, CRYPTO: 0, GOLD: 0, CASH: 0 };
    const r = allocateNewCapital(rong, TARGETS, 10_000_000, DEFAULT_CONFIG);
    for (const a of r.allocations) expect(Number.isNaN(a.amountVnd)).toBe(false);
    const tong = r.allocations.reduce((s, a) => s + a.amountVnd, 0);
    expect(tong + r.unallocatedVnd).toBe(10_000_000);
  });

  it('pool không phải bội số của bước làm tròn: BẤT BIẾN vẫn đúng tuyệt đối', () => {
    const r = allocateNewCapital(VI_DU_21, TARGETS, 3_000_001, DEFAULT_CONFIG);
    const tong = r.allocations.reduce((s, a) => s + a.amountVnd, 0);
    expect(tong + r.unallocatedVnd).toBe(3_000_001);
  });
});

describe('allocate — cấu hình', () => {
  it('cashEligibleForNewCapital = false → Stocks nhận trọn 3tr (ví dụ §21)', () => {
    const cfg = { ...DEFAULT_CONFIG, cashEligibleForNewCapital: false };
    const r = allocateNewCapital(VI_DU_21, TARGETS, 3_000_000, cfg);
    expect(toMap(r)).toEqual({ STOCKS: 3_000_000 });
  });

  it('PRIORITY_WATERFALL → đổ đầy Stocks trước (ưu tiên cao nhất)', () => {
    const cfg = { ...DEFAULT_CONFIG, formula: 'PRIORITY_WATERFALL' as const };
    const r = allocateNewCapital(VI_DU_21, TARGETS, 3_000_000, cfg);
    expect(toMap(r)).toEqual({ STOCKS: 3_000_000 });
  });

  it('PRIORITY_WATERFALL: pool lớn hơn gap của class đầu → tràn sang class sau', () => {
    const cfg = { ...DEFAULT_CONFIG, formula: 'PRIORITY_WATERFALL' as const };
    const r = allocateNewCapital(VI_DU_21, TARGETS, 40_000_000, cfg);
    const m = toMap(r);
    // gap Stocks trên newTotal ≈ 36,5tr → Stocks đầy, phần còn lại sang Cash.
    expect(m.STOCKS).toBeGreaterThan(30_000_000);
    expect(m.CASH).toBeGreaterThan(0);
    const tong = r.allocations.reduce((s, a) => s + a.amountVnd, 0);
    expect(tong + r.unallocatedVnd).toBe(40_000_000);
  });

  it('bước làm tròn 1.000.000 → mọi khoản là bội số của 1tr', () => {
    const cfg = { ...DEFAULT_CONFIG, roundingStepVnd: 1_000_000 };
    const r = allocateNewCapital(VI_DU_21, TARGETS, 3_000_000, cfg);
    for (const a of r.allocations) expect(a.amountVnd % 1_000_000).toBe(0);
    const tong = r.allocations.reduce((s, a) => s + a.amountVnd, 0);
    expect(tong + r.unallocatedVnd).toBe(3_000_000);
  });
});

describe('allocate — dùng trực tiếp', () => {
  it('addsToTotal quyết định tổng có tăng hay không', () => {
    const args = { classValues: VI_DU_21, targets: TARGETS, poolVnd: 3_000_000,
                   config: DEFAULT_CONFIG };
    const moi = allocate({ ...args, addsToTotal: true });
    const coTuc = allocate({ ...args, addsToTotal: false });
    // Cùng pool nhưng khác cách tính ⇒ kết quả khác nhau.
    expect(toMap(moi)).not.toEqual(toMap(coTuc));
  });
});
```

- [ ] **Step 4: Chạy test để chắc chắn fail**

Run: `npx vitest run src/domain/allocate.test.ts`
Kỳ vọng: FAIL với `Failed to resolve import "./allocate"`.

- [ ] **Step 5: Viết `src/domain/allocate.ts`**

```ts
// §4 (tiền mới hàng tháng) và §5 (cổ tức) — MỘT engine, hai wrapper.
//
// Khác biệt duy nhất giữa hai trường hợp: tiền mới Z làm TĂNG tổng danh mục,
// còn cổ tức thì ĐÃ nằm trong Cash rồi. Nên chỉ cần một cờ `addsToTotal`.
//
// CÔNG THỨC MẶC ĐỊNH — PROPORTIONAL_GAP (spec mục 4.4):
//   chia tỷ lệ theo khoảng thiếu tính bằng VND. Đây là phân bổ DUY NHẤT tối
//   thiểu hoá tổng bình phương độ lệch sau khi giải ngân — đúng mục tiêu 2 của
//   §18 "MINIMIZE DEVIATION FROM TARGET".
//
// ⚠️ Số trong ví dụ §4, §5, §21 của spec gốc là minh hoạ viết tay, KHÔNG suy ra
// được từ bất cứ công thức nào. Chi tiết ở spec mục 4.5. Test ở đây ghi số
// engine tính, không sửa engine cho vừa số viết tay.
//
// BẤT BIẾN: sum(allocations) + unallocatedVnd === poolVnd, LUÔN LUÔN.

import { ASSET_CLASSES } from './types';
import { roundDownTo, sumVnd } from './money';
import type {
  Allocation, AllocationResult, AssetClass, EngineConfig, TargetBand,
} from './types';

export interface AllocateInput {
  classValues: Record<AssetClass, number>;
  targets: Record<AssetClass, TargetBand>;
  poolVnd: number;
  /** true = tiền từ ngoài vào (Z), làm tăng tổng. false = cổ tức, đã nằm trong Cash. */
  addsToTotal: boolean;
  config: EngineConfig;
}

/** Chia tỷ lệ theo khoảng thiếu VND. */
function chiaTheoTyLeGap(
  candidates: AssetClass[],
  gaps: Record<AssetClass, number>,
  poolVnd: number,
): Map<AssetClass, number> {
  const tongGap = sumVnd(candidates.map((c) => gaps[c]));
  const out = new Map<AssetClass, number>();
  for (const c of candidates) out.set(c, poolVnd * (gaps[c] / tongGap));
  return out;
}

/** Đổ đầy lần lượt theo thứ tự ưu tiên, mỗi class tối đa tới khoảng thiếu của nó. */
function chiaTheoUuTien(
  candidates: AssetClass[],
  gaps: Record<AssetClass, number>,
  poolVnd: number,
  config: EngineConfig,
): Map<AssetClass, number> {
  const thuTu = [...candidates].sort(
    (a, b) => config.classPriority[b] - config.classPriority[a],
  );
  const out = new Map<AssetClass, number>();
  let conLai = poolVnd;
  for (const c of thuTu) {
    const lay = Math.min(conLai, gaps[c]);
    out.set(c, lay);
    conLai -= lay;
    if (conLai <= 0) break;
  }
  // Pool lớn hơn tổng khoảng thiếu: phần dư dồn vào class ưu tiên cao nhất.
  if (conLai > 0) out.set(thuTu[0], (out.get(thuTu[0]) ?? 0) + conLai);
  return out;
}

export function allocate(input: AllocateInput): AllocationResult {
  const { classValues, targets, poolVnd, addsToTotal, config } = input;

  if (poolVnd <= 0) return { allocations: [], unallocatedVnd: 0 };

  const total = sumVnd(ASSET_CLASSES.map((c) => classValues[c]));
  const newTotal = total + (addsToTotal ? poolVnd : 0);

  // Z được nộp vào ví TRƯỚC khi mua ⇒ giá trị CASH trước phân bổ đã gồm Z.
  // Không làm bước này thì Cash bị coi là thiếu hơn thực tế.
  const preValues = { ...classValues };
  if (addsToTotal) preValues.CASH += poolVnd;

  const gaps = {} as Record<AssetClass, number>;
  for (const c of ASSET_CLASSES) {
    gaps[c] = newTotal * (targets[c].targetPct / 100) - preValues[c];
  }

  let candidates = ASSET_CLASSES.filter((c) => gaps[c] > 0);
  if (!config.cashEligibleForNewCapital) {
    candidates = candidates.filter((c) => c !== 'CASH');
  }
  // Không có chỗ nào thiếu: tiền KHÔNG được biến mất, nó nằm nguyên trong ví.
  if (candidates.length === 0) {
    return { allocations: [], unallocatedVnd: poolVnd };
  }

  const tho = config.formula === 'PRIORITY_WATERFALL'
    ? chiaTheoUuTien(candidates, gaps, poolVnd, config)
    : chiaTheoTyLeGap(candidates, gaps, poolVnd);

  // Làm tròn XUỐNG bội số, rồi dồn phần dư vào class có khoảng thiếu lớn nhất.
  // Nhờ làm tròn xuống, phần dư luôn ≥ 0 ⇒ bất biến tổng đúng tuyệt đối.
  const daTron = new Map<AssetClass, number>();
  for (const c of candidates) {
    daTron.set(c, roundDownTo(tho.get(c) ?? 0, config.roundingStepVnd));
  }
  const duVnd = poolVnd - sumVnd([...daTron.values()]);
  if (duVnd > 0) {
    const lonNhat = candidates.reduce((a, b) => (gaps[b] > gaps[a] ? b : a));
    daTron.set(lonNhat, (daTron.get(lonNhat) ?? 0) + duVnd);
  }

  const allocations: Allocation[] = ASSET_CLASSES
    .filter((c) => (daTron.get(c) ?? 0) > 0)
    .map((c) => ({ assetClass: c, amountVnd: daTron.get(c) as number, gapVnd: gaps[c] }));

  return {
    allocations,
    unallocatedVnd: poolVnd - sumVnd(allocations.map((a) => a.amountVnd)),
  };
}

/** §4 — tiền mới hàng tháng (Z). Làm tăng tổng danh mục. */
export function allocateNewCapital(
  classValues: Record<AssetClass, number>,
  targets: Record<AssetClass, TargetBand>,
  monthlyVnd: number,
  config: EngineConfig,
): AllocationResult {
  return allocate({ classValues, targets, poolVnd: monthlyVnd, addsToTotal: true, config });
}

/** §5 — cổ tức/lãi đã nhận. ĐÃ nằm trong Cash nên tổng không tăng. */
export function allocateIncome(
  classValues: Record<AssetClass, number>,
  targets: Record<AssetClass, TargetBand>,
  incomeVnd: number,
  config: EngineConfig,
): AllocationResult {
  return allocate({ classValues, targets, poolVnd: incomeVnd, addsToTotal: false, config });
}
```

- [ ] **Step 6: Chạy test để xác nhận pass**

Run: `npx vitest run src/domain/allocate.test.ts`
Kỳ vọng: PASS toàn bộ (20 test).

Nếu ca `PRIORITY_WATERFALL: pool lớn hơn gap` fail vì `m.CASH` bằng `undefined`, nghĩa là gap của Stocks trên `newTotal` với pool 40tr lớn hơn 40tr. Kiểm bằng cách in `r.allocations` ra rồi chỉnh ngưỡng trong test cho khớp số thật — **chỉnh test, không chỉnh engine**, vì bất biến tổng vẫn đúng.

- [ ] **Step 7: Kiểm typecheck**

Run: `npm run build`
Kỳ vọng: thành công.

- [ ] **Step 8: Sửa bảng trong spec cho khớp thực tế**

Trong `docs/superpowers/specs/2026-08-22-portfolio-rebalancing-design.md`, mục 4.5, bảng ba ví dụ hiện ghi §4 là "50 : 50 — hợp lý". Điều đó chỉ đúng nếu tính trên tổng cũ. Sửa bảng thành:

```markdown
| Ví dụ | Lệch của các class underweight | Spec kỳ vọng | Engine tính ra |
|---|---|---|---|
| §4 | Stocks −3, Crypto −3 | 1,5tr / 1,5tr | **1,6tr / 1,4tr** |
| §5 | Stocks −3, Crypto −3 | 3tr / 2tr | **2,5tr / 2,5tr** |
| §21 | Stocks −2,8 · Cash −3,5 | 2tr / 1tr | **1,4tr / 1,6tr** |

**Cả ba ví dụ đều không tái lập được**, mỗi ví dụ lệch theo một hướng khác nhau —
xác nhận rằng đây là số minh hoạ viết tay, không phải kết quả của một công thức.
Riêng §4 lệch vì §17 bắt tính khoảng thiếu trên `newTotal = tổng cũ + Z`: phần Z
chia theo target làm khoảng thiếu của Stocks (31,5tr) lớn hơn Crypto (30,6tr),
nên không còn chia đều nữa.
```

- [ ] **Step 9: Commit**

```bash
git add src/domain/allocate.ts src/domain/allocate.test.ts \
        docs/superpowers/specs/2026-08-22-portfolio-rebalancing-design.md
git commit -m "feat(portfolio): allocate.ts — §4 và §5 dùng chung một engine

Khác biệt duy nhất giữa tiền mới và cổ tức là cờ addsToTotal: Z làm tăng tổng
danh mục, cổ tức thì đã nằm trong Cash. Một engine, hai wrapper một dòng.

PROPORTIONAL_GAP là mặc định — phân bổ duy nhất tối thiểu hoá tổng bình phương
độ lệch, đúng mục tiêu 2 của §18.

BẤT BIẾN có test riêng: sum(allocations) + unallocatedVnd === poolVnd, kể cả khi
pool không phải bội số của bước làm tròn. Không có ứng viên nào thì toàn bộ pool
vào unallocatedVnd — tiền không được biến mất.

Sửa bảng ở spec mục 4.5: cả BA ví dụ §4/§5/§21 đều không tái lập được, không
phải chỉ hai. §4 lệch vì §17 bắt tính khoảng thiếu trên newTotal."
```

---

### Task 8: `tickerCandidates.ts` — §11 lọc mã dưới ngưỡng VÀ mua nổi lô

**Files:**
- Create: `src/domain/tickerCandidates.ts`
- Test: `src/domain/tickerCandidates.test.ts`

**Interfaces:**
- Consumes: `WatchlistItem`, `Candidate`, `ShortfallNote`, `CandidateResult` (Task 4)
- Produces: `pickCandidates(watchlist: WatchlistItem[], budgetVnd: number, monthlyBudgetVnd: number): CandidateResult`

**Lý do task này tồn tại (spec mục 4.6):** HOSE/HNX giao dịch **lô chẵn 100 cổ phiếu**. Với ngân sách 1,4tr thì giá tối đa mua được là 14.000đ/cp — tức **52/56 mã trong watchlist hiện tại không mua nổi**. Nếu chỉ nói "mua Stocks 1,4tr" thì đề xuất không thực hiện được. Lọc **hai** điều kiện, không phải một.

App **không tự chọn mã** (§23) — chỉ lọc ra ứng viên để người dùng quyết.

- [ ] **Step 1: Viết test (chưa có file nguồn)**

Tạo `src/domain/tickerCandidates.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { pickCandidates } from './tickerCandidates';
import type { WatchlistItem } from './types';

/** Giá và ngưỡng theo VND (bảng cũ dùng nghìn đồng — providers đã ×1000). */
function m(
  symbol: string, priceVnd: number | null, thresholdVnd: number | null,
  over: Partial<WatchlistItem> = {},
): WatchlistItem {
  return {
    symbol, name: symbol, group: 'balance',
    currentPriceVnd: priceVnd, thresholdVnd, lotSize: 100, ...over,
  };
}

// Lấy từ watchlist thật của NewPL (đơn vị đã đổi sang đồng).
const WATCHLIST: WatchlistItem[] = [
  m('HND', 13_000, 13_300),    // dưới ngưỡng, lô 1.300.000 → mua nổi
  m('QTP', 13_400, 13_500),    // dưới ngưỡng, lô 1.340.000 → mua nổi
  m('OCB', 14_000, 13_800),    // TRÊN ngưỡng → loại hẳn
  m('FPT', 98_000, 100_000),   // dưới ngưỡng, lô 9.800.000 → chưa đủ tiền
  m('DHG', 125_000, 130_000),  // dưới ngưỡng, lô 12.500.000 → chưa đủ tiền
  m('XXX', null, 20_000),      // thiếu giá → loại
  m('YYY', 20_000, null),      // thiếu ngưỡng → loại
];

describe('pickCandidates — ngân sách 1.400.000, Z = 3.000.000', () => {
  const r = pickCandidates(WATCHLIST, 1_400_000, 3_000_000);

  it('chỉ mã dưới ngưỡng VÀ mua nổi 1 lô mới vào danh sách mua được', () => {
    expect(r.affordable.map((c) => c.symbol)).toEqual(['HND', 'QTP']);
  });

  it('mã TRÊN ngưỡng bị loại hẳn, không xuất hiện ở đâu cả', () => {
    const moiSymbol = [...r.affordable, ...r.shortfalls].map((x) => x.symbol);
    expect(moiSymbol).not.toContain('OCB');
  });

  it('mã thiếu giá hoặc thiếu ngưỡng bị loại (không đoán bừa)', () => {
    const moiSymbol = [...r.affordable, ...r.shortfalls].map((x) => x.symbol);
    expect(moiSymbol).not.toContain('XXX');
    expect(moiSymbol).not.toContain('YYY');
  });

  it('sắp xếp mã mua được theo mức rẻ so với ngưỡng, rẻ nhất lên đầu', () => {
    // HND rẻ hơn ngưỡng 2,26%; QTP chỉ 0,74%.
    expect(r.affordable[0].symbol).toBe('HND');
    expect(r.affordable[0].belowThresholdPct).toBeGreaterThan(
      r.affordable[1].belowThresholdPct);
  });

  it('tính đúng số tiền một lô', () => {
    expect(r.affordable[0].lotCostVnd).toBe(1_300_000);
    expect(r.affordable[1].lotCostVnd).toBe(1_340_000);
  });
});

describe('pickCandidates — mã dưới ngưỡng nhưng chưa đủ tiền', () => {
  const r = pickCandidates(WATCHLIST, 1_400_000, 3_000_000);

  it('gom vào shortfalls, gần mua được nhất lên đầu', () => {
    expect(r.shortfalls.map((s) => s.symbol)).toEqual(['FPT', 'DHG']);
  });

  it('FPT: thiếu 8.400.000, dồn thêm 3 tháng nữa', () => {
    const fpt = r.shortfalls.find((s) => s.symbol === 'FPT');
    expect(fpt).toBeDefined();
    expect(fpt!.lotCostVnd).toBe(9_800_000);
    expect(fpt!.shortfallVnd).toBe(8_400_000);
    expect(fpt!.monthsToAfford).toBe(3);
  });

  it('không có tiền vào hàng tháng → monthsToAfford = null, KHÔNG đoán bừa', () => {
    const r0 = pickCandidates(WATCHLIST, 1_400_000, 0);
    expect(r0.shortfalls[0].monthsToAfford).toBeNull();
  });
});

describe('pickCandidates — biên', () => {
  it('watchlist rỗng → hai danh sách rỗng', () => {
    expect(pickCandidates([], 1_400_000, 3_000_000))
      .toEqual({ affordable: [], shortfalls: [] });
  });

  it('ngân sách 0 → không mã nào mua nổi, tất cả rơi vào shortfalls', () => {
    const r = pickCandidates(WATCHLIST, 0, 3_000_000);
    expect(r.affordable).toEqual([]);
    expect(r.shortfalls.map((s) => s.symbol)).toEqual(['HND', 'QTP', 'FPT', 'DHG']);
  });

  it('giá đúng bằng ngưỡng vẫn tính là dưới ngưỡng (bao gồm biên)', () => {
    const r = pickCandidates([m('ZZZ', 10_000, 10_000)], 2_000_000, 3_000_000);
    expect(r.affordable.map((c) => c.symbol)).toEqual(['ZZZ']);
    expect(r.affordable[0].belowThresholdPct).toBe(0);
  });

  it('lotSize = 1 (crypto/vàng) → tiền một lô bằng đúng giá', () => {
    const r = pickCandidates(
      [m('SJC', 8_500_000, 9_000_000, { lotSize: 1 })], 9_000_000, 3_000_000);
    expect(r.affordable[0].lotCostVnd).toBe(8_500_000);
  });

  it('lotSize <= 0 bị loại (dữ liệu xấu, không chia cho 0)', () => {
    const r = pickCandidates(
      [m('BAD', 10_000, 20_000, { lotSize: 0 })], 5_000_000, 3_000_000);
    expect(r.affordable).toEqual([]);
    expect(r.shortfalls).toEqual([]);
  });

  it('ngưỡng = 0 bị loại (không chia cho 0 khi tính % rẻ)', () => {
    const r = pickCandidates([m('BAD2', 0, 0)], 5_000_000, 3_000_000);
    expect(r.affordable).toEqual([]);
    expect(r.shortfalls).toEqual([]);
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn fail**

Run: `npx vitest run src/domain/tickerCandidates.test.ts`
Kỳ vọng: FAIL với `Failed to resolve import "./tickerCandidates"`.

- [ ] **Step 3: Viết `src/domain/tickerCandidates.ts`**

```ts
// §11 — lọc mã ứng viên trong watchlist. Hàm thuần.
//
// LỌC HAI ĐIỀU KIỆN (spec mục 4.6):
//   1. giá hiện tại <= giá ngưỡng tích sản  (kỷ luật sẵn có của người dùng)
//   2. giá × lô chẵn <= ngân sách           (MUA NỔI KHÔNG)
//
// Thiếu điều kiện 2 thì đề xuất không thực hiện được: HOSE giao dịch lô chẵn
// 100 cổ phiếu, nên với ngân sách 1,4tr chỉ mua nổi mã dưới 14.000đ/cp —
// tức 4/56 mã trong watchlist hiện tại.
//
// App KHÔNG tự chọn mã (§23). Nó chỉ lọc ra ứng viên để người dùng quyết.

import type { Candidate, CandidateResult, ShortfallNote, WatchlistItem } from './types';

export function pickCandidates(
  watchlist: WatchlistItem[],
  budgetVnd: number,
  monthlyBudgetVnd: number,
): CandidateResult {
  const affordable: Candidate[] = [];
  const shortfalls: ShortfallNote[] = [];

  for (const item of watchlist) {
    const { currentPriceVnd: gia, thresholdVnd: nguong, lotSize } = item;

    // Thiếu dữ liệu hoặc dữ liệu xấu → bỏ qua, KHÔNG đoán bừa.
    if (gia === null || nguong === null) continue;
    if (lotSize <= 0 || nguong <= 0) continue;

    // Trên ngưỡng tích sản → không phải ứng viên, loại hẳn.
    if (gia > nguong) continue;

    const lotCostVnd = gia * lotSize;

    if (lotCostVnd <= budgetVnd) {
      affordable.push({
        symbol: item.symbol,
        name: item.name,
        group: item.group,
        priceVnd: gia,
        lotCostVnd,
        belowThresholdPct: ((nguong - gia) / nguong) * 100,
      });
    } else {
      const shortfallVnd = lotCostVnd - budgetVnd;
      shortfalls.push({
        symbol: item.symbol,
        lotCostVnd,
        shortfallVnd,
        // Không có tiền vào hàng tháng thì không suy ra được bao lâu — trả null.
        monthsToAfford: monthlyBudgetVnd > 0
          ? Math.ceil(shortfallVnd / monthlyBudgetVnd)
          : null,
      });
    }
  }

  // Mua được: rẻ so với ngưỡng nhiều nhất lên đầu.
  affordable.sort((a, b) => b.belowThresholdPct - a.belowThresholdPct);
  // Chưa đủ tiền: gần mua được nhất lên đầu (để biết nên dồn cho mã nào).
  shortfalls.sort((a, b) => a.shortfallVnd - b.shortfallVnd);

  return { affordable, shortfalls };
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npx vitest run src/domain/tickerCandidates.test.ts`
Kỳ vọng: PASS toàn bộ (14 test).

- [ ] **Step 5: Commit**

```bash
git add src/domain/tickerCandidates.ts src/domain/tickerCandidates.test.ts
git commit -m "feat(portfolio): tickerCandidates.ts — lọc mã dưới ngưỡng VÀ mua nổi lô

HOSE giao dịch lô chẵn 100 cổ phiếu. Với ngân sách 1,4tr chỉ mua nổi mã dưới
14.000đ/cp — 4/56 mã trong watchlist hiện tại. Thiếu điều kiện 'mua nổi' thì
đề xuất không thực hiện được.

Mã dưới ngưỡng nhưng chưa đủ tiền không bị bỏ im lặng: gom vào shortfalls kèm
số còn thiếu và số tháng cần dồn thêm. Không có Z thì trả null, không đoán bừa."
```

---

### Task 9: `rebalanceSell.ts` — §6 Mode B

**Files:**
- Create: `src/domain/rebalanceSell.ts`
- Test: `src/domain/rebalanceSell.test.ts`

**Interfaces:**
- Consumes: `Weight`, `BandStatus`, `AssetClass`, `TargetBand`, `EngineConfig`, `SellOrder`, `SellPlan` (Task 4) · `allocate` (Task 7) · `totalVnd` (Task 5) · `sumVnd` (Task 4)
- Produces:
  - `interface SellRebalanceInput { weights: Weight[]; statuses: Record<AssetClass, BandStatus>; classValues: Record<AssetClass, number>; targets: Record<AssetClass, TargetBand>; config: EngineConfig }`
  - `planSellRebalance(input: SellRebalanceInput): SellPlan`

**Luật:** chỉ sinh lệnh bán cho class có trạng thái `REBALANCE_REQUIRED` **và** đang thừa (`deviationPp > 0`). Tiền bán được chia bằng **chính `allocate.ts`** — không viết lại logic phân bổ lần thứ hai.

- [ ] **Step 1: Viết test (chưa có file nguồn)**

Tạo `src/domain/rebalanceSell.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { planSellRebalance } from './rebalanceSell';
import { computeWeights } from './weights';
import { classifyAll } from './bands';
import { DEFAULT_CONFIG } from './types';
import type { AssetClass, TargetBand } from './types';

const TARGETS: Record<AssetClass, TargetBand> = {
  STOCKS: { targetPct: 50, minPct: 40, maxPct: 55 },
  CRYPTO: { targetPct: 20, minPct: 15, maxPct: 25 },
  GOLD:   { targetPct: 15, minPct: 10, maxPct: 20 },
  CASH:   { targetPct: 15, minPct: 7,  maxPct: 20 },
};

/** Crypto 28% — ngoài band 15–25 và lệch +8đ% ⇒ REBALANCE_REQUIRED. */
const CRYPTO_QUA_NONG: Record<AssetClass, number> = {
  STOCKS: 460_000_000,  // 46%
  CRYPTO: 280_000_000,  // 28%
  GOLD:   140_000_000,  // 14%
  CASH:   120_000_000,  // 12%
};

/** Bộ số §21 — không class nào REBALANCE_REQUIRED. */
const VI_DU_21: Record<AssetClass, number> = {
  STOCKS: 513_300_000, CRYPTO: 269_700_000, GOLD: 179_437_500, CASH: 125_062_500,
};

function lapKeHoach(values: Record<AssetClass, number>, config = DEFAULT_CONFIG) {
  const weights = computeWeights(values, TARGETS);
  const statuses = classifyAll(weights, TARGETS, config);
  return planSellRebalance({ weights, statuses, classValues: values, targets: TARGETS, config });
}

describe('planSellRebalance — Crypto 28%, bán về TARGET (mặc định)', () => {
  const p = lapKeHoach(CRYPTO_QUA_NONG);

  it('bán đúng một class: Crypto', () => {
    expect(p.sells.map((s) => s.assetClass)).toEqual(['CRYPTO']);
  });

  it('bán 80.000.000 để về đúng target 20% (280tr → 200tr)', () => {
    expect(p.sells[0].sellVnd).toBe(80_000_000);
  });

  it('tiền bán được chia hết vào ba class đang thiếu, lấp vừa khít khoảng thiếu', () => {
    const m = Object.fromEntries(p.destinations.map((d) => [d.assetClass, d.amountVnd]));
    expect(m).toEqual({ STOCKS: 40_000_000, GOLD: 10_000_000, CASH: 30_000_000 });
  });

  it('BẤT BIẾN: tổng tiền vào + chưa phân bổ === tổng tiền bán', () => {
    const ban = p.sells.reduce((s, x) => s + x.sellVnd, 0);
    const vao = p.destinations.reduce((s, x) => s + x.amountVnd, 0);
    expect(vao + p.unallocatedVnd).toBe(ban);
  });

  it('không có lệnh nào bị bỏ', () => {
    expect(p.skipped).toEqual([]);
  });
});

describe('planSellRebalance — bán về rìa band', () => {
  const cfg = { ...DEFAULT_CONFIG, sellTo: 'BAND_EDGE' as const };
  const p = lapKeHoach(CRYPTO_QUA_NONG, cfg);

  it('chỉ bán 30.000.000 để về rìa trên 25% (280tr → 250tr) — bán ít hơn', () => {
    expect(p.sells[0].sellVnd).toBe(30_000_000);
  });

  it('BẤT BIẾN: tổng tiền vào + chưa phân bổ === tổng tiền bán', () => {
    const ban = p.sells.reduce((s, x) => s + x.sellVnd, 0);
    const vao = p.destinations.reduce((s, x) => s + x.amountVnd, 0);
    expect(vao + p.unallocatedVnd).toBe(ban);
  });
});

describe('planSellRebalance — không bán khi chưa cần', () => {
  it('bộ số §21: không class nào REBALANCE_REQUIRED → KHÔNG có lệnh bán', () => {
    const p = lapKeHoach(VI_DU_21);
    expect(p.sells).toEqual([]);
    expect(p.destinations).toEqual([]);
    expect(p.unallocatedVnd).toBe(0);
    expect(p.skipped).toEqual([]);
  });

  it('class REBALANCE_REQUIRED nhưng đang THIẾU (không thừa) → không bán nó', () => {
    // Stocks 38% ⇒ ngoài band 40–55, lệch −12đ% ⇒ REBALANCE_REQUIRED nhưng thiếu.
    const values: Record<AssetClass, number> = {
      STOCKS: 380_000_000, CRYPTO: 240_000_000, GOLD: 190_000_000, CASH: 190_000_000,
    };
    const p = lapKeHoach(values);
    expect(p.sells.map((s) => s.assetClass)).not.toContain('STOCKS');
  });
});

describe('planSellRebalance — không bán vụn (§18)', () => {
  it('lệnh dưới minSellAmountVnd bị bỏ, nhưng PHẢI báo ở skipped', () => {
    const cfg = { ...DEFAULT_CONFIG, minSellAmountVnd: 100_000_000 };
    const p = lapKeHoach(CRYPTO_QUA_NONG, cfg);
    expect(p.sells).toEqual([]);
    expect(p.destinations).toEqual([]);
    expect(p.skipped).toEqual([{ assetClass: 'CRYPTO', wouldSellVnd: 80_000_000 }]);
  });
});

describe('planSellRebalance — tiền bán không có chỗ đi', () => {
  it('mọi nhóm khác đều thừa và Cash bị loại → tiền bán vào unallocatedVnd, KHÔNG biến mất', () => {
    // Crypto 30% (phải bán), ba nhóm còn lại đều ở/trên target, Cash bị loại bằng cấu hình.
    const values: Record<AssetClass, number> = {
      STOCKS: 550_000_000, CRYPTO: 300_000_000, GOLD: 160_000_000, CASH: 0,
    };
    const cfg = { ...DEFAULT_CONFIG, cashEligibleForNewCapital: false };
    const p = lapKeHoach(values, cfg);
    const ban = p.sells.reduce((s, x) => s + x.sellVnd, 0);
    const vao = p.destinations.reduce((s, x) => s + x.amountVnd, 0);
    expect(ban).toBeGreaterThan(0);
    expect(vao + p.unallocatedVnd).toBe(ban);
  });
});

describe('planSellRebalance — biên', () => {
  it('danh mục rỗng → không bán gì, không NaN', () => {
    const rong: Record<AssetClass, number> = { STOCKS: 0, CRYPTO: 0, GOLD: 0, CASH: 0 };
    const p = lapKeHoach(rong);
    expect(p.sells).toEqual([]);
    expect(p.destinations).toEqual([]);
  });

  it('hai class cùng quá nóng → bán cả hai', () => {
    // Crypto 28%, Gold 27% (ngoài band 10–20, lệch +12đ%).
    const values: Record<AssetClass, number> = {
      STOCKS: 350_000_000, CRYPTO: 280_000_000, GOLD: 270_000_000, CASH: 100_000_000,
    };
    const p = lapKeHoach(values);
    expect(p.sells.map((s) => s.assetClass).sort()).toEqual(['CRYPTO', 'GOLD']);
    const ban = p.sells.reduce((s, x) => s + x.sellVnd, 0);
    const vao = p.destinations.reduce((s, x) => s + x.amountVnd, 0);
    expect(vao + p.unallocatedVnd).toBe(ban);
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn fail**

Run: `npx vitest run src/domain/rebalanceSell.test.ts`
Kỳ vọng: FAIL với `Failed to resolve import "./rebalanceSell"`.

- [ ] **Step 3: Viết `src/domain/rebalanceSell.ts`**

```ts
// §6 Mode B — chỉ dùng khi tỷ trọng lệch nghiêm trọng. Hàm thuần.
//
// KHOÁ AN TOÀN: chỉ sinh lệnh bán cho class vừa NGOÀI BAND vừa lệch ≥ 5đ%
// (trạng thái REBALANCE_REQUIRED) VÀ đang thừa. Đúng mục tiêu 1 của §18
// "MINIMIZE SELLING" — mọi trường hợp nhẹ hơn thì dùng tiền mới, không bán.
//
// MỨC BÁN (spec mục 4.7): mặc định bán về đúng TARGET, không phải về rìa band.
// Cắt sát rìa sẽ bật ra ngoài lại ngay và sinh chuỗi bán lắt nhắt — ít LẦN bán
// hơn thì tổng phí thấp hơn. Đổi được sang BAND_EDGE trong Settings.
//
// Tiền bán được chia bằng CHÍNH allocate.ts — không viết lại logic phân bổ.

import { allocate } from './allocate';
import { totalVnd } from './weights';
import { sumVnd } from './money';
import type {
  AssetClass, BandStatus, EngineConfig, SellOrder, SellPlan, TargetBand, Weight,
} from './types';

export interface SellRebalanceInput {
  weights: Weight[];
  statuses: Record<AssetClass, BandStatus>;
  classValues: Record<AssetClass, number>;
  targets: Record<AssetClass, TargetBand>;
  config: EngineConfig;
}

export function planSellRebalance(input: SellRebalanceInput): SellPlan {
  const { weights, statuses, classValues, targets, config } = input;
  const total = totalVnd(classValues);

  const sells: SellOrder[] = [];
  const skipped: { assetClass: AssetClass; wouldSellVnd: number }[] = [];

  for (const w of weights) {
    // Hai khoá: phải REBALANCE_REQUIRED, và phải đang THỪA.
    if (statuses[w.assetClass] !== 'REBALANCE_REQUIRED') continue;
    if (w.deviationPp <= 0) continue;

    const nguongVe = config.sellTo === 'BAND_EDGE'
      ? total * (targets[w.assetClass].maxPct / 100)
      : w.targetValueVnd;

    const sellVnd = w.valueVnd - nguongVe;
    if (sellVnd <= 0) continue;

    // §18: không bán vụn. Nhưng PHẢI báo, không nuốt im lặng.
    if (sellVnd < config.minSellAmountVnd) {
      skipped.push({ assetClass: w.assetClass, wouldSellVnd: sellVnd });
      continue;
    }
    sells.push({ assetClass: w.assetClass, sellVnd });
  }

  if (sells.length === 0) {
    return { sells: [], destinations: [], unallocatedVnd: 0, skipped };
  }

  // Tiền bán đã nằm trong danh mục ⇒ addsToTotal = false.
  // Class vừa bán có khoảng thiếu âm nên tự nhiên không nhận lại tiền của chính nó.
  const pool = sumVnd(sells.map((s) => s.sellVnd));
  const { allocations, unallocatedVnd } = allocate({
    classValues, targets, poolVnd: pool, addsToTotal: false, config,
  });

  return { sells, destinations: allocations, unallocatedVnd, skipped };
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npx vitest run src/domain/rebalanceSell.test.ts`
Kỳ vọng: PASS toàn bộ (13 test).

- [ ] **Step 5: Chạy toàn bộ test**

Run: `npm test`
Kỳ vọng: toàn bộ PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/rebalanceSell.ts src/domain/rebalanceSell.test.ts
git commit -m "feat(portfolio): rebalanceSell.ts — §6 Mode B, hai khoá an toàn

Chỉ sinh lệnh bán khi class vừa ngoài band vừa lệch ≥5đ% VÀ đang thừa.
Mọi trường hợp nhẹ hơn dùng tiền mới — đúng mục tiêu 1 của §18.

Mặc định bán về đúng target (ít LẦN bán hơn), đổi được sang rìa band.
Lệnh dưới 5tr bị bỏ nhưng vẫn báo ở skipped, không nuốt im lặng.

Tiền bán chia bằng chính allocate.ts, không viết lại logic phân bổ."
```

---

### Task 10: `drawdown.ts` — §9

**Files:**
- Create: `src/domain/drawdown.ts`
- Test: `src/domain/drawdown.test.ts`

**Interfaces:**
- Consumes: `DrawdownStats` (Task 4) · `daysBetween` (Task 4)
- Produces: `computeDrawdown(series: { date: string; value: number }[]): DrawdownStats | null`

Một hàm dùng cho **cả bốn nguồn**: chuỗi giá VNINDEX, BTC, vàng, và chuỗi `snapshots` giá trị danh mục. Trả `null` khi chuỗi rỗng — người gọi phải xử lý tường minh, không nhận số 0 giả.

- [ ] **Step 1: Viết test (chưa có file nguồn)**

Tạo `src/domain/drawdown.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeDrawdown } from './drawdown';

/** Chuỗi ngày liên tiếp từ 2026-01-01 để kiểm daysSinceHigh cho tiện. */
function chuoi(...values: number[]) {
  return values.map((value, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, '0')}`,
    value,
  }));
}

describe('computeDrawdown — chuỗi tăng liên tục', () => {
  const d = computeDrawdown(chuoi(100, 110, 120))!;

  it('không sụt giảm', () => {
    expect(d.currentPct).toBe(0);
    expect(d.maxPct).toBe(0);
  });

  it('đỉnh là điểm cuối, 0 ngày kể từ đỉnh', () => {
    expect(d.ath).toEqual({ date: '2026-01-03', value: 120 });
    expect(d.daysSinceHigh).toBe(0);
  });

  it('đã hồi phục 100%', () => {
    expect(d.recoveryPct).toBe(100);
  });
});

describe('computeDrawdown — chuỗi giảm liên tục', () => {
  const d = computeDrawdown(chuoi(100, 90, 80))!;

  it('sụt 20% từ đỉnh, và đó cũng là mức sâu nhất', () => {
    expect(d.currentPct).toBeCloseTo(20, 6);
    expect(d.maxPct).toBeCloseTo(20, 6);
  });

  it('đáy là điểm cuối, chưa hồi phục gì', () => {
    expect(d.trough).toEqual({ date: '2026-01-03', value: 80 });
    expect(d.recoveryPct).toBe(0);
  });

  it('2 ngày kể từ đỉnh', () => {
    expect(d.daysSinceHigh).toBe(2);
  });
});

describe('computeDrawdown — hình chữ V (đã hồi một phần)', () => {
  const d = computeDrawdown(chuoi(100, 60, 80))!;

  it('hiện sụt 20% nhưng ĐÃ TỪNG sụt 40%', () => {
    expect(d.currentPct).toBeCloseTo(20, 6);
    expect(d.maxPct).toBeCloseTo(40, 6);
  });

  it('hồi được 50% quãng đường từ đáy về đỉnh', () => {
    // (80 − 60) / (100 − 60) = 50%
    expect(d.recoveryPct).toBeCloseTo(50, 6);
  });
});

describe('computeDrawdown — hai đợt sụt, đỉnh mới ở giữa', () => {
  // 100 → 70 (sụt 30%) → 120 (đỉnh mới) → 90 (sụt 25% từ đỉnh mới)
  const d = computeDrawdown(chuoi(100, 70, 120, 90))!;

  it('sụt hiện tại tính từ ĐỈNH CAO NHẤT (120), không phải đỉnh đầu', () => {
    expect(d.currentPct).toBeCloseTo(25, 6);
    expect(d.ath).toEqual({ date: '2026-01-03', value: 120 });
  });

  it('sụt sâu nhất trong lịch sử là 30% (đợt đầu), không phải 25%', () => {
    expect(d.maxPct).toBeCloseTo(30, 6);
  });

  it('đáy dùng để tính hồi phục là đáy SAU đỉnh cao nhất', () => {
    expect(d.trough).toEqual({ date: '2026-01-04', value: 90 });
    expect(d.recoveryPct).toBe(0);
  });
});

describe('computeDrawdown — biên', () => {
  it('chuỗi rỗng → null (người gọi phải xử lý tường minh)', () => {
    expect(computeDrawdown([])).toBeNull();
  });

  it('một điểm duy nhất → không sụt, hồi phục 100%', () => {
    const d = computeDrawdown(chuoi(100))!;
    expect(d.currentPct).toBe(0);
    expect(d.maxPct).toBe(0);
    expect(d.recoveryPct).toBe(100);
    expect(d.daysSinceHigh).toBe(0);
  });

  it('toàn số 0 → không chia cho 0, không ra NaN', () => {
    const d = computeDrawdown(chuoi(0, 0, 0))!;
    expect(Number.isNaN(d.currentPct)).toBe(false);
    expect(Number.isNaN(d.maxPct)).toBe(false);
    expect(Number.isNaN(d.recoveryPct)).toBe(false);
    expect(d.currentPct).toBe(0);
  });

  it('chuỗi truyền vào KHÔNG theo thứ tự ngày vẫn tính đúng (tự sắp xếp)', () => {
    const daoLon = [
      { date: '2026-01-03', value: 80 },
      { date: '2026-01-01', value: 100 },
      { date: '2026-01-02', value: 60 },
    ];
    const d = computeDrawdown(daoLon)!;
    expect(d.currentPct).toBeCloseTo(20, 6);
    expect(d.maxPct).toBeCloseTo(40, 6);
  });

  it('KHÔNG làm biến đổi mảng đầu vào', () => {
    const goc = chuoi(100, 60, 80);
    const ban = [...goc];
    computeDrawdown(goc);
    expect(goc).toEqual(ban);
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn fail**

Run: `npx vitest run src/domain/drawdown.test.ts`
Kỳ vọng: FAIL với `Failed to resolve import "./drawdown"`.

- [ ] **Step 3: Viết `src/domain/drawdown.ts`**

```ts
// §9 — đo mức sụt giảm. Hàm thuần, dùng chung cho benchmark và cho danh mục.
//
// Phân biệt hai con số dễ lẫn:
//   currentPct = sụt hiện tại, tính từ ĐỈNH CAO NHẤT toàn chuỗi (ATH)
//   maxPct     = sụt SÂU NHẤT từng xảy ra, tính bằng cách quét đỉnh trượt
// Chuỗi 100 → 70 → 120 → 90 có currentPct 25% nhưng maxPct 30%.

import { daysBetween } from './money';
import type { DrawdownStats } from './types';

export function computeDrawdown(
  series: { date: string; value: number }[],
): DrawdownStats | null {
  if (series.length === 0) return null;

  // Sắp xếp bản SAO — không làm biến đổi mảng của người gọi.
  const sorted = [...series].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const last = sorted[sorted.length - 1];

  // Đỉnh cao nhất; nếu trùng giá trị thì lấy điểm SỚM NHẤT (đỉnh thật sự).
  let athIndex = 0;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].value > sorted[athIndex].value) athIndex = i;
  }
  const ath = sorted[athIndex];

  // Sụt sâu nhất trong lịch sử: quét bằng đỉnh trượt.
  let dinhTruot = sorted[0].value;
  let maxPct = 0;
  for (const p of sorted) {
    if (p.value > dinhTruot) dinhTruot = p.value;
    if (dinhTruot > 0) {
      const dd = ((dinhTruot - p.value) / dinhTruot) * 100;
      if (dd > maxPct) maxPct = dd;
    }
  }

  // Đáy dùng để tính hồi phục là đáy SAU đỉnh cao nhất.
  let trough = sorted[athIndex];
  for (let i = athIndex; i < sorted.length; i++) {
    if (sorted[i].value < trough.value) trough = sorted[i];
  }

  const currentPct = ath.value > 0 ? ((ath.value - last.value) / ath.value) * 100 : 0;
  const bienDo = ath.value - trough.value;
  // Chưa từng sụt (đỉnh = đáy) ⇒ coi như đã hồi phục hoàn toàn, không chia cho 0.
  const recoveryPct = bienDo > 0 ? ((last.value - trough.value) / bienDo) * 100 : 100;

  return {
    currentPct,
    maxPct,
    ath: { date: ath.date, value: ath.value },
    trough: { date: trough.date, value: trough.value },
    daysSinceHigh: daysBetween(ath.date, last.date),
    recoveryPct,
  };
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npx vitest run src/domain/drawdown.test.ts`
Kỳ vọng: PASS toàn bộ (16 test).

- [ ] **Step 5: Commit**

```bash
git add src/domain/drawdown.ts src/domain/drawdown.test.ts
git commit -m "feat(portfolio): drawdown.ts — §9, một hàm cho cả benchmark và danh mục

Phân biệt rõ hai con số dễ lẫn: currentPct tính từ đỉnh cao nhất toàn chuỗi,
maxPct là mức sâu nhất từng xảy ra (quét đỉnh trượt). Chuỗi 100→70→120→90 có
currentPct 25% nhưng maxPct 30%.

Chuỗi rỗng trả null để người gọi xử lý tường minh, không nhận số 0 giả.
Toàn số 0 không chia cho 0. Không làm biến đổi mảng đầu vào."
```

---

### Task 11: `crashReserve.ts` — §8 với khái niệm đợt sụt giảm

**Files:**
- Create: `src/domain/crashReserve.ts`
- Test: `src/domain/crashReserve.test.ts`

**Interfaces:**
- Consumes: `CrashLevel`, `CrashEventRecord`, `CrashRecommendation` (Task 4)
- Produces:
  - `interface CrashReserveInput { portfolioDrawdownPct: number; currentEpisodeStart: string; cashReserveVnd: number; levels: CrashLevel[]; history: CrashEventRecord[] }`
  - `evaluateCrashReserve(input: CrashReserveInput): CrashRecommendation`
  - `DEFAULT_CRASH_LEVELS: CrashLevel[]`

**Hai điều §8 bỏ trống mà thiếu là sai tiền (spec mục 4.8):**
1. *"dùng 10% Crash Reserve"* — **10% của số dư tại lúc đợt sụt giảm BẮT ĐẦU**, đã chụp ảnh lại. Tính theo số dư hiện tại thì mỗi bậc sau nhỏ dần vô lý.
2. **Một đợt = từ khi phá đỉnh cũ tới khi lập đỉnh mới.** Mỗi bậc chỉ kích hoạt một lần trong một đợt. Lập đỉnh mới ⇒ đợt mới, 5 bậc reset.

- [ ] **Step 1: Viết test (chưa có file nguồn)**

Tạo `src/domain/crashReserve.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { evaluateCrashReserve, DEFAULT_CRASH_LEVELS } from './crashReserve';
import type { CrashEventRecord } from './types';

const DOT_NAY = '2026-06-01';
const RESERVE = 100_000_000;

function xet(
  drawdownPct: number,
  over: { cashReserveVnd?: number; history?: CrashEventRecord[] } = {},
) {
  return evaluateCrashReserve({
    portfolioDrawdownPct: drawdownPct,
    currentEpisodeStart: DOT_NAY,
    cashReserveVnd: over.cashReserveVnd ?? RESERVE,
    levels: DEFAULT_CRASH_LEVELS,
    history: over.history ?? [],
  });
}

describe('DEFAULT_CRASH_LEVELS', () => {
  it('5 bậc, tổng đúng 100% (bậc 5 dùng phần còn lại)', () => {
    expect(DEFAULT_CRASH_LEVELS).toHaveLength(5);
    const tong = DEFAULT_CRASH_LEVELS.reduce((s, l) => s + l.deployPctOfReserve, 0);
    expect(tong).toBe(100);
  });

  it('ngưỡng sụt giảm đúng §8: 15/25/35/45/55', () => {
    expect(DEFAULT_CRASH_LEVELS.map((l) => l.drawdownPct)).toEqual([15, 25, 35, 45, 55]);
  });
});

describe('evaluateCrashReserve — chưa tới ngưỡng', () => {
  const r = xet(3.2);

  it('không bậc nào kích hoạt', () => {
    expect(r.triggeredLevels).toEqual([]);
    expect(r.totalDeployVnd).toBe(0);
  });

  it('cho biết bậc kế tiếp còn cách bao nhiêu (để UI hiện)', () => {
    expect(r.nextLevel).toEqual({ level: 1, drawdownPct: 15, gapPp: 11.8 });
  });

  it('chụp ảnh reserve của đợt = số dư hiện tại (đợt chưa có sự kiện nào)', () => {
    expect(r.reserveAtEpisodeStartVnd).toBe(RESERVE);
  });
});

describe('evaluateCrashReserve — kích hoạt lần đầu', () => {
  it('sụt 18% → chỉ bậc 1, giải ngân 10% của 100tr = 10tr', () => {
    const r = xet(18);
    expect(r.triggeredLevels).toEqual([{ level: 1, drawdownPct: 15, deployVnd: 10_000_000 }]);
    expect(r.totalDeployVnd).toBe(10_000_000);
    expect(r.nextLevel).toEqual({ level: 2, drawdownPct: 25, gapPp: 7 });
  });

  it('sụt 28% (nhảy hai bậc cùng lúc) → bậc 1 + bậc 2 = 25tr', () => {
    const r = xet(28);
    expect(r.triggeredLevels.map((t) => t.level)).toEqual([1, 2]);
    expect(r.totalDeployVnd).toBe(25_000_000);
  });

  it('sụt 60% → cả 5 bậc, tổng đúng bằng toàn bộ reserve', () => {
    const r = xet(60);
    expect(r.triggeredLevels.map((t) => t.level)).toEqual([1, 2, 3, 4, 5]);
    expect(r.totalDeployVnd).toBe(100_000_000);
    expect(r.nextLevel).toBeNull();
  });
});

describe('evaluateCrashReserve — bậc đã dùng trong CÙNG đợt', () => {
  const daDungBac1: CrashEventRecord[] = [
    { level: 1, episodeStart: DOT_NAY, reserveAtEpisodeStartVnd: 100_000_000 },
  ];

  it('không kích hoạt lại bậc 1 (không lải nhải mỗi tháng)', () => {
    const r = xet(28, { history: daDungBac1 });
    expect(r.triggeredLevels.map((t) => t.level)).toEqual([2]);
  });

  it('% TÍNH TRÊN SỐ DƯ LÚC ĐỢT BẮT ĐẦU (100tr), không phải số dư hiện tại (90tr)', () => {
    // Đây là điểm §8 bỏ trống. Tính trên 90tr sẽ ra 13,5tr — sai.
    const r = xet(28, { history: daDungBac1, cashReserveVnd: 90_000_000 });
    expect(r.reserveAtEpisodeStartVnd).toBe(100_000_000);
    expect(r.triggeredLevels).toEqual([{ level: 2, drawdownPct: 25, deployVnd: 15_000_000 }]);
  });
});

describe('evaluateCrashReserve — đợt MỚI thì reset 5 bậc', () => {
  it('lịch sử thuộc đợt cũ → bậc 1 kích hoạt lại được', () => {
    const dotCu: CrashEventRecord[] = [
      { level: 1, episodeStart: '2025-03-01', reserveAtEpisodeStartVnd: 50_000_000 },
      { level: 2, episodeStart: '2025-03-01', reserveAtEpisodeStartVnd: 50_000_000 },
    ];
    const r = xet(18, { history: dotCu });
    expect(r.triggeredLevels.map((t) => t.level)).toEqual([1]);
    // Đợt mới ⇒ chụp ảnh lại theo số dư hiện tại, không dùng 50tr của đợt cũ.
    expect(r.reserveAtEpisodeStartVnd).toBe(RESERVE);
  });
});

describe('evaluateCrashReserve — không giải ngân quá số tiền đang có', () => {
  it('reserve 50tr nhưng 5 bậc đòi 100tr → cắt đúng ở 50tr', () => {
    const r = xet(60, { cashReserveVnd: 50_000_000 });
    expect(r.totalDeployVnd).toBe(50_000_000);
    // Bậc 1-3 đủ (10+15+20=45tr), bậc 4 chỉ còn 5tr, bậc 5 hết tiền.
    expect(r.triggeredLevels.map((t) => t.deployVnd))
      .toEqual([10_000_000, 15_000_000, 20_000_000, 5_000_000, 0]);
  });

  it('reserve = 0 → vẫn BÁO bậc đã đạt nhưng giải ngân 0, không nuốt im lặng', () => {
    const r = xet(18, { cashReserveVnd: 0 });
    expect(r.triggeredLevels).toEqual([{ level: 1, drawdownPct: 15, deployVnd: 0 }]);
    expect(r.totalDeployVnd).toBe(0);
  });
});

describe('evaluateCrashReserve — biên', () => {
  it('sụt đúng bằng ngưỡng (15%) thì kích hoạt (bao gồm biên)', () => {
    expect(xet(15).triggeredLevels.map((t) => t.level)).toEqual([1]);
  });

  it('sụt 14,9% thì chưa', () => {
    expect(xet(14.9).triggeredLevels).toEqual([]);
  });

  it('danh sách bậc rỗng → không kích hoạt gì, nextLevel null', () => {
    const r = evaluateCrashReserve({
      portfolioDrawdownPct: 60, currentEpisodeStart: DOT_NAY,
      cashReserveVnd: RESERVE, levels: [], history: [],
    });
    expect(r.triggeredLevels).toEqual([]);
    expect(r.nextLevel).toBeNull();
  });

  it('bậc truyền vào không theo thứ tự vẫn xử lý đúng từ thấp lên cao', () => {
    const daoLon = [...DEFAULT_CRASH_LEVELS].reverse();
    const r = evaluateCrashReserve({
      portfolioDrawdownPct: 28, currentEpisodeStart: DOT_NAY,
      cashReserveVnd: RESERVE, levels: daoLon, history: [],
    });
    expect(r.triggeredLevels.map((t) => t.level)).toEqual([1, 2]);
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn fail**

Run: `npx vitest run src/domain/crashReserve.test.ts`
Kỳ vọng: FAIL với `Failed to resolve import "./crashReserve"`.

- [ ] **Step 3: Viết `src/domain/crashReserve.ts`**

```ts
// §8 — Crash Reserve. Hàm thuần. CHỈ ĐƯA ĐỀ XUẤT, không bao giờ tự mua (§23).
//
// §8 bỏ trống hai điều mà thiếu là sai tiền (spec mục 4.8):
//
// (a) "dùng 10% Crash Reserve" — 10% của SỐ DƯ TẠI LÚC ĐỢT SỤT GIẢM BẮT ĐẦU,
//     đã chụp ảnh lại. Nếu tính theo số dư hiện tại thì mỗi bậc sau nhỏ dần
//     một cách vô lý (10%, rồi 15% của phần còn lại...).
//
// (b) MỘT ĐỢT = từ khi phá đỉnh cũ tới khi lập đỉnh mới. Trong cùng một đợt,
//     mỗi bậc chỉ kích hoạt MỘT LẦN. Lập đỉnh mới ⇒ đợt mới, 5 bậc reset.
//     Không có khái niệm này thì hoặc app lải nhải "dùng bậc 1" mỗi tháng,
//     hoặc lần khủng hoảng sau không kích hoạt được nữa.

import type { CrashEventRecord, CrashLevel, CrashRecommendation } from './types';

/** §8. Tổng 10+15+20+25+30 = 100% — bậc 5 dùng "phần còn lại". */
export const DEFAULT_CRASH_LEVELS: CrashLevel[] = [
  { level: 1, drawdownPct: 15, deployPctOfReserve: 10 },
  { level: 2, drawdownPct: 25, deployPctOfReserve: 15 },
  { level: 3, drawdownPct: 35, deployPctOfReserve: 20 },
  { level: 4, drawdownPct: 45, deployPctOfReserve: 25 },
  { level: 5, drawdownPct: 55, deployPctOfReserve: 30 },
];

export interface CrashReserveInput {
  portfolioDrawdownPct: number;
  /** Ngày lập đỉnh gần nhất — mốc bắt đầu đợt sụt giảm hiện tại. */
  currentEpisodeStart: string;
  /** Số dư túi VND-RESERVE hiện tại. */
  cashReserveVnd: number;
  levels: CrashLevel[];
  history: CrashEventRecord[];
}

export function evaluateCrashReserve(input: CrashReserveInput): CrashRecommendation {
  const { portfolioDrawdownPct, currentEpisodeStart, cashReserveVnd, levels, history } = input;

  const suKienDotNay = history.filter((h) => h.episodeStart === currentEpisodeStart);

  // (a) Mốc tính %: số dư lúc đợt bắt đầu. Đợt chưa có sự kiện nào thì chụp ảnh bây giờ.
  const reserveAtEpisodeStartVnd = suKienDotNay.length > 0
    ? suKienDotNay[0].reserveAtEpisodeStartVnd
    : cashReserveVnd;

  // (b) Bậc đã dùng TRONG ĐỢT NÀY. Đợt khác không tính.
  const daDung = new Set(suKienDotNay.map((h) => h.level));

  const theoThuTu = [...levels].sort((a, b) => a.drawdownPct - b.drawdownPct);

  const triggeredLevels: CrashRecommendation['triggeredLevels'] = [];
  let conLai = cashReserveVnd;

  for (const l of theoThuTu) {
    if (l.drawdownPct > portfolioDrawdownPct) continue;   // chưa tới ngưỡng
    if (daDung.has(l.level)) continue;                    // đã dùng trong đợt này

    const muon = reserveAtEpisodeStartVnd * (l.deployPctOfReserve / 100);
    // Không giải ngân quá số tiền đang thực có. Hết tiền vẫn BÁO bậc đã đạt
    // (deployVnd = 0) để người dùng biết, không nuốt im lặng.
    const cho = Math.max(0, Math.min(muon, conLai));
    conLai -= cho;

    triggeredLevels.push({ level: l.level, drawdownPct: l.drawdownPct, deployVnd: cho });
  }

  const bacKeTiep = theoThuTu.find((l) => l.drawdownPct > portfolioDrawdownPct);

  return {
    episodeStart: currentEpisodeStart,
    reserveAtEpisodeStartVnd,
    triggeredLevels,
    totalDeployVnd: triggeredLevels.reduce((s, t) => s + t.deployVnd, 0),
    nextLevel: bacKeTiep
      ? {
          level: bacKeTiep.level,
          drawdownPct: bacKeTiep.drawdownPct,
          gapPp: bacKeTiep.drawdownPct - portfolioDrawdownPct,
        }
      : null,
  };
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npx vitest run src/domain/crashReserve.test.ts`
Kỳ vọng: PASS toàn bộ (17 test).

Nếu ca `gapPp: 11.8` fail vì dấu phẩy động (`11.800000000000001`), sửa test thành `expect(r.nextLevel!.gapPp).toBeCloseTo(11.8, 6)` — **không** làm tròn trong engine, vì làm tròn ở tầng domain là làm mất thông tin.

- [ ] **Step 5: Chạy toàn bộ test**

Run: `npm test`
Kỳ vọng: toàn bộ PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/crashReserve.ts src/domain/crashReserve.test.ts
git commit -m "feat(portfolio): crashReserve.ts — §8 với khái niệm đợt sụt giảm

§8 bỏ trống hai điều mà thiếu là sai tiền:
(a) '10% Crash Reserve' = 10% của số dư TẠI LÚC ĐỢT BẮT ĐẦU, đã chụp ảnh.
    Tính theo số dư hiện tại thì mỗi bậc sau nhỏ dần vô lý.
(b) Một đợt = từ khi phá đỉnh cũ tới khi lập đỉnh mới. Mỗi bậc chỉ kích hoạt
    một lần trong một đợt; lập đỉnh mới thì reset. Không có khái niệm này thì
    hoặc app lải nhải mỗi tháng, hoặc lần khủng hoảng sau không kích hoạt được.

Không giải ngân quá số tiền thực có; hết tiền vẫn báo bậc đã đạt với deployVnd=0."
```

---

### Task 12: `actionPlan.ts` — §18 §19 §20 bộ điều phối + alerts

**Files:**
- Create: `src/domain/actionPlan.ts`
- Test: `src/domain/actionPlan.test.ts`
- Modify: `src/domain/types.ts` (thêm một mã alert)

**Interfaces:**
- Consumes: mọi thứ từ Task 4–11
- Produces: `buildActionPlan(snapshot: PortfolioSnapshot): ActionPlan` · `toEarmarkedValues(classValues, earmarkedPots): Record<AssetClass, number>`

**Sửa `types.ts`:** thêm `'BAND_WATCH'` vào `AlertCode`. §19 liệt kê 8 loại alert nhưng không có loại nào cho trạng thái `WATCH` — trong khi §21 lại hiện đúng loại đó (*"REBALANCE WARNING: Crypto overweight 4.8pp"* kèm *"NO SELL REQUIRED"*). Dùng `OUT_OF_BAND` cho một class **đang trong band** là sai nghĩa, nên thêm mã thứ 9.

**⭐ Điểm tinh tế nhất của task này — cách gộp Z và cổ tức vào một lần phân bổ:**

Z là tiền từ ngoài vào (làm **tăng** tổng), cổ tức thì **đã nằm** trong Cash. Không thể gộp rồi gọi `allocate` với `addsToTotal: true` — như vậy cộng cổ tức hai lần. Cách đúng, tái dùng `allocate` không cần sửa:

```ts
// Cộng Z vào Cash TRƯỚC, rồi gọi với addsToTotal: false.
// ⇒ bên trong allocate: total = tổng cũ + Z = newTotal ✓
//                       preValues.CASH = cash + Z ✓ (không cộng lần nữa)
// pool = Z + cổ tức = số tiền đang tự do để giải ngân.
const valuesWithZ = { ...earmarked, CASH: earmarked.CASH + s.monthlyContributionVnd };
const poolVnd = s.monthlyContributionVnd + s.incomeReceivedVnd;
allocate({ classValues: valuesWithZ, targets, poolVnd, addsToTotal: false, config });
```

**Ngân sách mua cổ phiếu = khoản phân bổ tháng này + tiền còn trong túi `VND-DCA-STOCKS`.** Đây chính là cơ chế dồn tiền (carryover) — không cần code riêng.

- [ ] **Step 1: Thêm mã alert vào `types.ts`**

Trong `src/domain/types.ts`, sửa `AlertCode`:

```ts
export type AlertCode =
  | 'BAND_WATCH'          // trong band nhưng lệch đáng kể — §21 gọi là REBALANCE WARNING
  | 'OUT_OF_BAND'
  | 'REBALANCE_REQUIRED'
  | 'STOCK_DRAWDOWN'
  | 'CRYPTO_DRAWDOWN'
  | 'GOLD_DRAWDOWN'
  | 'PORTFOLIO_DRAWDOWN'
  | 'CASH_BELOW_MIN'
  | 'CONTRIBUTION_MISSING';
```

- [ ] **Step 2: Viết test — ví dụ §21 chạy đầu-tới-cuối**

Tạo `src/domain/actionPlan.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildActionPlan, toEarmarkedValues } from './actionPlan';
import { DEFAULT_CRASH_LEVELS } from './crashReserve';
import { DEFAULT_CONFIG } from './types';
import type { AssetClass, PortfolioSnapshot, TargetBand, WatchlistItem } from './types';

const TARGETS: Record<AssetClass, TargetBand> = {
  STOCKS: { targetPct: 50, minPct: 40, maxPct: 55 },
  CRYPTO: { targetPct: 20, minPct: 15, maxPct: 25 },
  GOLD:   { targetPct: 15, minPct: 10, maxPct: 20 },
  CASH:   { targetPct: 15, minPct: 7,  maxPct: 20 },
};

const WATCHLIST: WatchlistItem[] = [
  { symbol: 'HND', name: 'HND', group: 'defense',
    currentPriceVnd: 13_000, thresholdVnd: 13_300, lotSize: 100 },
  { symbol: 'FPT', name: 'FPT', group: 'balance',
    currentPriceVnd: 98_000, thresholdVnd: 100_000, lotSize: 100 },
];

function snapshot(over: Partial<PortfolioSnapshot> = {}): PortfolioSnapshot {
  return {
    asOf: '2026-09-01',
    // Bộ số §21. Túi DCA đang rỗng nên classValues = giá trị earmarked.
    classValues: { STOCKS: 513_300_000, CRYPTO: 269_700_000,
                   GOLD: 179_437_500, CASH: 125_062_500 },
    earmarkedPots: { STOCKS: 0, CRYPTO: 0, GOLD: 0, CASH: 0 },
    cashReserveVnd: 125_062_500,
    targets: TARGETS,
    monthlyContributionVnd: 3_000_000,
    incomeReceivedVnd: 0,
    drawdowns: { STOCKS: 3.2, CRYPTO: 8.1, GOLD: 1.0, CASH: 0 },
    portfolioDrawdownPct: 3.2,
    crashLevels: DEFAULT_CRASH_LEVELS,
    crashHistory: [],
    currentEpisodeStart: '2026-06-01',
    missingPriceSymbols: [],
    contributionRecordedThisPeriod: true,
    watchlist: WATCHLIST,
    config: DEFAULT_CONFIG,
    ...over,
  };
}

const soTien = (p: { buys: { assetClass: AssetClass; amountVnd: number }[] }) =>
  Object.fromEntries(p.buys.map((b) => [b.assetClass, b.amountVnd]));

describe('buildActionPlan — ví dụ §21 đầu tới cuối', () => {
  const p = buildActionPlan(snapshot());

  it('tạo được kế hoạch', () => {
    expect(p.status).toBe('READY');
    expect(p.blockedReason).toBeNull();
    expect(p.totalVnd).toBe(1_087_500_000);
  });

  it('MUA Stocks 1.400.000 và GIỮ Cash 1.600.000', () => {
    expect(soTien(p)).toEqual({ STOCKS: 1_400_000, CASH: 1_600_000 });
  });

  it('KHÔNG MUA Crypto và Gold, kèm lý do tiếng Việt', () => {
    expect(p.doNotBuy.map((d) => d.assetClass).sort()).toEqual(['CRYPTO', 'GOLD']);
    for (const d of p.doNotBuy) expect(d.reason.length).toBeGreaterThan(0);
  });

  it('trạng thái band khớp §21: Crypto và Cash cảnh báo, Stocks và Gold ổn', () => {
    expect(p.statuses).toEqual({
      STOCKS: 'OK', CRYPTO: 'WATCH', GOLD: 'OK', CASH: 'WATCH',
    });
  });

  it('CHƯA CẦN BÁN — không class nào REBALANCE_REQUIRED', () => {
    expect(p.sellPlan).toBeNull();
  });

  it('gợi ý mã: chỉ HND mua nổi với 1,4tr; FPT vào danh sách còn thiếu', () => {
    expect(p.tickerCandidates.affordable.map((c) => c.symbol)).toEqual(['HND']);
    expect(p.tickerCandidates.shortfalls.map((s) => s.symbol)).toEqual(['FPT']);
    expect(p.tickerCandidates.shortfalls[0].shortfallVnd).toBe(8_400_000);
  });

  it('Crash Reserve chưa kích hoạt, báo còn cách bậc 1 bao nhiêu', () => {
    expect(p.crash!.triggeredLevels).toEqual([]);
    expect(p.crash!.nextLevel!.level).toBe(1);
    expect(p.crash!.nextLevel!.gapPp).toBeCloseTo(11.8, 6);
  });

  it('có alert BAND_WATCH cho Crypto (đúng REBALANCE WARNING của §21)', () => {
    const a = p.alerts.find((x) => x.code === 'BAND_WATCH' && x.message.includes('Crypto'));
    expect(a).toBeDefined();
    expect(a!.severity).toBe('INFO');
  });

  it('BẤT BIẾN: tổng mua + chưa phân bổ === Z + cổ tức', () => {
    const tong = p.buys.reduce((s, b) => s + b.amountVnd, 0);
    expect(tong + p.unallocatedVnd).toBe(3_000_000);
    expect(p.sources.poolVnd).toBe(3_000_000);
  });
});

describe('toEarmarkedValues', () => {
  it('dồn túi DCA về đúng class, Cash giảm tương ứng, TỔNG KHÔNG ĐỔI', () => {
    const values: Record<AssetClass, number> = {
      STOCKS: 250_000_000, CRYPTO: 60_000_000, GOLD: 75_000_000, CASH: 615_000_000,
    };
    const pots: Record<AssetClass, number> = {
      STOCKS: 250_000_000, CRYPTO: 140_000_000, GOLD: 75_000_000, CASH: 0,
    };
    const e = toEarmarkedValues(values, pots);
    expect(e).toEqual({
      STOCKS: 500_000_000, CRYPTO: 200_000_000, GOLD: 150_000_000, CASH: 150_000_000,
    });
    const tongTruoc = Object.values(values).reduce((s, v) => s + v, 0);
    const tongSau = Object.values(e).reduce((s, v) => s + v, 0);
    expect(tongSau).toBe(tongTruoc);
  });
});
```

- [ ] **Step 3: Viết test — cổng chặn, dồn tiền, và alerts**

Nối tiếp vào cùng file:

```ts
describe('buildActionPlan — cổng chặn (không tính trên dữ liệu thiếu)', () => {
  it('thiếu giá tài sản đang giữ → TỪ CHỐI tạo kế hoạch, nêu rõ mã nào', () => {
    const p = buildActionPlan(snapshot({ missingPriceSymbols: ['SJC-1L', 'VEA'] }));
    expect(p.status).toBe('MISSING_PRICES');
    expect(p.blockedReason).toContain('SJC-1L');
    expect(p.blockedReason).toContain('VEA');
    expect(p.buys).toEqual([]);
    expect(p.sellPlan).toBeNull();
  });

  it('danh mục rỗng → EMPTY_PORTFOLIO, không ra NaN', () => {
    const p = buildActionPlan(snapshot({
      classValues: { STOCKS: 0, CRYPTO: 0, GOLD: 0, CASH: 0 },
      cashReserveVnd: 0,
    }));
    expect(p.status).toBe('EMPTY_PORTFOLIO');
    expect(p.blockedReason).not.toBeNull();
    for (const w of p.weights) expect(Number.isNaN(w.weightPct)).toBe(false);
  });
});

describe('buildActionPlan — dồn tiền qua túi DCA (carryover)', () => {
  it('ngân sách mua cổ phiếu = phân bổ tháng này + tiền còn trong túi DCA Stocks', () => {
    // Túi DCA Stocks đang có 8,7tr ⇒ cộng với phân bổ tháng này thì mua nổi lô FPT.
    const p = buildActionPlan(snapshot({
      classValues: { STOCKS: 513_300_000, CRYPTO: 269_700_000,
                     GOLD: 179_437_500, CASH: 125_062_500 },
      earmarkedPots: { STOCKS: 8_700_000, CRYPTO: 0, GOLD: 0, CASH: 0 },
    }));
    expect(p.tickerCandidates.affordable.map((c) => c.symbol)).toContain('FPT');
  });
});

describe('buildActionPlan — cổ tức gộp cùng Z trong MỘT lần phân bổ', () => {
  const p = buildActionPlan(snapshot({ incomeReceivedVnd: 5_000_000 }));

  it('pool = Z + cổ tức', () => {
    expect(p.sources).toEqual({
      monthlyContributionVnd: 3_000_000,
      incomeReceivedVnd: 5_000_000,
      poolVnd: 8_000_000,
    });
  });

  it('BẤT BIẾN tổng vẫn đúng với pool gộp', () => {
    const tong = p.buys.reduce((s, b) => s + b.amountVnd, 0);
    expect(tong + p.unallocatedVnd).toBe(8_000_000);
  });
});

describe('buildActionPlan — có lệnh bán khi thực sự cần', () => {
  const p = buildActionPlan(snapshot({
    classValues: { STOCKS: 460_000_000, CRYPTO: 280_000_000,
                   GOLD: 140_000_000, CASH: 120_000_000 },
    cashReserveVnd: 120_000_000,
  }));

  it('Crypto 28% → REBALANCE_REQUIRED → sinh lệnh bán', () => {
    expect(p.statuses.CRYPTO).toBe('REBALANCE_REQUIRED');
    expect(p.sellPlan!.sells.map((s) => s.assetClass)).toEqual(['CRYPTO']);
  });

  it('có alert REBALANCE_REQUIRED mức ACTION', () => {
    const a = p.alerts.find((x) => x.code === 'REBALANCE_REQUIRED');
    expect(a).toBeDefined();
    expect(a!.severity).toBe('ACTION');
  });
});

describe('buildActionPlan — alerts §19', () => {
  it('chưa ghi nhận tiền vào kỳ này → CONTRIBUTION_MISSING', () => {
    const p = buildActionPlan(snapshot({ contributionRecordedThisPeriod: false }));
    expect(p.alerts.some((a) => a.code === 'CONTRIBUTION_MISSING')).toBe(true);
  });

  it('Cash dưới mức tối thiểu 7% → CASH_BELOW_MIN', () => {
    const p = buildActionPlan(snapshot({
      classValues: { STOCKS: 600_000_000, CRYPTO: 250_000_000,
                     GOLD: 200_000_000, CASH: 50_000_000 },
      cashReserveVnd: 50_000_000,
    }));
    expect(p.alerts.some((a) => a.code === 'CASH_BELOW_MIN')).toBe(true);
  });

  it('Crypto sụt 18% (vượt ngưỡng bậc 1) → CRYPTO_DRAWDOWN', () => {
    const p = buildActionPlan(snapshot({
      drawdowns: { STOCKS: 3, CRYPTO: 18, GOLD: 1, CASH: 0 },
    }));
    expect(p.alerts.some((a) => a.code === 'CRYPTO_DRAWDOWN')).toBe(true);
  });

  it('danh mục sụt 20% → PORTFOLIO_DRAWDOWN và Crash Reserve bậc 1 kích hoạt', () => {
    const p = buildActionPlan(snapshot({ portfolioDrawdownPct: 20 }));
    expect(p.alerts.some((a) => a.code === 'PORTFOLIO_DRAWDOWN')).toBe(true);
    expect(p.crash!.triggeredLevels.map((t) => t.level)).toEqual([1]);
  });

  it('trạng thái hoàn hảo → không có alert nào', () => {
    const p = buildActionPlan(snapshot({
      classValues: { STOCKS: 500_000_000, CRYPTO: 200_000_000,
                     GOLD: 150_000_000, CASH: 150_000_000 },
      cashReserveVnd: 150_000_000,
      drawdowns: { STOCKS: 0, CRYPTO: 0, GOLD: 0, CASH: 0 },
      portfolioDrawdownPct: 0,
    }));
    expect(p.alerts).toEqual([]);
  });

  it('mọi message alert là tiếng Việt, không rỗng', () => {
    const p = buildActionPlan(snapshot({ contributionRecordedThisPeriod: false }));
    for (const a of p.alerts) expect(a.message.trim().length).toBeGreaterThan(0);
  });
});

describe('buildActionPlan — không gọi Date.now()', () => {
  it('asOf trong kết quả đúng bằng asOf truyền vào', () => {
    const p = buildActionPlan(snapshot({ asOf: '2026-12-01' }));
    expect(p.asOf).toBe('2026-12-01');
  });

  it('cùng snapshot chạy hai lần ra kết quả giống hệt', () => {
    const s = snapshot();
    expect(buildActionPlan(s)).toEqual(buildActionPlan(s));
  });
});
```

- [ ] **Step 4: Chạy test để chắc chắn fail**

Run: `npx vitest run src/domain/actionPlan.test.ts`
Kỳ vọng: FAIL với `Failed to resolve import "./actionPlan"`.

- [ ] **Step 5: Viết `src/domain/actionPlan.ts`**

```ts
// §20 — bộ điều phối. Gộp 7 module kia theo THỨ TỰ ƯU TIÊN của §18:
//   1. tiền mới hàng tháng  2. cổ tức  3. Crash Reserve (chỉ khi crash)
//   4. bán tài sản thừa (chỉ khi buộc phải)
// Kèm alerts §19. Hàm thuần — cùng snapshot luôn ra cùng kết quả.

import { ASSET_CLASSES } from './types';
import { computeWeights, totalVnd } from './weights';
import { classifyAll } from './bands';
import { allocate } from './allocate';
import { pickCandidates } from './tickerCandidates';
import { planSellRebalance } from './rebalanceSell';
import { evaluateCrashReserve } from './crashReserve';
import type { ActionPlan, Alert, AssetClass, PortfolioSnapshot } from './types';

/** Dồn tiền trong túi DCA về đúng nhóm tài sản nó đã được đặt tên cho. Tổng không đổi. */
export function toEarmarkedValues(
  classValues: Record<AssetClass, number>,
  earmarkedPots: Record<AssetClass, number>,
): Record<AssetClass, number> {
  const tongDaDatTen =
    earmarkedPots.STOCKS + earmarkedPots.CRYPTO + earmarkedPots.GOLD;
  return {
    STOCKS: classValues.STOCKS + earmarkedPots.STOCKS,
    CRYPTO: classValues.CRYPTO + earmarkedPots.CRYPTO,
    GOLD: classValues.GOLD + earmarkedPots.GOLD,
    CASH: classValues.CASH - tongDaDatTen,
  };
}

const TEN_VI: Record<AssetClass, string> = {
  STOCKS: 'Cổ phiếu', CRYPTO: 'Tiền mã hoá', GOLD: 'Vàng', CASH: 'Tiền mặt',
};

const MA_DRAWDOWN: Record<AssetClass, Alert['code'] | null> = {
  STOCKS: 'STOCK_DRAWDOWN', CRYPTO: 'CRYPTO_DRAWDOWN', GOLD: 'GOLD_DRAWDOWN', CASH: null,
};

function ke(n: number): string {
  return Math.round(n).toLocaleString('vi-VN');
}

export function buildActionPlan(s: PortfolioSnapshot): ActionPlan {
  const earmarked = toEarmarkedValues(s.classValues, s.earmarkedPots);
  const weights = computeWeights(earmarked, s.targets);
  const total = totalVnd(s.classValues);

  const khung: ActionPlan = {
    asOf: s.asOf,
    status: 'READY',
    blockedReason: null,
    totalVnd: total,
    weights,
    statuses: classifyAll(weights, s.targets, s.config),
    sources: {
      monthlyContributionVnd: s.monthlyContributionVnd,
      incomeReceivedVnd: s.incomeReceivedVnd,
      poolVnd: s.monthlyContributionVnd + s.incomeReceivedVnd,
    },
    buys: [],
    unallocatedVnd: 0,
    doNotBuy: [],
    tickerCandidates: { affordable: [], shortfalls: [] },
    sellPlan: null,
    crash: null,
    alerts: [],
  };

  // ---- Cổng chặn: kế hoạch tính trên dữ liệu thiếu còn tệ hơn không có kế hoạch ----
  if (s.missingPriceSymbols.length > 0) {
    return {
      ...khung,
      status: 'MISSING_PRICES',
      blockedReason:
        `${s.missingPriceSymbols.length} tài sản chưa có giá: ` +
        `${s.missingPriceSymbols.join(', ')}. Nhập giá rồi tạo lại kế hoạch.`,
    };
  }
  if (total === 0) {
    return {
      ...khung,
      status: 'EMPTY_PORTFOLIO',
      blockedReason:
        'Danh mục còn rỗng. Hãy ghi các giao dịch đã có, hoặc nhập vị thế ban đầu.',
    };
  }

  // ---- §18 bước 3: Crash Reserve ----
  const crash = evaluateCrashReserve({
    portfolioDrawdownPct: s.portfolioDrawdownPct,
    currentEpisodeStart: s.currentEpisodeStart,
    cashReserveVnd: s.cashReserveVnd,
    levels: s.crashLevels,
    history: s.crashHistory,
  });

  // ---- §18 bước 1+2: Z và cổ tức, MỘT lần phân bổ ----
  // Cộng Z vào Cash TRƯỚC rồi gọi với addsToTotal=false: bên trong allocate,
  // total đã là newTotal và preValues.CASH đã gồm Z — không cộng nhầm hai lần.
  const valuesWithZ = { ...earmarked, CASH: earmarked.CASH + s.monthlyContributionVnd };
  const poolVnd = s.monthlyContributionVnd + s.incomeReceivedVnd;
  const { allocations, unallocatedVnd } = allocate({
    classValues: valuesWithZ, targets: s.targets, poolVnd,
    addsToTotal: false, config: s.config,
  });

  const duocMua = new Set(allocations.map((a) => a.assetClass));
  const doNotBuy = ASSET_CLASSES
    .filter((c) => !duocMua.has(c))
    .map((c) => {
      const w = weights.find((x) => x.assetClass === c) as (typeof weights)[number];
      return {
        assetClass: c,
        reason: w.deviationPp > 0
          ? `${TEN_VI[c]} đang vượt mục tiêu ${w.deviationPp.toFixed(1)} điểm %.`
          : `${TEN_VI[c]} không nằm trong nhóm được ưu tiên tháng này.`,
      };
    });

  // ---- §18 bước 4: chỉ bán khi thực sự buộc phải ----
  const coClassPhaiBan = ASSET_CLASSES.some(
    (c) => khung.statuses[c] === 'REBALANCE_REQUIRED',
  );
  const sellPlan = coClassPhaiBan
    ? planSellRebalance({
        weights, statuses: khung.statuses, classValues: earmarked,
        targets: s.targets, config: s.config,
      })
    : null;

  // ---- Gợi ý mã: ngân sách = phân bổ tháng này + tiền còn trong túi DCA Stocks ----
  // Chính là cơ chế dồn tiền (carryover), không cần code riêng.
  const phanBoStocks = allocations.find((a) => a.assetClass === 'STOCKS')?.amountVnd ?? 0;
  const tickerCandidates = pickCandidates(
    s.watchlist,
    phanBoStocks + s.earmarkedPots.STOCKS,
    s.monthlyContributionVnd,
  );

  // ---- §19 alerts ----
  const alerts: Alert[] = [];
  const nguongDrawdown = s.crashLevels.length > 0
    ? Math.min(...s.crashLevels.map((l) => l.drawdownPct))
    : Number.POSITIVE_INFINITY;

  for (const w of weights) {
    const st = khung.statuses[w.assetClass];
    const dau = w.deviationPp > 0 ? 'vượt' : 'thiếu';
    const moTa =
      `${TEN_VI[w.assetClass]} ${w.weightPct.toFixed(1)}% / mục tiêu ` +
      `${w.targetPct}% — ${dau} ${Math.abs(w.deviationPp).toFixed(1)} điểm %`;

    if (st === 'WATCH') {
      alerts.push({ code: 'BAND_WATCH', severity: 'INFO',
        message: `${moTa}. Vẫn trong band, chưa cần bán.` });
    } else if (st === 'OUT_OF_BAND') {
      alerts.push({ code: 'OUT_OF_BAND', severity: 'WARN',
        message: `${moTa}. Đã ra ngoài band — ưu tiên dồn tiền mới vào.` });
    } else if (st === 'REBALANCE_REQUIRED') {
      alerts.push({ code: 'REBALANCE_REQUIRED', severity: 'ACTION',
        message: `${moTa}. Ngoài band và lệch lớn — cần cân lại danh mục.` });
    }
  }

  const cashWeight = weights.find((w) => w.assetClass === 'CASH') as (typeof weights)[number];
  if (cashWeight.weightPct < s.targets.CASH.minPct) {
    alerts.push({ code: 'CASH_BELOW_MIN', severity: 'ACTION',
      message:
        `Tiền mặt ${cashWeight.weightPct.toFixed(1)}% đã xuống dưới mức tối thiểu ` +
        `${s.targets.CASH.minPct}% — Crash Reserve đang bị bòn rút.` });
  }

  for (const c of ASSET_CLASSES) {
    const ma = MA_DRAWDOWN[c];
    if (ma !== null && s.drawdowns[c] >= nguongDrawdown) {
      alerts.push({ code: ma, severity: 'ACTION',
        message:
          `${TEN_VI[c]} đã sụt ${s.drawdowns[c].toFixed(1)}% từ đỉnh — ` +
          `vượt ngưỡng ${nguongDrawdown}%.` });
    }
  }

  if (s.portfolioDrawdownPct >= nguongDrawdown) {
    alerts.push({ code: 'PORTFOLIO_DRAWDOWN', severity: 'ACTION',
      message:
        `Toàn danh mục sụt ${s.portfolioDrawdownPct.toFixed(1)}% từ đỉnh. ` +
        `Crash Reserve khả dụng ${ke(crash.reserveAtEpisodeStartVnd)} đ.` });
  }

  if (!s.contributionRecordedThisPeriod) {
    alerts.push({ code: 'CONTRIBUTION_MISSING', severity: 'ACTION',
      message:
        `Kỳ này chưa ghi nhận khoản tiền vào ${ke(s.monthlyContributionVnd)} đ.` });
  }

  return {
    ...khung,
    buys: allocations,
    unallocatedVnd,
    doNotBuy,
    tickerCandidates,
    sellPlan,
    crash,
    alerts,
  };
}
```

- [ ] **Step 6: Chạy test để xác nhận pass**

Run: `npx vitest run src/domain/actionPlan.test.ts`
Kỳ vọng: PASS toàn bộ (22 test).

Nếu ca *"trạng thái hoàn hảo → không có alert nào"* fail: in `p.alerts` ra xem mã nào lọt vào. Với bộ số 500/200/150/150 thì mọi lệch bằng 0 nên không có alert band; nếu vẫn có `CASH_BELOW_MIN` thì `toEarmarkedValues` đang trừ sai — kiểm lại `earmarkedPots` toàn 0.

- [ ] **Step 7: Kiểm typecheck và toàn bộ test**

Run: `npm run build && npm test`
Kỳ vọng: cả hai thành công.

- [ ] **Step 8: Commit**

```bash
git add src/domain/actionPlan.ts src/domain/actionPlan.test.ts src/domain/types.ts
git commit -m "feat(portfolio): actionPlan.ts — bộ điều phối §18 §19 §20

Gộp Z và cổ tức vào MỘT lần phân bổ mà không đếm trùng: cộng Z vào Cash trước
rồi gọi allocate với addsToTotal=false. Bên trong allocate, total đã là newTotal
và preValues.CASH đã gồm Z.

Ngân sách mua cổ phiếu = phân bổ tháng này + tiền còn trong túi VND-DCA-STOCKS.
Đây chính là cơ chế dồn tiền, không cần code riêng.

Cổng chặn: thiếu giá tài sản đang giữ thì TỪ CHỐI tạo kế hoạch và nêu rõ mã nào.
Kế hoạch tính trên dữ liệu thiếu còn tệ hơn không có kế hoạch.

Thêm mã alert BAND_WATCH: §19 không có loại nào cho trạng thái trong-band-nhưng
-lệch-đáng-kể, trong khi §21 lại hiện đúng loại đó."
```

---

### Task 13: `invariants.test.ts` — bất biến trên 1.000 snapshot sinh ngẫu nhiên

**Files:**
- Create: `src/domain/invariants.test.ts`

**Interfaces:**
- Consumes: `buildActionPlan` (Task 12), `allocate` (Task 7), `DEFAULT_CRASH_LEVELS` (Task 11), `DEFAULT_CONFIG` (Task 4)
- Produces: không có export — đây là file test

**Không thêm dependency.** Dùng bộ sinh số giả ngẫu nhiên LCG **có seed** viết ngay trong file test — nhờ đó khi test đỏ thì lần chạy sau **lỗi lặp lại y nguyên**, khác với `Math.random()`. Với app tiền thì tái lập được quan trọng hơn là ngẫu nhiên thật.

Bất biến quan trọng nhất: **`Σ phân bổ + chưa phân bổ === pool`**. Sai làm tròn ở đây là mất tiền thật hoặc thừa tiền ảo.

- [ ] **Step 1: Viết file test**

Tạo `src/domain/invariants.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildActionPlan } from './actionPlan';
import { allocate } from './allocate';
import { DEFAULT_CRASH_LEVELS } from './crashReserve';
import { ASSET_CLASSES, DEFAULT_CONFIG } from './types';
import type { AllocationFormula, AssetClass, PortfolioSnapshot, TargetBand } from './types';

/**
 * LCG có seed — cùng seed luôn cho cùng dãy số. Khi test đỏ, lỗi lặp lại y
 * nguyên ở lần chạy sau (Math.random() thì không). Không thêm dependency nào.
 */
function taoRandom(seed: number) {
  let s = seed >>> 0;
  return {
    /** [0, 1) */
    next(): number {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    },
    /** Số nguyên trong [min, max] */
    int(min: number, max: number): number {
      return min + Math.floor(this.next() * (max - min + 1));
    },
    pick<T>(arr: readonly T[]): T {
      return arr[Math.floor(this.next() * arr.length)];
    },
  };
}

const TARGETS: Record<AssetClass, TargetBand> = {
  STOCKS: { targetPct: 50, minPct: 40, maxPct: 55 },
  CRYPTO: { targetPct: 20, minPct: 15, maxPct: 25 },
  GOLD:   { targetPct: 15, minPct: 10, maxPct: 20 },
  CASH:   { targetPct: 15, minPct: 7,  maxPct: 20 },
};

const CONG_THUC: readonly AllocationFormula[] = ['PROPORTIONAL_GAP', 'PRIORITY_WATERFALL'];

function snapshotNgauNhien(r: ReturnType<typeof taoRandom>): PortfolioSnapshot {
  const classValues = {} as Record<AssetClass, number>;
  for (const c of ASSET_CLASSES) {
    // Có cả trường hợp = 0 để chạm biên danh mục rỗng / class rỗng.
    classValues[c] = r.int(0, 20) === 0 ? 0 : r.int(0, 1_000) * 1_000_000;
  }
  // Túi DCA không được vượt số tiền đang có trong Cash.
  const tranTui = Math.floor(classValues.CASH / 4);
  const earmarkedPots = {
    STOCKS: r.int(0, Math.max(0, tranTui)),
    CRYPTO: r.int(0, Math.max(0, tranTui)),
    GOLD:   r.int(0, Math.max(0, tranTui)),
    CASH: 0,
  };

  return {
    asOf: '2026-09-01',
    classValues,
    earmarkedPots,
    cashReserveVnd: r.int(0, 200) * 1_000_000,
    targets: TARGETS,
    monthlyContributionVnd: r.int(0, 50) * 100_000,
    incomeReceivedVnd: r.int(0, 20) * 100_000,
    drawdowns: {
      STOCKS: r.int(0, 700) / 10, CRYPTO: r.int(0, 900) / 10,
      GOLD: r.int(0, 400) / 10, CASH: 0,
    },
    portfolioDrawdownPct: r.int(0, 700) / 10,
    crashLevels: DEFAULT_CRASH_LEVELS,
    crashHistory: [],
    currentEpisodeStart: '2026-06-01',
    missingPriceSymbols: [],
    contributionRecordedThisPeriod: r.next() > 0.5,
    watchlist: [],
    config: {
      ...DEFAULT_CONFIG,
      formula: r.pick(CONG_THUC),
      roundingStepVnd: r.pick([1, 1_000, 100_000, 1_000_000] as const),
      cashEligibleForNewCapital: r.next() > 0.3,
      sellTo: r.next() > 0.5 ? 'TARGET' : 'BAND_EDGE',
    },
  };
}

describe('BẤT BIẾN của allocate trên 1.000 ca ngẫu nhiên (seed cố định)', () => {
  it('tổng phân bổ + chưa phân bổ === pool, TUYỆT ĐỐI', () => {
    const r = taoRandom(20260822);
    for (let i = 0; i < 1000; i++) {
      const s = snapshotNgauNhien(r);
      const pool = s.monthlyContributionVnd;
      const res = allocate({
        classValues: s.classValues, targets: TARGETS, poolVnd: pool,
        addsToTotal: true, config: s.config,
      });
      const tong = res.allocations.reduce((acc, a) => acc + a.amountVnd, 0);
      // Không dùng toBeCloseTo: tiền phải khớp TUYỆT ĐỐI, không "gần đúng".
      expect(tong + res.unallocatedVnd).toBe(pool);
    }
  });

  it('không bao giờ phân bổ số âm hoặc NaN', () => {
    const r = taoRandom(7777);
    for (let i = 0; i < 1000; i++) {
      const s = snapshotNgauNhien(r);
      const res = allocate({
        classValues: s.classValues, targets: TARGETS,
        poolVnd: s.monthlyContributionVnd, addsToTotal: true, config: s.config,
      });
      for (const a of res.allocations) {
        expect(Number.isFinite(a.amountVnd)).toBe(true);
        expect(a.amountVnd).toBeGreaterThan(0);
      }
      expect(res.unallocatedVnd).toBeGreaterThanOrEqual(0);
    }
  });

  it('mọi khoản phân bổ là bội số của bước làm tròn, TRỪ phần dư dồn cuối', () => {
    const r = taoRandom(31415);
    for (let i = 0; i < 1000; i++) {
      const s = snapshotNgauNhien(r);
      const step = s.config.roundingStepVnd;
      const res = allocate({
        classValues: s.classValues, targets: TARGETS,
        poolVnd: s.monthlyContributionVnd, addsToTotal: true, config: s.config,
      });
      // Nhiều nhất MỘT khoản được phép lệch bội số (khoản nhận phần dư).
      const soKhoanLech = res.allocations.filter((a) => a.amountVnd % step !== 0).length;
      expect(soKhoanLech).toBeLessThanOrEqual(1);
    }
  });
});

describe('BẤT BIẾN của buildActionPlan trên 1.000 ca ngẫu nhiên', () => {
  it('không bao giờ ném lỗi', () => {
    const r = taoRandom(1234567);
    for (let i = 0; i < 1000; i++) {
      const s = snapshotNgauNhien(r);
      expect(() => buildActionPlan(s)).not.toThrow();
    }
  });

  it('không bao giờ có NaN trong tỷ trọng hay số tiền', () => {
    const r = taoRandom(999);
    for (let i = 0; i < 1000; i++) {
      const p = buildActionPlan(snapshotNgauNhien(r));
      for (const w of p.weights) {
        expect(Number.isFinite(w.weightPct)).toBe(true);
        expect(Number.isFinite(w.deviationPp)).toBe(true);
        expect(Number.isFinite(w.differenceVnd)).toBe(true);
      }
      for (const b of p.buys) expect(Number.isFinite(b.amountVnd)).toBe(true);
      expect(Number.isFinite(p.unallocatedVnd)).toBe(true);
    }
  });

  it('tổng mua + chưa phân bổ === pool, mỗi khi kế hoạch tạo được', () => {
    const r = taoRandom(24680);
    for (let i = 0; i < 1000; i++) {
      const s = snapshotNgauNhien(r);
      const p = buildActionPlan(s);
      if (p.status !== 'READY') continue;
      const tong = p.buys.reduce((acc, b) => acc + b.amountVnd, 0);
      expect(tong + p.unallocatedVnd).toBe(p.sources.poolVnd);
    }
  });

  it('tổng tỷ trọng === 100% mỗi khi danh mục khác rỗng', () => {
    const r = taoRandom(13579);
    for (let i = 0; i < 1000; i++) {
      const p = buildActionPlan(snapshotNgauNhien(r));
      if (p.totalVnd === 0) continue;
      const tong = p.weights.reduce((acc, w) => acc + w.weightPct, 0);
      expect(tong).toBeCloseTo(100, 6);
    }
  });

  it('KHÔNG BÁN BỪA: không class nào REBALANCE_REQUIRED ⇒ sellPlan === null', () => {
    const r = taoRandom(86420);
    for (let i = 0; i < 1000; i++) {
      const p = buildActionPlan(snapshotNgauNhien(r));
      const coPhaiBan = ASSET_CLASSES.some((c) => p.statuses[c] === 'REBALANCE_REQUIRED');
      if (!coPhaiBan) expect(p.sellPlan).toBeNull();
    }
  });

  it('mọi lệnh bán đều là class ĐANG THỪA và ở trạng thái REBALANCE_REQUIRED', () => {
    const r = taoRandom(112233);
    for (let i = 0; i < 1000; i++) {
      const p = buildActionPlan(snapshotNgauNhien(r));
      if (!p.sellPlan) continue;
      for (const sell of p.sellPlan.sells) {
        expect(p.statuses[sell.assetClass]).toBe('REBALANCE_REQUIRED');
        const w = p.weights.find((x) => x.assetClass === sell.assetClass);
        expect(w!.deviationPp).toBeGreaterThan(0);
        expect(sell.sellVnd).toBeGreaterThan(0);
      }
    }
  });

  it('BẤT BIẾN của lệnh bán: tổng tiền vào + chưa phân bổ === tổng tiền bán', () => {
    const r = taoRandom(445566);
    for (let i = 0; i < 1000; i++) {
      const p = buildActionPlan(snapshotNgauNhien(r));
      if (!p.sellPlan) continue;
      const ban = p.sellPlan.sells.reduce((acc, x) => acc + x.sellVnd, 0);
      const vao = p.sellPlan.destinations.reduce((acc, x) => acc + x.amountVnd, 0);
      expect(vao + p.sellPlan.unallocatedVnd).toBe(ban);
    }
  });

  it('Crash Reserve không bao giờ đề xuất giải ngân quá số tiền đang có', () => {
    const r = taoRandom(654321);
    for (let i = 0; i < 1000; i++) {
      const s = snapshotNgauNhien(r);
      const p = buildActionPlan(s);
      if (!p.crash) continue;
      expect(p.crash.totalDeployVnd).toBeLessThanOrEqual(s.cashReserveVnd);
      expect(p.crash.totalDeployVnd).toBeGreaterThanOrEqual(0);
    }
  });
});
```

- [ ] **Step 2: Chạy file test**

Run: `npx vitest run src/domain/invariants.test.ts`
Kỳ vọng: PASS, 10 test.

**Nếu có test đỏ, đó KHÔNG phải test sai — đó là bug engine thật.** Cách xử lý:
1. Thêm `console.log(JSON.stringify(s))` ngay trước `expect` thất bại rồi chạy lại — vì seed cố định nên ra đúng snapshot gây lỗi.
2. Chép snapshot đó thành một test tay trong file test của module liên quan (`allocate.test.ts` / `rebalanceSell.test.ts`).
3. Sửa engine cho ca đó xanh.
4. Chạy lại `invariants.test.ts`.

Nghi phạm hay gặp nhất: `roundingStepVnd = 1` khiến `roundDownTo` thành phép đồng nhất và phần dư bằng 0 — không phải bug. Nghi phạm thật: `PRIORITY_WATERFALL` khi pool lớn hơn tổng khoảng thiếu.

- [ ] **Step 3: Đo thời gian chạy (test này phải nhanh, không thì sẽ bị bỏ)**

Run: `npx vitest run src/domain/ --reporter=verbose`
Kỳ vọng: toàn bộ thư mục `src/domain/` chạy **dưới 2 giây**. Nếu chậm hơn, giảm 1.000 xuống 300 vòng — thà chạy ít mà chạy mỗi lần, hơn là nhiều mà bị tắt đi.

- [ ] **Step 4: Commit**

```bash
git add src/domain/invariants.test.ts
git commit -m "test(portfolio): bất biến trên 1.000 snapshot sinh ngẫu nhiên có seed

Dùng LCG có seed viết trong file test, KHÔNG thêm dependency và KHÔNG dùng
Math.random(): khi test đỏ thì lỗi lặp lại y nguyên ở lần chạy sau — với app
tiền, tái lập được quan trọng hơn ngẫu nhiên thật.

Bất biến kiểm bằng toBe chứ không toBeCloseTo: tiền phải khớp tuyệt đối.
Gồm: tổng phân bổ === pool, không phân bổ âm/NaN, tổng tỷ trọng 100%,
không bán bừa khi chưa REBALANCE_REQUIRED, không giải ngân quá reserve."
```

---

### Task 14: `portfolioRepo.ts` + `buildSnapshot.ts` — nối DB với domain

**Files:**
- Create: `src/types/portfolio.ts`
- Create: `src/data/portfolioRepo.ts`
- Create: `src/data/buildSnapshot.ts`
- Test: `src/data/buildSnapshot.test.ts`

**Interfaces:**
- Consumes: `supabase` (`src/lib/supabaseClient.ts`) · toàn bộ type của Task 4 · `DEFAULT_CONFIG`
- Produces:
  - `src/types/portfolio.ts`: `InstrumentRow`, `AllocationRow`, `TargetRow`, `SettingsRow`, `CrashLevelRow`, `CrashEventRow`, `SnapshotSourceData`
  - `src/data/portfolioRepo.ts`: `fetchAllocation(userId)`, `fetchTargets(userId)`, `fetchSettings(userId)`, `fetchCrashLevels(userId)`, `fetchCrashEvents(userId)`, `fetchWatchlist(userId)`, `fetchSnapshotSources(userId)`
  - `src/data/buildSnapshot.ts`: `mapToSnapshot(input: SnapshotSourceData): PortfolioSnapshot` (**hàm thuần, có test**) · `loadSnapshot(userId, asOf): Promise<PortfolioSnapshot>`

**Nguyên tắc phân chia:** toàn bộ phần *biến đổi dữ liệu* nằm trong `mapToSnapshot` — hàm thuần, test được không cần DB. `portfolioRepo` chỉ làm I/O: `select`, kiểm lỗi, trả row. Không có một dòng logic nghiệp vụ nào trong repo.

- [ ] **Step 1: Viết `src/types/portfolio.ts`**

```ts
// Kiểu của row trả về từ schema `portfolio`. Đây là hình dạng DB,
// KHÁC với kiểu của tầng domain — mapToSnapshot làm việc chuyển đổi.
import type {
  AssetClass, CrashLevel, EngineConfig, TargetBand, WatchlistItem,
} from '../domain/types';

export interface AllocationRow {
  instrument_id: string;
  asset_class: AssetClass;
  symbol: string;
  earmarked_for: AssetClass | null;
  quantity: number | null;
  cost_basis_vnd: number | null;
  cash_balance_vnd: number | null;
  price_vnd: number | null;
  price_as_of: string | null;
  market_value_vnd: number | null;
}

export interface TargetRow {
  asset_class: AssetClass;
  target_pct: number;
  min_pct: number;
  max_pct: number;
}

export interface SettingsRow {
  monthly_contribution_vnd: number;
  watch_deviation_pp: number;
  strong_rebalance_pp: number;
  min_sell_amount_vnd: number;
  rounding_step_vnd: number;
  allocation_formula: string;
  cash_eligible_for_new_capital: boolean;
  sell_to: string;
}

export interface CrashLevelRow {
  level: number;
  drawdown_pct: number;
  deploy_pct_of_reserve: number;
}

export interface CrashEventRow {
  level: number;
  episode_start: string;
  reserve_at_episode_start_vnd: number;
}

/** Toàn bộ dữ liệu thô cần để dựng một PortfolioSnapshot. */
export interface SnapshotSourceData {
  asOf: string;
  allocation: AllocationRow[];
  targets: TargetRow[];
  settings: SettingsRow | null;
  crashLevels: CrashLevelRow[];
  crashEvents: CrashEventRow[];
  watchlist: WatchlistItem[];
  incomeReceivedVnd: number;
  portfolioDrawdownPct: number;
  drawdowns: Record<AssetClass, number>;
  currentEpisodeStart: string;
  contributionRecordedThisPeriod: boolean;
}

export type { AssetClass, CrashLevel, EngineConfig, TargetBand, WatchlistItem };
```

- [ ] **Step 2: Viết test cho `mapToSnapshot` (hàm thuần, không cần DB)**

Tạo `src/data/buildSnapshot.test.ts`:

```ts
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

function nguon(over: Partial<SnapshotSourceData> = {}): SnapshotSourceData {
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
  const s = mapToSnapshot(nguon({
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

describe('mapToSnapshot — phát hiện tài sản thiếu giá', () => {
  it('mã ĐANG GIỮ mà market_value null → vào missingPriceSymbols', () => {
    const s = mapToSnapshot(nguon({
      allocation: [
        row({ symbol: 'SJC-1L', asset_class: 'GOLD', quantity: 2,
              price_vnd: null, market_value_vnd: null }),
      ],
    }));
    expect(s.missingPriceSymbols).toEqual(['SJC-1L']);
  });

  it('mã KHÔNG giữ (quantity 0 hoặc null) thiếu giá thì BỎ QUA, không chặn kế hoạch', () => {
    // 56 mã watchlist đều thuộc loại này — không được để chúng chặn kế hoạch.
    const s = mapToSnapshot(nguon({
      allocation: [
        row({ symbol: 'ACB', quantity: 0, market_value_vnd: null }),
        row({ symbol: 'HPG', quantity: null, market_value_vnd: null }),
      ],
    }));
    expect(s.missingPriceSymbols).toEqual([]);
  });

  it('túi CASH không bao giờ bị coi là thiếu giá', () => {
    const s = mapToSnapshot(nguon({
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
    const s = mapToSnapshot(nguon());
    expect(s.monthlyContributionVnd).toBe(3_000_000);
    expect(s.config.formula).toBe('PROPORTIONAL_GAP');
    expect(s.config.roundingStepVnd).toBe(100_000);
    expect(s.config.sellTo).toBe('TARGET');
  });

  it('settings = null → dùng DEFAULT_CONFIG, KHÔNG ném lỗi', () => {
    const s = mapToSnapshot(nguon({ settings: null }));
    expect(s.monthlyContributionVnd).toBe(3_000_000);
    expect(s.config.formula).toBe('PROPORTIONAL_GAP');
  });

  it('allocation_formula lạ trong DB → tụt về PROPORTIONAL_GAP, không crash', () => {
    const s = mapToSnapshot(nguon({
      settings: { ...nguon().settings!, allocation_formula: 'CONG_THUC_LA' },
    }));
    expect(s.config.formula).toBe('PROPORTIONAL_GAP');
  });

  it('thiếu target của một nhóm → NÉM lỗi rõ ràng, không đoán bừa', () => {
    expect(() => mapToSnapshot(nguon({
      targets: [{ asset_class: 'STOCKS', target_pct: 50, min_pct: 40, max_pct: 55 }],
    }))).toThrow(/CRYPTO/);
  });
});
```

- [ ] **Step 3: Chạy test để chắc chắn fail**

Run: `npx vitest run src/data/buildSnapshot.test.ts`
Kỳ vọng: FAIL với `Failed to resolve import "./buildSnapshot"`.

- [ ] **Step 4: Viết `src/data/buildSnapshot.ts`**

```ts
// Nối DB với tầng domain. mapToSnapshot là HÀM THUẦN — toàn bộ phần biến đổi
// dữ liệu nằm ở đây để test được không cần DB. loadSnapshot chỉ ghép I/O.

import { ASSET_CLASSES, DEFAULT_CONFIG } from '../domain/types';
import type {
  AllocationFormula, AssetClass, EngineConfig, PortfolioSnapshot, TargetBand,
} from '../domain/types';
import type { SettingsRow, SnapshotSourceData } from '../types/portfolio';
import * as repo from './portfolioRepo';

const CONG_THUC_HOP_LE: AllocationFormula[] = ['PROPORTIONAL_GAP', 'PRIORITY_WATERFALL'];

/** Z mặc định khi chưa có dòng settings — khớp giá trị default của cột DB. */
const Z_MAC_DINH_VND = 3_000_000;

function docConfig(row: SettingsRow | null): EngineConfig {
  if (row === null) return DEFAULT_CONFIG;
  const ct = row.allocation_formula as AllocationFormula;
  return {
    // Giá trị lạ trong DB thì tụt về mặc định thay vì crash cả app.
    formula: CONG_THUC_HOP_LE.includes(ct) ? ct : 'PROPORTIONAL_GAP',
    watchDeviationPp: row.watch_deviation_pp,
    strongRebalancePp: row.strong_rebalance_pp,
    minSellAmountVnd: row.min_sell_amount_vnd,
    roundingStepVnd: row.rounding_step_vnd,
    cashEligibleForNewCapital: row.cash_eligible_for_new_capital,
    sellTo: row.sell_to === 'BAND_EDGE' ? 'BAND_EDGE' : 'TARGET',
    classPriority: DEFAULT_CONFIG.classPriority,
  };
}

export function mapToSnapshot(input: SnapshotSourceData): PortfolioSnapshot {
  const classValues = { STOCKS: 0, CRYPTO: 0, GOLD: 0, CASH: 0 } as Record<AssetClass, number>;
  const earmarkedPots = { STOCKS: 0, CRYPTO: 0, GOLD: 0, CASH: 0 } as Record<AssetClass, number>;
  const missingPriceSymbols: string[] = [];
  let cashReserveVnd = 0;

  for (const r of input.allocation) {
    if (r.asset_class === 'CASH') {
      const soDu = r.cash_balance_vnd ?? 0;
      classValues.CASH += soDu;
      if (r.earmarked_for !== null) earmarkedPots[r.earmarked_for] += soDu;
      else cashReserveVnd += soDu;
      continue;
    }

    const dangGiu = (r.quantity ?? 0) > 0;
    if (!dangGiu) continue;                       // mã watchlist chưa mua: bỏ qua

    if (r.market_value_vnd === null) {
      // Đang giữ mà không biết giá ⇒ phải chặn kế hoạch, không được coi là 0đ.
      missingPriceSymbols.push(r.symbol);
      continue;
    }
    classValues[r.asset_class] += r.market_value_vnd;
  }

  const targets = {} as Record<AssetClass, TargetBand>;
  for (const c of ASSET_CLASSES) {
    const t = input.targets.find((x) => x.asset_class === c);
    if (!t) {
      throw new Error(
        `Thiếu tỷ trọng mục tiêu của nhóm ${c} trong portfolio.allocation_targets. ` +
        `Chạy lại file seed 2026-08-22-portfolio-seed.sql.`,
      );
    }
    targets[c] = { targetPct: t.target_pct, minPct: t.min_pct, maxPct: t.max_pct };
  }

  const settings = input.settings;

  return {
    asOf: input.asOf,
    classValues,
    earmarkedPots,
    cashReserveVnd,
    targets,
    monthlyContributionVnd: settings?.monthly_contribution_vnd ?? Z_MAC_DINH_VND,
    incomeReceivedVnd: input.incomeReceivedVnd,
    drawdowns: input.drawdowns,
    portfolioDrawdownPct: input.portfolioDrawdownPct,
    crashLevels: input.crashLevels.map((l) => ({
      level: l.level,
      drawdownPct: l.drawdown_pct,
      deployPctOfReserve: l.deploy_pct_of_reserve,
    })),
    crashHistory: input.crashEvents.map((e) => ({
      level: e.level,
      episodeStart: e.episode_start,
      reserveAtEpisodeStartVnd: e.reserve_at_episode_start_vnd,
    })),
    currentEpisodeStart: input.currentEpisodeStart,
    missingPriceSymbols,
    contributionRecordedThisPeriod: input.contributionRecordedThisPeriod,
    watchlist: input.watchlist,
    config: docConfig(settings),
  };
}

/** Ghép I/O rồi gọi mapToSnapshot. Mọi biến đổi dữ liệu đều nằm trong hàm thuần trên. */
export async function loadSnapshot(userId: string, asOf: string): Promise<PortfolioSnapshot> {
  const nguon = await repo.fetchSnapshotSources(userId, asOf);
  return mapToSnapshot(nguon);
}
```

- [ ] **Step 5: Viết `src/data/portfolioRepo.ts`**

```ts
// CRUD thuần trên schema `portfolio`. KHÔNG có logic nghiệp vụ ở đây.
// KHÔNG nuốt lỗi: mọi lỗi Supabase đều ném lên kèm message tiếng Việt.

import { supabase } from '../lib/supabaseClient';
import type {
  AllocationRow, CrashEventRow, CrashLevelRow, SettingsRow,
  SnapshotSourceData, TargetRow, WatchlistItem,
} from '../types/portfolio';

/** Mọi truy vấn schema `portfolio` đi qua đây. */
const pf = () => supabase.schema('portfolio');

function nem(viec: string, error: { message: string } | null): void {
  if (error) {
    console.error(`Lỗi ${viec}:`, error);
    throw new Error(`Không ${viec} được: ${error.message}`);
  }
}

export async function fetchAllocation(userId: string): Promise<AllocationRow[]> {
  const { data, error } = await pf().from('v_allocation').select('*').eq('user_id', userId);
  nem('tải phân bổ danh mục', error);
  return (data ?? []) as AllocationRow[];
}

export async function fetchTargets(userId: string): Promise<TargetRow[]> {
  const { data, error } = await pf()
    .from('allocation_targets')
    .select('asset_class, target_pct, min_pct, max_pct')
    .eq('user_id', userId);
  nem('tải tỷ trọng mục tiêu', error);
  return (data ?? []) as TargetRow[];
}

export async function fetchSettings(userId: string): Promise<SettingsRow | null> {
  const { data, error } = await pf()
    .from('settings').select('*').eq('user_id', userId).maybeSingle();
  nem('tải cấu hình', error);
  return (data ?? null) as SettingsRow | null;
}

export async function fetchCrashLevels(userId: string): Promise<CrashLevelRow[]> {
  const { data, error } = await pf()
    .from('crash_reserve_levels')
    .select('level, drawdown_pct, deploy_pct_of_reserve')
    .eq('user_id', userId).order('level');
  nem('tải bậc Crash Reserve', error);
  return (data ?? []) as CrashLevelRow[];
}

export async function fetchCrashEvents(userId: string): Promise<CrashEventRow[]> {
  const { data, error } = await pf()
    .from('crash_reserve_events')
    .select('level, episode_start, reserve_at_episode_start_vnd')
    .eq('user_id', userId).order('triggered_at');
  nem('tải lịch sử Crash Reserve', error);
  return (data ?? []) as CrashEventRow[];
}

/**
 * Watchlist lấy từ bảng CŨ `public.stocks` (chỉ đọc).
 * ĐƠN VỊ: bảng cũ lưu giá bằng NGHÌN ĐỒNG ⇒ ×1000 để về VND.
 * Đây là một trong hai chỗ duy nhất được phép quy đổi đơn vị.
 */
export async function fetchWatchlist(userId: string): Promise<WatchlistItem[]> {
  const { data, error } = await supabase
    .from('stocks')
    .select('ticker, company_name, group, current_price, price_threshold')
    .eq('user_id', userId);
  nem('tải watchlist cổ phiếu', error);

  type Row = {
    ticker: string; company_name: string; group: 'attack' | 'balance' | 'defense';
    current_price: number | null; price_threshold: number | null;
  };
  return ((data ?? []) as Row[]).map((r) => ({
    symbol: r.ticker,
    name: r.company_name,
    group: r.group,
    currentPriceVnd: r.current_price === null ? null : r.current_price * 1000,
    thresholdVnd: r.price_threshold === null ? null : r.price_threshold * 1000,
    lotSize: 100,
  }));
}

/**
 * Gom mọi nguồn cần cho một snapshot. Gọi song song — một lỗi thì ném luôn,
 * không trả snapshot nửa vời.
 *
 * PHẦN CHƯA LÀM Ở ĐỢT NÀY (đợt 6): drawdowns và portfolioDrawdownPct cần chuỗi
 * giá benchmark + bảng snapshots, thuộc đợt 6. Tạm trả 0 và episodeStart = asOf.
 * Hệ quả: Crash Reserve chưa bao giờ kích hoạt cho tới khi đợt 6 xong — ĐÚNG
 * và an toàn (thà không đề xuất, hơn là đề xuất dựa trên số 0 giả).
 */
export async function fetchSnapshotSources(
  userId: string, asOf: string,
): Promise<SnapshotSourceData> {
  const [allocation, targets, settings, crashLevels, crashEvents, watchlist] =
    await Promise.all([
      fetchAllocation(userId), fetchTargets(userId), fetchSettings(userId),
      fetchCrashLevels(userId), fetchCrashEvents(userId), fetchWatchlist(userId),
    ]);

  return {
    asOf, allocation, targets, settings, crashLevels, crashEvents, watchlist,
    incomeReceivedVnd: 0,
    portfolioDrawdownPct: 0,
    drawdowns: { STOCKS: 0, CRYPTO: 0, GOLD: 0, CASH: 0 },
    currentEpisodeStart: asOf,
    contributionRecordedThisPeriod: false,
  };
}
```

- [ ] **Step 6: Chạy test để xác nhận pass**

Run: `npx vitest run src/data/buildSnapshot.test.ts`
Kỳ vọng: PASS toàn bộ (12 test).

- [ ] **Step 7: Kiểm typecheck và toàn bộ test**

Run: `npm run build && npm test`
Kỳ vọng: cả hai thành công. Nếu `supabase.schema` báo lỗi type, kiểm phiên bản: `package.json` đang là `@supabase/supabase-js ^2.45.0` — `.schema()` có từ 2.x. Nếu vẫn lỗi, chạy `npm i @supabase/supabase-js@^2.45.0` để cập nhật lockfile.

- [ ] **Step 8: Commit**

```bash
git add src/types/portfolio.ts src/data/portfolioRepo.ts \
        src/data/buildSnapshot.ts src/data/buildSnapshot.test.ts
git commit -m "feat(portfolio): portfolioRepo + buildSnapshot — nối DB với domain

Toàn bộ phần biến đổi dữ liệu nằm trong mapToSnapshot (hàm thuần, 12 test,
không cần DB). portfolioRepo chỉ làm I/O, không một dòng logic nghiệp vụ.

Phân biệt quan trọng: mã watchlist chưa mua (quantity 0/null) thiếu giá thì BỎ
QUA — 56 mã đều thuộc loại này, không được để chúng chặn kế hoạch. Chỉ mã ĐANG
GIỮ mà thiếu giá mới vào missingPriceSymbols.

Quy đổi nghìn đồng → VND cho watchlist nằm đúng một chỗ trong repo.

Drawdown tạm trả 0 (cần benchmark + snapshots, thuộc đợt 6) ⇒ Crash Reserve
chưa kích hoạt cho tới khi đợt 6 xong. Thà không đề xuất, hơn là đề xuất dựa
trên số 0 giả."
```

---

### Task 15: Xác minh tên cột khớp giữa `portfolioRepo` và DB thật

**Files:** không tạo/sửa file — đây là bước kiểm chứng

**Interfaces:**
- Consumes: `src/data/portfolioRepo.ts` (Task 14), schema `portfolio` (Task 1–3)
- Produces: bằng chứng rằng mọi tên cột trong repo tồn tại thật

**Lý do task này tồn tại:** đợt 1+2 **không có UI**, nên `portfolioRepo` chưa một lần chạy thật. Một cái sai chính tả tên cột sẽ chỉ lộ ra ở đợt 4. Bước này bắt lỗi đó ngay bằng SQL, không cần viết code tạm rồi xoá.

- [ ] **Step 1: Chạy đúng những `select` mà repo sẽ chạy**

Dán vào SQL Editor. Mỗi câu phải trả về **không lỗi** (0 dòng cũng được):

```sql
-- fetchAllocation
select instrument_id, asset_class, symbol, earmarked_for, quantity,
       cost_basis_vnd, cash_balance_vnd, price_vnd, price_as_of, market_value_vnd
  from portfolio.v_allocation limit 1;

-- fetchTargets
select asset_class, target_pct, min_pct, max_pct
  from portfolio.allocation_targets limit 1;

-- fetchSettings
select monthly_contribution_vnd, watch_deviation_pp, strong_rebalance_pp,
       min_sell_amount_vnd, rounding_step_vnd, allocation_formula,
       cash_eligible_for_new_capital, sell_to
  from portfolio.settings limit 1;

-- fetchCrashLevels
select level, drawdown_pct, deploy_pct_of_reserve
  from portfolio.crash_reserve_levels order by level limit 1;

-- fetchCrashEvents
select level, episode_start, reserve_at_episode_start_vnd
  from portfolio.crash_reserve_events order by triggered_at limit 1;

-- fetchWatchlist (bảng CŨ, chỉ đọc)
select ticker, company_name, "group", current_price, price_threshold
  from public.stocks limit 1;
```

Bất kỳ lỗi `column ... does not exist` → sửa **repo** cho khớp DB (DB là chuẩn), rồi chạy lại.

⚠️ Chú ý `"group"` là từ khoá SQL nên trong SQL phải đặt trong ngoặc kép. Trong `portfolioRepo.ts` thì `.select('... group ...')` của supabase-js **không cần** ngoặc kép — PostgREST tự xử lý. Nếu chạy thật vẫn lỗi, đổi thành `.select('..., group:group, ...')`.

- [ ] **Step 2: Xác minh `v_allocation` có cột `user_id` để `.eq('user_id', ...)` chạy được**

```sql
select column_name from information_schema.columns
 where table_schema = 'portfolio' and table_name = 'v_allocation'
   and column_name = 'user_id';
```
Kỳ vọng: **1 dòng**. Nếu 0 dòng thì `v_positions` chưa `select` ra `user_id` — sửa view ở Task 2 rồi chạy lại.

- [ ] **Step 3: Chạy lần cuối toàn bộ kiểm chứng**

```bash
npm run build && npm test
```
Kỳ vọng: cả hai xanh, và số test của `src/domain/` + `src/data/` khớp bảng ở mục "Định nghĩa Hoàn Thành" bên dưới.

- [ ] **Step 4: Commit (nếu Step 1 phải sửa repo)**

```bash
git add src/data/portfolioRepo.ts
git commit -m "fix(portfolio): khớp tên cột trong repo với schema thật

Xác minh bằng cách chạy đúng những select mà repo sẽ chạy — đợt 1+2 không có
UI nên repo chưa một lần chạy thật, sai chính tả tên cột sẽ chỉ lộ ở đợt 4."
```

Nếu Step 1 không phải sửa gì thì bỏ qua step này.

---

## Định nghĩa Hoàn Thành (đợt 1+2)

| Kiểm chứng | Cách xác minh |
|---|---|
| 11 bảng + 4 enum + trigger + RLS tồn tại | truy vấn ở Task 1 Step 7 trả đúng 11 dòng; policy đủ 4/bảng, `transactions` đúng 3 |
| Migration chạy lại được | Task 1 Step 8, Task 3 Step 6 — Success cả lần hai, số dòng không đổi |
| 3 view có `security_invoker = true` | Task 2 Step 3 — đúng 3 dòng `{security_invoker=true}` |
| Bút toán kép đúng dấu | Task 2 Step 4 — `NOTICE ✓`, đẳng thức 10.080.000 cân |
| Thiếu giá ra `NULL`, không phải `0` | Task 2 Step 5 — `NOTICE ✓` |
| Seed: 4 túi tiền + 1 vàng + 56 cổ phiếu + 3 benchmark + 5 bậc crash | Task 3 Step 5 |
| Engine tái lập **mọi kết luận định tính** của §21 | Task 12 Step 6 — 22 test xanh |
| 10 bất biến qua 1.000 ca ngẫu nhiên | Task 13 Step 2 |
| `src/domain/` chạy dưới 2 giây | Task 13 Step 3 |
| Tên cột repo khớp DB | Task 15 Step 1–2 |
| Typecheck và toàn bộ test xanh | `npm run build && npm test` |
| Không phá tính năng cũ | `npm test` — test của todos/goals/stocks/crypto vẫn xanh |

**Số test dự kiến thêm vào:** `money` 10 · `weights` 8 · `bands` 13 · `allocate` 20 · `tickerCandidates` 14 · `rebalanceSell` 13 · `drawdown` 16 · `crashReserve` 17 · `actionPlan` 22 · `invariants` 10 · `buildSnapshot` 12 = **155 test**, tất cả không cần mock, không cần DB, không cần mạng.

## Độ bao phủ so với spec

| Mục spec | Trạng thái trong plan này |
|---|---|
| 1 Kiến trúc · 2 Đơn vị · 3 Database | ✅ Task 1–3 + Global Constraints |
| 4 Domain layer (8 module) | ✅ Task 4–13 |
| 9 Test | ✅ Task 4–14 |
| 12 An toàn §23 | ✅ engine chỉ trả đề xuất; không có đường nào đặt lệnh |
| 14 Ba mâu thuẫn spec | ✅ §7 → Task 6 · §4/§5/§21 → Task 7 · §25 → scope |
| 15 Sáu vấn đề ẩn | ✅ lô chẵn → Task 8 · đơn vị → Task 14 · `security_invoker` → Task 2 · reset bậc crash → Task 11 · sửa nhầm 24h → Task 1 · thiếu giá → Task 12+14 |
| 8 Nhập dữ liệu ban đầu | 🟡 **một phần** — Task 3 tạo instrument; màn `InitialPositionsWizard` thuộc đợt 3 |
| 5 Price layer | ❌ đợt 4 |
| 6 Giao diện (5 màn) | ❌ đợt 3–6 |
| 7 CSV | ❌ đợt 3 (import) và đợt 6 (export) |

## Những gì CỐ TÌNH chưa làm ở đợt này

| Bỏ lại | Vì sao | Hệ quả tạm thời |
|---|---|---|
| Toàn bộ UI | Engine phải đúng bằng test trước khi có gì để nhìn | Chưa xem được gì trên app |
| `providers/` (giá, tỷ giá) | Đợt 4 | `prices` rỗng ⇒ tài sản đang giữ vào `missingPriceSymbols` ⇒ kế hoạch bị chặn. **Đúng như thiết kế** |
| `drawdowns`, `portfolioDrawdownPct` thật | Cần benchmark + `snapshots`, thuộc đợt 6 | `fetchSnapshotSources` trả 0 ⇒ Crash Reserve **chưa bao giờ kích hoạt**. An toàn: thà không đề xuất, hơn là đề xuất trên số 0 giả |
| `incomeReceivedVnd` thật | Cần truy vấn transactions type=DIVIDEND theo kỳ, thuộc đợt 3 | Tạm 0 |
| `contributionRecordedThisPeriod` thật | Cần truy vấn DEPOSIT trong kỳ, thuộc đợt 3 | Tạm `false` ⇒ luôn có alert `CONTRIBUTION_MISSING`. Sẽ đúng khi có sổ giao dịch |
| Ghi transaction (INSERT) | Form nhập thuộc đợt 3 | Repo đợt này **chỉ đọc** |
| TWR / MWR / XIRR | Hoãn v2 theo quyết định 7 | — |

Bốn dòng "tạm 0/false" ở trên là **món nợ có ghi biên nhận**: mỗi dòng nêu rõ đợt nào trả và hệ quả trong lúc chờ. Đợt 3 và 4 phải xoá hết chúng.
