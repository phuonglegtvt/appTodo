# PRD — Ứng dụng Todo cá nhân

> Product Requirements Document. Tài liệu này mô tả **cái gì** cần xây và **vì
> sao**. Chi tiết kỹ thuật Phase 1 xem
> `docs/superpowers/specs/2026-07-04-todo-app-design.md`; Phase 2a xem
> `docs/superpowers/specs/2026-07-05-recurring-tasks-design.md`.

- **Phiên bản:** 1.2 (Phase 1 hoàn tất / Phase 2a đang triển khai / Phase 3 đang triển khai)
- **Ngày:** 2026-07-05
- **Chủ sản phẩm:** phuonglegtvt92@gmail.com

## 1. Tổng quan

Web app giúp một người dùng cá nhân quản lý công việc hằng ngày, đồng bộ trên
nhiều thiết bị (máy tính + điện thoại). Mục tiêu: nhanh, gọn, dễ dùng, không mất
dữ liệu.

## 2. Đối tượng & bài toán

- **Người dùng:** cá nhân muốn ghi lại và theo dõi việc cần làm.
- **Vấn đề:** cần một chỗ tin cậy để quản lý việc, xem được ở mọi thiết bị, phân
  loại theo độ ưu tiên/hạn chót, và tìm lại việc nhanh.

## 3. Mục tiêu & chỉ số thành công

| Mục tiêu | Chỉ số |
|----------|--------|
| Ghi việc nhanh | Thêm 1 việc ≤ 5 giây, ≤ 3 thao tác |
| Không mất dữ liệu | Reload / đổi thiết bị vẫn thấy đủ việc |
| Đồng bộ | Thay đổi ở thiết bị A hiện ở thiết bị B trong vài giây |
| Dùng được mọi nơi | Chạy tốt trên màn hình điện thoại và máy tính |

## 4. Phạm vi Phase 1 (yêu cầu chức năng)

### 4.1 Xác thực
- FR-1: Đăng nhập bằng **Google**.
- FR-2: Đăng nhập bằng **email magic link** (không mật khẩu).
- FR-3: Đăng xuất.
- FR-4: Chưa đăng nhập chỉ thấy trang đăng nhập; dữ liệu tách riêng theo người dùng.

### 4.2 Quản lý việc (CRUD)
- FR-5: Thêm việc (tối thiểu: tiêu đề).
- FR-6: Sửa việc (tiêu đề, ghi chú, hạn chót, ưu tiên, nhãn).
- FR-7: Xóa việc (có xác nhận).
- FR-8: Đánh dấu hoàn thành / bỏ hoàn thành.

### 4.3 Thuộc tính việc
- FR-9: **Hạn chót** (due date); hiển thị việc quá hạn nổi bật.
- FR-10: **Độ ưu tiên** cao / trung bình / thấp, phân biệt bằng màu.
- FR-11: **Nhãn/tag**: gắn nhiều nhãn cho một việc.

### 4.4 Tìm, lọc, sắp xếp
- FR-12: **Tìm** theo từ khóa trong tiêu đề.
- FR-13: **Lọc** theo trạng thái (đang làm / đã xong / tất cả), theo nhãn, theo ưu tiên.
- FR-14: **Kéo-thả** sắp xếp lại thứ tự việc.
- FR-15: **Smart views:** Hôm nay / Sắp tới / Tất cả / Đã xong.

### 4.5 Trải nghiệm
- FR-16: **Dark mode**, ghi nhớ lựa chọn.
- FR-17: **Responsive** (điện thoại + máy tính).
- FR-18: **Đồng bộ realtime** giữa các thiết bị.

## 5. Yêu cầu phi chức năng
- NFR-1: Lỗi (mất mạng, đăng nhập/lưu thất bại) phải báo rõ cho người dùng — không nuốt lỗi im lặng.
- NFR-2: Tải trang chính ban đầu nhanh (mục tiêu < 2s trên mạng thường).
- NFR-3: Bảo mật dữ liệu bằng Row Level Security; không lộ khóa nhạy cảm ở frontend.
- NFR-4: Code chia module nhỏ, có test cho phần logic.

## 6. Định hướng Phase 2

Phase 1 là nền tảng CRUD + đồng bộ. Phase 2 mở rộng theo tầm nhìn: app phải cho
người dùng **nhìn vào là biết ngay** mục tiêu dài hạn của mình và việc cần làm
hôm nay bám vào mục tiêu đó ra sao — "mục tiêu dài hạn là kim chỉ nam cho hành động".

### 6.1 Phase 2a — Việc lặp cố định ngày (đang triển khai)
Giá trị cao nhất, độc lập với hệ thống mục tiêu, làm trước:
- FR-19: Gắn quy tắc **lặp lại** (hàng tuần / hàng tháng / hàng năm) cho một việc.
- FR-20: Đánh dấu hoàn thành một việc lặp → **tự động tạo việc cho kỳ tiếp
  theo** (VD: đóng thẻ tín dụng VPBank ngày 15 hàng tháng → tick xong → tự sinh
  việc ngày 15 tháng sau). Dừng lặp bằng cách tự xóa việc của kỳ kế tiếp — không
  cần thao tác "hủy lặp" riêng.
- FR-21: Việc đã đánh dấu hoàn thành **ẩn khỏi** các view đang làm (Hôm nay/Sắp
  tới/Tất cả) nhưng vẫn xem lại được ở view "Đã xong" — không xóa khỏi dữ liệu
  (giữ nguyên NFR không mất dữ liệu).

Thiết kế chi tiết: `docs/superpowers/specs/2026-07-05-recurring-tasks-design.md`.

### 6.2 Phase 2b — Mục tiêu theo tầng thời gian (kế hoạch)
- FR-22: Tạo **mục tiêu** gắn với một tầng thời gian (horizon): 5 năm / năm /
  tháng / tuần, mỗi mục tiêu ứng với một kỳ cụ thể (VD mục tiêu năm 2026, mục
  tiêu tháng 2026-07).
- FR-23: Gắn một việc với một mục tiêu (**tùy chọn**, không bắt buộc — việc vặt
  không thuộc mục tiêu nào vẫn hợp lệ, giữ tiêu chí thêm việc nhanh).
- FR-24: Xem việc/mục tiêu theo view tổng hợp từng tầng thời gian (Ngày → Tuần
  → Tháng → Năm → 5 năm), giúp nhìn một lúc biết mục tiêu dài hạn đang được việc
  hằng ngày phục vụ ra sao.

Mô hình mục tiêu **phẳng** (không lồng cây nhiều tầng ở bản đầu) để giữ độ phức
tạp vừa phải; có thể nâng cấp lên cây lồng nhau thật sự nếu nhu cầu phát sinh.

### 6.3 Phase 3 — Cân bằng danh mục đầu tư (đang triển khai)

Tab `portfolio`: theo dõi danh mục 4 nhóm tài sản (Stocks 50% / Crypto 20% /
Gold 15% / Cash 15%), so tỷ trọng thực tế với mục tiêu, và mỗi tháng sinh một
"kế hoạch hành động" nói rõ tháng này cần mua gì, bao nhiêu, mã nào.

- Không tự đặt lệnh mua/bán. App chỉ đưa đề xuất; người dùng tự thực hiện rồi ghi lại.
- Yêu cầu & thiết kế đầy đủ:
  `docs/superpowers/specs/2026-08-22-portfolio-rebalancing-design.md`

### 6.4 Ngoài phạm vi (chưa có kế hoạch)
Nhập ngôn ngữ tự nhiên, việc con (subtask), nhắc nhở/thông báo đẩy, Pomodoro,
habit tracker, tính năng AI, cộng tác nhiều người.

## 7. Công nghệ
- Frontend: React + Vite + TypeScript + Tailwind CSS.
- Backend: Supabase (Auth, Postgres, Realtime).
- Kiểm thử: Vitest.
- Thiết kế UI: dựng bằng Claude Design rồi hiện thực trong React + Tailwind
  (xem mục 7 của spec thiết kế).

## 8. Câu hỏi mở / giả định
- Giả định dùng gói Supabase miễn phí là đủ cho nhu cầu cá nhân.
- Ngôn ngữ giao diện: tiếng Việt (Phase 1).