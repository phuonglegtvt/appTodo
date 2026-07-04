# Todo App — Handoff cho Claude Code

Ứng dụng quản lý việc cá nhân. Thiết kế tối giản, có Dark Mode, responsive, tiếng Việt.
Stack đề xuất: **React + Tailwind CSS** (darkMode: 'class').

## File thiết kế (mở bằng trình duyệt để xem)
- `Ứng dụng Todo.dc.html` — canvas tổng, chứa TẤT CẢ màn hình:
  1. Đăng nhập (Google + magic link)
  2. Trang chính desktop (Light & Dark)
  3. Tổng quan Kanban (Light & Dark)
  4. Mobile + Form thêm/sửa + Empty state
  5. Dải thông báo lỗi
  6. Giải phẫu một dòng việc (anatomy)
  7. Design tokens (bảng màu, type, spacing, radius, shadow, tailwind.config)
- `Dashboard.dc.html` — layout trang chính (sidebar + danh sách).
- `Kanban.dc.html` — bảng Kanban theo cột trạng thái.
- `TaskRow.dc.html` — 1 dòng việc dạng danh sách.
- `KanbanCard.dc.html` — 1 thẻ việc trên bảng Kanban.

> Các file `.dc.html` là component; toàn bộ style là inline, theme điều khiển bằng CSS variables (xem block `--bg/--surface/...` trên phần tử bao ngoài). Khi code lại bằng React, ánh xạ các biến này sang Tailwind theme tokens (xem section 07 trong file canvas).

## Design tokens (tóm tắt)
- Font: Plus Jakarta Sans (UI), JetBrains Mono (mã).
- Accent/primary: `#5B57E0` (light) · `#837FF2` (dark).
- Ưu tiên: Cao `#E5484D` · Trung bình `#EAB308` · Thấp `#12A150`. Quá hạn = đỏ.
- Bo góc: sm 8 / md 10 / lg 12 / xl 16 / full 999.
- Spacing base 4px (1..8 = 4..32).
- Full `tailwind.config.js` extend nằm ở cuối file canvas (section 07).

## Yêu cầu chức năng chính
- Smart Views: Hôm nay / Sắp tới / Tất cả / Đã xong.
- Tìm kiếm; lọc theo trạng thái / nhãn / ưu tiên.
- Thêm việc nhanh (chỉ tiêu đề).
- Dòng việc: checkbox (xong → gạch ngang + mờ), tiêu đề, hạn chót (quá hạn màu đỏ),
  nhãn ưu tiên theo màu, chip tags, nút Sửa/Xóa, tay cầm kéo-thả sắp xếp.
- Form thêm/sửa: tiêu đề (bắt buộc), ghi chú, date picker, ưu tiên, nhiều tags, Lưu/Hủy.
- Empty state thân thiện; error banner (mất mạng / lưu thất bại).
- Dark Mode toggle + responsive (desktop + mobile).
