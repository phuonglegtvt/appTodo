import { useState } from 'react';
import { useFinancialGoals, type NewFinancialGoal } from '../hooks/useFinancialGoals';
import { danhGiaMucTieu, type FinancialGoal } from '../lib/financialGoals';
import { parseVnNumber } from '../lib/parseNumber';
import { formatVnd } from '../lib/portfolioClassMeta';
import { ErrorBanner } from './ErrorBanner';
import { MoneyInput } from './MoneyInput';

// Mục "Mục tiêu" (tab Danh mục): mỗi mục tiêu có số cần, hạn, đã có, đang góp,
// lãi kỳ vọng → cần góp bao nhiêu/tháng, với số đang góp thì có kịp không.
// Phép tính ở src/lib/financialGoals.ts (có test).

interface Props {
  userId: string;
  homNay: string;
}

const o = 'rounded-md border border-border bg-surface px-2 py-1.5 text-[13px] text-text outline-none focus:border-primary dark:border-border-dark dark:bg-surface-2dark dark:text-text-dark dark:focus:border-primary-dark';
const so = `${o} text-right font-mono tabular-nums`;
const nhan = 'text-[11px] font-bold uppercase tracking-[0.06em] text-text-muted dark:text-text-muted-dark';
const mo = 'text-text-muted dark:text-text-muted-dark';

function GoalForm({ initial, onSubmit, onCancel }: { initial?: FinancialGoal; onSubmit: (g: NewFinancialGoal) => Promise<void>; onCancel?: () => void }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [dich, setDich] = useState<number | null>(initial?.target_amount_vnd ?? null);
  const [han, setHan] = useState(initial?.target_date ?? '');
  const [daCo, setDaCo] = useState<number | null>(initial?.saved_vnd ?? 0);
  const [gop, setGop] = useState<number | null>(initial?.monthly_contribution_vnd ?? 0);
  const [lai, setLai] = useState(initial ? String(initial.expected_return_pct).replace('.', ',') : '6');
  const [ghiChu, setGhiChu] = useState(initial?.note ?? '');
  const [loi, setLoi] = useState<string | null>(null);
  const [dangLuu, setDangLuu] = useState(false);

  async function gui(e: React.FormEvent) {
    e.preventDefault();
    setLoi(null);
    const laiN = parseVnNumber(lai);
    if (!name.trim()) return setLoi('Đặt tên mục tiêu (VD: Mua nhà 2030).');
    if (dich === null || dich <= 0) return setLoi('Nhập số tiền cần đạt.');
    if (!han) return setLoi('Chọn hạn chót.');
    if (daCo === null || daCo < 0 || gop === null || gop < 0) return setLoi('Đã có / đang góp phải là số ≥ 0.');
    if (laiN === null || laiN < 0 || laiN > 100) return setLoi('Lãi kỳ vọng phải từ 0 đến 100 (%/năm).');
    setDangLuu(true);
    try {
      await onSubmit({ name: name.trim(), target_amount_vnd: dich, target_date: han, saved_vnd: daCo, monthly_contribution_vnd: gop, expected_return_pct: laiN, note: ghiChu.trim() });
      if (!initial) { setName(''); setDich(null); setHan(''); setDaCo(0); setGop(0); setGhiChu(''); }
    } catch (err) {
      console.error('Lỗi lưu mục tiêu tài chính:', err);
      setLoi(err instanceof Error ? err.message : String(err));
    } finally {
      setDangLuu(false);
    }
  }

  return (
    <form onSubmit={gui} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1"><span className={nhan}>Mục tiêu</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Mua nhà, học cho con…" className={`w-44 ${o}`} /></label>
        <label className="flex flex-col gap-1"><span className={nhan}>Cần (đ)</span>
          <MoneyInput value={dich} onChange={setDich} className={`w-36 ${so}`} /></label>
        <label className="flex flex-col gap-1"><span className={nhan}>Hạn chót</span>
          <input type="date" value={han} onChange={(e) => setHan(e.target.value)} className={`w-36 ${o}`} /></label>
        <label className="flex flex-col gap-1"><span className={nhan}>Đã có (đ)</span>
          <MoneyInput value={daCo} onChange={setDaCo} className={`w-36 ${so}`} /></label>
        <label className="flex flex-col gap-1"><span className={nhan}>Đang góp/tháng (đ)</span>
          <MoneyInput value={gop} onChange={setGop} className={`w-36 ${so}`} /></label>
        <label className="flex flex-col gap-1"><span className={nhan}>Lãi kỳ vọng %/năm</span>
          <input value={lai} onChange={(e) => setLai(e.target.value)} inputMode="decimal" className={`w-20 ${so}`} /></label>
        <label className="flex min-w-[8rem] flex-1 flex-col gap-1"><span className={nhan}>Ghi chú</span>
          <input value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} placeholder="Không bắt buộc" className={o} /></label>
      </div>
      {loi && <p role="alert" className="text-[13px] text-red-600 dark:text-red-400">⚠ {loi}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={dangLuu} className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50 dark:bg-primary-dark dark:text-bg-dark">
          {dangLuu ? 'Đang lưu…' : initial ? 'Lưu thay đổi' : 'Thêm mục tiêu'}
        </button>
        {onCancel && <button type="button" onClick={onCancel} className={`rounded-lg px-4 py-1.5 text-sm font-semibold ${mo}`}>Huỷ</button>}
      </div>
    </form>
  );
}

export function FinancialGoalsPanel({ userId, homNay }: Props) {
  const { goals, loading, error, addGoal, updateGoal, deleteGoal, clearError } = useFinancialGoals(userId);
  const [dangSua, setDangSua] = useState<string | null>(null);
  const [loi, setLoi] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      {error && <ErrorBanner message={error} onClose={clearError} />}
      {loi && <ErrorBanner message={loi} onClose={() => setLoi(null)} />}

      <section className="surface-card p-4">
        <div className="mb-2 text-[15px] font-bold text-text dark:text-text-dark">Thêm mục tiêu tài chính</div>
        <GoalForm onSubmit={addGoal} />
      </section>

      {loading ? <p className={`text-sm ${mo}`}>Đang tải…</p> : goals.length === 0 ? (
        <p className={`rounded-xl border border-dashed border-border py-6 text-center text-sm dark:border-border-dark ${mo}`}>
          Chưa có mục tiêu nào. VD: Mua nhà 2030 — 2 tỷ; Quỹ học cho con 2035 — 500 triệu.
        </p>
      ) : (
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(320px,1fr))]">
          {goals.map((g) => {
            const s = danhGiaMucTieu(g, homNay);
            return (
              <section key={g.id} className="surface-card flex flex-col gap-2 p-4">
                {dangSua === g.id ? (
                  <GoalForm initial={g} onCancel={() => setDangSua(null)}
                    onSubmit={async (v) => { await updateGoal(g.id, v); setDangSua(null); }} />
                ) : (
                  <>
                    <div className="flex items-baseline justify-between gap-2">
                      <strong className="text-[15px] text-text dark:text-text-dark">{g.name}</strong>
                      <span className="flex gap-1">
                        <button onClick={() => setDangSua(g.id)} className="btn-icon inline-flex" aria-label={`Sửa ${g.name}`}>✎</button>
                        <button onClick={() => { if (confirm(`Xoá mục tiêu "${g.name}"?`)) deleteGoal(g.id).catch((err: unknown) => setLoi(err instanceof Error ? err.message : String(err))); }}
                          className="btn-icon inline-flex" aria-label={`Xoá ${g.name}`}>✕</button>
                      </span>
                    </div>
                    <div className={`text-[12px] ${mo}`}>
                      {formatVnd(g.target_amount_vnd)} · hạn {g.target_date.split('-').reverse().join('/')} · còn {s.soThang} tháng · lãi kỳ vọng {g.expected_return_pct}%/năm
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-2 dark:bg-surface-2dark">
                      <div className="h-full rounded-full bg-[color:var(--viz-stocks)]" style={{ width: `${s.tienDoPct}%` }} />
                    </div>
                    <div className="text-[13px] text-text dark:text-text-dark">
                      Đã có {formatVnd(g.saved_vnd)} ({s.tienDoPct.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}%) · đang góp {formatVnd(g.monthly_contribution_vnd)}/tháng
                    </div>
                    <div className={`rounded-md px-3 py-2 text-[13px] ${s.kip ? 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200' : 'bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100'}`}>
                      {s.kip ? (
                        <>✓ Kịp. Giữ mức góp này, đến hạn dự kiến có <strong>{formatVnd(s.duKien)}</strong> (dư {formatVnd(s.chenhLech)}).</>
                      ) : s.canGop === null ? (
                        <>Đã quá hạn mà còn thiếu {formatVnd(-s.chenhLech)} — dời hạn hoặc giảm mục tiêu.</>
                      ) : (
                        <>Chưa kịp: giữ mức góp này đến hạn chỉ có {formatVnd(s.duKien)} (thiếu {formatVnd(-s.chenhLech)}). Cần góp <strong>{formatVnd(s.canGop)}/tháng</strong>.</>
                      )}
                    </div>
                    {g.note && <div className={`text-[12px] ${mo}`}>{g.note}</div>}
                  </>
                )}
              </section>
            );
          })}
        </div>
      )}
      <p className={`text-[12px] ${mo}`}>Lãi ghép hàng tháng, góp cuối mỗi tháng — cùng cách tính với máy tính Lãi kép. Lãi kỳ vọng là giả định, không phải cam kết.</p>
    </div>
  );
}
