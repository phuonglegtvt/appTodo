import { useState } from 'react';
import { defaultTargets, lapKeHoachPhanBo, type AllocationPlan } from '../lib/longtermAllocation';
import { parseVnNumber } from '../lib/parseNumber';
import { formatVnd } from '../lib/portfolioClassMeta';
import type { Stock } from '../types/stock';
import { MoneyInput } from './MoneyInput';

// Khối "Phân bổ Đầu tư dài hạn" ở tab Cổ phiếu: đặt tỷ trọng mục tiêu từng mã
// (lưu lên Supabase), nhập số tiền định nạp → ra số cổ cần mua mỗi mã.
// Phép tính ở src/lib/longtermAllocation.ts (có test); file này chỉ nhập & vẽ.
//
// ĐƠN VỊ: `stocks.current_price` là NGHÌN đồng ⇒ nhân 1.000 khi đưa vào phép tính.

interface Props {
  /** Chỉ các mã thuộc nhóm "longterm". */
  stocks: Stock[];
  /** Tỷ trọng đã lưu (id → %); null = chưa lưu bao giờ ⇒ dùng mặc định. */
  saved: Record<string, number> | null;
  onSave: (t: Record<string, number>) => Promise<void>;
}

const oNhap = 'rounded-md border border-border bg-surface px-2 py-1.5 text-right font-mono text-[13px] tabular-nums text-text outline-none focus:border-primary dark:border-border-dark dark:bg-surface-2dark dark:text-text-dark dark:focus:border-primary-dark';
const th = 'px-2 py-2 text-[11px] font-bold uppercase tracking-[0.06em] text-text-muted dark:text-text-muted-dark';
const td = 'px-2 py-1.5 text-[13px] tabular-nums text-text dark:text-text-dark';
const nutPhu = (on: boolean) =>
  `rounded-lg border px-2.5 py-1 text-[12.5px] font-semibold transition ease-out ${
    on
      ? 'border-primary bg-primary-soft text-primary dark:border-primary-dark dark:bg-primary-soft-dark dark:text-primary-dark'
      : 'border-border text-text-muted hover:text-text dark:border-border-dark dark:text-text-muted-dark dark:hover:text-text-dark'
  }`;

const pct = (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + '%';
const soCo = (v: number) => v.toLocaleString('vi-VN');
const phanTram = (v: number) => String(Math.round(v * 100) / 100).replace('.', ',');

function batDau(stocks: Stock[], saved: Record<string, number> | null): Record<string, string> {
  // Chưa lưu bao giờ ⇒ mặc định. Đã lưu ⇒ lấy số đã lưu; mã mới thêm sau (chưa
  // có trong bản lưu) để 0 và để cảnh báo "tổng ≠ 100%" nhắc người dùng.
  const goc = saved ?? defaultTargets(stocks.map((s) => ({ id: s.id, ticker: s.ticker })));
  return Object.fromEntries(stocks.map((s) => [s.id, phanTram(goc[s.id] ?? 0)]));
}

export function LongtermAllocation({ stocks, saved, onSave }: Props) {
  const [nhap, setNhap] = useState<Record<string, string>>(() => batDau(stocks, saved));
  const [tien, setTien] = useState<number | null>(10_000_000);
  const [lo, setLo] = useState<1 | 100>(1);
  const [dangLuu, setDangLuu] = useState(false);
  const [thongBao, setThongBao] = useState<{ ok: boolean; text: string } | null>(null);

  const so = Object.fromEntries(stocks.map((s) => [s.id, parseVnNumber(nhap[s.id] ?? '')]));
  const hopLe = stocks.every((s) => so[s.id] !== null && (so[s.id] as number) >= 0);
  const tong = stocks.reduce((t, s) => t + (so[s.id] ?? 0), 0);
  const tongDung = Math.abs(tong - 100) <= 0.01;
  const daDoi = stocks.some((s) => saved?.[s.id] === undefined || Math.abs((saved[s.id] ?? 0) - (so[s.id] ?? NaN)) > 1e-9);

  let plan: AllocationPlan | null = null;
  let loi: string | null = null;
  if (!hopLe) loi = 'Tỷ trọng mục tiêu phải là số ≥ 0.';
  else if (tien === null) loi = 'Nhập số tiền định đầu tư.';
  else {
    try {
      plan = lapKeHoachPhanBo(stocks.map((s) => ({
        id: s.id,
        ticker: s.ticker,
        priceVnd: s.current_price === null ? null : s.current_price * 1000,
        quantity: s.quantity,
        targetPct: so[s.id] as number,
      })), tien, lo);
    } catch (err) {
      loi = err instanceof Error ? err.message : String(err);
    }
  }

  async function luu() {
    setThongBao(null);
    setDangLuu(true);
    try {
      await onSave(Object.fromEntries(stocks.map((s) => [s.id, so[s.id] as number])));
      setThongBao({ ok: true, text: 'Đã lưu tỷ trọng mục tiêu.' });
    } catch (err) {
      console.error('Lỗi lưu tỷ trọng dài hạn:', err);
      setThongBao({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setDangLuu(false);
    }
  }

  const theoId = new Map(plan?.rows.map((r) => [r.id, r]) ?? []);

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
      <div>
        <div className="text-[17px] font-bold tracking-tight text-text dark:text-text-dark">Phân bổ Đầu tư dài hạn</div>
        <div className="mt-0.5 text-[13px] text-text-muted dark:text-text-muted-dark">
          Đặt tỷ trọng mục tiêu từng mã, nhập số tiền định đầu tư → app tính số cổ cần mua để về gần mục tiêu
          nhất. Mã đang vượt mục tiêu không mua thêm; không bán gì.
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-text-muted dark:text-text-muted-dark">Số tiền định đầu tư (đ)</span>
          <MoneyInput value={tien} onChange={setTien} className={`w-44 ${oNhap}`} />
        </label>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-text-muted dark:text-text-muted-dark">Mua theo</span>
          <div className="flex gap-1.5">
            <button type="button" onClick={() => setLo(1)} className={nutPhu(lo === 1)}>Từng cổ</button>
            <button type="button" onClick={() => setLo(100)} className={nutPhu(lo === 100)}>Lô 100</button>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button type="button"
            onClick={() => setNhap(batDau(stocks, null))}
            className={nutPhu(false)}
            title="E1VFVN30 20%, phần còn lại chia đều cho các mã khác">
            Đặt mặc định
          </button>
          <button type="button" onClick={() => void luu()} disabled={dangLuu || !hopLe || !tongDung || !daDoi}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90 active:scale-95 disabled:opacity-50 dark:bg-primary-dark dark:text-bg-dark">
            {dangLuu ? 'Đang lưu…' : daDoi ? 'Lưu tỷ trọng' : 'Đã lưu'}
          </button>
        </div>
      </div>

      {thongBao !== null && (
        <p role={thongBao.ok ? 'status' : 'alert'} className={`text-[13px] ${thongBao.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {thongBao.ok ? '✓' : '⚠'} {thongBao.text}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-border dark:border-border-dark">
        <table className="w-full min-w-[820px] border-collapse">
          <thead>
            <tr className="border-b border-border text-right dark:border-border-dark">
              <th className={`${th} text-left`}>Mã</th>
              <th className={th}>Giá</th>
              <th className={th}>Đang có</th>
              <th className={th}>Giá trị</th>
              <th className={th}>Hiện tại</th>
              <th className={th}>Mục tiêu %</th>
              <th className={th}>Mua thêm</th>
              <th className={th}>Tiền mua</th>
              <th className={th}>Sau khi mua</th>
            </tr>
          </thead>
          <tbody>
            {stocks.map((s) => {
              const r = theoId.get(s.id);
              return (
                <tr key={s.id} className="border-b border-border text-right last:border-0 dark:border-border-dark">
                  <td className={`${td} text-left font-semibold`}>{s.ticker}</td>
                  <td className={`${td} font-mono`}>{s.current_price === null ? '—' : formatVnd(s.current_price * 1000)}</td>
                  <td className={`${td} font-mono`}>{s.quantity === null ? '—' : soCo(s.quantity)}</td>
                  <td className={`${td} font-mono`}>{r ? formatVnd(r.valueVnd) : '—'}</td>
                  <td className={`${td} font-mono text-text-muted dark:text-text-muted-dark`}>{r ? pct(r.currentPct) : '—'}</td>
                  <td className={td}>
                    <input
                      value={nhap[s.id] ?? ''}
                      onChange={(e) => { setNhap({ ...nhap, [s.id]: e.target.value }); setThongBao(null); }}
                      inputMode="decimal"
                      aria-label={`Tỷ trọng mục tiêu ${s.ticker} (%)`}
                      className={`w-20 ${oNhap}`}
                    />
                  </td>
                  <td className={`${td} font-mono font-semibold`}>
                    {r ? (r.buyShares > 0 ? <span className="text-green-600 dark:text-green-400">+{soCo(r.buyShares)} cổ</span> : <span className="text-text-muted dark:text-text-muted-dark">0</span>) : '—'}
                  </td>
                  <td className={`${td} font-mono`}>{r && r.buyVnd > 0 ? formatVnd(r.buyVnd) : '—'}</td>
                  <td className={`${td} font-mono`}>{r ? pct(r.afterPct) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-border text-right dark:border-border-dark">
              <td className={`${td} text-left font-semibold`} colSpan={3}>Tổng</td>
              <td className={`${td} font-mono font-semibold`}>{plan ? formatVnd(plan.totalBeforeVnd) : '—'}</td>
              <td className={td} />
              <td className={`${td} font-mono font-semibold ${tongDung ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {pct(tong)}
              </td>
              <td className={td} />
              <td className={`${td} font-mono font-semibold`}>{plan ? formatVnd(plan.spentVnd) : '—'}</td>
              <td className={`${td} font-mono font-semibold`}>{plan ? formatVnd(plan.totalAfterVnd) : '—'}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {loi !== null && <p role="alert" className="text-[13px] text-amber-700 dark:text-amber-400">⚠ {loi}</p>}

      {plan !== null && (
        <div className="flex flex-col gap-1 text-[13px] leading-relaxed text-text-muted dark:text-text-muted-dark">
          <div>
            Dùng <strong className="text-text dark:text-text-dark">{formatVnd(plan.spentVnd)}</strong> trên {formatVnd(plan.cashVnd)},
            còn dư <strong className="text-text dark:text-text-dark">{formatVnd(plan.leftoverVnd)}</strong>
            {plan.leftoverVnd > 0 && ' (không đủ mua thêm một bước của mã nào còn thiếu)'}.
          </div>
          {plan.neededForExactVnd > plan.cashVnd + 1 ? (
            <div>
              Để <strong>mọi mã về đúng mục tiêu</strong> mà không bán gì cần khoảng{' '}
              <strong className="text-text dark:text-text-dark">{formatVnd(plan.neededForExactVnd)}</strong> — số tiền đang nhập
              chưa đủ nên các mã thiếu được chia theo mức thiếu.
            </div>
          ) : (
            <div>Số tiền này đủ để mọi mã về sát mục tiêu (chỉ lệch do làm tròn số cổ).</div>
          )}
          <div>Giá lấy theo cột “Giá hiện tại”; chưa tính phí giao dịch.</div>
        </div>
      )}
    </section>
  );
}
