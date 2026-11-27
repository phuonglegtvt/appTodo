-- Migration: lịch sử TÀI SẢN RÒNG theo tháng (tab Danh mục → "Tài sản ròng").
--
-- Một dòng / người dùng / tháng. App tự ghi (upsert) số liệu của THÁNG HIỆN TẠI
-- mỗi lần mở mục "Tài sản ròng" mà dữ liệu đủ (có giá mọi tài sản) — nên giá
-- trị lưu cho một tháng là lần mở GẦN NHẤT trong tháng đó (≈ cuối tháng).
--
-- ĐƠN VỊ: mọi cột là ĐỒNG tuyệt đối. `month` = ngày 1 của tháng.
--
-- CÁCH DÙNG: Supabase Dashboard → SQL Editor → dán toàn bộ file → Run.
-- Cần chạy SAU 2026-11-27-debts.sql. AN TOÀN CHẠY LẠI NHIỀU LẦN.

create table if not exists public.net_worth_snapshots (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  stocks_vnd numeric not null default 0,
  crypto_vnd numeric not null default 0,
  gold_vnd numeric not null default 0,
  cash_vnd numeric not null default 0,
  debt_vnd numeric not null default 0,
  -- Lưu sẵn để đọc lại đúng con số đã thấy, kể cả khi sau này đổi cách tính.
  assets_vnd numeric not null,
  net_vnd numeric not null,
  captured_at timestamptz not null default now(),
  primary key (user_id, month)
);

alter table public.net_worth_snapshots enable row level security;

drop policy if exists "nws_select_own" on public.net_worth_snapshots;
create policy "nws_select_own" on public.net_worth_snapshots
  for select using (auth.uid() = user_id);

drop policy if exists "nws_insert_own" on public.net_worth_snapshots;
create policy "nws_insert_own" on public.net_worth_snapshots
  for insert with check (auth.uid() = user_id);

drop policy if exists "nws_update_own" on public.net_worth_snapshots;
create policy "nws_update_own" on public.net_worth_snapshots
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "nws_delete_own" on public.net_worth_snapshots;
create policy "nws_delete_own" on public.net_worth_snapshots
  for delete using (auth.uid() = user_id);
