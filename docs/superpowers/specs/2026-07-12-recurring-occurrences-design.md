# Việc lặp hiện ở mọi ngày kế tiếp (occurrence ảo) — thiết kế

Ngày: 2026-07-12

## Vấn đề
Cơ chế lặp hiện tại là **"cuốn chiếu khi hoàn thành"**: việc lặp chỉ sinh kỳ kế
tiếp khi người dùng **tick hoàn thành** kỳ hiện tại (`toggleDone → completeRecurring`
trong `useTodos.ts`; `buildNextOccurrence` trong `lib/recurrence.ts`). Nếu chưa tick,
kỳ sau **không** xuất hiện.

Người dùng muốn: việc lặp **tự hiển thị ở mọi ngày kế tiếp** trong lịch mà **không
cần** tick, và **tick độc lập từng ngày** (giống sự kiện lặp trên Google Calendar).

## Mô hình mới: template + occurrence ảo

- Việc có `recurrence != 'none'` là một **template** (1 dòng DB duy nhất). `due_date`
  của nó = **ngày bắt đầu** chuỗi lặp.
- Thêm cột `completed_dates text[] not null default '{}'` vào bảng `todos` — lưu danh
  sách ngày (`YYYY-MM-DD`) của chuỗi đã được tick xong.
- Các occurrence (kỳ) **không** được lưu thành dòng DB — chúng được **sinh ảo** khi
  dựng view lịch, từ template. Trạng thái done của mỗi ngày đọc từ `completed_dates`.
- **Bỏ hẳn** cơ chế cuốn chiếu cũ (`completeRecurring`, `buildNextOccurrence`).

### Vì sao (so với các cách khác)
- *Sinh dòng thật cho mỗi ngày*: daily → vô hạn dòng, cần cơ chế "nới chân trời", nặng.
- *Bảng completions riêng*: thêm bảng + RLS + join, quá mức cho app cá nhân.
- *Mảng `completed_dates`* (chọn): 1 cột, không bảng mới, không bùng nổ dòng, hàm sinh
  occurrence là **pure** (dễ test), phù hợp dự án học.

## Thay đổi dữ liệu

- `supabase/schema.sql`: thêm `completed_dates text[] not null default '{}'` vào bảng
  `todos`.
- Migration chạy tay: `supabase/migrations/2026-07-12-completed-dates.sql` — idempotent
  (`add column if not exists`), kèm hướng dẫn dán vào Supabase SQL Editor (giống file
  `2026-07-12-recurrence-daily.sql`).
- `src/types/todo.ts`:
  - `Todo`: thêm `completed_dates: string[]`.
  - `TodoUpdate`: thêm `'completed_dates'` vào danh sách trường sửa được.
  - `NewTodo`: **không** cần (server default `{}`).
- `src/hooks/useTodos.ts`: khi map dữ liệu fetch/realtime, đảm bảo `completed_dates`
  luôn là mảng (`row.completed_dates ?? []`). `addTodo` không cần gửi trường này.

## Sinh occurrence (lib thuần)

File mới `src/lib/recurringOccurrences.ts`:

```ts
// Tất cả ngày (YYYY-MM-DD) của một chuỗi lặp nằm trong [rangeStart, rangeEnd],
// bắt đầu từ startDate (bao gồm), theo bước của recurrence. Dùng nextDueDate lặp.
export function occurrenceDatesInRange(
  startDate: string,
  recurrence: Recurrence,
  rangeStart: string,
  rangeEnd: string,
): string[];

// Thay mỗi template (recurrence != 'none') bằng các occurrence ảo trong khoảng;
// giữ nguyên việc thường. Occurrence: id=`${t.id}::${date}`, due_date=date,
// is_done = t.completed_dates.includes(date), recurrence giữ nguyên (cho badge 🔁).
export function expandRecurring(todos: Todo[], rangeStart: string, rangeEnd: string): Todo[];
```

- `occurrenceDatesInRange` tái dùng `nextDueDate` (giữ lại trong `lib/recurrence.ts`)
  làm bước nhảy; dừng khi vượt `rangeEnd`; bỏ qua ngày < `max(startDate, rangeStart)`.
  `recurrence === 'none'` → trả `[startDate]` nếu nằm trong khoảng, ngược lại `[]`.
- Occurrence ảo là bản sao nông của template với `id`, `due_date`, `is_done` mới.

## ID occurrence & helper

File `src/lib/recurringOccurrences.ts` cũng export:

```ts
// 'templateId::2026-07-13'      → { templateId, kind: 'day',    date: '2026-07-13' }
// 'templateId::P2026-08'        → { templateId, kind: 'period', periodKey: '2026-08' }
// id không chứa '::'            → null (việc thường)
export function parseOccurrenceId(id: string): OccurrenceRef | null;

// Thêm/bớt 1 ngày trong mảng (idempotent, sắp xếp tăng dần).
export function toggleDateInList(dates: string[], date: string): string[];
```

## View lịch (PlanPage)

Tính khoảng hiển thị `[start, end]` theo `horizon` (dùng `getPeriodRange`), rồi:

- **Ngày / Tuần / Tháng** (mỗi ô = 1 ngày): gọi `expandRecurring(todos, start, end)`
  trước khi lọc theo ngày. `dayTodos`, `dayGrid` giữ nguyên logic lọc `due_date === date`.
- **Năm / 5 Năm** (ô gom): **hiện 1 lần/kỳ** — với mỗi ô con (tháng/năm), nếu template
  có ít nhất 1 occurrence trong `[childStart, childEnd]` thì thêm **một** đại diện:
  `id=`${t.id}::P${childKey}``, `due_date` = occurrence đầu tiên trong kỳ,
  `is_done` = **mọi** occurrence trong kỳ đều thuộc `completed_dates`. Việc thường trong
  ô gom giữ nguyên. (Bổ sung hàm dựng ô gom nhận diện template thay vì `expandRecurring`.)

## Tương tác (PlanPage bọc callback)

Dùng `parseOccurrenceId` để định tuyến:

- **Tick**
  - `kind: 'day'` → `onUpdateTodo(templateId, { completed_dates: toggleDateInList(t.completed_dates, date) })`.
  - `kind: 'period'` → bulk: lấy `occurrenceDatesInRange` của kỳ đó; nếu đang all-done thì
    bỏ hết khỏi `completed_dates`, ngược lại thêm hết → `onUpdateTodo(templateId, {...})`.
  - việc thường → `onToggleTodo(id, done)` như cũ.
- **Sửa** (`onEditTodo`) → mở modal với **template** gốc (`setEditingTodo(template)`), không
  phải occurrence ảo. Sửa áp cho cả chuỗi.
- **Xóa** (`onDeleteTodo`) → `onDeleteTodo(templateId)` (xóa cả chuỗi), giữ xác nhận hiện có.

## Modal sửa (TodoEditModal)
Khi lưu template mà đổi `recurrence` về `'none'` → gửi kèm `completed_dates: []` (dọn mảng,
thành việc thường). Không thay đổi UI modal.

## List "Việc" (AppPage — danh sách phẳng)
- **Hiện template 1 lần**. Trước khi lọc smart-view, map: nếu `recurrence != 'none'` và có
  `due_date` → `is_done = completed_dates.includes(due_date)`. Nhờ đó checkbox + bộ lọc
  `today`/`done` hoạt động đúng trên ngày bắt đầu.
- Tick ở list → nếu việc lặp: `updateTodo(id, { completed_dates: toggleDateInList(..., due_date) })`;
  việc thường: giữ nguyên.

## Gỡ code cũ
- `src/hooks/useTodos.ts`: xóa `completeRecurring`, `pendingRecurring` ref, import
  `buildNextOccurrence`, và nhánh gọi `completeRecurring` trong `toggleDone` (AppPage).
- `src/lib/recurrence.ts`: xóa `buildNextOccurrence` (+ test của nó). **Giữ** `nextDueDate`
  và các helper ngày (được `occurrenceDatesInRange` tái dùng).

## Ngoài phạm vi
- Xóa/bỏ qua **một ngày lẻ** của chuỗi (chỉ xóa cả chuỗi).
- Sửa nội dung riêng cho **một occurrence** (sửa luôn áp cả chuỗi).
- Bung hết occurrence trong view gom Năm/5 Năm (chỉ 1 đại diện/kỳ).
- Kéo-thả sắp xếp occurrence ảo (chỉ áp dụng việc thật).

## Kiểm thử
- `occurrenceDatesInRange`: daily/weekly/monthly/yearly; cắt đúng theo `[start,end]`;
  bỏ ngày trước `startDate`; clamp ngày 31 → cuối tháng (dùng chung logic `addMonths`);
  `none` trong/ngoài khoảng.
- `expandRecurring`: template → occurrence đúng số lượng + `id`/`due_date`/`is_done` theo
  `completed_dates`; việc thường không đổi.
- `parseOccurrenceId`: 3 dạng (day, period, null).
- `toggleDateInList`: thêm khi vắng, bớt khi có, giữ sắp xếp.
- Tích hợp nhẹ: dựng lưới tháng cho 1 việc daily → xuất hiện ở nhiều ô ngày; tick 1 ô chỉ
  đổi ngày đó.
- Cập nhật test hiện có bị ảnh hưởng (bỏ test `buildNextOccurrence`; bổ sung `completed_dates`
  vào factory tạo `Todo` trong các test dùng object Todo đầy đủ).
- Trước khi báo xong: `npm test` + `npm run build` phải pass.
