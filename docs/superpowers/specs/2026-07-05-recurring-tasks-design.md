# Thiết kế: Việc lặp cố định ngày + ẩn việc đã xong (Phase 2a)

- **Ngày:** 2026-07-05
- **Trạng thái:** Đã duyệt (brainstorming)
- **Tác giả:** phuonglegtvt92@gmail.com + Claude

## 1. Mục tiêu & bối cảnh

Đây là lát cắt đầu tiên của Phase 2 (xem `prd.md` mục 6 — "Định hướng Phase 2").
Phase 2 tổng thể hướng tới mô hình **mục tiêu phân rã xuống việc** (5 năm → năm
→ tháng → tuần → ngày), nhưng phần **giá trị cao nhất và cấp thiết nhất** là:
không được quên các việc lặp lại cố định ngày trong tháng (thanh toán thẻ tín
dụng, trả nợ, trích tiền đầu tư...). Phase 2a giải quyết đúng phần này trước,
độc lập với hệ thống mục tiêu (Phase 2b, làm sau).

### Tiêu chí thành công
- Tick "đã đóng" một việc lặp (VD: đóng thẻ VPBank ngày 15 hàng tháng) → tự
  động xuất hiện việc cho kỳ sau (ngày 15 tháng sau), không cần tạo lại thủ công.
- Việc lặp dừng lại nếu người dùng **tự xóa** việc của kỳ tiếp theo — không có
  cơ chế "hủy lặp" riêng, xóa là đủ.
- Việc đã hoàn thành biến mất khỏi các view đang làm (Hôm nay/Sắp tới/Tất cả)
  nhưng vẫn xem lại được ở view "Đã xong" — không mất dữ liệu.

## 2. Mô hình dữ liệu

Thêm một cột vào bảng `todos` hiện có — không tạo bảng "template" riêng. Mỗi kỳ
lặp vẫn là một dòng `todos` bình thường, chỉ mang thêm quy tắc lặp:

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| recurrence | text | `'none'` \| `'weekly'` \| `'monthly'` \| `'yearly'`, mặc định `'none'` |

Migration SQL (`supabase/migrations/xxxx_add_recurrence.sql`):
```sql
alter table public.todos
  add column recurrence text not null default 'none'
  check (recurrence in ('none', 'weekly', 'monthly', 'yearly'));
```
Không cần thay đổi RLS — cột mới nằm trong cùng bảng, cùng policy hiện có.

### Cập nhật types (`src/types/todo.ts`)
- `Todo.recurrence: Recurrence`
- `type Recurrence = 'none' | 'weekly' | 'monthly' | 'yearly'`
- `NewTodo.recurrence?: Recurrence`
- `TodoUpdate` thêm `'recurrence'` vào danh sách field được sửa.
- Việc lặp **bắt buộc có `due_date`** (đó là mốc tính kỳ tiếp theo). Ràng buộc
  này xử lý ở tầng form/hook, không ở DB (giữ schema đơn giản).

## 3. Cơ chế sinh kỳ tiếp theo

### Logic thuần (`src/lib/recurrence.ts`, test trước — TDD)
```ts
function nextDueDate(dueDate: string, recurrence: Recurrence): string
```
- `weekly`: +7 ngày.
- `monthly`: +1 tháng; nếu ngày gốc không tồn tại ở tháng sau (VD 31/1), dồn về
  ngày cuối tháng đó (31/1 → 28/2 hoặc 29/2 năm nhuận).
- `yearly`: +1 năm; xử lý 29/2 → 28/2 ở năm không nhuận tương tự.

```ts
function buildNextOccurrence(todo: Todo): NewTodo
```
Copy `title`, `notes`, `priority`, `tags`, `recurrence`; `due_date` =
`nextDueDate(todo.due_date, todo.recurrence)`; không copy `is_done` (luôn false
cho kỳ mới).

### Luồng khi tick hoàn thành (`useTodos.ts`, hàm `completeTodo` mới hoặc mở
rộng `updateTodo`)
Khi đánh dấu `is_done = true` cho một việc có `recurrence !== 'none'`:
1. **Insert trước** việc kỳ kế tiếp (qua `buildNextOccurrence`).
2. Nếu insert lỗi → báo lỗi cho người dùng (banner + console.error), **không**
   đánh dấu việc hiện tại là xong — tránh mất reminder vì lỗi mạng.
3. Nếu insert thành công → `update` việc hiện tại: `is_done = true` **và**
   `recurrence = 'none'`. Đặt `recurrence = 'none'` biến việc này thành bản ghi
   lịch sử thuần túy, chống sinh trùng lặp nếu người dùng bỏ tick rồi tick lại.

Việc **không có** `recurrence` (`'none'`) khi tick xong giữ nguyên hành vi cũ —
không có gì thay đổi ở luồng CRUD hiện tại.

### Vì sao không dùng cron/edge function
Sinh kỳ tiếp theo là phản ứng trực tiếp với hành động của người dùng (tick
xong), không phải theo lịch nền. Làm ở client giữ đúng nguyên tắc "Phase 1
không có server tự viết" và không cần thêm hạ tầng.

## 4. Ẩn việc đã xong khỏi view đang làm

`src/lib/todoFilters.ts`:
- `applySmartView(todos, 'all', today)` hiện trả **toàn bộ** todos kể cả đã
  xong — sửa để loại `is_done`. `'today'` và `'upcoming'` đã tự loại `is_done`
  sẵn (không đổi). `'done'` không đổi (đúng mục đích: xem lại việc đã xong).

Đây là thay đổi hành vi có thể phá test hiện tại của `todoFilters.test.ts` cho
view `'all'` — cập nhật test đó cho khớp hành vi mới.

## 5. UI

- **`TodoForm`**: thêm select "Lặp lại" (Không lặp / Hàng tuần / Hàng tháng /
  Hàng năm), disabled cho tới khi có `due_date` (vì cần mốc để tính kỳ sau).
  Validate: nếu chọn lặp mà chưa có `due_date` → báo lỗi rõ ràng, không âm thầm bỏ qua.
- **`TodoItem` / `KanbanCard`**: hiện icon 🔁 nhỏ cạnh `due_date` khi
  `recurrence !== 'none'`, giúp nhận biết việc sẽ tự lặp mà không cần mở form.

## 6. Xử lý lỗi & kiểm thử

- Không nuốt lỗi im lặng: lỗi insert kỳ mới hoặc update kỳ hiện tại đều hiện
  qua `ErrorBanner` sẵn có + `console.error`, đúng NFR-1.
- **Test (Vitest), logic thuần trước:**
  - `nextDueDate`: tháng thường, dồn cuối tháng, năm nhuận, tuần.
  - `buildNextOccurrence`: copy đúng field, `is_done` luôn `false`.
  - `applySmartView('all', ...)`: loại việc đã xong.
- Trước khi báo "xong": chạy `npm test` và `npm run build`, xác nhận pass thật.

## 7. Ngoài phạm vi Phase 2a

Hệ thống mục tiêu (`goals`, horizon 5 năm/năm/tháng/tuần, `todos.goal_id`),
view theo horizon, sinh sẵn nhiều kỳ tương lai theo lịch — để dành Phase 2b,
spec riêng.
