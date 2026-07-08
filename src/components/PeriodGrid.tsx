import { PeriodCell } from './PeriodCell';

export interface CellData {
  key: string;
  label: string;
  doneCount: number;
  totalCount: number;
  tooltipLines: string[];
}

interface Props {
  columns: number;
  leadingBlanks?: number;
  cells: CellData[];
  onSelect: (key: string) => void;
}

/** Lưới ô con của 1 tầng (năm→tháng, tháng→ngày thật theo lịch, tuần→7 ngày). */
export function PeriodGrid({ columns, leadingBlanks = 0, cells, onSelect }: Props) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {Array.from({ length: leadingBlanks }).map((_, i) => (
        <div key={`blank-${i}`} />
      ))}
      {cells.map((c) => (
        <PeriodCell
          key={c.key}
          label={c.label}
          doneCount={c.doneCount}
          totalCount={c.totalCount}
          tooltipLines={c.tooltipLines}
          onSelect={() => onSelect(c.key)}
        />
      ))}
    </div>
  );
}
