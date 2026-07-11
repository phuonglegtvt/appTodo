import { useMemo, useState } from 'react';
import { useGoals } from '../hooks/useGoals';
import {
  getPeriodRange,
  getPeriodKey,
  getViewPeriodKey,
  getChildPeriods,
  shiftPeriod,
} from '../lib/goalFilters';
import type { Todo, NewTodo, TodoUpdate } from '../types/todo';
import type { ViewHorizon } from '../types/goal';
import { HorizonSwitcher } from './HorizonSwitcher';
import { MonthGrid } from './MonthGrid';
import { YearGrid } from './YearGrid';
import { buildMonthCells, buildYearCells } from '../lib/todoCell';
import type { TodoCellData } from '../lib/todoCell';
import { DayGrid } from './DayGrid';
import type { DayCellData } from './DayGrid';
import { GoalBoard } from './GoalBoard';
import { TodoList } from './TodoList';
import { ErrorBanner } from './ErrorBanner';
import { sortByDoneThenOrder } from '../lib/todoFilters';

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

const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

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
export function PlanPage({ userId, todos, today, onAddTodo, onToggleTodo, onUpdateTodo, onDeleteTodo, onReorderTodos }: Props) {
  const { goals, loading, error, addGoal, updateGoal, deleteGoal, clearError } = useGoals(userId);

  const [horizon, setHorizon] = useState<ViewHorizon>('month');
  const [periodKey, setPeriodKey] = useState<string>(() => getPeriodKey('month', today));

  function handleHorizon(newHorizon: ViewHorizon) {
    setHorizon(newHorizon);
    setPeriodKey(getViewPeriodKey(newHorizon, today));
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
    }
  }

  function handleAddOnDay(date: string, title: string) {
    onAddTodo({ title, due_date: date, priority: 'medium', tags: [], recurrence: 'none' });
  }

  function handleAddOnMonth(monthKey: string, title: string) {
    // Ô tháng không có ngày cụ thể → gán ngày 01 của tháng để việc hiện trong ô.
    onAddTodo({ title, due_date: `${monthKey}-01`, priority: 'medium', tags: [], recurrence: 'none' });
  }

  function handleOpenFull(date: string) {
    setHorizon('day');
    setPeriodKey(date);
  }

  const dayTodos = useMemo(
    () => (horizon === 'day' ? sortByDoneThenOrder(todos.filter((t) => t.due_date === periodKey)) : []),
    [todos, horizon, periodKey],
  );

  const monthCells = useMemo(
    (): TodoCellData[] | null => (horizon === 'year' ? buildMonthCells(todos, periodKey) : null),
    [horizon, periodKey, todos],
  );

  const yearCells = useMemo(
    (): TodoCellData[] | null => (horizon === 'five_year' ? buildYearCells(todos, periodKey) : null),
    [horizon, periodKey, todos],
  );

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
      todos: sortByDoneThenOrder(todos.filter((t) => t.due_date === date)),
    }));
    return { leadingBlanks, cells };
  }, [horizon, periodKey, todos]);

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

      <GoalBoard goals={goals} onAdd={(title) => addGoal({ title })} onUpdate={updateGoal} onDelete={deleteGoal} />

      {horizon === 'day' ? (
        <TodoList
          todos={dayTodos}
          today={today}
          onToggle={onToggleTodo}
          onUpdate={onUpdateTodo}
          onDelete={onDeleteTodo}
          onReorder={onReorderTodos}
        />
      ) : loading ? (
        <p className="py-8 text-center text-sm text-text-muted dark:text-text-muted-dark">Đang tải…</p>
      ) : (
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
              maxLines={3}
              onAdd={handleAddOnDay}
              onToggle={onToggleTodo}
              onDelete={onDeleteTodo}
              onOpenFull={handleOpenFull}
            />
          ) : monthCells ? (
            <MonthGrid
              cells={monthCells}
              onSelect={handleSelectCell}
              onToggleTodo={onToggleTodo}
              onDeleteTodo={onDeleteTodo}
              onAddTodo={handleAddOnMonth}
            />
          ) : yearCells ? (
            <YearGrid
              cells={yearCells}
              onSelect={handleSelectCell}
              onToggleTodo={onToggleTodo}
              onDeleteTodo={onDeleteTodo}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
