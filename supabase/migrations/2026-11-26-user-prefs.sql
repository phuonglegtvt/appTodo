-- Migration: cài đặt giao diện theo người dùng, đồng bộ giữa các máy.
--
-- Dòng đầu tiên dùng tới: thứ tự các bảng nhóm ở tab Cổ phiếu (nút ▲▼). Trước
-- đây lưu ở localStorage nên mỗi máy một thứ tự.
--
-- Một dòng / người dùng (primary key = user_id). Thêm cài đặt mới thì thêm cột.
--
-- CÁCH DÙNG: Supabase Dashboard → SQL Editor → dán toàn bộ file → Run.
-- AN TOÀN CHẠY LẠI NHIỀU LẦN (idempotent).

create table if not exists public.user_prefs (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  -- Mảng mã nhóm: 'longterm' | 'attack' | 'balance' | 'defense'. Không ràng buộc
  -- giá trị ở DB: app tự lọc giá trị lạ và nối nhóm còn thiếu (groupOrder.ts),
  -- nên thêm nhóm mới sau này không cần sửa bảng này.
  stock_group_order text[],
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_user_prefs_updated_at on public.user_prefs;
create trigger trg_user_prefs_updated_at
  before update on public.user_prefs
  for each row execute function public.set_updated_at();

alter table public.user_prefs enable row level security;

drop policy if exists "user_prefs_select_own" on public.user_prefs;
create policy "user_prefs_select_own" on public.user_prefs
  for select using (auth.uid() = user_id);

drop policy if exists "user_prefs_insert_own" on public.user_prefs;
create policy "user_prefs_insert_own" on public.user_prefs
  for insert with check (auth.uid() = user_id);

drop policy if exists "user_prefs_update_own" on public.user_prefs;
create policy "user_prefs_update_own" on public.user_prefs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
