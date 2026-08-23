# Thiết lập DB module Portfolio — checklist NewPL chạy tay

Hai việc này code không làm thay được. Làm đúng thứ tự, mỗi bước có câu SQL xác
minh riêng — chạy xác minh xong mới sang bước sau.

> Nguồn: `docs/handoff/2026-08-22-2245-portfolio-dot1-2-hoan-tat.md` mục 1,
> spec mục 1.2.

> **Đã chạy xong trên project thật `hnohjmonscdbqbqwvxqs` ngày 2026-08-23.**
> Cả 4 bước PASS, xác minh bằng số chứ không bằng lời: 11 bảng · 3 view ·
> RLS bật đủ · `transactions` không có policy UPDATE · 3 view đều `security_invoker` ·
> instruments 72 = 62 stocks + 5 cryptos + 4 túi tiền + 1 vàng (lệch 0) ·
> target 60/30/10/0 cộng đúng 100 · `public.golds` 4 policy + RLS on.
> PostgREST tự khai: `Only the following schemas are exposed: public, graphql_public, portfolio`.
> Checklist dưới đây giữ lại để dựng lại project khác hoặc khi phải làm lại từ đầu.

---

## Bước 0 — Xác nhận email đăng nhập (làm TRƯỚC, 30 giây)

File seed hardcode email `phuonglegtvt92@gmail.com`. Nếu tài khoản NewPL đăng nhập
app bằng email khác thì seed sẽ **raise exception và dừng** (guard cố ý, để không
"Success" giả).

Supabase Dashboard → **SQL Editor** → Run:

```sql
select id, email, created_at from auth.users order by created_at;
```

- Thấy `phuonglegtvt92@gmail.com` → sang Bước 1.
- Không thấy → mở `supabase/migrations/2026-08-22-portfolio-seed.sql`, thay **cả 9
  chỗ** `phuonglegtvt92@gmail.com` bằng email đúng (dùng Find & Replace), rồi mới chạy.

---

## Bước 1 — Chạy 5 migration, ĐÚNG thứ tự

> Phải chạy migration TRƯỚC khi bật Exposed schemas. Dashboard Supabase mới chỉ
> cho chọn schema **đã tồn tại trong DB**; schema `portfolio` chưa có thì ô chọn
> hiện "No results found".

SQL Editor → New query → dán **toàn bộ NỘI DUNG** file → **Run**. Lần lượt:

> ⚠️ Dán **nội dung** file, KHÔNG dán đường dẫn. SQL Editor chạy trên server
> Supabase, nó không đọc được file trong máy. Dán `supabase/migrations/...` sẽ báo
> `ERROR: 42601: syntax error at or near "supabase"`.
>
> Mẹo: chạy lệnh này trong terminal để copy thẳng vào clipboard, rồi Cmd+V:
> ```bash
> pbcopy < supabase/migrations/2026-08-22-portfolio-core.sql
> ```


| # | File | Tạo ra gì |
|---|---|---|
| 1 | `supabase/migrations/2026-08-22-portfolio-core.sql` | schema `portfolio`, 3 enum, 11 bảng, trigger, RLS |
| 2 | `supabase/migrations/2026-08-22-portfolio-views.sql` | 3 view: `v_legs`, `v_positions`, `v_allocation` |
| 3 | `supabase/migrations/2026-08-22-portfolio-seed.sql` | settings, 4 target (**60/30/10/0**), 5 mức crash reserve, 4 túi tiền + vàng, 3 benchmark, instrument từ watchlist |
| 4 | `supabase/migrations/2026-08-23-holdings-quantity.sql` | cột `public.stocks.quantity` + bảng mới `public.golds` |
| 5 | `supabase/migrations/2026-08-23-peak-price.sql` | cột `peak_price` cho `public.stocks` (nghìn đồng) và `public.cryptos` (USD) + khai đơn vị vào comment của các cột tiền |

File số 4 là thứ làm tab Danh mục tính được **giá trị thị trường**: `public.stocks`
trước đây chỉ có `invested_amount` (đã bỏ vào bao nhiêu tiền) nên không suy ra được
giá trị hiện tại; vàng thì chưa có bảng nào. File này chỉ đụng schema `public`, độc
lập với ba file trên — nhưng vẫn chạy sau cho gọn.

File số 5 mở hai cột mới ở tab Cổ phiếu và Crypto: **Đỉnh LS** (đỉnh lịch sử) và
**% so đỉnh**. Nút "Cập nhật giá" tự điền đỉnh (cổ phiếu lấy `max(high)` nến tháng
của dchart, crypto lấy `ath` của CoinGecko) nhưng vẫn sửa tay được — và đỉnh **chỉ
tăng, không bao giờ giảm**, nên một lần API trả thiếu không xoá mất đỉnh thật.
File này cũng ghi đơn vị vào `comment on column`, trong đó chốt rằng
`public.stocks.invested_amount` là **NGHÌN ĐỒNG** (trước đây code đọc nhầm là đồng
nên "Vốn đã bỏ" ở tab Danh mục nhỏ đi 1.000 lần). **Dữ liệu trong bảng không đổi** —
chỉ cách đọc được sửa, không cần chạy UPDATE nào.

Cả năm **idempotent** — chạy lại nhiều lần không hỏng gì (ba file đầu đã chứng minh
trên Postgres 16 thật: chạy 3 lần, diff output rỗng).

**Nếu một file báo lỗi:** dừng lại, copy nguyên văn lỗi báo cho member. Đừng tự
sửa file — lỗi khác với dự kiến nghĩa là project thật lệch với giả định của file,
đó là thông tin cần biết, không phải chuyện vá đi cho xong.

---

## Bước 2 — Bật Exposed schemas

> ⚠️ Supabase đã đổi layout dashboard (2026). Mục này **không còn** ở trang
> `Settings → API` nữa — trang đó giờ chỉ còn API Keys.

Dashboard → sidebar trái, icon **Integrations** (ô vuông ghép) → **Data API**
→ tab **Settings** (KHÔNG phải tab Overview) → mục **Exposed schemas** (ô trên
cùng, hiện `2 of 2 schemas exposed`) → mở ra, tick thêm **`portfolio`**
(giữ nguyên `public` và `graphql_public`) → **Save**.

Đường tắt (thay `<project-ref>` bằng ref của project):

```
https://supabase.com/dashboard/project/<project-ref>/integrations/data_api/settings
```

**Đừng nhầm ô.** Trang này có nhiều ô trông giống nhau:

| Ô | Có phải chỗ cần sửa? |
|---|---|
| **Exposed schemas** | ✅ ĐÚNG — thêm `portfolio` ở đây |
| Extra search path | ❌ Giữ nguyên `public`, `extensions`. Code dùng `supabase.schema('portfolio')` nên không cần |
| Exposed tables / functions | ❌ Không đụng vào |
| Harden Data API | ❌ Không bấm |

Thiếu bước này, app sẽ báo:
`The schema must be one of the following: public`

### Xác minh Bước 2

Không xác minh bằng SQL được — SQL Editor nối thẳng DB, không đi qua PostgREST.
Nhưng gọi HTTP thì kiểm chứng được ngay. Chạy trong terminal ở gốc repo:

```bash
URL=$(grep '^VITE_SUPABASE_URL=' .env | cut -d= -f2-)
KEY=$(grep -E '^VITE_SUPABASE_(ANON|PUBLISHABLE)_KEY=' .env | head -1 | cut -d= -f2-)
curl -s "$URL/rest/v1/settings?select=user_id&limit=1" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Accept-Profile: khong_ton_tai"
```

Cố tình hỏi một schema không tồn tại để PostgREST **tự khai** danh sách nó đang mở:

```json
{"code":"PGRST106","message":"Invalid schema: khong_ton_tai",
 "hint":"Only the following schemas are exposed: public, graphql_public, portfolio"}
```

Thấy `portfolio` trong câu hint → Bước 2 xong. Chưa thấy → chưa bấm **Save**.

Đổi `Accept-Profile` thành `portfolio` sẽ ra `permission denied for table settings`
— **đúng như thiết kế**, vì key này là role `anon` (khách chưa đăng nhập); grant chỉ
cấp cho `authenticated`. Lỗi đó chứng minh RLS đang bảo vệ đúng, không phải hỏng.

---

## Bước 3 — Xác minh (chạy cả khối một lần)

```sql
-- 1. Đủ 11 bảng + 3 view?  Kỳ vọng: 11 | 3
select
  (select count(*) from pg_tables where schemaname = 'portfolio') as so_bang,
  (select count(*) from pg_views  where schemaname = 'portfolio') as so_view;

-- 2. RLS bật hết trên 11 bảng?  Kỳ vọng: khong_bat_rls = 0
select count(*) as khong_bat_rls
  from pg_tables t
  join pg_class c on c.relname = t.tablename
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'portfolio'
 where t.schemaname = 'portfolio' and c.relrowsecurity = false;

-- 3. Sổ giao dịch bất biến — transactions KHÔNG được có policy UPDATE.
--    Kỳ vọng: 0 dòng trả về.
select policyname, cmd
  from pg_policies
 where schemaname = 'portfolio' and tablename = 'transactions' and cmd = 'UPDATE';

-- 4. 3 view phải có security_invoker.  Kỳ vọng: 3 dòng, đều 'true'
select c.relname,
       (select option_value from pg_options_to_table(c.reloptions)
         where option_name = 'security_invoker') as security_invoker
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'portfolio' and c.relkind = 'v'
 order by c.relname;

-- 5. Seed đã vào chưa? Kỳ vọng: settings 1 · targets 4 · crash_levels 5
--    tui_tien 4 · benchmarks 3 · instruments = 5 + số mã trong watchlist
select
  (select count(*) from portfolio.settings)              as settings,
  (select count(*) from portfolio.allocation_targets)    as targets,
  (select count(*) from portfolio.crash_reserve_levels)  as crash_levels,
  (select count(*) from portfolio.instruments
     where asset_class = 'CASH')                         as tui_tien,
  (select count(*) from portfolio.benchmarks)            as benchmarks,
  (select count(*) from portfolio.instruments)           as instruments;

-- 5b. Tổng 4 target PHẢI bằng đúng 100. Lệch thì app ném lỗi khi mở tab.
--     Kỳ vọng: tong_target = 100
select sum(target_pct) as tong_target from portfolio.allocation_targets;

-- 5c. File số 4 đã chạy chưa? Kỳ vọng: co_cot_quantity = 1 · co_bang_golds = 1
select
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'stocks'
      and column_name = 'quantity')                      as co_cot_quantity,
  (select count(*) from information_schema.tables
    where table_schema = 'public' and table_name = 'golds') as co_bang_golds;

-- 6. Đối chiếu instruments với watchlist. Kỳ vọng: cả hai cột = 0
select
  (select count(*) from public.stocks s
    where not exists (select 1 from portfolio.instruments i
                       where i.user_id = s.user_id and i.symbol = s.ticker)) as stocks_thieu,
  (select count(*) from public.cryptos c
    where not exists (select 1 from portfolio.instruments i
                       where i.user_id = c.user_id and i.symbol = c.symbol)) as cryptos_thieu;
```

**4 target phải là** STOCKS 60 (55–65) · CRYPTO 30 (25–35) · GOLD 10 (5–15) ·
CASH **0 (0–0)**.

CASH = 0% là cố ý: tab Danh mục tính tỷ trọng từ cổ phiếu / crypto / vàng và
không theo dõi số dư tiền mặt, nên khoá band 0–0 để tiền mặt luôn "đúng target"
thay vì bị báo lệch mỗi tháng vì một nhóm app không quản. Đổi được ở màn Cấu
hình, không cần migration.

Chưa cần chạy "kịch bản bút toán kép" — phần đó đã chứng minh xong trên Postgres 16
thật (bản bàn giao mục 3).

---

## Bước 4 — Báo lại

Nhắn member: **số ở mục 5 và 6**, cộng bất kỳ lỗi nào gặp. Có số đó thì đợt 3
(đường ghi transaction) mới smoke-test được thật.
