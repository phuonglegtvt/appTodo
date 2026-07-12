import type { Todo } from '../types/todo';
import type { TodoCellData } from '../lib/todoCell';
import { TodoCell } from './TodoCell';

interface Props {
  cells: TodoCellData[];
  onSelect: (key: string) => void;
  onToggleTodo: (id: string, done: boolean) => void;
  onDeleteTodo: (id: string) => void;
  onEditTodo: (todo: Todo) => void;
  onAddTodo: (monthKey: string, title: string) => void;
}

/** Lưới 12 ô tháng (3 cột) cho chế độ Năm — mỗi ô liệt kê việc, có checkbox/✕/thêm. */
export function MonthGrid({ cells, onSelect, onToggleTodo, onDeleteTodo, onEditTodo, onAddTodo }: Props) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
      {cells.map((c) => (
        <TodoCell
          key={c.key}
          data={c}
          showDate
          onSelect={() => onSelect(c.key)}
          onToggleTodo={onToggleTodo}
          onDeleteTodo={onDeleteTodo}
          onEditTodo={onEditTodo}
          onAdd={(title) => onAddTodo(c.key, title)}
        />
      ))}
    </div>
  );
}
