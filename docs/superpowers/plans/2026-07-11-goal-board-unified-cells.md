# Bảng mục tiêu chung + thống nhất ô lịch — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mục tiêu thành bảng chung luôn hiện mọi tab; các tab lịch (5 Năm/Năm/Tháng/Tuần) đều có checkbox tick, ✕ xóa, thêm việc tại ô, và hiển thị ngày `dd/mm`.

**Architecture:** Trích component trình bày dùng chung `TodoCell` + form thêm nhỏ `CellAddForm` cho ô tháng/năm; ô ngày viết lại inline (bỏ popover). Logic thuần gom vào `src/lib/todoCell.ts` (builders + formatter) có test. Mục tiêu chuyển sang danh sách phẳng bằng sentinel `period_key='global'` — không đổi schema DB.

**Tech Stack:** React + TypeScript + Tailwind + Vitest; Supabase (goals/todos đã có hook).

## Global Constraints

- TypeScript mọi nơi, tránh `any`.
- Không đổi schema DB, không chạy migration.
- Dark mode qua class `dark:`; giao diện tiếng Việt.
- Không nuốt lỗi im lặng (đã có ErrorBanner/console.error trong hook — giữ nguyên).
- Test cho logic thuần (lib) bằng Vitest; UI xác minh bằng `npm run build` + chạy thật. Codebase hiện **không có** test component → không thêm test component mới.
- Mỗi việc mới mặc định: `priority:'medium'`, `tags:[]`, `recurrence:'none'`.
- Trước khi báo xong mỗi task: `npm test` + `npm run build` phải pass thật.

---

### Task 1: Bảng mục tiêu chung (global goal board)

Mục tiêu không còn theo kỳ; hiện toàn bộ ở mọi tab, chỉ mất khi ✕ xóa. Không đổi DB.

**Files:**
- Modify: `src/types/goal.ts`
- Modify: `src/hooks/useGoals.ts`
- Rename+Modify: `src/components/GoalList.tsx` → `src/components/GoalBoard.tsx`
- Modify: `src/components/PlanPage.tsx`

**Interfaces:**
- Produces: `NewGoal = { title: string }`; `useGoals().addGoal(input: NewGoal)`; `<GoalBoard goals={Goal[]} onAdd={(title: string)=>void} onUpdate onDelete />`.
- Consumes: `GoalItem` (giữ nguyên — đã có checkbox + sửa tên + ✕ xóa).

- [ ] **Step 1: Rút gọn `NewGoal`**

Trong `src/types/goal.ts`, thay khối `NewGoal`:

```ts
/** Dữ liệu để tạo mục tiêu mới. Mục tiêu giờ là danh sách chung (không theo kỳ). */
export interface NewGoal {
  title: string;
}
```

- [ ] **Step 2: `addGoal` chèn sentinel để hợp lệ schema cũ**

Trong `src/hooks/useGoals.ts`, thay thân `addGoal`:

```ts
  const addGoal = useCallback(
    async (input: NewGoal) => {
      // Mục tiêu là danh sách chung, không theo kỳ. Nhưng cột horizon/period_key
      // của bảng `goals` đang NOT NULL → điền giá trị cố định hợp lệ để khỏi phải
      // đổi schema. period_key='global' đánh dấu "mục tiêu chung".
      const { error } = await supabase.from('goals').insert({
        user_id: userId,
        horizon: 'year',
        period_key: 'global',
        title: input.title,
      });
      if (error) {
        console.error('Lỗi thêm mục tiêu:', error);
        setError('Không thêm được mục tiêu: ' + error.message);
      }
    },
    [userId],
  );
```

- [ ] **Step 3: Tạo `GoalBoard.tsx`**

`git mv src/components/GoalList.tsx src/components/GoalBoard.tsx` rồi thay toàn bộ nội dung:

```tsx
import { useState } from 'react';
import type { Goal, GoalUpdate } from '../types/goal';
import { GoalItem } from './GoalItem';

interface Props {
  goals: Goal[];
  onAdd: (title: string) => void;
  onUpdate: (id: string, patch: GoalUpdate) => void;
  onDelete: (id: string) => void;
}

/** Bảng mục tiêu chung: hiện ở mọi tab, không gắn theo kỳ. Thêm/tick/sửa/xóa. */
export function GoalBoard({ goals, onAdd, onUpdate, onDelete }: Props) {
  const [title, setTitle] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    onAdd(t);
    setTitle('');
  }

  return (
    <div className="flex flex-col gap-2">
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Thêm mục tiêu…"
          aria-label="Mục tiêu mới"
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary dark:border-border-dark dark:bg-surface-2dark dark:text-text-dark"
        />
        <button className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white dark:bg-primary-dark">
          Thêm
        </button>
      </form>
      {goals.length === 0 ? (
        <p className="text-sm text-text-muted dark:text-text-muted-dark">Chưa có mục tiêu nào.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {goals.map((g) => (
            <GoalItem
              key={g.id}
              goal={g}
              onToggle={(id, done) => onUpdate(id, { is_done: done })}
              onRename={(id, t) => onUpdate(id, { title: t })}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Nối `GoalBoard` vào `PlanPage` cho mọi tab**

Trong `src/components/PlanPage.tsx`:

1. Đổi import: `import { GoalList } from './GoalList';` → `import { GoalBoard } from './GoalBoard';`
2. Xóa `currentGoals` useMemo (khối `const currentGoals = useMemo(... horizon === 'day' ? [] ...)`).
3. Thay khối render mục tiêu (đang là `{horizon !== 'day' && (<GoalList ... />)}`) bằng:

```tsx
      <GoalBoard goals={goals} onAdd={(title) => addGoal({ title })} onUpdate={updateGoal} onDelete={deleteGoal} />
```

(Đặt ngay dưới `<HorizonSwitcher .../>` và sau `{error && ...}` — hiện ở MỌI horizon kể cả `day`.)

- [ ] **Step 5: Kiểm chứng**

Run: `npm test` → Expected: PASS (không đổi test lib).
Run: `npm run build` → Expected: build sạch, không lỗi TS (kể cả chỗ dùng `NewGoal`).

- [ ] **Step 6: Commit**

```bash
git add src/types/goal.ts src/hooks/useGoals.ts src/components/GoalBoard.tsx src/components/PlanPage.tsx
git commit -m "feat: bảng mục tiêu chung luôn hiện ở mọi tab (bỏ scoping theo kỳ)"
```

---

### Task 2: Lib `todoCell.ts` — builders + formatter (TDD)

Gom logic ô dùng chung; thêm ô năm cho tab 5 Năm và formatter `dd/mm`. Thuần, có test.

**Files:**
- Create: `src/lib/todoCell.ts`
- Create: `src/lib/todoCell.test.ts`
- Delete: `src/lib/monthCell.ts`, `src/lib/monthCell.test.ts`
- Modify (đổi import/field cho khỏi vỡ build): `src/components/MonthCell.tsx`, `src/components/MonthGrid.tsx`, `src/components/PlanPage.tsx`

**Interfaces:**
- Produces:
  - `TodoCellData { key: string; label: string; todos: Todo[]; doneCount: number; totalCount: number }`
  - `buildMonthCells(todos: Todo[], yearKey: string): TodoCellData[]` (12 ô, label `Tháng MM`)
  - `buildYearCells(todos: Todo[], fiveYearKey: string): TodoCellData[]` (5 ô, label `Năm YYYY`)
  - `visibleTodos(todos: Todo[], expanded: boolean, max?: number): { visible: Todo[]; overflow: number }`
  - `formatDayMonth(dueDate: string | null): string` (`'dd/mm'` hoặc `''`)

- [ ] **Step 1: Viết test thất bại `src/lib/todoCell.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { buildMonthCells, buildYearCells, visibleTodos, formatDayMonth } from './todoCell';
import type { Todo } from '../types/todo';

function todo(partial: Partial<Todo>): Todo {
  return {
    id: 'id', user_id: 'u', title: 't', notes: null, is_done: false,
    due_date: null, priority: 'medium', tags: [], recurrence: 'none',
    sort_order: 0, created_at: '', updated_at: '', ...partial,
  };
}

describe('buildMonthCells', () => {
  it('trả 12 tháng nhãn "Tháng MM" theo thứ tự 01→12', () => {
    const cells = buildMonthCells([], '2026');
    expect(cells).toHaveLength(12);
    expect(cells[0].key).toBe('2026-01');
    expect(cells[0].label).toBe('Tháng 01');
    expect(cells[11].label).toBe('Tháng 12');
  });

  it('gom todo vào đúng tháng theo due_date, kể cả biên đầu/cuối', () => {
    const todos = [
      todo({ id: 'a', due_date: '2026-01-01' }),
      todo({ id: 'b', due_date: '2026-01-31' }),
      todo({ id: 'c', due_date: '2026-02-15' }),
    ];
    const cells = buildMonthCells(todos, '2026');
    expect(cells[0].todos.map((t) => t.id)).toEqual(['a', 'b']);
    expect(cells[0].totalCount).toBe(2);
    expect(cells[1].todos.map((t) => t.id)).toEqual(['c']);
  });

  it('due_date=null không rơi vào tháng nào; đếm done/total; việc chưa xong lên trước', () => {
    expect(buildMonthCells([todo({ due_date: null })], '2026').every((c) => c.totalCount === 0)).toBe(true);
    const march = buildMonthCells(
      [
        todo({ id: 'a', due_date: '2026-03-05', is_done: true }),
        todo({ id: 'b', due_date: '2026-03-06', is_done: false }),
      ],
      '2026',
    )[2];
    expect(march.totalCount).toBe(2);
    expect(march.doneCount).toBe(1);
    expect(march.todos.map((t) => t.id)).toEqual(['b', 'a']);
  });
});

describe('buildYearCells', () => {
  it('trả 5 năm nhãn "Năm YYYY" theo thứ tự', () => {
    const cells = buildYearCells([], '2025');
    expect(cells).toHaveLength(5);
    expect(cells[0].key).toBe('2025');
    expect(cells[0].label).toBe('Năm 2025');
    expect(cells[4].key).toBe('2029');
  });

  it('gom todo vào đúng năm theo due_date, kể cả biên đầu/cuối năm', () => {
    const todos = [
      todo({ id: 'a', due_date: '2025-01-01' }),
      todo({ id: 'b', due_date: '2025-12-31' }),
      todo({ id: 'c', due_date: '2026-06-15' }),
    ];
    const cells = buildYearCells(todos, '2025');
    expect(cells[0].todos.map((t) => t.id)).toEqual(['a', 'b']);
    expect(cells[1].todos.map((t) => t.id)).toEqual(['c']);
  });
});

describe('formatDayMonth', () => {
  it('YYYY-MM-DD → dd/mm', () => {
    expect(formatDayMonth('2026-08-05')).toBe('05/08');
    expect(formatDayMonth('2026-12-31')).toBe('31/12');
  });
  it('null → chuỗi rỗng', () => {
    expect(formatDayMonth(null)).toBe('');
  });
});

describe('visibleTodos', () => {
  const list = Array.from({ length: 8 }, (_, i) => todo({ id: String(i), due_date: '2026-05-01' }));
  it('≤ max → hiện hết, overflow 0', () => {
    const three = list.slice(0, 3);
    expect(visibleTodos(three, false)).toEqual({ visible: three, overflow: 0 });
  });
  it('> max chưa mở → cắt còn 6, overflow 2', () => {
    const res = visibleTodos(list, false);
    expect(res.visible).toHaveLength(6);
    expect(res.overflow).toBe(2);
  });
  it('> max đã mở → hiện hết', () => {
    expect(visibleTodos(list, true).overflow).toBe(0);
  });
});
```

- [ ] **Step 2: Chạy test để chắc nó fail**

Run: `npm test -- todoCell` → Expected: FAIL ("Cannot find module './todoCell'").

- [ ] **Step 3: Tạo `src/lib/todoCell.ts`**

```ts
import type { Todo } from '../types/todo';
import { getChildPeriods, getPeriodRange } from './goalFilters';
import type { Horizon } from '../types/goal';
import { sortByDoneThenOrder } from './todoFilters';

export interface TodoCellData {
  key: string; // 'YYYY-MM' (ô tháng) | 'YYYY' (ô năm)
  label: string; // 'Tháng 08' | 'Năm 2026'
  todos: Todo[]; // todo trong kỳ, đã sort việc-chưa-xong-trước
  doneCount: number;
  totalCount: number;
}

/** Dựng 1 ô: gom todo có due_date nằm trong kỳ [start,end] của kỳ con. */
function cellFrom(todos: Todo[], childHorizon: Horizon, key: string, label: string): TodoCellData {
  const { start, end } = getPeriodRange(childHorizon, key);
  const inRange = todos.filter((t) => t.due_date !== null && t.due_date >= start && t.due_date <= end);
  const sorted = sortByDoneThenOrder(inRange);
  return {
    key,
    label,
    todos: sorted,
    doneCount: sorted.filter((t) => t.is_done).length,
    totalCount: sorted.length,
  };
}

/** 12 ô tháng của một năm (chế độ Năm). */
export function buildMonthCells(todos: Todo[], yearPeriodKey: string): TodoCellData[] {
  return getChildPeriods('year', yearPeriodKey).map((key) =>
    cellFrom(todos, 'month', key, `Tháng ${key.slice(5)}`),
  );
}

/** 5 ô năm của một khối 5 năm (chế độ 5 Năm). */
export function buildYearCells(todos: Todo[], fiveYearKey: string): TodoCellData[] {
  return getChildPeriods('five_year', fiveYearKey).map((key) =>
    cellFrom(todos, 'year', key, `Năm ${key}`),
  );
}

export interface VisibleTodos {
  visible: Todo[];
  overflow: number;
}

/** Cắt còn `max` dòng khi chưa mở rộng; phần dư gộp vào overflow. */
export function visibleTodos(todos: Todo[], expanded: boolean, max = 6): VisibleTodos {
  if (expanded || todos.length <= max) return { visible: todos, overflow: 0 };
  return { visible: todos.slice(0, max), overflow: todos.length - max };
}

/** 'YYYY-MM-DD' → 'dd/mm'; null → ''. */
export function formatDayMonth(dueDate: string | null): string {
  if (!dueDate) return '';
  return `${dueDate.slice(8, 10)}/${dueDate.slice(5, 7)}`;
}
```

- [ ] **Step 4: Chạy test — phải PASS**

Run: `npm test -- todoCell` → Expected: PASS toàn bộ.

- [ ] **Step 5: Xóa file cũ + sửa import cho khỏi vỡ build**

1. `git rm src/lib/monthCell.ts src/lib/monthCell.test.ts`
2. `src/components/MonthCell.tsx`: đổi import dòng đầu
   `import type { MonthCellData } from '../lib/monthCell';` → `import type { TodoCellData } from '../lib/todoCell';`
   và `import { visibleTodos } from '../lib/monthCell';` → `import { visibleTodos } from '../lib/todoCell';`
   Trong `interface Props { data: MonthCellData; ... }` đổi `MonthCellData` → `TodoCellData`.
   Trong JSX đổi `{data.monthLabel}` → `{data.label}`.
3. `src/components/MonthGrid.tsx`: đổi `import type { MonthCellData } from '../lib/monthCell';` → `import type { TodoCellData } from '../lib/todoCell';` và `cells: MonthCellData[]` → `cells: TodoCellData[]`.
4. `src/components/PlanPage.tsx`: đổi
   `import { buildMonthCells } from '../lib/monthCell';` → `import { buildMonthCells } from '../lib/todoCell';`
   và `import type { MonthCellData } from '../lib/monthCell';` → `import type { TodoCellData } from '../lib/todoCell';`
   Trong khối `const monthCells = useMemo((): MonthCellData[] | null => ...)` đổi `MonthCellData` → `TodoCellData`.

- [ ] **Step 6: Kiểm chứng**

Run: `npm test` → Expected: PASS (todoCell test + các test cũ).
Run: `npm run build` → Expected: sạch, không còn tham chiếu `monthCell`/`monthLabel`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: gom logic ô vào lib/todoCell (thêm buildYearCells + formatDayMonth)"
```

---

### Task 3: `CellAddForm` + `TodoCell` + tab Năm đầy đủ (checkbox/✕/thêm/dd-mm)

**Files:**
- Create: `src/components/CellAddForm.tsx`
- Create: `src/components/TodoCell.tsx`
- Delete: `src/components/MonthCell.tsx`
- Modify: `src/components/MonthGrid.tsx`
- Modify: `src/components/PlanPage.tsx`

**Interfaces:**
- Consumes: `TodoCellData`, `visibleTodos`, `formatDayMonth` (Task 2).
- Produces:
  - `<CellAddForm onAdd={(title: string)=>void} />`
  - `<TodoCell data={TodoCellData} onSelect={()=>void} onToggleTodo={(id,done)=>void} onDeleteTodo={(id)=>void} onAdd?={(title)=>void} showDate?={boolean} />`
  - `<MonthGrid cells={TodoCellData[]} onSelect={(key)=>void} onToggleTodo onDeleteTodo onAddTodo={(monthKey,title)=>void} />`

- [ ] **Step 1: Tạo `CellAddForm.tsx`**

```tsx
import { useState } from 'react';

interface Props {
  onAdd: (title: string) => void;
}

/** Nút "+ thêm việc" nhỏ trong ô lịch; bấm để hiện ô nhập, Enter để thêm. */
export function CellAddForm({ onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    onAdd(t);
    setTitle('');
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-auto self-start px-1 text-[10px] text-text-muted transition hover:text-primary dark:text-text-muted-dark dark:hover:text-primary-dark"
      >
        + thêm việc
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="mt-auto">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => title.trim() === '' && setOpen(false)}
        placeholder="Việc mới…"
        aria-label="Thêm việc"
        className="w-full rounded border border-border bg-surface px-1.5 py-0.5 text-[12px] text-text outline-none focus:border-primary dark:border-border-dark dark:bg-surface-2dark dark:text-text-dark"
      />
    </form>
  );
}
```

- [ ] **Step 2: Tạo `TodoCell.tsx`**

```tsx
import { useState } from 'react';
import type { TodoCellData } from '../lib/todoCell';
import { visibleTodos, formatDayMonth } from '../lib/todoCell';
import { CellAddForm } from './CellAddForm';

interface Props {
  data: TodoCellData;
  onSelect: () => void;
  onToggleTodo: (id: string, done: boolean) => void;
  onDeleteTodo: (id: string) => void;
  onAdd?: (title: string) => void; // có → hiện ô "+ thêm việc"
  showDate?: boolean; // hiện dd/mm mỗi việc
}

/**
 * 1 ô lịch liệt kê việc (dùng cho ô tháng ở tab Năm và ô năm ở tab 5 Năm):
 * nhãn kỳ (bấm để đi xuống tầng con) + số done/total, danh sách việc có checkbox
 * + ngày dd/mm + nút ✕ xóa, tối đa 6 việc với nút bung/thu, và ô thêm việc tùy chọn.
 */
export function TodoCell({ data, onSelect, onToggleTodo, onDeleteTodo, onAdd, showDate }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { visible, overflow } = visibleTodos(data.todos, expanded);

  return (
    <div className="flex min-h-[9rem] flex-col gap-1.5 rounded-lg border border-border bg-surface p-2 dark:border-border-dark dark:bg-surface-dark">
      <button
        type="button"
        onClick={onSelect}
        className="flex items-baseline justify-between gap-1 text-left transition-colors hover:text-primary dark:hover:text-primary-dark"
      >
        <span className="text-sm font-semibold text-text dark:text-text-dark">{data.label}</span>
        {data.totalCount > 0 && (
          <span className="text-[10px] text-text-muted dark:text-text-muted-dark">
            {data.doneCount}/{data.totalCount}
          </span>
        )}
      </button>

      <div className="flex flex-col gap-1">
        {visible.map((t) => (
          <div
            key={t.id}
            className={`group flex min-w-0 items-center gap-1.5 rounded px-1.5 py-0.5 text-[12px] font-medium ${
              t.is_done
                ? 'text-text-muted line-through dark:text-text-muted-dark'
                : 'bg-primary-soft text-primary dark:bg-primary-soft-dark dark:text-primary-dark'
            }`}
          >
            <input
              type="checkbox"
              checked={t.is_done}
              onChange={() => onToggleTodo(t.id, !t.is_done)}
              aria-label={t.title}
              className="h-3.5 w-3.5 shrink-0 accent-primary dark:accent-primary-dark"
            />
            <span className="min-w-0 flex-1 truncate">{t.title}</span>
            {showDate && t.due_date && (
              <span className="shrink-0 text-[10px] tabular-nums text-text-muted dark:text-text-muted-dark">
                {formatDayMonth(t.due_date)}
              </span>
            )}
            <button
              type="button"
              onClick={() => onDeleteTodo(t.id)}
              aria-label={`Xóa ${t.title}`}
              className="shrink-0 rounded px-1 text-[11px] text-text-muted opacity-0 transition hover:text-red-600 group-hover:opacity-100 dark:text-text-muted-dark dark:hover:text-red-300"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {(overflow > 0 || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="self-start px-1 text-[10px] text-text-muted underline-offset-2 hover:underline dark:text-text-muted-dark"
        >
          {expanded ? 'thu gọn' : `+${overflow} xem thêm`}
        </button>
      )}

      {onAdd && <CellAddForm onAdd={onAdd} />}
    </div>
  );
}
```

- [ ] **Step 3: Cập nhật `MonthGrid.tsx` dùng `TodoCell`**

Thay toàn bộ nội dung:

```tsx
import type { TodoCellData } from '../lib/todoCell';
import { TodoCell } from './TodoCell';

interface Props {
  cells: TodoCellData[];
  onSelect: (key: string) => void;
  onToggleTodo: (id: string, done: boolean) => void;
  onDeleteTodo: (id: string) => void;
  onAddTodo: (monthKey: string, title: string) => void;
}

/** Lưới 12 ô tháng (3 cột) cho chế độ Năm — mỗi ô liệt kê việc, có checkbox/✕/thêm. */
export function MonthGrid({ cells, onSelect, onToggleTodo, onDeleteTodo, onAddTodo }: Props) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
      {cells.map((c) => (
        <TodoCell
          key={c.key}
          data={c}
          showDate
          onSelect={() => onSelect(c.key)}
          onToggleTodo={onToggleTodo}
          onDeleteTodo={onDeleteTodo}
          onAdd={(title) => onAddTodo(c.key, title)}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Xóa `MonthCell.tsx`**

`git rm src/components/MonthCell.tsx` (đã thay bằng `TodoCell`).

- [ ] **Step 5: Nối `PlanPage` — thêm việc theo tháng + xóa việc cho `MonthGrid`**

Trong `src/components/PlanPage.tsx`:

1. Xóa import `import { MonthCell } from './MonthCell';` nếu có (thực tế PlanPage import `MonthGrid`, không import MonthCell — bỏ qua nếu không có).
2. Thêm handler (đặt cạnh `handleAddOnDay`):

```tsx
  function handleAddOnMonth(monthKey: string, title: string) {
    // Ô tháng không có ngày cụ thể → gán ngày 01 của tháng để việc hiện trong ô.
    onAddTodo({ title, due_date: `${monthKey}-01`, priority: 'medium', tags: [], recurrence: 'none' });
  }
```

3. Sửa chỗ render MonthGrid (nhánh `monthCells ?`):

```tsx
            <MonthGrid
              cells={monthCells}
              onSelect={handleSelectCell}
              onToggleTodo={onToggleTodo}
              onDeleteTodo={onDeleteTodo}
              onAddTodo={handleAddOnMonth}
            />
```

- [ ] **Step 6: Kiểm chứng**

Run: `npm test` → Expected: PASS.
Run: `npm run build` → Expected: sạch.
Chạy `npm run dev`, vào Kế hoạch → Năm: mỗi ô tháng có checkbox, ✕ (hover), ngày dd/mm, và "+ thêm việc" hoạt động (việc mới hiện trong ô).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: tab Năm dùng TodoCell — checkbox/✕ xóa/thêm việc/ngày dd-mm trong ô tháng"
```

---

### Task 4: Tab 5 Năm — `YearGrid` liệt kê việc; xóa PeriodGrid/PeriodCell

**Files:**
- Create: `src/components/YearGrid.tsx`
- Delete: `src/components/PeriodGrid.tsx`, `src/components/PeriodCell.tsx`
- Modify: `src/components/PlanPage.tsx`

**Interfaces:**
- Consumes: `TodoCell`, `buildYearCells` (Task 2/3).
- Produces: `<YearGrid cells={TodoCellData[]} onSelect={(key)=>void} onToggleTodo onDeleteTodo />` (không có thêm việc).

- [ ] **Step 1: Tạo `YearGrid.tsx`**

```tsx
import type { TodoCellData } from '../lib/todoCell';
import { TodoCell } from './TodoCell';

interface Props {
  cells: TodoCellData[];
  onSelect: (key: string) => void;
  onToggleTodo: (id: string, done: boolean) => void;
  onDeleteTodo: (id: string) => void;
}

/** Lưới 5 ô năm (3 cột) cho chế độ 5 Năm — mỗi ô liệt kê việc gần nhất trong năm. */
export function YearGrid({ cells, onSelect, onToggleTodo, onDeleteTodo }: Props) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
      {cells.map((c) => (
        <TodoCell
          key={c.key}
          data={c}
          showDate
          onSelect={() => onSelect(c.key)}
          onToggleTodo={onToggleTodo}
          onDeleteTodo={onDeleteTodo}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Sửa `PlanPage.tsx` — thay grid 5 Năm cũ bằng `YearGrid`**

1. Import: thêm `import { YearGrid } from './YearGrid';` và `import { buildYearCells } from '../lib/todoCell';` (gộp cùng dòng import từ `todoCell` đã có: `import { buildMonthCells, buildYearCells } from '../lib/todoCell';`).
2. Xóa import không dùng nữa:
   - `import { PeriodGrid } from './PeriodGrid';`
   - `import type { CellData } from './PeriodGrid';`
   - Trong import từ `../lib/goalFilters`, bỏ `countTodosInRange` và `getChildPeriods`? — **giữ `getChildPeriods`** (dayGrid còn dùng), **bỏ `countTodosInRange`**.
3. Xóa toàn bộ `const grid = useMemo(...)` (khối chứa `yearOrFiveYearCells` và nhánh `five_year`).
4. Thêm useMemo mới (đặt cạnh `monthCells`):

```tsx
  const yearCells = useMemo(
    (): TodoCellData[] | null => (horizon === 'five_year' ? buildYearCells(todos, periodKey) : null),
    [horizon, periodKey, todos],
  );
```

5. Trong phần render, thay nhánh cuối `grid && (<PeriodGrid .../>)`. Chuỗi điều kiện render hiện là `dayGrid ? <DayGrid/> : monthCells ? <MonthGrid/> : grid && <PeriodGrid/>`. Sửa nhánh cuối thành:

```tsx
          ) : yearCells ? (
            <YearGrid
              cells={yearCells}
              onSelect={handleSelectCell}
              onToggleTodo={onToggleTodo}
              onDeleteTodo={onDeleteTodo}
            />
          ) : null}
```

- [ ] **Step 3: Xóa file cũ**

`git rm src/components/PeriodGrid.tsx src/components/PeriodCell.tsx`

- [ ] **Step 4: Kiểm chứng**

Run: `npm run build` → Expected: sạch (không còn tham chiếu `PeriodGrid`/`CellData`/`countTodosInRange`). Nếu TS báo `countTodosInRange`/`getPeriodRange` unused, dọn import cho hết.
Run: `npm test` → Expected: PASS.
Chạy dev → 5 Năm: mỗi ô năm liệt kê việc + checkbox + ✕ + dd/mm; bấm nhãn năm xuống tab Năm.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: tab 5 Năm liệt kê việc trong ô năm (YearGrid), bỏ PeriodGrid/PeriodCell"
```

---

### Task 5: Tab Tháng/Tuần — ô ngày inline (checkbox/✕/thêm), bỏ popover

**Files:**
- Modify: `src/components/DayCell.tsx`
- Modify: `src/components/DayGrid.tsx`
- Modify: `src/components/PlanPage.tsx`
- Delete: `src/components/DayPopover.tsx`

**Interfaces:**
- Consumes: `CellAddForm` (Task 3), `dayCellItems` (giữ nguyên, `src/lib/dayCell.ts`).
- Produces:
  - `<DayCell date dayNumber todos isToday maxLines onAdd={(title)=>void} onToggle onDelete onOpenFull />` (bỏ `isOpen/onOpen/onClose`).
  - `<DayGrid ... onDelete={(id)=>void} />` (bỏ `openDay/onOpen/onClose`).

- [ ] **Step 1: Viết lại `DayCell.tsx` (inline, bỏ popover)**

```tsx
import { useState } from 'react';
import type { Todo } from '../types/todo';
import { CellAddForm } from './CellAddForm';
import { visibleTodos } from '../lib/todoCell';

interface Props {
  date: string;
  dayNumber: number;
  todos: Todo[];
  isToday: boolean;
  maxLines: number;
  onAdd: (title: string) => void;
  onToggle: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
  onOpenFull: () => void;
}

/** 1 ô ngày (Tháng/Tuần): số ngày (bấm để mở tab Ngày) + việc có checkbox/✕ + ô thêm. */
export function DayCell({
  date,
  dayNumber,
  todos,
  isToday,
  maxLines,
  onAdd,
  onToggle,
  onDelete,
  onOpenFull,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const { visible, overflow } = visibleTodos(todos, expanded, maxLines);

  return (
    <div
      className={`flex min-h-[6rem] flex-col gap-1 rounded-lg border bg-surface p-1.5 dark:bg-surface-dark ${
        isToday ? 'border-primary dark:border-primary-dark' : 'border-border dark:border-border-dark'
      }`}
    >
      <button
        type="button"
        onClick={onOpenFull}
        aria-label={`Mở ngày ${dayNumber}`}
        className={`self-start text-xs font-semibold transition-colors hover:text-primary dark:hover:text-primary-dark ${
          isToday ? 'text-primary dark:text-primary-dark' : 'text-text dark:text-text-dark'
        }`}
      >
        {dayNumber}
      </button>

      <div className="flex flex-col gap-0.5">
        {visible.map((t) => (
          <div
            key={t.id}
            className={`group flex min-w-0 items-center gap-1 rounded px-1 text-[10px] ${
              t.is_done
                ? 'text-text-muted line-through dark:text-text-muted-dark'
                : 'bg-primary-soft text-primary dark:bg-primary-soft-dark dark:text-primary-dark'
            }`}
          >
            <input
              type="checkbox"
              checked={t.is_done}
              onChange={() => onToggle(t.id, !t.is_done)}
              aria-label={t.title}
              className="h-3 w-3 shrink-0 accent-primary dark:accent-primary-dark"
            />
            <span className="min-w-0 flex-1 truncate">{t.title}</span>
            <button
              type="button"
              onClick={() => onDelete(t.id)}
              aria-label={`Xóa ${t.title}`}
              className="shrink-0 px-0.5 text-text-muted opacity-0 transition hover:text-red-600 group-hover:opacity-100 dark:text-text-muted-dark dark:hover:text-red-300"
            >
              ✕
            </button>
          </div>
        ))}
        {overflow > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="px-1 text-left text-[10px] text-text-muted hover:underline dark:text-text-muted-dark"
          >
            +{overflow} việc
          </button>
        )}
      </div>

      <CellAddForm onAdd={onAdd} />
    </div>
  );
}
```

- [ ] **Step 2: Cập nhật `DayGrid.tsx` (bỏ popover props, thêm onDelete)**

Thay toàn bộ nội dung:

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
  maxLines: number;
  onAdd: (date: string, title: string) => void;
  onToggle: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
  onOpenFull: (date: string) => void;
}

/** Lưới ngày kiểu Google Calendar cho tầng Tháng/Tuần (7 cột). */
export function DayGrid({ leadingBlanks, cells, today, maxLines, onAdd, onToggle, onDelete, onOpenFull }: Props) {
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
          maxLines={maxLines}
          onAdd={(title) => onAdd(c.date, title)}
          onToggle={onToggle}
          onDelete={onDelete}
          onOpenFull={() => onOpenFull(c.date)}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Cập nhật `PlanPage.tsx` — bỏ `openDay`, nối `onDelete`**

1. Xóa state `const [openDay, setOpenDay] = useState<string | null>(null);`.
2. Xóa mọi dòng `setOpenDay(null);` trong `handleHorizon`, `handlePrev`, `handleNext`, `handleOpenFull`.
3. Sửa render `<DayGrid .../>` (nhánh `dayGrid ?`):

```tsx
            <DayGrid
              leadingBlanks={dayGrid.leadingBlanks}
              cells={dayGrid.cells}
              today={today}
              maxLines={3}
              onAdd={handleAddOnDay}
              onToggle={onToggleTodo}
              onDelete={onDeleteTodo}
              onOpenFull={handleOpenFull}
            />
```

- [ ] **Step 4: Xóa `DayPopover.tsx`**

`git rm src/components/DayPopover.tsx`

- [ ] **Step 5: Kiểm chứng**

Run: `npm run build` → Expected: sạch (không còn `openDay`, `DayPopover`).
Run: `npm test` → Expected: PASS.
Chạy dev → Tháng và Tuần: ô ngày có checkbox tick, ✕ xóa (hover), "+ thêm việc" (việc mới đúng ngày ô); bấm số ngày nhảy vào tab Ngày.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: tab Tháng/Tuần — ô ngày inline (checkbox/✕/thêm việc), bỏ DayPopover"
```

---

## Self-Review

**Spec coverage:**
- YC1 bảng mục tiêu chung → Task 1. ✅
- YC2 thống nhất UI + checkbox → Task 3 (Năm), 4 (5 Năm), 5 (Tháng/Tuần). ✅
- YC3 thêm việc tại ô tháng/ngày → Task 3 (`handleAddOnMonth`), Task 5 (`handleAddOnDay`). ✅ (ô năm cố ý không có — đúng spec)
- YC4 ✕ xóa mỗi việc → Task 3/4/5 (`onDeleteTodo`/`onDelete` → `removeTodo`). ✅
- YC5 dd/mm → Task 2 (`formatDayMonth`) + Task 3/4 (`showDate`). ✅ (ô ngày cố ý bỏ)
- Dọn dẹp PeriodGrid/PeriodCell/DayPopover → Task 4/5. ✅

**Placeholder scan:** không có TBD/TODO; mọi step có code/lệnh cụ thể. ✅

**Type consistency:** `TodoCellData` (key/label/todos/doneCount/totalCount) đồng nhất Task 2→5; `onDeleteTodo`/`onDelete`, `onAddTodo(monthKey,title)`/`onAdd(date,title)` khớp giữa grid và PlanPage; `formatDayMonth`, `visibleTodos` cùng chữ ký nơi dùng. `onDeleteTodo` là prop có sẵn của PlanPage (từ AppPage `removeTodo`). ✅
