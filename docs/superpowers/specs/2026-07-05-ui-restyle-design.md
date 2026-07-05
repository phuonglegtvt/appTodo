# Thiết kế — Làm mới giao diện (UI restyle)

- **Ngày:** 2026-07-05
- **Loại:** Cải tiến trình bày (presentational only), không đổi tính năng/data model
- **Liên quan:** `prd.md` (Phase 1), `docs/superpowers/specs/2026-07-04-todo-app-design.md`

## 1. Bối cảnh & mục tiêu

Giao diện hiện tại (xây theo token "Claude Design" trong `tailwind.config.js`) khá
tối giản/phẳng: nền xám nhạt, chỉ dùng viền mỏng để phân tách, không có bóng đổ,
tím nhạt làm màu chính. Người dùng thấy chưa "hiện đại" và muốn nâng cấp theo
hướng **sạch & tinh tế** (kiểu Linear/Notion): bóng đổ mềm, không gian thoáng
hơn, bo góc lớn hơn, màu nhấn rõ hơn, chuyển động mượt — nhưng vẫn giữ tinh
thần tối giản, không đổi cấu trúc component hay hành vi.

**Không thuộc phạm vi:** tính năng mới (mục tiêu năm/tháng/tuần, quick-add theo
cột…) — sẽ làm ở spec riêng sau. Spec này **chỉ** đổi phần nhìn (className,
token Tailwind, CSS `@layer components`).

## 2. Design tokens (`tailwind.config.js`)

- **Primary** đậm/tương phản hơn:
  - `primary.DEFAULT`: `#5B57E0` → `#4F46E5`
  - `primary.dark`: `#837FF2` → `#8B87F5` (đủ sáng, tương phản tốt trên nền tối)
  - Giữ nguyên `primary.soft` / `primary.soft-dark`.
- **Shadow** (token mới, hiện chưa có — trước đây chỉ dùng `border`):
  ```js
  boxShadow: {
    soft: '0 1px 2px rgba(0,0,0,.04), 0 1px 3px rgba(0,0,0,.06)',
    md: '0 4px 12px rgba(0,0,0,.08)',
    lg: '0 12px 32px rgba(0,0,0,.12)',
    'soft-dark': '0 1px 2px rgba(0,0,0,.3), 0 1px 3px rgba(0,0,0,.35)',
    'md-dark': '0 4px 12px rgba(0,0,0,.4)',
    'lg-dark': '0 12px 32px rgba(0,0,0,.5)',
  }
  ```
  Dùng cặp light/dark riêng vì bóng đổ tối trên nền tối gần như vô hình — bản
  dark dùng alpha đen sâu hơn để vẫn thấy được lớp nổi.
- **Bo góc:** giữ nguyên thang `sm/md/lg/xl` hiện có, chỉ đổi *cách dùng* — ưu
  tiên `lg`/`xl` cho card/thẻ thay vì `md`.
- **Motion:** thêm `transitionDuration: { DEFAULT: '150ms' }`. Không thêm thư
  viện animation (không framer-motion) — dùng transition/transform thuần
  Tailwind, khớp nguyên tắc dự án học tập ưu tiên code đơn giản, dễ đọc.

## 3. Class dùng chung (`src/index.css`, `@layer components`)

Chỉ tách 3 pattern lặp lại ở ≥ 3 nơi trong codebase (tránh over-abstraction):

```css
@layer components {
  .surface-card {
    @apply rounded-xl border border-border bg-surface shadow-soft transition-shadow
           duration-150 ease-out hover:shadow-md
           dark:border-border-dark dark:bg-surface-dark dark:shadow-soft-dark dark:hover:shadow-md-dark;
  }

  .btn-icon {
    @apply flex h-8 w-8 items-center justify-center rounded-lg text-text-muted
           transition-colors duration-150 ease-out
           hover:bg-surface-2 hover:text-text active:scale-95
           dark:text-text-muted-dark dark:hover:bg-surface-2dark dark:hover:text-text-dark;
  }

  .pill {
    @apply inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold;
  }
}
```

Component-specific màu sắc (ví dụ pill ưu tiên, pill active-filter) vẫn truyền
qua className bổ sung tại nơi dùng — `.pill` chỉ định hình dạng chung.

## 4. Áp dụng theo từng khu vực

| Khu vực | File | Thay đổi |
|---|---|---|
| Topbar | `src/pages/AppPage.tsx` | Bỏ `border-b`, thay bằng `shadow-soft` (dark: `shadow-soft-dark`) để nội dung bên dưới "nổi" lên. |
| Search bar | `src/components/SearchBar.tsx` | Input bo `rounded-lg`→ giữ nhưng tăng padding dọc, thêm `focus:ring-2 focus:ring-primary/30` (dark tương ứng). |
| Sidebar | `src/components/Sidebar.tsx` | Smart-view đang active: thêm dải viền trái 2-3px màu `primary` (`border-l-2 border-primary`) cạnh nền `primary-soft` hiện có. Nút đăng xuất chuyển sang class `.btn-icon`. |
| Theme toggle | `src/components/ThemeToggle.tsx` | Chuyển sang `.btn-icon` (giữ nguyên icon/hành vi). |
| TodoItem / TodoList | `src/components/TodoItem.tsx`, `TodoList.tsx` | Mỗi hàng dùng `.surface-card` thay vì border phẳng hiện tại; ưu tiên hiển thị bằng dải màu mảnh bên trái (`border-l-[3px]` theo màu priority) thay cho chấm tròn nhỏ hiện tại. Tăng padding trong (`p-3` → `p-3.5`/`p-4`). |
| KanbanBoard / KanbanCard | `src/components/KanbanBoard.tsx`, `KanbanCard.tsx` | Cột: `shadow-soft` thay cho border đơn thuần (giữ border mảnh để phân định biên). Thẻ: `.surface-card`. Khi đang kéo (`isDragging` từ dnd-kit): thêm `scale-105 shadow-lg` tạo hiệu ứng "nhấc lên". |
| TodoForm | `src/components/TodoForm.tsx` | Input cao hơn (padding tăng), `rounded-lg`, `focus:ring-2 focus:ring-primary/30`. Nút "Thêm" nền `primary` đặc + `shadow-soft`, `hover:shadow-md`, `active:scale-95`. |
| FilterBar | `src/components/FilterBar.tsx` | Nút lọc chuyển sang `.pill`; trạng thái active dùng `bg-primary-soft text-primary` (dark tương ứng), trạng thái thường dùng `bg-surface-2`. |
| PriorityBadge | `src/components/PriorityBadge.tsx` | Dùng `.pill`; tăng nhẹ độ bão hòa màu priority ở dark mode để tương phản tốt hơn trên nền tối. |
| ErrorBanner | `src/components/ErrorBanner.tsx` | Bỏ nền đỏ nhạt toàn khối, thay bằng nền `surface` + dải viền trái đỏ (`border-l-[3px] border-red-500`) + icon cảnh báo trước text. Bo góc `rounded-lg`, `shadow-soft`. |
| LoginPage | `src/pages/LoginPage.tsx` | Card đăng nhập giữa màn hình dùng `.surface-card` với `shadow-lg` (nổi bật hơn card thường), đồng bộ token màu/spacing với phần còn lại của app. |

**Ranh giới rõ:** không đổi props, không đổi logic xử lý sự kiện, không đổi
cấu trúc component hay file mới ngoài các thay đổi className/CSS nêu trên.
`hooks/`, `lib/todoFilters.ts`, `types/todo.ts`, kết nối Supabase — giữ nguyên
hoàn toàn.

## 5. Kiểm thử & xác minh

- Đây là thay đổi thuần trình bày → **không cần test mới**. Test hiện có
  (`src/lib/theme.test.ts`, `src/lib/todoFilters.test.ts`) không đụng tới logic
  liên quan, phải tiếp tục pass nguyên trạng.
- Trước khi báo hoàn tất:
  1. `npm test` — xác nhận pass.
  2. `npm run build` — xác nhận build sạch (không lỗi TypeScript/Tailwind).
  3. Chạy dev server, kiểm tra bằng mắt: light mode + dark mode, desktop +
     mobile (responsive), và thử tương tác thực tế (thêm việc, kéo-thả trong
     Kanban, đổi filter/tag, đăng xuất) để đảm bảo không có hồi quy hành vi so
     với trước khi restyle.

## 6. Ngoài phạm vi

- Tính năng mục tiêu năm/tháng/tuần, quick-add theo cột Kanban — spec riêng.
- Đổi font chữ (giữ Plus Jakarta Sans / JetBrains Mono).
- Đổi màu chủ đạo sang tông khác (giữ tím, chỉ đậm/rõ hơn).
- Thêm thư viện animation (framer-motion hay tương tự).
- Refactor thành UI primitives component (Button/Card dùng chung dạng React) —
  cân nhắc sau nếu class-dùng-chung hiện tại không đủ.
