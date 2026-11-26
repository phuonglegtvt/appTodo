-- Migration: tiền mặt đang có — nhập tay ở màn Cấu hình, tính vào tỷ trọng.
--
-- VIỆC ĐANG GIẢI: tab Danh mục chỉ tính tỷ trọng từ cổ phiếu / crypto / vàng.
-- Tiền mặt nằm ngoài nên tổng tài sản và tỷ trọng các nhóm khác bị lệch so với
-- thực tế. Sau migration này nhóm CASH có giá trị = số tiền mặt người dùng nhập.
--
-- Vì sao một CỘT trong `settings` mà không đi qua `portfolio.transactions` (túi
-- CASH VND-RESERVE): sổ giao dịch chưa có đường ghi nào trong app, còn tỷ trọng
-- hôm nay đọc thẳng holdings (xem src/data/holdingsMap.ts). Một con số nhập tay
-- là đủ và khớp cách các nhóm khác đang được nhập.
--
-- CÁCH DÙNG: Supabase Dashboard → SQL Editor → dán toàn bộ file → Run.
--
-- ⚠️ ĐƠN VỊ: ĐỒNG tuyệt đối (giống `monthly_contribution_vnd`, `dca_capital_vnd`).
--
-- AN TOÀN CHẠY LẠI NHIỀU LẦN (idempotent), cùng khuôn các migration trước.

-- `not null default 0`: 0 = không có tiền mặt, là mặc định đúng cho hồ sơ đang có.
alter table portfolio.settings
  add column if not exists cash_on_hand_vnd numeric not null default 0;

-- Tiền mặt âm không phải trạng thái nghiệp vụ nào; lọt qua thì nó TRỪ vào tổng
-- tài sản và tỷ trọng các nhóm khác trông to ra mà không ai biết vì sao.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'settings_cash_on_hand_khong_am'
  ) then
    alter table portfolio.settings
      add constraint settings_cash_on_hand_khong_am check (cash_on_hand_vnd >= 0);
  end if;
end $$;

comment on column portfolio.settings.cash_on_hand_vnd is 'Tiền mặt đang có (nhập tay) — ĐỒNG';
