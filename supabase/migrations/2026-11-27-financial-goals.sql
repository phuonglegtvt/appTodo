-- Migration: mục tiêu tài chính (tab Danh mục → "Mục tiêu").
--
-- VD: "Mua nhà 2030: 2 tỷ", "Quỹ học cho con 2035: 500 triệu", "Hưu trí: 10 tỷ".
-- App tính cần góp bao nhiêu mỗi tháng để kịp (có tính lãi kỳ vọng) và với số
-- đang góp thì đến hạn được bao nhiêu.
--
-- ĐƠN VỊ: tiền là ĐỒNG; lãi kỳ vọng là %/năm.
--
-- CÁCH DÙNG: Supabase Dashboard → SQL Editor → dán toàn bộ file → Run.
-- AN TOÀN CHẠY LẠI NHIỀU LẦN.

create table if not exists public.financial_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  target_amount_vnd numeric not null check (target_amount_vnd > 0),
  target_date date not null,
  -- Đã để dành được cho mục tiêu này (người dùng cập nhật).
  saved_vnd numeric not null default 0 check (saved_vnd >= 0),
  -- Đang góp mỗi tháng cho mục tiêu này.
  monthly_contribution_vnd numeric not null default 0 check (monthly_contribution_vnd >= 0),
  -- Lãi kỳ vọng %/năm của nơi để tiền (gửi tiết kiệm ~5–6, cổ phiếu ~10…).
  expected_return_pct numeric not null default 0 check (expected_return_pct >= 0 and expected_return_pct <= 100),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_financial_goals_updated_at on public.financial_goals;
create trigger trg_financial_goals_updated_at
  before update on public.financial_goals
  for each row execute function public.set_updated_at();

alter table public.financial_goals enable row level security;

drop policy if exists "fin_goals_select_own" on public.financial_goals;
create policy "fin_goals_select_own" on public.financial_goals for select using (auth.uid() = user_id);
drop policy if exists "fin_goals_insert_own" on public.financial_goals;
create policy "fin_goals_insert_own" on public.financial_goals for insert with check (auth.uid() = user_id);
drop policy if exists "fin_goals_update_own" on public.financial_goals;
create policy "fin_goals_update_own" on public.financial_goals for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "fin_goals_delete_own" on public.financial_goals;
create policy "fin_goals_delete_own" on public.financial_goals for delete using (auth.uid() = user_id);
