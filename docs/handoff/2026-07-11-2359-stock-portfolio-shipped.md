# Handoff — Danh mục cổ phiếu tích sản ĐÃ MERGE + DEPLOY (2026-07-11 23:59)

**Tóm tắt:** Đã hiện thực xong tính năng "Quản lý danh mục cổ phiếu" theo spec, review sạch, merge vào master và push (Netlify auto-deploy). Còn 2 việc thủ công của NewPL + 1 follow-up tuỳ chọn.

## Trạng thái hiện tại
- **Feature code-complete, đã merge master** (merge commit `69ba7a0`, --no-ff), **push origin** (`7df2258..69ba7a0`) → Netlify auto-deploy production.
- Master sau merge: **`npm test` 104/104 pass**, **`npm run build` sạch** (đã chạy kiểm chứng thật trước khi push).
- Nhánh `feat/stock-portfolio` đã xoá (local; chưa từng push riêng).
- **CHƯA verify runtime thật** 2 điểm (test thuần không bắt được) — xem "Cạm bẫy".

## Đang làm dở
- Không còn việc code dở. Tất cả 9 task + đổi nguồn giá đã đóng, review clean.

## Bước tiếp theo (thủ công — NewPL làm, em chưa làm tự động được)
1. **Apply migration Supabase:** mở Dashboard → SQL Editor → chạy [supabase/migrations/2026-07-11-stocks.sql](supabase/migrations/2026-07-11-stocks.sql). **Chưa chạy thì trang Cổ phiếu báo lỗi "table không tồn tại"** (giống bug goals trước đây).
2. **Test trên browser production** sau khi deploy xong:
   - Thêm mã ACB (nhóm Cân bằng, giá ngưỡng `30.1`, cổ tức `700`, số tiền `10000000`) → cột **Tỷ suất phải ≈ 2.3%**.
   - Bấm **Cập nhật giá** + mở DevTools:
     - **CORS VNDirect:** giá điền vào = OK. Nếu Console báo lỗi CORS → đổi nguồn (nhập tay vẫn chạy, không nuốt lỗi).
     - **Đơn vị giá:** giá lấy về phải cùng cỡ giá ngưỡng (**nghìn đồng**, ~24 chứ không phải 24000). Nếu ra 24000 → sửa `fetchPrices` chia 1000.
3. **Follow-up tuỳ chọn** (review Important, không chặn): đổi `fetchPrices` từ `Promise.all` sang `Promise.allSettled` để 1 mã lỗi không làm hỏng cả lần cập nhật + báo rõ mã lỗi.

## Quyết định & lý do
- **Nguồn giá đổi TCBS → VNDirect dchart** — vì `apipubaws.tcbs.com.vn/stock-insight` trả **404 toàn bộ** (service chết, đã probe node). VNDirect `dchart-api.vndirect.com.vn/dchart/history?symbol=X&resolution=D&from&to` trả `{s,t,c,o,h,l}`, lấy `c` cuối = giá mới nhất, đơn vị nghìn đồng. Contract `fetchPrices(tickers)→Record<ticker,price>` giữ nguyên nên StocksPage không đổi.
- **Merge thẳng master + push** (NewPL chọn), dù CORS/đơn vị giá chưa kiểm thật — vì phần cốt lõi (thêm/sửa/xóa, tính tỷ suất/tỷ trọng/so khẩu vị, đồng bộ, nhập tay) chạy đầy đủ không cần nguồn giá; lỗi giá có ErrorBanner rõ ràng, không nuốt.
- **Tách `parseVnNumber` ra `src/lib/parseNumber.ts`** (pre-flight review) thay vì lặp `toNum` trong StockForm + StockRow.
- **PortfolioSummary: mục tiêu vẽ bằng vạch mốc dọc** tại target% (không phải thanh mờ nằm dưới) — vì thanh đậm phủ mất mốc khi thực tế > mục tiêu.

## Cạm bẫy / lưu ý
- **Đơn vị giá VNDirect chưa xác nhận thật** — nếu API trả đồng thay nghìn đồng thì `isBelowThreshold` + hiển thị giá sai. Test thuần không bắt được, phải chạy thật (xem bước 2).
- **CORS là rủi ro thật** — probe bằng node BỎ QUA CORS nên không kết luận được; chỉ browser thật mới biết VNDirect có gửi `Access-Control-Allow-Origin` không.
- `fetchPrices` hiện `Promise.all` fail-fast: 1 mã HTTP lỗi → cả batch reject, không mã nào được cập nhật (lỗi vẫn hiện banner, không nuốt).
- Bảng dùng cột `"group"` (reserved SQL) — phải quote trong mọi SQL.
- `sort_order` không set khi insert (mặc định DB = 0) → thứ tự trong nhóm không ổn định giữa các lần load. Cosmetic, đã defer.

## File quan trọng
- [docs/superpowers/specs/2026-07-11-stock-portfolio-design.md](docs/superpowers/specs/2026-07-11-stock-portfolio-design.md) — spec (nguồn sự thật)
- [docs/superpowers/plans/2026-07-11-stock-portfolio.md](docs/superpowers/plans/2026-07-11-stock-portfolio.md) — plan triển khai (9 task)
- [supabase/migrations/2026-07-11-stocks.sql](supabase/migrations/2026-07-11-stocks.sql) — migration CẦN CHẠY TAY
- [src/lib/stockPrice.ts](src/lib/stockPrice.ts) — lấy giá VNDirect (điểm cần verify CORS + đơn vị)
- [src/lib/stockCalc.ts](src/lib/stockCalc.ts) — logic thuần có test
- [src/components/StocksPage.tsx](src/components/StocksPage.tsx) — trang chính gộp mọi thứ
- [.superpowers/sdd/progress.md](.superpowers/sdd/progress.md) — ledger tiến độ đầy đủ (gitignored)

## Câu hỏi mở
- Kết quả test browser (CORS + đơn vị giá) — chờ NewPL báo; nếu lệch thì sửa `fetchPrices`.
- Có làm follow-up `Promise.allSettled` không.
