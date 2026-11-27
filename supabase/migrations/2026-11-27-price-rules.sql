-- Migration: quy tắc giá / cảnh báo mua–bán (tab Danh mục → "Cảnh báo giá").
--
-- Mỗi dòng: "khi giá <mã> ≥ / ≤ X thì <bán p% | mua y đồng | chỉ theo dõi>".
-- VD của NewPL: BTC ≥ 160.000 USD bán 50%; BTC ≤ 80.000 USD mua; E1VFVN30 ≥ 45
-- (nghìn đồng) bán 50%; FUESSVFL ≥ 42 bán 60%.
--
-- App KHÔNG tự đặt lệnh. Nó chỉ so với giá đang có trong bảng stocks / cryptos
-- (cập nhật bằng nút "Cập nhật giá") và báo quy tắc nào đã chạm ngưỡng.
--
-- ĐƠN VỊ của `price` = đơn vị giá của bảng nguồn: cổ phiếu/ETF = NGHÌN ĐỒNG
-- (như stocks.current_price), crypto = USD (như cryptos.current_price).
-- `buy_amount_vnd` = ĐỒNG tuyệt đối.
--
-- CÁCH DÙNG: Supabase Dashboard → SQL Editor → dán toàn bộ file → Run.
-- AN TOÀN CHẠY LẠI NHIỀU LẦN.

create table if not exists public.price_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  asset_kind text not null check (asset_kind in ('STOCK', 'CRYPTO')),
  -- Mã viết hoa (VD 'BTC', 'E1VFVN30'). Khoá theo mã chứ không theo id để quy
  -- tắc vẫn còn khi xoá rồi thêm lại mã vào danh sách.
  symbol text not null check (symbol = upper(symbol) and length(symbol) between 1 and 20),
  direction text not null check (direction in ('ABOVE', 'BELOW')),
  price numeric not null check (price > 0),
  action text not null check (action in ('SELL', 'BUY', 'WATCH')),
  -- Bán bao nhiêu % số đang giữ (chỉ SELL).
  sell_pct numeric check (sell_pct is null or (sell_pct > 0 and sell_pct <= 100)),
  -- Mua bao nhiêu đồng (chỉ BUY). NULL = chưa định số tiền.
  buy_amount_vnd numeric check (buy_amount_vnd is null or buy_amount_vnd > 0),
  note text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_price_rules_updated_at on public.price_rules;
create trigger trg_price_rules_updated_at
  before update on public.price_rules
  for each row execute function public.set_updated_at();

alter table public.price_rules enable row level security;

drop policy if exists "price_rules_select_own" on public.price_rules;
create policy "price_rules_select_own" on public.price_rules
  for select using (auth.uid() = user_id);

drop policy if exists "price_rules_insert_own" on public.price_rules;
create policy "price_rules_insert_own" on public.price_rules
  for insert with check (auth.uid() = user_id);

drop policy if exists "price_rules_update_own" on public.price_rules;
create policy "price_rules_update_own" on public.price_rules
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "price_rules_delete_own" on public.price_rules;
create policy "price_rules_delete_own" on public.price_rules
  for delete using (auth.uid() = user_id);
