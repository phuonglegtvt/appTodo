# Double-click ô lịch + hiện ghi chú tab Ngày — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép double-click cả ô lịch để đi xuống 1 tầng, và hiện ghi chú việc sẵn ở tab Ngày.

**Architecture:** Thêm `onDoubleClick` + guard target vào 2 component ô (`TodoCell`, `DayCell`), tái dùng callback điều hướng đã có (`onSelect`/`onOpenFull`) nên không đụng grid/PlanPage cho phần này. Thêm prop khởi tạo `defaultShowNotes` chạy qua `TodoList → TodoItem`, chỉ tab Ngày bật.

**Tech Stack:** React + TypeScript, Tailwind, Vitest + @testing-library/react.

## Global Constraints
- TypeScript ở mọi nơi; tránh `any` (guard target dùng `as HTMLElement`).
- Chỉ thay đổi additive; không phá hành vi click đơn / bàn phím hiện có.
- Không nuốt lỗi im lặng.
- Trước khi báo xong: `npm test` và `npm run build` phải pass.
- Spec: `docs/superpowers/specs/2026-07-12-plan-cell-nav-and-day-notes-design.md`

---

### Task 1: TodoCell — double-click nền ô đi xuống 1 tầng

**Files:**
- Modify: `src/components/TodoCell.tsx`
- Test: `src/components/TodoCell.test.tsx`

**Interfaces:**
- Consumes: prop `onSelect: () => void` (đã có sẵn) — đi xuống 1 tầng.
- Produces: hành vi `onDoubleClick` trên container; không đổi chữ ký prop.

- [ ] **Step 1: Viết test thất bại** — thêm vào cuối `describe('TodoCell', ...)` trong `src/components/TodoCell.test.tsx`:

```tsx
it('double-click nền ô gọi onSelect (đi xuống 1 tầng)', () => {
  const onSelect = vi.fn();
  const { container } = render(
    <TodoCell data={monthCellData()} onSelect={onSelect} onToggleTodo={vi.fn()} onDeleteTodo={vi.fn()} onEditTodo={vi.fn()} />,
  );

  fireEvent.dblClick(container.firstChild as Element);

  expect(onSelect).toHaveBeenCalledTimes(1);
});

it('double-click lên một việc KHÔNG gọi onSelect', () => {
  const onSelect = vi.fn();
  render(
    <TodoCell data={monthCellData()} onSelect={onSelect} onToggleTodo={vi.fn()} onDeleteTodo={vi.fn()} onEditTodo={vi.fn()} />,
  );

  fireEvent.dblClick(screen.getByRole('button', { name: 'Sửa Việc trong tháng' }));

  expect(onSelect).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `npm test -- --run src/components/TodoCell.test.tsx`
Expected: FAIL — `onSelect` được gọi 0 lần (chưa có onDoubleClick).

- [ ] **Step 3: Cài đặt tối thiểu** — trong `src/components/TodoCell.tsx`, thêm handler ngay trong thân component (sau dòng `const { visible, overflow } = ...`):

```tsx
  function handleDoubleClick(e: React.MouseEvent) {
    // Bỏ qua khi double-click rơi vào phần tử tương tác (việc, checkbox, ✕, ô thêm).
    if ((e.target as HTMLElement).closest('button, input, form')) return;
    onSelect();
  }
```

Rồi gắn vào `div` container ngoài cùng — sửa dòng mở thẻ:

```tsx
    <div
      onDoubleClick={handleDoubleClick}
      title="Bấm đúp để mở"
      className="flex min-h-[9rem] flex-col gap-1.5 rounded-lg border border-border bg-surface p-2 dark:border-border-dark dark:bg-surface-dark"
    >
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npm test -- --run src/components/TodoCell.test.tsx`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/TodoCell.tsx src/components/TodoCell.test.tsx
git commit -m "feat(plan): double-click ô Năm/5Năm đi xuống 1 tầng"
```

---

### Task 2: DayCell — double-click nền ô mở tab Ngày

**Files:**
- Modify: `src/components/DayCell.tsx`
- Test: `src/components/DayCell.test.tsx` (tạo mới — chưa có)

**Interfaces:**
- Consumes: prop `onOpenFull: () => void` (đã có sẵn) — mở tab Ngày của ngày đó.
- Produces: hành vi `onDoubleClick` trên container; không đổi chữ ký prop.

- [ ] **Step 1: Viết test thất bại** — tạo file `src/components/DayCell.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DayCell } from './DayCell';
import type { Todo } from '../types/todo';

function todo(partial: Partial<Todo> = {}): Todo {
  return {
    id: 'todo-1',
    user_id: 'u',
    title: 'Việc hôm nay',
    notes: null,
    is_done: false,
    due_date: '2026-07-12',
    priority: 'medium',
    tags: [],
    recurrence: 'none',
    sort_order: 0,
    created_at: '',
    updated_at: '',
    ...partial,
  };
}

function renderCell(props: Partial<React.ComponentProps<typeof DayCell>> = {}) {
  return render(
    <DayCell
      dayNumber={12}
      todos={[todo()]}
      isToday={false}
      maxLines={3}
      onAdd={vi.fn()}
      onToggle={vi.fn()}
      onDelete={vi.fn()}
      onEdit={vi.fn()}
      onOpenFull={vi.fn()}
      {...props}
    />,
  );
}

describe('DayCell — double-click mở ngày', () => {
  it('double-click nền ô gọi onOpenFull', () => {
    const onOpenFull = vi.fn();
    const { container } = renderCell({ onOpenFull });

    fireEvent.dblClick(container.firstChild as Element);

    expect(onOpenFull).toHaveBeenCalledTimes(1);
  });

  it('double-click lên một việc KHÔNG gọi onOpenFull', () => {
    const onOpenFull = vi.fn();
    renderCell({ onOpenFull });

    fireEvent.dblClick(screen.getByRole('button', { name: 'Sửa Việc hôm nay' }));

    expect(onOpenFull).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `npm test -- --run src/components/DayCell.test.tsx`
Expected: FAIL — `onOpenFull` được gọi 0 lần.

- [ ] **Step 3: Cài đặt tối thiểu** — trong `src/components/DayCell.tsx`, thêm handler trong thân component (sau dòng `const { visible, overflow } = ...`):

```tsx
  function handleDoubleClick(e: React.MouseEvent) {
    // Bỏ qua khi double-click rơi vào phần tử tương tác (số ngày, việc, checkbox, ✕, ô thêm).
    if ((e.target as HTMLElement).closest('button, input, form')) return;
    onOpenFull();
  }
```

Gắn vào `div` container ngoài cùng — thêm `onDoubleClick` và `title` vào thẻ mở (giữ nguyên chuỗi className hiện có):

```tsx
    <div
      onDoubleClick={handleDoubleClick}
      title="Bấm đúp để mở"
      className={`flex min-h-[8rem] flex-col gap-1.5 rounded-lg border bg-surface p-2 dark:bg-surface-dark ${
        isToday ? 'border-primary dark:border-primary-dark' : 'border-border dark:border-border-dark'
      }`}
    >
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npm test -- --run src/components/DayCell.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/DayCell.tsx src/components/DayCell.test.tsx
git commit -m "feat(plan): double-click ô Tháng/Tuần mở tab Ngày"
```

---

### Task 3: defaultShowNotes — hiện ghi chú sẵn ở tab Ngày

**Files:**
- Modify: `src/components/TodoItem.tsx`
- Modify: `src/components/TodoList.tsx`
- Modify: `src/components/PlanPage.tsx:158`
- Test: `src/components/TodoItem.test.tsx`

**Interfaces:**
- Produces: prop tùy chọn `defaultShowNotes?: boolean` trên cả `TodoItem` và `TodoList`
  (mặc định `false` → giữ hành vi cũ). Chỉ đổi giá trị khởi tạo state `showNotes`.
- Consumes: `PlanPage` truyền `defaultShowNotes` vào `TodoList` ở nhánh tab Ngày.

- [ ] **Step 1: Viết test thất bại** — thêm khối `describe` mới vào cuối `src/components/TodoItem.test.tsx`:

```tsx
describe('TodoItem — hiện ghi chú sẵn', () => {
  it('defaultShowNotes → ghi chú hiện ngay không cần click', () => {
    render(
      <DndContext>
        <SortableContext items={['1']}>
          <ul>
            <TodoItem
              todo={{ ...todo, notes: 'Nội dung ghi chú' }}
              today="2026-07-12"
              onToggle={vi.fn()}
              onUpdate={vi.fn()}
              onDelete={vi.fn()}
              defaultShowNotes
            />
          </ul>
        </SortableContext>
      </DndContext>,
    );
    expect(screen.getByText('Nội dung ghi chú')).toBeInTheDocument();
  });

  it('không truyền defaultShowNotes → ghi chú vẫn ẩn', () => {
    render(
      <DndContext>
        <SortableContext items={['1']}>
          <ul>
            <TodoItem
              todo={{ ...todo, notes: 'Nội dung ghi chú' }}
              today="2026-07-12"
              onToggle={vi.fn()}
              onUpdate={vi.fn()}
              onDelete={vi.fn()}
            />
          </ul>
        </SortableContext>
      </DndContext>,
    );
    expect(screen.queryByText('Nội dung ghi chú')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `npm test -- --run src/components/TodoItem.test.tsx`
Expected: FAIL — test đầu không tìm thấy "Nội dung ghi chú" (prop chưa tồn tại; TS cũng báo prop lạ).

- [ ] **Step 3a: Cài đặt `TodoItem`** — trong `src/components/TodoItem.tsx`:

Thêm field vào `interface Props` (sau `onDelete`):

```tsx
  defaultShowNotes?: boolean; // tab Ngày bật để hiện ghi chú sẵn
```

Sửa dòng khai báo tham số component để nhận prop mới:

```tsx
export function TodoItem({ todo, today, onToggle, onUpdate, onDelete, defaultShowNotes }: Props) {
```

Sửa khởi tạo state `showNotes` (dòng `const [showNotes, setShowNotes] = useState(false);`):

```tsx
  const [showNotes, setShowNotes] = useState(defaultShowNotes ?? false);
```

- [ ] **Step 3b: Cài đặt `TodoList`** — trong `src/components/TodoList.tsx`:

Thêm field vào `interface Props` (sau `onReorder`):

```tsx
  defaultShowNotes?: boolean;
```

Sửa dòng khai báo tham số component để nhận prop:

```tsx
export function TodoList({ todos, today, onToggle, onUpdate, onDelete, onReorder, defaultShowNotes }: Props) {
```

Truyền xuống `TodoItem` — thêm dòng prop vào JSX `<TodoItem ... />`:

```tsx
              defaultShowNotes={defaultShowNotes}
```

- [ ] **Step 3c: Bật ở tab Ngày** — trong `src/components/PlanPage.tsx`, tại `<TodoList>` (nhánh `horizon === 'day'`), thêm prop:

```tsx
        <TodoList
          todos={dayTodos}
          today={today}
          onToggle={onToggleTodo}
          onUpdate={onUpdateTodo}
          onDelete={onDeleteTodo}
          onReorder={onReorderTodos}
          defaultShowNotes
        />
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npm test -- --run src/components/TodoItem.test.tsx`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/TodoItem.tsx src/components/TodoList.tsx src/components/PlanPage.tsx src/components/TodoItem.test.tsx
git commit -m "feat(plan): tab Ngày hiện ghi chú việc sẵn (defaultShowNotes)"
```

---

### Task 4: Xác minh toàn bộ

**Files:** (không sửa — chỉ chạy kiểm chứng)

- [ ] **Step 1: Chạy full test**

Run: `npm test -- --run`
Expected: PASS toàn bộ (134 cũ + 6 mới = 140 tests).

- [ ] **Step 2: Build production**

Run: `npm run build`
Expected: `tsc -b` không lỗi type + `vite build` thành công.

---

## Self-Review

- **Spec coverage:** YC1 (double-click) → Task 1 (TodoCell) + Task 2 (DayCell); guard tránh đụng việc → test "KHÔNG gọi" ở cả hai. YC2 (ghi chú tab Ngày) → Task 3; scoped qua prop, AppPage không đổi (không sửa file đó). Kiểm thử spec → khớp test từng task + Task 4.
- **Placeholder scan:** không có TBD/TODO; mọi step có code/command cụ thể.
- **Type consistency:** `defaultShowNotes?: boolean` đồng nhất ở TodoItem/TodoList; `onSelect`/`onOpenFull` là prop có sẵn, không đổi chữ ký.
