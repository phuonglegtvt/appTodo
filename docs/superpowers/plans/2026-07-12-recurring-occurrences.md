# Việc lặp hiện mọi ngày kế tiếp (occurrence ảo) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Việc lặp tự hiển thị ở mọi ngày kế tiếp trong lịch (không cần tick), tick độc lập từng ngày qua mảng `completed_dates`, thay cho cơ chế cuốn-chiếu cũ.

**Architecture:** Việc `recurrence != 'none'` là template (1 dòng DB, `due_date` = ngày bắt đầu). Occurrence từng ngày được **sinh ảo** khi dựng view lịch bằng hàm thuần `expandRecurring`; trạng thái done đọc từ cột mới `completed_dates text[]`. PlanPage định tuyến tick/sửa/xóa của occurrence ảo về template. Bỏ `completeRecurring`/`buildNextOccurrence`.

**Tech Stack:** React + TypeScript + Vite + Tailwind, Supabase (Postgres + RLS), Vitest + @testing-library/react.

## Global Constraints
- TypeScript ở mọi nơi; tránh `any`.
- Không nuốt lỗi im lặng (mất mạng/lưu lỗi phải log + báo).
- Chỉ dùng Supabase `anon` key ở frontend; không đụng service_role.
- Gate xác minh: `npm run build` (chạy `tsc -b`, typecheck cả file test) **và** `npm test` phải pass.
- Commit body kết thúc bằng: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- Spec: `docs/superpowers/specs/2026-07-12-recurring-occurrences-design.md`

---

### Task 1: Nền tảng dữ liệu — cột `completed_dates`

**Files:**
- Modify: `supabase/schema.sql:4-16` (bảng todos)
- Create: `supabase/migrations/2026-07-12-completed-dates.sql`
- Modify: `src/types/todo.ts`
- Modify: `src/hooks/useTodos.ts` (chuẩn hóa row → Todo)
- Modify (thêm `completed_dates: []` vào factory Todo): `src/lib/todoFilters.test.ts`, `src/lib/todoCell.test.ts`, `src/lib/recurrence.test.ts`, `src/components/TodoItem.test.tsx`, `src/components/TodoEditModal.test.tsx`, `src/components/TodoCell.test.tsx`, `src/components/DayCell.test.tsx`

**Interfaces:**
- Produces: `Todo.completed_dates: string[]`; `TodoUpdate` cho phép `completed_dates`.

- [ ] **Step 1: Thêm cột vào schema** — `supabase/schema.sql`, trong `create table ... todos`, thêm dòng sau `tags`:

```sql
  completed_dates text[] not null default '{}',
```

- [ ] **Step 2: Tạo migration idempotent** — `supabase/migrations/2026-07-12-completed-dates.sql`:

```sql
-- Thêm cột completed_dates (các ngày đã tick xong của việc lặp) vào todos.
-- CÁCH DÙNG: Supabase Dashboard → SQL Editor → dán file này → Run.
-- An toàn chạy lại: add column if not exists.

alter table public.todos
  add column if not exists completed_dates text[] not null default '{}';
```

- [ ] **Step 3: Cập nhật type** — `src/types/todo.ts`:

Trong `interface Todo`, sau `recurrence: Recurrence;` thêm:

```ts
  completed_dates: string[]; // ngày (YYYY-MM-DD) đã tick xong của chuỗi lặp
```

Trong `TodoUpdate`, thêm `'completed_dates'` vào danh sách `Pick`:

```ts
export type TodoUpdate = Partial<
  Pick<
    Todo,
    'title' | 'notes' | 'is_done' | 'due_date' | 'priority' | 'tags' | 'recurrence' | 'sort_order' | 'completed_dates'
  >
>;
```

- [ ] **Step 4: Chuẩn hóa row → Todo trong useTodos** — `src/hooks/useTodos.ts`.

Thêm helper (đầu file, sau import) đảm bảo `completed_dates` luôn là mảng (dòng DB cũ có thể thiếu):

```ts
/** Chuẩn hóa row từ Supabase: đảm bảo completed_dates luôn là mảng. */
function toTodo(row: unknown): Todo {
  const r = row as Todo;
  return { ...r, completed_dates: r.completed_dates ?? [] };
}
```

Sửa 3 chỗ nhận dữ liệu:
- `setTodos((data ?? []) as Todo[]);` → `setTodos((data ?? []).map(toTodo));`
- `const row = payload.new as Todo;` (nhánh INSERT) → `const row = toTodo(payload.new);`
- `const row = payload.new as Todo;` (nhánh UPDATE) → `const row = toTodo(payload.new);`

- [ ] **Step 5: Thêm `completed_dates: []` vào mọi factory Todo trong test**

Trong mỗi file test liệt kê ở **Files**, tìm nơi tạo object `Todo` đầy đủ (có `sort_order:`/`created_at:`) và thêm `completed_dates: [],` (đặt cạnh `recurrence`). Với factory dùng `...partial`/`...overrides`, chỉ cần thêm 1 lần trong object cơ sở (trước spread). Ví dụ trong `src/components/TodoCell.test.tsx`:

```ts
    recurrence: 'none',
    completed_dates: [],
    sort_order: 0,
```

Làm tương tự cho: `todoFilters.test.ts`, `todoCell.test.ts`, `recurrence.test.ts`, `TodoItem.test.tsx`, `TodoEditModal.test.tsx`, `DayCell.test.tsx`.

- [ ] **Step 6: Xác minh build + test** (đây là "test" của task nền tảng — không có logic mới)

Run: `npm run build`
Expected: `tsc -b` PASS (không lỗi thiếu `completed_dates`), `vite build` PASS.

Run: `npm test -- --run`
Expected: toàn bộ test hiện có vẫn PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase/schema.sql supabase/migrations/2026-07-12-completed-dates.sql src/types/todo.ts src/hooks/useTodos.ts src/lib/todoFilters.test.ts src/lib/todoCell.test.ts src/lib/recurrence.test.ts src/components/TodoItem.test.tsx src/components/TodoEditModal.test.tsx src/components/TodoCell.test.tsx src/components/DayCell.test.tsx
git commit -m "feat(recurrence): thêm cột completed_dates (nền tảng occurrence ảo)"
```

---

### Task 2: Lib sinh occurrence ảo (thuần)

**Files:**
- Create: `src/lib/recurringOccurrences.ts`
- Test: `src/lib/recurringOccurrences.test.ts`

**Interfaces:**
- Consumes: `nextDueDate` từ `src/lib/recurrence.ts`; `Todo`, `Recurrence` từ types.
- Produces:
  - `occurrenceDatesInRange(startDate, recurrence, rangeStart, rangeEnd): string[]`
  - `expandRecurring(todos: Todo[], rangeStart: string, rangeEnd: string): Todo[]`
  - `parseOccurrenceId(id: string): OccurrenceRef | null`
  - `toggleDateInList(dates: string[], date: string): string[]`

- [ ] **Step 1: Viết test thất bại** — `src/lib/recurringOccurrences.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  occurrenceDatesInRange,
  expandRecurring,
  parseOccurrenceId,
  toggleDateInList,
} from './recurringOccurrences';
import type { Todo } from '../types/todo';

function todo(p: Partial<Todo>): Todo {
  return {
    id: 't1', user_id: 'u', title: 'Uống thuốc', notes: null, is_done: false,
    due_date: '2026-07-12', priority: 'medium', tags: [], recurrence: 'daily',
    completed_dates: [], sort_order: 0, created_at: '', updated_at: '', ...p,
  };
}

describe('occurrenceDatesInRange', () => {
  it('daily: mọi ngày trong khoảng, từ startDate', () => {
    expect(occurrenceDatesInRange('2026-07-12', 'daily', '2026-07-12', '2026-07-15')).toEqual([
      '2026-07-12', '2026-07-13', '2026-07-14', '2026-07-15',
    ]);
  });

  it('bỏ các ngày trước startDate dù khoảng bắt đầu sớm hơn', () => {
    expect(occurrenceDatesInRange('2026-07-14', 'daily', '2026-07-12', '2026-07-15')).toEqual([
      '2026-07-14', '2026-07-15',
    ]);
  });

  it('weekly: bước 7 ngày', () => {
    expect(occurrenceDatesInRange('2026-07-01', 'weekly', '2026-07-01', '2026-07-31')).toEqual([
      '2026-07-01', '2026-07-08', '2026-07-15', '2026-07-22', '2026-07-29',
    ]);
  });

  it('monthly: clamp ngày 31 về cuối tháng ngắn', () => {
    expect(occurrenceDatesInRange('2026-01-31', 'monthly', '2026-01-31', '2026-03-31')).toEqual([
      '2026-01-31', '2026-02-28', '2026-03-31',
    ]);
  });

  it('yearly: bước 12 tháng', () => {
    expect(occurrenceDatesInRange('2024-02-29', 'yearly', '2024-01-01', '2027-12-31')).toEqual([
      '2024-02-29', '2025-02-28', '2026-02-28', '2027-02-28',
    ]);
  });

  it('none: trả startDate nếu trong khoảng, ngược lại rỗng', () => {
    expect(occurrenceDatesInRange('2026-07-12', 'none', '2026-07-01', '2026-07-31')).toEqual(['2026-07-12']);
    expect(occurrenceDatesInRange('2026-06-12', 'none', '2026-07-01', '2026-07-31')).toEqual([]);
  });
});

describe('expandRecurring', () => {
  it('template daily → nhiều occurrence với id/due_date/is_done đúng', () => {
    const t = todo({ completed_dates: ['2026-07-13'] });
    const out = expandRecurring([t], '2026-07-12', '2026-07-14');
    expect(out.map((o) => o.id)).toEqual(['t1::2026-07-12', 't1::2026-07-13', 't1::2026-07-14']);
    expect(out.map((o) => o.due_date)).toEqual(['2026-07-12', '2026-07-13', '2026-07-14']);
    expect(out.map((o) => o.is_done)).toEqual([false, true, false]);
  });

  it('việc thường giữ nguyên (không đổi id)', () => {
    const t = todo({ id: 'n1', recurrence: 'none' });
    const out = expandRecurring([t], '2026-07-01', '2026-07-31');
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('n1');
  });
});

describe('parseOccurrenceId', () => {
  it('ngày', () => {
    expect(parseOccurrenceId('abc::2026-07-13')).toEqual({ templateId: 'abc', kind: 'day', date: '2026-07-13' });
  });
  it('kỳ (period)', () => {
    expect(parseOccurrenceId('abc::P2026-08')).toEqual({ templateId: 'abc', kind: 'period', periodKey: '2026-08' });
  });
  it('id thường → null', () => {
    expect(parseOccurrenceId('abc')).toBeNull();
  });
});

describe('toggleDateInList', () => {
  it('thêm khi vắng (sắp xếp)', () => {
    expect(toggleDateInList(['2026-07-14'], '2026-07-12')).toEqual(['2026-07-12', '2026-07-14']);
  });
  it('bớt khi có', () => {
    expect(toggleDateInList(['2026-07-12', '2026-07-14'], '2026-07-12')).toEqual(['2026-07-14']);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `npm test -- --run src/lib/recurringOccurrences.test.ts`
Expected: FAIL — module chưa tồn tại.

- [ ] **Step 3: Cài đặt** — `src/lib/recurringOccurrences.ts`:

```ts
import type { Recurrence, Todo } from '../types/todo';
import { nextDueDate } from './recurrence';

export type OccurrenceRef =
  | { templateId: string; kind: 'day'; date: string }
  | { templateId: string; kind: 'period'; periodKey: string };

/** Tách id occurrence ảo. 'id::YYYY-MM-DD' → day; 'id::P<key>' → period; không '::' → null. */
export function parseOccurrenceId(id: string): OccurrenceRef | null {
  const sep = id.indexOf('::');
  if (sep === -1) return null;
  const templateId = id.slice(0, sep);
  const rest = id.slice(sep + 2);
  if (rest.startsWith('P')) return { templateId, kind: 'period', periodKey: rest.slice(1) };
  return { templateId, kind: 'day', date: rest };
}

/** Thêm ngày nếu vắng, bớt nếu có; luôn trả mảng đã sắp xếp tăng dần. */
export function toggleDateInList(dates: string[], date: string): string[] {
  const set = new Set(dates);
  if (set.has(date)) set.delete(date);
  else set.add(date);
  return [...set].sort();
}

/** Mọi ngày của chuỗi lặp trong [rangeStart, rangeEnd], bắt đầu từ startDate. */
export function occurrenceDatesInRange(
  startDate: string,
  recurrence: Recurrence,
  rangeStart: string,
  rangeEnd: string,
): string[] {
  if (recurrence === 'none') {
    return startDate >= rangeStart && startDate <= rangeEnd ? [startDate] : [];
  }
  const out: string[] = [];
  let d = startDate;
  while (d < rangeStart) d = nextDueDate(d, recurrence); // bỏ kỳ trước khoảng
  while (d <= rangeEnd) {
    out.push(d);
    d = nextDueDate(d, recurrence);
  }
  return out;
}

/** Thay template lặp bằng occurrence ảo trong khoảng; việc thường giữ nguyên. */
export function expandRecurring(todos: Todo[], rangeStart: string, rangeEnd: string): Todo[] {
  const out: Todo[] = [];
  for (const t of todos) {
    if (t.recurrence === 'none' || !t.due_date) {
      out.push(t);
      continue;
    }
    for (const date of occurrenceDatesInRange(t.due_date, t.recurrence, rangeStart, rangeEnd)) {
      out.push({ ...t, id: `${t.id}::${date}`, due_date: date, is_done: t.completed_dates.includes(date) });
    }
  }
  return out;
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npm test -- --run src/lib/recurringOccurrences.test.ts`
Expected: PASS (toàn bộ mô tả trên).

- [ ] **Step 5: Commit**

```bash
git add src/lib/recurringOccurrences.ts src/lib/recurringOccurrences.test.ts
git commit -m "feat(recurrence): lib sinh occurrence ảo (expand/parse/toggle)"
```

---

### Task 3: Gỡ cuốn-chiếu + mô hình done cho list Việc

**Files:**
- Modify: `src/lib/recurrence.ts` (xóa `buildNextOccurrence`)
- Modify: `src/lib/recurrence.test.ts` (xóa test `buildNextOccurrence`)
- Modify: `src/hooks/useTodos.ts` (xóa `completeRecurring`, ref, import)
- Modify: `src/pages/AppPage.tsx` (toggleDone + map is_done cho việc lặp trong list)

**Interfaces:**
- Consumes: `toggleDateInList` (Task 2), `Todo.completed_dates` (Task 1).
- Produces: `useTodos` không còn `completeRecurring` trong giá trị trả về.

- [ ] **Step 1: Xóa `buildNextOccurrence`** — `src/lib/recurrence.ts`: xóa toàn bộ hàm `buildNextOccurrence` (từ comment `/** Dữ liệu để tạo việc cho kỳ lặp tiếp theo... */` đến hết hàm) và bỏ import `NewTodo` nếu không còn dùng. Giữ nguyên `nextDueDate` và các helper ngày.

- [ ] **Step 2: Xóa test của nó** — `src/lib/recurrence.test.ts`: xóa khối `describe('buildNextOccurrence', ...)` và import `buildNextOccurrence`. Giữ các test `nextDueDate`.

- [ ] **Step 3: Gỡ `completeRecurring` khỏi useTodos** — `src/hooks/useTodos.ts`:
  - Xóa `import { buildNextOccurrence } from '../lib/recurrence';`
  - Xóa `completeRecurring: (todo: Todo) => Promise<void>;` khỏi interface trả về.
  - Xóa `pendingRecurring` ref (khai báo `useRef`) và toàn bộ `const completeRecurring = useCallback(...)`.
  - Xóa `completeRecurring` khỏi object `return { ... }`.

- [ ] **Step 4: Viết test thất bại (AppPage toggle lặp)** — thêm file `src/pages/AppPage.recurring.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { recurringToggle } from './recurringToggle';
import type { Todo } from '../types/todo';

function todo(p: Partial<Todo>): Todo {
  return {
    id: 't1', user_id: 'u', title: 'Uống thuốc', notes: null, is_done: false,
    due_date: '2026-07-12', priority: 'medium', tags: [], recurrence: 'daily',
    completed_dates: [], sort_order: 0, created_at: '', updated_at: '', ...p,
  };
}

describe('recurringToggle', () => {
  it('việc lặp → cập nhật completed_dates ở due_date, không set is_done', () => {
    const onUpdate = vi.fn();
    recurringToggle(todo({ completed_dates: [] }), onUpdate);
    expect(onUpdate).toHaveBeenCalledWith('t1', { completed_dates: ['2026-07-12'] });
  });

  it('việc lặp đã xong hôm đó → bỏ tick (xóa khỏi completed_dates)', () => {
    const onUpdate = vi.fn();
    recurringToggle(todo({ completed_dates: ['2026-07-12'] }), onUpdate);
    expect(onUpdate).toHaveBeenCalledWith('t1', { completed_dates: [] });
  });
});
```

- [ ] **Step 5: Chạy test để xác nhận fail**

Run: `npm test -- --run src/pages/AppPage.recurring.test.tsx`
Expected: FAIL — `./recurringToggle` chưa tồn tại.

- [ ] **Step 6: Tạo helper** — `src/pages/recurringToggle.ts`:

```ts
import type { Todo, TodoUpdate } from '../types/todo';
import { toggleDateInList } from '../lib/recurringOccurrences';

/**
 * Tick việc lặp trong list phẳng: bật/tắt hoàn thành cho ngày bắt đầu (due_date)
 * qua completed_dates. Không đụng is_done (việc lặp done suy từ completed_dates).
 */
export function recurringToggle(todo: Todo, onUpdate: (id: string, patch: TodoUpdate) => void): void {
  if (!todo.due_date) return;
  onUpdate(todo.id, { completed_dates: toggleDateInList(todo.completed_dates, todo.due_date) });
}
```

- [ ] **Step 7: Nối vào AppPage** — `src/pages/AppPage.tsx`:

Bỏ `completeRecurring` khỏi chỗ destructure kết quả `useTodos(...)`.

Sửa `toggleDone` (đang gọi `completeRecurring`) thành:

```tsx
  // Việc lặp: done tính theo completed_dates (theo ngày). Việc thường giữ is_done.
  const toggleDone = (id: string, isDone: boolean) => {
    const todo = todos.find((t) => t.id === id);
    if (todo && todo.recurrence !== 'none') {
      recurringToggle(todo, updateTodo);
      return;
    }
    updateTodo(id, { is_done: isDone });
  };
```

Thêm import: `import { recurringToggle } from './recurringToggle';`

Map `is_done` hiển thị cho việc lặp **trước khi** lọc smart-view. Ngay sau dòng `const today = new Date().toLocaleDateString('en-CA');` (khoảng dòng 60), thêm:

```tsx
  // Việc lặp hiện 1 lần trong list phẳng: done phản ánh completed_dates ở ngày bắt đầu
  // (để bộ lọc today/done và checkbox đúng). PlanPage KHÔNG dùng cái này — nó tự expand.
  const todosForList = useMemo(
    () =>
      todos.map((t) =>
        t.recurrence !== 'none' && t.due_date
          ? { ...t, is_done: t.completed_dates.includes(t.due_date) }
          : t,
      ),
    [todos],
  );
```

Đổi 2 memo dùng `todos` sang `todosForList`:
- Trong `visible` (dòng ~63): `applySmartView(todos, view, today)` → `applySmartView(todosForList, view, today)`; và deps `[todos, ...]` → `[todosForList, ...]`.
- Trong `counts` (dòng ~75): `applySmartView(todos, v, today)` → `applySmartView(todosForList, v, today)`; deps `[todos, today]` → `[todosForList, today]`.

Giữ nguyên `tagCounts` (nhãn không phụ thuộc is_done) và **giữ nguyên** props `todos={todos}` truyền cho `<PlanPage>` (dòng ~165).

- [ ] **Step 8: Chạy test để xác nhận pass**

Run: `npm test -- --run src/pages/AppPage.recurring.test.tsx src/lib/recurrence.test.ts`
Expected: PASS.

Run: `npm run build`
Expected: PASS (không còn tham chiếu `completeRecurring`/`buildNextOccurrence`).

- [ ] **Step 9: Commit**

```bash
git add src/lib/recurrence.ts src/lib/recurrence.test.ts src/hooks/useTodos.ts src/pages/AppPage.tsx src/pages/recurringToggle.ts src/pages/AppPage.recurring.test.tsx
git commit -m "feat(recurrence): bỏ cuốn-chiếu, list Việc dùng completed_dates"
```

---

### Task 4: View Năm/5 Năm — hiện việc lặp 1 lần/kỳ

**Files:**
- Modify: `src/lib/todoCell.ts` (`cellFrom`)
- Test: `src/lib/todoCell.test.ts`

**Interfaces:**
- Consumes: `occurrenceDatesInRange` (Task 2).
- Produces: `buildMonthCells`/`buildYearCells` gộp việc lặp thành 1 đại diện/kỳ, id `"<id>::P<key>"`.

- [ ] **Step 1: Viết test thất bại** — thêm vào `src/lib/todoCell.test.ts` (dùng factory Todo sẵn có trong file, đã có `completed_dates` từ Task 1):

```ts
  it('việc lặp daily hiện 1 đại diện/kỳ trong ô tháng, id có ::P', () => {
    const daily = todo({ id: 'd1', due_date: '2026-01-05', recurrence: 'daily', completed_dates: [] });
    const cells = buildMonthCells([daily], '2026');
    const march = cells.find((c) => c.key === '2026-03')!;
    expect(march.todos).toHaveLength(1);
    expect(march.todos[0].id).toBe('d1::P2026-03');
    expect(march.totalCount).toBe(1);
  });

  it('đại diện kỳ is_done = mọi occurrence trong kỳ đã xong', () => {
    // Tháng 2/2026 có 28 ngày; đánh dấu xong đủ 28 ngày.
    const all = Array.from({ length: 28 }, (_, i) => `2026-02-${String(i + 1).padStart(2, '0')}`);
    const daily = todo({ id: 'd1', due_date: '2026-01-05', recurrence: 'daily', completed_dates: all });
    const cells = buildMonthCells([daily], '2026');
    const feb = cells.find((c) => c.key === '2026-02')!;
    expect(feb.todos[0].is_done).toBe(true);
  });
```

Đảm bảo `todo`, `buildMonthCells` đã được import trong file test (bổ sung nếu thiếu).

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `npm test -- --run src/lib/todoCell.test.ts`
Expected: FAIL — hiện `cellFrom` lọc theo `due_date` nên template daily (start 05/01) không xuất hiện ở tháng 3.

- [ ] **Step 3: Cài đặt** — `src/lib/todoCell.ts`:

Thêm import: `import { occurrenceDatesInRange } from './recurringOccurrences';`

Thay hàm `cellFrom`:

```ts
/** Dựng 1 ô gom: việc thường lọc theo kỳ; việc lặp gộp thành 1 đại diện/kỳ. */
function cellFrom(todos: Todo[], childHorizon: Horizon, key: string, label: string): TodoCellData {
  const { start, end } = getPeriodRange(childHorizon, key);
  const items: Todo[] = [];
  for (const t of todos) {
    if (t.recurrence !== 'none' && t.due_date) {
      const dates = occurrenceDatesInRange(t.due_date, t.recurrence, start, end);
      if (dates.length > 0) {
        items.push({
          ...t,
          id: `${t.id}::P${key}`,
          due_date: dates[0],
          is_done: dates.every((d) => t.completed_dates.includes(d)),
        });
      }
    } else if (t.due_date !== null && t.due_date >= start && t.due_date <= end) {
      items.push(t);
    }
  }
  const sorted = sortByDoneThenOrder(items);
  return {
    key,
    label,
    todos: sorted,
    doneCount: sorted.filter((t) => t.is_done).length,
    totalCount: sorted.length,
  };
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npm test -- --run src/lib/todoCell.test.ts`
Expected: PASS (test cũ + 2 test mới).

- [ ] **Step 5: Commit**

```bash
git add src/lib/todoCell.ts src/lib/todoCell.test.ts
git commit -m "feat(recurrence): view Năm/5Năm hiện việc lặp 1 đại diện/kỳ"
```

---

### Task 5: PlanPage — bung occurrence + định tuyến tick/sửa/xóa

**Files:**
- Modify: `src/components/PlanPage.tsx`

**Interfaces:**
- Consumes: `expandRecurring`, `parseOccurrenceId`, `toggleDateInList`, `occurrenceDatesInRange` (Task 2); `getPeriodRange` (đã import qua goalFilters); props `onToggleTodo/onUpdateTodo/onDeleteTodo` sẵn có.

- [ ] **Step 1: Thêm import** — `src/components/PlanPage.tsx`:

```tsx
import { expandRecurring, parseOccurrenceId, toggleDateInList, occurrenceDatesInRange } from '../lib/recurringOccurrences';
import type { Horizon } from '../types/goal';
```

(Nếu `getPeriodRange` chưa nằm trong import từ `../lib/goalFilters`, thêm vào — hiện đã có.)

- [ ] **Step 2: Bung occurrence cho view theo ngày** — sửa 2 memo:

`dayTodos` (view Ngày):

```tsx
  const dayTodos = useMemo(
    () =>
      horizon === 'day'
        ? sortByDoneThenOrder(expandRecurring(todos, periodKey, periodKey).filter((t) => t.due_date === periodKey))
        : [],
    [todos, horizon, periodKey],
  );
```

`dayGrid` (view Tháng/Tuần) — bung 1 lần theo khoảng kỳ rồi lọc từng ngày:

```tsx
  const dayGrid = useMemo((): { leadingBlanks: number; cells: DayCellData[] } | null => {
    if (horizon !== 'month' && horizon !== 'week') return null;
    const { start, end } = getPeriodRange(horizon, periodKey);
    const expanded = expandRecurring(todos, start, end);
    const dates = getChildPeriods(horizon, periodKey);
    let leadingBlanks = 0;
    if (horizon === 'month') {
      const [y, m] = periodKey.split('-').map(Number);
      const firstWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
      leadingBlanks = (firstWeekday + 6) % 7;
    }
    const cells = dates.map((date) => ({
      date,
      dayNumber: Number(date.slice(8, 10)),
      todos: sortByDoneThenOrder(expanded.filter((t) => t.due_date === date)),
    }));
    return { leadingBlanks, cells };
  }, [horizon, periodKey, todos]);
```

(`monthCells`/`yearCells` KHÔNG đổi — Task 4 đã xử lý gộp trong `buildMonthCells`/`buildYearCells`.)

- [ ] **Step 3: Thêm handler định tuyến** — trong thân `PlanPage`, sau các `handle...` hiện có:

```tsx
  function handleToggleOccurrence(id: string, done: boolean) {
    const ref = parseOccurrenceId(id);
    if (!ref) {
      onToggleTodo(id, done);
      return;
    }
    const template = todos.find((t) => t.id === ref.templateId);
    if (!template || !template.due_date) return;
    if (ref.kind === 'day') {
      onUpdateTodo(template.id, { completed_dates: toggleDateInList(template.completed_dates, ref.date) });
      return;
    }
    // kind === 'period': bật/tắt cả kỳ.
    const childHorizon: Horizon = horizon === 'five_year' ? 'year' : 'month';
    const { start, end } = getPeriodRange(childHorizon, ref.periodKey);
    const dates = occurrenceDatesInRange(template.due_date, template.recurrence, start, end);
    const allDone = dates.every((d) => template.completed_dates.includes(d));
    const set = new Set(template.completed_dates);
    dates.forEach((d) => (allDone ? set.delete(d) : set.add(d)));
    onUpdateTodo(template.id, { completed_dates: [...set].sort() });
  }

  function handleEditOccurrence(todo: Todo) {
    const ref = parseOccurrenceId(todo.id);
    const template = ref ? todos.find((t) => t.id === ref.templateId) : todo;
    if (template) setEditingTodo(template);
  }

  function handleDeleteOccurrence(id: string) {
    const ref = parseOccurrenceId(id);
    onDeleteTodo(ref ? ref.templateId : id);
  }

  // Sửa inline trong tab Ngày: occurrence ảo → áp cho template (sửa cả chuỗi).
  function handleUpdateOccurrence(id: string, patch: TodoUpdate) {
    const ref = parseOccurrenceId(id);
    onUpdateTodo(ref ? ref.templateId : id, patch);
  }
```

- [ ] **Step 4: Nối handler vào các view** — thay callback ở JSX:
  - `<TodoList>` (tab Ngày): `onToggle={handleToggleOccurrence}`, `onUpdate={handleUpdateOccurrence}`, `onDelete={handleDeleteOccurrence}` (giữ `onReorder={onReorderTodos}`, `defaultShowNotes`).
  - `<DayGrid>`: `onToggle={handleToggleOccurrence}`, `onDelete={handleDeleteOccurrence}`, `onEdit={handleEditOccurrence}` (giữ `onAdd`, `onOpenFull`).
  - `<MonthGrid>` và `<YearGrid>`: `onToggleTodo={handleToggleOccurrence}`, `onDeleteTodo={handleDeleteOccurrence}`, `onEditTodo={handleEditOccurrence}` (giữ `onSelect`, `onAddTodo`).

- [ ] **Step 5: Xác minh build + test**

Run: `npm run build`
Expected: PASS (không lỗi type; `Horizon`/`TodoUpdate` đã import).

Run: `npm test -- --run`
Expected: PASS toàn bộ.

- [ ] **Step 6: Commit**

```bash
git add src/components/PlanPage.tsx
git commit -m "feat(recurrence): PlanPage bung occurrence + định tuyến tick/sửa/xóa"
```

---

### Task 6: Modal — dọn completed_dates khi bỏ lặp

**Files:**
- Modify: `src/components/TodoEditModal.tsx`

**Interfaces:**
- Consumes: `onSave(id, patch: TodoUpdate)` sẵn có.

- [ ] **Step 1: Sửa hàm lưu** — `src/components/TodoEditModal.tsx`, trong hàm submit/`save`, ở đối tượng patch gửi cho `onSave`, khi `recurrence` kết quả là `'none'` thì kèm `completed_dates: []`. Sửa dòng dựng patch:

Hiện có `recurrence: dueDate ? recurrence : 'none',`. Ngay dưới trường đó, thêm điều kiện dọn mảng:

```tsx
      recurrence: dueDate ? recurrence : 'none',
      ...(dueDate && recurrence !== 'none' ? {} : { completed_dates: [] }),
```

(Khi việc trở thành không-lặp → xóa completed_dates cho sạch; khi vẫn lặp → không đụng mảng.)

- [ ] **Step 2: Xác minh build + test**

Run: `npm run build`
Expected: PASS.

Run: `npm test -- --run src/components/TodoEditModal.test.tsx`
Expected: PASS (test hiện có vẫn xanh; patch chỉ thêm trường khi bỏ lặp).

- [ ] **Step 3: Commit**

```bash
git add src/components/TodoEditModal.tsx
git commit -m "feat(recurrence): dọn completed_dates khi đổi việc lặp về không-lặp"
```

---

### Task 7: Xác minh toàn bộ + ghi chú migration

**Files:** (không sửa code)

- [ ] **Step 1: Full test**

Run: `npm test -- --run`
Expected: PASS toàn bộ (bao gồm các test mới của Task 2/3/4).

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: `tsc -b` + `vite build` PASS.

- [ ] **Step 3: Nhắc bước thủ công** — báo NewPL: phải chạy `supabase/migrations/2026-07-12-completed-dates.sql` trên Supabase (SQL Editor) **trước khi** dùng thật, nếu không cột `completed_dates` chưa tồn tại → tick việc lặp sẽ lỗi lưu.

---

## Self-Review

- **Spec coverage:** cột `completed_dates` + migration → Task 1; `expandRecurring`/`occurrenceDatesInRange`/`parseOccurrenceId`/`toggleDateInList` → Task 2; bỏ `completeRecurring`/`buildNextOccurrence` + list Việc → Task 3; view gom 1/kỳ → Task 4; bung view ngày + định tuyến tick/sửa/xóa → Task 5; dọn mảng khi bỏ lặp → Task 6; xác minh + nhắc migration → Task 7. Kiểm thử trong spec khớp Task 2/4 (+ Task 3 helper).
- **Placeholder scan:** không TBD/TODO; mỗi step có code/lệnh cụ thể.
- **Type consistency:** `completed_dates: string[]` (Todo) + `TodoUpdate` (Task 1) dùng nhất quán ở Task 2/3/4/5/6; id occurrence `"<id>::<date>"` và `"<id>::P<key>"` khớp giữa `expandRecurring`/`cellFrom` (sinh) và `parseOccurrenceId` (đọc); `handleToggleOccurrence` dùng `Horizon` từ `../types/goal`.
- **Ghi chú phạm vi (khớp spec "Ngoài phạm vi"):** kéo-thả occurrence ảo trong tab Ngày ghi `sort_order` theo id tổng hợp → Supabase cập nhật 0 dòng (vô hại, không lỗi); sửa inline occurrence áp cả chuỗi (kể cả due_date). Đã nêu trong spec.
