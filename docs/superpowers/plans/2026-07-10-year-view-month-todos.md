# Liệt kê công việc trong ô tháng (chế độ Năm) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trong chế độ xem **Năm** của trang Kế hoạch, mỗi ô tháng liệt kê tối đa 6 công việc (todo) có hạn trong tháng đó, có nút "xem thêm" để bung/thu gọn tại chỗ.

**Architecture:** Tách logic thuần vào `src/lib/monthCell.ts` (gom todo theo tháng + cắt 6), test bằng Vitest. Thêm 2 component chỉ dùng cho chế độ Năm: `MonthCell` (1 ô tháng, tự giữ state mở rộng) và `MonthGrid` (lưới 4 cột). `PlanPage` render `MonthGrid` khi `horizon === 'year'`, giữ `PeriodGrid` cũ cho chế độ 5 Năm.

**Tech Stack:** React + TypeScript + Tailwind CSS, Vitest.

## Global Constraints

- TypeScript ở mọi nơi; tránh `any`.
- Style bằng class Tailwind; hỗ trợ dark mode qua class `dark:`.
- Component trong `src/components/`, logic tái dùng trong `src/lib/`.
- Giao diện tiếng Việt; thuật ngữ kỹ thuật giữ tiếng Anh.
- Không nuốt lỗi im lặng.
- Trước khi báo xong: chạy `npm test` và `npm run build`, xác nhận pass.
- Spec nguồn: `docs/superpowers/specs/2026-07-10-year-view-month-todos-design.md`.

---

### Task 1: Logic thuần dựng dữ liệu ô tháng (`src/lib/monthCell.ts`)

**Files:**
- Create: `src/lib/monthCell.ts`
- Test: `src/lib/monthCell.test.ts`

**Interfaces:**
- Consumes (từ code hiện có):
  - `getChildPeriods(horizon, periodKey): string[]` từ `src/lib/goalFilters.ts`
  - `getPeriodRange(horizon, periodKey): { start: string; end: string }` từ `src/lib/goalFilters.ts`
  - `sortByDoneThenOrder(todos: Todo[]): Todo[]` từ `src/lib/todoFilters.ts`
  - `type Todo` từ `src/types/todo.ts` (`due_date: string | null`, `is_done: boolean`, `sort_order: number`)
- Produces (các task sau dùng):
  - `interface MonthCellData { key: string; monthLabel: string; todos: Todo[]; doneCount: number; totalCount: number }`
  - `function buildMonthCells(todos: Todo[], yearPeriodKey: string): MonthCellData[]` — 12 phần tử, tháng 01→12.
  - `interface VisibleTodos { visible: Todo[]; overflow: number }`
  - `function visibleTodos(todos: Todo[], expanded: boolean, max?: number): VisibleTodos` — `max` mặc định 6.

- [ ] **Step 1: Viết test thất bại** — tạo `src/lib/monthCell.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildMonthCells, visibleTodos } from './monthCell';
import type { Todo } from '../types/todo';

function todo(partial: Partial<Todo>): Todo {
  return {
    id: 'id',
    user_id: 'u',
    title: 't',
    notes: null,
    is_done: false,
    due_date: null,
    priority: 'medium',
    tags: [],
    recurrence: 'none',
    sort_order: 0,
    created_at: '',
    updated_at: '',
    ...partial,
  };
}

describe('buildMonthCells', () => {
  it('trả về 12 tháng với nhãn "Tháng MM" theo thứ tự 01→12', () => {
    const cells = buildMonthCells([], '2026');
    expect(cells).toHaveLength(12);
    expect(cells[0].key).toBe('2026-01');
    expect(cells[0].monthLabel).toBe('Tháng 01');
    expect(cells[11].key).toBe('2026-12');
    expect(cells[11].monthLabel).toBe('Tháng 12');
  });

  it('gom todo vào đúng tháng theo due_date, kể cả biên đầu/cuối tháng', () => {
    const todos = [
      todo({ id: 'a', due_date: '2026-01-01' }), // biên đầu
      todo({ id: 'b', due_date: '2026-01-31' }), // biên cuối
      todo({ id: 'c', due_date: '2026-02-15' }),
    ];
    const cells = buildMonthCells(todos, '2026');
    expect(cells[0].todos.map((t) => t.id)).toEqual(['a', 'b']);
    expect(cells[0].totalCount).toBe(2);
    expect(cells[1].todos.map((t) => t.id)).toEqual(['c']);
  });

  it('todo due_date = null không rơi vào tháng nào', () => {
    const cells = buildMonthCells([todo({ id: 'x', due_date: null })], '2026');
    expect(cells.every((c) => c.totalCount === 0)).toBe(true);
  });

  it('đếm doneCount/totalCount đúng', () => {
    const todos = [
      todo({ id: 'a', due_date: '2026-03-05', is_done: true }),
      todo({ id: 'b', due_date: '2026-03-06', is_done: false }),
      todo({ id: 'c', due_date: '2026-03-07', is_done: true }),
    ];
    const march = buildMonthCells(todos, '2026')[2];
    expect(march.totalCount).toBe(3);
    expect(march.doneCount).toBe(2);
  });

  it('sắp việc chưa xong lên trước, đã xong xuống sau', () => {
    const todos = [
      todo({ id: 'done', due_date: '2026-04-01', is_done: true, sort_order: 1 }),
      todo({ id: 'open', due_date: '2026-04-02', is_done: false, sort_order: 2 }),
    ];
    const april = buildMonthCells(todos, '2026')[3];
    expect(april.todos.map((t) => t.id)).toEqual(['open', 'done']);
  });
});

describe('visibleTodos', () => {
  const list = Array.from({ length: 8 }, (_, i) =>
    todo({ id: String(i), due_date: '2026-05-01' }),
  );

  it('≤ max → hiện hết, overflow 0', () => {
    const three = list.slice(0, 3);
    expect(visibleTodos(three, false)).toEqual({ visible: three, overflow: 0 });
  });

  it('> max, chưa mở rộng → cắt còn max, overflow = phần dư', () => {
    const res = visibleTodos(list, false);
    expect(res.visible).toHaveLength(6);
    expect(res.overflow).toBe(2);
  });

  it('> max, đã mở rộng → hiện hết, overflow 0', () => {
    const res = visibleTodos(list, true);
    expect(res.visible).toHaveLength(8);
    expect(res.overflow).toBe(0);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `npm test -- src/lib/monthCell.test.ts`
Expected: FAIL — không import được `buildMonthCells`/`visibleTodos` (module chưa tồn tại).

- [ ] **Step 3: Viết implementation tối thiểu** — tạo `src/lib/monthCell.ts`:

```ts
import type { Todo } from '../types/todo';
import { getChildPeriods, getPeriodRange } from './goalFilters';
import { sortByDoneThenOrder } from './todoFilters';

export interface MonthCellData {
  key: string; // 'YYYY-MM'
  monthLabel: string; // 'Tháng MM'
  todos: Todo[]; // todo trong tháng, đã sort việc-chưa-xong-trước
  doneCount: number;
  totalCount: number;
}

/** Dựng dữ liệu 12 ô tháng của một năm cho chế độ xem Năm. */
export function buildMonthCells(todos: Todo[], yearPeriodKey: string): MonthCellData[] {
  return getChildPeriods('year', yearPeriodKey).map((key) => {
    const { start, end } = getPeriodRange('month', key);
    const inMonth = todos.filter(
      (t) => t.due_date !== null && t.due_date >= start && t.due_date <= end,
    );
    const sorted = sortByDoneThenOrder(inMonth);
    return {
      key,
      monthLabel: `Tháng ${key.slice(5)}`,
      todos: sorted,
      doneCount: sorted.filter((t) => t.is_done).length,
      totalCount: sorted.length,
    };
  });
}

export interface VisibleTodos {
  visible: Todo[];
  overflow: number;
}

/**
 * Việc để hiển thị trong ô tháng: khi chưa mở rộng cắt còn `max` dòng, phần dư
 * gộp vào `overflow`; khi đã mở rộng hiện hết. Giữ nguyên thứ tự đầu vào.
 */
export function visibleTodos(todos: Todo[], expanded: boolean, max = 6): VisibleTodos {
  if (expanded || todos.length <= max) return { visible: todos, overflow: 0 };
  return { visible: todos.slice(0, max), overflow: todos.length - max };
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npm test -- src/lib/monthCell.test.ts`
Expected: PASS (tất cả test trong file).

- [ ] **Step 5: Commit**

```bash
git add src/lib/monthCell.ts src/lib/monthCell.test.ts
git commit -m "feat: logic dựng dữ liệu ô tháng + cắt 6 việc cho chế độ Năm"
```

---

### Task 2: Component `MonthCell` + `MonthGrid`

**Files:**
- Create: `src/components/MonthCell.tsx`
- Create: `src/components/MonthGrid.tsx`

**Interfaces:**
- Consumes (từ Task 1):
  - `type MonthCellData` và `visibleTodos(todos, expanded, max?)` từ `src/lib/monthCell.ts`
  - `type Todo` từ `src/types/todo.ts`
- Produces (Task 3 dùng):
  - `MonthGrid` props: `{ cells: MonthCellData[]; onSelect: (key: string) => void }`
  - `MonthCell` props: `{ data: MonthCellData; onSelect: () => void }`

Không có test tự động cho component (dự án chỉ test logic thuần); kiểm chứng bằng build ở Task 3 và chạy app.

- [ ] **Step 1: Tạo `src/components/MonthCell.tsx`**

```tsx
import { useState } from 'react';
import type { MonthCellData } from '../lib/monthCell';
import { visibleTodos } from '../lib/monthCell';

interface Props {
  data: MonthCellData;
  onSelect: () => void;
}

/**
 * 1 ô tháng trong chế độ Năm: nhãn tháng (bấm để đi xuống chế độ Tháng) + số
 * done/total, và danh sách todo trong tháng. Mặc định hiện tối đa 6 việc; nếu
 * nhiều hơn có nút bung/thu gọn tại chỗ (state cục bộ trong ô này).
 */
export function MonthCell({ data, onSelect }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { visible, overflow } = visibleTodos(data.todos, expanded);

  return (
    <div className="flex min-h-[7rem] flex-col gap-1 rounded-lg border border-border bg-surface p-1.5 dark:border-border-dark dark:bg-surface-dark">
      <button
        type="button"
        onClick={onSelect}
        className="flex items-baseline justify-between gap-1 text-left transition-colors hover:text-primary dark:hover:text-primary-dark"
      >
        <span className="text-xs font-semibold text-text dark:text-text-dark">{data.monthLabel}</span>
        {data.totalCount > 0 && (
          <span className="text-[10px] text-text-muted dark:text-text-muted-dark">
            {data.doneCount}/{data.totalCount}
          </span>
        )}
      </button>

      <div className="flex flex-col gap-0.5">
        {visible.map((t) => (
          <span
            key={t.id}
            className={`truncate rounded px-1 text-[10px] ${
              t.is_done
                ? 'text-text-muted line-through dark:text-text-muted-dark'
                : 'bg-primary-soft text-primary dark:bg-primary-soft-dark dark:text-primary-dark'
            }`}
          >
            {t.title}
          </span>
        ))}
      </div>

      {(overflow > 0 || expanded) && data.totalCount > 6 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-auto self-start px-1 text-[10px] text-text-muted underline-offset-2 hover:underline dark:text-text-muted-dark"
        >
          {expanded ? 'thu gọn' : `+${overflow} xem thêm`}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Tạo `src/components/MonthGrid.tsx`**

```tsx
import type { MonthCellData } from '../lib/monthCell';
import { MonthCell } from './MonthCell';

interface Props {
  cells: MonthCellData[];
  onSelect: (key: string) => void;
}

/** Lưới 12 ô tháng (4 cột) cho chế độ Năm — mỗi ô liệt kê việc trong tháng. */
export function MonthGrid({ cells, onSelect }: Props) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
      {cells.map((c) => (
        <MonthCell key={c.key} data={c} onSelect={() => onSelect(c.key)} />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Xác nhận biên dịch** — chạy TypeScript qua build nhanh:

Run: `npm run build`
Expected: PASS — không lỗi type. (Nếu báo `MonthGrid`/`MonthCell` chưa được dùng ở đâu thì bỏ qua, sẽ nối vào Task 3.)

- [ ] **Step 4: Commit**

```bash
git add src/components/MonthCell.tsx src/components/MonthGrid.tsx
git commit -m "feat: component MonthCell + MonthGrid liệt kê việc trong ô tháng"
```

---

### Task 3: Nối `MonthGrid` vào `PlanPage` cho chế độ Năm

**Files:**
- Modify: `src/components/PlanPage.tsx`

**Interfaces:**
- Consumes: `buildMonthCells(todos, periodKey)` + `type MonthCellData` từ `src/lib/monthCell.ts`; `MonthGrid` từ `src/components/MonthGrid.tsx`.
- Behavior giữ nguyên: bấm nhãn tháng gọi `handleSelectCell(key)` → đang xử lý `horizon === 'year'` bằng cách xuống chế độ Tháng.

- [ ] **Step 1: Thêm import** ở đầu `src/components/PlanPage.tsx` (cạnh các import component khác, sau dòng import `PeriodGrid`):

```tsx
import { MonthGrid } from './MonthGrid';
import { buildMonthCells } from '../lib/monthCell';
import type { MonthCellData } from '../lib/monthCell';
```

- [ ] **Step 2: Bỏ nhánh `year` khỏi memo `grid`** — trong `PlanPage.tsx`, sửa memo `grid` để chỉ còn lo chế độ 5 Năm (chế độ Năm sẽ có memo riêng). Đổi khối:

```tsx
    if (horizon === 'five_year') {
      return { columns: 5, leadingBlanks: 0, cells: yearOrFiveYearCells('year', getChildPeriods('five_year', periodKey)) };
    }
    if (horizon === 'year') {
      return { columns: 4, leadingBlanks: 0, cells: yearOrFiveYearCells('month', getChildPeriods('year', periodKey)) };
    }
    return null;
```

thành:

```tsx
    if (horizon === 'five_year') {
      return { columns: 5, leadingBlanks: 0, cells: yearOrFiveYearCells('year', getChildPeriods('five_year', periodKey)) };
    }
    return null;
```

Lưu ý: hàm nội bộ `yearOrFiveYearCells` giờ chỉ còn được gọi với `'year'` (cho 5 Năm). Giữ nguyên hàm — không cần sửa.

- [ ] **Step 3: Thêm memo `monthCells`** — ngay sau memo `grid` (trước `dayGrid`):

```tsx
  const monthCells = useMemo(
    (): MonthCellData[] | null => (horizon === 'year' ? buildMonthCells(todos, periodKey) : null),
    [horizon, periodKey, todos],
  );
```

- [ ] **Step 4: Render `MonthGrid` khi ở chế độ Năm** — trong phần JSX, thay khối render lưới (nhánh `grid ? ... : ...` cuối cùng) để ưu tiên `monthCells`. Tìm khối:

```tsx
          {dayGrid ? (
            <DayGrid
              leadingBlanks={dayGrid.leadingBlanks}
              cells={dayGrid.cells}
              today={today}
              openDay={openDay}
              maxLines={3}
              onOpen={setOpenDay}
              onClose={() => setOpenDay(null)}
              onAdd={handleAddOnDay}
              onToggle={onToggleTodo}
              onOpenFull={handleOpenFull}
            />
          ) : (
            grid && (
              <PeriodGrid
                columns={grid.columns}
                leadingBlanks={grid.leadingBlanks}
                cells={grid.cells}
                onSelect={handleSelectCell}
              />
            )
          )}
```

thay thành:

```tsx
          {dayGrid ? (
            <DayGrid
              leadingBlanks={dayGrid.leadingBlanks}
              cells={dayGrid.cells}
              today={today}
              openDay={openDay}
              maxLines={3}
              onOpen={setOpenDay}
              onClose={() => setOpenDay(null)}
              onAdd={handleAddOnDay}
              onToggle={onToggleTodo}
              onOpenFull={handleOpenFull}
            />
          ) : monthCells ? (
            <MonthGrid cells={monthCells} onSelect={handleSelectCell} />
          ) : (
            grid && (
              <PeriodGrid
                columns={grid.columns}
                leadingBlanks={grid.leadingBlanks}
                cells={grid.cells}
                onSelect={handleSelectCell}
              />
            )
          )}
```

- [ ] **Step 5: Chạy test + build để xác nhận không vỡ**

Run: `npm test && npm run build`
Expected: PASS cả hai. (`npm test` xác nhận logic Task 1 vẫn xanh; `npm run build` xác nhận type ở PlanPage đúng và không còn code chết — `grid` không còn tạo nhánh `year`.)

- [ ] **Step 6: Kiểm chứng bằng app (thủ công)**

Run: `npm run dev`, mở trang Kế hoạch → tab **Năm**. Xác nhận:
- Mỗi ô tháng liệt kê việc có hạn trong tháng (việc chưa xong trước, đã xong gạch ngang).
- Tháng có > 6 việc: hiện 6 việc + nút `+N xem thêm`; bấm → bung hết, nút đổi `thu gọn`; bấm lại → thu về 6.
- Bấm nhãn `Tháng MM` → xuống chế độ Tháng đúng tháng đó.
- Tab **5 Năm** vẫn hiện 5 ô năm như cũ (không đổi).

- [ ] **Step 7: Commit**

```bash
git add src/components/PlanPage.tsx
git commit -m "feat: chế độ Năm hiển thị việc trong ô tháng qua MonthGrid"
```

---

## Self-Review (đã rà)

**Spec coverage:**
- Liệt kê todo trong tháng, tối đa 6 → Task 1 (`buildMonthCells`, `visibleTodos`) + Task 2 (`MonthCell`).
- Nút "xem thêm" bung/thu gọn tại chỗ, state cục bộ → Task 2 (`MonthCell` `expanded`).
- Giữ lưới 4 cột × 3 hàng, ô cao lên → Task 2 (`MonthGrid` 4 cột, `MonthCell` `min-h-[7rem]`).
- Bấm nhãn tháng đi xuống chế độ Tháng → Task 3 (`onSelect` → `handleSelectCell`).
- Count done/total theo todo trong tháng → Task 1 (`doneCount`/`totalCount`).
- 5 Năm giữ nguyên → Task 3 giữ `PeriodGrid` cho `five_year`.
- Việc đã xong gạch ngang, chưa xong nền primary → Task 2 (class theo `is_done`).
- Test logic thuần → Task 1 (`monthCell.test.ts`).

**Placeholder scan:** không có TBD/TODO; mọi step có code hoặc lệnh cụ thể.

**Type consistency:** `MonthCellData`, `buildMonthCells`, `visibleTodos` dùng đồng nhất giữa Task 1→3; props `MonthGrid { cells, onSelect }` và `MonthCell { data, onSelect }` khớp cách gọi ở Task 3.

**Ngoài phạm vi (không làm):** không toggle/sửa việc trong ô tháng; không đổi 5 Năm/Tháng/Tuần/Ngày; không đổi số cột; không phân trang.
