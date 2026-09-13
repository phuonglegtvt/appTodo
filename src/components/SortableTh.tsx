import type { SortState } from '../lib/tableSort';

interface Props<K extends string> {
  colKey: K;
  label: string;
  sort: SortState<K> | null;
  onSort: (key: K) => void;
  className?: string;
}

/**
 * Ô tiêu đề bấm được để sort.
 *
 * Dùng `inline-flex` (không phải `flex`) để ô vẫn theo `text-left`/`text-right`
 * của `<th>` cha — bảng Vàng canh phải, hai bảng kia canh trái, không cần thêm prop.
 *
 * `aria-sort` đặt trên `<th>` chứ không trên `<button>`: đó là chỗ chuẩn ARIA
 * quy định, và là thứ duy nhất cho người dùng screen reader biết bảng đang sort
 * theo cột nào — mũi tên ↑↓ họ không thấy.
 */
export function SortableTh<K extends string>({ colKey, label, sort, onSort, className }: Props<K>) {
  const dangSort = sort !== null && sort.key === colKey;
  const chieu = dangSort ? sort.dir : null;

  return (
    <th
      className={className}
      aria-sort={chieu === 'asc' ? 'ascending' : chieu === 'desc' ? 'descending' : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort(colKey)}
        title={
          chieu === null
            ? `Sắp xếp theo ${label}`
            : chieu === 'asc'
              ? `${label}: đang tăng dần — bấm để giảm dần`
              : `${label}: đang giảm dần — bấm để bỏ sắp xếp`
        }
        className={`inline-flex items-center gap-1 rounded transition-colors hover:text-primary dark:hover:text-primary-dark ${
          dangSort ? 'text-primary dark:text-primary-dark' : ''
        }`}
      >
        <span>{label}</span>
        {/* Luôn chiếm chỗ để bấm sort không làm cả bảng nhích ngang. */}
        <span aria-hidden="true" className="w-2 text-[10px] leading-none">
          {chieu === 'asc' ? '↑' : chieu === 'desc' ? '↓' : ''}
        </span>
      </button>
    </th>
  );
}
