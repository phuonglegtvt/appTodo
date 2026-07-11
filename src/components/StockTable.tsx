import type { Stock, StockUpdate, StockGroup } from '../types/stock';
import { StockRow } from './StockRow';

const GROUP_META: Record<StockGroup, { label: string; head: string }> = {
  attack: { label: 'Tấn công (rủi ro cao)', head: 'text-red-600 dark:text-red-400' },
  balance: { label: 'Cân bằng (rủi ro trung bình)', head: 'text-green-600 dark:text-green-400' },
  defense: { label: 'Phòng thủ (rủi ro thấp)', head: 'text-blue-600 dark:text-blue-400' },
};

const GROUPS: StockGroup[] = ['attack', 'balance', 'defense'];

interface Props {
  stocks: Stock[];
  onUpdate: (id: string, patch: StockUpdate) => void;
  onDelete: (id: string) => void;
}

const th = 'px-2 py-2 text-left text-[11px] font-bold tracking-[0.06em] text-text-muted dark:text-text-muted-dark';

/** Bảng cổ phiếu gom theo 3 nhóm rủi ro, mỗi nhóm một khối có tiêu đề màu. */
export function StockTable({ stocks, onUpdate, onDelete }: Props) {
  return (
    <div className="flex flex-col gap-5">
      {GROUPS.map((g) => {
        const rows = stocks.filter((s) => s.group === g);
        if (rows.length === 0) return null;
        return (
          <section key={g} className="flex flex-col gap-1.5">
            <div className={`text-[12px] font-bold ${GROUP_META[g].head}`}>{GROUP_META[g].label}</div>
            <div className="overflow-x-auto rounded-xl border border-border dark:border-border-dark">
              <table className="w-full min-w-[760px] border-collapse">
                <thead>
                  <tr className="bg-surface-2 dark:bg-surface-2dark">
                    <th className={th}>Mã</th>
                    <th className={th}>Tên công ty</th>
                    <th className={th}>Giá ngưỡng</th>
                    <th className={th}>Giá bảo vệ</th>
                    <th className={th}>Giá hiện tại</th>
                    <th className={th}>Cổ tức</th>
                    <th className={th}>Tỷ suất</th>
                    <th className={th}>Đã đầu tư</th>
                    <th className={th}></th>
                  </tr>
                </thead>
                <tbody className="bg-surface dark:bg-surface-dark">
                  {rows.map((s) => (
                    <StockRow key={s.id} stock={s} onUpdate={onUpdate} onDelete={onDelete} />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
