# Handoff — Tiền mặt, sổ giao dịch Crypto & Cổ phiếu, nhóm Dài hạn (2026-11-26 20:26)

**Tóm tắt:** Dựng lại môi trường trên máy mới (MacBook `adamle`), rồi làm và deploy production 5 tính năng: tiền mặt ở màn Cấu hình, sổ giao dịch Crypto, nhóm Cổ phiếu "Đầu tư dài hạn" + sửa Mã/Tên/Nhóm, lịch sử giao dịch Cổ phiếu, nút ▲▼ đổi vị trí bảng (đồng bộ qua Supabase).

## Trạng thái hiện tại
- **Tất cả đã merge `master`, push `origin/master` (HEAD `2676322`) và deploy** https://apptodo.phuonglegtvt92.workers.dev. Verify bằng nội dung bundle production (grep chuỗi đặc trưng), không chỉ status code.
- `npm test` **696/696 pass**, `npm run build` OK.
- **4 migration đã chạy trên Supabase** (NewPL chạy tay trong SQL Editor, đã verify bằng REST + anon key — bảng/hàm tồn tại, RLS chặn khi chưa đăng nhập):
  - [2026-11-26-cash-on-hand.sql](../../supabase/migrations/2026-11-26-cash-on-hand.sql)
  - [2026-11-26-crypto-transactions.sql](../../supabase/migrations/2026-11-26-crypto-transactions.sql)
  - [2026-11-26-stocks-longterm.sql](../../supabase/migrations/2026-11-26-stocks-longterm.sql) (gồm ràng buộc nhóm `longterm` + bảng `stock_transactions`)
  - [2026-11-26-user-prefs.sql](../../supabase/migrations/2026-11-26-user-prefs.sql)
- ⚠️ **Chưa ai thử thao tác thật trên app đã đăng nhập** (ghi giao dịch, hoàn tác, chuyển mã sang Dài hạn, ▲▼ đồng bộ hai máy). Claude không đăng nhập thay người dùng. Ràng buộc `stocks_group_check` mới chưa verify trực tiếp được (cần đăng nhập).
- `npm run lint` **hỏng từ trước** (repo không có file cấu hình ESLint flat config) — không phải do session này.

## Bước tiếp theo
1. NewPL thử trên production: ghi 1 lệnh Mua crypto + 1 lệnh Mua cổ phiếu → bảng tự cộng dồn → bấm Hoàn tác về như cũ; ✎ một mã đổi Nhóm sang Dài hạn; ▲▼ trên máy này rồi mở máy khác xem thứ tự.
2. Lỗi gì thì sửa theo thông báo; các hàm rpc đã trả message tiếng Việt.
3. (Tuỳ chọn) Thêm cấu hình ESLint để `npm run lint` chạy lại được.

## Quyết định & lý do
- **Tiền mặt = một cột `portfolio.settings.cash_on_hand_vnd`, tính vào tỷ trọng** (NewPL chọn). Không đi qua `portfolio.transactions` vì sổ đó chưa có đường ghi; `toAllocationRows` sinh một dòng CASH `earmarked_for = null`. Màn Cấu hình cảnh báo khi mục tiêu CASH còn 0%.
- **Sổ giao dịch = "cộng dồn lên số cũ"** (NewPL chọn) cho cả crypto và cổ phiếu: dòng `cryptos`/`stocks` vẫn là nơi giữ số đang có; mỗi giao dịch lưu trạng thái TRƯỚC/SAU. Hoàn tác = trả về TRƯỚC (tính ngược lệnh bán hết là bất khả). Không phải nhập lại lịch sử cũ.
- **Ghi qua rpc Postgres** (`record_*_transaction`, `undo_*_transaction`) để "cập nhật tài sản + thêm giao dịch" nguyên tử, kèm kiểm tra tài sản vẫn đúng trạng thái TRƯỚC (chống ghi đè từ máy khác). Phép tính nằm ở TS thuần ([cryptoTransaction.ts](../../src/lib/cryptoTransaction.ts), [stockTransaction.ts](../../src/lib/stockTransaction.ts)), DB chỉ ghi + chặn. Chỉ hoàn tác được giao dịch MỚI NHẤT mỗi tài sản, và chỉ khi tài sản chưa bị sửa tay.
- **Crypto nhập VND + giá USD** (NewPL chọn): giá TB USD bình quân gia quyền, vốn VND cộng thẳng — không phụ thuộc tỷ giá hôm nay. Bán: giá TB giữ nguyên, vốn giảm theo tỷ lệ, ra lãi/lỗ đã chốt.
- **Cổ phiếu giữ đơn vị nghìn đồng** như cả tab; số lượng phải nguyên. Bảng `stocks` không có cột giá TB → "Giá vốn TB" là cột TÍNH = `invested_amount / quantity`.
- **Nhóm `longterm` tính chung vào khẩu vị rủi ro** (NewPL chọn, 20% mọi khẩu vị): Tấn công 25/25/30/20 · Cân bằng 15/35/30/20 · Phòng thủ 5/35/40/20. Tách type `RiskProfile` (3 khẩu vị) khỏi `StockGroup` (4 nhóm).
- **Thứ tự bảng nhóm lưu ở `public.user_prefs.stock_group_order`** (đồng bộ máy). localStorage chỉ còn là bản đệm vẽ lần đầu; máy chưa có dòng DB thì đẩy bản đệm lên. Nút ▲▼ đổi với bảng ĐANG HIỆN liền kề (bảng trống bị ẩn).

## Cạm bẫy / lưu ý
- **Máy mới không có `brew`.** Node 22 cài ở `~/.local/node`, `gh` ở `~/.local/bin` (PATH thêm trong `~/.zprofile`). Lệnh trong Bash của Claude phải tự `export PATH="$HOME/.local/bin:$HOME/.local/node/bin:$PATH"`. `.nvmrc` ghi 20 nhưng 22 chạy ổn.
- **Đăng nhập đã lưu trên máy này:** git push qua `gh auth setup-git` (tài khoản `phuonglegtvt`), Cloudflare qua `wrangler login`. Deploy: `git push origin master && npm run build && npx wrangler deploy`.
- `git config user.*` đặt **cục bộ cho repo** = `phuonglegtvt` (máy chưa có cấu hình global).
- **`.env` không có trên GitHub** — đã tạo tay (URL + anon key dự án `hnohjmonscdbqbqwvxqs`). Máy khác phải tạo lại.
- Migration crypto tạo hàm `public.crypto_num_gan` mà migration cổ phiếu dùng lại → thứ tự chạy: crypto trước stocks.
- Verify deploy bằng **nội dung bundle**; CDN có lúc trả bản cũ vài giây sau deploy — thêm `?v=$RANDOM` khi curl.
- Code gọi Supabase chưa có cột/bảng mới sẽ vỡ cả tab (select liệt kê cột) → luôn chạy migration TRƯỚC khi deploy.

## File quan trọng
- [src/lib/cryptoTransaction.ts](../../src/lib/cryptoTransaction.ts) / [src/lib/stockTransaction.ts](../../src/lib/stockTransaction.ts) — phép tính mua/bán, có test
- [src/hooks/useCryptoTransactions.ts](../../src/hooks/useCryptoTransactions.ts) / [src/hooks/useStockTransactions.ts](../../src/hooks/useStockTransactions.ts) — gọi rpc
- [src/components/CryptoTransactionForm.tsx](../../src/components/CryptoTransactionForm.tsx), [StockTransactionForm.tsx](../../src/components/StockTransactionForm.tsx) — form có xem trước
- [src/lib/latestTx.ts](../../src/lib/latestTx.ts) — chọn giao dịch hoàn tác được (dùng chung)
- [src/lib/stockCalc.ts](../../src/lib/stockCalc.ts) — `STOCK_GROUPS`, `TARGET_PROFILES` 4 nhóm
- [src/lib/groupOrder.ts](../../src/lib/groupOrder.ts), [src/hooks/useStockGroupOrder.ts](../../src/hooks/useStockGroupOrder.ts) — thứ tự bảng ▲▼ + đồng bộ
- [src/data/holdingsMap.ts](../../src/data/holdingsMap.ts) — dòng CASH từ tiền mặt nhập tay
- [src/components/TargetSettingsForm.tsx](../../src/components/TargetSettingsForm.tsx) — ô "Tiền mặt đang có"

## Câu hỏi mở
- `.claude/launch.json` (cấu hình dev server cho khung trình duyệt của app, đường dẫn Node tuyệt đối của máy này) đang untracked — có muốn commit không? Hiện để ngoài repo vì phụ thuộc máy.
