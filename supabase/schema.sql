-- Bảng todos + Row Level Security cho app Todo cá nhân.
-- Chạy trong Supabase Dashboard > SQL Editor.

create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  notes text,
  is_done boolean not null default false,
  due_date date,
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  tags text[] not null default '{}',
  completed_dates text[] not null default '{}',
  sort_order numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tự cập nhật updated_at khi sửa.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_todos_updated_at on public.todos;
create trigger trg_todos_updated_at
  before update on public.todos
  for each row execute function public.set_updated_at();

-- Bật Row Level Security: mỗi người chỉ thao tác việc của mình.
alter table public.todos enable row level security;

drop policy if exists "todos_select_own" on public.todos;
create policy "todos_select_own" on public.todos
  for select using (auth.uid() = user_id);

drop policy if exists "todos_insert_own" on public.todos;
create policy "todos_insert_own" on public.todos
  for insert with check (auth.uid() = user_id);

drop policy if exists "todos_update_own" on public.todos;
create policy "todos_update_own" on public.todos
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "todos_delete_own" on public.todos;
create policy "todos_delete_own" on public.todos
  for delete using (auth.uid() = user_id);

-- Bật Realtime cho bảng todos.
alter publication supabase_realtime add table public.todos;

-- REPLICA IDENTITY FULL: bắt buộc để sự kiện realtime DELETE (và UPDATE) mang đủ
-- các cột cũ, không chỉ khóa chính. Kênh client lọc theo user_id — nếu payload
-- DELETE thiếu user_id (mặc định chỉ có id), Supabase loại bỏ sự kiện và việc đã
-- xóa vẫn "kẹt" trên màn hình các thiết bị khác. Với app đồng bộ nhiều thiết bị,
-- đây là điều kiện cần để xóa lan truyền đúng.
alter table public.todos replica identity full;

-- Phase 2a: việc lặp cố định ngày (xem
-- docs/superpowers/specs/2026-07-05-recurring-tasks-design.md).
alter table public.todos
  add column if not exists recurrence text not null default 'none'
  check (recurrence in ('none', 'daily', 'weekly', 'monthly', 'yearly'));

-- Phase 2b: mục tiêu theo tầng thời gian (xem
-- docs/superpowers/specs/2026-07-07-goal-horizons-design.md).
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

drop trigger if exists trg_goals_updated_at on public.goals;
create trigger trg_goals_updated_at
  before update on public.goals
  for each row execute function public.set_updated_at();

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

alter publication supabase_realtime add table public.goals;
alter table public.goals replica identity full;

-- Phase 2c: danh mục cổ phiếu tích sản (xem
-- docs/handoff/2026-07-11-2015-stock-portfolio.md).
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

drop trigger if exists trg_stocks_updated_at on public.stocks;
create trigger trg_stocks_updated_at
  before update on public.stocks
  for each row execute function public.set_updated_at();

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

alter publication supabase_realtime add table public.stocks;
alter table public.stocks replica identity full;
