import { useEffect, useRef, useState } from 'react';
import { niceTicks, nearestIndex } from '../lib/chartScale';

// Biểu đồ đường SVG dùng chung cho máy tính lãi kép và giả lập DCA.
//
// Tự vẽ thay vì thêm thư viện biểu đồ: chỉ cần vài đường + trục + tooltip, một
// thư viện cỡ Chart.js sẽ to hơn cả phần còn lại của tab. Đo chiều rộng thật
// bằng ResizeObserver để chữ trục không bị co giãn méo như khi kéo viewBox.

export interface LineSeries {
  key: string;
  label: string;
  /** Màu — nên là biến CSS (var(--viz-…)) để tự đổi theo dark mode. */
  color: string;
  dashed?: boolean;
  /** Sắp tăng theo x. */
  points: { x: number; y: number }[];
}

interface Props {
  series: LineSeries[];
  formatX: (x: number) => string;
  /** Nhãn vạch trục X, gọn hơn formatX (mặc định = formatX). */
  formatXTick?: (x: number) => string;
  formatY: (y: number) => string;
  /** Định dạng đầy đủ trong tooltip (mặc định = formatY). */
  formatYFull?: (y: number) => string;
  height?: number;
  /** Mô tả cho trình đọc màn hình. */
  ariaLabel: string;
}

const PAD = { top: 12, right: 16, bottom: 28, left: 64 };

export function LineChart({ series, formatX, formatXTick, formatY, formatYFull, height = 300, ariaLabel }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hoverX, setHoverX] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const all = series.flatMap((s) => s.points);
  if (all.length === 0) return null;

  const xMin = Math.min(...all.map((p) => p.x));
  const xMax = Math.max(...all.map((p) => p.x));
  const yTicks = niceTicks(Math.min(...all.map((p) => p.y)), Math.max(...all.map((p) => p.y)));
  const yMin = yTicks[0];
  const yMax = yTicks[yTicks.length - 1];

  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const sx = (x: number) => PAD.left + (xMax === xMin ? plotW / 2 : ((x - xMin) / (xMax - xMin)) * plotW);
  const sy = (y: number) => PAD.top + plotH - ((y - yMin) / (yMax - yMin)) * plotH;

  // Vạch trục X: khoảng 1 vạch mỗi 110px để nhãn không dính nhau, tối đa 6.
  const soVachX = Math.max(2, Math.min(6, Math.floor(plotW / 110)));
  const xTicks = Array.from({ length: soVachX + 1 }, (_, i) => xMin + ((xMax - xMin) * i) / soVachX);

  const path = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join('');

  // Tooltip: với mỗi đường lấy điểm gần vị trí chuột nhất.
  const hovered = hoverX === null ? [] : series.map((s) => {
    const i = nearestIndex(s.points.map((p) => p.x), hoverX);
    return i < 0 ? null : { s, p: s.points[i] };
  }).filter((v): v is { s: LineSeries; p: { x: number; y: number } } => v !== null);
  const anchorX = hovered.length > 0 ? hovered[0].p.x : null;

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    if (px < PAD.left || px > width - PAD.right) {
      setHoverX(null);
      return;
    }
    setHoverX(xMin + ((px - PAD.left) / plotW) * (xMax - xMin));
  }

  const fmtFull = formatYFull ?? formatY;
  const tooltipLeft = anchorX === null ? 0 : sx(anchorX);
  const tooltipOnRight = tooltipLeft < width / 2;

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-text-muted dark:text-text-muted-dark">
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <svg width="18" height="8" aria-hidden="true">
              <line x1="0" y1="4" x2="18" y2="4" stroke={s.color} strokeWidth="2.5"
                strokeDasharray={s.dashed ? '4 3' : undefined} />
            </svg>
            {s.label}
          </li>
        ))}
      </ul>
      <div ref={wrapRef} className="relative w-full">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={ariaLabel}
          onPointerMove={onMove}
          onPointerLeave={() => setHoverX(null)}
          className="block touch-none select-none"
        >
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={sy(t)} y2={sy(t)}
                className="stroke-border dark:stroke-border-dark" strokeWidth="1" />
              <text x={PAD.left - 8} y={sy(t)} dy="0.32em" textAnchor="end"
                className="fill-text-muted text-[11px] tabular-nums dark:fill-text-muted-dark">
                {formatY(t)}
              </text>
            </g>
          ))}
          {xTicks.map((t, i) => (
            <text key={i} x={sx(t)} y={height - 8}
              textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}
              className="fill-text-muted text-[11px] tabular-nums dark:fill-text-muted-dark">
              {(formatXTick ?? formatX)(t)}
            </text>
          ))}
          {series.map((s) => (
            <path key={s.key} d={path(s.points)} fill="none" stroke={s.color} strokeWidth="2"
              strokeLinejoin="round" strokeDasharray={s.dashed ? '5 4' : undefined} />
          ))}
          {anchorX !== null && (
            <>
              <line x1={sx(anchorX)} x2={sx(anchorX)} y1={PAD.top} y2={PAD.top + plotH}
                className="stroke-text-muted dark:stroke-text-muted-dark" strokeWidth="1" strokeDasharray="3 3" />
              {hovered.map(({ s, p }) => (
                <circle key={s.key} cx={sx(p.x)} cy={sy(p.y)} r="3.5" fill={s.color}
                  className="stroke-surface dark:stroke-surface-dark" strokeWidth="1.5" />
              ))}
            </>
          )}
        </svg>
        {anchorX !== null && (
          <div
            className="pointer-events-none absolute top-2 z-10 min-w-[180px] rounded-lg border border-border bg-surface px-3 py-2 text-[12px] shadow-md dark:border-border-dark dark:bg-surface-dark dark:shadow-md-dark"
            style={tooltipOnRight ? { left: tooltipLeft + 12 } : { right: width - tooltipLeft + 12 }}
          >
            <div className="mb-1 font-semibold text-text dark:text-text-dark">{formatX(anchorX)}</div>
            {hovered.map(({ s, p }) => (
              <div key={s.key} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-text-muted dark:text-text-muted-dark">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
                  {s.label}
                </span>
                <span className="font-mono tabular-nums text-text dark:text-text-dark">{fmtFull(p.y)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
