# Làm mới giao diện (UI Restyle) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Làm mới giao diện Todo app theo hướng "sạch & tinh tế" (Linear/Notion-style): bóng đổ mềm, bo góc lớn hơn, màu tím chủ đạo đậm/rõ hơn, chuyển động mượt — thuần thay đổi trình bày (className/CSS/token), không đổi logic hay cấu trúc component.

**Architecture:** Cập nhật token Tailwind (`tailwind.config.js`) + thêm 3 class dùng chung trong `src/index.css` (`.surface-card`, `.btn-icon`, `.pill`), sau đó áp dụng cho từng component theo nhóm khu vực (topbar/filter, sidebar, form, todo list, kanban, badge/banner, login).

**Tech Stack:** React + TypeScript + Tailwind CSS (không thêm dependency mới).

**Spec:** `docs/superpowers/specs/2026-07-05-ui-restyle-design.md`

## Global Constraints

- Chỉ đổi className/CSS/token — không đổi props, logic xử lý sự kiện, cấu trúc component, `hooks/`, `lib/todoFilters.ts`, `types/todo.ts`, hay kết nối Supabase.
- Không thêm thư viện animation hay bất kỳ dependency mới nào (không framer-motion).
- Giữ nguyên toàn bộ text tiếng Việt hiện có.
- Mọi thay đổi phải có class `dark:` tương ứng — giữ dark mode parity.
- Màu primary mới: `#4F46E5` (light) / `#8B87F5` (dark) — thay cho `#5B57E0`/`#837FF2`.
- Shadow token mới (ghi đè `shadow-md`/`shadow-lg` mặc định của Tailwind, thêm `shadow-soft` và 3 biến thể `-dark`): xem Task 1.
- Sau **mỗi task**: `npm run build` phải pass và `npm test` phải pass (bộ test hiện có — `src/lib/theme.test.ts`, `src/lib/todoFilters.test.ts` — không cần sửa, phải tiếp tục xanh vì đây là thay đổi thuần trình bày).
- Task cuối cùng (Task 9) thực hiện xác minh trực quan qua trình duyệt trước khi coi là hoàn tất.

---

### Task 1: Design tokens & class dùng chung

**Files:**
- Modify: `tailwind.config.js`
- Modify: `src/index.css`

**Interfaces:**
- Produces: class `.surface-card`, `.btn-icon`, `.pill` (dùng bởi mọi task sau); token màu `primary`/`primary-dark` mới; token `shadow-soft`, `shadow-md`, `shadow-lg` (+ 3 biến thể `-dark`); `transitionDuration.DEFAULT = '150ms'`.

- [ ] **Step 1: Cập nhật `tailwind.config.js`**

Thay toàn bộ nội dung file bằng:

```js
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Design tokens từ Claude Design (docs/design). Dùng chung cho light + dark.
      colors: {
        bg: { DEFAULT: '#F5F5F6', dark: '#0D0D10' },
        surface: { DEFAULT: '#FFFFFF', 2: '#FAFAFA', dark: '#17171C', '2dark': '#1D1D23' },
        border: { DEFAULT: '#EAEAEC', dark: '#2A2A31' },
        text: { DEFAULT: '#1B1B1F', muted: '#71717A', dark: '#F3F3F5', 'muted-dark': '#9A9AA4' },
        primary: { DEFAULT: '#4F46E5', soft: '#EEEDFF', dark: '#8B87F5', 'soft-dark': '#211F3A' },
        priority: { high: '#E5484D', medium: '#EAB308', low: '#12A150' },
      },
      borderRadius: { sm: '8px', md: '10px', lg: '12px', xl: '16px' },
      boxShadow: {
        soft: '0 1px 2px rgba(0,0,0,.04), 0 1px 3px rgba(0,0,0,.06)',
        md: '0 4px 12px rgba(0,0,0,.08)',
        lg: '0 12px 32px rgba(0,0,0,.12)',
        'soft-dark': '0 1px 2px rgba(0,0,0,.3), 0 1px 3px rgba(0,0,0,.35)',
        'md-dark': '0 4px 12px rgba(0,0,0,.4)',
        'lg-dark': '0 12px 32px rgba(0,0,0,.5)',
      },
      transitionDuration: { DEFAULT: '150ms' },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 2: Thêm class dùng chung vào `src/index.css`**

Thay toàn bộ nội dung file bằng:

```css
/* Nạp font thiết kế (Plus Jakarta Sans + JetBrains Mono). */
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-bg text-text font-sans dark:bg-bg-dark dark:text-text-dark;
  }
}

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

- [ ] **Step 3: Kiểm tra build**

Run: `npm run build`
Expected: build thành công, không lỗi TypeScript/Tailwind (chỉ đổi config + CSS thuần, không ảnh hưởng type).

- [ ] **Step 4: Kiểm tra test hiện có vẫn xanh**

Run: `npm test`
Expected: PASS toàn bộ (test không liên quan tới UI/token).

- [ ] **Step 5: Commit**

```bash
git add tailwind.config.js src/index.css
git commit -m "style: cập nhật design token (màu, bóng đổ) và class dùng chung"
```

---

### Task 2: Topbar, ô tìm kiếm, bộ lọc

**Files:**
- Modify: `src/pages/AppPage.tsx:141`
- Modify: `src/components/SearchBar.tsx`
- Modify: `src/components/FilterBar.tsx`

**Interfaces:**
- Consumes: `.surface-card`, `shadow-soft`/`shadow-soft-dark`, `primary`/`primary-dark` từ Task 1.

- [ ] **Step 1: Bỏ viền cứng của topbar, thay bằng bóng đổ mềm**

Trong `src/pages/AppPage.tsx`, sửa dòng mở div topbar (dòng 141):

```tsx
// Cũ:
<div className="flex flex-none flex-wrap items-center gap-3 border-b border-border bg-surface px-5 py-3 dark:border-border-dark dark:bg-surface-dark">

// Mới:
<div className="flex flex-none flex-wrap items-center gap-3 bg-surface px-5 py-3 shadow-soft dark:bg-surface-dark dark:shadow-soft-dark">
```

- [ ] **Step 2: Làm mềm ô tìm kiếm**

Thay toàn bộ nội dung `src/components/SearchBar.tsx`:

```tsx
/** Ô tìm kiếm việc theo tiêu đề — có icon kính lúp, bám mockup top bar. */
export function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2.5 transition-colors duration-150 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30 dark:border-border-dark dark:bg-surface-2dark dark:focus-within:border-primary-dark dark:focus-within:ring-primary-dark/30">
      <span className="text-sm text-text-muted dark:text-text-muted-dark">⌕</span>
      <input
        type="search"
        placeholder="Tìm kiếm việc..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent text-sm text-text outline-none placeholder:text-text-muted dark:text-text-dark dark:placeholder:text-text-muted-dark"
      />
    </div>
  );
}
```

- [ ] **Step 3: Bộ lọc dạng pill, có trạng thái active rõ ràng**

Thay toàn bộ nội dung `src/components/FilterBar.tsx`:

```tsx
import type { Priority } from '../types/todo';

interface Props {
  priority: Priority | 'all';
  onPriority: (p: Priority | 'all') => void;
  tag: string | null;
  onTag: (t: string | null) => void;
  tags: string[];
}

/**
 * Bộ lọc trên top bar: theo Ưu tiên và Nhãn (bám mockup nút "Ưu tiên ▾ / Nhãn ▾").
 * Smart view (Hôm nay/Sắp tới/…) nằm ở Sidebar, không ở đây.
 */
const baseSelect =
  'cursor-pointer rounded-full border px-3 py-1.5 text-[12.5px] font-medium outline-none transition-colors duration-150';
const idleSelect =
  'border-border bg-surface-2 text-text-muted dark:border-border-dark dark:bg-surface-2dark dark:text-text-muted-dark';
const activeSelect =
  'border-primary bg-primary-soft text-primary dark:border-primary-dark dark:bg-primary-soft-dark dark:text-primary-dark';

export function FilterBar({ priority, onPriority, tag, onTag, tags }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={priority}
        onChange={(e) => onPriority(e.target.value as Priority | 'all')}
        className={`${baseSelect} ${priority === 'all' ? idleSelect : activeSelect}`}
        aria-label="Lọc theo ưu tiên"
      >
        <option value="all">Mọi ưu tiên</option>
        <option value="high">Cao</option>
        <option value="medium">Trung bình</option>
        <option value="low">Thấp</option>
      </select>

      <select
        value={tag ?? ''}
        onChange={(e) => onTag(e.target.value || null)}
        className={`${baseSelect} ${tag ? activeSelect : idleSelect}`}
        aria-label="Lọc theo nhãn"
      >
        <option value="">Mọi nhãn</option>
        {tags.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    </div>
  );
}
```

- [ ] **Step 4: Kiểm tra build**

Run: `npm run build`
Expected: build thành công.

- [ ] **Step 5: Kiểm tra test**

Run: `npm test`
Expected: PASS toàn bộ.

- [ ] **Step 6: Commit**

```bash
git add src/pages/AppPage.tsx src/components/SearchBar.tsx src/components/FilterBar.tsx
git commit -m "style: làm mới topbar, ô tìm kiếm và bộ lọc"
```

---

### Task 3: Sidebar & Theme toggle

**Files:**
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/ThemeToggle.tsx`

**Interfaces:**
- Consumes: `.btn-icon`, `shadow-soft`/`shadow-soft-dark` từ Task 1.

- [ ] **Step 1: Dải viền trái cho smart-view đang active + nút đăng xuất dùng `.btn-icon`**

Trong `src/components/Sidebar.tsx`, sửa khối render nút smart-view (dòng ~40-60):

```tsx
// Cũ:
<button
  key={v.key}
  onClick={() => onView(v.key)}
  aria-current={active ? 'page' : undefined}
  className={`flex items-center rounded-[9px] px-2.5 py-2 text-sm ${
    active
      ? 'bg-primary-soft font-semibold text-primary dark:bg-primary-soft-dark dark:text-primary-dark'
      : 'font-medium text-text hover:bg-surface-2 dark:text-text-dark dark:hover:bg-surface-2dark'
  }`}
>

// Mới:
<button
  key={v.key}
  onClick={() => onView(v.key)}
  aria-current={active ? 'page' : undefined}
  className={`flex items-center rounded-[9px] border-l-2 px-2.5 py-2 text-sm transition-colors duration-150 ${
    active
      ? 'border-primary bg-primary-soft font-semibold text-primary dark:border-primary-dark dark:bg-primary-soft-dark dark:text-primary-dark'
      : 'border-transparent font-medium text-text hover:bg-surface-2 dark:text-text-dark dark:hover:bg-surface-2dark'
  }`}
>
```

Sửa nút đăng xuất (dòng ~103-110):

```tsx
// Cũ:
<button
  onClick={onSignOut}
  title="Đăng xuất"
  aria-label="Đăng xuất"
  className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-lg text-[15px] text-text-muted hover:bg-surface-2 hover:text-text dark:text-text-muted-dark dark:hover:bg-surface-2dark dark:hover:text-text-dark"
>
  ⏻
</button>

// Mới:
<button
  onClick={onSignOut}
  title="Đăng xuất"
  aria-label="Đăng xuất"
  className="btn-icon h-[30px] w-[30px] flex-none text-[15px]"
>
  ⏻
</button>
```

- [ ] **Step 2: Tinh chỉnh bóng đổ ô đang chọn trong Theme toggle**

Thay toàn bộ nội dung `src/components/ThemeToggle.tsx`:

```tsx
import type { Theme } from '../lib/theme';

/**
 * Công tắc giao diện dạng segmented (☀ sáng / ☾ tối) — bám mockup dashboard.
 * Ô đang chọn nổi lên bằng nền surface + bóng đổ mềm.
 */
export function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const cell = 'flex h-[26px] w-7 items-center justify-center rounded-md text-[13px] transition-colors duration-150';
  const active = 'bg-surface text-text shadow-soft dark:bg-surface-2dark dark:text-text-dark dark:shadow-soft-dark';
  const idle = 'text-text-muted dark:text-text-muted-dark';
  return (
    <button
      onClick={onToggle}
      aria-label="Đổi giao diện sáng/tối"
      className="flex gap-0.5 rounded-lg border border-border bg-surface-2 p-0.5 dark:border-border-dark dark:bg-surface-2dark"
    >
      <span className={`${cell} ${theme === 'light' ? active : idle}`}>☀</span>
      <span className={`${cell} ${theme === 'dark' ? active : idle}`}>☾</span>
    </button>
  );
}
```

- [ ] **Step 3: Kiểm tra build**

Run: `npm run build`
Expected: build thành công.

- [ ] **Step 4: Kiểm tra test**

Run: `npm test`
Expected: PASS toàn bộ.

- [ ] **Step 5: Commit**

```bash
git add src/components/Sidebar.tsx src/components/ThemeToggle.tsx
git commit -m "style: làm mới sidebar (dải nhấn active) và theme toggle"
```

---

### Task 4: Form thêm việc

**Files:**
- Modify: `src/components/TodoForm.tsx`

**Interfaces:**
- Consumes: token `primary`, `shadow-soft`/`shadow-md` (+ `-dark`) từ Task 1.

- [ ] **Step 1: Input cao hơn, ring focus rõ hơn; nút Thêm có bóng đổ + phản hồi khi bấm**

Thay toàn bộ nội dung `src/components/TodoForm.tsx`:

```tsx
import { useState } from 'react';
import type { NewTodo, Priority } from '../types/todo';

const inputClass =
  'rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none transition-colors duration-150 placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-border-dark dark:bg-surface-2dark dark:text-text-dark dark:placeholder:text-text-muted-dark dark:focus:border-primary-dark dark:focus:ring-primary-dark/30';

/** Form thêm việc: tiêu đề + ưu tiên + hạn + nhãn. Nhấn Enter/nút để thêm. */
export function TodoForm({ onAdd }: { onAdd: (t: NewTodo) => void }) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [tagsText, setTagsText] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    const tags = tagsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    onAdd({ title: t, priority, due_date: dueDate || null, tags });
    setTitle('');
    setDueDate('');
    setTagsText('');
    setPriority('medium');
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
        onChange={(e) => setDueDate(e.target.value)}
        className={inputClass}
        aria-label="Hạn"
      />
      <input
        value={tagsText}
        onChange={(e) => setTagsText(e.target.value)}
        placeholder="nhãn, cách nhau dấu phẩy"
        className={inputClass}
      />
      <button className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition duration-150 hover:shadow-md active:scale-95 dark:bg-primary-dark dark:shadow-soft-dark dark:hover:shadow-md-dark">
        Thêm
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Kiểm tra build**

Run: `npm run build`
Expected: build thành công.

- [ ] **Step 3: Kiểm tra test**

Run: `npm test`
Expected: PASS toàn bộ.

- [ ] **Step 4: Commit**

```bash
git add src/components/TodoForm.tsx
git commit -m "style: làm mới form thêm việc"
```

---

### Task 5: TodoItem (danh sách việc)

**Files:**
- Modify: `src/components/TodoItem.tsx`

**Interfaces:**
- Consumes: `.surface-card`, `.btn-icon`, `.pill` từ Task 1.

- [ ] **Step 1: Dùng `.surface-card` + dải viền trái theo ưu tiên thay cho border phẳng**

Thay toàn bộ nội dung `src/components/TodoItem.tsx`:

```tsx
import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Todo, TodoUpdate, Priority } from '../types/todo';
import { PriorityBadge } from './PriorityBadge';
import { isOverdue } from '../lib/todoFilters';
import { tagColor } from '../lib/tagColor';

interface Props {
  todo: Todo;
  today: string;
  onToggle: (id: string, done: boolean) => void;
  onUpdate: (id: string, patch: TodoUpdate) => void;
  onDelete: (id: string) => void;
}

const editInput =
  'rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-border-dark dark:bg-surface-2dark dark:text-text-dark dark:focus:border-primary-dark dark:focus:ring-primary-dark/30';

/** Màu dải viền trái theo mức ưu tiên (khớp token `priority` trong tailwind.config.js). */
const PRIORITY_BORDER_COLOR: Record<Priority, string> = {
  high: '#E5484D',
  medium: '#EAB308',
  low: '#12A150',
};

export function TodoItem({ todo, today, onToggle, onUpdate, onDelete }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: todo.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    borderLeftColor: PRIORITY_BORDER_COLOR[todo.priority],
  };
  const overdue = isOverdue(todo, today);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(todo.title);
  const [priority, setPriority] = useState<Priority>(todo.priority);
  const [dueDate, setDueDate] = useState(todo.due_date ?? '');
  const [tagsText, setTagsText] = useState(todo.tags.join(', '));
  const [notes, setNotes] = useState(todo.notes ?? '');

  function save(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    onUpdate(todo.id, {
      title: t,
      priority,
      due_date: dueDate || null,
      notes: notes.trim() || null,
      tags: tagsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    });
    setEditing(false);
  }

  if (editing) {
    return (
      <li className="surface-card p-4">
        <form onSubmit={save} className="flex flex-col gap-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={editInput} />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ghi chú"
            className={editInput}
          />
          <div className="flex flex-wrap gap-2">
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              className={editInput}
            >
              <option value="high">Cao</option>
              <option value="medium">Trung bình</option>
              <option value="low">Thấp</option>
            </select>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={editInput} />
            <input
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="nhãn, cách nhau dấu phẩy"
              className={`flex-1 ${editInput}`}
            />
          </div>
          <div className="flex gap-2">
            <button className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white transition active:scale-95 dark:bg-primary-dark">
              Lưu
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg border border-border px-3 py-1.5 text-sm transition-colors duration-150 hover:bg-surface-2 dark:border-border-dark dark:hover:bg-surface-2dark"
            >
              Hủy
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li ref={setNodeRef} style={style} className="surface-card flex items-center gap-3 border-l-[3px] px-3.5 py-3">
      {/* Tay cầm kéo — 6 chấm */}
      <button
        {...attributes}
        {...listeners}
        type="button"
        aria-label="Kéo để sắp xếp"
        className="grid flex-none cursor-grab grid-cols-2 gap-[3px]"
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className="h-[3px] w-[3px] rounded-full bg-text-muted opacity-40 dark:bg-text-muted-dark" />
        ))}
      </button>

      {/* Checkbox tùy biến 20px */}
      <button
        type="button"
        role="checkbox"
        aria-checked={todo.is_done}
        aria-label={todo.is_done ? 'Bỏ đánh dấu hoàn thành' : 'Đánh dấu hoàn thành'}
        onClick={() => onToggle(todo.id, !todo.is_done)}
        className={`flex h-5 w-5 flex-none items-center justify-center rounded-md text-[13px] leading-none transition-colors duration-150 ${
          todo.is_done
            ? 'bg-primary text-white dark:bg-primary-dark'
            : 'border-2 border-border dark:border-border-dark'
        }`}
      >
        {todo.is_done ? '✓' : ''}
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
        <span
          className={`text-[14.5px] font-medium ${
            todo.is_done
              ? 'text-text-muted line-through opacity-75 dark:text-text-muted-dark'
              : 'text-text dark:text-text-dark'
          }`}
        >
          {todo.title}
        </span>

        <div className="flex flex-wrap items-center gap-2">
          {todo.due_date &&
            (overdue ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-priority-high">
                <span className="h-[5px] w-[5px] rounded-full bg-priority-high" />
                {todo.due_date} (quá hạn)
              </span>
            ) : (
              <span className="text-xs font-medium text-text-muted dark:text-text-muted-dark">{todo.due_date}</span>
            ))}

          {todo.tags.map((t) => (
            <span
              key={t}
              className="pill border border-border bg-surface-2 text-text-muted dark:border-border-dark dark:bg-surface-2dark dark:text-text-muted-dark"
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: tagColor(t) }} />
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-none items-center gap-2">
        <PriorityBadge priority={todo.priority} />
        <button onClick={() => setEditing(true)} aria-label="Sửa" className="btn-icon h-7 w-7 text-sm">
          ✎
        </button>
        <button
          onClick={() => onDelete(todo.id)}
          aria-label="Xóa"
          className="flex h-7 w-7 flex-none items-center justify-center rounded-lg text-[13px] text-text-muted transition-colors duration-150 hover:bg-red-50 hover:text-red-600 active:scale-95 dark:text-text-muted-dark dark:hover:bg-red-950/50 dark:hover:text-red-300"
        >
          ✕
        </button>
      </div>
    </li>
  );
}
```

- [ ] **Step 2: Kiểm tra build**

Run: `npm run build`
Expected: build thành công (`PRIORITY_BORDER_COLOR` dùng type `Priority` đã import sẵn, không lỗi type).

- [ ] **Step 3: Kiểm tra test**

Run: `npm test`
Expected: PASS toàn bộ.

- [ ] **Step 4: Commit**

```bash
git add src/components/TodoItem.tsx
git commit -m "style: làm mới TodoItem (surface-card, dải viền ưu tiên, btn-icon)"
```

---

### Task 6: Kanban board & thẻ Kanban

**Files:**
- Modify: `src/components/KanbanBoard.tsx:47-52`
- Modify: `src/components/KanbanCard.tsx`

**Interfaces:**
- Consumes: `.surface-card`, `.pill`, `shadow-lg`/`shadow-lg-dark` từ Task 1.

- [ ] **Step 1: Cột Kanban có bóng đổ mềm**

Trong `src/components/KanbanBoard.tsx`, sửa className của cột (dòng 47-52):

```tsx
// Cũ:
className={`flex max-h-full w-[280px] flex-none flex-col gap-2.5 rounded-xl border p-3 transition-colors ${
  isOver
    ? 'border-primary bg-primary-soft dark:border-primary-dark dark:bg-primary-soft-dark'
    : 'border-border bg-surface-2 dark:border-border-dark dark:bg-surface-2dark'
}`}

// Mới:
className={`flex max-h-full w-[280px] flex-none flex-col gap-2.5 rounded-xl border p-3.5 transition-colors duration-150 ${
  isOver
    ? 'border-primary bg-primary-soft dark:border-primary-dark dark:bg-primary-soft-dark'
    : 'border-border bg-surface-2 shadow-soft dark:border-border-dark dark:bg-surface-2dark dark:shadow-soft-dark'
}`}
```

- [ ] **Step 2: Thẻ Kanban dùng `.surface-card`, "nhấc lên" khi kéo**

Thay toàn bộ nội dung `src/components/KanbanCard.tsx`:

```tsx
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Todo } from '../types/todo';
import { isOverdue } from '../lib/todoFilters';
import { tagColor } from '../lib/tagColor';

interface Props {
  todo: Todo;
  today: string;
  onToggle: (id: string, done: boolean) => void;
}

/** Thẻ việc trên bảng Kanban (bám KanbanCard.dc.html). Kéo-thả được để đổi cột ưu tiên. */
export function KanbanCard({ todo, today, onToggle }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: todo.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const overdue = isOverdue(todo, today);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`surface-card flex cursor-grab flex-col gap-2.5 p-3.5 transition-transform duration-150 ${
        isDragging ? 'scale-105 shadow-lg dark:shadow-lg-dark' : ''
      }`}
    >
      <span
        className={`text-[13.5px] font-semibold leading-snug ${
          todo.is_done
            ? 'text-text-muted line-through opacity-75 dark:text-text-muted-dark'
            : 'text-text dark:text-text-dark'
        }`}
      >
        {todo.title}
      </span>

      {todo.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {todo.tags.map((t) => (
            <span
              key={t}
              className="pill border border-border bg-surface-2 text-text-muted dark:border-border-dark dark:bg-surface-2dark dark:text-text-muted-dark"
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: tagColor(t) }} />
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 pt-0.5">
        <button
          type="button"
          role="checkbox"
          aria-checked={todo.is_done}
          aria-label={todo.is_done ? 'Bỏ đánh dấu hoàn thành' : 'Đánh dấu hoàn thành'}
          onClick={() => onToggle(todo.id, !todo.is_done)}
          onPointerDown={(e) => e.stopPropagation()}
          className={`flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full text-[11px] leading-none transition-colors duration-150 ${
            todo.is_done
              ? 'bg-primary text-white dark:bg-primary-dark'
              : 'border-2 border-border dark:border-border-dark'
          }`}
        >
          {todo.is_done ? '✓' : ''}
        </button>
        {todo.due_date &&
          (overdue ? (
            <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-priority-high">
              <span className="h-[5px] w-[5px] rounded-full bg-priority-high" />
              {todo.due_date} (quá hạn)
            </span>
          ) : (
            <span className="text-[11.5px] font-medium text-text-muted dark:text-text-muted-dark">
              {todo.due_date}
            </span>
          ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Kiểm tra build**

Run: `npm run build`
Expected: build thành công.

- [ ] **Step 4: Kiểm tra test**

Run: `npm test`
Expected: PASS toàn bộ.

- [ ] **Step 5: Commit**

```bash
git add src/components/KanbanBoard.tsx src/components/KanbanCard.tsx
git commit -m "style: làm mới bảng Kanban và thẻ Kanban"
```

---

### Task 7: PriorityBadge & ErrorBanner

**Files:**
- Modify: `src/components/PriorityBadge.tsx`
- Modify: `src/components/ErrorBanner.tsx`

**Interfaces:**
- Consumes: `.pill`, `shadow-soft`/`shadow-soft-dark` từ Task 1.

- [ ] **Step 1: PriorityBadge dùng `.pill`, tăng tương phản dark mode**

Thay toàn bộ nội dung `src/components/PriorityBadge.tsx`:

```tsx
import type { Priority } from '../types/todo';

const LABEL: Record<Priority, string> = { high: 'Cao', medium: 'Trung bình', low: 'Thấp' };

/** Màu chấm + nền pill mềm cho từng mức ưu tiên (bám design tokens). */
const STYLE: Record<Priority, { pill: string; dot: string }> = {
  high: {
    pill: 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-200',
    dot: '#E5484D',
  },
  medium: {
    pill: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200',
    dot: '#EAB308',
  },
  low: {
    pill: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200',
    dot: '#12A150',
  },
};

/** Badge ưu tiên dạng pill: chấm màu + nhãn tiếng Việt. */
export function PriorityBadge({ priority }: { priority: Priority }) {
  const { pill, dot } = STYLE[priority];
  return (
    <span className={`pill ${pill}`}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />
      {LABEL[priority]}
    </span>
  );
}
```

- [ ] **Step 2: ErrorBanner dùng dải viền trái đỏ + icon cảnh báo thay vì nền đỏ toàn khối**

Thay toàn bộ nội dung `src/components/ErrorBanner.tsx`:

```tsx
interface Props {
  message: string;
  onClose?: () => void;
}

/** Banner báo lỗi rõ ràng cho người dùng (không nuốt lỗi im lặng). */
export function ErrorBanner({ message, onClose }: Props) {
  return (
    <div
      role="alert"
      style={{ borderLeftColor: '#E5484D' }}
      className="flex items-start justify-between gap-3 rounded-lg border border-l-[3px] border-border bg-surface px-4 py-3 text-sm text-red-800 shadow-soft dark:border-border-dark dark:bg-surface-dark dark:text-red-200 dark:shadow-soft-dark"
    >
      <span className="flex items-start gap-2">
        <span aria-hidden="true">⚠</span>
        {message}
      </span>
      {onClose && (
        <button onClick={onClose} className="font-bold" aria-label="Đóng">
          ×
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Kiểm tra build**

Run: `npm run build`
Expected: build thành công.

- [ ] **Step 4: Kiểm tra test**

Run: `npm test`
Expected: PASS toàn bộ.

- [ ] **Step 5: Commit**

```bash
git add src/components/PriorityBadge.tsx src/components/ErrorBanner.tsx
git commit -m "style: làm mới PriorityBadge và ErrorBanner"
```

---

### Task 8: Trang đăng nhập

**Files:**
- Modify: `src/pages/LoginPage.tsx`

**Interfaces:**
- Consumes: `.surface-card`, `shadow-lg`/`shadow-lg-dark` từ Task 1.

- [ ] **Step 1: Card đăng nhập nổi bật hơn, input/nút đồng bộ token mới**

Thay toàn bộ nội dung `src/pages/LoginPage.tsx`:

```tsx
import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { ErrorBanner } from '../components/ErrorBanner';

/**
 * Màn hình đăng nhập: Google OAuth + magic link qua email.
 * Style theo design system (docs/design): card căn giữa trên nền app, tông primary tím.
 * Logic auth giữ nguyên theo plan — không nuốt lỗi im lặng (console.error + ErrorBanner).
 */
export function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signInWithGoogle() {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      console.error('Lỗi đăng nhập Google:', error);
      setError('Không đăng nhập được bằng Google: ' + error.message);
    }
  }

  async function signInWithEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) {
      console.error('Lỗi gửi magic link:', error);
      setError('Không gửi được link đăng nhập: ' + error.message);
    } else {
      setSent(true);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6 font-sans text-text dark:bg-bg-dark dark:text-text-dark">
      <div className="surface-card w-full max-w-sm p-8 shadow-lg dark:shadow-lg-dark">
        {/* Logo + tiêu đề */}
        <div className="mb-6 flex flex-col items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-lg font-bold text-white">
            ✓
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold">Việc của tôi</h1>
            <p className="mt-1 text-sm text-text-muted dark:text-text-muted-dark">
              Đăng nhập để đồng bộ việc trên mọi thiết bị
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4">
            <ErrorBanner message={error} onClose={() => setError(null)} />
          </div>
        )}

        <button
          onClick={signInWithGoogle}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 font-medium transition-colors duration-150 hover:bg-surface-2 active:scale-95 dark:border-border-dark dark:hover:bg-surface-2dark"
        >
          Đăng nhập với Google
        </button>

        <div className="my-5 flex items-center gap-3 text-xs text-text-muted dark:text-text-muted-dark">
          <span className="h-px flex-1 bg-border dark:bg-border-dark" />
          hoặc dùng email
          <span className="h-px flex-1 bg-border dark:bg-border-dark" />
        </div>

        {sent ? (
          <p className="rounded-lg bg-primary-soft px-4 py-3 text-center text-sm text-primary dark:bg-primary-soft-dark dark:text-primary-dark">
            Đã gửi link đăng nhập tới <strong>{email}</strong>. Kiểm tra hộp thư nhé.
          </p>
        ) : (
          <form onSubmit={signInWithEmail} className="flex flex-col gap-3">
            <input
              type="email"
              required
              placeholder="email@cua-ban.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-border-dark dark:bg-surface-2dark dark:focus:border-primary-dark dark:focus:ring-primary-dark/30"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-primary px-4 py-2.5 font-medium text-white shadow-soft transition duration-150 hover:shadow-md active:scale-95 disabled:opacity-50 dark:bg-primary-dark dark:shadow-soft-dark dark:hover:shadow-md-dark"
            >
              {busy ? 'Đang gửi…' : 'Gửi link đăng nhập'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Kiểm tra build**

Run: `npm run build`
Expected: build thành công.

- [ ] **Step 3: Kiểm tra test**

Run: `npm test`
Expected: PASS toàn bộ.

- [ ] **Step 4: Commit**

```bash
git add src/pages/LoginPage.tsx
git commit -m "style: làm mới trang đăng nhập"
```

---

### Task 9: Xác minh toàn app

**Files:** không tạo/sửa file (chỉ chạy kiểm tra).

- [ ] **Step 1: Chạy toàn bộ test suite**

Run: `npm test`
Expected: PASS toàn bộ (bao gồm `theme.test.ts`, `todoFilters.test.ts`).

- [ ] **Step 2: Build production**

Run: `npm run build`
Expected: build thành công, không lỗi TypeScript.

- [ ] **Step 3: Chạy dev server và kiểm tra bằng mắt**

Run: `npm run dev` (chạy nền/tab riêng)

Mở app trong trình duyệt, kiểm tra từng mục sau (light mode rồi dark mode qua ThemeToggle):
- Trang đăng nhập: card nổi bật với bóng đổ lớn, input/nút có ring/bóng khi tương tác.
- Topbar: không còn viền cứng phía dưới, có bóng đổ mềm; ô tìm kiếm bo tròn, có ring khi focus.
- Bộ lọc: chọn một ưu tiên/nhãn cụ thể → nút lọc chuyển sang trạng thái active (nền tím nhạt, viền tím).
- Sidebar: smart-view đang chọn có dải viền trái màu tím.
- Danh sách việc (view "Danh sách"): mỗi dòng có bóng đổ nhẹ, dải màu ưu tiên bên trái, hover nâng bóng.
- Bảng Kanban (view "Bảng"): cột có bóng mềm; kéo một thẻ sang cột khác — thẻ phóng to nhẹ (scale) + bóng đậm khi đang kéo, và đổi cột thành công (không có hồi quy hành vi).
- Thử thêm việc mới, sửa việc, đánh dấu hoàn thành, xóa việc (có xác nhận), đổi tag/priority filter — toàn bộ hành vi phải giống hệt trước khi restyle.
- Kiểm tra responsive: thu nhỏ cửa sổ xuống kích thước điện thoại, đảm bảo sidebar ẩn, thanh smart-view mobile hiển thị đúng.

Nếu phát hiện hồi quy hành vi (không phải hình ảnh) — dừng lại, xác định task nào gây ra, và sửa trước khi tiếp tục.

- [ ] **Step 4: Dừng dev server**

Đóng tiến trình `npm run dev` sau khi xác minh xong.

- [ ] **Step 5: Không cần commit** (task này chỉ xác minh, không đổi file). Nếu Step 3 phát hiện lỗi cần sửa, quay lại task tương ứng, sửa, rồi lặp lại Task 9 từ Step 1.
