-- Thêm cột completed_dates (các ngày đã tick xong của việc lặp) vào todos.
-- CÁCH DÙNG: Supabase Dashboard → SQL Editor → dán file này → Run.
-- An toàn chạy lại: add column if not exists.

alter table public.todos
  add column if not exists completed_dates text[] not null default '{}';
