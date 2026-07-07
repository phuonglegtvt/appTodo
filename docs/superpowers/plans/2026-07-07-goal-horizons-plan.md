# Mục tiêu & lưới phân tầng thời gian (Phase 2b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm tab "Kế hoạch" cho phép xem/quản lý mục tiêu theo 4 tầng thời gian (5 Năm/Năm/Tháng/Tuần) dạng lưới kiểu Google Calendar, cộng tầng Ngày tái dùng danh sách việc hiện có — việc (todo) tự động rơi vào đúng ô theo `due_date`.

**Architecture:** Bảng `goals` mới (phẳng, không cây cha-con) + `src/lib/goalFilters.ts` (logic thuần tính khoảng ngày/gộp việc theo kỳ, viết TDD) + `useGoals.ts` (CRUD/realtime, giống khuôn `useTodos.ts`) + 5 component UI mới (`HorizonSwitcher`, `PeriodGrid`, `PeriodCell`, `GoalList`, `GoalItem`) ghép lại trong `PlanPage.tsx`, tích hợp vào `AppPage.tsx`/`Sidebar.tsx` qua 1 tab điều hướng mới.

**Tech Stack:** React + TypeScript + Tailwind CSS, Supabase (Postgres + RLS + Realtime), Vitest cho logic thuần.

## Global Constraints

- TypeScript strict ở mọi nơi; không dùng `any`.
- Style bằng class Tailwind, hỗ trợ dark mode qua `dark:` — dùng đúng token màu đã có trong `tailwind.config.js` (không thêm màu mới).
- KHÔNG nuốt lỗi im lặng: lỗi mạng/lưu thất bại phải hiện cho người dùng (qua `ErrorBanner` có sẵn) + `console.error`.
- Chỉ dùng Supabase `anon` key ở frontend; bảo vệ dữ liệu bằng Row Level Security (RLS) — 4 policy `user_id = auth.uid()` giống bảng `todos`.
- Ngôn ngữ giao diện: tiếng Việt.
- Test logic thuần bằng Vitest trước khi ghép UI (TDD) — theo đúng phong cách `src/lib/todoFilters.test.ts` và `src/lib/recurrence.test.ts` đã có trong repo.
- Trước khi báo "xong": chạy `npm test` và `npm run build`, xác nhận pass thật (không khẳng định khi chưa chạy).
- Spec đầy đủ: `docs/superpowers/specs/2026-07-07-goal-horizons-design.md`.

---

### Task 1: Bảng `goals` + kiểu dữ liệu

**Files:**
- Modify: `supabase/schema.sql` (thêm khối mới ở cuối file)
- Create: `src/types/goal.ts`

**Interfaces:**
- Produces: `Horizon = 'five_year' | 'year' | 'month' | 'week'`, `ViewHorizon = Horizon | 'day'`, `Goal { id, user_id, horizon, period_key, title, is_done, created_at, updated_at }`, `NewGoal { horizon, period_key, title }`, `GoalUpdate = Partial<Pick<Goal, 'title' | 'is_done'>>`.

- [ ] **Step 1: Thêm bảng `goals` vào `supabase/schema.sql`**

Mở `supabase/schema.sql`, thêm vào cuối file (sau khối Phase 2a `recurrence`):

```sql

-- Phase 2b: mục tiêu theo tầng thời gian (xem
-- docs/superpowers/specs/2026-07-07-goal-horizons-design.md).
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  horizon text not null check (horizon in ('five_year', 'year', 'month', 'week')),
  period_key text not null,
  title text not null,
  is_done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_goals_updated_at on public.goals;
create trigger trg_goals_updated_at
  before update on public.goals
  for each row execute function public.set_updated_at();

alter table public.goals enable row level security;

drop policy if exists "goals_select_own" on public.goals;
create policy "goals_select_own" on public.goals
  for select using (auth.uid() = user_id);

drop policy if exists "goals_insert_own" on public.goals;
create policy "goals_insert_own" on public.goals
  for insert with check (auth.uid() = user_id);

drop policy if exists "goals_update_own" on public.goals;
create policy "goals_update_own" on public.goals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "goals_delete_own" on public.goals;
create policy "goals_delete_own" on public.goals
  for delete using (auth.uid() = user_id);

alter publication supabase_realtime add table public.goals;
alter table public.goals replica identity full;
```

- [ ] **Step 2: Tạo `src/types/goal.ts`**

```ts
export type Horizon = 'five_year' | 'year' | 'month' | 'week';

/** Horizon dùng cho UI: thêm 'day' (tầng Ngày không có Goal riêng, tái dùng todos). */
export type ViewHorizon = Horizon | 'day';

export interface Goal {
  id: string;
  user_id: string;
  horizon: Horizon;
  period_key: string; // '2025' (five_year, năm đầu khối) | '2026' (year) | '2026-07' (month) | '2026-W28' (week)
  title: string;
  is_done: boolean;
  created_at: string;
  updated_at: string;
}

/** Dữ liệu để tạo mục tiêu mới (server tự sinh id/user_id/timestamps). */
export interface NewGoal {
  horizon: Horizon;
  period_key: string;
  title: string;
}

/** Các trường được phép sửa. */
export type GoalUpdate = Partial<Pick<Goal, 'title' | 'is_done'>>;
```

- [ ] **Step 3: Xác nhận build không lỗi**

Run: `npm run build`
Expected: build thành công (không có lỗi TypeScript), không có output liên quan `goal.ts`.

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql src/types/goal.ts
git commit -m "feat: thêm bảng goals + kiểu dữ liệu cho Phase 2b"
```

---

### Task 2: `goalFilters.ts` — `getPeriodRange` + `getPeriodKey` (TDD)

Đây là phần logic khó nhất (tuần ISO, năm nhuận, ranh giới khối 5 năm) — viết test trước với các giá trị đã tính tay và kiểm chứng độc lập (quy tắc Doomsday), không đoán.

**Files:**
- Create: `src/lib/goalFilters.ts`
- Test: `src/lib/goalFilters.test.ts`

**Interfaces:**
- Consumes: không (chỉ dùng `Horizon` từ `../types/goal`, tạo ở Task 1).
- Produces: `PeriodRange { start: string; end: string }`, `getPeriodRange(horizon: Horizon, periodKey: string): PeriodRange`, `getPeriodKey(horizon: Horizon, date: string): string`.

- [ ] **Step 1: Viết test thất bại (`src/lib/goalFilters.test.ts`)**

```ts
import { describe, it, expect } from 'vitest';
import { getPeriodRange, getPeriodKey } from './goalFilters';

describe('getPeriodRange', () => {
  it('year: cả năm từ 01/01 đến 31/12', () => {
    expect(getPeriodRange('year', '2026')).toEqual({ start: '2026-01-01', end: '2026-12-31' });
  });

  it('month: tháng thường', () => {
    expect(getPeriodRange('month', '2026-07')).toEqual({ start: '2026-07-01', end: '2026-07-31' });
  });

  it('month: tháng 2 năm nhuận có 29 ngày', () => {
    expect(getPeriodRange('month', '2028-02')).toEqual({ start: '2028-02-01', end: '2028-02-29' });
  });

  it('month: tháng 2 năm thường có 28 ngày', () => {
    expect(getPeriodRange('month', '2026-02')).toEqual({ start: '2026-02-01', end: '2026-02-28' });
  });

  it('five_year: khối 5 năm từ period_key là năm đầu khối', () => {
    expect(getPeriodRange('five_year', '2025')).toEqual({ start: '2025-01-01', end: '2029-12-31' });
    expect(getPeriodRange('five_year', '2030')).toEqual({ start: '2030-01-01', end: '2034-12-31' });
  });

  it('week: tuần ISO bình thường (tuần 28/2026 chứa 07/07/2026, Thứ Ba)', () => {
    expect(getPeriodRange('week', '2026-W28')).toEqual({ start: '2026-07-06', end: '2026-07-12' });
  });

  it('week: tuần cuối năm ISO có thể lấn sang năm sau (tuần 53/2026)', () => {
    expect(getPeriodRange('week', '2026-W53')).toEqual({ start: '2026-12-28', end: '2027-01-03' });
  });
});

describe('getPeriodKey', () => {
  it('year: lấy đúng năm', () => {
    expect(getPeriodKey('year', '2026-07-15')).toBe('2026');
  });

  it('month: lấy đúng năm-tháng', () => {
    expect(getPeriodKey('month', '2026-07-15')).toBe('2026-07');
  });

  it('five_year: quy về năm đầu khối 5 năm', () => {
    expect(getPeriodKey('five_year', '2026-07-15')).toBe('2025');
  });

  it('five_year: ranh giới khối — 2029 và 2030 phải khác khối', () => {
    expect(getPeriodKey('five_year', '2029-12-31')).toBe('2025');
    expect(getPeriodKey('five_year', '2030-01-01')).toBe('2030');
  });

  it('week: ngày giữa tuần (07/07/2026 thuộc tuần 28)', () => {
    expect(getPeriodKey('week', '2026-07-07')).toBe('2026-W28');
  });

  it('week: ca biên cuối năm — 01/01/2027 vẫn thuộc tuần 53 của năm ISO 2026', () => {
    expect(getPeriodKey('week', '2027-01-01')).toBe('2026-W53');
  });

  it('round-trip: getPeriodRange và getPeriodKey khớp nhau cho tuần', () => {
    const key = getPeriodKey('week', '2026-07-07');
    const range = getPeriodRange('week', key);
    expect(getPeriodKey('week', range.start)).toBe(key);
    expect(getPeriodKey('week', range.end)).toBe(key);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận thất bại**

Run: `npx vitest run src/lib/goalFilters.test.ts`
Expected: FAIL — `Cannot find module './goalFilters'` (file chưa tồn tại).

- [ ] **Step 3: Viết implementation tối thiểu (`src/lib/goalFilters.ts`)**

```ts
import type { Horizon } from '../types/goal';

export interface PeriodRange {
  start: string; // 'YYYY-MM-DD'
  end: string; // 'YYYY-MM-DD'
}

function toDateString(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Thứ Hai (đầu tuần ISO, Mon=đầu tuần) chứa `date`. Không đổi `date` gốc. */
function isoWeekMonday(date: Date): Date {
  const d = new Date(date);
  const dayNum = (d.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  d.setUTCDate(d.getUTCDate() - dayNum);
  return d;
}

/** Năm ISO + số tuần ISO chứa `date` (thuật toán "Thứ Năm gần nhất"). */
function isoWeekOf(date: Date): { isoYear: number; week: number } {
  const d = new Date(date);
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // nhích tới Thứ Năm gần nhất
  const isoYear = d.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86400000));
  return { isoYear, week };
}

export function getPeriodRange(horizon: Horizon, periodKey: string): PeriodRange {
  switch (horizon) {
    case 'five_year': {
      const startYear = Number(periodKey);
      return { start: `${startYear}-01-01`, end: `${startYear + 4}-12-31` };
    }
    case 'year':
      return { start: `${periodKey}-01-01`, end: `${periodKey}-12-31` };
    case 'month': {
      const [y, m] = periodKey.split('-').map(Number);
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
      return { start: `${periodKey}-01`, end: `${periodKey}-${String(lastDay).padStart(2, '0')}` };
    }
    case 'week': {
      const [yearStr, weekStr] = periodKey.split('-W');
      const isoYear = Number(yearStr);
      const week = Number(weekStr);
      // Thứ Hai của tuần 1 ISO year = Thứ Hai chứa ngày 4/1 (04/01 luôn nằm trong tuần 1).
      const week1Monday = isoWeekMonday(new Date(Date.UTC(isoYear, 0, 4)));
      const monday = new Date(week1Monday);
      monday.setUTCDate(monday.getUTCDate() + (week - 1) * 7);
      const sunday = new Date(monday);
      sunday.setUTCDate(sunday.getUTCDate() + 6);
      return { start: toDateString(monday), end: toDateString(sunday) };
    }
  }
}

export function getPeriodKey(horizon: Horizon, date: string): string {
  switch (horizon) {
    case 'five_year': {
      const year = parseDate(date).getUTCFullYear();
      return String(Math.floor(year / 5) * 5);
    }
    case 'year':
      return date.slice(0, 4);
    case 'month':
      return date.slice(0, 7);
    case 'week': {
      const { isoYear, week } = isoWeekOf(parseDate(date));
      return `${isoYear}-W${String(week).padStart(2, '0')}`;
    }
  }
}
```

- [ ] **Step 4: Chạy test, xác nhận qua hết**

Run: `npx vitest run src/lib/goalFilters.test.ts`
Expected: PASS toàn bộ (16 test).

- [ ] **Step 5: Commit**

```bash
git add src/lib/goalFilters.ts src/lib/goalFilters.test.ts
git commit -m "feat: getPeriodRange/getPeriodKey cho lưới phân tầng thời gian (TDD)"
```

---

### Task 3: `goalFilters.ts` — `getChildPeriods` + `countTodosInRange` + `shiftPeriod` (TDD)

**Files:**
- Modify: `src/lib/goalFilters.ts`
- Modify: `src/lib/goalFilters.test.ts`

**Interfaces:**
- Consumes: `getPeriodRange`, `toDateString`, `parseDate` từ Task 2 (cùng file); `Todo` từ `../types/todo`.
- Produces: `getChildPeriods(horizon: Horizon, periodKey: string): string[]`, `countTodosInRange(todos: Todo[], start: string, end: string): { done: number; total: number }`, `shiftPeriod(horizon: Horizon, periodKey: string, delta: number): string`.

- [ ] **Step 1: Thêm test thất bại vào `src/lib/goalFilters.test.ts`**

Thêm import `Todo` và các describe block sau vào cuối file:

```ts
import type { Todo } from '../types/todo';
import { getChildPeriods, countTodosInRange, shiftPeriod } from './goalFilters';

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

describe('getChildPeriods', () => {
  it('five_year: ra đúng 5 năm liên tiếp', () => {
    expect(getChildPeriods('five_year', '2025')).toEqual(['2025', '2026', '2027', '2028', '2029']);
  });

  it('year: ra đúng 12 tháng', () => {
    const months = getChildPeriods('year', '2026');
    expect(months).toHaveLength(12);
    expect(months[0]).toBe('2026-01');
    expect(months[11]).toBe('2026-12');
  });

  it('month: ra đúng số ngày trong tháng (năm nhuận, 29 ngày)', () => {
    const days = getChildPeriods('month', '2028-02');
    expect(days).toHaveLength(29);
    expect(days[0]).toBe('2028-02-01');
    expect(days[28]).toBe('2028-02-29');
  });

  it('month: ra đúng số ngày trong tháng (năm thường, 28 ngày)', () => {
    expect(getChildPeriods('month', '2026-02')).toHaveLength(28);
  });

  it('week: ra đúng 7 ngày Thứ Hai đến Chủ Nhật', () => {
    expect(getChildPeriods('week', '2026-W28')).toEqual([
      '2026-07-06',
      '2026-07-07',
      '2026-07-08',
      '2026-07-09',
      '2026-07-10',
      '2026-07-11',
      '2026-07-12',
    ]);
  });
});

describe('countTodosInRange', () => {
  it('đếm đúng done/total, bỏ qua việc ngoài khoảng và việc không có hạn', () => {
    const todos = [
      makeTodo({ id: 'a', due_date: '2026-07-05', is_done: true }),
      makeTodo({ id: 'b', due_date: '2026-07-10', is_done: false }),
      makeTodo({ id: 'c', due_date: '2026-08-01', is_done: false }),
      makeTodo({ id: 'd', due_date: null }),
    ];
    expect(countTodosInRange(todos, '2026-07-01', '2026-07-31')).toEqual({ done: 1, total: 2 });
  });
});

describe('shiftPeriod', () => {
  it('year: +1/-1 năm', () => {
    expect(shiftPeriod('year', '2026', 1)).toBe('2027');
    expect(shiftPeriod('year', '2026', -1)).toBe('2025');
  });

  it('month: qua ranh giới năm', () => {
    expect(shiftPeriod('month', '2026-12', 1)).toBe('2027-01');
    expect(shiftPeriod('month', '2026-01', -1)).toBe('2025-12');
  });

  it('five_year: nhảy nguyên khối 5 năm', () => {
    expect(shiftPeriod('five_year', '2025', 1)).toBe('2030');
  });

  it('week: qua ranh giới năm ISO (tuần 53/2026 -> tuần 1/2027)', () => {
    expect(shiftPeriod('week', '2026-W53', 1)).toBe('2027-W01');
  });

  it('week: đi tới rồi quay lại đúng kỳ ban đầu', () => {
    const key = '2026-W28';
    expect(shiftPeriod('week', shiftPeriod('week', key, 1), -1)).toBe(key);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận thất bại**

Run: `npx vitest run src/lib/goalFilters.test.ts`
Expected: FAIL — `getChildPeriods`/`countTodosInRange`/`shiftPeriod` chưa được export.

- [ ] **Step 3: Thêm implementation vào `src/lib/goalFilters.ts`**

Thêm import ở đầu file:

```ts
import type { Todo } from '../types/todo';
```

Thêm 3 hàm vào cuối file:

```ts
export function getChildPeriods(horizon: Horizon, periodKey: string): string[] {
  switch (horizon) {
    case 'five_year': {
      const startYear = Number(periodKey);
      return Array.from({ length: 5 }, (_, i) => String(startYear + i));
    }
    case 'year': {
      const year = Number(periodKey);
      return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
    }
    case 'month': {
      const [y, m] = periodKey.split('-').map(Number);
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
      return Array.from({ length: lastDay }, (_, i) => `${periodKey}-${String(i + 1).padStart(2, '0')}`);
    }
    case 'week': {
      const { start } = getPeriodRange('week', periodKey);
      const monday = parseDate(start);
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setUTCDate(d.getUTCDate() + i);
        return toDateString(d);
      });
    }
  }
}

export function countTodosInRange(todos: Todo[], start: string, end: string): { done: number; total: number } {
  const inRange = todos.filter((t) => t.due_date !== null && t.due_date >= start && t.due_date <= end);
  return { done: inRange.filter((t) => t.is_done).length, total: inRange.length };
}

export function shiftPeriod(horizon: Horizon, periodKey: string, delta: number): string {
  switch (horizon) {
    case 'five_year':
      return String(Number(periodKey) + delta * 5);
    case 'year':
      return String(Number(periodKey) + delta);
    case 'month': {
      const [y, m] = periodKey.split('-').map(Number);
      const total = y * 12 + (m - 1) + delta;
      const targetYear = Math.floor(total / 12);
      const targetMonth = ((total % 12) + 12) % 12;
      return `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`;
    }
    case 'week': {
      const { start } = getPeriodRange('week', periodKey);
      const monday = parseDate(start);
      monday.setUTCDate(monday.getUTCDate() + delta * 7);
      return getPeriodKey('week', toDateString(monday));
    }
  }
}
```

- [ ] **Step 4: Chạy test, xác nhận qua hết**

Run: `npx vitest run src/lib/goalFilters.test.ts`
Expected: PASS toàn bộ (26 test).

- [ ] **Step 5: Chạy toàn bộ test suite + build**

Run: `npm test && npm run build`
Expected: tất cả test pass (kể cả `todoFilters.test.ts`, `recurrence.test.ts`, `theme.test.ts` cũ), build thành công.

- [ ] **Step 6: Commit**

```bash
git add src/lib/goalFilters.ts src/lib/goalFilters.test.ts
git commit -m "feat: getChildPeriods/countTodosInRange/shiftPeriod cho lưới phân tầng (TDD)"
```

---

### Task 4: `useGoals.ts` — CRUD + realtime

**Files:**
- Create: `src/hooks/useGoals.ts`

**Interfaces:**
- Consumes: `supabase` từ `../lib/supabaseClient`; `Goal, NewGoal, GoalUpdate` từ `../types/goal` (Task 1).
- Produces: `useGoals(userId: string): { goals: Goal[]; loading: boolean; error: string | null; addGoal: (input: NewGoal) => Promise<void>; updateGoal: (id: string, patch: GoalUpdate) => Promise<void>; deleteGoal: (id: string) => Promise<void>; clearError: () => void }`.

- [ ] **Step 1: Tạo `src/hooks/useGoals.ts`**

```ts
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Goal, NewGoal, GoalUpdate } from '../types/goal';

interface UseGoals {
  goals: Goal[];
  loading: boolean;
  error: string | null;
  addGoal: (input: NewGoal) => Promise<void>;
  updateGoal: (id: string, patch: GoalUpdate) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  clearError: () => void;
}

export function useGoals(userId: string): UseGoals {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tải lần đầu.
  useEffect(() => {
    let active = true;
    setLoading(true);
    supabase
      .from('goals')
      .select('*')
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error('Lỗi tải mục tiêu:', error);
          setError('Không tải được danh sách mục tiêu: ' + error.message);
        } else {
          setGoals((data ?? []) as Goal[]);
        }
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  // Đồng bộ realtime: nghe thay đổi trên bảng goals của user này.
  useEffect(() => {
    const channel = supabase
      .channel('goals-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'goals', filter: `user_id=eq.${userId}` },
        (payload) => {
          setGoals((prev) => {
            if (payload.eventType === 'INSERT') {
              const row = payload.new as Goal;
              if (prev.some((g) => g.id === row.id)) return prev;
              return [...prev, row];
            }
            if (payload.eventType === 'UPDATE') {
              const row = payload.new as Goal;
              return prev.map((g) => (g.id === row.id ? row : g));
            }
            if (payload.eventType === 'DELETE') {
              const old = payload.old as { id: string };
              return prev.filter((g) => g.id !== old.id);
            }
            return prev;
          });
        },
      )
      .subscribe((status, err) => {
        const s = String(status);
        if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') {
          console.error('Lỗi kênh đồng bộ realtime (goals):', status, err);
          setError('Mất kết nối đồng bộ thời gian thực — hãy tải lại trang.');
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const addGoal = useCallback(
    async (input: NewGoal) => {
      const { error } = await supabase.from('goals').insert({
        user_id: userId,
        horizon: input.horizon,
        period_key: input.period_key,
        title: input.title,
      });
      if (error) {
        console.error('Lỗi thêm mục tiêu:', error);
        setError('Không thêm được mục tiêu: ' + error.message);
      }
    },
    [userId],
  );

  const updateGoal = useCallback(async (id: string, patch: GoalUpdate) => {
    const { error } = await supabase.from('goals').update(patch).eq('id', id);
    if (error) {
      console.error('Lỗi cập nhật mục tiêu:', error);
      setError('Không cập nhật được mục tiêu: ' + error.message);
    }
  }, []);

  const deleteGoal = useCallback(async (id: string) => {
    const { error } = await supabase.from('goals').delete().eq('id', id);
    if (error) {
      console.error('Lỗi xóa mục tiêu:', error);
      setError('Không xóa được mục tiêu: ' + error.message);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { goals, loading, error, addGoal, updateGoal, deleteGoal, clearError };
}
```

- [ ] **Step 2: Xác nhận build không lỗi**

Run: `npm run build`
Expected: build thành công.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useGoals.ts
git commit -m "feat: useGoals hook (CRUD + realtime), theo khuôn useTodos"
```

---

### Task 5: `GoalItem.tsx` + `GoalList.tsx`

**Files:**
- Create: `src/components/GoalItem.tsx`
- Create: `src/components/GoalList.tsx`

**Interfaces:**
- Consumes: `Goal, GoalUpdate, Horizon, NewGoal` từ `../types/goal` (Task 1).
- Produces: `GoalItem` (props `{ goal, onToggle, onRename, onDelete }`), `GoalList` (props `{ goals, horizon, periodKey, onAdd, onUpdate, onDelete }`).

- [ ] **Step 1: Tạo `src/components/GoalItem.tsx`**

```tsx
import { useState } from 'react';
import type { Goal } from '../types/goal';

interface Props {
  goal: Goal;
  onToggle: (id: string, done: boolean) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

/** 1 dòng mục tiêu: checkbox hoàn thành + tên (bấm để sửa tại chỗ) + xóa. */
export function GoalItem({ goal, onToggle, onRename, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(goal.title);

  function save() {
    const t = title.trim();
    if (t && t !== goal.title) onRename(goal.id, t);
    else setTitle(goal.title);
    setEditing(false);
  }

  return (
    <li className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2 dark:border-border-dark dark:bg-surface-dark">
      <button
        type="button"
        role="checkbox"
        aria-checked={goal.is_done}
        aria-label={goal.is_done ? 'Bỏ đánh dấu hoàn thành' : 'Đánh dấu hoàn thành'}
        onClick={() => onToggle(goal.id, !goal.is_done)}
        className={`flex h-5 w-5 flex-none items-center justify-center rounded-md text-[13px] leading-none transition-colors ${
          goal.is_done
            ? 'bg-primary text-white dark:bg-primary-dark'
            : 'border-2 border-border dark:border-border-dark'
        }`}
      >
        {goal.is_done ? '✓' : ''}
      </button>

      {editing ? (
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1 text-sm text-text outline-none focus:border-primary dark:border-border-dark dark:bg-surface-2dark dark:text-text-dark"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={`min-w-0 flex-1 truncate text-left text-sm ${
            goal.is_done
              ? 'text-text-muted line-through opacity-75 dark:text-text-muted-dark'
              : 'text-text dark:text-text-dark'
          }`}
        >
          {goal.title}
        </button>
      )}

      <button
        onClick={() => onDelete(goal.id)}
        aria-label="Xóa mục tiêu"
        className="flex h-7 w-7 flex-none items-center justify-center rounded-lg text-[13px] text-text-muted transition hover:bg-red-50 hover:text-red-600 dark:text-text-muted-dark dark:hover:bg-red-950/50 dark:hover:text-red-300"
      >
        ✕
      </button>
    </li>
  );
}
```

- [ ] **Step 2: Tạo `src/components/GoalList.tsx`**

```tsx
import { useState } from 'react';
import type { Goal, GoalUpdate, Horizon, NewGoal } from '../types/goal';
import { GoalItem } from './GoalItem';

interface Props {
  goals: Goal[];
  horizon: Horizon;
  periodKey: string;
  onAdd: (input: NewGoal) => void;
  onUpdate: (id: string, patch: GoalUpdate) => void;
  onDelete: (id: string) => void;
}

/** Danh sách mục tiêu của đúng 1 kỳ đang chọn: thêm, tick, sửa tên, xóa. */
export function GoalList({ goals, horizon, periodKey, onAdd, onUpdate, onDelete }: Props) {
  const [title, setTitle] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    onAdd({ horizon, period_key: periodKey, title: t });
    setTitle('');
  }

  return (
    <div className="flex flex-col gap-2">
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Thêm mục tiêu cho kỳ này…"
          aria-label="Mục tiêu mới"
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary dark:border-border-dark dark:bg-surface-2dark dark:text-text-dark"
        />
        <button className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white dark:bg-primary-dark">
          Thêm
        </button>
      </form>
      {goals.length === 0 ? (
        <p className="text-sm text-text-muted dark:text-text-muted-dark">Chưa có mục tiêu nào cho kỳ này.</p>
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

- [ ] **Step 3: Xác nhận build không lỗi**

Run: `npm run build`
Expected: build thành công.

- [ ] **Step 4: Commit**

```bash
git add src/components/GoalItem.tsx src/components/GoalList.tsx
git commit -m "feat: GoalItem/GoalList — CRUD mục tiêu cho 1 kỳ"
```

---

### Task 6: `HorizonSwitcher.tsx`

**Files:**
- Create: `src/components/HorizonSwitcher.tsx`

**Interfaces:**
- Consumes: `ViewHorizon` từ `../types/goal` (Task 1).
- Produces: `HorizonSwitcher` (props `{ horizon: ViewHorizon; onHorizon: (h: ViewHorizon) => void; periodLabel: string; onPrev: () => void; onNext: () => void }`).

- [ ] **Step 1: Tạo `src/components/HorizonSwitcher.tsx`**

```tsx
import type { ViewHorizon } from '../types/goal';

interface Props {
  horizon: ViewHorizon;
  onHorizon: (h: ViewHorizon) => void;
  periodLabel: string;
  onPrev: () => void;
  onNext: () => void;
}

const HORIZON_LABEL: Record<ViewHorizon, string> = {
  five_year: '5 Năm',
  year: 'Năm',
  month: 'Tháng',
  week: 'Tuần',
  day: 'Ngày',
};

const HORIZONS: ViewHorizon[] = ['five_year', 'year', 'month', 'week', 'day'];

/** Thanh chọn tầng thời gian + điều hướng kỳ trước/sau cho tab Kế hoạch. */
export function HorizonSwitcher({ horizon, onHorizon, periodLabel, onPrev, onNext }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex gap-0.5 rounded-lg border border-border bg-surface-2 p-0.5 dark:border-border-dark dark:bg-surface-2dark">
        {HORIZONS.map((h) => (
          <button
            key={h}
            onClick={() => onHorizon(h)}
            aria-pressed={horizon === h}
            className={`rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
              horizon === h
                ? 'bg-surface text-text shadow-sm dark:bg-surface-dark dark:text-text-dark'
                : 'text-text-muted dark:text-text-muted-dark'
            }`}
          >
            {HORIZON_LABEL[h]}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onPrev} aria-label="Kỳ trước" className="btn-icon h-8 w-8 text-sm">
          ‹
        </button>
        <span className="min-w-[140px] text-center text-sm font-semibold text-text dark:text-text-dark">
          {periodLabel}
        </span>
        <button onClick={onNext} aria-label="Kỳ sau" className="btn-icon h-8 w-8 text-sm">
          ›
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Xác nhận build không lỗi**

Run: `npm run build`
Expected: build thành công.

- [ ] **Step 3: Commit**

```bash
git add src/components/HorizonSwitcher.tsx
git commit -m "feat: HorizonSwitcher — chọn tầng thời gian + điều hướng kỳ"
```

---

### Task 7: `PeriodCell.tsx` + `PeriodGrid.tsx`

Tooltip hiện bằng CSS `group-hover` thuần (không state JS) — trên thiết bị cảm ứng không có `:hover` bền nên tooltip không hiện, chạm vào ô sẽ kích hoạt thẳng `onClick` (đi xuống tầng con). Đây là cách hiện thực đúng hành vi đã chốt (desktop: hover xem trước; mobile: chạm đi thẳng) mà không cần logic phát hiện thiết bị.

**Files:**
- Create: `src/components/PeriodCell.tsx`
- Create: `src/components/PeriodGrid.tsx`

**Interfaces:**
- Consumes: không phụ thuộc task khác (component thuần, chỉ nhận props).
- Produces: `PeriodCell` (props `{ label, doneCount, totalCount, tooltipLines, onSelect }`), `PeriodGrid` với `CellData { key: string; label: string; doneCount: number; totalCount: number; tooltipLines: string[] }` và props `{ columns: number; leadingBlanks?: number; cells: CellData[]; onSelect: (key: string) => void }`.

- [ ] **Step 1: Tạo `src/components/PeriodCell.tsx`**

```tsx
interface Props {
  label: string;
  doneCount: number;
  totalCount: number;
  tooltipLines: string[];
  onSelect: () => void;
}

/**
 * 1 ô trong lưới. Hover (desktop, CSS `group-hover` thuần) hiện tooltip xem
 * trước; bấm/chạm luôn gọi onSelect để đi xuống tầng con — trên thiết bị cảm
 * ứng không có hover nên chạm đi thẳng vào tầng con, không cần logic riêng.
 */
export function PeriodCell({ label, doneCount, totalCount, tooltipLines, onSelect }: Props) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group relative flex flex-col items-center gap-0.5 rounded-lg border border-border bg-surface px-1 py-1.5 text-center text-xs transition-colors hover:border-primary dark:border-border-dark dark:bg-surface-dark dark:hover:border-primary-dark"
    >
      <span className="font-medium text-text dark:text-text-dark">{label}</span>
      {totalCount > 0 && (
        <span className="text-[10px] text-text-muted dark:text-text-muted-dark">
          {doneCount}/{totalCount}
        </span>
      )}
      {tooltipLines.length > 0 && (
        <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 hidden w-44 -translate-x-1/2 rounded-lg border border-border bg-surface p-2 text-left text-[11px] shadow-md group-hover:block dark:border-border-dark dark:bg-surface-dark dark:shadow-md-dark">
          {tooltipLines.map((line, i) => (
            <div key={i} className="truncate text-text dark:text-text-dark">
              {line}
            </div>
          ))}
        </div>
      )}
    </button>
  );
}
```

- [ ] **Step 2: Tạo `src/components/PeriodGrid.tsx`**

```tsx
import { PeriodCell } from './PeriodCell';

export interface CellData {
  key: string;
  label: string;
  doneCount: number;
  totalCount: number;
  tooltipLines: string[];
}

interface Props {
  columns: number;
  leadingBlanks?: number;
  cells: CellData[];
  onSelect: (key: string) => void;
}

/** Lưới ô con của 1 tầng (năm→tháng, tháng→ngày thật theo lịch, tuần→7 ngày). */
export function PeriodGrid({ columns, leadingBlanks = 0, cells, onSelect }: Props) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {Array.from({ length: leadingBlanks }).map((_, i) => (
        <div key={`blank-${i}`} />
      ))}
      {cells.map((c) => (
        <PeriodCell
          key={c.key}
          label={c.label}
          doneCount={c.doneCount}
          totalCount={c.totalCount}
          tooltipLines={c.tooltipLines}
          onSelect={() => onSelect(c.key)}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Xác nhận build không lỗi**

Run: `npm run build`
Expected: build thành công.

- [ ] **Step 4: Commit**

```bash
git add src/components/PeriodCell.tsx src/components/PeriodGrid.tsx
git commit -m "feat: PeriodCell/PeriodGrid — lưới ô con kiểu Google Calendar"
```

---

### Task 8: `PlanPage.tsx` — điều phối tab Kế hoạch

**Files:**
- Create: `src/components/PlanPage.tsx`

**Interfaces:**
- Consumes: `useGoals` (Task 4); `GoalList` (Task 5); `HorizonSwitcher` (Task 6); `PeriodGrid`, `CellData` (Task 7); `getPeriodRange, getPeriodKey, getChildPeriods, countTodosInRange, shiftPeriod` (Task 2+3); `TodoList` (đã có, `src/components/TodoList.tsx`); `ErrorBanner` (đã có); `Todo, TodoUpdate` từ `../types/todo`; `Horizon, ViewHorizon` từ `../types/goal`.
- Produces: `PlanPage` (props `{ userId: string; todos: Todo[]; today: string; onToggleTodo: (id: string, done: boolean) => void; onUpdateTodo: (id: string, patch: TodoUpdate) => void; onDeleteTodo: (id: string) => void; onReorderTodos: (ordered: Todo[]) => void }`).

- [ ] **Step 1: Tạo `src/components/PlanPage.tsx`**

```tsx
import { useMemo, useState } from 'react';
import { useGoals } from '../hooks/useGoals';
import {
  getPeriodRange,
  getPeriodKey,
  getChildPeriods,
  countTodosInRange,
  shiftPeriod,
} from '../lib/goalFilters';
import type { Todo, TodoUpdate } from '../types/todo';
import type { Horizon, ViewHorizon } from '../types/goal';
import { HorizonSwitcher } from './HorizonSwitcher';
import { PeriodGrid } from './PeriodGrid';
import type { CellData } from './PeriodGrid';
import { GoalList } from './GoalList';
import { TodoList } from './TodoList';
import { ErrorBanner } from './ErrorBanner';

interface Props {
  userId: string;
  todos: Todo[];
  today: string;
  onToggleTodo: (id: string, done: boolean) => void;
  onUpdateTodo: (id: string, patch: TodoUpdate) => void;
  onDeleteTodo: (id: string) => void;
  onReorderTodos: (ordered: Todo[]) => void;
}

const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

/** Ngày đại diện của 1 kỳ (dùng để đổi tầng mà vẫn giữ đúng thời điểm đang xem). */
function anchorDate(horizon: ViewHorizon, periodKey: string): string {
  return horizon === 'day' ? periodKey : getPeriodRange(horizon, periodKey).start;
}

function shiftDay(date: string, delta: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

function formatPeriodLabel(horizon: ViewHorizon, periodKey: string): string {
  switch (horizon) {
    case 'five_year': {
      const start = Number(periodKey);
      return `${start}–${start + 4}`;
    }
    case 'year':
      return `Năm ${periodKey}`;
    case 'month': {
      const [y, m] = periodKey.split('-');
      return `Tháng ${m}/${y}`;
    }
    case 'week': {
      const { start, end } = getPeriodRange('week', periodKey);
      return `${start} – ${end}`;
    }
    case 'day':
      return periodKey;
  }
}

/** Trang "Kế hoạch": chọn tầng thời gian, xem mục tiêu + việc gộp theo đúng kỳ. */
export function PlanPage({ userId, todos, today, onToggleTodo, onUpdateTodo, onDeleteTodo, onReorderTodos }: Props) {
  const { goals, loading, error, addGoal, updateGoal, deleteGoal, clearError } = useGoals(userId);

  const [horizon, setHorizon] = useState<ViewHorizon>('month');
  const [periodKey, setPeriodKey] = useState<string>(() => getPeriodKey('month', today));

  function handleHorizon(newHorizon: ViewHorizon) {
    const anchor = anchorDate(horizon, periodKey);
    setHorizon(newHorizon);
    setPeriodKey(newHorizon === 'day' ? anchor : getPeriodKey(newHorizon, anchor));
  }

  function handlePrev() {
    setPeriodKey(horizon === 'day' ? shiftDay(periodKey, -1) : shiftPeriod(horizon, periodKey, -1));
  }

  function handleNext() {
    setPeriodKey(horizon === 'day' ? shiftDay(periodKey, 1) : shiftPeriod(horizon, periodKey, 1));
  }

  function handleSelectCell(key: string) {
    if (horizon === 'five_year') {
      setHorizon('year');
      setPeriodKey(key);
    } else if (horizon === 'year') {
      setHorizon('month');
      setPeriodKey(key);
    } else {
      // month hoặc week -> chọn 1 ngày cụ thể
      setHorizon('day');
      setPeriodKey(key);
    }
  }

  const currentGoals = useMemo(
    () => (horizon === 'day' ? [] : goals.filter((g) => g.horizon === horizon && g.period_key === periodKey)),
    [goals, horizon, periodKey],
  );

  const dayTodos = useMemo(
    () => (horizon === 'day' ? todos.filter((t) => t.due_date === periodKey) : []),
    [todos, horizon, periodKey],
  );

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

    function dayCells(dates: string[]): CellData[] {
      return dates.map((date) => {
        const todosOnDate = todos.filter((t) => t.due_date === date);
        return {
          key: date,
          label: String(Number(date.slice(8, 10))),
          doneCount: todosOnDate.filter((t) => t.is_done).length,
          totalCount: todosOnDate.length,
          tooltipLines: todosOnDate.map((t) => (t.is_done ? '✓ ' : '• ') + t.title),
        };
      });
    }

    if (horizon === 'day') return null;
    if (horizon === 'five_year') {
      return { columns: 5, leadingBlanks: 0, cells: yearOrFiveYearCells('year', getChildPeriods('five_year', periodKey)) };
    }
    if (horizon === 'year') {
      return { columns: 4, leadingBlanks: 0, cells: yearOrFiveYearCells('month', getChildPeriods('year', periodKey)) };
    }
    if (horizon === 'month') {
      const [y, m] = periodKey.split('-').map(Number);
      const firstWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
      const leadingBlanks = (firstWeekday + 6) % 7; // quy về Thứ Hai = cột đầu
      return { columns: 7, leadingBlanks, cells: dayCells(getChildPeriods('month', periodKey)) };
    }
    // week
    return { columns: 7, leadingBlanks: 0, cells: dayCells(getChildPeriods('week', periodKey)) };
  }, [horizon, periodKey, todos, goals]);

  return (
    <div className="flex flex-col gap-4">
      <HorizonSwitcher
        horizon={horizon}
        onHorizon={handleHorizon}
        periodLabel={formatPeriodLabel(horizon, periodKey)}
        onPrev={handlePrev}
        onNext={handleNext}
      />

      {error && <ErrorBanner message={error} onClose={clearError} />}

      {horizon !== 'day' && (
        <GoalList
          goals={currentGoals}
          horizon={horizon}
          periodKey={periodKey}
          onAdd={addGoal}
          onUpdate={updateGoal}
          onDelete={deleteGoal}
        />
      )}

      {loading ? (
        <p className="py-8 text-center text-sm text-text-muted dark:text-text-muted-dark">Đang tải…</p>
      ) : horizon === 'day' ? (
        <TodoList
          todos={dayTodos}
          today={today}
          onToggle={onToggleTodo}
          onUpdate={onUpdateTodo}
          onDelete={onDeleteTodo}
          onReorder={onReorderTodos}
        />
      ) : (
        <div className="flex flex-col gap-1.5">
          {(horizon === 'month' || horizon === 'week') && (
            <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-semibold text-text-muted dark:text-text-muted-dark">
              {WEEKDAY_LABELS.map((w) => (
                <div key={w}>{w}</div>
              ))}
            </div>
          )}
          {grid && (
            <PeriodGrid columns={grid.columns} leadingBlanks={grid.leadingBlanks} cells={grid.cells} onSelect={handleSelectCell} />
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Xác nhận build không lỗi**

Run: `npm run build`
Expected: build thành công.

- [ ] **Step 3: Commit**

```bash
git add src/components/PlanPage.tsx
git commit -m "feat: PlanPage — điều phối lưới phân tầng + mục tiêu + tầng Ngày"
```

---

### Task 9: Tích hợp tab "Kế hoạch" vào `AppPage.tsx` / `Sidebar.tsx`

**Files:**
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/pages/AppPage.tsx`

**Interfaces:**
- Consumes: `PlanPage` (Task 8).
- Produces: `Page = 'todos' | 'plan'` (khai báo trong `AppPage.tsx`), `Sidebar` nhận thêm props `page: Page; onPage: (p: Page) => void`.

- [ ] **Step 1: Sửa `src/components/Sidebar.tsx` — thêm props `page`/`onPage` + tab chuyển trang**

Sửa khai báo interface `Props` (dòng 4-13), thêm `page`/`onPage`:

```tsx
interface Props {
  page: 'todos' | 'plan';
  onPage: (p: 'todos' | 'plan') => void;
  view: SmartView;
  onView: (v: SmartView) => void;
  counts: Record<SmartView, number>;
  tags: { name: string; count: number }[];
  activeTag: string | null;
  onTag: (t: string | null) => void;
  userEmail: string;
  onSignOut: () => void;
}
```

Sửa chữ ký hàm `Sidebar` (dòng 23) để nhận thêm 2 props:

```tsx
export function Sidebar({
  page,
  onPage,
  view,
  onView,
  counts,
  tags,
  activeTag,
  onTag,
  userEmail,
  onSignOut,
}: Props) {
```

Thêm tab chuyển trang ngay sau khối logo (sau dòng đóng `</div>` của logo, trước khối "Smart views"):

```tsx
      {/* Chuyển trang: Việc / Kế hoạch */}
      <div className="mb-2 flex gap-0.5 rounded-lg border border-border bg-surface-2 p-0.5 dark:border-border-dark dark:bg-surface-2dark">
        <button
          onClick={() => onPage('todos')}
          aria-pressed={page === 'todos'}
          className={`flex-1 rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
            page === 'todos'
              ? 'bg-surface text-text shadow-sm dark:bg-surface-dark dark:text-text-dark'
              : 'text-text-muted dark:text-text-muted-dark'
          }`}
        >
          Việc
        </button>
        <button
          onClick={() => onPage('plan')}
          aria-pressed={page === 'plan'}
          className={`flex-1 rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
            page === 'plan'
              ? 'bg-surface text-text shadow-sm dark:bg-surface-dark dark:text-text-dark'
              : 'text-text-muted dark:text-text-muted-dark'
          }`}
        >
          Kế hoạch
        </button>
      </div>
```

Bọc khối "Smart views" + khối "Nhãn" hiện có (từ dòng `{/* Smart views */}` tới hết khối `{tags.length > 0 && (...)}`) trong `{page === 'todos' && (<>...</>)}` để 2 khối này chỉ hiện khi đang ở trang "Việc":

```tsx
      {page === 'todos' && (
        <>
          {/* Smart views */}
          <div className="px-2 pb-1.5 pt-2 text-[10.5px] font-bold tracking-[0.09em] text-text-muted dark:text-text-muted-dark">
            SMART VIEWS
          </div>
          {VIEWS.map((v) => {
            const active = view === v.key;
            return (
              <button
                key={v.key}
                onClick={() => onView(v.key)}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center rounded-[9px] border-l-2 px-2.5 py-2 text-sm transition-colors ${
                  active
                    ? 'border-primary bg-primary-soft font-semibold text-primary dark:border-primary-dark dark:bg-primary-soft-dark dark:text-primary-dark'
                    : 'border-transparent font-medium text-text hover:bg-surface-2 dark:text-text-dark dark:hover:bg-surface-2dark'
                }`}
              >
                <span className="flex-1 text-left">{v.label}</span>
                <span className={`text-xs font-semibold ${active ? '' : 'text-text-muted dark:text-text-muted-dark'}`}>
                  {counts[v.key]}
                </span>
              </button>
            );
          })}

          {/* Nhãn */}
          {tags.length > 0 && (
            <>
              <div className="px-2 pb-1.5 pt-4 text-[10.5px] font-bold tracking-[0.09em] text-text-muted dark:text-text-muted-dark">
                NHÃN
              </div>
              {tags.map((t) => {
                const active = activeTag === t.name;
                return (
                  <button
                    key={t.name}
                    onClick={() => onTag(active ? null : t.name)}
                    aria-pressed={active}
                    className={`flex items-center gap-2.5 rounded-[9px] px-2.5 py-1.5 ${
                      active ? 'bg-primary-soft dark:bg-primary-soft-dark' : 'hover:bg-surface-2 dark:hover:bg-surface-2dark'
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: tagColor(t.name) }} />
                    <span className="flex-1 text-left text-[13.5px] font-medium text-text dark:text-text-dark">
                      {t.name}
                    </span>
                    <span className="text-xs text-text-muted dark:text-text-muted-dark">{t.count}</span>
                  </button>
                );
              })}
            </>
          )}
        </>
      )}
```

Phần "Tài khoản" ở cuối file giữ nguyên, không đổi.

- [ ] **Step 2: Sửa `src/pages/AppPage.tsx` — thêm state `page` + render `PlanPage`**

Thêm import (sau dòng `import { ErrorBanner } from '../components/ErrorBanner';`):

```tsx
import { PlanPage } from '../components/PlanPage';

type Page = 'todos' | 'plan';
```

Thêm state `page` ngay sau dòng khai báo `const [view, setView] = useState<SmartView>('all');`:

```tsx
  const [page, setPage] = useState<Page>('todos');
```

Truyền `page`/`onPage` cho `<Sidebar>` (sửa lời gọi hiện có):

```tsx
      <Sidebar
        page={page}
        onPage={setPage}
        view={view}
        onView={setView}
        counts={counts}
        tags={tagCounts}
        activeTag={tag}
        onTag={setTag}
        userEmail={userEmail}
        onSignOut={handleSignOut}
      />
```

Bọc toàn bộ nội dung hiện có bên trong `<main>` (từ div "Top bar" tới hết div chứa `visible`/`TodoForm`/`TodoList`/`KanbanBoard`) trong nhánh `page === 'todos'`, và thêm nhánh `PlanPage` khi `page === 'plan'`. Thay khối `<main>...</main>` hiện tại (dòng 150-247 gốc) bằng:

```tsx
      <main className="flex min-w-0 flex-1 flex-col">
        {page === 'plan' ? (
          <div className="flex-1 overflow-auto p-5 sm:p-6">
            <PlanPage
              userId={userId}
              todos={todos}
              today={today}
              onToggleTodo={toggleDone}
              onUpdateTodo={updateTodo}
              onDeleteTodo={removeTodo}
              onReorderTodos={reorderGroup}
            />
          </div>
        ) : (
          <>
            {/* Top bar */}
            <div className="flex flex-none flex-wrap items-center gap-3 bg-surface px-5 py-3 shadow-soft dark:bg-surface-dark dark:shadow-soft-dark">
              <div className="flex min-w-[180px] max-w-[380px] flex-1">
                <SearchBar value={query} onChange={setQuery} />
              </div>
              <FilterBar
                priority={priority}
                onPriority={setPriority}
                tag={tag}
                onTag={setTag}
                tags={tagCounts.map((t) => t.name)}
              />
              <div className="flex gap-0.5 rounded-lg border border-border bg-surface-2 p-0.5 dark:border-border-dark dark:bg-surface-2dark">
                {modeBtn('list', 'Danh sách')}
                {modeBtn('board', 'Bảng')}
              </div>
              <ThemeToggle theme={theme} onToggle={toggleTheme} />
            </div>

            <div className="flex flex-1 flex-col gap-4 overflow-auto p-5 sm:p-6">
              {/* Smart views cho mobile (sidebar ẩn) */}
              <div className="flex gap-2 overflow-x-auto md:hidden">
                {SMART_VIEWS.map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    aria-current={view === v ? 'page' : undefined}
                    className={`flex-none rounded-lg px-3 py-1.5 text-sm font-medium ${
                      view === v
                        ? 'bg-primary-soft text-primary dark:bg-primary-soft-dark dark:text-primary-dark'
                        : 'bg-surface-2 text-text-muted dark:bg-surface-2dark dark:text-text-muted-dark'
                    }`}
                  >
                    {VIEW_LABEL[v]} ({counts[v]})
                  </button>
                ))}
              </div>

              {/* Tiêu đề view */}
              <div>
                <div className="text-[22px] font-bold tracking-tight text-text dark:text-text-dark">
                  {VIEW_LABEL[view]}
                </div>
                <div className="mt-0.5 text-[13px] text-text-muted dark:text-text-muted-dark">
                  {visible.length} việc
                </div>
              </div>

              {error && <ErrorBanner message={error} onClose={clearError} />}
              {authError && <ErrorBanner message={authError} onClose={() => setAuthError(null)} />}

              <TodoForm onAdd={addTodo} />

              {loading ? (
                <p className="py-8 text-center text-sm text-text-muted dark:text-text-muted-dark">Đang tải…</p>
              ) : mode === 'board' ? (
                <KanbanBoard todos={visible} today={today} onChangePriority={changePriority} onToggle={toggleDone} />
              ) : visible.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-text-muted dark:border-border-dark dark:text-text-muted-dark">
                  Chưa có việc nào ở đây.
                </p>
              ) : (
                <div className="flex flex-col gap-5">
                  {active.length > 0 && (
                    <section className="flex flex-col gap-2">
                      <div className="text-[10.5px] font-bold tracking-[0.09em] text-text-muted dark:text-text-muted-dark">
                        CẦN LÀM
                      </div>
                      <TodoList
                        todos={active}
                        today={today}
                        onToggle={toggleDone}
                        onUpdate={updateTodo}
                        onDelete={removeTodo}
                        onReorder={reorderGroup}
                      />
                    </section>
                  )}
                  {done.length > 0 && (
                    <section className="flex flex-col gap-2">
                      <div className="text-[10.5px] font-bold tracking-[0.09em] text-text-muted dark:text-text-muted-dark">
                        ĐÃ XONG
                      </div>
                      <TodoList
                        todos={done}
                        today={today}
                        onToggle={toggleDone}
                        onUpdate={updateTodo}
                        onDelete={removeTodo}
                        onReorder={reorderGroup}
                      />
                    </section>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </main>
```

- [ ] **Step 3: Chạy build**

Run: `npm run build`
Expected: build thành công, không có lỗi TypeScript (props `Sidebar` khớp, `PlanPage` khớp).

- [ ] **Step 4: Commit**

```bash
git add src/components/Sidebar.tsx src/pages/AppPage.tsx
git commit -m "feat: thêm tab Kế hoạch vào điều hướng chính"
```

---

### Task 10: Xác minh cuối cùng

**Files:** không tạo/sửa file mới — chỉ chạy kiểm thử + kiểm thử thủ công.

- [ ] **Step 1: Chạy toàn bộ test suite**

Run: `npm test`
Expected: tất cả test pass (bao gồm `goalFilters.test.ts` mới + `todoFilters.test.ts`, `recurrence.test.ts`, `theme.test.ts` cũ).

- [ ] **Step 2: Chạy build production**

Run: `npm run build`
Expected: build thành công, không có lỗi/cảnh báo TypeScript.

- [ ] **Step 3: Chạy migration thủ công lên Supabase (bắt buộc trước khi test thủ công)**

Mở Supabase Dashboard của project → SQL Editor → chạy toàn bộ khối SQL đã thêm ở Task 1 (bảng `goals` + RLS + realtime). Đây là bước thủ công bắt buộc — tính năng sẽ lỗi khi lưu mục tiêu nếu bỏ qua bước này (giống bài học từ Phase 2a).

- [ ] **Step 4: Kiểm thử thủ công qua dev server**

Run: `npm run dev`, mở app, đăng nhập, vào tab "Kế hoạch", rồi kiểm tra từng ý:
- Tạo mục tiêu ở cả 4 tầng (5 Năm/Năm/Tháng/Tuần), tick hoàn thành, xác nhận gạch ngang.
- Chuyển kỳ qua ranh giới năm ở tầng Tháng (từ Tháng 12 sang Tháng 1 năm sau) bằng nút `‹ ›`, xác nhận nhãn kỳ đổi đúng.
- Ở tầng Tháng, hover (chuột) vào 1 ô ngày có việc — xác nhận tooltip hiện đúng danh sách việc trong ngày.
- Bấm vào 1 ô ngày bất kỳ — xác nhận chuyển sang tầng Ngày đúng ngày đó, thấy đúng danh sách việc (`TodoList` quen thuộc).
- Mở DevTools, chuyển sang chế độ responsive (viewport điện thoại), chạm vào 1 ô ngày ở tầng Tháng — xác nhận vào thẳng tầng Ngày, không có tooltip che màn hình.
- Xóa 1 mục tiêu, xác nhận biến mất khỏi danh sách ngay (không cần tải lại trang).

- [ ] **Step 5: Commit cuối (nếu có chỉnh sửa phát sinh từ bước kiểm thử thủ công)**

Nếu bước 4 phát hiện lỗi cần sửa, sửa trực tiếp trong các file liên quan rồi:

```bash
git add -A
git commit -m "fix: xử lý lỗi phát hiện khi kiểm thử thủ công tab Kế hoạch"
```

Nếu không có gì cần sửa, bỏ qua bước này — không tạo commit rỗng.
