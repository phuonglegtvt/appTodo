import type { Crypto, Currency } from '../types/crypto';
import { portfolioTotals, value, allocationPercent } from '../lib/cryptoCalc';
import { formatMoney } from '../lib/money';

/** Kẹp phần trăm về [0, 100] để phòng dữ liệu bất thường. */
function clampPercent(v: number): number {
  return Math.max(0, Math.min(v, 100));
}

interface Props {
  cryptos: Crypto[];
  currency: Currency;
  rate: number | null;
}

/** Tổng vốn / tổng giá trị / lời-lỗ (màu) + tỷ trọng mỗi coin theo giá trị. */
export function CryptoSummary({ cryptos, currency, rate }: Props) {
  const totals = portfolioTotals(cryptos);
  const gain = totals.totalPnl >= 0;
  const pnlColor = gain ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';

  // Coin có giá trị hiện tại, sắp theo tỷ trọng giảm dần (cho thanh tỷ trọng).
  const withValue = cryptos
    .map((c) => ({ c, v: value(c) }))
    .filter((x): x is { c: Crypto; v: number } => x.v != null)
    .sort((a, b) => b.v - a.v);

  const stat = (label: string, text: string, color = 'text-text dark:text-text-dark') => (
    <div>
      <div className="text-[11px] font-bold tracking-[0.09em] text-text-muted dark:text-text-muted-dark">
        {label}
      </div>
      <div className={`text-[22px] font-bold tracking-tight ${color}`}>{text}</div>
    </div>
  );

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
      <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3">
        {stat('TỔNG VỐN', formatMoney(totals.totalCost, currency, rate))}
        {stat('GIÁ TRỊ HIỆN TẠI', formatMoney(totals.totalValue, currency, rate))}
        {stat(
          'LỜI/LỖ',
          `${gain ? '+' : ''}${formatMoney(totals.totalPnl, currency, rate)}` +
            (totals.totalPnlPercent != null
              ? ` (${gain ? '+' : ''}${totals.totalPnlPercent.toFixed(1)}%)`
              : ''),
          pnlColor,
        )}
      </div>

      {withValue.length > 0 && (
        <div className="flex flex-col gap-2">
          {withValue.map(({ c, v }) => {
            const pct = allocationPercent(c, totals.totalValue) ?? 0;
            return (
              <div key={c.id} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between text-[13px]">
                  <span className="font-medium text-text dark:text-text-dark">{c.symbol}</span>
                  <span className="text-text-muted dark:text-text-muted-dark">
                    {pct.toFixed(0)}% · {formatMoney(v, currency, rate)}
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-2 dark:bg-surface-2dark">
                  <div
                    className="h-full rounded-full bg-primary dark:bg-primary-dark"
                    style={{ width: `${clampPercent(pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
