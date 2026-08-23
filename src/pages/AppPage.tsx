import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useTodos } from '../hooks/useTodos';
import type { Theme } from '../lib/theme';
import type { Priority, SmartView, Todo } from '../types/todo';
import {
  applySmartView,
  searchTodos,
  filterByPriority,
  filterByTag,
  sortByOrder,
  allTags,
} from '../lib/todoFilters';
import { Sidebar } from '../components/Sidebar';
import { TodoForm } from '../components/TodoForm';
import { TodoList } from '../components/TodoList';
import { KanbanBoard } from '../components/KanbanBoard';
import { SearchBar } from '../components/SearchBar';
import { FilterBar } from '../components/FilterBar';
import { ThemeToggle } from '../components/ThemeToggle';
import { ErrorBanner } from '../components/ErrorBanner';
import { PlanPage } from '../components/PlanPage';
import { StocksPage } from '../components/StocksPage';
import { CryptoPage } from '../components/CryptoPage';
import { PortfolioPage } from '../components/PortfolioPage';
import { recurringToggle } from './recurringToggle';
import type { Page } from '../types/page';

type ViewMode = 'list' | 'board';

const VIEW_LABEL: Record<SmartView, string> = {
  today: 'Hôm nay',
  upcoming: 'Sắp tới',
  all: 'Tất cả',
  done: 'Đã xong',
};

const SMART_VIEWS: SmartView[] = ['today', 'upcoming', 'all', 'done'];

interface AppPageProps {
  userId: string;
  userEmail: string;
  theme: Theme;
  toggleTheme: () => void;
}

export function AppPage({ userId, userEmail, theme, toggleTheme }: AppPageProps) {
  const { todos, loading, error, addTodo, updateTodo, deleteTodo, reorderTodos, clearError } = useTodos(userId);

  const [page, setPage] = useState<Page>('todos');
  const [view, setView] = useState<SmartView>('all');
  const [mode, setMode] = useState<ViewMode>('list');
  const [query, setQuery] = useState('');
  const [priority, setPriority] = useState<Priority | 'all'>('all');
  const [tag, setTag] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  // Ngày hôm nay theo giờ ĐỊA PHƯƠNG (không dùng toISOString vì nó theo UTC —
  // với giờ VN (UTC+7) lúc 0–7h sáng sẽ ra "hôm qua", làm smart view phân loại sai).
  // 'en-CA' cho định dạng YYYY-MM-DD.
  const today = new Date().toLocaleDateString('en-CA');

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

  const visible = useMemo(() => {
    let list = applySmartView(todosForList, view, today);
    list = searchTodos(list, query);
    list = filterByPriority(list, priority);
    list = filterByTag(list, tag);
    return sortByOrder(list);
  }, [todosForList, view, query, priority, tag, today]);

  // Số đếm cho smart views + nhãn (dùng toàn bộ todos, không phụ thuộc bộ lọc hiện tại).
  const counts = useMemo(
    () =>
      SMART_VIEWS.reduce(
        (acc, v) => {
          acc[v] = applySmartView(todosForList, v, today).length;
          return acc;
        },
        {} as Record<SmartView, number>,
      ),
    [todosForList, today],
  );

  const tagCounts = useMemo(
    () => allTags(todos).map((name) => ({ name, count: todos.filter((t) => t.tags.includes(name)).length })),
    [todos],
  );

  const active = visible.filter((t) => !t.is_done);
  const done = visible.filter((t) => t.is_done);

  // Kéo-thả chỉ sắp xếp trong một nhóm đang hiển thị (có thể đã bị lọc). Ta ghép thứ tự
  // mới của nhóm đó trở lại TOÀN BỘ todos rồi mới gọi reorderTodos — vì reorderTodos
  // làm setTodos(ordered) (thay thế cả mảng) và chỉ lưu sort_order cho các dòng nhận được.
  // Nếu chỉ truyền tập con đã lọc, các việc đang bị ẩn sẽ biến mất khỏi state và
  // sort_order dưới DB bị trùng. Giữ nguyên vị trí các item không bị kéo.
  const reorderGroup = (orderedSubset: Todo[]) => {
    const movedIds = new Set(orderedSubset.map((t) => t.id));
    let i = 0;
    const fullOrder = sortByOrder(todos).map((t) => (movedIds.has(t.id) ? orderedSubset[i++] : t));
    reorderTodos(fullOrder);
  };

  // Việc lặp: done tính theo completed_dates (theo ngày). Việc thường giữ is_done.
  const toggleDone = (id: string, isDone: boolean) => {
    const todo = todos.find((t) => t.id === id);
    if (todo && todo.recurrence !== 'none') {
      recurringToggle(todo, updateTodo);
      return;
    }
    updateTodo(id, { is_done: isDone });
  };
  const changePriority = (id: string, p: Priority) => updateTodo(id, { priority: p });
  const removeTodo = (id: string) => {
    if (confirm('Xóa việc này?')) deleteTodo(id);
  };
  async function handleSignOut() {
    setAuthError(null);
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Lỗi đăng xuất:', error);
      setAuthError('Không đăng xuất được: ' + error.message);
    }
  }

  const modeBtn = (m: ViewMode, label: string) => (
    <button
      onClick={() => setMode(m)}
      aria-pressed={mode === m}
      className={`rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
        mode === m
          ? 'bg-surface text-text shadow-sm dark:bg-surface-dark dark:text-text-dark'
          : 'text-text-muted dark:text-text-muted-dark'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-bg text-text dark:bg-bg-dark dark:text-text-dark">
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

      <main className="flex min-w-0 flex-1 flex-col">
        {page === 'portfolio' ? (
          <div className="flex flex-1 flex-col overflow-auto p-5 sm:p-6">
            <PortfolioPage userId={userId} />
          </div>
        ) : page === 'crypto' ? (
          <CryptoPage userId={userId} />
        ) : page === 'stocks' ? (
          <StocksPage userId={userId} />
        ) : page === 'plan' ? (
          <div className="flex flex-1 flex-col gap-4 overflow-auto p-5 sm:p-6">
            {error && <ErrorBanner message={error} onClose={clearError} />}
            <PlanPage
              userId={userId}
              todos={todos}
              today={today}
              onAddTodo={addTodo}
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
    </div>
  );
}
