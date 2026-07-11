import type { TodoCellData } from '../lib/todoCell';
import { MonthCell } from './MonthCell';

interface Props {
  cells: TodoCellData[];
  onSelect: (key: string) => void;
  onToggleTodo: (id: string, done: boolean) => void;
}

/** Lưới 12 ô tháng (3 cột) cho chế độ Năm — mỗi ô liệt kê việc trong tháng. */
export function MonthGrid({ cells, onSelect, onToggleTodo }: Props) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
      {cells.map((c) => (
        <MonthCell key={c.key} data={c} onSelect={() => onSelect(c.key)} onToggleTodo={onToggleTodo} />
      ))}
    </div>
  );
}
