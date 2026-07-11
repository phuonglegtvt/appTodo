import type { TodoCellData } from '../lib/todoCell';
import { TodoCell } from './TodoCell';

interface Props {
  cells: TodoCellData[];
  onSelect: (key: string) => void;
  onToggleTodo: (id: string, done: boolean) => void;
  onDeleteTodo: (id: string) => void;
}

/** Lưới 5 ô năm (3 cột) cho chế độ 5 Năm — mỗi ô liệt kê việc gần nhất trong năm. */
export function YearGrid({ cells, onSelect, onToggleTodo, onDeleteTodo }: Props) {
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
        />
      ))}
    </div>
  );
}
