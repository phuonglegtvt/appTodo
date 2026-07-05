import type { Priority } from '../types/todo';

interface Props {
  priority: Priority | 'all';
  onPriority: (p: Priority | 'all') => void;
  tag: string | null;
  onTag: (t: string | null) => void;
  tags: string[];
}

/**
 * Bộ lọc trên top bar: theo Ưu tiên và Nhãn (bám mockup nút "Ưu tiên ▾ / Nhãn ▾").
 * Smart view (Hôm nay/Sắp tới/…) nằm ở Sidebar, không ở đây.
 */
const baseSelect =
  'cursor-pointer rounded-full border px-3 py-1.5 text-[12.5px] font-medium outline-none transition-colors duration-150';
const idleSelect =
  'border-border bg-surface-2 text-text-muted dark:border-border-dark dark:bg-surface-2dark dark:text-text-muted-dark';
const activeSelect =
  'border-primary bg-primary-soft text-primary dark:border-primary-dark dark:bg-primary-soft-dark dark:text-primary-dark';

export function FilterBar({ priority, onPriority, tag, onTag, tags }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={priority}
        onChange={(e) => onPriority(e.target.value as Priority | 'all')}
        className={`${baseSelect} ${priority === 'all' ? idleSelect : activeSelect}`}
        aria-label="Lọc theo ưu tiên"
      >
        <option value="all">Mọi ưu tiên</option>
        <option value="high">Cao</option>
        <option value="medium">Trung bình</option>
        <option value="low">Thấp</option>
      </select>

      <select
        value={tag ?? ''}
        onChange={(e) => onTag(e.target.value || null)}
        className={`${baseSelect} ${tag ? activeSelect : idleSelect}`}
        aria-label="Lọc theo nhãn"
      >
        <option value="">Mọi nhãn</option>
        {tags.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    </div>
  );
}
