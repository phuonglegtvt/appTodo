import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { Todo, TodoUpdate } from '../types/todo';
import { TodoItem } from './TodoItem';

interface Props {
  todos: Todo[];
  today: string;
  onToggle: (id: string, done: boolean) => void;
  onUpdate: (id: string, patch: TodoUpdate) => void;
  onDelete: (id: string) => void;
  onReorder: (ordered: Todo[]) => void;
  defaultShowNotes?: boolean;
}

/** Danh sách việc kéo-thả sắp xếp được (dnd-kit). Nhận dữ liệu đã lọc sẵn. */
export function TodoList({ todos, today, onToggle, onUpdate, onDelete, onReorder, defaultShowNotes }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = todos.findIndex((t) => t.id === active.id);
    const newIndex = todos.findIndex((t) => t.id === over.id);
    onReorder(arrayMove(todos, oldIndex, newIndex));
  }

  if (todos.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-text-muted dark:border-border-dark dark:text-text-muted-dark">
        Chưa có việc nào ở đây.
      </p>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={todos.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-2">
          {todos.map((t) => (
            <TodoItem
              key={t.id}
              todo={t}
              today={today}
              onToggle={onToggle}
              onUpdate={onUpdate}
              onDelete={onDelete}
              defaultShowNotes={defaultShowNotes}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
