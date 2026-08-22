-- Seed: cấu hình khởi tạo + túi tiền + instrument cho module portfolio.
-- Spec: docs/superpowers/specs/2026-08-22-portfolio-rebalancing-design.md, mục 8.
--
-- CÁCH DÙNG: Supabase Dashboard → SQL Editor → dán toàn bộ → Run.
-- Chạy với tài khoản có email dưới đây (đổi nếu NewPL đăng nhập bằng email khác).
--
-- AN TOÀN CHẠY LẠI NHIỀU LẦN (idempotent): mọi insert có `on conflict ... do
-- nothing` — chỉ thêm cái CHƯA có, không bao giờ ghi đè dữ liệu người dùng
-- đã sửa tay sau khi seed chạy lần đầu.
--
-- CHỈ ĐỌC `public.stocks` / `public.cryptos`: file này chỉ `select` từ hai
-- bảng đó, không `insert`/`update`/`delete`/`alter` — hai bảng đó vẫn là
-- watchlist sống của appTodo hiện tại (mục 8 của spec).
--
-- KHÔNG tạo transactions. Nạp vị thế thật (số lượng, giá mua, ngày) làm ở
-- màn hình InitialPositionsWizard (đợt 3) — không được bịa ngày giao dịch.

-- ---------- guard: user phải tồn tại (CLAUDE.md "KHÔNG nuốt lỗi im lặng") ----------
-- Thiếu guard này: sai email ⇒ mọi insert bên dưới lọc "where u.email = ..."
-- ra 0 dòng ⇒ "INSERT 0 0" bảy lần, exit 0, KHÔNG một cảnh báo — file này
-- NewPL chạy tay trong SQL Editor, thấy "Success" tưởng đã xong, đến lúc mở
-- app ra rỗng mới biết là sai. Chặn sớm, nói rõ đang tìm email nào.
do $$
begin
  if not exists (
    select 1 from auth.users where email = 'phuonglegtvt92@gmail.com'
  ) then
    raise exception
      'Không tìm thấy user với email phuonglegtvt92@gmail.com trong auth.users — kiểm tra lại email đăng nhập (đổi email trong file này nếu NewPL dùng địa chỉ khác) trước khi chạy lại seed';
  end if;
end $$;

-- ---------- settings ----------
insert into portfolio.settings (user_id)
select u.id from auth.users u where u.email = 'phuonglegtvt92@gmail.com'
on conflict (user_id) do nothing;

-- ---------- allocation_targets: 50/20/15/15 + band ----------
-- Giá trị band khớp với fixture TARGETS dùng trong test miền domain (vd. bands.test.ts) —
-- STOCKS 50 (40–55) · CRYPTO 20 (15–25) · GOLD 15 (10–20) · CASH 15 (7–20).
insert into portfolio.allocation_targets
  (user_id, asset_class, target_pct, min_pct, max_pct)
select u.id, v.ac, v.t, v.mn, v.mx
  from auth.users u
 cross join (values
   ('STOCKS'::portfolio.asset_class, 50, 40, 55),
   ('CRYPTO'::portfolio.asset_class, 20, 15, 25),
   ('GOLD'::portfolio.asset_class,   15, 10, 20),
   ('CASH'::portfolio.asset_class,   15,  7, 20)
 ) as v(ac, t, mn, mx)
 where u.email = 'phuonglegtvt92@gmail.com'
on conflict (user_id, asset_class) do nothing;

-- ---------- crash_reserve_levels ----------
-- Tổng 10+15+20+25+30 = 100% (bậc 5 dùng "phần còn lại"). Khớp với
-- DEFAULT_CRASH_LEVELS trong src/domain/crashReserve.ts.
insert into portfolio.crash_reserve_levels
  (user_id, level, drawdown_pct, deploy_pct_of_reserve)
select u.id, v.lv, v.dd, v.dep
  from auth.users u
 cross join (values (1,15,10),(2,25,15),(3,35,20),(4,45,25),(5,55,30))
   as v(lv, dd, dep)
 where u.email = 'phuonglegtvt92@gmail.com'
on conflict (user_id, level) do nothing;

-- ---------- 4 túi tiền + 1 instrument vàng ----------
-- earmarked_for là cột giải quyết bài toán DCA (spec mục 3.2①): tiền đã đặt
-- tên cho một nhóm tài sản nhưng chưa giải ngân.
insert into portfolio.instruments
  (user_id, asset_class, symbol, name, currency, price_source, earmarked_for, lot_size)
select u.id, v.ac::portfolio.asset_class, v.sym, v.nm,
       v.cur::portfolio.currency, v.src, v.ear::portfolio.asset_class, v.lot
  from auth.users u
 cross join (values
   ('CASH','VND-RESERVE',    'Tiền mặt dự phòng (chứa Crash Reserve)', 'VND','MANUAL', null,     1),
   ('CASH','VND-DCA-STOCKS', 'Tiền đã đặt tên cho Stocks',             'VND','MANUAL','STOCKS',  1),
   ('CASH','VND-DCA-CRYPTO', 'Tiền đã đặt tên cho Crypto',             'VND','MANUAL','CRYPTO',  1),
   ('CASH','VND-DCA-GOLD',   'Tiền đã đặt tên cho Gold',               'VND','MANUAL','GOLD',    1),
   ('GOLD','SJC-1L',         'Vàng miếng SJC 1 lượng',                 'VND','MANUAL', null,     1)
 ) as v(ac, sym, nm, cur, src, ear, lot)
 where u.email = 'phuonglegtvt92@gmail.com'
on conflict (user_id, symbol) do nothing;

-- ---------- benchmarks ----------
-- VNINDEX qua dchart (cần verify khi làm providers, đợt 4). XAU nhập tay.
insert into portfolio.benchmarks (user_id, asset_class, symbol, name, price_source)
select u.id, v.ac::portfolio.asset_class, v.sym, v.nm, v.src
  from auth.users u
 cross join (values
   ('STOCKS','VNINDEX','Chỉ số VN-Index',      'VNDIRECT'),
   ('CRYPTO','BTC',    'Bitcoin (đo từ ATH)',  'BINANCE'),
   ('GOLD',  'XAU',    'Giá vàng tham chiếu',  'MANUAL')
 ) as v(ac, sym, nm, src)
 where u.email = 'phuonglegtvt92@gmail.com'
on conflict (user_id, asset_class, symbol) do nothing;

-- ---------- instrument cổ phiếu, lấy từ watchlist public.stocks (CHỈ ĐỌC) ----------
-- lot_size = 100: HOSE/HNX giao dịch lô chẵn 100 cổ phiếu. Đây là ràng buộc
-- quyết định trong tickerCandidates.ts (spec mục 4.6).
insert into portfolio.instruments
  (user_id, asset_class, symbol, name, currency, price_source,
   watchlist_stock_id, lot_size, sort_order)
select s.user_id, 'STOCKS', s.ticker, s.company_name, 'VND', 'VNDIRECT',
       s.id, 100, s.sort_order
  from public.stocks s
  join auth.users u on u.id = s.user_id
 where u.email = 'phuonglegtvt92@gmail.com'
on conflict (user_id, symbol) do nothing;

-- ---------- instrument crypto, lấy từ public.cryptos (CHỈ ĐỌC) ----------
insert into portfolio.instruments
  (user_id, asset_class, symbol, name, currency, price_source, lot_size, sort_order)
select c.user_id, 'CRYPTO', c.symbol,
       case when c.name = '' then c.symbol else c.name end,
       'USD', 'BINANCE', 1, c.sort_order
  from public.cryptos c
  join auth.users u on u.id = c.user_id
 where u.email = 'phuonglegtvt92@gmail.com'
on conflict (user_id, symbol) do nothing;
