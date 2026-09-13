-- Migration: thêm cột `invested_amount` cho `public.cryptos` và `public.golds`.
--
-- CÁCH DÙNG: Supabase Dashboard → SQL Editor → dán toàn bộ file → Run.
-- An toàn chạy lại nhiều lần (idempotent).
--
-- VÌ SAO CẦN: khối "Lũy kế đã đầu tư" (tab Thu–Chi) phải biết đã bỏ vào bao
-- nhiêu tiền. Cổ phiếu có sẵn `stocks.invested_amount`, còn crypto và vàng thì
-- trước đây phải suy ra từ `quantity × avg_buy_price` ⇒ mã chưa nhập số lượng
-- bị thiếu hẳn khỏi tổng.
--
-- ⚠️⚠️ ĐƠN VỊ: CẢ HAI CỘT MỚI LÀ **VND (ĐỒNG) TUYỆT ĐỐI**.
--   · KHÁC `stocks.invested_amount` (NGHÌN đồng — di sản, không đổi được nữa).
--   · KHÁC `cryptos.avg_buy_price` / `current_price` / `peak_price` (USD).
--   · Cùng đơn vị với `golds.avg_buy_price` / `current_price` (đồng).
--
-- Vì sao crypto dùng ĐỒNG chứ không USD dù mọi cột giá của nó là USD:
-- `avg_buy_price` là USD nhưng bảng KHÔNG lưu tỷ giá lúc mua, nên muốn ra VND
-- phải nhân tỷ giá HÔM NAY — con số "vốn đã bỏ" vì thế lẫn cả biến động tỷ giá
-- (hạn chế đã ghi trong src/data/holdingsMap.ts). Nhập thẳng số tiền VND đã
-- chuyển đi thì hạn chế đó biến mất: vốn là vốn, không phụ thuộc tỷ giá nào.

alter table public.cryptos add column if not exists invested_amount numeric;
alter table public.golds   add column if not exists invested_amount numeric;

-- Không âm. `null` vẫn hợp lệ và có nghĩa là CHƯA NHẬP (khác hẳn 0 = không bỏ đồng nào).
do $$ begin
  alter table public.cryptos
    add constraint cryptos_invested_amount_khong_am
    check (invested_amount is null or invested_amount >= 0);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.golds
    add constraint golds_invested_amount_khong_am
    check (invested_amount is null or invested_amount >= 0);
exception when duplicate_object then null; end $$;

-- Ghi đơn vị vào chính DB: mở Table Editor là thấy, không phải đi tra code.
comment on column public.cryptos.invested_amount is
  'Tổng tiền ĐÃ BỎ VÀO, đơn vị VND (đồng) tuyệt đối — KHÁC các cột giá của bảng này (USD). null = chưa nhập.';
comment on column public.golds.invested_amount is
  'Tổng tiền ĐÃ BỎ VÀO, đơn vị VND (đồng) tuyệt đối. null = chưa nhập.';
