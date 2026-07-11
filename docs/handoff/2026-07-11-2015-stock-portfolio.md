# Handoff — Tính năng danh mục cổ phiếu tích sản (2026-07-11 20:15)

**Tóm tắt:** Brainstorm xong + đã chốt & commit spec thiết kế cho tính năng mới
"Quản lý danh mục cổ phiếu" (theo mẫu bảng tích sản AzFin, có cột số tiền đã đầu
tư). Chưa viết code, chưa lập plan.

## Trạng thái hiện tại
- Đã chạy skill `superpowers:brainstorming`, hỏi rõ phạm vi với anh (5 câu).
- Spec đã ghi và **đã commit** vào git:
  [docs/superpowers/specs/2026-07-11-stock-portfolio-design.md](docs/superpowers/specs/2026-07-11-stock-portfolio-design.md)
- Chưa động vào code. Chưa chạy `npm test` / `npm run build` (chưa có gì mới để chạy).

## Đang làm dở
- Đang ở bước "User review spec" của quy trình brainstorming. Anh gõ `/handoff`
  ngắt giữa chừng ngay sau khi em commit spec.
- **Chưa hỏi anh review lại file spec**, và **chưa chuyển sang `writing-plans`**.

## Bước tiếp theo
1. Nhờ anh đọc lại file spec, xác nhận OK hay cần sửa.
2. Nếu OK → chạy skill `superpowers:writing-plans` để lập kế hoạch triển khai chi tiết.
3. Rồi mới bắt đầu code theo plan (TDD cho logic thuần trước).

## Quyết định & lý do (đã chốt với anh)
- **Mục đích:** vừa watchlist tham khảo (3 nhóm) vừa đánh dấu đã mua (số tiền đầu tư).
- **Cột dữ liệu:** Mã, Tên công ty, Nhóm, Giá ngưỡng TS, Giá bảo vệ, Cổ tức, Tỷ
  suất (tính, không lưu), Số tiền đã đầu tư.
- **Tổng hợp:** tổng vốn + tỷ trọng 3 nhóm + so với khẩu vị rủi ro gợi ý AzFin.
- **Đơn vị (đã xác nhận):** giá = nghìn đồng; cổ tức & số tiền đầu tư = đồng.
  Tỷ suất = `dividend / (price_threshold × 1000)` (khớp ACB 700/30,1k ≈ 2,3%).
- **3 khẩu vị rủi ro (hàng trên ảnh AzFin):** Tấn công 30/30/40, Cân bằng
  20/40/40, Phòng thủ 10/40/50.
- **Lấy giá:** anh chọn "thử gọi trực tiếp từ trình duyệt". Phương án build đã
  chốt = **A** (bảng gom nhóm + nút "Cập nhật giá", gọi nguồn CORS như TCBS).

## Cạm bẫy / lưu ý
- **CORS là rủi ro thật.** Frontend gọi thẳng API giá VN thường bị chặn; không có
  API miễn phí chính thức. Khi code `stockPrice.ts` phải **kiểm chứng CORS thật**;
  nếu hỏng thì báo `ErrorBanner` rõ ràng + giữ nhập tay, KHÔNG nuốt lỗi im lặng
  (đúng nguyên tắc CLAUDE.md).
- Phase 1 = không server tự viết → bám gọi trực tiếp/Supabase, không dựng backend.
- Bảng `stocks` phải có `replica identity full` + vào publication realtime giống
  todos/goals thì đồng bộ đa thiết bị mới đúng.

## File quan trọng
- [docs/superpowers/specs/2026-07-11-stock-portfolio-design.md](docs/superpowers/specs/2026-07-11-stock-portfolio-design.md) — spec đầy đủ (nguồn sự thật)
- [src/hooks/useGoals.ts](src/hooks/useGoals.ts) — khuôn mẫu để viết `useStocks`
- [supabase/migrations/2026-07-10-goals.sql](supabase/migrations/2026-07-10-goals.sql) — khuôn mẫu migration idempotent
- [src/pages/AppPage.tsx](src/pages/AppPage.tsx) + [src/components/Sidebar.tsx](src/components/Sidebar.tsx) — chỗ thêm trang `stocks`

## Câu hỏi mở
- Chờ anh review spec trước khi lập plan. Không còn quyết định lớn nào treo.
