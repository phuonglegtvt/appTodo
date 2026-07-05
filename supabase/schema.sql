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
