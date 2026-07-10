import { useMemo, useState } from 'react';
import { useGoals } from '../hooks/useGoals';
import {
  getPeriodRange,
  getPeriodKey,
  getChildPeriods,
  countTodosInRange,
  shiftPeriod,
} from '../lib/goalFilters';
import type { Todo, NewTodo, TodoUpdate } from '../types/todo';
import type { Horizon, ViewHorizon } from '../types/goal';
import { HorizonSwitcher } from './HorizonSwitcher';
import { PeriodGrid } from './PeriodGrid';
import type { CellData } from './PeriodGrid';
import { DayGrid } from './DayGrid';
import type { DayCellData } from './DayGrid';
import { GoalList } from './GoalList';
import { TodoList } from './TodoList';
import { ErrorBanner } from './ErrorBanner';

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
export function PlanPage({ userId, todos, today, onAddTodo, onToggleTodo, onUpdateTodo, onDeleteTodo, onReorderTodos }: Props) {
  const { goals, loading, error, addGoal, updateGoal, deleteGoal, clearError } = useGoals(userId);

  const [horizon, setHorizon] = useState<ViewHorizon>('month');
  const [periodKey, setPeriodKey] = useState<string>(() => getPeriodKey('month', today));
  const [openDay, setOpenDay] = useState<string | null>(null);

  function handleHorizon(newHorizon: ViewHorizon) {
    setOpenDay(null);
    const anchor = anchorDate(horizon, periodKey);
    setHorizon(newHorizon);
    setPeriodKey(newHorizon === 'day' ? anchor : getPeriodKey(newHorizon, anchor));
  }

  function handlePrev() {
    setOpenDay(null);
    setPeriodKey(horizon === 'day' ? shiftDay(periodKey, -1) : shiftPeriod(horizon, periodKey, -1));
  }

  function handleNext() {
    setOpenDay(null);
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

  function handleOpenFull(date: string) {
    setOpenDay(null);
    setHorizon('day');
    setPeriodKey(date);
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
      )}
    </div>
  );
}
