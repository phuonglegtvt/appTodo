# 4 cải tiến UX — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm 4 cải tiến UX cho app todo: sidebar thu gọn được + nav dọc, tìm kiếm & tô màu cổ phiếu, click dòng việc để sửa, và việc lặp "hàng ngày".

**Architecture:** Mỗi tính năng độc lập. Logic thuần (lọc cổ phiếu, phân loại màu, tính kỳ lặp) tách vào `src/lib/*` có unit test; component chỉ ráp UI. Trạng thái thu gọn sidebar lưu `localStorage` qua hook riêng. Mở rộng enum `recurrence` cần migration DB đi kèm.

**Tech Stack:** React + Vite + TypeScript + Tailwind CSS, Vitest, Supabase (Postgres CHECK constraint).

## Global Constraints

- TypeScript ở mọi nơi; tránh `any`.
- Không nuốt lỗi im lặng — lỗi lưu/mạng phải hiện cho người dùng + log console.
- Style bằng class Tailwind; hỗ trợ dark mode qua `dark:`.
- Giao diện tiếng Việt (thuật ngữ kỹ thuật giữ tiếng Anh).
- Viết test cho logic thuần TRƯỚC (TDD). Trước khi báo xong: `npm test` + `npm run build` phải thực sự pass.
- Đơn vị dữ liệu cổ phiếu: giá theo nghìn đồng, cổ tức/số tiền theo đồng (giữ nguyên).
- Commit message tiếng Việt theo convention repo (`feat(scope):`, `fix(scope):`…).

---

## Tính năng 4 trước — Việc lặp "Hàng ngày" (nền tảng type, ít rủi ro)

### Task 1: Mở rộng enum `Recurrence` + tính kỳ lặp hàng ngày

**Files:**
- Modify: `src/types/todo.ts:3`
- Modify: `src/lib/recurrence.ts:4-16`
- Test: `src/lib/recurrence.test.ts`

**Interfaces:**
- Produces: `Recurrence` gồm giá trị mới `'daily'`; `nextDueDate(dueDate, 'daily')` trả ngày +1.

- [ ] **Step 1: Viết test thất bại cho kỳ lặp hàng ngày**

Thêm vào `src/lib/recurrence.test.ts` (đặt trong khối `describe('nextDueDate', ...)` sẵn có, hoặc thêm mới nếu chưa có):

```ts
import { nextDueDate } from './recurrence';

describe('nextDueDate — daily', () => {
  it('cộng 1 ngày cho lặp hàng ngày', () => {
    expect(nextDueDate('2026-07-12', 'daily')).toBe('2026-07-13');
  });
  it('qua ranh giới cuối tháng', () => {
    expect(nextDueDate('2026-07-31', 'daily')).toBe('2026-08-01');
  });
  it('qua ranh giới cuối năm', () => {
    expect(nextDueDate('2026-12-31', 'daily')).toBe('2027-01-01');
  });
});
```

- [ ] **Step 2: Chạy test — xác nhận FAIL**

Run: `npm test -- src/lib/recurrence.test.ts`
Expected: FAIL — TypeScript báo `'daily'` không gán được cho `Recurrence` (hoặc switch không xử lý `'daily'`).

- [ ] **Step 3: Thêm `'daily'` vào type**

Trong `src/types/todo.ts` đổi dòng 3:

```ts
export type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
```

- [ ] **Step 4: Xử lý `'daily'` trong `nextDueDate`**

Trong `src/lib/recurrence.ts`, thêm case vào `switch (recurrence)` (đặt trước `case 'weekly'`):

```ts
    case 'daily':
      return addDays(year, month, day, 1);
```

- [ ] **Step 5: Chạy test — xác nhận PASS**

Run: `npm test -- src/lib/recurrence.test.ts`
Expected: PASS toàn bộ.

- [ ] **Step 6: Commit**

```bash
git add src/types/todo.ts src/lib/recurrence.ts src/lib/recurrence.test.ts
git commit -m "feat(todo): thêm lặp 'hàng ngày' (type + nextDueDate)"
```

---

### Task 2: Option "Hàng ngày" trong 2 form + migration DB

**Files:**
- Modify: `src/components/TodoForm.tsx:83-87`
- Modify: `src/components/TodoItem.tsx:105-108`
- Modify: `supabase/schema.sql:63-65`
- Create: `supabase/migrations/2026-07-12-recurrence-daily.sql`
- Kiểm (có thể phải sửa): `src/components/PlanPage.tsx`, `src/components/KanbanCard.tsx`

**Interfaces:**
- Consumes: `Recurrence` có `'daily'` (Task 1).
- Produces: người dùng chọn được "Hàng ngày" ở form thêm và form sửa; DB chấp nhận `recurrence = 'daily'`.

- [ ] **Step 1: Thêm option vào form THÊM việc**

Trong `src/components/TodoForm.tsx`, dưới `<option value="none">Không lặp</option>` (dòng 83) thêm:

```tsx
        <option value="daily">Hàng ngày</option>
```

- [ ] **Step 2: Thêm option vào form SỬA việc**

Trong `src/components/TodoItem.tsx`, dưới `<option value="none">Không lặp</option>` (dòng 105) thêm:

```tsx
              <option value="daily">Hàng ngày</option>
```

- [ ] **Step 3: Kiểm các nơi khác dùng `Recurrence`**

Run: `npx tsc --noEmit`
Expected: nếu `PlanPage.tsx` / `KanbanCard.tsx` có `switch`/map nhãn theo `Recurrence` mà chưa xử lý `'daily'`, TS báo lỗi hoặc thiếu nhãn. Nếu có map nhãn (VD `{ weekly: 'Tuần', ... }`), bổ sung `daily: 'Ngày'`. Nếu chỉ hiện icon 🔁 khi `!== 'none'` thì không cần sửa. Nếu `tsc` sạch và không có map nhãn → bỏ qua sửa.

- [ ] **Step 4: Cập nhật schema.sql**

Trong `supabase/schema.sql` sửa CHECK (dòng 64-65) thành:

```sql
  add column if not exists recurrence text not null default 'none'
  check (recurrence in ('none', 'daily', 'weekly', 'monthly', 'yearly'));
```

- [ ] **Step 5: Tạo file migration để chạy trên Supabase**

Tạo `supabase/migrations/2026-07-12-recurrence-daily.sql`:

```sql
-- Cho phép giá trị lặp 'daily' (hàng ngày) ở cột todos.recurrence.
-- CÁCH DÙNG: Supabase Dashboard → SQL Editor → dán file này → Run.
-- An toàn chạy lại: drop constraint cũ (nếu có) rồi tạo lại với 'daily'.

alter table public.todos
  drop constraint if exists todos_recurrence_check;

alter table public.todos
  add constraint todos_recurrence_check
  check (recurrence in ('none', 'daily', 'weekly', 'monthly', 'yearly'));
```

> Lưu ý: tên constraint `todos_recurrence_check` là tên mặc định Postgres đặt cho CHECK không đặt tên trên cột `recurrence` của bảng `todos`. Nếu bảng dùng tên khác, kiểm bằng `\d public.todos` rồi thay tên trong `drop constraint if exists`.

- [ ] **Step 6: Build + test — xác nhận PASS**

Run: `npm run build && npm test`
Expected: build thành công, test xanh.

- [ ] **Step 7: Commit**

```bash
git add src/components/TodoForm.tsx src/components/TodoItem.tsx supabase/schema.sql supabase/migrations/2026-07-12-recurrence-daily.sql
git add -A
git commit -m "feat(todo): chọn lặp 'hàng ngày' ở 2 form + migration CHECK constraint"
```

> **Cần NewPL làm thủ công:** chạy `supabase/migrations/2026-07-12-recurrence-daily.sql` trong Supabase SQL Editor trước khi dùng tính năng lặp hàng ngày trên môi trường thật. Chưa chạy → lưu việc lặp ngày sẽ báo lỗi CHECK constraint (hiện qua ErrorBanner, không nuốt lỗi).

---

## Tính năng 2 — Cổ phiếu: tìm kiếm + màu

### Task 3: `filterStocks` — lọc theo mã/tên

**Files:**
- Create: `src/lib/stockFilters.ts`
- Test: `src/lib/stockFilters.test.ts`

**Interfaces:**
- Produces: `filterStocks(stocks: Stock[], query: string): Stock[]` — lọc mã có `ticker` HOẶC `company_name` chứa `query` (không phân biệt hoa/thường, cắt khoảng trắng thừa); query rỗng → trả nguyên mảng.

- [ ] **Step 1: Viết test thất bại**

Tạo `src/lib/stockFilters.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { filterStocks } from './stockFilters';
import type { Stock } from '../types/stock';

function stock(over: Partial<Stock>): Stock {
  return {
    id: '1', user_id: 'u', ticker: 'ACB', company_name: 'Ngân hàng Á Châu',
    group: 'attack', price_threshold: null, price_protect: null,
    current_price: null, dividend: null, invested_amount: null,
    sort_order: 0, created_at: '', updated_at: '', ...over,
  };
}

describe('filterStocks', () => {
  const list = [
    stock({ id: '1', ticker: 'ACB', company_name: 'Ngân hàng Á Châu' }),
    stock({ id: '2', ticker: 'HPG', company_name: 'Tập đoàn Hòa Phát' }),
  ];

  it('query rỗng trả nguyên danh sách', () => {
    expect(filterStocks(list, '')).toHaveLength(2);
    expect(filterStocks(list, '   ')).toHaveLength(2);
  });
  it('lọc theo mã, không phân biệt hoa thường', () => {
    const r = filterStocks(list, 'hpg');
    expect(r).toHaveLength(1);
    expect(r[0].ticker).toBe('HPG');
  });
  it('lọc theo tên công ty', () => {
    const r = filterStocks(list, 'hòa phát');
    expect(r).toHaveLength(1);
    expect(r[0].ticker).toBe('HPG');
  });
  it('không khớp trả mảng rỗng', () => {
    expect(filterStocks(list, 'xyz')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Chạy test — xác nhận FAIL**

Run: `npm test -- src/lib/stockFilters.test.ts`
Expected: FAIL — không tìm thấy module `./stockFilters`.

- [ ] **Step 3: Viết `filterStocks`**

Tạo `src/lib/stockFilters.ts`:

```ts
import type { Stock } from '../types/stock';

/** Lọc mã có ticker HOẶC tên công ty chứa từ khóa (không phân biệt hoa/thường). */
export function filterStocks(stocks: Stock[], query: string): Stock[] {
  const q = query.trim().toLowerCase();
  if (!q) return stocks;
  return stocks.filter(
    (s) =>
      s.ticker.toLowerCase().includes(q) ||
      s.company_name.toLowerCase().includes(q),
  );
}
```

- [ ] **Step 4: Chạy test — xác nhận PASS**

Run: `npm test -- src/lib/stockFilters.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stockFilters.ts src/lib/stockFilters.test.ts
git commit -m "feat(stocks): filterStocks — tìm theo mã/tên công ty"
```

---

### Task 4: `isAboveProtect` — phân loại màu "đắt"

**Files:**
- Modify: `src/lib/stockCalc.ts` (thêm hàm cuối file)
- Test: `src/lib/stockCalc.test.ts`

**Interfaces:**
- Produces: `isAboveProtect(stock: Pick<Stock,'current_price'|'price_protect'>): boolean` — true khi `current_price > price_protect` (cả hai khác null).
- Consumes: `isBelowThreshold` (đã có) — vẫn giữ, dùng cho tín hiệu xanh "đáng mua".

- [ ] **Step 1: Viết test thất bại**

Thêm vào `src/lib/stockCalc.test.ts`:

```ts
import { isAboveProtect } from './stockCalc';

describe('isAboveProtect', () => {
  it('true khi giá hiện tại > giá bảo vệ', () => {
    expect(isAboveProtect({ current_price: 32, price_protect: 30 })).toBe(true);
  });
  it('false khi giá hiện tại = giá bảo vệ', () => {
    expect(isAboveProtect({ current_price: 30, price_protect: 30 })).toBe(false);
  });
  it('false khi giá hiện tại < giá bảo vệ', () => {
    expect(isAboveProtect({ current_price: 28, price_protect: 30 })).toBe(false);
  });
  it('false khi thiếu dữ liệu', () => {
    expect(isAboveProtect({ current_price: null, price_protect: 30 })).toBe(false);
    expect(isAboveProtect({ current_price: 32, price_protect: null })).toBe(false);
  });
});
```

- [ ] **Step 2: Chạy test — xác nhận FAIL**

Run: `npm test -- src/lib/stockCalc.test.ts`
Expected: FAIL — `isAboveProtect` chưa export.

- [ ] **Step 3: Viết `isAboveProtect`**

Thêm cuối `src/lib/stockCalc.ts`:

```ts
/** Mã "đắt": giá hiện tại đã vượt trên giá bảo vệ tích sản. */
export function isAboveProtect(
  stock: Pick<Stock, 'current_price' | 'price_protect'>,
): boolean {
  const { current_price, price_protect } = stock;
  return current_price != null && price_protect != null && current_price > price_protect;
}
```

- [ ] **Step 4: Chạy test — xác nhận PASS**

Run: `npm test -- src/lib/stockCalc.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stockCalc.ts src/lib/stockCalc.test.ts
git commit -m "feat(stocks): isAboveProtect — phân loại mã 'đắt' (trên giá bảo vệ)"
```

---

### Task 5: StockRow — áp màu đỏ "đắt" / xanh "đáng mua"

**Files:**
- Modify: `src/components/StockRow.tsx:43-92`

**Interfaces:**
- Consumes: `isAboveProtect` (Task 4), `isBelowThreshold` (có sẵn).

- [ ] **Step 1: Import + tính cờ màu**

Trong `src/components/StockRow.tsx`:
- Dòng 3 đổi import:

```tsx
import { computeYield, isBelowThreshold, isAboveProtect } from '../lib/stockCalc';
```

- Sau dòng 43 (`const yieldPct = computeYield(stock);`), thay dòng `const below = isBelowThreshold(stock);` bằng:

```tsx
  const above = isAboveProtect(stock);
  // "đáng mua" chỉ khi không đồng thời "đắt" (đỏ ưu tiên nếu dữ liệu bất thường).
  const cheap = !above && isBelowThreshold(stock);
```

- [ ] **Step 2: Áp màu cho dòng hiển thị (không phải khi đang sửa)**

Thay khối `return (...)` hiển thị (dòng 76-91) — cập nhật `<tr>`, cột Mã, cột Giá hiện tại:

```tsx
  const rowTint = above
    ? 'bg-red-50 dark:bg-red-950/30'
    : cheap
      ? 'bg-green-50 dark:bg-green-950/30'
      : '';
  const emphasize = above
    ? 'font-semibold text-red-600 dark:text-red-400'
    : cheap
      ? 'font-semibold text-green-600 dark:text-green-400'
      : '';

  return (
    <tr className={`border-t border-border dark:border-border-dark ${rowTint}`}>
      <td className={`${cell} font-semibold ${emphasize}`}>{stock.ticker}</td>
      <td className={cell}>{stock.company_name}</td>
      <td className={cell}>{fmt(stock.price_threshold)}</td>
      <td className={cell}>{fmt(stock.price_protect)}</td>
      <td className={`${cell} ${emphasize}`}>{fmt(stock.current_price)}</td>
      <td className={cell}>{fmt(stock.dividend)}</td>
      <td className={cell}>{yieldPct == null ? '—' : yieldPct.toFixed(1) + '%'}</td>
      <td className={cell}>{fmt(stock.invested_amount)}</td>
      <td className={cell}>
        <button onClick={startEdit} className="mr-2 text-text-muted hover:text-primary dark:text-text-muted-dark dark:hover:text-primary-dark" aria-label="Sửa">✎</button>
        <button onClick={() => onDelete(stock.id)} className="text-text-muted hover:text-red-500 dark:text-text-muted-dark" aria-label="Xóa">✕</button>
      </td>
    </tr>
  );
```

- [ ] **Step 3: Build — xác nhận PASS**

Run: `npm run build`
Expected: build thành công, không lỗi TS (biến `below` cũ đã bị thay hết).

- [ ] **Step 4: Commit**

```bash
git add src/components/StockRow.tsx
git commit -m "feat(stocks): tô đỏ mã 'đắt' (trên bảo vệ), xanh mã 'đáng mua' (dưới ngưỡng)"
```

---

### Task 6: StocksPage — ô tìm kiếm + chú thích màu

**Files:**
- Modify: `src/components/StocksPage.tsx`
- Modify: `src/components/StockTable.tsx` (thêm caption chú thích màu)

**Interfaces:**
- Consumes: `filterStocks` (Task 3).

- [ ] **Step 1: Thêm state + ô tìm kiếm + lọc**

Trong `src/components/StocksPage.tsx`:
- Thêm import sau dòng 3:

```tsx
import { filterStocks } from '../lib/stockFilters';
```

- Thêm state (sau dòng 19 `const [updating, setUpdating] = useState(false);`):

```tsx
  const [query, setQuery] = useState('');
```

- Trước `return (`, tính danh sách hiển thị:

```tsx
  const visibleStocks = filterStocks(stocks, query);
```

- Thay ô mô tả số mã (dòng 58-60) để phản ánh kết quả lọc, và thêm ô input. Thay khối `<div><div className="text-[22px]...">Cổ phiếu</div> ... </div>` (dòng 56-61) bằng:

```tsx
        <div>
          <div className="text-[22px] font-bold tracking-tight text-text dark:text-text-dark">Cổ phiếu</div>
          <div className="mt-0.5 text-[13px] text-text-muted dark:text-text-muted-dark">
            {query.trim()
              ? `${visibleStocks.length}/${stocks.length} mã khớp "${query.trim()}"`
              : `${stocks.length} mã · giá theo nghìn đồng, số tiền theo đồng`}
          </div>
        </div>
```

- Thêm ô tìm kiếm ngay trên `<PortfolioSummary .../>` (dòng 74). Chèn trước dòng đó:

```tsx
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Tìm theo mã hoặc tên công ty…"
        aria-label="Tìm cổ phiếu"
        className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none transition-colors placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-border-dark dark:bg-surface-2dark dark:text-text-dark dark:placeholder:text-text-muted-dark dark:focus:border-primary-dark"
      />
```

- Ở phần render bảng (dòng 78-86), đổi nhánh hiển thị để dùng `visibleStocks` và xử lý "không có mã khớp":

```tsx
      {loading ? (
        <p className="py-8 text-center text-sm text-text-muted dark:text-text-muted-dark">Đang tải…</p>
      ) : stocks.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-text-muted dark:border-border-dark dark:text-text-muted-dark">
          Chưa có mã nào. Thêm mã đầu tiên ở form trên.
        </p>
      ) : visibleStocks.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-text-muted dark:border-border-dark dark:text-text-muted-dark">
          Không có mã nào khớp "{query.trim()}".
        </p>
      ) : (
        <StockTable stocks={visibleStocks} onUpdate={updateStock} onDelete={removeStock} />
      )}
```

- [ ] **Step 2: Thêm chú thích màu dưới bảng**

Trong `src/components/StockTable.tsx`, bọc phần return để thêm caption cuối. Đổi `return (` mở đầu `<div className="flex flex-col gap-5">` — thêm một dòng chú thích sau khối `{GROUPS.map(...)}` (trước khi đóng `</div>` ngoài cùng):

```tsx
      <p className="text-[11px] text-text-muted dark:text-text-muted-dark">
        <span className="font-semibold text-red-600 dark:text-red-400">Đỏ</span> = trên giá bảo vệ (đắt) ·{' '}
        <span className="font-semibold text-green-600 dark:text-green-400">Xanh</span> = chạm giá ngưỡng (đáng mua)
      </p>
```

- [ ] **Step 3: Build — xác nhận PASS**

Run: `npm run build`
Expected: build thành công.

- [ ] **Step 4: Commit**

```bash
git add src/components/StocksPage.tsx src/components/StockTable.tsx
git commit -m "feat(stocks): ô tìm kiếm theo mã/tên + chú thích màu dưới bảng"
```

---

## Tính năng 3 — Click dòng việc → mở form sửa

### Task 7: TodoItem — vùng nội dung clickable, bỏ nút ✎

**Files:**
- Modify: `src/components/TodoItem.tsx:165-243`
- Test: `src/components/TodoItem.test.tsx` (tạo mới — dự án chưa có test cho TodoItem)

**Interfaces:**
- Không đổi props. Hành vi: click vùng nội dung → vào chế độ sửa.

- [ ] **Step 1: Viết test thất bại — click tiêu đề mở form sửa**

Tạo `src/components/TodoItem.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import { TodoItem } from './TodoItem';
import type { Todo } from '../types/todo';

const todo: Todo = {
  id: '1', user_id: 'u', title: 'Mua sữa', notes: null, is_done: false,
  due_date: null, priority: 'medium', tags: [], recurrence: 'none',
  sort_order: 0, created_at: '', updated_at: '',
};

function renderItem() {
  return render(
    <DndContext>
      <SortableContext items={['1']}>
        <ul>
          <TodoItem todo={todo} today="2026-07-12" onToggle={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} />
        </ul>
      </SortableContext>
    </DndContext>,
  );
}

describe('TodoItem — click để sửa', () => {
  it('click vùng nội dung mở form sửa (hiện nút Lưu)', () => {
    renderItem();
    fireEvent.click(screen.getByRole('button', { name: /sửa việc: mua sữa/i }));
    expect(screen.getByRole('button', { name: 'Lưu' })).toBeInTheDocument();
  });
});
```

> Kiểm tra `@testing-library/react` đã có trong devDependencies. Nếu chưa: `npm i -D @testing-library/react @testing-library/jest-dom` và đảm bảo `src/test/setup.ts` import `@testing-library/jest-dom`. Xem [TodoCell.test.tsx](../../../src/components/TodoCell.test.tsx) làm mẫu cách render component trong repo này.

- [ ] **Step 2: Chạy test — xác nhận FAIL**

Run: `npm test -- src/components/TodoItem.test.tsx`
Expected: FAIL — chưa có phần tử `role="button"` tên "Sửa việc: Mua sữa".

- [ ] **Step 3: Biến vùng nội dung thành clickable**

Trong `src/components/TodoItem.tsx`, khối hiển thị (không sửa), đổi `<div className="flex min-w-0 flex-1 flex-col gap-[5px]">` (dòng 165) thành phần tử bấm được:

```tsx
      <div
        role="button"
        tabIndex={0}
        onClick={() => setEditing(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setEditing(true);
          }
        }}
        aria-label={`Sửa việc: ${todo.title}`}
        className="flex min-w-0 flex-1 cursor-pointer flex-col gap-[5px] rounded-md focus:outline-none focus:ring-2 focus:ring-primary/40 dark:focus:ring-primary-dark/40"
      >
```

- [ ] **Step 4: Chặn lan click cho nút xem ghi chú `▾`**

Trong cùng khối, nút toggle ghi chú (dòng ~177-188) thêm `stopPropagation` vào `onClick`:

```tsx
              onClick={(e) => {
                e.stopPropagation();
                setShowNotes((v) => !v);
              }}
```

- [ ] **Step 5: Bỏ nút ✎ (click dòng đã thay thế), giữ ✕**

Trong khối action cuối (dòng 231-243), xóa nút Sửa `✎`. Kết quả còn:

```tsx
      <div className="flex flex-none items-center gap-2">
        <PriorityBadge priority={todo.priority} />
        <button
          onClick={() => onDelete(todo.id)}
          aria-label="Xóa"
          className="flex h-7 w-7 flex-none items-center justify-center rounded-lg text-[13px] text-text-muted transition hover:bg-red-50 hover:text-red-600 active:scale-95 dark:text-text-muted-dark dark:hover:bg-red-950/50 dark:hover:text-red-300"
        >
          ✕
        </button>
      </div>
```

- [ ] **Step 6: Chạy test — xác nhận PASS**

Run: `npm test -- src/components/TodoItem.test.tsx`
Expected: PASS.

- [ ] **Step 7: Build + full test**

Run: `npm run build && npm test`
Expected: build thành công, toàn bộ test xanh.

- [ ] **Step 8: Commit**

```bash
git add src/components/TodoItem.tsx src/components/TodoItem.test.tsx
git commit -m "feat(todo): click dòng việc mở form sửa, bỏ nút ✎ riêng"
```

---

## Tính năng 1 — Sidebar: nav dọc + thu gọn

### Task 8: Hook `useSidebarCollapsed` — trạng thái + persist

**Files:**
- Create: `src/hooks/useSidebarCollapsed.ts`
- Test: `src/hooks/useSidebarCollapsed.test.ts`

**Interfaces:**
- Produces: `useSidebarCollapsed(): { collapsed: boolean; toggle: () => void }` — đọc/ghi `localStorage['apptodo-sidebar-collapsed']` (`'1'` = thu gọn), mặc định mở (`false`).

- [ ] **Step 1: Viết test thất bại**

Tạo `src/hooks/useSidebarCollapsed.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSidebarCollapsed } from './useSidebarCollapsed';

describe('useSidebarCollapsed', () => {
  beforeEach(() => localStorage.clear());

  it('mặc định mở (không thu gọn)', () => {
    const { result } = renderHook(() => useSidebarCollapsed());
    expect(result.current.collapsed).toBe(false);
  });

  it('toggle đổi trạng thái và ghi localStorage', () => {
    const { result } = renderHook(() => useSidebarCollapsed());
    act(() => result.current.toggle());
    expect(result.current.collapsed).toBe(true);
    expect(localStorage.getItem('apptodo-sidebar-collapsed')).toBe('1');
  });

  it('đọc lại trạng thái đã lưu', () => {
    localStorage.setItem('apptodo-sidebar-collapsed', '1');
    const { result } = renderHook(() => useSidebarCollapsed());
    expect(result.current.collapsed).toBe(true);
  });
});
```

- [ ] **Step 2: Chạy test — xác nhận FAIL**

Run: `npm test -- src/hooks/useSidebarCollapsed.test.ts`
Expected: FAIL — chưa có module.

- [ ] **Step 3: Viết hook**

Tạo `src/hooks/useSidebarCollapsed.ts`:

```ts
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'apptodo-sidebar-collapsed';

/** Trạng thái thu gọn sidebar (desktop), nhớ qua localStorage. */
export function useSidebarCollapsed(): { collapsed: boolean; toggle: () => void } {
  const [collapsed, setCollapsed] = useState<boolean>(
    () => localStorage.getItem(STORAGE_KEY) === '1',
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  const toggle = () => setCollapsed((c) => !c);
  return { collapsed, toggle };
}
```

- [ ] **Step 4: Chạy test — xác nhận PASS**

Run: `npm test -- src/hooks/useSidebarCollapsed.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useSidebarCollapsed.ts src/hooks/useSidebarCollapsed.test.ts
git commit -m "feat(sidebar): hook useSidebarCollapsed (nhớ trạng thái localStorage)"
```

---

### Task 9: Sidebar — nav dọc + chế độ thu gọn

**Files:**
- Modify: `src/components/Sidebar.tsx`

**Interfaces:**
- Consumes: `useSidebarCollapsed` (Task 8).
- Không đổi props từ AppPage (hook tự chứa trong Sidebar).

- [ ] **Step 1: Import hook + khai báo danh sách trang có icon**

Trong `src/components/Sidebar.tsx`:
- Thêm import:

```tsx
import { useSidebarCollapsed } from '../hooks/useSidebarCollapsed';
```

- Sau khối `const VIEWS = [...]` (dòng 22) thêm:

```tsx
const PAGES: { key: Props['page']; label: string; icon: string }[] = [
  { key: 'todos', label: 'Việc', icon: '✓' },
  { key: 'plan', label: 'Kế hoạch', icon: '◎' },
  { key: 'stocks', label: 'Cổ phiếu', icon: '▤' },
];
```

- Trong thân component, ngay sau `export function Sidebar({...}: Props) {` thêm:

```tsx
  const { collapsed, toggle } = useSidebarCollapsed();
```

- [ ] **Step 2: Đổi `<aside>` để đổi bề rộng theo trạng thái**

Đổi className của `<aside>` (dòng 38) — bề rộng có điều kiện:

```tsx
    <aside
      className={`hidden flex-none flex-col gap-1 border-r border-border bg-surface py-[18px] md:flex dark:border-border-dark dark:bg-surface-dark ${
        collapsed ? 'w-[64px] px-2' : 'w-[258px] px-3.5'
      }`}
    >
```

- [ ] **Step 3: Logo + nút thu gọn**

Thay khối Logo (dòng 40-45) bằng logo + nút toggle (ẩn tiêu đề khi thu gọn):

```tsx
      {/* Logo + nút thu gọn */}
      <div className={`flex items-center pb-3.5 pt-0.5 ${collapsed ? 'justify-center' : 'gap-2.5 px-1.5'}`}>
        <div className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[9px] bg-primary text-[15px] font-bold text-white dark:bg-primary-dark">
          ✓
        </div>
        {!collapsed && (
          <>
            <div className="flex-1 text-[15.5px] font-bold tracking-tight text-text dark:text-text-dark">Việc của tôi</div>
            <button
              onClick={toggle}
              aria-label="Thu gọn thanh bên"
              title="Thu gọn"
              className="btn-icon h-7 w-7 flex-none text-sm"
            >
              «
            </button>
          </>
        )}
      </div>
      {collapsed && (
        <button
          onClick={toggle}
          aria-label="Mở rộng thanh bên"
          title="Mở rộng"
          className="btn-icon mx-auto mb-1 h-7 w-7 flex-none text-sm"
        >
          »
        </button>
      )}
```

- [ ] **Step 4: Nav dọc thay 3 pill ngang**

Thay toàn bộ khối "Chuyển trang" (dòng 47-82, cụm `<div className="mb-2 flex gap-0.5 ...">`) bằng nav dọc:

```tsx
      {/* Chuyển trang: nav dọc */}
      <nav className="mb-2 flex flex-col gap-0.5">
        {PAGES.map((p) => {
          const active = page === p.key;
          return (
            <button
              key={p.key}
              onClick={() => onPage(p.key)}
              aria-current={active ? 'page' : undefined}
              title={collapsed ? p.label : undefined}
              className={`flex items-center gap-2.5 rounded-[9px] border-l-2 py-2 text-sm transition-colors ${
                collapsed ? 'justify-center px-0' : 'px-2.5'
              } ${
                active
                  ? 'border-primary bg-primary-soft font-semibold text-primary dark:border-primary-dark dark:bg-primary-soft-dark dark:text-primary-dark'
                  : 'border-transparent font-medium text-text hover:bg-surface-2 dark:text-text-dark dark:hover:bg-surface-2dark'
              }`}
            >
              <span className="text-base leading-none">{p.icon}</span>
              {!collapsed && <span className="flex-1 text-left">{p.label}</span>}
            </button>
          );
        })}
      </nav>
```

- [ ] **Step 5: Ẩn Smart Views + Nhãn khi thu gọn**

Bọc điều kiện `page === 'todos'` hiện tại (dòng 84) thêm `!collapsed`:

```tsx
      {page === 'todos' && !collapsed && (
```

- [ ] **Step 6: Khối tài khoản gọn khi thu gọn**

Thay khối "Tài khoản" (dòng 149-165) để khi thu gọn chỉ hiện avatar + nút đăng xuất xếp dọc:

```tsx
      {/* Tài khoản */}
      <div
        className={`mt-2 flex items-center border-t border-border pb-1 pt-2.5 dark:border-border-dark ${
          collapsed ? 'flex-col gap-2' : 'gap-2.5 px-2'
        }`}
      >
        <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-primary-soft text-[13px] font-bold uppercase text-primary dark:bg-primary-soft-dark dark:text-primary-dark">
          {userEmail.charAt(0) || '?'}
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] text-text-muted dark:text-text-muted-dark">{userEmail}</div>
          </div>
        )}
        <button
          onClick={onSignOut}
          title="Đăng xuất"
          aria-label="Đăng xuất"
          className="btn-icon h-[30px] w-[30px] flex-none text-[15px]"
        >
          ⏻
        </button>
      </div>
```

- [ ] **Step 7: Build — xác nhận PASS**

Run: `npm run build`
Expected: build thành công, không lỗi TS.

- [ ] **Step 8: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat(sidebar): nav dọc có icon + thu gọn thành thanh icon hẹp"
```

---

## Xác minh cuối (sau khi xong 9 task)

- [ ] **Chạy full test + build**

Run: `npm test && npm run build`
Expected: tất cả xanh, build thành công.

- [ ] **Xác minh app thật** (dùng skill `/run` hoặc `npm run dev`):
  - Sidebar: bấm « thu gọn còn thanh icon, » mở lại; reload vẫn nhớ; đổi trang bằng nav dọc.
  - Cổ phiếu: gõ tìm theo mã và tên; mã có giá > giá bảo vệ đỏ, mã ≤ giá ngưỡng xanh; chú thích màu hiện dưới bảng.
  - Việc: click vào một việc mở form sửa; checkbox/kéo/xóa vẫn hoạt động độc lập; chọn được lặp "Hàng ngày".
- [ ] **Nhắc NewPL** chạy `supabase/migrations/2026-07-12-recurrence-daily.sql` trên Supabase trước khi dùng lặp hàng ngày thật.

## Ghi chú self-review (đối chiếu spec)

- TN1 sidebar → Task 8-9 ✓ (nav dọc + collapse + persist).
- TN2 cổ phiếu → Task 3 (search) + Task 4-5 (màu) + Task 6 (UI + caption) ✓.
- TN3 click sửa → Task 7 ✓ (clickable + bỏ ✎ + a11y).
- TN4 lặp ngày → Task 1-2 ✓ (type + nextDueDate + 2 form + migration DB).
- Không placeholder; tên hàm nhất quán (`filterStocks`, `isAboveProtect`, `useSidebarCollapsed`).
