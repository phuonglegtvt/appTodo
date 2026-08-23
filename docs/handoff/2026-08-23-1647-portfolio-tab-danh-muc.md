# Handoff — Portfolio đợt 3: tab Danh mục, deploy live, merge master (2026-08-23 16:47)

**Tóm tắt:** Cắt phạm vi đợt 3 theo yêu cầu NewPL (màn hình trước, sổ giao dịch sau), làm xong tab Danh mục, deploy production, merge vào `master` — **chỉ còn `git push` là NewPL phải tự chạy**.

## Trạng thái hiện tại

**Xong và đã verify:**
- `master` ở `61af3e8` — merge commit `--no-ff` gom 34 commit ba đợt Portfolio. **461 test pass**, `npm run build` sạch, working tree sạch (chạy trên chính `master` sau merge).
- **Production live:** https://apptodo.phuonglegtvt92.workers.dev — deploy bằng `npm run build && npx wrangler deploy`. Verify bằng **nội dung bundle** (`DANH M`, `ng target`, `viz-stocks`, `golds`), không chỉ status code.
- **Supabase:** đã đo qua REST bằng anon key — Exposed schemas `portfolio` ✅, `core.sql` + `views.sql` ✅, `stocks.quantity` ✅, `golds` đủ 9 cột ✅, RLS trên `golds` chặn thật (`new row violates row-level security policy`) ✅.

**Đang hỏng / chưa xong:**
- ❌ **`git push origin master` CHƯA chạy được.** Remote URL nhúng username `phuonglegtvt`, osxkeychain chỉ có credential của `PhuongLeHong` — tài khoản đó không có quyền (`Repository not found`). Session không tương tác nên không nhập được mật khẩu. `master` đang đi trước `origin/master` **34 commit**, `origin/master` không đi trước chút nào ⇒ push sẽ là fast-forward, không xung đột.
- ❌ **`npm run lint` hỏng từ trước** (không phải do đợt này): repo không có `eslint.config.js` mà ESLint 9 bắt buộc. Chưa sửa, ngoài phạm vi.
- ❓ **Chưa biết 4 target trong DB đang là bộ nào.** Không đọc được từ ngoài (RLS chỉ cho role `authenticated`, không có mật khẩu để đăng nhập; `service_role` cố tình không có usage trên schema `portfolio`).

## Bước tiếp theo

1. **NewPL chạy trong terminal:** `git push origin master` → nhập **Personal Access Token** của tài khoản `phuonglegtvt` (scope `repo`; tạo ở `github.com/settings/tokens`). Xong thì kiểm `git rev-list --count origin/master..master` phải ra `0`.
2. **NewPL mở live → ◍ Danh mục → Cấu hình**, xem bảng 4 nhóm:
   - `60 / 30 / 10 / 0` → xong, không làm gì
   - `50 / 20 / 15 / 15` (bộ cũ) → sửa trong ô, bấm Lưu. ⚠️ Chạy lại `seed.sql` **KHÔNG** cập nhật được vì nó dùng `on conflict do nothing`
   - banner đỏ *"Chưa có cấu hình tỷ trọng mục tiêu"* → `seed.sql` chưa chạy
3. **Nhập dữ liệu:** tab Cổ phiếu → cột **Số lượng** cho từng mã. Lần đầu vào tab Danh mục **sẽ hiện cảnh báo vàng "N mã đã bỏ tiền vào nhưng chưa nhập số lượng"** — đúng thiết kế, không phải lỗi. Vàng nhập ở Danh mục → Cấu hình → Vàng đang giữ (đơn vị **đồng/lượng**).
4. Push xong, cân nhắc xoá branch `feat/portfolio-rebalancing` (hiện **giữ nguyên** vì chưa push, nó là bản sao an toàn duy nhất).
5. Đợt sau: providers giá (đợt 4) → sổ giao dịch + vá `ADJUSTMENT` (đợt 5).

## Quyết định & lý do

- **Đổi thứ tự đợt 3 và 4** (màn hình trước, sổ giao dịch sau) — vì thứ NewPL cần thấy (tỷ trọng vs mục tiêu, cần bổ sung bao nhiêu) **không cần sổ giao dịch**; phép tính đã xong ở đợt 2, chỉ thiếu giá trị thị trường theo nhóm. Ghi đầy đủ ở **spec §11.1**, đừng bàn lại.
- **Nguồn số liệu là holdings trực tiếp**, không phải `portfolio.v_allocation` — view đó dựng vị thế từ sổ giao dịch, mà sổ chưa có đường ghi. Engine domain **không đổi một dòng**; đợt 5 chỉ đổi nguồn ở tầng `src/data/`.
- **Target `60/30/10/0`, CASH band khoá `0–0`** — app đợt này không theo dõi tiền mặt, khoá để CASH luôn "đúng target" thay vì báo lệch mỗi tháng vì một nhóm app không quản. Hành vi này **đã đo**, không suy luận: [noCashProfile.test.ts](src/domain/noCashProfile.test.ts).
- **`ADJUSTMENT` sửa theo hướng tách 2 type** (`ADJUSTMENT_INCREASE`/`_DECREASE`), giữ bất biến `amount_vnd >= 0`, dấu nằm ở `type` như mọi type khác. Đã chốt nhưng **hoãn sang đợt 5** cùng lúc với sổ giao dịch (chưa có đường ghi nên chưa nổ). Chi tiết spec §11.1.
- **Một màn "nạp hàng loạt" hai adapter** (watchlist / CSV) thay vì hai màn riêng — đã chốt nhưng thuộc đợt 5, chưa làm.
- **`incomeReceivedVnd` = tổng DIVIDEND+INTEREST trong tháng của `asOf`; `contributionRecordedThisPeriod` = tổng DEPOSIT tháng ≥ Z** — đã chốt nhưng **chưa có hiệu lực**: không có sổ giao dịch thì cả hai đều tính ra 0/false. Alert `CONTRIBUTION_MISSING` bị **lọc khỏi UI** (không tắt trong engine) vì đợt này không có cách nào hành động; màn Cấu hình có ghi chú tĩnh nói thẳng.

## Cạm bẫy / lưu ý

- **`npm test` KHÔNG typecheck.** Member gõ sai tên field hai lần liền (`SellOrder.sellVnd` chứ không phải `amountVnd`; `BandStatus` là `'OK'` chứ không phải `'ON_TARGET'`) mà test vẫn chạy, một lần còn tưởng tìm được lỗi engine. **`npm run build` mới bắt** (`TS2339`) — đã đo xác nhận. Chạy build mỗi vòng.
- **Grep chuỗi tiếng Việt vào bundle hay ra kết quả sai** do chuẩn hoá Unicode NFC vs NFD của shell. `TỔNG DANH MỤC` có trong bundle mà grep báo thiếu. Dùng pattern ASCII-an toàn (`DANH M`, `ng target`).
- **`cd` trong Bash tool giữ nguyên giữa các lệnh.** Member `cd dist/assets` rồi lệnh sau tưởng `.gitignore` không tồn tại và `.env` bị commit — báo động sai hoàn toàn. Dùng đường dẫn tuyệt đối hoặc `cd` về root.
- **`seed.sql` dùng `on conflict do nothing`** ⇒ chạy lại **không** cập nhật giá trị đã có. Đổi target phải `update`, hoặc sửa trong màn Cấu hình.
- **`public/.assetsignore` là bắt buộc khi deploy** — wrangler 4.125 ghi file tạm vào trong `dist/assets/` rồi upload, làm `no-op-worker.js` bị phục vụ công khai. Kiểm bằng **nội dung** chứ không phải status code: SPA fallback làm mọi URL không tồn tại trả 200 (index.html).
- **`42501` từ REST API với anon key là ĐÚNG**, không phải lỗi — grant schema `portfolio` chỉ cho `authenticated`. Đừng "sửa" bằng cách grant cho `anon`.
- **`quantity = null` khác `0`**: null = chưa nhập, 0 = đã bán hết. `mapToSnapshot` coi `?? 0` rồi bỏ qua im lặng, nên [holdingsMap.ts](src/data/holdingsMap.ts) phải bắt riêng ca "đã bỏ tiền mà chưa nhập số lượng" và báo tên mã.
- **Lãi/lỗ crypto lẫn biến động tỷ giá** — `public.cryptos` không lưu tỷ giá lúc mua nên phải nhân tỷ giá hôm nay. Tỷ trọng KHÔNG ảnh hưởng. Tách được khi có sổ giao dịch (cột `fx_rate` đóng băng).
- **Test component viết SAU, không TDD** (pass ngay lần đầu). Chỉ logic thuần là TDD thật. **Chưa ai xem layout thật trên browser** — repo không có Playwright, member không tự cài. Kiểm bằng render test jsdom + buộc Vite transform.

## File quan trọng

- [docs/portfolio-db-setup.md](docs/portfolio-db-setup.md) — checklist Supabase. NewPL đã tự sửa thứ tự đúng: **chạy migration TRƯỚC rồi mới bật Exposed schemas** (ô chọn chỉ liệt kê schema đã tồn tại), đường dẫn là Integrations → Data API → Settings
- [spec §11 + §11.1](docs/superpowers/specs/2026-08-22-portfolio-rebalancing-design.md) — bảng 6 đợt đã cập nhật + lý do đổi thứ tự
- [src/data/holdingsMap.ts](src/data/holdingsMap.ts) — chỗ DUY NHẤT quy đổi đơn vị (nghìn đồng, USD, đồng/lượng)
- [src/data/portfolioView.ts](src/data/portfolioView.ts) — seam duy nhất nối holdings với engine; đổi nguồn ở đây khi có sổ giao dịch
- [src/domain/topUp.ts](src/domain/topUp.ts) — "cần bao nhiêu tiền mới để về target mà không bán gì"
- [src/domain/noCashProfile.test.ts](src/domain/noCashProfile.test.ts) — bằng chứng CASH target 0% không sinh lệnh bán ảo
- [src/lib/portfolioClassMeta.ts](src/lib/portfolioClassMeta.ts) + [src/index.css](src/index.css) — màu 4 nhóm, **hai nguồn song song, sửa một bên phải sửa bên kia**
- [supabase/migrations/2026-08-23-holdings-quantity.sql](supabase/migrations/2026-08-23-holdings-quantity.sql) — `stocks.quantity` + bảng `golds`

## Câu hỏi mở

- Sau khi push: có xoá branch `feat/portfolio-rebalancing` không?
- Đợt 4 làm providers giá (VNDIRECT / Binance / tỷ giá) hay nhảy sang sổ giao dịch trước? Hiện giá vẫn phải nhập tay, và `portfolioRepo` **chưa từng chạm PostgREST thật** ở chuỗi `.select('… group …')` — `group` là từ khoá SQL nhạy cảm, phương án dự phòng `group:group` ghi trong [.superpowers/sdd/2026-08-22-portfolio-dot1-2-migration-domain/task-15-brief.md](.superpowers/sdd/2026-08-22-portfolio-dot1-2-migration-domain/task-15-brief.md). Đừng đổi trước khi thấy lỗi thật.
