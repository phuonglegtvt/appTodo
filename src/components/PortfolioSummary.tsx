import type { Stock, StockGroup } from '../types/stock';
import { groupWeights, compareToTarget, TARGET_PROFILES } from '../lib/stockCalc';

const GROUP_META: Record<StockGroup, { label: string; bar: string }> = {
  attack: { label: 'Tấn công', bar: 'bg-red-500' },
  balance: { label: 'Cân bằng', bar: 'bg-green-500' },
  defense: { label: 'Phòng thủ', bar: 'bg-blue-500' },
};

const GROUPS: StockGroup[] = ['attack', 'balance', 'defense'];

const PROFILE_LABEL: Record<StockGroup, string> = {
  attack: 'Tấn công',
  balance: 'Cân bằng',
  defense: 'Phòng thủ',
};

/** Định dạng tiền VND (đơn vị đồng). */
function formatVnd(amount: number): string {
  return amount.toLocaleString('vi-VN') + ' đ';
}

interface Props {
  stocks: Stock[];
  profile: StockGroup;
  onProfile: (p: StockGroup) => void;
}

/** Tổng vốn đã đầu tư + 3 thanh tỷ trọng thực tế + so với khẩu vị rủi ro mục tiêu. */
export function PortfolioSummary({ stocks, profile, onProfile }: Props) {
  const weights = groupWeights(stocks);
  const diff = compareToTarget(weights, profile);
  const target = TARGET_PROFILES[profile];

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="text-[11px] font-bold tracking-[0.09em] text-text-muted dark:text-text-muted-dark">
            TỔNG VỐN ĐÃ ĐẦU TƯ
          </div>
          <div className="text-[22px] font-bold tracking-tight text-text dark:text-text-dark">
            {formatVnd(weights.total)}
          </div>
        </div>

        {/* Bộ chọn khẩu vị rủi ro */}
        <div className="flex gap-0.5 rounded-lg border border-border bg-surface-2 p-0.5 dark:border-border-dark dark:bg-surface-2dark">
          {GROUPS.map((g) => (
            <button
              key={g}
              onClick={() => onProfile(g)}
              aria-pressed={profile === g}
              className={`rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
                profile === g
                  ? 'bg-surface text-text shadow-sm dark:bg-surface-dark dark:text-text-dark'
                  : 'text-text-muted dark:text-text-muted-dark'
              }`}
            >
              {PROFILE_LABEL[g]}
            </button>
          ))}
        </div>
      </div>

      {/* 3 thanh tỷ trọng: thực tế (đậm) + mục tiêu (mờ) + chênh lệch */}
      <div className="flex flex-col gap-2.5">
        {GROUPS.map((g) => {
          const actual = weights.byGroup[g].percent;
          const d = diff[g];
          return (
            <div key={g} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between text-[13px]">
                <span className="font-medium text-text dark:text-text-dark">{GROUP_META[g].label}</span>
                <span className="text-text-muted dark:text-text-muted-dark">
                  {actual.toFixed(0)}% <span className="opacity-60">/ mục tiêu {target[g]}%</span>{' '}
                  <span className={d >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                    ({d >= 0 ? '+' : ''}
                    {d.toFixed(0)})
                  </span>
                </span>
              </div>
              {/* Rãnh chứa cả thanh mục tiêu (mờ) và thanh thực tế (đậm chồng lên) */}
              <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-surface-2 dark:bg-surface-2dark">
                <div
                  className={`absolute inset-y-0 left-0 rounded-full ${GROUP_META[g].bar} opacity-30`}
                  style={{ width: `${Math.min(target[g], 100)}%` }}
                />
                <div
                  className={`absolute inset-y-0 left-0 rounded-full ${GROUP_META[g].bar}`}
                  style={{ width: `${Math.min(actual, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
