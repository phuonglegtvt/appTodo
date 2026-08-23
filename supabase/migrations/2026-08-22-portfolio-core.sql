-- Migration: schema `portfolio` — nền tảng module cân bằng danh mục đầu tư.
-- Spec: docs/superpowers/specs/2026-08-22-portfolio-rebalancing-design.md
-- Mục 3.3 (DDL 11 bảng), 3.4 (trigger toàn vẹn), 3.6 (RLS + realtime).
--
-- CÁCH DÙNG: Supabase Dashboard → SQL Editor → dán toàn bộ file → Run.
-- BƯỚC TIẾP THEO (sau khi file này chạy xong): thêm `portfolio` vào Exposed schemas
-- tại Dashboard → Integrations → Data API → tab Settings. Phải chạy migration TRƯỚC,
-- vì ô chọn chỉ liệt kê schema đã tồn tại trong DB.
-- (mục 1.2 của spec — bước con người làm tay, code không làm thay được).
-- Chi tiết: docs/portfolio-db-setup.md
--
-- ĐƠN VỊ: MỌI cột tiền trong schema này là VND (đồng) tuyệt đối. Không có
-- nghìn đồng (khác `public.stocks.price_threshold`), không có USD.
--
-- AN TOÀN CHẠY LẠI NHIỀU LẦN (idempotent), cùng khuôn với migration cũ của repo:
--   - `create schema/table if not exists`
--   - `do $$ ... exception when duplicate_object then null; end $$` cho `create type`
--     (Postgres không có `create type if not exists`)
--   - `drop trigger/policy if exists` trước mỗi `create trigger/policy`
--   - khối RLS chạy bằng vòng lặp `foreach ... loop` nên tạo lại policy cùng tên
--     không lỗi (drop rồi create lại)
--   - `grant` không có nhánh lỗi khi lặp lại (grant trùng là no-op)
--   - khối bật realtime tự kiểm `pg_publication_tables` trước khi `alter publication add`

create schema if not exists portfolio;
grant usage on schema portfolio to anon, authenticated;

-- ---------- enum ----------
-- Đúng 3 enum theo spec mục 3.3: asset_class, currency, tx_type.
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

-- ---------- trigger kiểm tra tính toàn vẹn (spec mục 3.4) ----------
-- CHECK constraint không tra được bảng khác, nên các ràng buộc liên bảng
-- đi bằng trigger. Đây là app tiền — thà chặn ở DB.
--
-- Fix round 2 (review): trigger gốc (copy verbatim từ spec mục 3.4) không
-- kiểm instrument có thuộc về CHÍNH user đang ghi hay không, và không có
-- nhánh nào cho DIVIDEND/FEE. Ba hình dạng sau đều làm vỡ đẳng thức kế toán
-- kép mà KHÔNG một lỗi nào — đóng cả ba vì cùng một họ ("trigger nhận một
-- hình dạng giao dịch làm vỡ đẳng thức kế toán"):
--   (a) instrument_id/cash_instrument_id trỏ sang instrument của NGƯỜI KHÁC
--       → chân tiền bị RLS lọc mất khỏi view của chính người ghi, đẳng thức
--       kế toán của người ghi bị lệch dương (đo thực tế: mua 1.000.000 mà
--       không túi nào bị trừ).
--   (b) DIVIDEND thiếu cash_instrument_id → v_legs không có chân nào khớp
--       (không phải chân 1, không phải chân 3) ⇒ tiền biến mất im lặng.
--   (c) FEE có instrument_id = cash_instrument_id (và túi đó là CASH) →
--       chân 2 và chân 3 của v_legs CÙNG khớp trên một túi ⇒ bị trừ hai lần.
create or replace function portfolio.tx_validate() returns trigger
language plpgsql as $fn$
declare
  ac_main portfolio.asset_class;
  ac_cash portfolio.asset_class;
begin
  -- (a) instrument chính PHẢI thuộc về chính user đang ghi giao dịch.
  select asset_class into ac_main
    from portfolio.instruments
   where id = new.instrument_id and user_id = new.user_id;
  if ac_main is null then
    raise exception 'instrument_id không tồn tại hoặc không thuộc về user này';
  end if;

  -- dòng tiền thuần: instrument_id PHẢI là túi CASH và không có chân đối ứng
  if new.type in ('DEPOSIT','WITHDRAWAL','INTEREST') then
    if ac_main <> 'CASH' then
      raise exception '% phải ghi trên một túi CASH', new.type;
    end if;
    if new.cash_instrument_id is not null then
      raise exception '% không được có cash_instrument_id', new.type;
    end if;
  end if;

  -- BUY/SELL: tài sản không được là CASH, chân tiền phải là CASH cùng user
  if new.type in ('BUY','SELL') then
    if ac_main = 'CASH' then
      raise exception 'BUY/SELL không áp dụng cho túi CASH — dùng TRANSFER';
    end if;
    if new.cash_instrument_id is null then
      raise exception 'BUY/SELL phải có cash_instrument_id';
    end if;
    select asset_class into ac_cash
      from portfolio.instruments
     where id = new.cash_instrument_id and user_id = new.user_id;
    if ac_cash is null then
      raise exception 'cash_instrument_id không tồn tại hoặc không thuộc về user này';
    end if;
    if ac_cash <> 'CASH' then
      raise exception 'cash_instrument_id phải trỏ tới một túi CASH';
    end if;
  end if;

  -- TRANSFER: chỉ giữa hai túi CASH cùng user (dùng để đặt tên tiền cho DCA)
  if new.type = 'TRANSFER' then
    if new.cash_instrument_id is null then
      raise exception 'TRANSFER phải có cash_instrument_id';
    end if;
    select asset_class into ac_cash
      from portfolio.instruments
     where id = new.cash_instrument_id and user_id = new.user_id;
    if ac_cash is null then
      raise exception 'cash_instrument_id không tồn tại hoặc không thuộc về user này';
    end if;
    if ac_main <> 'CASH' or ac_cash <> 'CASH' then
      raise exception 'TRANSFER chỉ dùng giữa hai túi CASH';
    end if;
    if new.instrument_id = new.cash_instrument_id then
      raise exception 'TRANSFER phải giữa hai túi khác nhau';
    end if;
  end if;

  -- (b)+(c) DIVIDEND/FEE: hai type này KHÔNG đối xứng trong v_legs, nên luật
  -- chặn cũng không đối xứng — đây là điều bản comment cũ (bản trước fix
  -- round 3) nói sai, nay sửa lại cho khớp đúng code bên dưới:
  --   · DIVIDEND chỉ xuất hiện ở chân 2 (qua cash_instrument_id). KHÔNG có
  --     nhánh DIVIDEND nào ở chân 3 ⇒ instrument_id là CASH hay không KHÔNG
  --     ảnh hưởng, vô hại. Cái duy nhất làm tiền biến mất là THIẾU hẳn
  --     cash_instrument_id (không khớp chân nào) ⇒ luôn bắt buộc phải có.
  --   · FEE xuất hiện ở CẢ chân 2 (qua cash_instrument_id, nếu có) LẪN chân 3
  --     (khi instrument_id tự nó là CASH, bất kể cash_instrument_id là gì).
  --     Hễ CÓ cash_instrument_id (đã vào nhánh else, is not null) MÀ
  --     instrument_id cũng là một túi CASH (dù là cùng túi hay khác túi với
  --     cash_instrument_id) thì cả hai chân cùng khớp ⇒ bị trừ hai lần.
  --     Điều kiện chặn vì vậy KHÔNG phải "hai id trùng nhau" mà là
  --     "ac_main = 'CASH'" — round 3 phát hiện case hai túi CASH KHÁC NHAU
  --     (instrument_id = túi A, cash_instrument_id = túi B) vẫn lọt qua bản
  --     kiểm cũ (chỉ so `instrument_id = cash_instrument_id`) vì hai id đó
  --     không bằng nhau nhưng cả hai chân vẫn cùng khớp trên hai túi khác
  --     nhau, làm tổng tiền bị trừ 2 lần đo được thực tế: 1.000.000 →
  --     900.000 ở CẢ HAI túi (đúng ra chỉ một túi bị trừ).
  --   ⇒ Luật FEE không được widen sang DIVIDEND: DIVIDEND với instrument_id
  --     là CASH + có cash_instrument_id là shape HỢP LỆ, không bị trừ hai
  --     lần (vì DIVIDEND không có nhánh chân 3), chặn nó sẽ từ chối oan.
  if new.type in ('DIVIDEND','FEE') then
    if new.cash_instrument_id is null then
      -- Không có chân tiền riêng ⇒ instrument_id phải TỰ NÓ là túi CASH,
      -- nếu không giao dịch không khớp chân nào trong v_legs (tiền biến mất).
      -- DIVIDEND không có cách nào tự đứng một mình theo thiết kế view hiện
      -- tại (v_legs không có nhánh DIVIDEND ở chân 3) nên luôn bắt buộc có
      -- cash_instrument_id.
      if new.type = 'DIVIDEND' or ac_main <> 'CASH' then
        raise exception '% phải có cash_instrument_id, nếu không tiền sẽ biến mất khỏi sổ', new.type;
      end if;
    else
      -- CHỈ áp cho FEE (không áp cho DIVIDEND — xem giải thích ở trên).
      if new.type = 'FEE' and ac_main = 'CASH' then
        raise exception '% có cash_instrument_id thì instrument_id không được là túi CASH (dù cùng túi hay khác túi, cả chân 2 và chân 3 sẽ cùng khớp và bị trừ hai lần)', new.type;
      end if;
      select asset_class into ac_cash
        from portfolio.instruments
       where id = new.cash_instrument_id and user_id = new.user_id;
      if ac_cash is null then
        raise exception 'cash_instrument_id không tồn tại hoặc không thuộc về user này';
      end if;
      if ac_cash <> 'CASH' then
        raise exception 'cash_instrument_id phải trỏ tới một túi CASH';
      end if;
    end if;
  end if;

  return new;
end $fn$;

drop trigger if exists trg_tx_validate on portfolio.transactions;
create trigger trg_tx_validate before insert on portfolio.transactions
  for each row execute function portfolio.tx_validate();

-- ---------- trigger updated_at ----------
-- Hàm public.set_updated_at() đã tạo cùng bảng todos; ở đây chỉ gắn trigger
-- cho 4 bảng có cột updated_at là dữ liệu người dùng sửa tay (không phải sổ
-- giao dịch bất biến).
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
-- Quá 24h thì lịch sử bất biến tuyệt đối. (spec mục 3.6, bảng "3 ngoại lệ")
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

-- ---------- Grant (schema mới KHÔNG được Supabase grant sẵn cho authenticated) ----------
-- ⚠️ Thiếu bước này thì RLS đúng nhưng client vẫn nhận
-- "permission denied for table instruments" — RLS chỉ lọc HÀNG, không thay
-- thế GRANT ở cấp bảng.
--
-- CỐ TÌNH liệt kê từng bảng, KHÔNG dùng `alter default privileges` (đã bỏ):
-- spec mục 3.3 chỉ yêu cầu `grant usage on schema` (dòng 156), không yêu cầu
-- default privileges. `alter default privileges` từng khiến MỌI bảng tạo về
-- sau trong schema `portfolio` tự động có full CRUD cho `authenticated`
-- ngay cả khi bảng đó CHƯA bật RLS — nghĩa là quên một dòng
-- "enable row level security" ở migration tương lai sẽ phơi cả bảng ra cho
-- mọi user đã đăng nhập, không một triệu chứng nào. Đổi lại: từ nay, một
-- bảng portfolio mới không có trong danh sách dưới đây sẽ báo lỗi
-- "permission denied" ồn ào — đúng hướng lỗi cần chọn (thà ồn ào còn hơn
-- im lặng lộ dữ liệu).
--
-- transactions CỐ TÌNH không có UPDATE trong danh sách grant (khớp với việc
-- không có policy UPDATE — sổ giao dịch bất biến).
do $$
declare t text;
begin
  foreach t in array array['instruments','prices','allocation_targets','settings',
                           'crash_reserve_levels','crash_reserve_events','benchmarks',
                           'benchmark_prices','snapshots','action_plans']
  loop
    execute format('grant select, insert, update, delete on portfolio.%I to authenticated', t);
  end loop;
end $$;

grant select, insert, delete on portfolio.transactions to authenticated;

-- ---------- Realtime (spec mục 3.6) ----------
-- Chỉ bật cho 3 bảng thay đổi khi dùng: transactions, prices, action_plans.
-- Cùng khuôn stocks/cryptos: kiểm tra trước khi add để chạy lại không lỗi.
do $$
declare t text;
begin
  foreach t in array array['transactions','prices','action_plans']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'portfolio'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table portfolio.%I', t);
    end if;
    execute format('alter table portfolio.%I replica identity full', t);
  end loop;
end $$;
