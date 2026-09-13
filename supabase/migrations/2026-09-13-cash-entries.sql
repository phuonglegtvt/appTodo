-- Migration: tạo bảng `public.cash_entries` — sổ thu–chi cá nhân (tab Thu–Chi).
-- Cùng khuôn với todos/stocks/cryptos/golds: RLS theo user_id, realtime đa
-- thiết bị, trigger updated_at.
--
-- CÁCH DÙNG: Supabase Dashboard → SQL Editor → dán toàn bộ file → Run.
-- KHÔNG cần thêm gì vào "Exposed schemas": bảng nằm trong `public`, khác module
-- portfolio (schema riêng, phải bật tay).
--
-- ĐƠN VỊ: `amount_vnd` là VND (đồng) TUYỆT ĐỐI. Không nghìn đồng (khác
-- `public.stocks.price_threshold`), không USD.
--
-- ⚠️ BẢNG NÀY SỬA/XOÁ ĐƯỢC — cố ý khác `portfolio.transactions` (sổ giao dịch
-- bất biến, ghi sai phải ghi dòng ADJUSTMENT bù). Thu–chi cá nhân gõ nhầm là
-- chuyện hằng ngày; bắt ghi dòng bù thì không ai dùng nổi.
--
-- KHÔNG có cột đánh dấu "vòng tiền" (đáo hạn thẻ). Việc một danh mục có phải
-- vòng tiền hay không do `src/lib/cashCategories.ts` quyết định — một nguồn sự
-- thật duy nhất, không có cửa cho DB và code bất đồng ý.
--
-- An toàn chạy lại nhiều lần (idempotent).

create table if not exists public.cash_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Ngày phát sinh khoản tiền (không phải ngày gõ vào app).
  occurred_on date not null,
  kind text not null check (kind in ('THU', 'CHI')),
  -- Khoá danh mục, ví dụ 'LUONG' | 'DAO_HAN_THE'. Cố tình là `text` tự do chứ
  -- không phải enum: đổi danh sách danh mục chỉ sửa code, không phải chạy
  -- migration đổi enum. Khoá lạ (danh mục cũ đã bỏ) vẫn đọc ra được, UI hiện
  -- thẳng khoá thay vì vỡ.
  category text not null,
  -- LUÔN DƯƠNG. Chiều tiền nằm ở `kind`, không nằm ở dấu — để một khoản chi
  -- không thể lọt vào DB dưới dạng số âm rồi lặng lẽ cộng vào tổng thu.
  amount_vnd numeric not null check (amount_vnd > 0),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Lọc theo tháng luôn kèm user_id ⇒ index ghép đúng thứ tự đó.
create index if not exists idx_cash_entries_user_date
  on public.cash_entries (user_id, occurred_on desc);

-- Hàm set_updated_at() đã tạo cùng bảng todos; ở đây chỉ gắn trigger.
drop trigger if exists trg_cash_entries_updated_at on public.cash_entries;
create trigger trg_cash_entries_updated_at
  before update on public.cash_entries
  for each row execute function public.set_updated_at();

-- Row Level Security: mỗi người chỉ thao tác khoản thu-chi của mình.
alter table public.cash_entries enable row level security;

drop policy if exists "cash_entries_select_own" on public.cash_entries;
create policy "cash_entries_select_own" on public.cash_entries
  for select using (auth.uid() = user_id);

drop policy if exists "cash_entries_insert_own" on public.cash_entries;
create policy "cash_entries_insert_own" on public.cash_entries
  for insert with check (auth.uid() = user_id);

drop policy if exists "cash_entries_update_own" on public.cash_entries;
create policy "cash_entries_update_own" on public.cash_entries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "cash_entries_delete_own" on public.cash_entries;
create policy "cash_entries_delete_own" on public.cash_entries
  for delete using (auth.uid() = user_id);

-- Realtime (chỉ thêm nếu chưa có trong publication — tránh lỗi khi chạy lại).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'cash_entries'
  ) then
    alter publication supabase_realtime add table public.cash_entries;
  end if;
end $$;

-- REPLICA IDENTITY FULL: để sự kiện realtime DELETE/UPDATE mang đủ cột (gồm user_id).
alter table public.cash_entries replica identity full;
