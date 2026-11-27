-- Migration: Thu–Chi — ngân sách tháng theo danh mục + khoản định kỳ.
--
-- ① cash_budgets: ngân sách mỗi tháng cho một danh mục chi (dùng chung mọi
--    tháng). Một dòng / người / danh mục. Khoá danh mục là text như
--    cash_entries.category (danh sách cố định trong src/lib/cashCategories.ts).
-- ② cash_recurring: khoản lặp lại hàng tháng (lương, trả vay, tiền nhà…).
--    Nút "Ghi khoản định kỳ tháng này" tạo cash_entries cho tháng đang xem.
-- ③ cash_entries.recurring_id: dòng nào sinh từ khoản định kỳ nào — để không
--    ghi trùng khi bấm lại nút trong cùng tháng.
--
-- ĐƠN VỊ: amount_vnd là ĐỒNG tuyệt đối, luôn dương (như cash_entries).
--
-- CÁCH DÙNG: Supabase Dashboard → SQL Editor → dán toàn bộ file → Run.
-- AN TOÀN CHẠY LẠI NHIỀU LẦN.

-- ① Ngân sách ---------------------------------------------------------------
create table if not exists public.cash_budgets (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category text not null,
  amount_vnd numeric not null check (amount_vnd > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, category)
);

alter table public.cash_budgets enable row level security;

drop policy if exists "cash_budgets_select_own" on public.cash_budgets;
create policy "cash_budgets_select_own" on public.cash_budgets for select using (auth.uid() = user_id);
drop policy if exists "cash_budgets_insert_own" on public.cash_budgets;
create policy "cash_budgets_insert_own" on public.cash_budgets for insert with check (auth.uid() = user_id);
drop policy if exists "cash_budgets_update_own" on public.cash_budgets;
create policy "cash_budgets_update_own" on public.cash_budgets for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "cash_budgets_delete_own" on public.cash_budgets;
create policy "cash_budgets_delete_own" on public.cash_budgets for delete using (auth.uid() = user_id);

-- ② Khoản định kỳ ----------------------------------------------------------
create table if not exists public.cash_recurring (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('THU', 'CHI')),
  category text not null,
  amount_vnd numeric not null check (amount_vnd > 0),
  -- Ngày trong tháng (1–31; tháng ngắn hơn ⇒ ngày cuối tháng).
  day_of_month smallint not null check (day_of_month between 1 and 31),
  note text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_cash_recurring_updated_at on public.cash_recurring;
create trigger trg_cash_recurring_updated_at
  before update on public.cash_recurring
  for each row execute function public.set_updated_at();

alter table public.cash_recurring enable row level security;

drop policy if exists "cash_recurring_select_own" on public.cash_recurring;
create policy "cash_recurring_select_own" on public.cash_recurring for select using (auth.uid() = user_id);
drop policy if exists "cash_recurring_insert_own" on public.cash_recurring;
create policy "cash_recurring_insert_own" on public.cash_recurring for insert with check (auth.uid() = user_id);
drop policy if exists "cash_recurring_update_own" on public.cash_recurring;
create policy "cash_recurring_update_own" on public.cash_recurring for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "cash_recurring_delete_own" on public.cash_recurring;
create policy "cash_recurring_delete_own" on public.cash_recurring for delete using (auth.uid() = user_id);

-- ③ Liên kết dòng thu–chi với khoản định kỳ ---------------------------------
-- on delete set null: xoá khoản định kỳ KHÔNG xoá các dòng đã ghi từ nó.
alter table public.cash_entries
  add column if not exists recurring_id uuid references public.cash_recurring (id) on delete set null;
