-- Cho phép giá trị lặp 'daily' (hàng ngày) ở cột todos.recurrence.
-- CÁCH DÙNG: Supabase Dashboard → SQL Editor → dán file này → Run.
-- An toàn chạy lại: drop constraint cũ (nếu có) rồi tạo lại với 'daily'.

alter table public.todos
  drop constraint if exists todos_recurrence_check;

alter table public.todos
  add constraint todos_recurrence_check
  check (recurrence in ('none', 'daily', 'weekly', 'monthly', 'yearly'));
