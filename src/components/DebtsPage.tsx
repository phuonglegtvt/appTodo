import { Fragment, useState } from 'react';
import { useDebts } from '../hooks/useDebts';
import { ngayDenHanKeTiep, sapDenHan, soNgayGiua, tongHopNo } from '../lib/debtCalc';
import { formatVnd } from '../lib/portfolioClassMeta';
import type { Debt } from '../types/debt';
import { DebtForm } from './DebtForm';
import { ErrorBanner } from './ErrorBanner';

// Tab "Nợ": thẻ tín dụng + khoản vay. Tổng dư nợ, phải trả tháng này, sắp đến
// hạn, và chi phí THẬT của nợ (lãi + phí đáo hạn) theo tháng và cả năm.
// Phép tính ở src/lib/debtCalc.ts (có test); file này chỉ gọi dữ liệu và vẽ.

interface Props {
  userId: string;
}

/** Hôm nay theo giờ máy, YYYY-MM-DD. */
function homNay(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const viDate = (iso: string) => iso.split('-').reverse().join('/');
const pct = (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + '%';
const th = 'px-2 py-2 text-[11px] font-bold uppercase tracking-[0.06em] text-text-muted dark:text-text-muted-dark';
const td = 'px-2 py-2 text-[13px] tabular-nums text-text dark:text-text-dark';
const mo = 'text-text-muted dark:text-text-muted-dark';

function The({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'warn' }) {
  return (
    <div className="surface-card flex flex-col gap-0.5 p-4">
      <div className="text-[11px] font-bold tracking-[0.09em] text-text-muted dark:text-text-muted-dark">{label}</div>
      <div className={`text-[22px] font-bold tracking-tight ${tone === 'warn' ? 'text-red-600 dark:text-red-400' : 'text-text dark:text-text-dark'}`}>{value}</div>
      {sub && <div className={`text-[12px] ${mo}`}>{sub}</div>}
    </div>
  );
}

function DenHan({ debt, today }: { debt: Debt; today: string }) {
  if (debt.due_day === null) return <span className={mo}>—</span>;
  const ngay = ngayDenHanKeTiep(debt.due_day, today);
  const con = soNgayGiua(today, ngay);
  const gap = Number(debt.balance_vnd) > 0 && con <= 3;
  return (
    <span className={gap ? 'font-semibold text-red-600 dark:text-red-400' : ''}>
      {viDate(ngay).slice(0, 5)} <span className={gap ? '' : mo}>({con === 0 ? 'hôm nay' : `còn ${con} ngày`})</span>
    </span>
  );
}

export function DebtsPage({ userId }: Props) {
  const { debts, loading, error, addDebt, updateDebt, deleteDebt, clearError } = useDebts(userId);
  const [dangSua, setDangSua] = useState<string | null>(null);
  const [loi, setLoi] = useState<string | null>(null);
  const today = homNay();

  const s = tongHopNo(debts);
  const gan = sapDenHan(debts, today, 7);
  const the = debts.filter((d) => d.kind === 'CARD');
  const vay = debts.filter((d) => d.kind === 'LOAN');

  async function xoa(d: Debt) {
    if (!confirm(`Xoá "${d.name}" khỏi danh sách nợ? Không khôi phục được.`)) return;
    setLoi(null);
    try {
      await deleteDebt(d.id);
    } catch (err) {
      console.error('Lỗi xoá khoản nợ:', err);
      setLoi(err instanceof Error ? err.message : String(err));
    }
  }

  const nutDong = (d: Debt) => (
    <td className={`${td} whitespace-nowrap text-right`}>
      <button onClick={() => setDangSua(dangSua === d.id ? null : d.id)} className="btn-icon inline-flex" aria-label={`Sửa ${d.name}`}>✎</button>
      <button onClick={() => void xoa(d)} className="btn-icon inline-flex hover:!text-red-600" aria-label={`Xoá ${d.name}`}>✕</button>
    </td>
  );

  const dongSua = (d: Debt, cols: number) => dangSua === d.id && (
    <tr className="border-b border-border bg-surface-2 dark:border-border-dark dark:bg-surface-2dark">
      <td colSpan={cols} className="px-3 py-3">
        <DebtForm initial={d} onCancel={() => setDangSua(null)}
          onSubmit={async (v) => { await updateDebt(d.id, v); setDangSua(null); }} />
      </td>
    </tr>
  );

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-auto p-5 sm:p-6">
      <div>
        <div className="text-[22px] font-bold tracking-tight text-text dark:text-text-dark">Nợ & thẻ tín dụng</div>
        <div className={`mt-0.5 text-[13px] ${mo}`}>
          {debts.length} khoản · số tiền theo đồng · cập nhật dư nợ khi có sao kê hoặc sau khi trả
        </div>
      </div>

      {error && <ErrorBanner message={error} onClose={clearError} />}
      {loi && <ErrorBanner message={loi} onClose={() => setLoi(null)} />}

      {loading ? (
        <p className={`py-8 text-center text-sm ${mo}`}>Đang tải…</p>
      ) : (
        <>
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]">
            <The label="TỔNG DƯ NỢ" value={formatVnd(s.tongDuNo)}
              sub={`Thẻ ${formatVnd(s.tongDuNoThe)} · Vay ${formatVnd(s.tongDuNoVay)}`} />
            <The label="PHẢI TRẢ MỖI THÁNG" value={formatVnd(s.phaiTraThang)} sub="Tổng số định trả / trả góp đã nhập" />
            <The label="LÃI + PHÍ ĐÁO HẠN / THÁNG" value={formatVnd(s.laiUocThang + s.phiDaoHanThang)}
              sub={`Lãi ~${formatVnd(s.laiUocThang)} · Phí đáo hạn ~${formatVnd(s.phiDaoHanThang)}`}
              tone={s.laiUocThang + s.phiDaoHanThang > 0 ? 'warn' : undefined} />
            <The label="CHI PHÍ NỢ CẢ NĂM" value={formatVnd(s.chiPhiNam)} sub="Ước tính nếu dư nợ giữ như hiện tại"
              tone={s.chiPhiNam > 0 ? 'warn' : undefined} />
            {s.tyLeSuDungThe !== null && (
              <The label="TỶ LỆ DÙNG THẺ" value={pct(s.tyLeSuDungThe)} sub={`Hạn mức ${formatVnd(s.tongHanMuc)} · nên dưới 30%`}
                tone={s.tyLeSuDungThe > 30 ? 'warn' : undefined} />
            )}
          </div>

          {gan.length > 0 && (
            <section className="surface-card flex flex-col gap-2 p-4">
              <div className="text-[11px] font-bold tracking-[0.09em] text-text-muted dark:text-text-muted-dark">SẮP ĐẾN HẠN (7 NGÀY)</div>
              <ul className="flex flex-col gap-1">
                {gan.map(({ debt, ngay, conNgay }) => (
                  <li key={debt.id} className="flex flex-wrap items-baseline gap-x-3 text-[13px] text-text dark:text-text-dark">
                    <span className={`w-24 font-semibold ${conNgay <= 3 ? 'text-red-600 dark:text-red-400' : ''}`}>
                      {conNgay === 0 ? 'Hôm nay' : `${viDate(ngay).slice(0, 5)} · ${conNgay}n`}
                    </span>
                    <strong>{debt.name}</strong>
                    <span className={mo}>
                      dư nợ {formatVnd(Number(debt.balance_vnd))}
                      {debt.monthly_payment_vnd !== null && ` · định trả ${formatVnd(Number(debt.monthly_payment_vnd))}`}
                      {debt.rolls_over && ' · đáo hạn'}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="surface-card p-4">
            <div className="mb-2 text-[13px] font-semibold text-text dark:text-text-dark">Thêm thẻ / khoản vay</div>
            <DebtForm onSubmit={addDebt} />
          </section>

          {the.length > 0 && (
            <section className="flex flex-col gap-2">
              <div className="text-[15px] font-bold text-text dark:text-text-dark">Thẻ tín dụng</div>
              <div className="overflow-x-auto rounded-xl border border-border bg-surface dark:border-border-dark dark:bg-surface-dark">
                <table className="w-full min-w-[860px] border-collapse">
                  <thead>
                    <tr className="border-b border-border text-right dark:border-border-dark">
                      <th className={`${th} text-left`}>Thẻ</th>
                      <th className={th}>Dư nợ</th>
                      <th className={th}>Hạn mức</th>
                      <th className={th}>% dùng</th>
                      <th className={th}>Sao kê</th>
                      <th className={`${th} text-left`}>Đến hạn</th>
                      <th className={th}>Định trả</th>
                      <th className={th}>Đáo hạn</th>
                      <th className={th}>Lãi %/năm</th>
                      <th className={`${th} text-left`}>Ghi chú</th>
                      <th className={th} />
                    </tr>
                  </thead>
                  <tbody>
                    {the.map((d) => {
                      const duNo = Number(d.balance_vnd);
                      const dung = d.credit_limit_vnd ? (duNo / Number(d.credit_limit_vnd)) * 100 : null;
                      const phi = d.rolls_over && d.rollover_fee_pct !== null ? (duNo * Number(d.rollover_fee_pct)) / 100 : null;
                      return (
                        <Fragment key={d.id}>
                        <tr className="border-b border-border text-right last:border-0 dark:border-border-dark">
                          <td className={`${td} text-left font-semibold`}>{d.name}</td>
                          <td className={`${td} font-mono`}>{formatVnd(duNo)}</td>
                          <td className={`${td} font-mono`}>{d.credit_limit_vnd === null ? '—' : formatVnd(Number(d.credit_limit_vnd))}</td>
                          <td className={`${td} font-mono ${dung !== null && dung > 30 ? 'text-red-600 dark:text-red-400' : ''}`}>{dung === null ? '—' : pct(dung)}</td>
                          <td className={td}>{d.statement_day ?? '—'}</td>
                          <td className={`${td} text-left`}><DenHan debt={d} today={today} /></td>
                          <td className={`${td} font-mono`}>{d.monthly_payment_vnd === null ? '—' : formatVnd(Number(d.monthly_payment_vnd))}</td>
                          <td className={`${td} font-mono`}>
                            {d.rolls_over ? (phi === null ? 'Có' : <span title={`${d.rollover_fee_pct}% dư nợ`}>{formatVnd(phi)}/th</span>) : <span className={mo}>Không</span>}
                          </td>
                          <td className={td}>{d.interest_rate_pct === null ? '—' : pct(Number(d.interest_rate_pct))}</td>
                          <td className={`${td} max-w-[12rem] truncate text-left ${mo}`} title={d.note}>{d.note}</td>
                          {nutDong(d)}
                        </tr>
                        {dongSua(d, 11)}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {vay.length > 0 && (
            <section className="flex flex-col gap-2">
              <div className="text-[15px] font-bold text-text dark:text-text-dark">Khoản vay</div>
              <div className="overflow-x-auto rounded-xl border border-border bg-surface dark:border-border-dark dark:bg-surface-dark">
                <table className="w-full min-w-[760px] border-collapse">
                  <thead>
                    <tr className="border-b border-border text-right dark:border-border-dark">
                      <th className={`${th} text-left`}>Khoản vay</th>
                      <th className={th}>Dư nợ</th>
                      <th className={th}>Trả góp/tháng</th>
                      <th className={th}>Lãi %/năm</th>
                      <th className={`${th} text-left`}>Đến hạn</th>
                      <th className={th}>Tất toán</th>
                      <th className={`${th} text-left`}>Ghi chú</th>
                      <th className={th} />
                    </tr>
                  </thead>
                  <tbody>
                    {vay.map((d) => (
                      <Fragment key={d.id}>
                      <tr className="border-b border-border text-right last:border-0 dark:border-border-dark">
                        <td className={`${td} text-left font-semibold`}>{d.name}</td>
                        <td className={`${td} font-mono`}>{formatVnd(Number(d.balance_vnd))}</td>
                        <td className={`${td} font-mono`}>{d.monthly_payment_vnd === null ? '—' : formatVnd(Number(d.monthly_payment_vnd))}</td>
                        <td className={td}>{d.interest_rate_pct === null ? '—' : pct(Number(d.interest_rate_pct))}</td>
                        <td className={`${td} text-left`}><DenHan debt={d} today={today} /></td>
                        <td className={td}>{d.end_date === null ? '—' : viDate(d.end_date)}</td>
                        <td className={`${td} max-w-[12rem] truncate text-left ${mo}`} title={d.note}>{d.note}</td>
                        {nutDong(d)}
                      </tr>
                      {dongSua(d, 8)}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {debts.length === 0 && (
            <p className={`rounded-xl border border-dashed border-border py-8 text-center text-sm dark:border-border-dark ${mo}`}>
              Chưa có khoản nợ nào. Thêm thẻ tín dụng / khoản vay ở form trên.
            </p>
          )}

          <p className={`text-[12px] leading-relaxed ${mo}`}>
            Lãi ước tính = dư nợ × lãi suất ÷ 12; phí đáo hạn = dư nợ × phí % (chỉ thẻ đánh dấu đáo hạn). Đây là ước tính
            theo dư nợ hiện tại — thẻ trả hết trong kỳ miễn lãi thì không mất lãi thật.
          </p>
        </>
      )}
    </div>
  );
}
