import { useState } from 'react';
import { danhMucTheoLoai, laDauTu, laVongTien, nhanDanhMuc } from '../lib/cashCategories';
import { soSanhNganSach } from '../lib/cashPlanning';
import { formatVnd } from '../lib/portfolioClassMeta';
import type { CashEntry } from '../types/cashEntry';
import { MoneyInput } from './MoneyInput';

// Ngân sách tháng theo danh mục chi: đặt hạn mức, xem đã chi bao nhiêu % trong
// tháng đang xem. Phép so ở src/lib/cashPlanning.ts (có test).

interface Props {
  entries: CashEntry[];
  thang: string;
  budgets: Record<string, number>;
  onSet: (category: string, amount: number | null) => Promise<void>;
}

const mo = 'text-text-muted dark:text-text-muted-dark';
const o = 'rounded-md border border-border bg-surface px-2 py-1.5 text-[13px] text-text outline-none focus:border-primary dark:border-border-dark dark:bg-surface-2dark dark:text-text-dark dark:focus:border-primary-dark';

// Đáo hạn (vòng tiền) và chuyển đi đầu tư không phải chi tiêu ⇒ không đặt ngân sách.
const MUC_CO_NGAN_SACH = danhMucTheoLoai('CHI').filter((c) => !laVongTien(c.key) && !laDauTu(c.key));

export function CashBudgetSection({ entries, thang, budgets, onSet }: Props) {
  const [muc, setMuc] = useState(MUC_CO_NGAN_SACH[0]?.key ?? '');
  const [tien, setTien] = useState<number | null>(null);
  const [loi, setLoi] = useState<string | null>(null);
  const dong = soSanhNganSach(entries, thang, budgets);
  const tongNs = dong.reduce((s, d) => s + d.nganSach, 0);
  const tongChi = dong.reduce((s, d) => s + d.daChi, 0);

  async function luu(category: string, amount: number | null) {
    setLoi(null);
    try { await onSet(category, amount); } catch (err) {
      console.error('Lỗi lưu ngân sách:', err);
      setLoi(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <section className="surface-card flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-[15px] font-bold text-text dark:text-text-dark">Ngân sách tháng</div>
        {dong.length > 0 && <div className={`text-[12px] ${mo}`}>Đã chi {formatVnd(tongChi)} / {formatVnd(tongNs)} ngân sách</div>}
      </div>
      {dong.length === 0 ? (
        <p className={`text-[13px] ${mo}`}>Chưa đặt ngân sách nào. Đặt hạn mức mỗi tháng cho từng mục chi ở dưới.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {dong.map((d) => {
            const vuot = d.pct > 100;
            const gan = d.pct > 80;
            return (
              <li key={d.category} className="flex flex-col gap-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-[13px]">
                  <span className="font-semibold text-text dark:text-text-dark">{nhanDanhMuc(d.category)}</span>
                  <span className={`font-mono tabular-nums ${vuot ? 'text-red-600 dark:text-red-400' : mo}`}>
                    {formatVnd(d.daChi)} / {formatVnd(d.nganSach)} · {d.pct.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}%
                    {vuot ? ` · vượt ${formatVnd(-d.conLai)}` : ` · còn ${formatVnd(d.conLai)}`}
                    <button onClick={() => void luu(d.category, null)} className="ml-2 underline decoration-dotted hover:no-underline">bỏ</button>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-2 dark:bg-surface-2dark">
                  <div className={`h-full rounded-full ${vuot ? 'bg-red-500' : gan ? 'bg-amber-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min(100, d.pct)}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => {
        e.preventDefault();
        if (tien === null || tien <= 0) { setLoi('Nhập số tiền ngân sách mỗi tháng.'); return; }
        void luu(muc, tien).then(() => setTien(null));
      }}>
        <select value={muc} onChange={(e) => setMuc(e.target.value)} aria-label="Danh mục ngân sách" className={o}>
          {MUC_CO_NGAN_SACH.map((c) => <option key={c.key} value={c.key}>{c.label}{budgets[c.key] ? ` (đang ${formatVnd(budgets[c.key])})` : ''}</option>)}
        </select>
        <MoneyInput value={tien} onChange={setTien} className={`w-36 text-right font-mono ${o}`} />
        <button type="submit" className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white dark:bg-primary-dark dark:text-bg-dark">Đặt / sửa ngân sách</button>
      </form>
      {loi && <p role="alert" className="text-[13px] text-red-600 dark:text-red-400">⚠ {loi}</p>}
    </section>
  );
}
