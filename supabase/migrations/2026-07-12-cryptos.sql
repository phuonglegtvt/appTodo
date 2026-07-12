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
