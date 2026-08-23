-- Migration: kế hoạch DCA — vốn có sẵn rải dần theo tháng.
--
-- VIỆC ĐANG GIẢI: `portfolio.settings` chỉ có `monthly_contribution_vnd` (tiền góp
-- đều mỗi tháng). Không lưu được ca rất thường gặp: "tôi có 120tr sẵn, muốn rải
-- trong 12 tháng". Sau migration này cột "Góp tháng này" ở tab Danh mục chia từ
-- TỔNG = tiền góp hàng tháng + (vốn ÷ số tháng), thay vì chỉ tiền góp hàng tháng.
--
-- CÁCH DÙNG: Supabase Dashboard → SQL Editor → dán toàn bộ file → Run.
--
-- ⚠️ ĐƠN VỊ: `dca_capital_vnd` = ĐỒNG (giống `monthly_contribution_vnd`, KHÔNG
-- phải nghìn đồng — đây là cột của schema `portfolio`, không phải bảng cũ
-- `public.stocks`). `dca_months` là SỐ THÁNG, không phải tiền.
--
-- AN TOÀN CHẠY LẠI NHIỀU LẦN (idempotent), cùng khuôn các migration trước.

-- ---------- ① Vốn có sẵn để rải (đồng) ----------
-- `not null default 0`: 0 nghĩa là "không có kế hoạch DCA", và đó là mặc định
-- đúng cho mọi hồ sơ đang có. Không cho NULL vì ở đây 0 và "chưa nhập" là cùng
-- một trạng thái nghiệp vụ — khác hẳn `dca_months` bên dưới.
alter table portfolio.settings
  add column if not exists dca_capital_vnd numeric not null default 0;

-- ---------- ② Số tháng rải hết vốn ----------
-- CHO PHÉP NULL, và null ở đây có nghĩa riêng: "có vốn nhưng CHƯA đặt số tháng".
-- App phải nói ra trạng thái đó (vốn bổ sung = 0 kèm lý do) chứ không được im
-- lặng — người dùng nhập vốn rồi tưởng app đã rải, mà thực ra chưa.
alter table portfolio.settings
  add column if not exists dca_months integer;

-- ---------- ③ Chặn số vô nghĩa ngay tại DB ----------
-- Vốn âm không phải trạng thái nghiệp vụ nào; nếu lọt qua thì nó TRỪ vào pool và
-- kế hoạch phân bổ vẫn trông như một kế hoạch bình thường.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'settings_dca_capital_khong_am'
  ) then
    alter table portfolio.settings
      add constraint settings_dca_capital_khong_am check (dca_capital_vnd >= 0);
  end if;
end $$;

-- Số tháng ≤ 0 thì app coi như "chưa đặt" (không chia cho 0), nhưng lưu số âm
-- vào DB thì vẫn là dữ liệu rác — chặn luôn ở đây.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'settings_dca_months_duong'
  ) then
    alter table portfolio.settings
      add constraint settings_dca_months_duong check (dca_months is null or dca_months > 0);
  end if;
end $$;

-- ---------- ④ Khai đơn vị ngay tại cột ----------
comment on column portfolio.settings.monthly_contribution_vnd is 'Tiền góp đều mỗi tháng — ĐỒNG';
comment on column portfolio.settings.dca_capital_vnd is 'Vốn có sẵn để rải dần — ĐỒNG';
comment on column portfolio.settings.dca_months is 'Số tháng rải hết dca_capital_vnd. NULL = chưa đặt';
