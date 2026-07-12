# Double-click ô lịch để đi xuống + hiện ghi chú sẵn ở tab Ngày — thiết kế

Ngày: 2026-07-12

## Bối cảnh
Trang **Kế hoạch** (`PlanPage`) có nhiều tầng thời gian, mỗi tầng một loại ô:

| Tab | Component ô | Ô đại diện | Đường đi xuống hiện có (click đơn) |
|-----|-------------|-----------|-----------------------------------|
| 5 Năm | `TodoCell` (qua `YearGrid`) | 1 năm | click nhãn → tab Năm |
| Năm | `TodoCell` (qua `MonthGrid`) | 1 tháng | click nhãn → tab Tháng (lưới ngày) |
| Tháng / Tuần | `DayCell` (qua `DayGrid`) | 1 ngày | click **số ngày** → tab Ngày |
| Ngày | `TodoItem` (qua `TodoList`) | 1 việc | — |

Hai điểm cần cải thiện:
1. Muốn đi xuống tầng con, người dùng phải bấm đúng cái **nhãn/số nhỏ** trong ô.
2. Ở tab **Ngày**, ghi chú (`todo.notes`) bị ẩn sau nút `▾`, phải bấm mới xem.

## Yêu cầu 1 — Double-click ô để đi xuống 1 tầng

Double-click vào **cả ô** đi xuống đúng **1 tầng**, áp dụng mọi tab có ô lịch:
- `TodoCell` (Năm / 5 Năm): double-click → gọi `onSelect()` (Năm→Tháng, 5Năm→Năm).
- `DayCell` (Tháng / Tuần): double-click → gọi `onOpenFull()` (mở tab Ngày của đúng ngày đó).

Đây là **lối tắt cộng thêm**, không thay thế: nút nhãn / số ngày (click đơn + truy cập
bằng bàn phím) giữ nguyên → không regression.

### Tránh xung đột với thao tác trong ô
Ô chứa nhiều phần tử tương tác (checkbox, nút sửa việc, nút ✕, form "+thêm việc",
nhãn/số ngày). Double-click lên các phần tử này **không** được kích hoạt đi xuống.

Handler gắn trên `div` bao ngoài của ô, bỏ qua nếu target nằm trong phần tử tương tác:

```tsx
function handleDoubleClick(e: React.MouseEvent) {
  if ((e.target as HTMLElement).closest('button, input, form')) return;
  onOpenFull(); // DayCell — hoặc onSelect() với TodoCell
}
```

### Phạm vi thay đổi
- Chỉ sửa `DayCell.tsx` và `TodoCell.tsx`: thêm `onDoubleClick` + guard trên container.
- **Không** sửa `PlanPage`, `DayGrid`, `MonthGrid`, `YearGrid` — callback `onOpenFull`/
  `onSelect` đã có sẵn và đã đi đúng 1 tầng.
- Phụ (tùy chọn): thêm `title="Bấm đúp để mở"` lên ô cho dễ khám phá.

## Yêu cầu 2 — Hiện ghi chú sẵn ở tab Ngày

`TodoItem`/`TodoList` dùng chung ở **2 nơi**: tab Ngày (`PlanPage`) và view Việc chính
(`AppPage`, 2 chỗ). Chỉ tab Ngày cần hiện ghi chú sẵn.

Thêm prop tùy chọn `defaultShowNotes?: boolean` chạy qua `TodoList → TodoItem`:
- `TodoItem`: `const [showNotes, setShowNotes] = useState(defaultShowNotes ?? false)` —
  chỉ đổi giá trị **khởi tạo** của state.
- `TodoList`: nhận `defaultShowNotes`, truyền xuống mỗi `TodoItem`.
- `PlanPage` (tab Ngày): truyền `defaultShowNotes` → ghi chú mở sẵn.
- `AppPage` (view Việc): **không truyền** → giữ nguyên (ẩn, bấm `▾` mới xem).

Nút `▾` vẫn còn ở tab Ngày → người dùng thu gọn từng việc được nếu muốn.

## Ngoài phạm vi
- Không đổi hành vi ghi chú của view Việc chính (`AppPage`).
- Không đụng logic điều hướng/tính kỳ trong `PlanPage`.
- Không thêm double-click cho `TodoItem` ở tab Ngày (việc đã có click sửa riêng).

## Kiểm thử
- `TodoCell`: double-click nền ô → gọi `onSelect`; double-click lên một việc → **không** gọi.
- `DayCell`: double-click nền ô → gọi `onOpenFull`; double-click lên một việc → **không** gọi.
- `TodoItem`: render với `defaultShowNotes` (và có `notes`) → ghi chú hiện ngay, không cần click;
  không truyền → ghi chú vẫn ẩn (giữ hành vi cũ).
- Chạy `npm test` + `npm run build`, xác nhận pass trước khi báo xong.
