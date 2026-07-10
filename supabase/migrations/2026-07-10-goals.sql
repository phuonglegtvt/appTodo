-- Migration: tạo bảng `goals` (mục tiêu theo tầng thời gian) trên database thực tế.
-- Vì sao có file này: schema.sql đã định nghĩa `goals` nhưng chưa được chạy trên
-- Supabase → app báo "Could not find the table 'public.goals'". Chạy file này
-- trong Supabase Dashboard > SQL Editor để sửa.
--
-- An toàn chạy lại nhiều lần (idempotent): dùng "if not exists" / "drop ... if exists"
-- và bọc lệnh thêm publication trong khối kiểm tra để không lỗi khi đã thêm rồi.

-- Bảng mục tiêu theo tầng thời gian (5 năm / năm / tháng / tuần).
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  horizon text not null check (horizon in ('five_year', 'year', 'month', 'week')),
  period_key text not null,
  title text not null,
  is_done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Hàm set_updated_at() đã tạo cùng bảng todos; ở đây chỉ gắn trigger cho goals.
drop trigger if exists trg_goals_updated_at on public.goals;
create trigger trg_goals_updated_at
  before update on public.goals
  for each row execute function public.set_updated_at();

-- Bật Row Level Security: mỗi người chỉ thao tác mục tiêu của mình.
alter table public.goals enable row level security;

drop policy if exists "goals_select_own" on public.goals;
create policy "goals_select_own" on public.goals
  for select using (auth.uid() = user_id);

drop policy if exists "goals_insert_own" on public.goals;
create policy "goals_insert_own" on public.goals
  for insert with check (auth.uid() = user_id);

drop policy if exists "goals_update_own" on public.goals;
create policy "goals_update_own" on public.goals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "goals_delete_own" on public.goals;
create policy "goals_delete_own" on public.goals
  for delete using (auth.uid() = user_id);

-- Bật Realtime cho goals (chỉ thêm nếu chưa có trong publication — tránh lỗi khi chạy lại).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'goals'
  ) then
    alter publication supabase_realtime add table public.goals;
  end if;
end $$;

-- REPLICA IDENTITY FULL: để sự kiện realtime DELETE/UPDATE mang đủ cột (gồm user_id)
-- cho việc lọc theo user và đồng bộ đa thiết bị (giống bảng todos).
alter table public.goals replica identity full;
