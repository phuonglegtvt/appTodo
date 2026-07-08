import type { ViewHorizon } from '../types/goal';

interface Props {
  horizon: ViewHorizon;
  onHorizon: (h: ViewHorizon) => void;
  periodLabel: string;
  onPrev: () => void;
  onNext: () => void;
}

const HORIZON_LABEL: Record<ViewHorizon, string> = {
  five_year: '5 Năm',
  year: 'Năm',
  month: 'Tháng',
  week: 'Tuần',
  day: 'Ngày',
};

const HORIZONS: ViewHorizon[] = ['five_year', 'year', 'month', 'week', 'day'];

/** Thanh chọn tầng thời gian + điều hướng kỳ trước/sau cho tab Kế hoạch. */
export function HorizonSwitcher({ horizon, onHorizon, periodLabel, onPrev, onNext }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex gap-0.5 rounded-lg border border-border bg-surface-2 p-0.5 dark:border-border-dark dark:bg-surface-2dark">
        {HORIZONS.map((h) => (
          <button
            key={h}
            onClick={() => onHorizon(h)}
            aria-pressed={horizon === h}
            className={`rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
              horizon === h
                ? 'bg-surface text-text shadow-sm dark:bg-surface-dark dark:text-text-dark'
                : 'text-text-muted dark:text-text-muted-dark'
            }`}
          >
            {HORIZON_LABEL[h]}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onPrev} aria-label="Kỳ trước" className="btn-icon h-8 w-8 text-sm">
          ‹
        </button>
        <span className="min-w-[140px] text-center text-sm font-semibold text-text dark:text-text-dark">
          {periodLabel}
        </span>
        <button onClick={onNext} aria-label="Kỳ sau" className="btn-icon h-8 w-8 text-sm">
          ›
        </button>
      </div>
    </div>
  );
}
