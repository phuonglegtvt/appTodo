# Thiết kế — 4 cải tiến UX (sidebar, cổ phiếu, sửa việc, lặp ngày)

- **Ngày:** 2026-07-12
- **Trạng thái:** đã duyệt, chờ viết plan
- **Phạm vi:** 4 tính năng độc lập, gộp trong một đợt. Không mở rộng ngoài mô tả dưới đây.

## Bối cảnh

App todo cá nhân (React + Vite + TS + Tailwind, Supabase). Hiện có 3 trang: Việc /
Kế hoạch / Cổ phiếu. NewPL yêu cầu 4 cải tiến trải nghiệm. Mỗi tính năng dưới đây
độc lập, có thể làm và test riêng.

---

## Tính năng 1 — Sidebar: nav dọc + nút thu gọn

### Vấn đề
Sidebar hiện chuyển trang bằng 3 pill NGANG trong một hàng
([Sidebar.tsx:48-82](../../../src/components/Sidebar.tsx#L48-L82)). Thêm trang mới
sẽ chật, chữ bị bó. Cần bố cục co giãn được và cho phép thu gọn sidebar.

### Thiết kế
- **Nav dọc:** đổi cụm 3 pill ngang thành **danh sách dọc**, mỗi mục một dòng =
  icon + nhãn, chiếm hết bề ngang, dùng style highlight giống Smart Views hiện tại
  (viền trái + nền `primary-soft` khi active). Icon gợi ý: Việc `✓`, Kế hoạch `◎`,
  Cổ phiếu `▤` (glyph đơn giản, khớp tông logo `✓`).
- **Nút thu gọn:** một nút toggle đặt cạnh logo (đầu sidebar).
  - **Mở (mặc định):** bề rộng `258px` như hiện tại — logo + tiêu đề, nav dọc,
    Smart Views + Nhãn (khi ở trang Việc), khối tài khoản.
  - **Thu gọn:** bề rộng ~`64px` (thanh icon hẹp) — chỉ hiện logo mark, 3 icon
    trang (mỗi icon có `title` = nhãn để hover xem tên), avatar + nút đăng xuất.
    Smart Views và Nhãn **ẩn** khi thu gọn (không đủ chỗ hiển thị chữ).
- **Ghi nhớ trạng thái:** lưu vào `localStorage` key `apptodo-sidebar-collapsed`
  qua hook mới `useSidebarCollapsed` (mô phỏng pattern
  [useTheme.ts](../../../src/hooks/useTheme.ts)). Hook trả `{ collapsed, toggle }`.
- **Phạm vi thiết bị:** sidebar hiện là `hidden md:flex` → chỉ áp dụng desktop.
  Điều hướng mobile (nếu có ở AppPage) giữ nguyên, không đụng.

### Đơn vị & ranh giới
- `src/hooks/useSidebarCollapsed.ts` — mới, chỉ quản trạng thái + persist.
- `src/components/Sidebar.tsx` — dùng hook, render 2 chế độ (mở / thu gọn).
- Không cần prop mới từ AppPage (hook tự chứa trong Sidebar).

---

## Tính năng 2 — Cổ phiếu: tìm kiếm + màu trực giác

### Vấn đề
- Danh mục 56 mã → cần **tìm nhanh**.
- Màu đỏ hiện tại tô khi `giá hiện tại ≤ giá ngưỡng`
  ([stockCalc.ts:59-65](../../../src/lib/stockCalc.ts#L59-L65),
  [StockRow.tsx:77-82](../../../src/components/StockRow.tsx#L77-L82)). NewPL muốn
  ĐỎ mang nghĩa **"giá hiện tại > giá bảo vệ" (đắt, cảnh báo)**.

### Thiết kế
- **Tìm kiếm:** ô input ở đầu trang Cổ phiếu (trên/ cạnh PortfolioSummary). Lọc
  các mã có `ticker` HOẶC `company_name` chứa từ khóa (không phân biệt hoa/thường).
  Hiện số mã khớp. Danh sách đã lọc truyền xuống `StockTable` (nhóm nào không còn
  mã thì tự ẩn — logic sẵn có).
  - Logic thuần tách ra file mới `src/lib/stockFilters.ts`:
    `filterStocks(stocks, query): Stock[]`. Query rỗng → trả nguyên danh sách.
- **Màu (đổi logic đỏ cũ theo yêu cầu):** thêm hàm thuần vào `stockCalc.ts`:
  - `isAboveProtect(stock)` = `current_price != null && price_protect != null &&
    current_price > price_protect`.
  - Giữ `isBelowThreshold(stock)` (current ≤ threshold) nhưng đổi VAI TRÒ hiển thị
    thành tín hiệu **XANH "đáng mua"**.
  - Ưu tiên khi cả hai đúng (dữ liệu bất thường protect < threshold): **đỏ thắng**.
- **StockRow hiển thị:**
  - `isAboveProtect` → chữ ĐỎ ở cột Mã + Giá hiện tại, nền dòng đỏ nhạt
    (`bg-red-50 dark:bg-red-950/30`).
  - `isBelowThreshold` (và không aboveProtect) → chữ XANH ở Mã + Giá hiện tại, nền
    xanh nhạt (`bg-green-50 dark:bg-green-950/30`).
  - Còn lại → trung tính.
- **Chú thích:** một dòng caption nhỏ dưới bảng: "Đỏ = trên giá bảo vệ (đắt) ·
  Xanh = chạm giá ngưỡng (đáng mua)".

### Đơn vị & ranh giới
- `src/lib/stockFilters.ts` — mới, `filterStocks` + test.
- `src/lib/stockCalc.ts` — thêm `isAboveProtect` + test.
- `src/components/StocksPage.tsx` — state tìm kiếm + ô input + lọc trước khi render bảng.
- `src/components/StockTable.tsx` — nhận danh sách đã lọc (không đổi interface nhiều)
  + caption chú thích màu.
- `src/components/StockRow.tsx` — áp màu theo `isAboveProtect` / `isBelowThreshold`.

---

## Tính năng 3 — Click dòng việc → mở form sửa đầy đủ

### Vấn đề
Hiện phải bấm đúng nút ✎ nhỏ để sửa
([TodoItem.tsx:233-235](../../../src/components/TodoItem.tsx#L233-L235)). NewPL muốn
click thẳng vào việc là sửa.

### Thiết kế
- Vùng nội dung (cột tiêu đề + meta,
  [TodoItem.tsx:165-229](../../../src/components/TodoItem.tsx#L165-L229)) thành
  **clickable** → `setEditing(true)` mở form sửa đầy đủ (đúng form hiện có).
- **Không lan click** cho các control con: nút xem/ẩn ghi chú `▾` (stopPropagation).
  Checkbox, tay cầm kéo, nút xóa đã là các phần tử flex riêng — nằm ngoài vùng
  clickable nên không bị ảnh hưởng.
- **Bỏ nút ✎** (click dòng đã thay thế), **giữ nút ✕** xóa.
- **A11y:** vùng nội dung có `role="button"`, `tabIndex=0`, xử lý phím Enter/Space,
  `aria-label` = "Sửa việc: {tiêu đề}"; con trỏ `cursor-pointer` + hover nhẹ.

### Đơn vị & ranh giới
- Chỉ sửa `src/components/TodoItem.tsx`. Không đổi hook/type.

---

## Tính năng 4 — Việc lặp "Hàng ngày"

### Vấn đề
Lặp hiện chỉ có tuần/tháng/năm
([todo.ts:3](../../../src/types/todo.ts#L3)). Thiếu "hàng ngày".

### Thiết kế
- **Type:** `Recurrence = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'`.
- **recurrence.ts:** thêm `case 'daily': return addDays(year, month, day, 1);`
  (TypeScript exhaustiveness sẽ ép bổ sung mọi switch trên `Recurrence`).
- **UI:** thêm `<option value="daily">Hàng ngày</option>` (đặt ngay sau "Không lặp")
  vào cả [TodoForm.tsx:83-87](../../../src/components/TodoForm.tsx#L83-L87) và form
  sửa trong [TodoItem.tsx:105-108](../../../src/components/TodoItem.tsx#L105-L108).
- **Migration DB (BẮT BUỘC):** schema hiện có
  `check (recurrence in ('none','weekly','monthly','yearly'))`
  ([schema.sql:64-65](../../../supabase/schema.sql#L64-L65)). Tạo file mới
  `supabase/migrations/2026-07-12-recurrence-daily.sql`: drop check cũ, add lại
  check gồm `'daily'`. NewPL chạy trong Supabase SQL Editor (giống file seed).
  Cập nhật luôn `schema.sql` cho đồng bộ.
  - **Không nuốt lỗi:** chưa chạy migration mà lưu việc lặp ngày → Supabase trả lỗi
    check constraint; app hiện lỗi qua ErrorBanner sẵn có, không che giấu.

### Đơn vị & ranh giới
- `src/types/todo.ts`, `src/lib/recurrence.ts`, `src/components/TodoForm.tsx`,
  `src/components/TodoItem.tsx`, `supabase/schema.sql`,
  `supabase/migrations/2026-07-12-recurrence-daily.sql`.
- Kiểm các file khác dùng `Recurrence` (PlanPage, KanbanCard) — TS sẽ báo nếu có
  switch chưa xử lý `'daily'`; bổ sung nhãn tương ứng.

---

## Kiểm thử & xác minh

- **Unit test (Vitest):**
  - `stockFilters.test.ts` — lọc theo mã/tên, không phân biệt hoa thường, query rỗng.
  - `stockCalc.test.ts` — thêm ca cho `isAboveProtect` (trên/bằng/dưới giá bảo vệ, null).
  - `recurrence.test.ts` — thêm ca `'daily'` (+1 ngày, qua ranh giới cuối tháng/năm).
- Trước khi báo "xong": chạy `npm test` và `npm run build`, xác nhận thực sự pass.
- Tính năng UI (sidebar collapse, click sửa, màu cổ phiếu) xác minh bằng chạy app.

## Ngoài phạm vi
- Không đổi điều hướng mobile.
- Không thêm tìm kiếm/màu cho trang khác ngoài Cổ phiếu.
- Không đổi mô hình dữ liệu ngoài việc mở rộng enum `recurrence`.
