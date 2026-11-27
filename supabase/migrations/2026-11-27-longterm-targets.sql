-- Migration: tỷ trọng mục tiêu từng mã trong nhóm "Đầu tư dài hạn" (tab Cổ phiếu),
-- đồng bộ giữa các máy.
--
-- Lưu ở `public.user_prefs` (một dòng / người dùng, đã có RLS) dạng JSON:
--   { "<stock_id>": 20, "<stock_id>": 10, ... }   — số là %, tổng phải = 100.
-- Khoá theo stock_id chứ không theo mã, để sửa mã (ticker) không làm mất tỷ trọng.
-- App kiểm tra tổng = 100% trước khi lưu; DB không ràng buộc để thêm/xoá mã
-- không làm hỏng dòng.
--
-- CÁCH DÙNG: Supabase Dashboard → SQL Editor → dán toàn bộ file → Run.
-- Cần chạy SAU 2026-11-26-user-prefs.sql. AN TOÀN CHẠY LẠI NHIỀU LẦN.

alter table public.user_prefs
  add column if not exists longterm_targets jsonb;
