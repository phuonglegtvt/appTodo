-- Migration: Nợ & thẻ tín dụng (tab "Nợ").
--
-- Mỗi dòng là MỘT thẻ tín dụng hoặc MỘT khoản vay. App chỉ theo dõi số dư hiện
-- tại do người dùng cập nhật (không có sổ trả nợ ở bản đầu) — đủ để biết tổng
-- nợ, phải trả tháng này, sắp đến hạn, và chi phí thật của lãi + phí đáo hạn.
--
-- ĐƠN VỊ: mọi cột tiền là ĐỒNG tuyệt đối (như cash_entries). Lãi suất và phí
-- đáo hạn là % (4,5 = 4,5%). Ngày sao kê / đến hạn là NGÀY TRONG THÁNG (1–31;
-- tháng ngắn hơn thì app hiểu là ngày cuối tháng).
--
-- CÁCH DÙNG: Supabase Dashboard → SQL Editor → dán toàn bộ file → Run.
-- AN TOÀN CHẠY LẠI NHIỀU LẦN (idempotent).

create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- CARD = thẻ tín dụng, LOAN = khoản vay (tín chấp, thế chấp, tiêu dùng…)
  kind text not null check (kind in ('CARD', 'LOAN')),
  name text not null,
  -- Dư nợ hiện tại (đồng). Người dùng cập nhật khi có sao kê / sau khi trả.
  balance_vnd numeric not null default 0 check (balance_vnd >= 0),
  -- Hạn mức (chỉ thẻ). NULL = chưa nhập.
  credit_limit_vnd numeric check (credit_limit_vnd is null or credit_limit_vnd >= 0),
  -- Lãi suất %/năm. NULL = chưa nhập.
  interest_rate_pct numeric check (interest_rate_pct is null or interest_rate_pct >= 0),
  -- Số tiền định trả mỗi tháng (đồng): khoản góp của khoản vay, hoặc số định trả của thẻ.
  monthly_payment_vnd numeric check (monthly_payment_vnd is null or monthly_payment_vnd >= 0),
  statement_day smallint check (statement_day is null or statement_day between 1 and 31),
  due_day smallint check (due_day is null or due_day between 1 and 31),
  -- Thẻ có đáo hạn hàng tháng không, và phí đáo hạn bao nhiêu % trên dư nợ.
  rolls_over boolean not null default false,
  rollover_fee_pct numeric check (rollover_fee_pct is null or rollover_fee_pct >= 0),
  -- Ngày tất toán (khoản vay). NULL = không biết / thẻ.
  end_date date,
  note text not null default '',
  sort_order numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_debts_updated_at on public.debts;
create trigger trg_debts_updated_at
  before update on public.debts
  for each row execute function public.set_updated_at();

alter table public.debts enable row level security;

drop policy if exists "debts_select_own" on public.debts;
create policy "debts_select_own" on public.debts
  for select using (auth.uid() = user_id);

drop policy if exists "debts_insert_own" on public.debts;
create policy "debts_insert_own" on public.debts
  for insert with check (auth.uid() = user_id);

drop policy if exists "debts_update_own" on public.debts;
create policy "debts_update_own" on public.debts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "debts_delete_own" on public.debts;
create policy "debts_delete_own" on public.debts
  for delete using (auth.uid() = user_id);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'debts'
  ) then
    alter publication supabase_realtime add table public.debts;
  end if;
end $$;

alter table public.debts replica identity full;
