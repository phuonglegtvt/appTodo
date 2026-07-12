-- Seed: nạp danh mục tham khảo cổ phiếu tích sản THÁNG 07/2026 (AzFin) vào bảng stocks.
-- Nguồn: bảng "DANH MỤC THAM KHẢO CỔ PHIẾU TÍCH SẢN THÁNG 07/2026" (56 mã).
--
-- CÁCH DÙNG: mở Supabase Dashboard → SQL Editor → dán toàn bộ file này → Run.
-- Chạy với tài khoản có email dưới đây (đổi nếu đăng nhập app bằng email khác).
--
-- Đơn vị (khớp app): price_threshold / price_protect = NGHÌN ĐỒNG; dividend = ĐỒNG.
--   'attack' = Tấn công, 'balance' = Cân bằng, 'defense' = Phòng thủ.
--   Cổ tức "-" trong bảng → để trống (NULL). invested_amount để trống (chưa mua).
--
-- AN TOÀN CHẠY LẠI (idempotent): chỉ thêm mã CHƯA có trong danh mục của user,
--   nên chạy nhiều lần không tạo bản trùng.

insert into public.stocks (user_id, ticker, company_name, "group", price_threshold, price_protect, dividend, sort_order)
select u.id, v.ticker, v.company_name, v.grp, v.threshold, v.protect, v.dividend, v.ord
from auth.users u
cross join (values
  -- ===== TẤN CÔNG (attack) =====
  ('ACB', 'Ngân hàng TMCP Á Châu',                              'attack', 30.1,  31.5,  700::numeric,   1),
  ('ACV', 'Công ty Cổ phần Cảng hàng không Việt Nam',           'attack', 63.8,  66.8,  NULL,           2),
  ('HPG', 'Công ty Cổ phần Tập đoàn Hòa Phát',                  'attack', 30.9,  32.7,  500,            3),
  ('LHG', 'Công ty Cổ phần Long Hậu',                           'attack', 33.0,  35.0,  2100,           4),
  ('MBB', 'Ngân hàng TMCP Quân đội',                            'attack', 33.0,  34.8,  1000,           5),
  ('MSB', 'Ngân hàng TMCP Hàng hải Việt Nam',                   'attack', 14.5,  15.0,  NULL,           6),
  ('OCB', 'Ngân hàng Thương mại cổ phần Phương Đông',           'attack', 13.8,  14.8,  NULL,           7),
  ('TCB', 'Ngân hàng TMCP Kỹ thương Việt Nam',                  'attack', 40.0,  42.8,  700,            8),
  ('TPB', 'Ngân hàng TMCP Tiên Phong',                          'attack', 22.1,  23.9,  500,            9),
  ('VCB', 'Ngân hàng TMCP Ngoại thương Việt Nam',               'attack', 71.0,  73.9,  500,           10),
  ('VHC', 'Công ty cổ phần Vĩnh Hoàn',                          'attack', 64.0,  68.0,  3000,          11),
  ('VHM', 'Công ty cổ phần Vinhomes',                           'attack', 59.0,  65.0,  6000,          12),
  ('VIB', 'Ngân hàng TMCP Quốc tế Việt Nam',                    'attack', 23.8,  25.5,  900,           13),
  ('VPB', 'Ngân hàng TMCP Việt Nam Thịnh Vượng',                'attack', 36.9,  39.9,  500,           14),
  ('VRE', 'Công ty Cổ phần Vincom Retail',                      'attack', 28.5,  30.0,  1000,          15),
  ('HDB', 'NHTMCP Phát Triển Thành phố Hồ Chí Minh',            'attack', 28.5,  31.0,  NULL,          16),
  ('STB', 'Ngân hàng Thương mại Cổ phần Sài Gòn Thương Tín',    'attack', 46.0,  49.0,  NULL,          17),
  ('VND', 'Công ty Cổ phần Chứng khoán VNDIRECT',               'attack', 23.0,  27.0,  500,           18),
  ('SSI', 'Công ty Cổ phần Chứng khoán SSI',                    'attack', 35.0,  40.0,  1000,          19),
  ('TCX', 'Công ty Cổ phần Chứng khoán Kỹ Thương',              'attack', 44.2,  48.3,  500,           20),
  ('HCM', 'Công ty Cổ phần Chứng khoán TP.Hồ Chí Minh',         'attack', 26.0,  30.0,  700,           21),
  ('VCI', 'Công ty Cổ phần Chứng khoán Vietcap',                'attack', 28.1,  32.6,  800,           22),
  ('NLG', 'Công ty Cổ phần Đầu tư Nam Long',                    'attack', 35.0,  43.0,  500,           23),
  ('MSN', 'Công ty Cổ phần Đầu tư Tập đoàn Masan',              'attack', 88.0, 105.0,  NULL,          24),

  -- ===== CÂN BẰNG (balance) =====
  ('BWE', 'Công ty Cổ phần Nước - Môi trường Bình Dương',       'balance', 46.5,  50.9,  1300,         25),
  ('DHC', 'Công ty Cổ phần Đông Hải Bến Tre',                   'balance', 38.9,  40.9,  2000,         26),
  ('DHG', 'Công ty Cổ phần Dược Hậu Giang',                     'balance', 130.0, 136.0, 10000,        27),
  ('DPR', 'Công ty Cổ phần Cao su Đồng Phú',                    'balance', 43.0,  45.5,  2000,         28),
  ('FPT', 'Công ty Cổ phần FPT',                                'balance', 100.0, 110.0, 2000,         29),
  ('HAX', 'Công ty Cổ phần Dịch vụ Ô tô Hàng Xanh',            'balance', 14.5,  16.0,  300,          30),
  ('IMP', 'Công ty Cổ phần Dược phẩm IMEXPHARM',                'balance', 52.0,  58.0,  500,          31),
  ('MWG', 'Công ty Cổ phần Đầu tư Thế giới Di động',            'balance', 95.0, 103.0,  2000,         32),
  ('PHR', 'Công ty cổ phần Cao su Phước Hòa',                   'balance', 70.0,  75.0,  3000,         33),
  ('PNJ', 'Công ty Cổ phần vàng bạc đá quý Phú Nhuận',          'balance', 85.0,  90.0,  1500,         34),
  ('POW', 'Tổng công ty điện lực Dầu khí Việt Nam',             'balance', 13.8,  15.5,  NULL,         35),
  ('PTB', 'Công ty Cổ phần Phú Tài',                            'balance', 45.4,  48.6,  500,          36),
  ('REE', 'Công ty Cổ phần Cơ điện lạnh',                       'balance', 60.0,  63.5,  1000,         37),
  ('TDM', 'Công ty cổ phần Nước Thủ Dầu Một',                   'balance', 46.0,  49.0,  1300,         38),
  ('VCS', 'Công ty Cổ phần VICOSTONE',                          'balance', 55.0,  59.0,  3800,         39),
  ('HDG', 'CTCP Tập đoàn Hà Đô',                                'balance', 30.0,  32.3,  1000,         40),
  ('VSC', 'Công ty Cổ phần Tập đoàn Container Việt Nam',        'balance', 23.0,  25.0,  500,          41),
  ('QNS', 'Công ty cổ phần Đường Quảng Ngãi',                   'balance', 54.0,  58.0,  4000,         42),
  ('PVS', 'Tổng Công ty Cổ phần Dịch vụ Kỹ thuật Dầu khí Việt Nam', 'balance', 40.0, 43.6, 1000,     43),

  -- ===== PHÒNG THỦ (defense) =====
  ('BMP', 'Công ty Cổ phần nhựa Bình Minh',                     'defense', 129.0, 136.0, 14900,        44),
  ('GAS', 'Tổng công ty khí Việt Nam',                          'defense', 80.0,  86.9,  2000,         45),
  ('HND', 'Công ty Cổ phần Nhiệt điện Hải Phòng',               'defense', 13.3,  13.7,  800,          46),
  ('NT2', 'Công ty Cổ phần Điện lực Dầu khí Nhơn Trạch 2',      'defense', 25.0,  27.0,  2000,         47),
  ('PLX', 'Tập đoàn Xăng dầu Việt Nam',                         'defense', 40.0,  44.0,  1200,         48),
  ('PVT', 'Tổng công ty Cổ phần Vận tải Dầu khí',               'defense', 20.5,  22.7,  500,          49),
  ('QTP', 'Công ty Cổ phần Nhiệt điện Quảng Ninh',              'defense', 13.5,  14.0,  1000,         50),
  ('VEA', 'Tổng Cty Máy động lực và Máy nông nghiệp VN',        'defense', 38.0,  40.0,  5200,         51),
  ('VNM', 'CTCP Sữa Việt Nam',                                  'defense', 73.0,  76.0,  4400,         52),
  ('IDC', 'Tổng công ty IDICO - CTCP',                          'defense', 43.0,  46.0,  3000,         53),
  ('DCM', 'Công ty Cổ phần Phân bón Dầu khí Cà Mau',            'defense', 36.0,  38.0,  2000,         54),
  ('DPM', 'Tổng Công ty Phân bón và Hoá chất Dầu khí - CTCP',   'defense', 24.6,  25.7,  1200,         55),
  ('SIP', 'Công ty Cổ phần Đầu tư Sài Gòn VRG',                 'defense', 73.0,  76.0,  5000,         56)
) as v(ticker, company_name, grp, threshold, protect, dividend, ord)
where u.email = 'phuonglegtvt92@gmail.com'
  and not exists (
    select 1 from public.stocks s
    where s.user_id = u.id and s.ticker = v.ticker
  );
