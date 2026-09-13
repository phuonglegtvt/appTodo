import { CashEntryRow } from './CashEntryRow';
import type { CashEntry, CashEntryUpdate } from '../types/cashEntry';

interface Props {
  entries: CashEntry[];
  onUpdate: (id: string, patch: CashEntryUpdate) => void;
  onDelete: (id: string) => void;
}

const th = 'px-2 py-2 text-left text-[11px] font-bold tracking-[0.06em] text-text-muted dark:text-text-muted-dark';

/** Danh sách khoản thu–chi của tháng đang xem, mới nhất lên đầu. */
export function CashEntryList({ entries, onUpdate, onDelete }: Props) {
  if (entries.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-text-muted dark:border-border-dark dark:text-text-muted-dark">
        Tháng này chưa có khoản nào. Thêm ở form phía trên.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border dark:border-border-dark">
      <table className="w-full min-w-[720px] border-collapse">
        <thead>
          <tr className="bg-surface-2 dark:bg-surface-2dark">
            <th className={th}>Ngày</th>
            <th className={th}>Loại</th>
            <th className={th}>Danh mục</th>
            <th className={th}>Ghi chú</th>
            <th className={`${th} text-right`}>Số tiền</th>
            <th className={th} />
          </tr>
        </thead>
        <tbody className="bg-surface dark:bg-surface-dark">
          {entries.map((e) => (
            <CashEntryRow key={e.id} entry={e} onUpdate={onUpdate} onDelete={onDelete} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
