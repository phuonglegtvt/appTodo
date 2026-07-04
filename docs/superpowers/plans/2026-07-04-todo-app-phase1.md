# Todo App Phase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng web app Todo cá nhân (React + Vite + TS + Tailwind, Supabase) với đầy đủ chức năng Phase 1, đồng bộ nhiều thiết bị.

**Architecture:** Frontend React truy cập thẳng Supabase (Auth + Postgres + Realtime), bảo vệ bằng RLS, không có server tự viết. Logic thuần (lọc/sắp xếp/smart-view) tách khỏi UI để unit test bằng Vitest; UI/mạng xác minh bằng `npm run build` + chạy thật.

**Tech Stack:** React 18, Vite 5, TypeScript (strict), Tailwind CSS 3, @supabase/supabase-js v2, Vitest + @testing-library/react, @dnd-kit (kéo-thả).

## Global Constraints

- TypeScript strict, **không dùng `any`**.
- Chỉ dùng Supabase **anon key** ở frontend (biến `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). Không bao giờ đưa `service_role` key vào frontend/commit.
- **Không nuốt lỗi im lặng:** mọi lỗi mạng/đăng nhập/lưu phải báo cho người dùng và `console.error`.
- Dark mode qua Tailwind `darkMode: 'class'`; style bằng class Tailwind.
- Giao diện tiếng Việt; giữ thuật ngữ kỹ thuật tiếng Anh.
- Cấu trúc type-based (flat) theo spec mục 6; KHÔNG thêm features/, Redux, React Router ở Phase 1.
- Trước khi báo "xong" mỗi task: chạy lệnh test/build tương ứng và xác nhận pass.
- `priority`: `'high' | 'medium' | 'low'`. `SmartView`: `'today' | 'upcoming' | 'all' | 'done'`.
- Kiểu ngày `due_date` là chuỗi `YYYY-MM-DD` (hoặc `null`).

## File Structure

- `package.json`, `index.html`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json` — scaffold + config
- `tailwind.config.js`, `postcss.config.js`, `src/index.css` — styling + dark mode
- `eslint.config.js` — lint
- `src/main.tsx`, `src/App.tsx` — bootstrap + auth-gate
- `src/types/todo.ts` — kiểu dữ liệu
- `src/lib/supabaseClient.ts` — điểm truy cập Supabase duy nhất
- `src/lib/todoFilters.ts` (+ `.test.ts`) — LOGIC THUẦN, test được
- `src/lib/theme.ts` (+ `.test.ts`) — logic chọn theme thuần
- `src/hooks/useTheme.ts`, `useAuth.ts`, `useTodos.ts` — logic React có state
- `src/pages/LoginPage.tsx`, `src/pages/AppPage.tsx` — màn hình
- `src/components/*` — TodoList, TodoItem, TodoForm, FilterBar, SearchBar, PriorityBadge, ThemeToggle, ErrorBanner
- `src/test/setup.ts` — cấu hình Vitest
- `supabase/schema.sql` — bảng + RLS + realtime

---

## Task 1: Scaffold dự án Vite + React + TypeScript

**Files:**
- Create: `package.json`, `index.html`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `src/main.tsx`, `src/App.tsx`, `src/vite-env.d.ts`

**Interfaces:**
- Produces: app React chạy được bằng `npm run dev`; `App` component export default.

- [ ] **Step 1: Tạo `package.json`**

```json
{
  "name": "apptodo",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint ."
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.45.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "@dnd-kit/core": "^6.1.0",
    "@dnd-kit/sortable": "^8.0.0",
    "@dnd-kit/utilities": "^3.2.2"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.8",
    "@testing-library/react": "^16.0.0",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.19",
    "eslint": "^9.9.0",
    "@typescript-eslint/eslint-plugin": "^8.0.0",
    "@typescript-eslint/parser": "^8.0.0",
    "eslint-plugin-react-hooks": "^4.6.2",
    "jsdom": "^24.1.1",
    "postcss": "^8.4.41",
    "tailwindcss": "^3.4.10",
    "typescript": "^5.5.4",
    "vite": "^5.4.0",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 2: Tạo `index.html`** (ở gốc dự án)

```html
<!doctype html>
<html lang="vi" class="">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Todo — Quản lý công việc</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Tạo `vite.config.ts`** (kèm cấu hình Vitest luôn)

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
});
```

- [ ] **Step 4: Tạo `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 5: Tạo `tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 6: Tạo `src/vite-env.d.ts`**

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

- [ ] **Step 7: Tạo `src/App.tsx`** (tạm thời — sẽ thay ở Task 8)

```tsx
export default function App() {
  return <h1>Todo app — đang dựng</h1>;
}
```

- [ ] **Step 8: Tạo `src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Không tìm thấy phần tử #root trong index.html');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 9: Cài phụ thuộc và chạy thử**

Run: `npm install`
Run: `npm run dev`
Expected: Vite in ra URL `http://localhost:5173`; mở trình duyệt thấy "Todo app — đang dựng". (Lưu ý: `index.css` chưa có sẽ tạo ở Task 2; nếu dev báo thiếu file, làm Task 2 trước khi mở.)

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + React + TypeScript"
```

---

## Task 2: Tailwind CSS + logic chọn theme (dark mode)

**Files:**
- Create: `tailwind.config.js`, `postcss.config.js`, `src/index.css`, `src/lib/theme.ts`, `src/lib/theme.test.ts`, `src/test/setup.ts`

**Interfaces:**
- Produces: `resolveInitialTheme(stored: string | null, prefersDark: boolean): 'light' | 'dark'`, `applyTheme(theme: 'light' | 'dark'): void` từ `src/lib/theme.ts`.

- [ ] **Step 1: Tạo `src/test/setup.ts`**

```ts
import '@testing-library/jest-dom';
```

- [ ] **Step 2: Tạo `tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
};
```

- [ ] **Step 3: Tạo `postcss.config.js`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 4: Tạo `src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 5: Viết test thất bại cho `theme.ts`** — Create `src/lib/theme.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { resolveInitialTheme } from './theme';

describe('resolveInitialTheme', () => {
  it('ưu tiên giá trị đã lưu là "dark"', () => {
    expect(resolveInitialTheme('dark', false)).toBe('dark');
  });
  it('ưu tiên giá trị đã lưu là "light"', () => {
    expect(resolveInitialTheme('light', true)).toBe('light');
  });
  it('chưa lưu thì theo hệ điều hành (prefersDark = true → dark)', () => {
    expect(resolveInitialTheme(null, true)).toBe('dark');
  });
  it('chưa lưu và không thích dark → light', () => {
    expect(resolveInitialTheme(null, false)).toBe('light');
  });
  it('giá trị lưu rác thì coi như chưa lưu', () => {
    expect(resolveInitialTheme('bogus', true)).toBe('dark');
  });
});
```

- [ ] **Step 6: Chạy test để xác nhận FAIL**

Run: `npm test -- theme`
Expected: FAIL — không import được `resolveInitialTheme`.

- [ ] **Step 7: Viết `src/lib/theme.ts`**

```ts
export type Theme = 'light' | 'dark';

/** Quyết định theme khởi đầu: ưu tiên lựa chọn đã lưu, nếu không thì theo hệ điều hành. */
export function resolveInitialTheme(stored: string | null, prefersDark: boolean): Theme {
  if (stored === 'dark' || stored === 'light') return stored;
  return prefersDark ? 'dark' : 'light';
}

/** Áp theme vào <html> bằng class 'dark' (khớp Tailwind darkMode: 'class'). */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
}
```

- [ ] **Step 8: Chạy test để xác nhận PASS**

Run: `npm test -- theme`
Expected: PASS (5 test).

- [ ] **Step 9: Xác minh Tailwind hoạt động** — sửa tạm `src/App.tsx` thành:

```tsx
export default function App() {
  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 p-6">
      <h1 className="text-2xl font-bold">Todo app — đang dựng</h1>
    </div>
  );
}
```

Run: `npm run dev` → thấy nền trắng, chữ đậm (Tailwind đã ăn).

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: cấu hình Tailwind + logic chọn theme (dark mode)"
```

---

## Task 3: Kiểu dữ liệu + Supabase client + schema SQL

**Files:**
- Create: `src/types/todo.ts`, `src/lib/supabaseClient.ts`, `supabase/schema.sql`

**Interfaces:**
- Produces: `Todo`, `Priority`, `SmartView`, `NewTodo`, `TodoUpdate` từ `src/types/todo.ts`; `supabase` (SupabaseClient) từ `src/lib/supabaseClient.ts`.

- [ ] **Step 1: Tạo `src/types/todo.ts`**

```ts
export type Priority = 'high' | 'medium' | 'low';
export type SmartView = 'today' | 'upcoming' | 'all' | 'done';

export interface Todo {
  id: string;
  user_id: string;
  title: string;
  notes: string | null;
  is_done: boolean;
  due_date: string | null; // 'YYYY-MM-DD'
  priority: Priority;
  tags: string[];
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
}

/** Các trường được phép sửa. */
export type TodoUpdate = Partial<
  Pick<Todo, 'title' | 'notes' | 'is_done' | 'due_date' | 'priority' | 'tags' | 'sort_order'>
>;
```

- [ ] **Step 2: Tạo `src/lib/supabaseClient.ts`**

```ts
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// KHÔNG nuốt lỗi: thiếu cấu hình thì báo ngay, đừng để app chạy nửa vời.
if (!url || !anonKey) {
  throw new Error(
    'Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY. Sao chép .env.example thành .env và điền giá trị.',
  );
}

export const supabase = createClient(url, anonKey);
```

- [ ] **Step 3: Tạo `supabase/schema.sql`**

```sql
-- Bảng todos + Row Level Security cho app Todo cá nhân.
-- Chạy trong Supabase Dashboard > SQL Editor.

create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  notes text,
  is_done boolean not null default false,
  due_date date,
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  tags text[] not null default '{}',
  sort_order numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tự cập nhật updated_at khi sửa.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_todos_updated_at on public.todos;
create trigger trg_todos_updated_at
  before update on public.todos
  for each row execute function public.set_updated_at();

-- Bật Row Level Security: mỗi người chỉ thao tác việc của mình.
alter table public.todos enable row level security;

drop policy if exists "todos_select_own" on public.todos;
create policy "todos_select_own" on public.todos
  for select using (auth.uid() = user_id);

drop policy if exists "todos_insert_own" on public.todos;
create policy "todos_insert_own" on public.todos
  for insert with check (auth.uid() = user_id);

drop policy if exists "todos_update_own" on public.todos;
create policy "todos_update_own" on public.todos
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "todos_delete_own" on public.todos;
create policy "todos_delete_own" on public.todos
  for delete using (auth.uid() = user_id);

-- Bật Realtime cho bảng todos.
alter publication supabase_realtime add table public.todos;
```

- [ ] **Step 4: Kiểm tra biên dịch kiểu**

Run: `npx tsc -b`
Expected: không lỗi (bỏ qua nếu cần `.env` — file này không import lúc build type).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: kiểu Todo, Supabase client và schema SQL (RLS + realtime)"
```

---

## Task 4: Logic thuần lọc/sắp xếp/smart-view (TDD đầy đủ)

**Files:**
- Create: `src/lib/todoFilters.ts`, `src/lib/todoFilters.test.ts`

**Interfaces:**
- Consumes: `Todo`, `Priority`, `SmartView` từ `src/types/todo.ts`.
- Produces: `searchTodos`, `filterByPriority`, `filterByTag`, `sortByOrder`, `isOverdue`, `applySmartView`, `allTags`.

- [ ] **Step 1: Viết test thất bại** — Create `src/lib/todoFilters.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import type { Todo } from '../types/todo';
import {
  searchTodos,
  filterByPriority,
  filterByTag,
  sortByOrder,
  isOverdue,
  applySmartView,
  allTags,
} from './todoFilters';

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
    sort_order: over.sort_order ?? 0,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
  };
}

describe('searchTodos', () => {
  const todos = [makeTodo({ title: 'Mua sữa' }), makeTodo({ title: 'Học React' })];
  it('không có từ khóa thì trả nguyên danh sách', () => {
    expect(searchTodos(todos, '  ')).toHaveLength(2);
  });
  it('tìm không phân biệt hoa thường', () => {
    expect(searchTodos(todos, 'react')).toHaveLength(1);
    expect(searchTodos(todos, 'react')[0].title).toBe('Học React');
  });
});

describe('filterByPriority', () => {
  const todos = [makeTodo({ priority: 'high' }), makeTodo({ priority: 'low' })];
  it('"all" trả tất cả', () => {
    expect(filterByPriority(todos, 'all')).toHaveLength(2);
  });
  it('lọc đúng mức ưu tiên', () => {
    expect(filterByPriority(todos, 'high')).toHaveLength(1);
  });
});

describe('filterByTag', () => {
  const todos = [makeTodo({ tags: ['nhà'] }), makeTodo({ tags: ['việc'] })];
  it('null trả tất cả', () => {
    expect(filterByTag(todos, null)).toHaveLength(2);
  });
  it('lọc theo tag', () => {
    expect(filterByTag(todos, 'nhà')).toHaveLength(1);
  });
});

describe('sortByOrder', () => {
  it('sắp xếp tăng dần theo sort_order, không đổi mảng gốc', () => {
    const todos = [makeTodo({ sort_order: 2 }), makeTodo({ sort_order: 1 })];
    const sorted = sortByOrder(todos);
    expect(sorted.map((t) => t.sort_order)).toEqual([1, 2]);
    expect(todos[0].sort_order).toBe(2); // gốc không đổi
  });
});

describe('isOverdue', () => {
  it('quá hạn khi chưa xong và due_date < hôm nay', () => {
    expect(isOverdue(makeTodo({ due_date: '2026-07-01' }), '2026-07-04')).toBe(true);
  });
  it('không quá hạn nếu đã xong', () => {
    expect(isOverdue(makeTodo({ due_date: '2026-07-01', is_done: true }), '2026-07-04')).toBe(false);
  });
  it('không có due_date thì không quá hạn', () => {
    expect(isOverdue(makeTodo({ due_date: null }), '2026-07-04')).toBe(false);
  });
});

describe('applySmartView', () => {
  const today = '2026-07-04';
  const overdue = makeTodo({ id: 'a', due_date: '2026-07-01' });
  const dueToday = makeTodo({ id: 'b', due_date: '2026-07-04' });
  const future = makeTodo({ id: 'c', due_date: '2026-07-10' });
  const noDate = makeTodo({ id: 'd', due_date: null });
  const done = makeTodo({ id: 'e', due_date: '2026-07-02', is_done: true });
  const todos = [overdue, dueToday, future, noDate, done];

  it('"today" gồm việc đến hạn hôm nay và quá hạn, chưa xong', () => {
    const ids = applySmartView(todos, 'today', today).map((t) => t.id).sort();
    expect(ids).toEqual(['a', 'b']);
  });
  it('"upcoming" gồm việc có hạn trong tương lai, chưa xong', () => {
    expect(applySmartView(todos, 'upcoming', today).map((t) => t.id)).toEqual(['c']);
  });
  it('"done" chỉ việc đã xong', () => {
    expect(applySmartView(todos, 'done', today).map((t) => t.id)).toEqual(['e']);
  });
  it('"all" trả tất cả', () => {
    expect(applySmartView(todos, 'all', today)).toHaveLength(5);
  });
});

describe('allTags', () => {
  it('gộp tag duy nhất, đã sắp xếp', () => {
    const todos = [makeTodo({ tags: ['b', 'a'] }), makeTodo({ tags: ['a', 'c'] })];
    expect(allTags(todos)).toEqual(['a', 'b', 'c']);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Run: `npm test -- todoFilters`
Expected: FAIL — chưa có `src/lib/todoFilters.ts`.

- [ ] **Step 3: Viết `src/lib/todoFilters.ts`**

```ts
import type { Todo, Priority, SmartView } from '../types/todo';

/** Tìm theo từ khóa trong tiêu đề (không phân biệt hoa thường). */
export function searchTodos(todos: Todo[], query: string): Todo[] {
  const q = query.trim().toLowerCase();
  if (!q) return todos;
  return todos.filter((t) => t.title.toLowerCase().includes(q));
}

/** Lọc theo mức ưu tiên; 'all' trả tất cả. */
export function filterByPriority(todos: Todo[], priority: Priority | 'all'): Todo[] {
  if (priority === 'all') return todos;
  return todos.filter((t) => t.priority === priority);
}

/** Lọc theo tag; null trả tất cả. */
export function filterByTag(todos: Todo[], tag: string | null): Todo[] {
  if (!tag) return todos;
  return todos.filter((t) => t.tags.includes(tag));
}

/** Sắp xếp tăng dần theo sort_order (không đổi mảng gốc). */
export function sortByOrder(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => a.sort_order - b.sort_order);
}

/** Việc quá hạn: chưa xong và due_date trước hôm nay (today dạng 'YYYY-MM-DD'). */
export function isOverdue(todo: Todo, today: string): boolean {
  if (todo.is_done || !todo.due_date) return false;
  return todo.due_date < today;
}

/** Áp smart view. today là chuỗi 'YYYY-MM-DD' để dễ test. */
export function applySmartView(todos: Todo[], view: SmartView, today: string): Todo[] {
  switch (view) {
    case 'all':
      return todos;
    case 'done':
      return todos.filter((t) => t.is_done);
    case 'today':
      return todos.filter((t) => !t.is_done && t.due_date !== null && t.due_date <= today);
    case 'upcoming':
      return todos.filter((t) => !t.is_done && t.due_date !== null && t.due_date > today);
  }
}

/** Danh sách tag duy nhất trong toàn bộ việc, đã sắp xếp. */
export function allTags(todos: Todo[]): string[] {
  const set = new Set<string>();
  for (const t of todos) for (const tag of t.tags) set.add(tag);
  return [...set].sort();
}
```

- [ ] **Step 4: Chạy test để xác nhận PASS**

Run: `npm test -- todoFilters`
Expected: PASS (toàn bộ test trong file).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: logic thuần lọc/sắp xếp/smart-view + test"
```

---

## Task 5: Hook `useTheme` (áp dark mode + nhớ lựa chọn)

**Files:**
- Create: `src/hooks/useTheme.ts`

**Interfaces:**
- Consumes: `resolveInitialTheme`, `applyTheme`, `Theme` từ `src/lib/theme.ts`.
- Produces: `useTheme(): { theme: Theme; toggleTheme: () => void }`.

- [ ] **Step 1: Viết `src/hooks/useTheme.ts`**

```ts
import { useEffect, useState } from 'react';
import { resolveInitialTheme, applyTheme, type Theme } from '../lib/theme';

const STORAGE_KEY = 'apptodo-theme';

export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const [theme, setTheme] = useState<Theme>(() =>
    resolveInitialTheme(
      localStorage.getItem(STORAGE_KEY),
      window.matchMedia('(prefers-color-scheme: dark)').matches,
    ),
  );

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  return { theme, toggleTheme };
}
```

- [ ] **Step 2: Xác minh biên dịch**

Run: `npx tsc -b`
Expected: không lỗi. (Logic thuần đã được test ở Task 2; hook này chỉ nối state → DOM, xác minh bằng chạy thật ở Task 8.)

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: hook useTheme (dark mode, nhớ lựa chọn)"
```

---

## Task 6: Xác thực — hook `useAuth` + `LoginPage`

**Files:**
- Create: `src/hooks/useAuth.ts`, `src/pages/LoginPage.tsx`, `src/components/ErrorBanner.tsx`

**Interfaces:**
- Consumes: `supabase` từ `src/lib/supabaseClient.ts`.
- Produces: `useAuth(): { session: Session | null; loading: boolean }`; `LoginPage` component; `ErrorBanner({ message, onClose })`.

- [ ] **Step 1: Tạo `src/components/ErrorBanner.tsx`**

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
      className="flex items-start justify-between gap-3 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
    >
      <span>{message}</span>
      {onClose && (
        <button onClick={onClose} className="font-bold" aria-label="Đóng">
          ×
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Tạo `src/hooks/useAuth.ts`**

```ts
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

export function useAuth(): { session: Session | null; loading: boolean } {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .catch((err) => console.error('Lỗi lấy phiên đăng nhập:', err))
      .finally(() => setLoading(false));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, loading };
}
```

- [ ] **Step 3: Tạo `src/pages/LoginPage.tsx`**

```tsx
import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { ErrorBanner } from '../components/ErrorBanner';

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
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-center text-2xl font-bold">Đăng nhập Todo</h1>
      {error && <ErrorBanner message={error} onClose={() => setError(null)} />}

      <button
        onClick={signInWithGoogle}
        className="rounded-md border border-slate-300 px-4 py-2 font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
      >
        Đăng nhập với Google
      </button>

      <div className="text-center text-sm text-slate-500">hoặc</div>

      {sent ? (
        <p className="text-center text-sm text-green-700 dark:text-green-400">
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
            className="rounded-md border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
          >
            {busy ? 'Đang gửi…' : 'Gửi link đăng nhập'}
          </button>
        </form>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Xác minh biên dịch**

Run: `npx tsc -b`
Expected: không lỗi.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: xác thực Google + magic link (useAuth, LoginPage)"
```

---

## Task 7: Hook `useTodos` (CRUD + realtime)

**Files:**
- Create: `src/hooks/useTodos.ts`

**Interfaces:**
- Consumes: `supabase`; `Todo`, `NewTodo`, `TodoUpdate`.
- Produces: `useTodos(userId: string)` trả `{ todos, loading, error, addTodo, updateTodo, deleteTodo, reorderTodos, clearError }`.

- [ ] **Step 1: Tạo `src/hooks/useTodos.ts`**

```ts
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Todo, NewTodo, TodoUpdate } from '../types/todo';

interface UseTodos {
  todos: Todo[];
  loading: boolean;
  error: string | null;
  addTodo: (input: NewTodo) => Promise<void>;
  updateTodo: (id: string, patch: TodoUpdate) => Promise<void>;
  deleteTodo: (id: string) => Promise<void>;
  reorderTodos: (ordered: Todo[]) => Promise<void>;
  clearError: () => void;
}

export function useTodos(userId: string): UseTodos {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tải lần đầu.
  useEffect(() => {
    let active = true;
    setLoading(true);
    supabase
      .from('todos')
      .select('*')
      .order('sort_order', { ascending: true })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error('Lỗi tải việc:', error);
          setError('Không tải được danh sách việc: ' + error.message);
        } else {
          setTodos((data ?? []) as Todo[]);
        }
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  // Đồng bộ realtime: nghe thay đổi trên bảng todos của user này.
  useEffect(() => {
    const channel = supabase
      .channel('todos-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'todos', filter: `user_id=eq.${userId}` },
        (payload) => {
          setTodos((prev) => {
            if (payload.eventType === 'INSERT') {
              const row = payload.new as Todo;
              if (prev.some((t) => t.id === row.id)) return prev;
              return [...prev, row];
            }
            if (payload.eventType === 'UPDATE') {
              const row = payload.new as Todo;
              return prev.map((t) => (t.id === row.id ? row : t));
            }
            if (payload.eventType === 'DELETE') {
              const old = payload.old as { id: string };
              return prev.filter((t) => t.id !== old.id);
            }
            return prev;
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const addTodo = useCallback(
    async (input: NewTodo) => {
      const maxOrder = todos.reduce((m, t) => Math.max(m, t.sort_order), 0);
      const { error } = await supabase.from('todos').insert({
        user_id: userId,
        title: input.title,
        notes: input.notes ?? null,
        due_date: input.due_date ?? null,
        priority: input.priority ?? 'medium',
        tags: input.tags ?? [],
        sort_order: maxOrder + 1,
      });
      if (error) {
        console.error('Lỗi thêm việc:', error);
        setError('Không thêm được việc: ' + error.message);
      }
    },
    [todos, userId],
  );

  const updateTodo = useCallback(async (id: string, patch: TodoUpdate) => {
    const { error } = await supabase.from('todos').update(patch).eq('id', id);
    if (error) {
      console.error('Lỗi cập nhật việc:', error);
      setError('Không cập nhật được việc: ' + error.message);
    }
  }, []);

  const deleteTodo = useCallback(async (id: string) => {
    const { error } = await supabase.from('todos').delete().eq('id', id);
    if (error) {
      console.error('Lỗi xóa việc:', error);
      setError('Không xóa được việc: ' + error.message);
    }
  }, []);

  // Cập nhật lạc quan thứ tự, rồi lưu sort_order mới lên server.
  const reorderTodos = useCallback(async (ordered: Todo[]) => {
    setTodos(ordered);
    const updates = ordered.map((t, index) =>
      supabase.from('todos').update({ sort_order: index + 1 }).eq('id', t.id),
    );
    const results = await Promise.all(updates);
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      console.error('Lỗi lưu thứ tự:', failed.error);
      setError('Không lưu được thứ tự mới: ' + failed.error.message);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { todos, loading, error, addTodo, updateTodo, deleteTodo, reorderTodos, clearError };
}
```

- [ ] **Step 2: Xác minh biên dịch**

Run: `npx tsc -b`
Expected: không lỗi.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: hook useTodos (CRUD + đồng bộ realtime)"
```

---

## Task 8: Component UI (PriorityBadge, TodoForm, TodoItem, TodoList, SearchBar, FilterBar, ThemeToggle)

**Files:**
- Create: `src/components/PriorityBadge.tsx`, `TodoForm.tsx`, `TodoItem.tsx`, `TodoList.tsx`, `SearchBar.tsx`, `FilterBar.tsx`, `ThemeToggle.tsx`

**Interfaces:**
- Consumes: `Todo`, `Priority`, `NewTodo`, `TodoUpdate`, `SmartView`; `@dnd-kit/*`.
- Produces: các component nhận props thuần (data + callback), không tự gọi Supabase.

- [ ] **Step 1: `src/components/PriorityBadge.tsx`**

```tsx
import type { Priority } from '../types/todo';

const LABEL: Record<Priority, string> = { high: 'Cao', medium: 'Trung bình', low: 'Thấp' };
const STYLE: Record<Priority, string> = {
  high: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  low: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${STYLE[priority]}`}>
      {LABEL[priority]}
    </span>
  );
}
```

- [ ] **Step 2: `src/components/ThemeToggle.tsx`**

```tsx
import type { Theme } from '../lib/theme';

export function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="rounded-md border border-slate-300 px-3 py-1 text-sm dark:border-slate-600"
      aria-label="Đổi giao diện sáng/tối"
    >
      {theme === 'dark' ? '☀️ Sáng' : '🌙 Tối'}
    </button>
  );
}
```

- [ ] **Step 3: `src/components/SearchBar.tsx`**

```tsx
export function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="search"
      placeholder="Tìm việc…"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
    />
  );
}
```

- [ ] **Step 4: `src/components/FilterBar.tsx`**

```tsx
import type { Priority, SmartView } from '../types/todo';

interface Props {
  view: SmartView;
  onView: (v: SmartView) => void;
  priority: Priority | 'all';
  onPriority: (p: Priority | 'all') => void;
  tag: string | null;
  onTag: (t: string | null) => void;
  tags: string[];
}

const VIEWS: { key: SmartView; label: string }[] = [
  { key: 'today', label: 'Hôm nay' },
  { key: 'upcoming', label: 'Sắp tới' },
  { key: 'all', label: 'Tất cả' },
  { key: 'done', label: 'Đã xong' },
];

export function FilterBar({ view, onView, priority, onPriority, tag, onTag, tags }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-md border border-slate-300 dark:border-slate-600">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            onClick={() => onView(v.key)}
            className={`px-3 py-1 text-sm ${
              view === v.key ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : ''
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      <select
        value={priority}
        onChange={(e) => onPriority(e.target.value as Priority | 'all')}
        className="rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
      >
        <option value="all">Mọi mức ưu tiên</option>
        <option value="high">Cao</option>
        <option value="medium">Trung bình</option>
        <option value="low">Thấp</option>
      </select>

      <select
        value={tag ?? ''}
        onChange={(e) => onTag(e.target.value || null)}
        className="rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
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

- [ ] **Step 5: `src/components/TodoForm.tsx`**

```tsx
import { useState } from 'react';
import type { NewTodo, Priority } from '../types/todo';

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
    <form onSubmit={submit} className="flex flex-wrap gap-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Thêm việc mới…"
        className="min-w-[12rem] flex-1 rounded-md border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
      />
      <select
        value={priority}
        onChange={(e) => setPriority(e.target.value as Priority)}
        className="rounded-md border border-slate-300 px-2 dark:border-slate-600 dark:bg-slate-800"
      >
        <option value="high">Cao</option>
        <option value="medium">Trung bình</option>
        <option value="low">Thấp</option>
      </select>
      <input
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        className="rounded-md border border-slate-300 px-2 dark:border-slate-600 dark:bg-slate-800"
      />
      <input
        value={tagsText}
        onChange={(e) => setTagsText(e.target.value)}
        placeholder="nhãn, cách nhau dấu phẩy"
        className="rounded-md border border-slate-300 px-3 dark:border-slate-600 dark:bg-slate-800"
      />
      <button className="rounded-md bg-slate-900 px-4 py-2 font-medium text-white dark:bg-slate-100 dark:text-slate-900">
        Thêm
      </button>
    </form>
  );
}
```

- [ ] **Step 6: `src/components/TodoItem.tsx`** (một hàng, kéo-thả được)

```tsx
import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Todo, TodoUpdate, Priority } from '../types/todo';
import { PriorityBadge } from './PriorityBadge';
import { isOverdue } from '../lib/todoFilters';

interface Props {
  todo: Todo;
  today: string;
  onToggle: (id: string, done: boolean) => void;
  onUpdate: (id: string, patch: TodoUpdate) => void;
  onDelete: (id: string) => void;
}

export function TodoItem({ todo, today, onToggle, onUpdate, onDelete }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: todo.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
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
      tags: tagsText.split(',').map((s) => s.trim()).filter(Boolean),
    });
    setEditing(false);
  }

  if (editing) {
    return (
      <li className="rounded-md border border-slate-300 bg-white p-3 dark:border-slate-600 dark:bg-slate-800">
        <form onSubmit={save} className="flex flex-col gap-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-900" />
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ghi chú" className="rounded-md border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-900" />
          <div className="flex flex-wrap gap-2">
            <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className="rounded-md border border-slate-300 px-2 dark:border-slate-600 dark:bg-slate-900">
              <option value="high">Cao</option>
              <option value="medium">Trung bình</option>
              <option value="low">Thấp</option>
            </select>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="rounded-md border border-slate-300 px-2 dark:border-slate-600 dark:bg-slate-900" />
            <input value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="nhãn, cách nhau dấu phẩy" className="flex-1 rounded-md border border-slate-300 px-2 dark:border-slate-600 dark:bg-slate-900" />
          </div>
          <div className="flex gap-2">
            <button className="rounded-md bg-slate-900 px-3 py-1 text-sm text-white dark:bg-slate-100 dark:text-slate-900">Lưu</button>
            <button type="button" onClick={() => setEditing(false)} className="rounded-md border border-slate-300 px-3 py-1 text-sm dark:border-slate-600">Hủy</button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
    >
      <button {...attributes} {...listeners} className="cursor-grab text-slate-400" aria-label="Kéo để sắp xếp">
        ⠿
      </button>
      <input
        type="checkbox"
        checked={todo.is_done}
        onChange={(e) => onToggle(todo.id, e.target.checked)}
        className="h-4 w-4"
      />
      <div className="flex-1">
        <span className={todo.is_done ? 'line-through text-slate-400' : ''}>{todo.title}</span>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <PriorityBadge priority={todo.priority} />
          {todo.due_date && (
            <span className={overdue ? 'font-semibold text-red-600 dark:text-red-400' : ''}>
              📅 {todo.due_date}
              {overdue ? ' (quá hạn)' : ''}
            </span>
          )}
          {todo.tags.map((t) => (
            <span key={t} className="rounded bg-slate-100 px-1.5 dark:bg-slate-700">
              #{t}
            </span>
          ))}
        </div>
      </div>
      <button onClick={() => setEditing(true)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" aria-label="Sửa">
        ✏️
      </button>
      <button onClick={() => onDelete(todo.id)} className="text-slate-400 hover:text-red-600" aria-label="Xóa">
        🗑
      </button>
    </li>
  );
}
```

- [ ] **Step 7: `src/components/TodoList.tsx`** (bọc kéo-thả bằng dnd-kit)

```tsx
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Todo, TodoUpdate } from '../types/todo';
import { TodoItem } from './TodoItem';

interface Props {
  todos: Todo[];
  today: string;
  onToggle: (id: string, done: boolean) => void;
  onUpdate: (id: string, patch: TodoUpdate) => void;
  onDelete: (id: string) => void;
  onReorder: (ordered: Todo[]) => void;
}

export function TodoList({ todos, today, onToggle, onUpdate, onDelete, onReorder }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = todos.findIndex((t) => t.id === active.id);
    const newIndex = todos.findIndex((t) => t.id === over.id);
    onReorder(arrayMove(todos, oldIndex, newIndex));
  }

  if (todos.length === 0) {
    return <p className="py-8 text-center text-slate-400">Chưa có việc nào ở đây.</p>;
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={todos.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-2">
          {todos.map((t) => (
            <TodoItem key={t.id} todo={t} today={today} onToggle={onToggle} onUpdate={onUpdate} onDelete={onDelete} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
```

- [ ] **Step 8: Xác minh biên dịch**

Run: `npx tsc -b`
Expected: không lỗi.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: các component UI Todo (list, item, form, filter, search, badge, theme)"
```

---

## Task 9: Lắp ráp `AppPage` + `App` (auth-gate, smart views, lọc, tìm)

**Files:**
- Create: `src/pages/AppPage.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: mọi hook + component ở trên.
- Produces: `AppPage({ userId })`; `App` chuyển giữa `LoginPage`/`AppPage` theo phiên.

- [ ] **Step 1: Tạo `src/pages/AppPage.tsx`**

```tsx
import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useTodos } from '../hooks/useTodos';
import type { Priority, SmartView } from '../types/todo';
import {
  applySmartView,
  searchTodos,
  filterByPriority,
  filterByTag,
  sortByOrder,
  allTags,
} from '../lib/todoFilters';
import { TodoForm } from '../components/TodoForm';
import { TodoList } from '../components/TodoList';
import { SearchBar } from '../components/SearchBar';
import { FilterBar } from '../components/FilterBar';
import { ThemeToggle } from '../components/ThemeToggle';
import { ErrorBanner } from '../components/ErrorBanner';
import { useTheme } from '../hooks/useTheme';

export function AppPage({ userId }: { userId: string }) {
  const { todos, loading, error, addTodo, updateTodo, deleteTodo, reorderTodos, clearError } =
    useTodos(userId);
  const { theme, toggleTheme } = useTheme();

  const [view, setView] = useState<SmartView>('all');
  const [query, setQuery] = useState('');
  const [priority, setPriority] = useState<Priority | 'all'>('all');
  const [tag, setTag] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const visible = useMemo(() => {
    let list = applySmartView(todos, view, today);
    list = searchTodos(list, query);
    list = filterByPriority(list, priority);
    list = filterByTag(list, tag);
    return sortByOrder(list);
  }, [todos, view, query, priority, tag, today]);

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Việc cần làm</h1>
        <div className="flex items-center gap-2">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <button
            onClick={() => supabase.auth.signOut()}
            className="rounded-md border border-slate-300 px-3 py-1 text-sm dark:border-slate-600"
          >
            Đăng xuất
          </button>
        </div>
      </header>

      {error && <div className="mb-3"><ErrorBanner message={error} onClose={clearError} /></div>}

      <div className="mb-4 flex flex-col gap-3">
        <TodoForm onAdd={addTodo} />
        <SearchBar value={query} onChange={setQuery} />
        <FilterBar
          view={view}
          onView={setView}
          priority={priority}
          onPriority={setPriority}
          tag={tag}
          onTag={setTag}
          tags={allTags(todos)}
        />
      </div>

      {loading ? (
        <p className="py-8 text-center text-slate-400">Đang tải…</p>
      ) : (
        <TodoList
          todos={visible}
          today={today}
          onToggle={(id, done) => updateTodo(id, { is_done: done })}
          onUpdate={(id, patch) => updateTodo(id, patch)}
          onDelete={(id) => {
            if (confirm('Xóa việc này?')) deleteTodo(id);
          }}
          onReorder={reorderTodos}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Thay `src/App.tsx`**

```tsx
import { useAuth } from './hooks/useAuth';
import { LoginPage } from './pages/LoginPage';
import { AppPage } from './pages/AppPage';

export default function App() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400 dark:bg-slate-900">
        Đang tải…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      {session ? <AppPage userId={session.user.id} /> : <LoginPage />}
    </div>
  );
}
```

- [ ] **Step 3: Xác minh biên dịch + build**

Run: `npx tsc -b && npm run build`
Expected: build thành công, sinh thư mục `dist/`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: lắp ráp AppPage + auth-gate (smart views, lọc, tìm, kéo-thả)"
```

---

## Task 10: Chạy thật với Supabase + xác minh end-to-end

**Files:** không tạo file mới; cấu hình môi trường + kiểm thử thủ công.

- [ ] **Step 1: Tạo project Supabase** (miễn phí) tại supabase.com; vào SQL Editor chạy toàn bộ `supabase/schema.sql`.

- [ ] **Step 2: Bật Auth providers** — Dashboard > Authentication > Providers: bật **Email** (magic link) và **Google** (điền Client ID/Secret theo hướng dẫn Google Cloud). Thêm `http://localhost:5173` vào Redirect URLs.

- [ ] **Step 3: Điền `.env`**

```bash
cp .env.example .env
# Điền VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY (Dashboard > Project Settings > API)
```

- [ ] **Step 4: Chạy app**

Run: `npm run dev`
Kiểm tra thủ công theo checklist:
- [ ] Đăng nhập bằng magic link (email) — nhận link, bấm vào, vào được app.
- [ ] Đăng nhập bằng Google.
- [ ] Thêm việc (tiêu đề + ưu tiên + hạn + nhãn) → hiện ngay trong danh sách.
- [ ] Tick hoàn thành → gạch ngang; đổi filter "Đã xong" thấy nó.
- [ ] Smart views Hôm nay / Sắp tới / Tất cả / Đã xong lọc đúng.
- [ ] Tìm theo từ khóa, lọc theo ưu tiên và nhãn.
- [ ] Kéo-thả đổi thứ tự → reload vẫn giữ thứ tự.
- [ ] Xóa việc (có xác nhận).
- [ ] Dark mode bật/tắt, reload vẫn nhớ.
- [ ] Mở app trên thiết bị/tab thứ 2, thêm việc ở tab 1 → tab 2 tự cập nhật (realtime).
- [ ] Ngắt mạng rồi thêm việc → thấy banner lỗi (không im lặng).

- [ ] **Step 5: Chạy toàn bộ test + build lần cuối**

Run: `npm test && npm run build && npm run lint`
Expected: test PASS, build thành công, lint sạch.

- [ ] **Step 6: Cập nhật README** — bỏ dòng "đang ở giai đoạn tài liệu", ghi rõ các bước chạy đã kiểm chứng. Commit.

```bash
git add -A
git commit -m "docs: cập nhật README sau khi app chạy end-to-end"
```

---

## Ghi chú thực thi
- Giao diện hiện tại là bản Tailwind tối giản mặc định (theo spec mục 7). Khi có thiết kế từ **Claude Design**, thay class/layout trong `src/components/*` và `src/pages/*` mà không đụng logic ở `src/lib/*` và `src/hooks/*`.
- Nếu chưa cài `git`, bỏ qua các bước commit hoặc khởi tạo repo trước (`git init`).
