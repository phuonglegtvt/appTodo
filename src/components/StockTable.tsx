import { useState } from 'react';
import type { Stock, StockUpdate, StockGroup } from '../types/stock';
import { StockRow } from './StockRow';
import { SortableTh } from './SortableTh';
import { nextSort, sortRows, type SortState } from '../lib/tableSort';
import { STOCK_COLUMNS, stockSortValue, type StockSortKey } from '../lib/stockSort';

const GROUP_META: Record<StockGroup, { label: string; head: string }> = {
  attack: { label: 'Tấn công (rủi ro cao)', head: 'text-red-600 dark:text-red-400' },
  balance: { label: 'Cân bằng (rủi ro trung bình)', head: 'text-green-600 dark:text-green-400' },
  defense: { label: 'Phòng thủ (rủi ro thấp)', head: 'text-blue-600 dark:text-blue-400' },
  longterm: { label: 'Đầu tư dài hạn', head: 'text-purple-600 dark:text-purple-400' },
};

interface Props {
  stocks: Stock[];
  /** Thứ tự các bảng nhóm (người dùng tự sắp bằng ▲▼). */
  order: StockGroup[];
  onMove: (g: StockGroup, dir: -1 | 1, visible: StockGroup[]) => void;
  onUpdate: (id: string, patch: StockUpdate) => void;
  onDelete: (id: string) => void;
}

const th = 'px-2 py-2 text-left text-[11px] font-bold tracking-[0.06em] text-text-muted dark:text-text-muted-dark';

/** Bảng cổ phiếu gom theo 4 nhóm, mỗi nhóm một khối có tiêu đề màu. */
export function StockTable({ stocks, order, onMove, onUpdate, onDelete }: Props) {
  // MỘT state sort dùng chung cho cả 4 nhóm: bấm "% so đỉnh" thì cả ba khối
  // cùng sắp theo cột đó. Mỗi nhóm một state riêng sẽ cho ra ba bảng sắp khác
  // nhau mà nhìn tiêu đề không phân biệt được.
  //
  // Sort chỉ nằm trong bộ nhớ trang, KHÔNG ghi xuống `sort_order` — đây là cách
  // đang nhìn, không phải thứ tự muốn lưu.
  // MẶC ĐỊNH sắp theo "% so ngưỡng" tăng dần: số càng ÂM nghĩa là giá càng ở
  // sâu dưới giá ngưỡng tích sản, tức càng đáng mua — mã đáng mua nhất nằm ngay
  // dòng đầu, không phải dò. Bấm 3 nhịp vẫn về được thứ tự gốc `sort_order`.
  const [sort, setSort] = useState<SortState<StockSortKey> | null>(
    { key: 'gap_threshold', dir: 'asc' },
  );
  const doiSort = (key: StockSortKey) => setSort((cu) => nextSort(cu, key));
  // Các nhóm đang có mã (bảng hiện ra), theo đúng thứ tự người dùng đã sắp.
  const hien = order.filter((g) => stocks.some((s) => s.group === g));

  return (
    <div className="flex flex-col gap-5">
      {order.map((g) => {
        const rows = sortRows(stocks.filter((s) => s.group === g), sort, stockSortValue);
        if (rows.length === 0) return null;
        const i = hien.indexOf(g);
        const nutDoi = 'rounded px-1.5 py-0.5 text-[11px] text-text-muted transition hover:bg-surface-2 hover:text-text disabled:opacity-30 disabled:hover:bg-transparent dark:text-text-muted-dark dark:hover:bg-surface-2dark dark:hover:text-text-dark';
        return (
          <section key={g} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1">
              <div className={`text-[12px] font-bold ${GROUP_META[g].head}`}>{GROUP_META[g].label}</div>
              {/* Nút đổi vị trí bảng: đổi với bảng ĐANG HIỆN liền kề (bảng
                  trống bị ẩn nên không tính). Mép trên/dưới thì mờ đi. */}
              <button
                onClick={() => onMove(g, -1, hien)}
                disabled={i === 0}
                className={nutDoi}
                aria-label={`Đưa bảng ${GROUP_META[g].label} lên`}
                title="Đưa bảng lên"
              >
                ▲
              </button>
              <button
                onClick={() => onMove(g, 1, hien)}
                disabled={i === hien.length - 1}
                className={nutDoi}
                aria-label={`Đưa bảng ${GROUP_META[g].label} xuống`}
                title="Đưa bảng xuống"
              >
                ▼
              </button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-border dark:border-border-dark">
              <table className="w-full min-w-[1000px] border-collapse">
                <thead>
                  <tr className="bg-surface-2 dark:bg-surface-2dark">
                    {STOCK_COLUMNS.map((c) => (
                      <SortableTh
                        key={c.key}
                        colKey={c.key}
                        label={c.label}
                        sort={sort}
                        onSort={doiSort}
                        className={th}
                      />
                    ))}
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
      <div className="flex flex-col gap-1 text-[11px] leading-relaxed text-text-muted dark:text-text-muted-dark">
        <p>
          <span className="font-semibold text-red-600 dark:text-red-400">Đỏ</span> = trên giá bảo vệ (đắt) ·{' '}
          <span className="font-semibold text-green-600 dark:text-green-400">Xanh</span> = chạm giá ngưỡng (đáng mua)
        </p>
        <p>
          <strong>% so ngưỡng</strong>: còn phải giảm bao nhiêu % mới về giá ngưỡng
          tích sản. Số <span className="font-semibold text-red-600 dark:text-red-400">dương</span>{' '}
          = còn đắt hơn ngưỡng bấy nhiêu, chưa tới lúc mua. Số{' '}
          <span className="font-semibold text-green-600 dark:text-green-400">âm</span>{' '}
          = đã xuống dưới ngưỡng bấy nhiêu %.
          {' · '}<strong>% so đỉnh</strong>: đang thấp hơn đỉnh lịch sử bao nhiêu %.
        </p>
        <p>
          <strong>Sắp xếp</strong>: bấm tiêu đề cột — tăng dần → giảm dần → bỏ sắp xếp.
          Cả 4 nhóm cùng sắp theo cột đó; ô chưa nhập (—) luôn nằm cuối.
          Mặc định sắp theo <strong>% so ngưỡng</strong>, mã rẻ hơn ngưỡng nhiều nhất
          lên đầu. Hai cột phần trăm <strong>bỏ dấu trừ</strong> cho gọn — số có
          dấu <strong>+</strong> nghĩa là đang CAO hơn mốc.
        </p>
      </div>
    </div>
  );
}
