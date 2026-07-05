# Việc lặp cố định ngày + ẩn việc đã xong (Phase 2a) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép gắn quy tắc lặp (tuần/tháng/năm) vào một việc; tick hoàn
thành một việc lặp sẽ tự sinh việc cho kỳ tiếp theo; việc đã hoàn thành ẩn
khỏi các view đang làm nhưng vẫn lưu lại (xem ở view "Đã xong").

**Architecture:** Không thêm bảng mới — mỗi kỳ lặp vẫn là một dòng `todos`
bình thường, thêm cột `recurrence`. Logic tính ngày kỳ sau là hàm thuần
(`src/lib/recurrence.ts`, test trước). `useTodos.ts` điều phối: insert kỳ mới
trước, chỉ đánh dấu kỳ hiện tại là xong sau khi insert thành công (không mất
reminder nếu lỗi mạng). `todoFilters.ts` sửa để smart view `'all'` loại việc
đã xong.

**Tech Stack:** React + TypeScript + Vite, Supabase (Postgres + RLS), Vitest.

## Global Constraints

- TypeScript ở mọi nơi, tránh `any` (CLAUDE.md).
- Không nuốt lỗi im lặng: lỗi insert/update phải hiện `ErrorBanner` +
  `console.error` (NFR-1, spec mục 6).
- Chỉ dùng Supabase `anon` key ở frontend; không đổi RLS policy hiện có
  (spec mục 2 — cột mới cùng bảng, cùng policy).
- Giao diện và text hiển thị bằng tiếng Việt; comment code giải thích "vì
  sao", không mô tả lại code hiển nhiên.
- Trước khi báo "xong" mỗi task: `npm test` và `npm run build` phải pass
  thật (CLAUDE.md).
- Việc lặp bắt buộc có `due_date` — xử lý ở tầng UI (làm invalid state
  không thể nhập được), không thêm ràng buộc ở DB (spec mục 2).
- Sinh kỳ tiếp theo làm ở client (không cron/edge function) — phản ứng trực
  tiếp với hành động tick xong của người dùng (spec mục 3).

---

### Task 1: Data model — cột `recurrence` + kiểu TypeScript

**Files:**
- Modify: `supabase/schema.sql`
- Modify: `src/types/todo.ts`
- Modify: `src/lib/todoFilters.test.ts` (helper `makeTodo` cần field mới để compile)

**Interfaces:**
- Produces: `type Recurrence = 'none' | 'weekly' | 'monthly' | 'yearly'`
  (từ `src/types/todo.ts`); `Todo.recurrence: Recurrence`;
  `NewTodo.recurrence?: Recurrence`; `TodoUpdate` cho phép sửa `recurrence`.

- [ ] **Step 1: Thêm cột vào schema.sql**

Thêm vào cuối file `supabase/schema.sql`:

```sql

-- Phase 2a: việc lặp cố định ngày (xem
-- docs/superpowers/specs/2026-07-05-recurring-tasks-design.md).
alter table public.todos
  add column if not exists recurrence text not null default 'none'
  check (recurrence in ('none', 'weekly', 'monthly', 'yearly'));
```

**Quan trọng:** file này chỉ áp dụng khi chạy thủ công trong Supabase
Dashboard > SQL Editor (đúng quy ước hiện tại của dự án — không có migration
runner tự động). Sau khi hoàn tất toàn bộ plan, phải vào Supabase Dashboard,
dán và chạy đúng câu lệnh `alter table` này lên project thật, nếu không các
bước insert có `recurrence` ở Task 4 trở đi sẽ lỗi "column does not exist".

- [ ] **Step 2: Cập nhật `src/types/todo.ts`**

Sửa file thành:

```ts
export type Priority = 'high' | 'medium' | 'low';
export type SmartView = 'today' | 'upcoming' | 'all' | 'done';
export type Recurrence = 'none' | 'weekly' | 'monthly' | 'yearly';

export interface Todo {
  id: string;
  user_id: string;
  title: string;
  notes: string | null;
  is_done: boolean;
  due_date: string | null; // 'YYYY-MM-DD'
  priority: Priority;
  tags: string[];
  recurrence: Recurrence;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** Dữ liệu để tạo việc mới (server tự sinh id/user_id/timestamps). */
export interface NewTodo {
  title: string;
  notes?: string | null;
  due_date?: string | null;
  priority?: Priority;
  tags?: string[];
  recurrence?: Recurrence;
}

/** Các trường được phép sửa. */
export type TodoUpdate = Partial<
  Pick<
    Todo,
    'title' | 'notes' | 'is_done' | 'due_date' | 'priority' | 'tags' | 'recurrence' | 'sort_order'
  >
>;
```

- [ ] **Step 3: Sửa helper `makeTodo` trong `src/lib/todoFilters.test.ts` cho khớp type mới**

Trong hàm `makeTodo`, thêm field `recurrence` (mặc định `'none'`):

```ts
function makeTodo(over: Partial<Todo>): Todo {
  return {
    id: over.id ?? crypto.randomUUID(),
    user_id: 'u1',
    title: over.title ?? 'Việc',
    notes: null,
    is_done: over.is_done ?? false,
    due_date: over.due_date ?? null,
    priority: over.priority ?? 'medium',
    tags: over.tags ?? [],
    recurrence: over.recurrence ?? 'none',
    sort_order: over.sort_order ?? 0,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
  };
}
```

- [ ] **Step 4: Xác nhận vẫn build & test pass (chưa đổi hành vi)**

Run: `npm run build`
Expected: biên dịch thành công, không lỗi TypeScript.

Run: `npm test`
Expected: tất cả test hiện có pass (chưa có test mới, chưa đổi logic).

- [ ] **Step 5: Commit**

```bash
git add supabase/schema.sql src/types/todo.ts src/lib/todoFilters.test.ts
git commit -m "feat: thêm cột recurrence cho việc lặp cố định ngày (Phase 2a)"
```

---

### Task 2: `src/lib/recurrence.ts` — tính ngày kỳ tiếp theo (TDD)

**Files:**
- Create: `src/lib/recurrence.ts`
- Create: `src/lib/recurrence.test.ts`

**Interfaces:**
- Consumes: `Todo`, `NewTodo`, `Recurrence` từ `src/types/todo.ts` (Task 1).
- Produces: `nextDueDate(dueDate: string, recurrence: Recurrence): string`;
  `buildNextOccurrence(todo: Todo): NewTodo` (ném lỗi nếu
  `todo.due_date` là `null`). Dùng ở Task 4 (`useTodos.ts`).

- [ ] **Step 1: Viết test trước (sẽ fail vì chưa có file `recurrence.ts`)**

Tạo `src/lib/recurrence.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { Todo } from '../types/todo';
import { nextDueDate, buildNextOccurrence } from './recurrence';

describe('nextDueDate', () => {
  it('weekly: cộng 7 ngày', () => {
    expect(nextDueDate('2026-07-01', 'weekly')).toBe('2026-07-08');
  });
  it('monthly: cộng 1 tháng, ngày thường', () => {
    expect(nextDueDate('2026-07-15', 'monthly')).toBe('2026-08-15');
  });
  it('monthly: dồn về cuối tháng khi tháng sau không có ngày gốc', () => {
    expect(nextDueDate('2026-01-31', 'monthly')).toBe('2026-02-28');
  });
  it('monthly: năm nhuận vẫn tính đúng 29/2', () => {
    expect(nextDueDate('2024-01-31', 'monthly')).toBe('2024-02-29');
  });
  it('monthly: cộng qua năm mới', () => {
    expect(nextDueDate('2026-12-15', 'monthly')).toBe('2027-01-15');
  });
  it('yearly: cộng 1 năm, dồn 29/2 về 28/2 năm không nhuận', () => {
    expect(nextDueDate('2024-02-29', 'yearly')).toBe('2025-02-28');
  });
  it('none: giữ nguyên ngày', () => {
    expect(nextDueDate('2026-07-15', 'none')).toBe('2026-07-15');
  });
});

function makeTodo(over: Partial<Todo>): Todo {
  return {
    id: over.id ?? 'x',
    user_id: 'u1',
    title: over.title ?? 'Đóng thẻ VPBank',
    notes: over.notes ?? null,
    is_done: over.is_done ?? false,
    due_date: over.due_date === undefined ? '2026-07-15' : over.due_date,
    priority: over.priority ?? 'medium',
    tags: over.tags ?? [],
    recurrence: over.recurrence ?? 'monthly',
    sort_order: over.sort_order ?? 0,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
  };
}

describe('buildNextOccurrence', () => {
  it('copy title/notes/priority/tags/recurrence, tính due_date kỳ sau', () => {
    const todo = makeTodo({ title: 'Đóng thẻ VPBank', tags: ['tài chính'], priority: 'high' });
    const next = buildNextOccurrence(todo);
    expect(next).toEqual({
      title: 'Đóng thẻ VPBank',
      notes: null,
      due_date: '2026-08-15',
      priority: 'high',
      tags: ['tài chính'],
      recurrence: 'monthly',
    });
  });
  it('báo lỗi nếu việc lặp không có due_date', () => {
    const todo = makeTodo({ due_date: null });
    expect(() => buildNextOccurrence(todo)).toThrow();
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run src/lib/recurrence.test.ts`
Expected: FAIL — không tìm thấy module `./recurrence`.

- [ ] **Step 3: Viết `src/lib/recurrence.ts`**

```ts
import type { NewTodo, Recurrence, Todo } from '../types/todo';

/** Ngày đến hạn kế tiếp cho một kỳ lặp, tính từ ngày đến hạn hiện tại. */
export function nextDueDate(dueDate: string, recurrence: Recurrence): string {
  const [year, month, day] = dueDate.split('-').map(Number);
  switch (recurrence) {
    case 'weekly':
      return addDays(year, month, day, 7);
    case 'monthly':
      return addMonths(year, month, day, 1);
    case 'yearly':
      return addMonths(year, month, day, 12);
    case 'none':
      return dueDate;
  }
}

function addDays(year: number, month: number, day: number, days: number): string {
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return toDateString(date);
}

/**
 * Cộng thêm `months` tháng; nếu ngày gốc không tồn tại ở tháng đích (VD 31/1
 * cộng 1 tháng → tháng 2 không có ngày 31) thì dồn về ngày cuối tháng đó.
 */
function addMonths(year: number, month: number, day: number, months: number): string {
  const totalMonths = month - 1 + months;
  const targetYear = year + Math.floor(totalMonths / 12);
  const targetMonth = ((totalMonths % 12) + 12) % 12;
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const clampedDay = Math.min(day, lastDayOfTargetMonth);
  return toDateString(new Date(Date.UTC(targetYear, targetMonth, clampedDay)));
}

function toDateString(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Dữ liệu để tạo việc cho kỳ lặp tiếp theo, dựa trên việc của kỳ hiện tại. */
export function buildNextOccurrence(todo: Todo): NewTodo {
  if (!todo.due_date) {
    throw new Error('Việc lặp phải có hạn chót để tính kỳ tiếp theo.');
  }
  return {
    title: todo.title,
    notes: todo.notes,
    due_date: nextDueDate(todo.due_date, todo.recurrence),
    priority: todo.priority,
    tags: todo.tags,
    recurrence: todo.recurrence,
  };
}
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `npx vitest run src/lib/recurrence.test.ts`
Expected: PASS — toàn bộ test trong file này xanh.

- [ ] **Step 5: Commit**

```bash
git add src/lib/recurrence.ts src/lib/recurrence.test.ts
git commit -m "feat: thêm logic tính kỳ lặp tiếp theo (nextDueDate, buildNextOccurrence)"
```

---

### Task 3: Ẩn việc đã xong khỏi smart view `'all'` (TDD)

**Files:**
- Modify: `src/lib/todoFilters.ts`
- Modify: `src/lib/todoFilters.test.ts`

**Interfaces:**
- Consumes: không có gì mới.
- Produces: hành vi mới của `applySmartView(todos, 'all', today)` — loại bỏ
  todo có `is_done === true`. Dùng nguyên trạng ở `AppPage.tsx` (không cần sửa
  `AppPage.tsx` — nó tự động ẩn phần "ĐÃ XONG" vì lọc từ `visible`).

- [ ] **Step 1: Sửa test trước để phản ánh hành vi mong muốn (sẽ fail)**

Trong `src/lib/todoFilters.test.ts`, tìm khối `describe('applySmartView', ...)`
và thay test `'"all" trả tất cả'` bằng:

```ts
  it('"all" gồm việc chưa xong, không gồm việc đã xong', () => {
    const ids = applySmartView(todos, 'all', today).map((t) => t.id).sort();
    expect(ids).toEqual(['a', 'b', 'c', 'd']);
  });
```

(Giữ nguyên các test khác trong khối này — `'today'`, `'upcoming'`, `'done'`.)

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run src/lib/todoFilters.test.ts`
Expected: FAIL ở test `'"all" gồm việc chưa xong...'` — nhận được 5 phần tử
(gồm cả `'e'` là việc đã xong) thay vì `['a','b','c','d']`.

- [ ] **Step 3: Sửa `applySmartView` trong `src/lib/todoFilters.ts`**

Đổi nhánh `case 'all'`:

```ts
    case 'all':
      return todos.filter((t) => !t.is_done);
```

(Toàn bộ hàm giữ nguyên các nhánh khác.)

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `npx vitest run src/lib/todoFilters.test.ts`
Expected: PASS toàn bộ.

- [ ] **Step 5: Commit**

```bash
git add src/lib/todoFilters.ts src/lib/todoFilters.test.ts
git commit -m "fix: ẩn việc đã xong khỏi smart view Tất cả, giữ lại ở view Đã xong"
```

---

### Task 4: `useTodos.ts` — sinh kỳ tiếp theo khi tick hoàn thành

**Files:**
- Modify: `src/hooks/useTodos.ts`

**Interfaces:**
- Consumes: `buildNextOccurrence(todo: Todo): NewTodo` từ
  `src/lib/recurrence.ts` (Task 2).
- Produces: `UseTodos.addTodo` đổi kiểu trả về thành `Promise<boolean>` (true
  = insert thành công); `UseTodos.completeRecurring: (todo: Todo) =>
  Promise<void>`. Dùng ở Task 8 (`AppPage.tsx`).

- [ ] **Step 1: Thêm import và đổi `addTodo` để trả về thành công/thất bại**

Thêm import ở đầu file:

```ts
import { buildNextOccurrence } from '../lib/recurrence';
```

Sửa `addTodo`:

```ts
  const addTodo = useCallback(
    async (input: NewTodo): Promise<boolean> => {
      const maxOrder = todos.reduce((m, t) => Math.max(m, t.sort_order), 0);
      const { error } = await supabase.from('todos').insert({
        user_id: userId,
        title: input.title,
        notes: input.notes ?? null,
        due_date: input.due_date ?? null,
        priority: input.priority ?? 'medium',
        tags: input.tags ?? [],
        recurrence: input.recurrence ?? 'none',
        sort_order: maxOrder + 1,
      });
      if (error) {
        console.error('Lỗi thêm việc:', error);
        setError('Không thêm được việc: ' + error.message);
        return false;
      }
      return true;
    },
    [todos, userId],
  );
```

- [ ] **Step 2: Thêm hàm `completeRecurring`**

Thêm ngay sau `deleteTodo`:

```ts
  // Tick hoàn thành một việc lặp: sinh kỳ sau TRƯỚC, chỉ đánh dấu kỳ hiện tại
  // là xong nếu sinh thành công — tránh mất reminder nếu lỗi mạng giữa chừng.
  // recurrence = 'none' cho kỳ vừa xong để nó thành bản ghi lịch sử thuần túy,
  // chống sinh trùng nếu người dùng bỏ tick rồi tick lại.
  const completeRecurring = useCallback(
    async (todo: Todo) => {
      let next: NewTodo;
      try {
        next = buildNextOccurrence(todo);
      } catch (e) {
        console.error('Lỗi tính kỳ lặp tiếp theo:', e);
        setError('Việc lặp thiếu hạn chót, không tính được kỳ tiếp theo.');
        return;
      }
      const inserted = await addTodo(next);
      if (!inserted) return;
      await updateTodo(todo.id, { is_done: true, recurrence: 'none' });
    },
    [addTodo, updateTodo],
  );
```

- [ ] **Step 3: Cập nhật interface `UseTodos` và giá trị trả về của hook**

Sửa interface:

```ts
interface UseTodos {
  todos: Todo[];
  loading: boolean;
  error: string | null;
  addTodo: (input: NewTodo) => Promise<boolean>;
  updateTodo: (id: string, patch: TodoUpdate) => Promise<void>;
  deleteTodo: (id: string) => Promise<void>;
  reorderTodos: (ordered: Todo[]) => Promise<void>;
  completeRecurring: (todo: Todo) => Promise<void>;
  clearError: () => void;
}
```

Sửa dòng `return` ở cuối hook:

```ts
  return {
    todos,
    loading,
    error,
    addTodo,
    updateTodo,
    deleteTodo,
    reorderTodos,
    completeRecurring,
    clearError,
  };
```

- [ ] **Step 4: Xác nhận build pass**

Run: `npm run build`
Expected: biên dịch thành công, không lỗi TypeScript (không có test tự động
cho `useTodos.ts` — hook gọi Supabase thật, dự án chưa có hạ tầng mock; xác
minh cuối cùng bằng chạy tay ở Task 8).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useTodos.ts
git commit -m "feat: useTodos sinh kỳ lặp tiếp theo khi tick hoàn thành"
```

---

### Task 5: `TodoForm.tsx` — chọn quy tắc lặp khi thêm việc

**Files:**
- Modify: `src/components/TodoForm.tsx`

**Interfaces:**
- Consumes: `Recurrence` từ `src/types/todo.ts` (Task 1); `NewTodo.recurrence`.
- Produces: không có gì tầng dưới phụ thuộc (form độc lập).

- [ ] **Step 1: Sửa `src/components/TodoForm.tsx`**

Thay toàn bộ nội dung file bằng:

```tsx
import { useState } from 'react';
import type { NewTodo, Priority, Recurrence } from '../types/todo';

const inputClass =
  'rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none transition-colors placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-border-dark dark:bg-surface-2dark dark:text-text-dark dark:placeholder:text-text-muted-dark dark:focus:border-primary-dark dark:focus:ring-primary-dark/30';

/** Form thêm việc: tiêu đề + ưu tiên + hạn + nhãn + lặp lại. Nhấn Enter/nút để thêm. */
export function TodoForm({ onAdd }: { onAdd: (t: NewTodo) => void }) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [recurrence, setRecurrence] = useState<Recurrence>('none');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    const tags = tagsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    onAdd({ title: t, priority, due_date: dueDate || null, tags, recurrence });
    setTitle('');
    setDueDate('');
    setTagsText('');
    setPriority('medium');
    setRecurrence('none');
  }

  // Việc lặp cần due_date làm mốc tính kỳ sau — xóa hạn thì tự bỏ luôn lặp,
  // để không thể tạo ra tổ hợp "lặp nhưng không có hạn".
  function handleDueDateChange(value: string) {
    setDueDate(value);
    if (!value) setRecurrence('none');
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-3 dark:border-border-dark dark:bg-surface-dark"
    >
      <div className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-md bg-primary-soft text-base font-semibold text-primary dark:bg-primary-soft-dark dark:text-primary-dark">
        ＋
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Thêm việc nhanh — nhập tiêu đề rồi nhấn Enter"
        aria-label="Tiêu đề việc mới"
        className={`min-w-[12rem] flex-1 ${inputClass}`}
      />
      <select
        value={priority}
        onChange={(e) => setPriority(e.target.value as Priority)}
        className={inputClass}
        aria-label="Ưu tiên"
      >
        <option value="high">Cao</option>
        <option value="medium">Trung bình</option>
        <option value="low">Thấp</option>
      </select>
      <input
        type="date"
        value={dueDate}
        onChange={(e) => handleDueDateChange(e.target.value)}
        className={inputClass}
        aria-label="Hạn"
      />
      <select
        value={recurrence}
        onChange={(e) => setRecurrence(e.target.value as Recurrence)}
        disabled={!dueDate}
        className={inputClass}
        aria-label="Lặp lại"
        title={!dueDate ? 'Chọn hạn chót trước để bật lặp lại' : undefined}
      >
        <option value="none">Không lặp</option>
        <option value="weekly">Hàng tuần</option>
        <option value="monthly">Hàng tháng</option>
        <option value="yearly">Hàng năm</option>
      </select>
      <input
        value={tagsText}
        onChange={(e) => setTagsText(e.target.value)}
        placeholder="nhãn, cách nhau dấu phẩy"
        className={inputClass}
      />
      <button className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:shadow-md active:scale-95 dark:bg-primary-dark dark:shadow-soft-dark dark:hover:shadow-md-dark">
        Thêm
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Xác nhận build pass**

Run: `npm run build`
Expected: biên dịch thành công.

- [ ] **Step 3: Commit**

```bash
git add src/components/TodoForm.tsx
git commit -m "feat: TodoForm cho chọn quy tắc lặp lại"
```

---

### Task 6: `TodoItem.tsx` — sửa quy tắc lặp + badge 🔁

**Files:**
- Modify: `src/components/TodoItem.tsx`

**Interfaces:**
- Consumes: `Recurrence` từ `src/types/todo.ts`; `TodoUpdate.recurrence`.
- Produces: không có gì tầng dưới phụ thuộc.

- [ ] **Step 1: Thêm state và cập nhật form sửa**

Trong `src/components/TodoItem.tsx`:

1. Sửa import:

```ts
import type { Todo, TodoUpdate, Priority, Recurrence } from '../types/todo';
```

2. Thêm state (ngay sau dòng khai báo `notes`):

```ts
  const [recurrence, setRecurrence] = useState<Recurrence>(todo.recurrence);
```

3. Sửa `save()` để gửi `recurrence` (đặt về `'none'` nếu không có hạn, cùng
   quy tắc với `TodoForm`):

```ts
  function save(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    onUpdate(todo.id, {
      title: t,
      priority,
      due_date: dueDate || null,
      notes: notes.trim() || null,
      recurrence: dueDate ? recurrence : 'none',
      tags: tagsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    });
    setEditing(false);
  }

  function handleDueDateChange(value: string) {
    setDueDate(value);
    if (!value) setRecurrence('none');
  }
```

4. Trong khối JSX của chế độ `editing`, thay dòng input hạn:

```tsx
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={editInput} />
```

bằng:

```tsx
            <input
              type="date"
              value={dueDate}
              onChange={(e) => handleDueDateChange(e.target.value)}
              className={editInput}
            />
            <select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as Recurrence)}
              disabled={!dueDate}
              className={editInput}
              aria-label="Lặp lại"
              title={!dueDate ? 'Chọn hạn chót trước để bật lặp lại' : undefined}
            >
              <option value="none">Không lặp</option>
              <option value="weekly">Hàng tuần</option>
              <option value="monthly">Hàng tháng</option>
              <option value="yearly">Hàng năm</option>
            </select>
```

- [ ] **Step 2: Thêm badge 🔁 ở chế độ xem thường**

Trong khối JSX không chỉnh sửa, ngay trong `<div className="flex flex-wrap items-center gap-2">` (chứa `due_date` và `tags`), thêm trước `{todo.tags.map(...)}`:

```tsx
          {todo.recurrence !== 'none' && (
            <span
              className="text-xs text-text-muted dark:text-text-muted-dark"
              title="Việc lặp lại"
              aria-label="Việc lặp lại"
            >
              🔁
            </span>
          )}
```

- [ ] **Step 3: Xác nhận build pass**

Run: `npm run build`
Expected: biên dịch thành công.

- [ ] **Step 4: Commit**

```bash
git add src/components/TodoItem.tsx
git commit -m "feat: TodoItem cho sửa quy tắc lặp + hiện badge việc lặp"
```

---

### Task 7: `KanbanCard.tsx` — badge 🔁

**Files:**
- Modify: `src/components/KanbanCard.tsx`

**Interfaces:**
- Consumes: `todo.recurrence` (đã có sẵn qua prop `todo: Todo`).
- Produces: không có gì tầng dưới phụ thuộc.

- [ ] **Step 1: Thêm badge cạnh `due_date`**

Trong khối `<div className="flex items-center gap-2 pt-0.5">`, sau phần
hiển thị `due_date` (đóng ngoặc `))}`), thêm:

```tsx
        {todo.recurrence !== 'none' && (
          <span className="text-[11px]" title="Việc lặp lại" aria-label="Việc lặp lại">
            🔁
          </span>
        )}
```

- [ ] **Step 2: Xác nhận build pass**

Run: `npm run build`
Expected: biên dịch thành công.

- [ ] **Step 3: Commit**

```bash
git add src/components/KanbanCard.tsx
git commit -m "feat: KanbanCard hiện badge việc lặp"
```

---

### Task 8: `AppPage.tsx` — nối `completeRecurring` vào tick hoàn thành

**Files:**
- Modify: `src/pages/AppPage.tsx`

**Interfaces:**
- Consumes: `completeRecurring: (todo: Todo) => Promise<void>` từ
  `useTodos.ts` (Task 4).
- Produces: hành vi cuối cùng của tính năng — không có task nào phụ thuộc
  sau task này.

- [ ] **Step 1: Lấy thêm `completeRecurring` từ `useTodos` và sửa `toggleDone`**

Sửa dòng destructure hook:

```ts
  const { todos, loading, error, addTodo, updateTodo, deleteTodo, reorderTodos, completeRecurring, clearError } =
    useTodos(userId);
```

Sửa `toggleDone`:

```ts
  // Việc lặp: tick xong không chỉ set is_done — phải sinh kỳ sau trước
  // (xem completeRecurring trong useTodos.ts). Việc thường giữ nguyên hành vi cũ.
  const toggleDone = (id: string, isDone: boolean) => {
    if (isDone) {
      const todo = todos.find((t) => t.id === id);
      if (todo && todo.recurrence !== 'none') {
        completeRecurring(todo);
        return;
      }
    }
    updateTodo(id, { is_done: isDone });
  };
```

- [ ] **Step 2: Xác nhận build pass**

Run: `npm run build`
Expected: biên dịch thành công.

- [ ] **Step 3: Commit**

```bash
git add src/pages/AppPage.tsx
git commit -m "feat: nối tick hoàn thành với sinh kỳ lặp tiếp theo"
```

- [ ] **Step 4: Chạy toàn bộ test suite lần cuối**

Run: `npm test`
Expected: toàn bộ test pass (bao gồm `recurrence.test.ts`,
`todoFilters.test.ts`, `theme.test.ts`).

---

## Xác minh cuối cùng (thủ công, sau khi áp dụng SQL ở Task 1 lên Supabase thật)

1. Chạy `npm run dev`, đăng nhập.
2. Thêm việc "Đóng thẻ VPBank", đặt hạn hôm nay, chọn lặp "Hàng tháng" → Thêm.
3. Xác nhận badge 🔁 hiện cạnh hạn chót.
4. Tick hoàn thành việc đó.
5. Xác nhận: (a) việc biến mất khỏi view "Tất cả"/"Hôm nay"; (b) xuất hiện
   việc mới cùng tiêu đề với hạn = hôm nay cộng 1 tháng, cũng có badge 🔁;
   (c) chuyển sang view "Đã xong" thấy lại việc kỳ vừa tick, không còn badge lặp.
6. Thử sửa (✎) một việc chưa có hạn — xác nhận select "Lặp lại" bị khóa
   (disabled) cho tới khi chọn hạn.
7. Kiểm tra chế độ Bảng (Kanban) — badge 🔁 hiện đúng trên thẻ.
