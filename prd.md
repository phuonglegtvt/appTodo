# PRD — Ứng dụng Todo cá nhân

> Product Requirements Document. Tài liệu này mô tả **cái gì** cần xây và **vì
> sao**. Chi tiết kỹ thuật xem `docs/superpowers/specs/2026-07-04-todo-app-design.md`.

- **Phiên bản:** 1.0 (Phase 1 / MVP)
- **Ngày:** 2026-07-04
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

## 6. Ngoài phạm vi (Phase 2+)
Nhập ngôn ngữ tự nhiên, việc con, lặp định kỳ, nhắc nhở/thông báo, Pomodoro,
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
