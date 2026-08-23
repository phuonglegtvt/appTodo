-- Migration: mở đường tính GIÁ TRỊ THỊ TRƯỜNG cho tab Danh mục (đợt 3 rút gọn).
--
-- VẤN ĐỀ ĐANG GIẢI: `public.stocks` chỉ có `invested_amount` (đã bỏ vào bao
-- nhiêu tiền) chứ KHÔNG có số lượng cổ phiếu ⇒ không cách nào tính được giá trị
-- hiện tại từ `current_price`. `public.cryptos` thì đã đủ (quantity +
-- current_price). Vàng chưa có bảng nào.
-- Sau migration này, cả ba nhóm đều tính được giá trị thị trường mà KHÔNG cần
-- sổ giao dịch (schema `portfolio.transactions` để dành cho đợt sau).
--
-- CÁCH DÙNG: Supabase Dashboard → SQL Editor → dán toàn bộ file → Run.
--
-- ⚠️ ĐƠN VỊ — chỗ dễ sinh bug tiền nhất, đọc kỹ:
--   · public.stocks.current_price   = NGHÌN ĐỒNG  (giữ nguyên, không đổi)
--   · public.stocks.invested_amount = ĐỒNG        (giữ nguyên)
--   · public.stocks.quantity        = SỐ CỔ PHIẾU (cột mới, không phải tiền)
--   · public.cryptos.current_price  = USD         (giữ nguyên)
--   · public.golds.*_price          = ĐỒNG / LƯỢNG (bảng mới — KHÔNG nghìn đồng,
--     cố tình khác `stocks` vì giá vàng một lượng cỡ 90 triệu, viết bằng nghìn
--     đồng sẽ vừa dài vừa dễ nhầm với giá cổ phiếu)
--   · public.golds.quantity         = SỐ LƯỢNG (lượng vàng)
--
-- AN TOÀN CHẠY LẠI NHIỀU LẦN (idempotent), cùng khuôn stocks/cryptos:
-- `add column if not exists`, `create table if not exists`,
-- `drop policy if exists` trước mỗi create, khối realtime tự kiểm publication.

-- ---------- ① stocks: thêm số lượng cổ phiếu ----------
-- Cho phép NULL: 56 mã watchlist hiện có chưa ai nhập số lượng, và NULL ở đây
-- mang nghĩa "CHƯA NHẬP" — khác hẳn 0 ("đã bán hết"). Tầng đọc dữ liệu phải
-- phân biệt hai ca này: NULL thì báo cho người dùng biết tỷ trọng đang thiếu
-- phần đó, KHÔNG âm thầm coi là 0 đồng.
alter table public.stocks add column if not exists quantity numeric;

-- Số cổ phiếu âm không phải trạng thái nghiệp vụ nào. Chặn ở DB để một lần gõ
-- sai dấu không lặng lẽ làm tổng danh mục nhỏ đi.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'stocks_quantity_khong_am'
  ) then
    alter table public.stocks
      add constraint stocks_quantity_khong_am check (quantity is null or quantity >= 0);
  end if;
end $$;

-- ---------- ② golds: bảng mới, khuôn y hệt cryptos ----------
create table if not exists public.golds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Nhãn tự do: 'SJC 1 lượng', 'Nhẫn trơn 9999'... KHÔNG phải mã sàn.
  label text not null,
  quantity numeric,
  avg_buy_price numeric,
  current_price numeric,
  sort_order numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint golds_quantity_khong_am check (quantity is null or quantity >= 0),
  constraint golds_gia_khong_am check (
    (avg_buy_price is null or avg_buy_price >= 0)
    and (current_price is null or current_price >= 0)
  )
);

-- Hàm public.set_updated_at() đã tạo cùng bảng todos; ở đây chỉ gắn trigger.
drop trigger if exists trg_golds_updated_at on public.golds;
create trigger trg_golds_updated_at
  before update on public.golds
  for each row execute function public.set_updated_at();

alter table public.golds enable row level security;

drop policy if exists "golds_select_own" on public.golds;
create policy "golds_select_own" on public.golds
  for select using (auth.uid() = user_id);

drop policy if exists "golds_insert_own" on public.golds;
create policy "golds_insert_own" on public.golds
  for insert with check (auth.uid() = user_id);

drop policy if exists "golds_update_own" on public.golds;
create policy "golds_update_own" on public.golds
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "golds_delete_own" on public.golds;
create policy "golds_delete_own" on public.golds
  for delete using (auth.uid() = user_id);

-- Bật Realtime (chỉ thêm nếu chưa có trong publication — tránh lỗi khi chạy lại).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'golds'
  ) then
    alter publication supabase_realtime add table public.golds;
  end if;
end $$;

-- REPLICA IDENTITY FULL: để sự kiện realtime DELETE/UPDATE mang đủ cột (gồm user_id).
alter table public.golds replica identity full;
