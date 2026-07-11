# Year View Current Anchor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Plan tab Year view easier to read and interact with, and make direct horizon tab switches always return to the period containing today.

**Architecture:** Keep the existing Plan tab structure. `PlanPage` owns horizon/period state and passes todo toggle callbacks into the Year view. `MonthGrid` stays a focused layout component, while `MonthCell` owns local expand/collapse state and renders each todo with a checkbox.

**Tech Stack:** React + TypeScript + Vite + Tailwind CSS + Vitest.

## Global Constraints

- UI text remains Vietnamese.
- No schema/data model changes.
- Do not add dependencies.
- Do not silently swallow toggle/save errors; reuse the existing todo update flow.
- Do not create git commits unless the user explicitly asks.

---

## File Structure

- Modify `src/components/PlanPage.tsx`: reset direct horizon changes to `today`, pass `onToggleTodo` to `MonthGrid`.
- Modify `src/components/MonthGrid.tsx`: switch Year view grid to 3 columns and forward toggle callback.
- Modify `src/components/MonthCell.tsx`: render todo rows with checkbox, larger/bolder text, and prevent checkbox interaction from drilling down.
- Optional test target `src/lib/goalFilters.test.ts`: existing `getPeriodKey` tests already cover today-derived period keys; add component-adjacent tests only if a new pure helper is extracted.

### Task 1: Reset Direct Horizon Tab Changes To Today

**Files:**
- Modify: `src/components/PlanPage.tsx`

**Interfaces:**
- Consumes: `today: string`, `getPeriodKey(horizon, date)`.
- Produces: `handleHorizon(newHorizon: ViewHorizon): void` that resets `periodKey` to the period containing `today`.

- [ ] **Step 1: Update `handleHorizon`**

Replace the old anchor-from-current-period behavior with:

```tsx
function handleHorizon(newHorizon: ViewHorizon) {
  setOpenDay(null);
  setHorizon(newHorizon);
  setPeriodKey(newHorizon === 'day' ? today : getPeriodKey(newHorizon, today));
}
```

- [ ] **Step 2: Remove unused helper**

If `anchorDate` becomes unused, remove the `anchorDate` function from `PlanPage.tsx`.

- [ ] **Step 3: Verify TypeScript locally**

Run:

```bash
npm run build
```

Expected: no TypeScript error about unused `anchorDate`.

### Task 2: Add Checkbox Toggle To Month Cells

**Files:**
- Modify: `src/components/PlanPage.tsx`
- Modify: `src/components/MonthGrid.tsx`
- Modify: `src/components/MonthCell.tsx`

**Interfaces:**
- Consumes: `onToggleTodo(id: string, done: boolean)` from `PlanPage`.
- Produces: `MonthGrid` prop `onToggleTodo: (id: string, done: boolean) => void`.
- Produces: `MonthCell` prop `onToggleTodo: (id: string, done: boolean) => void`.

- [ ] **Step 1: Pass toggle callback from `PlanPage`**

Change the Year view render to:

```tsx
<MonthGrid cells={monthCells} onSelect={handleSelectCell} onToggleTodo={onToggleTodo} />
```

- [ ] **Step 2: Extend `MonthGrid` props**

Update `MonthGrid`:

```tsx
interface Props {
  cells: MonthCellData[];
  onSelect: (key: string) => void;
  onToggleTodo: (id: string, done: boolean) => void;
}

export function MonthGrid({ cells, onSelect, onToggleTodo }: Props) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
      {cells.map((c) => (
        <MonthCell
          key={c.key}
          data={c}
          onSelect={() => onSelect(c.key)}
          onToggleTodo={onToggleTodo}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Extend `MonthCell` props**

Update `MonthCell`:

```tsx
interface Props {
  data: MonthCellData;
  onSelect: () => void;
  onToggleTodo: (id: string, done: boolean) => void;
}
```

- [ ] **Step 4: Render todo checkbox rows**

Inside `visible.map`, render each item as a label row:

```tsx
<label
  key={t.id}
  className={`flex min-w-0 items-center gap-1.5 rounded px-1.5 py-0.5 text-[12px] font-medium ${
    t.is_done
      ? 'text-text-muted line-through dark:text-text-muted-dark'
      : 'bg-primary-soft text-primary dark:bg-primary-soft-dark dark:text-primary-dark'
  }`}
>
  <input
    type="checkbox"
    checked={t.is_done}
    onChange={() => onToggleTodo(t.id, !t.is_done)}
    className="h-3.5 w-3.5 shrink-0 accent-primary dark:accent-primary-dark"
  />
  <span className="truncate">{t.title}</span>
</label>
```

This label lives outside the month-title button, so checkbox changes do not trigger `onSelect`.

- [ ] **Step 5: Run focused verification**

Run:

```bash
npm test
```

Expected: all existing tests pass.

### Task 3: Improve Year View Layout And Readability

**Files:**
- Modify: `src/components/MonthGrid.tsx`
- Modify: `src/components/MonthCell.tsx`

**Interfaces:**
- Consumes: existing `MonthCellData`.
- Produces: 3-column Year view with larger todo text.

- [ ] **Step 1: Set grid to 3 columns**

Use:

```tsx
<div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
```

- [ ] **Step 2: Increase cell height and spacing**

Update the cell wrapper to:

```tsx
<div className="flex min-h-[9rem] flex-col gap-1.5 rounded-lg border border-border bg-surface p-2 dark:border-border-dark dark:bg-surface-dark">
```

- [ ] **Step 3: Make header readable**

Use:

```tsx
<span className="text-sm font-semibold text-text dark:text-text-dark">{data.monthLabel}</span>
```

and keep the `done/total` counter as muted helper text.

- [ ] **Step 4: Keep expand/collapse behavior**

Do not change `visibleTodos`; keep default max of 6 visible todos before expansion.

### Task 4: Full Verification

**Files:**
- Verify changed files only with lints, then full commands.

**Interfaces:**
- Produces: confidence that the change builds and existing logic still passes tests.

- [ ] **Step 1: Read IDE lints**

Check diagnostics for:

```text
src/components/PlanPage.tsx
src/components/MonthGrid.tsx
src/components/MonthCell.tsx
```

- [ ] **Step 2: Run tests**

Run:

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Run production build**

Run:

```bash
npm run build
```

Expected: build completes successfully.

- [ ] **Step 4: Manual smoke check**

In the browser, verify:

- Year view is 3 columns x 4 rows.
- Todo text in month cells is larger and bolder.
- Checkbox toggles done state.
- Checkbox does not open Month view.
- Direct horizon tab clicks return to the period containing `today`.
- Prev/next buttons and cell drill-down still work.
