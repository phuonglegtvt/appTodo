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
