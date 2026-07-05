import type { Priority } from '../types/todo';

const LABEL: Record<Priority, string> = { high: 'Cao', medium: 'Trung bình', low: 'Thấp' };

/** Màu chấm + nền pill mềm cho từng mức ưu tiên (bám design tokens). */
const STYLE: Record<Priority, { pill: string; dot: string }> = {
  high: {
    pill: 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-200',
    dot: '#E5484D',
  },
  medium: {
    pill: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200',
    dot: '#EAB308',
  },
  low: {
    pill: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200',
    dot: '#12A150',
  },
};

/** Badge ưu tiên dạng pill: chấm màu + nhãn tiếng Việt. */
export function PriorityBadge({ priority }: { priority: Priority }) {
  const { pill, dot } = STYLE[priority];
  return (
    <span className={`pill ${pill}`}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />
      {LABEL[priority]}
    </span>
  );
}
