# Thiết kế: Bảng mục tiêu chung + thống nhất ô lịch có checkbox/thêm/xóa/ngày

Ngày: 2026-07-11
Trạng thái: đã duyệt (NewPL) — sẵn sàng lập plan

## Bối cảnh

Trang **Kế hoạch** có 5 tầng thời gian: 5 Năm, Năm, Tháng, Tuần, Ngày.
Hiện trạng mỗi tầng render khác nhau:

- **Mục tiêu (Goal):** gắn cứng vào `horizon` + `period_key`, chỉ hiện đúng kỳ đang
  chọn → đổi tab là biến mất; tab Ngày không có mục tiêu.
- **5 Năm:** `PeriodCell` — chỉ số đếm `done/total` + tooltip goals, không liệt kê việc,
  không checkbox.
- **Năm:** `MonthCell`/`MonthGrid` — liệt kê việc trong tháng, **có checkbox** (chuẩn đẹp),
  nút `+N xem thêm`.
- **Tháng/Tuần:** `DayCell`/`DayGrid` — việc dạng chữ (không checkbox), click mở
  `DayPopover` để thêm/tick.
- **Ngày:** `TodoList` đầy đủ (checkbox + xóa + kéo-thả).

## Mục tiêu (5 yêu cầu của NewPL)

1. **Bảng mục tiêu chung** — luôn hiển thị ở TẤT CẢ các tab; chỉ mất khi bấm ✕ xóa.
2. **Lấy tab Năm làm chuẩn** — thống nhất UI các tab còn lại, có checkbox để tick việc.
3. **Thêm việc ngay tại ô** tháng và ô ngày.
4. **Dấu ✕ xóa** trên mỗi việc.
5. **Hiển thị ngày cụ thể `dd/mm`** trên mỗi việc (ở ô tháng và ô năm).

Không đổi schema DB. Không mở rộng ngoài 5 yêu cầu trên.

---

## 1. Bảng mục tiêu chung (global goal board)

### Mô hình dữ liệu — KHÔNG chạy migration
Bảng `goals` có `horizon` và `period_key` đều `NOT NULL` (check chỉ ràng buộc `horizon`
thuộc 4 giá trị; `period_key` là text tự do). Để mục tiêu thành danh sách phẳng dùng chung
mà **không cần chạy SQL trên Supabase**:

- **Ghi:** `useGoals.addGoal(title)` tự điền giá trị cố định thỏa ràng buộc cũ:
  `horizon:'year'`, `period_key:'global'`. Hai cột này trở thành "vô nghĩa" nhưng hợp lệ.
- **Đọc/hiển thị:** bỏ mọi lọc theo kỳ — lấy **toàn bộ** goals của user.
- Lý do chọn cách này: chạy được ngay lần đầu, không thao tác tay ngoài code
  (đúng chuẩn "usable first run"). Việc dọn schema (bỏ `NOT NULL`) để lần sau, không bắt buộc.

### Thay đổi type & hook
- `NewGoal` rút gọn còn `{ title: string }`.
- `useGoals.addGoal(input: NewGoal)` chèn kèm sentinel `horizon:'year'`, `period_key:'global'`.
- `updateGoal`/`deleteGoal` giữ nguyên. Realtime giữ nguyên (đã lọc theo `user_id`).

### Thay đổi UI
- Đổi `GoalList` → **`GoalBoard`**: bỏ prop `horizon`/`periodKey`; `onAdd(title)`.
  Hiển thị toàn bộ goals; ô nhập "Thêm mục tiêu…"; empty state "Chưa có mục tiêu nào.".
- `GoalItem` **giữ nguyên** (đã có checkbox tick + sửa tên tại chỗ + nút ✕ xóa).
- `PlanPage` render `GoalBoard` ở đầu trang cho **MỌI** `horizon`, kể cả `day`
  (hiện đang loại trừ `day`).

---

## 2. Thống nhất ô lịch — component `TodoCell` dùng chung

Trích một component trình bày thuần **`TodoCell`** dùng cho cả ô tháng (tab Năm) và ô năm
(tab 5 Năm) — tránh lặp code, "một component một trách nhiệm".

**`TodoCell` nhận:**
- `label` (vd "Tháng 08" / "Năm 2026"), `doneCount`, `totalCount`.
- `todos: Todo[]` đã sort.
- `onSelect()` — bấm nhãn để đi xuống tầng con.
- `onToggleTodo(id, done)`, `onDeleteTodo(id)`.
- `onAdd?(title)` — **tùy chọn**; có thì hiện ô "+ thêm việc" ở đáy ô, không có thì ẩn.
- `maxLines` (mặc định 6) — cắt bớt, nút `+N xem thêm`/`thu gọn` (state cục bộ trong ô).

**Mỗi dòng việc trong `TodoCell`:**
- Checkbox tick (dùng lại style checkbox hiện có của `MonthCell`).
- Tên việc (gạch ngang khi done).
- **`dd/mm`** ngày cụ thể (từ `todo.due_date`), màu phụ; việc không có `due_date` thì bỏ trống.
- Nút **✕** xóa (style giống ✕ của `GoalItem`: hover đỏ nhạt).

Hàm thuần format ngày: thêm `formatDayMonth(dueDate: string | null): string` trong
`src/lib/` (vd `dateLabel.ts`), trả `'dd/mm'` hoặc `''`. Có test.

### 5 Năm — ô năm liệt kê việc gần nhất
- Thêm hàm thuần **`buildYearCells(todos, fiveYearKey)`** (song song `buildMonthCells`),
  trả 5 `TodoCellData` — mỗi năm gồm việc có `due_date` trong năm đó, sort
  `sortByDoneThenOrder`, `doneCount`/`totalCount` theo **todo** (không trộn goals).
- `YearGrid` (thay `PeriodGrid`) render 5 ô, mỗi ô là `TodoCell` với `onAdd` **không truyền**
  (một năm quá rộng, không rõ ngày → chỉ liệt kê + tick + xóa). `onSelect` đi xuống tab Năm.
- Hiển thị `dd/mm` giúp phân biệt việc trong năm.

### Năm — ô tháng
- `MonthCell` refactor để render qua `TodoCell` (hoặc `MonthGrid` dùng thẳng `TodoCell`).
- Truyền `onAdd(title)` → thêm việc với `due_date` = **ngày 01 của tháng** (`YYYY-MM-01`).
- Thêm `onDeleteTodo` + `dd/mm` cho mỗi việc.

### Tháng/Tuần — ô ngày (bỏ popover)
- `DayCell` viết lại: bỏ `DayPopover`, đưa nội dung vào thẳng ô:
  - Số ngày ở đầu ô — **bấm số ngày** để nhảy vào tab Ngày (`onOpenFull`).
  - Danh sách việc: checkbox + tên + ✕ xóa (KHÔNG hiện `dd/mm` vì ô đã là 1 ngày cụ thể).
  - Đáy ô: ô "+ thêm việc" (`due_date` = đúng ngày của ô — logic cũ đã có).
  - `maxLines` + `+N xem thêm` tại chỗ.
- 7 cột giữ nguyên; ô cao lên theo nội dung.

---

## 3. Thêm việc tại ô (tổng hợp)

| Ô | `due_date` khi thêm |
|---|---|
| Ô ngày (Tháng/Tuần) | đúng ngày của ô (`YYYY-MM-DD`) — đã có |
| Ô tháng (Năm) | ngày 01 của tháng (`YYYY-MM-01`) |
| Ô năm (5 Năm) | **không** cho thêm |

Mặc định việc mới: `priority:'medium'`, `tags:[]`, `recurrence:'none'` (theo `handleAddOnDay`
hiện có tại `PlanPage`).

---

## 4. Dấu ✕ xóa từng việc

- Nút ✕ trên mỗi dòng việc ở `TodoCell` (ô tháng, ô năm) và `DayCell` (ô ngày).
- Gọi lên `removeTodo` sẵn có tại `AppPage.tsx` (đã kèm `confirm('Xóa việc này?')`).
- Thread prop `onDeleteTodo` qua `PlanPage` → `MonthGrid`/`YearGrid`/`DayGrid` → cell.

---

## 5. `dd/mm` trên mỗi việc

- Ô tháng + ô năm: hiện `dd/mm` từ `todo.due_date`.
- Ô ngày: bỏ (ô đã là ngày cụ thể).
- Không có `due_date`: không hiện.

---

## Dọn dẹp kèm theo (trong phạm vi)

- Xóa `PeriodGrid`, `PeriodCell`, `DayPopover` (thành không dùng).
- Gỡ trong `PlanPage`: nhánh `grid`/`yearOrFiveYearCells`, `countTodosInRange`,
  tooltip goals theo kỳ, prop `horizon`/`periodKey` truyền vào goal board.
- Số đếm ở ô **chỉ tính todo** (mục tiêu đã tách thành bảng riêng).

## Kiểm thử & xác minh

- Test thuần mới: `buildYearCells`, `formatDayMonth`. Cập nhật `monthCell.test.ts` nếu
  đổi chữ ký (`MonthCellData` → `TodoCellData`).
- Chạy `npm test` + `npm run build`, xác nhận pass thật trước khi báo xong.

## Ngoài phạm vi (YAGNI)

- Không đổi schema DB / migration.
- Không thêm việc ở ô năm.
- Không đổi kéo-thả, tag, priority, recurrence.
- Không đụng tab "Việc" (danh sách/bảng Kanban).

## Rủi ro / lưu ý

- **Sentinel goal** (`period_key:'global'`): nếu sau này bật lại phân kỳ mục tiêu sẽ cần
  migration. Ghi rõ trong comment để người sau hiểu.
- Ô ngày (7 cột) cao lên khi nhiều việc — dựa `maxLines` + `+N xem thêm` để không vỡ layout,
  nhất là mobile.
- Việc lặp (recurrence): tick done ở ô vẫn phải đi qua `toggleDone` (sinh kỳ sau) —
  `onToggleTodo` truyền xuống đã là `toggleDone`, giữ nguyên.
