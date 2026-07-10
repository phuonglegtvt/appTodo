# Thiết kế: Lịch ngày kiểu Google Calendar + thêm việc nhanh (Kế hoạch)

Ngày: 2026-07-10
Phạm vi: tab **Kế hoạch**, tầng **Tháng** và **Tuần**.

## Vấn đề

Ở tab Kế hoạch, khi xem tầng Tháng/Tuần, mỗi ô ngày hiện nhỏ (chỉ số ngày + đếm
`x/y`) và click vào ô chỉ để đi xuống tầng Ngày. Người dùng **không thêm được việc
trực tiếp vào một ngày** ngay trên lịch, và ô quá nhỏ khó nhìn tổng quan việc trong
ngày.

## Mục tiêu

1. Ô ngày to lên (~4 lần chiều cao hiện tại) và **hiển thị danh sách việc bên trong
   ô** (kiểu Google Calendar): số ngày + vài tiêu đề việc đầu + dòng "+N việc".
2. **Click ô ngày → mở popover ngay tại ô** để thêm việc vào đúng ngày đó, tích
   đánh dấu xong, và có lối xuống tầng Ngày để quản lý đầy đủ.

## Ngoài phạm vi (YAGNI)

- Không đổi tầng **Năm / 5 Năm** — vẫn dùng `PeriodGrid`/`PeriodCell` cũ, click để
  drill xuống tầng con.
- Popover **không** làm sửa tiêu đề / kéo-thả / đổi ưu tiên / xóa. Các thao tác đầy
  đủ vẫn nằm ở tầng Ngày (bấm "Mở ngày →").
- Việc thêm từ popover mặc định: `priority = 'medium'`, `tags = []`,
  `recurrence = 'none'`. Muốn tuỳ chỉnh thì dùng form đầy đủ ở tầng Ngày / tab Việc.

## Kiến trúc

Tách riêng lưới ngày để không làm `PeriodCell` chung phình to (giữ nguyên tắc "mỗi
component một trách nhiệm"):

- `PeriodGrid` + `PeriodCell` — **giữ nguyên**, chỉ phục vụ tầng Năm/5 Năm.
- `DayGrid` (mới) — lưới 7 cột cho tầng Tháng/Tuần; nhận `leadingBlanks`, danh sách
  ô ngày, ngày đang mở popover (`openDay`) và các handler; render `DayCell`.
- `DayCell` (mới) — 1 ô ngày cao: số ngày + danh sách tiêu đề việc (N dòng đầu +
  "+N việc"); khi là ô đang mở thì render `DayPopover` neo tại ô.
- `DayPopover` (mới) — ô nổi: tiêu đề "Việc ngày DD/MM", ô nhập thêm việc
  (Enter/nút để thêm), danh sách việc trong ngày kèm ô tích đánh dấu xong, nút
  "Mở ngày →". Đóng khi bấm ra ngoài hoặc nhấn Esc.

## Luồng dữ liệu

- [AppPage.tsx](../../../src/pages/AppPage.tsx) truyền thêm `onAddTodo` (bọc
  `addTodo` của `useTodos`) vào `PlanPage`. `onToggleTodo` đã có sẵn.
- `PlanPage` giữ state mới `openDay: string | null` — ngày (dạng `YYYY-MM-DD`) đang
  mở popover; chỉ **một** ô mở tại một thời điểm.
- Click ô ngày (Tháng/Tuần) → set `openDay = key` (thay cho việc drill xuống tầng
  Ngày như trước). Click lại ô đang mở, bấm ra ngoài, hoặc Esc → `openDay = null`.
- Thêm việc từ popover → gọi
  `onAddTodo({ title, due_date: openDay, priority:'medium', tags:[], recurrence:'none' })`.
  Việc mới xuất hiện trong ô nhờ state `todos` + realtime sẵn có (không cần logic
  đồng bộ riêng).
- Tích đánh dấu xong trong popover → gọi `onToggleTodo(id, done)` sẵn có.
- Nút "Mở ngày →" → set `horizon='day'`, `periodKey=openDay`, `openDay=null` (tái
  dùng `handleSelectCell` cũ cho tầng day).

## Logic thuần cần tách & test (Vitest)

Hàm thuần trong `lib` (không phụ thuộc React) để dễ test:

- `dayCellItems(todos, date, max)` → `{ lines: {id, title, is_done}[], overflow: number }`:
  lọc việc theo `due_date === date`, lấy tối đa `max` dòng đầu, đếm phần dư.

Ca kiểm thử:
- Ngày không có việc → `lines: []`, `overflow: 0`.
- Số việc ≤ `max` → trả hết, `overflow: 0`.
- Số việc > `max` → trả `max` dòng, `overflow = total - max`.
- Giữ đúng trạng thái `is_done` của từng dòng.

Tương tác popover (mở/đóng/Esc/bấm ngoài/thêm việc) kiểm thử bằng tay.

## Giao diện

- Ô ngày: `min-h` ~ 96–104px (≈4 lần chiều cao cũ ~44px), lưới vẫn 7 cột, `gap`
  giữ như hiện tại. Số ngày ở góc trên, danh sách việc phía dưới (chữ nhỏ, cắt
  tràn 1 dòng mỗi việc). Hỗ trợ dark mode qua class `dark:` như các component khác.
- Popover: nền `surface`, viền `border`, bóng `shadow-md`, rộng ~ 224px (`w-56`),
  neo dưới ô; `z` cao hơn lưới.
- Hiển thị tối đa **3** dòng việc trong ô, dư thì "+N việc".

## Nguyên tắc

- Không nuốt lỗi: lỗi thêm việc / đồng bộ vẫn báo qua `ErrorBanner` như hiện tại.
- Không mở rộng ngoài phạm vi trên.
