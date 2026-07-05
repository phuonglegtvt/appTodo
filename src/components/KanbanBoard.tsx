import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Priority, Todo } from '../types/todo';
import { KanbanCard } from './KanbanCard';

interface Props {
  todos: Todo[];
  today: string;
  onChangePriority: (id: string, priority: Priority) => void;
  onToggle: (id: string, done: boolean) => void;
}

const COLUMNS: { key: Priority; name: string; color: string }[] = [
  { key: 'high', name: 'Cao', color: '#E5484D' },
  { key: 'medium', name: 'Trung bình', color: '#EAB308' },
  { key: 'low', name: 'Thấp', color: '#12A150' },
];

const PRIORITIES: Priority[] = ['high', 'medium', 'low'];
const isPriority = (v: string): v is Priority => (PRIORITIES as string[]).includes(v);

/** Một cột ưu tiên: nhận thả (droppable) kể cả khi rỗng. */
function Column({
  column,
  todos,
  today,
  onToggle,
}: {
  column: (typeof COLUMNS)[number];
  todos: Todo[];
  today: string;
  onToggle: (id: string, done: boolean) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.key });
  return (
    <div
      ref={setNodeRef}
      className={`flex max-h-full w-[280px] flex-none flex-col gap-2.5 rounded-xl border p-3.5 transition-colors ${
        isOver
          ? 'border-primary bg-primary-soft dark:border-primary-dark dark:bg-primary-soft-dark'
          : 'border-border bg-surface-2 shadow-soft dark:border-border-dark dark:bg-surface-2dark dark:shadow-soft-dark'
      }`}
    >
      <div className="flex items-center gap-2 px-1 py-0.5">
        <span className="h-[9px] w-[9px] rounded-full" style={{ background: column.color }} />
        <span className="text-[13.5px] font-bold text-text dark:text-text-dark">{column.name}</span>
        <span className="rounded-full border border-border bg-surface px-2 text-xs font-semibold text-text-muted dark:border-border-dark dark:bg-surface-dark dark:text-text-muted-dark">
          {todos.length}
        </span>
      </div>

      <SortableContext items={todos.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-[40px] flex-col gap-2.5 overflow-y-auto pr-0.5">
          {todos.map((t) => (
            <KanbanCard key={t.id} todo={t} today={today} onToggle={onToggle} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

/** Bảng Kanban: 3 cột theo ưu tiên. Kéo thẻ sang cột khác = đổi mức ưu tiên. */
export function KanbanBoard({ todos, today, onChangePriority, onToggle }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;
    const activeTodo = todos.find((t) => t.id === active.id);
    if (!activeTodo) return;

    // Cột đích: over.id là key cột (thả vào vùng trống) hoặc id thẻ (thả lên thẻ khác).
    const overId = String(over.id);
    const targetPriority = isPriority(overId)
      ? overId
      : todos.find((t) => t.id === overId)?.priority;
    if (!targetPriority || targetPriority === activeTodo.priority) return;

    onChangePriority(String(active.id), targetPriority);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <div className="flex items-start gap-4 overflow-x-auto pb-2">
        {COLUMNS.map((col) => (
          <Column
            key={col.key}
            column={col}
            todos={todos.filter((t) => t.priority === col.key)}
            today={today}
            onToggle={onToggle}
          />
        ))}
      </div>
    </DndContext>
  );
}
