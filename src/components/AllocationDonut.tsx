import { useState } from 'react';
import { donutSegments, arcPath } from '../lib/donutGeometry';
import { CLASS_META, formatVnd } from '../lib/portfolioClassMeta';
import type { AssetClass } from '../domain/types';

// Biểu đồ tròn tỷ trọng thực tế + legend có nhãn chữ.
//
// Vì sao có legend chữ chứ không chỉ màu: bộ màu đạt WARN contrast ở light mode
// (#eda100 2,17:1 trên nền trắng), mà luật của skill dataviz là WARN contrast
// BẮT BUỘC phải bù bằng nhãn hiện rõ hoặc bảng số. Ở đây có cả hai — nên nhận
// dạng nhóm không bao giờ chỉ dựa vào màu.
//
// Hình học nằm ở src/lib/donutGeometry.ts (có test riêng); file này chỉ vẽ.

const RADIUS = 100;
const INNER = 62;
const GAP_DEG = 2;
/** Chừa chỗ để nét viền 2px không bị cắt ở mép viewBox. */
const PAD = 4;

interface Slice {
  assetClass: AssetClass;
  valueVnd: number;
}

interface Props {
  slices: Slice[];
  /** Tổng danh mục — hiện ở giữa vòng (hero number). */
  totalVnd: number;
}

export function AllocationDonut({ slices, totalVnd }: Props) {
  const [hover, setHover] = useState<AssetClass | null>(null);

  const segments = donutSegments(slices.map((s) => s.valueVnd), {
    radius: RADIUS, innerRadius: INNER, gapDeg: GAP_DEG,
  });

  const size = (RADIUS + PAD) * 2;
  const noiBat = hover === null ? null : slices.findIndex((s) => s.assetClass === hover);

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-7">
      <div className="relative flex-none">
        <svg
          width={size}
          height={size}
          viewBox={`${-(RADIUS + PAD)} ${-(RADIUS + PAD)} ${size} ${size}`}
          role="img"
          aria-label={`Tỷ trọng danh mục: ${slices
            .map((s) => `${CLASS_META[s.assetClass].label} ${formatVnd(s.valueVnd)}`)
            .join(', ')}`}
        >
          {segments.length === 0 && (
            // Danh mục rỗng: vẽ vành xám thay vì để trống hẳn, để người dùng
            // thấy biểu đồ tồn tại và đang chờ dữ liệu — không phải bị lỗi.
            <circle
              r={(RADIUS + INNER) / 2}
              fill="none"
              strokeWidth={RADIUS - INNER}
              className="stroke-border dark:stroke-border-dark"
            />
          )}

          {segments.map((seg) => {
            const s = slices[seg.index];
            const meta = CLASS_META[s.assetClass];
            const mo = noiBat !== null && noiBat !== seg.index;
            const chung = {
              fill: meta.colorVar,
              opacity: mo ? 0.35 : 1,
              onMouseEnter: () => setHover(s.assetClass),
              onMouseLeave: () => setHover(null),
              style: { transition: 'opacity 150ms ease-out' },
            };
            return seg.isFullCircle ? (
              // Cung SVG 360° có điểm đầu trùng điểm cuối ⇒ vẽ ra RỖNG. Một
              // nhóm chiếm 100% phải vẽ bằng <circle>, không phải <path>.
              <circle
                key={s.assetClass}
                r={(RADIUS + INNER) / 2}
                strokeWidth={RADIUS - INNER}
                stroke={meta.colorVar}
                {...chung}
                fill="none"
              />
            ) : (
              <path
                key={s.assetClass}
                d={arcPath(seg.startAngle, seg.endAngle, RADIUS, INNER)}
                {...chung}
              />
            );
          })}
        </svg>

        {/* Hero number giữa vòng: tổng danh mục, hoặc số của lát đang hover. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          {hover === null ? (
            <>
              <span className="text-[10px] font-bold tracking-[0.09em] text-text-muted dark:text-text-muted-dark">
                TỔNG DANH MỤC
              </span>
              <span className="max-w-[120px] text-center text-[15px] font-bold leading-tight tracking-tight text-text dark:text-text-dark">
                {formatVnd(totalVnd)}
              </span>
            </>
          ) : (
            <>
              <span className="text-[10px] font-bold tracking-[0.09em] text-text-muted dark:text-text-muted-dark">
                {CLASS_META[hover].label.toUpperCase()}
              </span>
              <span className="text-[19px] font-bold tracking-tight text-text dark:text-text-dark">
                {(segments.find((g) => slices[g.index].assetClass === hover)?.fractionPct ?? 0)
                  .toFixed(1)}%
              </span>
              <span className="max-w-[120px] text-center text-[11px] leading-tight text-text-muted dark:text-text-muted-dark">
                {formatVnd(slices.find((s) => s.assetClass === hover)?.valueVnd ?? 0)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Legend: luôn có, luôn kèm nhãn chữ + số — không bao giờ chỉ có màu. */}
      <ul className="flex w-full flex-col gap-2">
        {slices.map((s) => {
          const meta = CLASS_META[s.assetClass];
          const pct = segments.find((g) => slices[g.index].assetClass === s.assetClass)
            ?.fractionPct;
          return (
            <li
              key={s.assetClass}
              onMouseEnter={() => setHover(s.assetClass)}
              onMouseLeave={() => setHover(null)}
              className={`flex items-baseline gap-2 rounded-md px-2 py-1 text-sm transition ease-out ${
                hover === s.assetClass ? 'bg-surface-2 dark:bg-surface-2dark' : ''
              }`}
            >
              <span
                aria-hidden="true"
                className="mt-[3px] h-2.5 w-2.5 flex-none self-start rounded-sm"
                style={{ backgroundColor: meta.colorVar }}
              />
              <span className="flex-1 text-text dark:text-text-dark">{meta.label}</span>
              <span className="font-mono text-[13px] font-semibold tabular-nums text-text dark:text-text-dark">
                {pct === undefined ? '—' : pct.toFixed(1) + '%'}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
