# Sửa việc từ ô lịch (view Kế hoạch) — thiết kế

Ngày: 2026-07-12

## Vấn đề
Ở view **Việc**, click dòng việc mở form sửa (TodoItem). Nhưng ở view **Kế hoạch**
(lịch), các ô ngày/tháng/năm dùng `DayCell`/`TodoCell` chỉ có checkbox toggle + nút ✕
xóa — **không có đường vào sửa**. Click tên việc trong ô không phản ứng.

## Giải pháp: modal sửa dùng chung
Ô lịch quá nhỏ để nhét form inline → dùng một hộp thoại (modal) căn giữa màn hình,
dùng chung cho mọi tầng lịch (Tháng/Tuần/Năm/5 Năm).

### Component mới — `TodoEditModal.tsx`
- Overlay nền mờ + panel căn giữa.
- Trường sửa giống form ở view Việc: tiêu đề, ghi chú, ưu tiên (priority), hạn
  (due_date), lặp lại (recurrence — tự khóa khi chưa có hạn), nhãn (tags).
- Nút **Lưu** / **Hủy** / **Xóa**. Đóng khi: bấm Hủy, bấm nền mờ, hoặc nhấn `Esc`.
- Props: `todo`, `onSave(id, patch)`, `onDelete(id)`, `onClose`.
- Quy tắc giữ nguyên như TodoItem: xóa hạn → recurrence về `'none'`; tiêu đề rỗng
  không lưu.

### Luồng dữ liệu
- `PlanPage` giữ state `editingTodo: Todo | null`; khác `null` → render modal.
- Thêm callback `onEditTodo(todo)` luồn qua grid trung gian:
  - `DayGrid → DayCell` (Tháng/Tuần)
  - `MonthGrid / YearGrid → TodoCell` (Năm / 5 Năm)
- Trong `DayCell`/`TodoCell`: tên việc đổi thành nút bấm được → gọi `onEditTodo(t)`.
  Checkbox và nút ✕ là phần tử riêng, không kích hoạt sửa.
- `onUpdateTodo`/`onDeleteTodo` đã có sẵn ở PlanPage → modal nối thẳng, không thêm hook.

## Ngoài phạm vi
- Không gộp form lặp giữa `TodoItem`/`TodoForm`/modal lần này (tránh mở rộng phạm vi).

## Kiểm thử
- Test nhẹ cho `TodoEditModal`: render, đổi tiêu đề, bấm Lưu → gọi `onSave` với patch đúng;
  bấm Hủy/Esc → gọi `onClose`.
- Chạy `npm test` + `npm run build` xác nhận pass trước khi báo xong.
