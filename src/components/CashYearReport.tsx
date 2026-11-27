import { useState } from 'react';
import { baoCaoNam } from '../lib/cashPlanning';
import { nhanDanhMuc } from '../lib/cashCategories';
import { formatVnd, formatVndShort } from '../lib/portfolioClassMeta';
import type { CashEntry } from '../types/cashEntry';
import { LineChart } from './LineChart';

// Báo cáo năm của Thu–Chi: thu / chi / để dành từng tháng, tỷ lệ tiết kiệm, chi
// theo danh mục. Phép tính ở src/lib/cashPlanning.ts (có test).

interface Props {
  entries: CashEntry[];
  namHienTai: number;
}

const mo = 'text-text-muted dark:text-text-muted-dark';
const pct = (v: number | null) => (v === null ? '—' : v.toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + '%');

export function CashYearReport({ entries, namHienTai }: Props) {
  const [nam, setNam] = useState(namHienTai);
  const r = baoCaoNam(entries, nam);
  const coDuLieu = r.thang.some((t) => t.thu > 0 || t.chi > 0 || t.dauTu > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button onClick={() => setNam(nam - 1)} className="btn-icon h-8 w-8 text-sm" aria-label="Năm trước">‹</button>
        <span className="text-[15px] font-bold text-text dark:text-text-dark">Năm {nam}</span>
        <button onClick={() => setNam(nam + 1)} className="btn-icon h-8 w-8 text-sm" aria-label="Năm sau">›</button>
      </div>

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]">
        {[
          ['TỔNG THU', formatVnd(r.tong.thu), 'text-green-600 dark:text-green-400'],
          ['TỔNG CHI', formatVnd(r.tong.chi), 'text-red-600 dark:text-red-400'],
          ['ĐỂ DÀNH (THU − CHI)', formatVnd(r.tong.conLai), r.tong.conLai < 0 ? 'text-red-600 dark:text-red-400' : 'text-text dark:text-text-dark'],
          ['TỶ LỆ TIẾT KIỆM', pct(r.tong.tyLeTietKiem), 'text-text dark:text-text-dark'],
          ['ĐÃ CHUYỂN ĐẦU TƯ', formatVnd(r.tong.dauTu), 'text-text dark:text-text-dark'],
        ].map(([l, v, c]) => (
          <div key={l} className="surface-card p-4">
            <div className={`text-[11px] font-bold tracking-[0.09em] ${mo}`}>{l}</div>
            <div className={`font-mono text-[18px] font-bold tabular-nums ${c}`}>{v}</div>
          </div>
        ))}
      </div>

      {!coDuLieu ? (
        <p className={`rounded-xl border border-dashed border-border py-8 text-center text-sm dark:border-border-dark ${mo}`}>Năm {nam} chưa có khoản thu–chi nào.</p>
      ) : (
        <>
          <section className="surface-card p-4">
            <LineChart
              ariaLabel={`Thu và chi từng tháng năm ${nam}`}
              series={[
                { key: 'thu', label: 'Thu', color: 'var(--viz-cash)', points: r.thang.map((t, i) => ({ x: i + 1, y: t.thu })) },
                { key: 'chi', label: 'Chi', color: 'var(--viz-crypto)', points: r.thang.map((t, i) => ({ x: i + 1, y: t.chi })) },
                { key: 'dt', label: 'Chuyển đầu tư', color: 'var(--viz-stocks)', dashed: true, points: r.thang.map((t, i) => ({ x: i + 1, y: t.dauTu })) },
              ]}
              formatX={(x) => `Tháng ${Math.round(x)}`}
              formatXTick={(x) => `T${Math.round(x)}`}
              formatY={formatVndShort}
              formatYFull={formatVnd}
              height={240}
            />
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="surface-card overflow-x-auto p-4">
              <table className="w-full min-w-[440px] text-[13px]">
                <thead>
                  <tr className={`text-right ${mo}`}>
                    <th className="px-2 py-1 text-left font-semibold">Tháng</th>
                    <th className="px-2 py-1 font-semibold">Thu</th>
                    <th className="px-2 py-1 font-semibold">Chi</th>
                    <th className="px-2 py-1 font-semibold">Để dành</th>
                    <th className="px-2 py-1 font-semibold">Tiết kiệm</th>
                  </tr>
                </thead>
                <tbody className="font-mono tabular-nums text-text dark:text-text-dark">
                  {r.thang.map((t) => (
                    <tr key={t.thang} className="border-t border-border text-right dark:border-border-dark">
                      <td className="px-2 py-1 text-left">{Number(t.thang.slice(5))}</td>
                      <td className="px-2 py-1">{t.thu ? formatVndShort(t.thu) : '—'}</td>
                      <td className="px-2 py-1">{t.chi ? formatVndShort(t.chi) : '—'}</td>
                      <td className={`px-2 py-1 ${t.conLai < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>{t.thu || t.chi ? formatVndShort(t.conLai) : '—'}</td>
                      <td className="px-2 py-1">{pct(t.tyLeTietKiem)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="surface-card flex flex-col gap-2 p-4">
              <div className="text-[13px] font-semibold text-text dark:text-text-dark">Chi tiêu theo danh mục (không gồm đáo hạn, đầu tư)</div>
              {r.chiTheoMuc.length === 0 ? <p className={`text-[13px] ${mo}`}>Chưa có khoản chi.</p> : r.chiTheoMuc.map((m) => (
                <div key={m.category} className="flex flex-col gap-0.5">
                  <div className="flex justify-between text-[13px]">
                    <span className="text-text dark:text-text-dark">{nhanDanhMuc(m.category)}</span>
                    <span className={`font-mono tabular-nums ${mo}`}>{formatVnd(m.amount)} · {pct(m.pct)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-2 dark:bg-surface-2dark">
                    <div className="h-full rounded-full bg-[color:var(--viz-crypto)]" style={{ width: `${m.pct}%` }} />
                  </div>
                </div>
              ))}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
