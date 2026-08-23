import { CLASS_META, formatVnd } from '../lib/portfolioClassMeta';
import type { PortfolioView } from '../data/portfolioView';
import type { AssetClass } from '../domain/types';

// Bảng Target vs Thực tế + lãi/lỗ + cột "cần bổ sung".
//
// Bảng này cũng là "table view" bù cho WARN contrast của bộ màu (skill dataviz):
// mọi con số biểu đồ thể hiện đều đọc được ở đây bằng chữ.
//
// HAI cột "cần bổ sung", cố ý khác nhau — trộn hai cái này là chỗ dễ hiểu sai nhất:
//   · "Về đúng target": cần bao nhiêu tiền MỚI để nhóm về đúng tỷ trọng, không
//     bán gì cả. Tổng do nhóm đang vượt xa nhất ấn định (domain/topUp.ts).
//   · "Góp tháng này": chia số tiền góp Z đã biết theo khoảng thiếu
//     (domain/allocate.ts). Nhỏ hơn cột trên rất nhiều — đó là bình thường.

const PNL_UP = 'text-green-600 dark:text-green-400';
const PNL_DOWN = 'text-red-600 dark:text-red-400';

/** Nhãn tiếng Việt cho 4 trạng thái band của engine. */
const BAND_LABEL: Record<string, { text: string; cls: string }> = {
  OK: { text: 'Trong band', cls: 'bg-surface-2 text-text-muted dark:bg-surface-2dark dark:text-text-muted-dark' },
  WATCH: { text: 'Cần theo dõi', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200' },
  OUT_OF_BAND: { text: 'Ngoài band', cls: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200' },
  REBALANCE_REQUIRED: { text: 'Phải cân bằng', cls: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200' },
};

interface Props {
  view: PortfolioView;
}

export function AllocationTable({ view }: Props) {
  const { snapshot, weights, byClass, visibleClasses, topUp, plan } = view;

  const gopThangNay = new Map<AssetClass, number>(
    plan.buys.map((b) => [b.assetClass, b.amountVnd]),
  );

  const th = 'px-3 py-2 text-[11px] font-bold uppercase tracking-[0.06em] text-text-muted dark:text-text-muted-dark';
  const td = 'px-3 py-2.5 font-mono text-[13px] tabular-nums text-text dark:text-text-dark';

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] border-collapse text-left">
        <thead>
          <tr className="border-b border-border dark:border-border-dark">
            <th className={th}>Nhóm</th>
            <th className={`${th} text-right`}>Vốn đã bỏ</th>
            <th className={`${th} text-right`}>Giá trị hiện tại</th>
            <th className={`${th} text-right`}>Lãi/lỗ</th>
            <th className={`${th} text-right`}>Thực tế</th>
            <th className={`${th} text-right`}>Mục tiêu</th>
            <th className={`${th} text-right`}>Lệch</th>
            <th className={`${th} text-right`}>Về đúng target</th>
            <th className={`${th} text-right`}>Góp tháng này</th>
            <th className={th}>Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          {visibleClasses.map((c) => {
            const meta = CLASS_META[c];
            const w = weights.find((x) => x.assetClass === c);
            const cv = byClass[c];
            const band = BAND_LABEL[plan.statuses[c]] ?? BAND_LABEL.OK;
            const lech = w?.deviationPp ?? 0;
            const boSung = topUp.status === 'OK' ? topUp.perClass[c] : null;
            const gop = gopThangNay.get(c);

            return (
              <tr
                key={c}
                className="border-b border-border last:border-0 dark:border-border-dark"
              >
                <td className="px-3 py-2.5 text-sm">
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="h-2.5 w-2.5 flex-none rounded-sm"
                      style={{ backgroundColor: meta.colorVar }}
                    />
                    <span className="text-text dark:text-text-dark">{meta.label}</span>
                  </span>
                </td>
                <td className={`${td} text-right`}>
                  {cv.costBasisVnd === null ? '—' : formatVnd(cv.costBasisVnd)}
                </td>
                <td className={`${td} text-right`}>{formatVnd(cv.marketValueVnd)}</td>
                <td
                  className={`${td} text-right ${
                    cv.unrealizedPnlVnd === null
                      ? ''
                      : cv.unrealizedPnlVnd >= 0 ? PNL_UP : PNL_DOWN
                  }`}
                >
                  {cv.unrealizedPnlVnd === null
                    ? '—'
                    : (cv.unrealizedPnlVnd >= 0 ? '+' : '') + formatVnd(cv.unrealizedPnlVnd)}
                </td>
                <td className={`${td} text-right`}>
                  {w === undefined ? '—' : w.weightPct.toFixed(1) + '%'}
                </td>
                <td className={`${td} text-right text-text-muted dark:text-text-muted-dark`}>
                  {snapshot.targets[c].targetPct}%
                </td>
                <td
                  className={`${td} text-right ${
                    Math.abs(lech) < 0.05 ? '' : lech > 0 ? PNL_UP : PNL_DOWN
                  }`}
                >
                  {(lech > 0 ? '+' : '') + lech.toFixed(1)}đ%
                </td>
                <td className={`${td} text-right`}>
                  {boSung === null ? '—' : boSung < 1 ? '0 đ' : formatVnd(boSung)}
                </td>
                <td className={`${td} text-right`}>
                  {gop === undefined ? '—' : formatVnd(gop)}
                </td>
                <td className="px-3 py-2.5">
                  <span className={`pill ${band.cls}`}>{band.text}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border dark:border-border-dark">
            <td className="px-3 py-2.5 text-sm font-semibold text-text dark:text-text-dark">
              Tổng
            </td>
            <td className={`${td} text-right font-semibold`}>
              {visibleClasses.some((c) => byClass[c].costBasisVnd !== null)
                ? formatVnd(
                    visibleClasses.reduce((s, c) => s + (byClass[c].costBasisVnd ?? 0), 0),
                  )
                : '—'}
            </td>
            <td className={`${td} text-right font-semibold`}>{formatVnd(plan.totalVnd)}</td>
            <td className={`${td} text-right`} />
            <td className={`${td} text-right font-semibold`}>100%</td>
            <td className={`${td} text-right`} />
            <td className={`${td} text-right`} />
            <td className={`${td} text-right font-semibold`}>
              {topUp.status === 'OK' ? formatVnd(topUp.totalNeededVnd) : '—'}
            </td>
            <td className={`${td} text-right font-semibold`}>
              {formatVnd(plan.buys.reduce((s, b) => s + b.amountVnd, 0))}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
