# Lịch ngày kiểu Google Calendar + thêm việc nhanh — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ở tab Kế hoạch (tầng Tháng/Tuần), ô ngày to lên và hiện danh sách việc bên trong; click ô ngày mở popover để thêm việc trực tiếp vào ngày đó.

**Architecture:** Tách riêng lưới ngày (Tháng/Tuần) thành 3 component mới `DayGrid` / `DayCell` / `DayPopover`, giữ nguyên `PeriodGrid`/`PeriodCell` cho tầng Năm/5 Năm. Một hàm thuần `dayCellItems` (có unit test) lo phần cắt danh sách hiển thị. `PlanPage` giữ state `openDay` và nối `addTodo` từ `AppPage`.

**Tech Stack:** React + TypeScript + Tailwind CSS, Vitest.

## Global Constraints

- TypeScript ở mọi nơi; tránh `any`.
- Style bằng class Tailwind; hỗ trợ dark mode qua class `dark:`.
- Không nuốt lỗi im lặng (lỗi thêm việc/đồng bộ vẫn báo qua `ErrorBanner` sẵn có).
- Giao diện tiếng Việt.
- Việc thêm từ popover mặc định: `priority = 'medium'`, `tags = []`, `recurrence = 'none'`.
- Hiển thị tối đa **3** dòng việc trong ô, dư thì "+N việc".
- Trước khi báo xong: chạy `npm test` và `npm run build`, xác nhận pass.

---

### Task 1: Hàm thuần `dayCellItems` + unit test

**Files:**
- Create: `src/lib/dayCell.ts`
- Test: `src/lib/dayCell.test.ts`

**Interfaces:**
- Consumes: `Todo` từ `src/types/todo.ts`.
- Produces:
  - `interface DayCellLine { id: string; title: string; is_done: boolean }`
  - `interface DayCellItems { lines: DayCellLine[]; overflow: number }`
  - `function dayCellItems(todos: Todo[], date: string, max: number): DayCellItems`

- [ ] **Step 1: Viết test thất bại**

Tạo `src/lib/dayCell.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { dayCellItems } from './dayCell';
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

describe('dayCellItems', () => {
  it('ngày không có việc → rỗng', () => {
    const todos = [todo({ id: 'a', due_date: '2026-06-11' })];
    expect(dayCellItems(todos, '2026-06-10', 3)).toEqual({ lines: [], overflow: 0 });
  });

  it('số việc ≤ max → trả hết, overflow 0', () => {
    const todos = [
      todo({ id: 'a', title: 'A', due_date: '2026-06-10' }),
      todo({ id: 'b', title: 'B', due_date: '2026-06-10', is_done: true }),
    ];
    expect(dayCellItems(todos, '2026-06-10', 3)).toEqual({
      lines: [
        { id: 'a', title: 'A', is_done: false },
        { id: 'b', title: 'B', is_done: true },
      ],
      overflow: 0,
    });
  });

  it('số việc > max → cắt còn max dòng, overflow là phần dư', () => {
    const todos = [
      todo({ id: 'a', title: 'A', due_date: '2026-06-10' }),
      todo({ id: 'b', title: 'B', due_date: '2026-06-10' }),
      todo({ id: 'c', title: 'C', due_date: '2026-06-10' }),
      todo({ id: 'd', title: 'D', due_date: '2026-06-10' }),
      todo({ id: 'e', title: 'E', due_date: '2026-06-10' }),
    ];
    const result = dayCellItems(todos, '2026-06-10', 3);
    expect(result.lines.map((l) => l.id)).toEqual(['a', 'b', 'c']);
    expect(result.overflow).toBe(2);
  });

  it('chỉ lấy việc đúng ngày', () => {
    const todos = [
      todo({ id: 'a', due_date: '2026-06-10' }),
      todo({ id: 'b', due_date: '2026-06-09' }),
      todo({ id: 'c', due_date: null }),
    ];
    expect(dayCellItems(todos, '2026-06-10', 3).lines.map((l) => l.id)).toEqual(['a']);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Run: `npm test -- src/lib/dayCell.test.ts`
Expected: FAIL — không import được `dayCellItems` (module chưa tồn tại).

- [ ] **Step 3: Viết implementation tối thiểu**

Tạo `src/lib/dayCell.ts`:

```ts
import type { Todo } from '../types/todo';

export interface DayCellLine {
  id: string;
  title: string;
  is_done: boolean;
}

export interface DayCellItems {
  lines: DayCellLine[];
  overflow: number;
}

/**
 * Việc của một ngày để hiển thị trong ô lịch: lấy tối đa `max` dòng đầu,
 * phần dư gộp vào `overflow`. Giữ nguyên thứ tự đầu vào (đã sắp ở nơi gọi).
 */
export function dayCellItems(todos: Todo[], date: string, max: number): DayCellItems {
  const onDate = todos.filter((t) => t.due_date === date);
  const lines = onDate
    .slice(0, max)
    .map((t) => ({ id: t.id, title: t.title, is_done: t.is_done }));
  return { lines, overflow: Math.max(0, onDate.length - max) };
}
```

- [ ] **Step 4: Chạy test để xác nhận PASS**

Run: `npm test -- src/lib/dayCell.test.ts`
Expected: PASS (4 test).

- [ ] **Step 5: Commit**

```bash
git add src/lib/dayCell.ts src/lib/dayCell.test.ts
git commit -m "feat: dayCellItems — cắt danh sách việc hiển thị trong ô lịch ngày"
```

---

### Task 2: Component `DayPopover`

**Files:**
- Create: `src/components/DayPopover.tsx`

**Interfaces:**
- Consumes: `Todo` từ `src/types/todo.ts`.
- Produces:
  ```ts
  interface DayPopoverProps {
    date: string;                                 // 'YYYY-MM-DD'
    todos: Todo[];                                // việc của đúng ngày này
    onAdd: (title: string) => void;
    onToggle: (id: string, done: boolean) => void;
    onOpenFull: () => void;
    onClose: () => void;
  }
  export function DayPopover(props: DayPopoverProps): JSX.Element
  ```

- [ ] **Step 1: Tạo component**

Tạo `src/components/DayPopover.tsx`:

```tsx
import { useEffect, useState } from 'react';
import type { Todo } from '../types/todo';

interface Props {
  date: string;
  todos: Todo[];
  onAdd: (title: string) => void;
  onToggle: (id: string, done: boolean) => void;
  onOpenFull: () => void;
  onClose: () => void;
}

/** 'YYYY-MM-DD' -> 'DD/MM'. */
function shortDate(date: string): string {
  const [, m, d] = date.split('-');
  return `${d}/${m}`;
}

/** Ô nổi khi click 1 ngày: thêm việc nhanh + danh sách việc + lối xuống tầng Ngày. */
export function DayPopover({ date, todos, onAdd, onToggle, onOpenFull, onClose }: Props) {
  const [title, setTitle] = useState('');

  // Đóng khi nhấn Esc (click ra ngoài xử lý bằng backdrop bên dưới).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    onAdd(t);
    setTitle('');
  }

  return (
    <>
      {/* Backdrop bắt click ra ngoài để đóng (kể cả click lại chính ô đó). */}
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div
        // Ngăn click bên trong nổi lên backdrop.
        onClick={(e) => e.stopPropagation()}
        className="absolute left-1/2 top-full z-20 mt-1 w-56 -translate-x-1/2 rounded-lg border border-border bg-surface p-3 text-left shadow-md dark:border-border-dark dark:bg-surface-dark dark:shadow-md-dark"
      >
        <div className="mb-2 text-xs font-semibold text-text dark:text-text-dark">
          Việc ngày {shortDate(date)}
        </div>

        <form onSubmit={submit} className="mb-2 flex gap-1">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Thêm việc…"
            aria-label={`Thêm việc ngày ${shortDate(date)}`}
            className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1 text-xs text-text outline-none placeholder:text-text-muted focus:border-primary dark:border-border-dark dark:bg-surface-2dark dark:text-text-dark dark:placeholder:text-text-muted-dark dark:focus:border-primary-dark"
          />
          <button
            type="submit"
            className="rounded-md bg-primary px-2 py-1 text-xs font-semibold text-white dark:bg-primary-dark"
          >
            Thêm
          </button>
        </form>

        {todos.length > 0 ? (
          <ul className="mb-2 flex max-h-40 flex-col gap-1 overflow-auto">
            {todos.map((t) => (
              <li key={t.id} className="flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={t.is_done}
                  onChange={() => onToggle(t.id, !t.is_done)}
                  aria-label={`Đánh dấu xong: ${t.title}`}
                  className="flex-none"
                />
                <span
                  className={`truncate ${
                    t.is_done
                      ? 'text-text-muted line-through dark:text-text-muted-dark'
                      : 'text-text dark:text-text-dark'
                  }`}
                >
                  {t.title}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-2 text-xs text-text-muted dark:text-text-muted-dark">Chưa có việc.</p>
        )}

        <button
          type="button"
          onClick={onOpenFull}
          className="text-xs font-medium text-primary hover:underline dark:text-primary-dark"
        >
          Mở ngày →
        </button>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Kiểm tra biên dịch**

Run: `npm run build`
Expected: build thành công, không lỗi TypeScript.

- [ ] **Step 3: Commit**

```bash
git add src/components/DayPopover.tsx
git commit -m "feat: DayPopover — thêm việc nhanh + danh sách việc trong ngày"
```

---

### Task 3: Component `DayCell` + `DayGrid`

**Files:**
- Create: `src/components/DayCell.tsx`
- Create: `src/components/DayGrid.tsx`

**Interfaces:**
- Consumes: `dayCellItems`, `DayPopover`, `Todo`.
- Produces:
  ```ts
  // DayCell.tsx
  interface DayCellProps {
    date: string;
    dayNumber: number;
    todos: Todo[];            // việc của đúng ngày này
    isToday: boolean;
    isOpen: boolean;
    maxLines: number;
    onOpen: () => void;
    onClose: () => void;
    onAdd: (title: string) => void;
    onToggle: (id: string, done: boolean) => void;
    onOpenFull: () => void;
  }
  export function DayCell(props: DayCellProps): JSX.Element

  // DayGrid.tsx
  export interface DayCellData { date: string; dayNumber: number; todos: Todo[] }
  interface DayGridProps {
    leadingBlanks: number;
    cells: DayCellData[];
    today: string;
    openDay: string | null;
    maxLines: number;
    onOpen: (date: string) => void;
    onClose: () => void;
    onAdd: (date: string, title: string) => void;
    onToggle: (id: string, done: boolean) => void;
    onOpenFull: (date: string) => void;
  }
  export function DayGrid(props: DayGridProps): JSX.Element
  ```

- [ ] **Step 1: Tạo `DayCell`**

Tạo `src/components/DayCell.tsx`:

```tsx
import { dayCellItems } from '../lib/dayCell';
import type { Todo } from '../types/todo';
import { DayPopover } from './DayPopover';

interface Props {
  date: string;
  dayNumber: number;
  todos: Todo[];
  isToday: boolean;
  isOpen: boolean;
  maxLines: number;
  onOpen: () => void;
  onClose: () => void;
  onAdd: (title: string) => void;
  onToggle: (id: string, done: boolean) => void;
  onOpenFull: () => void;
}

/** 1 ô ngày cao (kiểu Google Calendar): số ngày + vài việc; click mở popover. */
export function DayCell({
  date,
  dayNumber,
  todos,
  isToday,
  isOpen,
  maxLines,
  onOpen,
  onClose,
  onAdd,
  onToggle,
  onOpenFull,
}: Props) {
  const { lines, overflow } = dayCellItems(todos, date, maxLines);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onOpen}
        className={`flex min-h-[6rem] w-full flex-col gap-1 rounded-lg border bg-surface p-1.5 text-left transition-colors hover:border-primary dark:bg-surface-dark dark:hover:border-primary-dark ${
          isToday ? 'border-primary dark:border-primary-dark' : 'border-border dark:border-border-dark'
        }`}
      >
        <span
          className={`text-xs font-semibold ${
            isToday ? 'text-primary dark:text-primary-dark' : 'text-text dark:text-text-dark'
          }`}
        >
          {dayNumber}
        </span>
        <span className="flex flex-col gap-0.5">
          {lines.map((l) => (
            <span
              key={l.id}
              className={`truncate rounded px-1 text-[10px] ${
                l.is_done
                  ? 'text-text-muted line-through dark:text-text-muted-dark'
                  : 'bg-primary-soft text-primary dark:bg-primary-soft-dark dark:text-primary-dark'
              }`}
            >
              {l.title}
            </span>
          ))}
          {overflow > 0 && (
            <span className="px-1 text-[10px] text-text-muted dark:text-text-muted-dark">
              +{overflow} việc
            </span>
          )}
        </span>
      </button>

      {isOpen && (
        <DayPopover
          date={date}
          todos={todos}
          onAdd={onAdd}
          onToggle={onToggle}
          onOpenFull={onOpenFull}
          onClose={onClose}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Tạo `DayGrid`**

Tạo `src/components/DayGrid.tsx`:

```tsx
import type { Todo } from '../types/todo';
import { DayCell } from './DayCell';

export interface DayCellData {
  date: string;
  dayNumber: number;
  todos: Todo[];
}

interface Props {
  leadingBlanks: number;
  cells: DayCellData[];
  today: string;
  openDay: string | null;
  maxLines: number;
  onOpen: (date: string) => void;
  onClose: () => void;
  onAdd: (date: string, title: string) => void;
  onToggle: (id: string, done: boolean) => void;
  onOpenFull: (date: string) => void;
}

/** Lưới ngày kiểu Google Calendar cho tầng Tháng/Tuần (7 cột). */
export function DayGrid({
  leadingBlanks,
  cells,
  today,
  openDay,
  maxLines,
  onOpen,
  onClose,
  onAdd,
  onToggle,
  onOpenFull,
}: Props) {
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {Array.from({ length: leadingBlanks }).map((_, i) => (
        <div key={`blank-${i}`} />
      ))}
      {cells.map((c) => (
        <DayCell
          key={c.date}
          date={c.date}
          dayNumber={c.dayNumber}
          todos={c.todos}
          isToday={c.date === today}
          isOpen={openDay === c.date}
          maxLines={maxLines}
          onOpen={() => onOpen(c.date)}
          onClose={onClose}
          onAdd={(title) => onAdd(c.date, title)}
          onToggle={onToggle}
          onOpenFull={() => onOpenFull(c.date)}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Kiểm tra biên dịch**

Run: `npm run build`
Expected: build thành công (2 component mới, chưa dùng ở đâu — không lỗi type).

- [ ] **Step 4: Commit**

```bash
git add src/components/DayCell.tsx src/components/DayGrid.tsx
git commit -m "feat: DayCell + DayGrid — lưới ngày cao kiểu Google Calendar"
```

---

### Task 4: Nối vào `PlanPage` + `AppPage`

**Files:**
- Modify: `src/pages/AppPage.tsx:159-167` (truyền `onAddTodo`)
- Modify: `src/components/PlanPage.tsx` (state `openDay`, lưới ngày, handler)

**Interfaces:**
- Consumes: `DayGrid`, `DayCellData`, `addTodo` (kiểu `(input: NewTodo) => Promise<boolean>`), `NewTodo`.
- Produces: PlanPage nhận thêm prop `onAddTodo: (input: NewTodo) => void`.

- [ ] **Step 1: `AppPage` truyền `onAddTodo` vào `PlanPage`**

Trong `src/pages/AppPage.tsx`, khối `<PlanPage ... />` (khoảng dòng 159), thêm prop `onAddTodo={addTodo}`:

```tsx
            <PlanPage
              userId={userId}
              todos={todos}
              today={today}
              onAddTodo={addTodo}
              onToggleTodo={toggleDone}
              onUpdateTodo={updateTodo}
              onDeleteTodo={removeTodo}
              onReorderTodos={reorderGroup}
            />
```

- [ ] **Step 2: `PlanPage` — cập nhật import + Props**

Trong `src/components/PlanPage.tsx`:

Sửa import types (dòng 10) để thêm `NewTodo`:

```tsx
import type { Todo, NewTodo, TodoUpdate } from '../types/todo';
```

Thêm import `DayGrid` cạnh các import component (sau import `PeriodGrid`):

```tsx
import { DayGrid } from './DayGrid';
import type { DayCellData } from './DayGrid';
```

Thêm `onAddTodo` vào interface `Props`:

```tsx
interface Props {
  userId: string;
  todos: Todo[];
  today: string;
  onAddTodo: (input: NewTodo) => void;
  onToggleTodo: (id: string, done: boolean) => void;
  onUpdateTodo: (id: string, patch: TodoUpdate) => void;
  onDeleteTodo: (id: string) => void;
  onReorderTodos: (ordered: Todo[]) => void;
}
```

Cập nhật chữ ký hàm component để nhận `onAddTodo`:

```tsx
export function PlanPage({ userId, todos, today, onAddTodo, onToggleTodo, onUpdateTodo, onDeleteTodo, onReorderTodos }: Props) {
```

- [ ] **Step 3: `PlanPage` — state `openDay` + handler**

Thêm state ngay dưới dòng `const [periodKey, setPeriodKey] = ...`:

```tsx
  const [openDay, setOpenDay] = useState<string | null>(null);
```

Rút gọn `handleSelectCell` (giờ chỉ dùng cho tầng Năm/5 Năm — bỏ nhánh month/week vốn sẽ không còn được gọi):

```tsx
  function handleSelectCell(key: string) {
    if (horizon === 'five_year') {
      setHorizon('year');
      setPeriodKey(key);
    } else if (horizon === 'year') {
      setHorizon('month');
      setPeriodKey(key);
    }
  }

  function handleAddOnDay(date: string, title: string) {
    onAddTodo({ title, due_date: date, priority: 'medium', tags: [], recurrence: 'none' });
  }

  function handleOpenFull(date: string) {
    setOpenDay(null);
    setHorizon('day');
    setPeriodKey(date);
  }
```

- [ ] **Step 4: `PlanPage` — tách lưới ngày khỏi memo `grid`**

Trong memo `grid` (dòng ~109), **bỏ hai nhánh `month` và `week`** cùng hàm `dayCells` bên trong; `grid` chỉ còn phục vụ Năm/5 Năm. Thay toàn bộ khối `const grid = useMemo(...)` bằng:

```tsx
  const grid = useMemo((): { columns: number; leadingBlanks: number; cells: CellData[] } | null => {
    function yearOrFiveYearCells(childHorizon: Horizon, keys: string[]): CellData[] {
      return keys.map((key) => {
        const range = getPeriodRange(childHorizon, key);
        const { done, total } = countTodosInRange(todos, range.start, range.end);
        const childGoals = goals.filter((g) => g.horizon === childHorizon && g.period_key === key);
        return {
          key,
          label: childHorizon === 'month' ? key.slice(5) : key,
          doneCount: done + childGoals.filter((g) => g.is_done).length,
          totalCount: total + childGoals.length,
          tooltipLines: childGoals.map((g) => (g.is_done ? '✓ ' : '• ') + g.title),
        };
      });
    }

    if (horizon === 'five_year') {
      return { columns: 5, leadingBlanks: 0, cells: yearOrFiveYearCells('year', getChildPeriods('five_year', periodKey)) };
    }
    if (horizon === 'year') {
      return { columns: 4, leadingBlanks: 0, cells: yearOrFiveYearCells('month', getChildPeriods('year', periodKey)) };
    }
    return null;
  }, [horizon, periodKey, todos, goals]);

  const dayGrid = useMemo((): { leadingBlanks: number; cells: DayCellData[] } | null => {
    if (horizon !== 'month' && horizon !== 'week') return null;
    const dates = getChildPeriods(horizon, periodKey);
    let leadingBlanks = 0;
    if (horizon === 'month') {
      const [y, m] = periodKey.split('-').map(Number);
      const firstWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
      leadingBlanks = (firstWeekday + 6) % 7; // quy về Thứ Hai = cột đầu
    }
    const cells = dates.map((date) => ({
      date,
      dayNumber: Number(date.slice(8, 10)),
      todos: todos.filter((t) => t.due_date === date),
    }));
    return { leadingBlanks, cells };
  }, [horizon, periodKey, todos]);
```

- [ ] **Step 5: `PlanPage` — render lưới ngày cho Tháng/Tuần**

Trong phần return, thay khối render lưới (đoạn `<div className="flex flex-col gap-1.5">…</div>` chứa header thứ + `<PeriodGrid …>`) bằng:

```tsx
        <div className="flex flex-col gap-1.5">
          {(horizon === 'month' || horizon === 'week') && (
            <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-semibold text-text-muted dark:text-text-muted-dark">
              {WEEKDAY_LABELS.map((w) => (
                <div key={w}>{w}</div>
              ))}
            </div>
          )}
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
        </div>
```

- [ ] **Step 6: Chạy test + build**

Run: `npm test`
Expected: tất cả test PASS (gồm `dayCell.test.ts` mới).

Run: `npm run build`
Expected: build thành công, không lỗi TypeScript.

Run: `npm run lint`
Expected: không lỗi lint.

- [ ] **Step 7: Kiểm thử bằng tay (`npm run dev`)**

Mở tab **Kế hoạch** → tầng **Tháng**. Xác nhận:
1. Ô ngày cao lên rõ rệt (~4 lần), hiện số ngày; ngày nào có việc hiện tiêu đề việc bên trong; >3 việc thì có dòng "+N việc".
2. Click 1 ô ngày → popover hiện ngay dưới ô: gõ tiêu đề + Enter → việc xuất hiện trong ô và trong popover.
3. Tích ô trong popover → việc gạch ngang (đánh dấu xong).
4. Bấm ra ngoài / nhấn Esc → popover đóng. Click lại chính ô đó → đóng (không nhấp nháy mở lại).
5. Bấm "Mở ngày →" → xuống tầng Ngày đúng ngày đó, hiện danh sách việc đầy đủ.
6. Chuyển tầng **Tuần** → lưới 7 ô ngày hành xử như trên.
7. Tầng **Năm / 5 Năm** → vẫn như cũ (click để đi xuống tầng con), không có popover.
8. Bật dark mode → màu ô, popover, chữ hiển thị đúng.

- [ ] **Step 8: Commit**

```bash
git add src/pages/AppPage.tsx src/components/PlanPage.tsx
git commit -m "feat: PlanPage — lưới ngày Google Calendar + popover thêm việc theo ngày"
```

---

## Self-Review

**Spec coverage:**
- Ô to lên + danh sách việc trong ô → Task 3 (`DayCell` min-h-[6rem] + `dayCellItems`).
- Click ô mở popover thêm việc → Task 2 (`DayPopover`) + Task 4 (state `openDay`, `handleAddOnDay`).
- Tích đánh dấu xong trong popover → Task 2 + Task 4 (`onToggle={onToggleTodo}`).
- Nút "Mở ngày →" → Task 2 + Task 4 (`handleOpenFull`).
- Nối `addTodo` từ AppPage → Task 4 Step 1.
- Giữ nguyên Năm/5 Năm → Task 4 Step 4-5 (dùng lại `PeriodGrid`).
- Logic thuần + test → Task 1.
- Max 3 dòng → Task 4 Step 5 (`maxLines={3}`).
- Mặc định priority/tags/recurrence → Task 4 Step 3 (`handleAddOnDay`).

**Placeholder scan:** Không có TBD/TODO; mọi step có code hoặc lệnh cụ thể.

**Type consistency:** `DayCellData`, `dayCellItems`, `DayPopover`/`DayCell`/`DayGrid` props khớp giữa các task; `onAddTodo` kiểu `(NewTodo) => void` nhận được `addTodo` trả `Promise<boolean>` (hợp lệ trong TS).
