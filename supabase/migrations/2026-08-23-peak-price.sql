-- Migration: cột ĐỈNH LỊCH SỬ cho cổ phiếu và crypto.
--
-- VIỆC ĐANG GIẢI: hai tab Cổ phiếu / Crypto cần trả lời câu "mã này đang thấp hơn
-- đỉnh lịch sử bao nhiêu phần trăm" — một tín hiệu tích sản quan trọng mà bảng
-- hiện tại không có cách nào tính (chỉ có giá hiện tại, giá ngưỡng, giá bảo vệ).
-- Cột `peak_price` lưu đỉnh; "% giảm so với đỉnh" là số TÍNH RA ở tầng UI
-- (src/lib/peakDrawdown.ts), KHÔNG lưu trong DB — lưu cả hai là mời gọi lệch nhau.
--
-- CÁCH DÙNG: Supabase Dashboard → SQL Editor → dán toàn bộ file → Run.
--
-- ⚠️ ĐƠN VỊ (mỗi bảng một đơn vị khác nhau — bám đúng đơn vị cột giá của chính
-- bảng đó, để so sánh peak với current_price không cần quy đổi gì):
--   · public.stocks.peak_price  = NGHÌN ĐỒNG (như public.stocks.current_price)
--   · public.cryptos.peak_price = USD        (như public.cryptos.current_price)
--
-- AN TOÀN CHẠY LẠI NHIỀU LẦN (idempotent), cùng khuôn các migration trước.

-- ---------- ① stocks: đỉnh lịch sử (nghìn đồng) ----------
-- NULL = CHƯA BIẾT ĐỈNH, khác hẳn 0. Tầng UI phải hiện "—" ở cột % giảm chứ
-- không được hiện 0% (0% nghĩa là "đang đúng ở đỉnh" — sai hoàn toàn).
alter table public.stocks add column if not exists peak_price numeric;

-- Giá ≤ 0 không phải một đỉnh. Chặn ở DB để một lần gõ sai dấu không lặng lẽ làm
-- mọi phép chia cho đỉnh ra số vô nghĩa.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'stocks_peak_price_duong'
  ) then
    alter table public.stocks
      add constraint stocks_peak_price_duong check (peak_price is null or peak_price > 0);
  end if;
end $$;

-- ---------- ② cryptos: đỉnh lịch sử (USD) ----------
alter table public.cryptos add column if not exists peak_price numeric;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'cryptos_peak_price_duong'
  ) then
    alter table public.cryptos
      add constraint cryptos_peak_price_duong check (peak_price is null or peak_price > 0);
  end if;
end $$;

-- ---------- ③ Khai đơn vị NGAY TẠI CỘT ----------
-- Đơn vị chỉ nằm trong comment của file .sql thì lần sau không ai đọc lại. Ghi
-- vào metadata của cột để `\d+` và Supabase Dashboard đều nói ra được.
--
-- ⚠️ `invested_amount` là NGHÌN ĐỒNG (NewPL chốt 2026-08-23). Trước đó code đọc
-- nó như ĐỒNG nên "vốn đã bỏ" ở tab Danh mục nhỏ đi 1.000 lần. Dữ liệu trong bảng
-- KHÔNG đổi, chỉ có cách đọc được sửa (src/data/holdingsMap.ts).
comment on column public.stocks.invested_amount is 'Số tiền đã đầu tư — NGHÌN ĐỒNG';
comment on column public.stocks.current_price   is 'Giá hiện tại — NGHÌN ĐỒNG';
comment on column public.stocks.peak_price      is 'Đỉnh lịch sử — NGHÌN ĐỒNG';
comment on column public.stocks.dividend        is 'Cổ tức tiền/năm — ĐỒNG';
comment on column public.stocks.quantity        is 'Số cổ phiếu đang giữ (không phải tiền)';
comment on column public.cryptos.current_price  is 'Giá hiện tại — USD';
comment on column public.cryptos.peak_price     is 'Đỉnh lịch sử (ATH) — USD';
comment on column public.cryptos.avg_buy_price  is 'Giá mua trung bình — USD';
