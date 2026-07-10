import type { MonthCellData } from '../lib/monthCell';
import { MonthCell } from './MonthCell';

interface Props {
  cells: MonthCellData[];
  onSelect: (key: string) => void;
}

/** Lưới 12 ô tháng (4 cột) cho chế độ Năm — mỗi ô liệt kê việc trong tháng. */
export function MonthGrid({ cells, onSelect }: Props) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
      {cells.map((c) => (
        <MonthCell key={c.key} data={c} onSelect={() => onSelect(c.key)} />
      ))}
    </div>
  );
}
