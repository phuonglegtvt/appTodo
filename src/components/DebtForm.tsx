import { useState } from 'react';
import { parseVnNumber } from '../lib/parseNumber';
import type { Debt, DebtKind, NewDebt } from '../types/debt';
import { MoneyInput } from './MoneyInput';

// Form thêm / sửa MỘT khoản nợ. Truyền `initial` để sửa. Ô nào để trống = chưa
// nhập (null), KHÔNG phải 0 — riêng "Dư nợ" bắt buộc (0 = đã trả hết).

interface Props {
  initial?: Debt;
  onSubmit: (v: NewDebt) => Promise<void>;
  onCancel?: () => void;
}

const o = 'rounded-md border border-border bg-surface px-2 py-1.5 text-[13px] text-text outline-none focus:border-primary dark:border-border-dark dark:bg-surface-2dark dark:text-text-dark dark:focus:border-primary-dark';
const so = `${o} text-right font-mono tabular-nums`;
const nhan = 'text-[11px] font-bold uppercase tracking-[0.06em] text-text-muted dark:text-text-muted-dark';
const nut = 'rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-white transition hover:opacity-90 active:scale-95 disabled:opacity-50 dark:bg-primary-dark dark:text-bg-dark';

const chuoi = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v).replace('.', ','));

/** "" → null; số không hợp lệ → NaN để báo lỗi (không lặng lẽ thành null). */
function docSo(t: string): number | null {
  if (t.trim() === '') return null;
  const n = parseVnNumber(t);
  return n === null ? Number.NaN : n;
}

export function DebtForm({ initial, onSubmit, onCancel }: Props) {
  const [kind, setKind] = useState<DebtKind>(initial?.kind ?? 'CARD');
  const [name, setName] = useState(initial?.name ?? '');
  const [duNo, setDuNo] = useState<number | null>(initial ? Number(initial.balance_vnd) : null);
  const [hanMuc, setHanMuc] = useState<number | null>(initial?.credit_limit_vnd ?? null);
  const [traThang, setTraThang] = useState<number | null>(initial?.monthly_payment_vnd ?? null);
  const [lai, setLai] = useState(chuoi(initial?.interest_rate_pct));
  const [saoKe, setSaoKe] = useState(chuoi(initial?.statement_day));
  const [denHan, setDenHan] = useState(chuoi(initial?.due_day));
  const [daoHan, setDaoHan] = useState(initial?.rolls_over ?? false);
  const [phiDaoHan, setPhiDaoHan] = useState(chuoi(initial?.rollover_fee_pct));
  const [tatToan, setTatToan] = useState(initial?.end_date ?? '');
  const [ghiChu, setGhiChu] = useState(initial?.note ?? '');
  const [dangLuu, setDangLuu] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);

  const laThe = kind === 'CARD';

  async function gui(e: React.FormEvent) {
    e.preventDefault();
    setLoi(null);
    const laiN = docSo(lai);
    const saoKeN = laThe ? docSo(saoKe) : null;
    const denHanN = docSo(denHan);
    const phiN = laThe && daoHan ? docSo(phiDaoHan) : null;
    if (!name.trim()) return setLoi('Nhập tên thẻ / khoản vay (VD: VPBank, Vay Techcombank).');
    if (duNo === null || duNo < 0) return setLoi('Nhập dư nợ hiện tại (0 nếu đã trả hết).');
    if ([hanMuc, traThang].some((v) => v !== null && v < 0)) return setLoi('Số tiền không được âm.');
    if (laiN !== null && (Number.isNaN(laiN) || laiN < 0)) return setLoi('Lãi suất phải là số ≥ 0 (%/năm).');
    if (phiN !== null && (Number.isNaN(phiN) || phiN < 0)) return setLoi('Phí đáo hạn phải là số ≥ 0 (%).');
    for (const [ten, v] of [['Ngày sao kê', saoKeN], ['Ngày đến hạn', denHanN]] as const) {
      if (v !== null && (!Number.isInteger(v) || v < 1 || v > 31)) return setLoi(`${ten} phải là số nguyên từ 1 đến 31.`);
    }
    setDangLuu(true);
    try {
      await onSubmit({
        kind,
        name: name.trim(),
        balance_vnd: duNo,
        credit_limit_vnd: laThe ? hanMuc : null,
        monthly_payment_vnd: traThang,
        interest_rate_pct: laiN,
        statement_day: saoKeN,
        due_day: denHanN,
        rolls_over: laThe && daoHan,
        rollover_fee_pct: phiN,
        end_date: !laThe && tatToan ? tatToan : null,
        note: ghiChu.trim(),
      });
      if (!initial) {
        setName(''); setDuNo(null); setHanMuc(null); setTraThang(null); setLai('');
        setSaoKe(''); setDenHan(''); setDaoHan(false); setPhiDaoHan(''); setTatToan(''); setGhiChu('');
      }
    } catch (err) {
      console.error('Lỗi lưu khoản nợ:', err);
      setLoi(err instanceof Error ? err.message : String(err));
    } finally {
      setDangLuu(false);
    }
  }

  const loaiNut = (k: DebtKind, label: string) => (
    <button type="button" onClick={() => setKind(k)} aria-pressed={kind === k}
      className={`rounded-md px-3 py-1 text-[12.5px] font-semibold ${kind === k ? 'bg-primary text-white dark:bg-primary-dark dark:text-bg-dark' : 'text-text-muted dark:text-text-muted-dark'}`}>
      {label}
    </button>
  );

  return (
    <form onSubmit={gui} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <span className={nhan}>Loại</span>
          <div className="flex gap-0.5 rounded-lg border border-border bg-surface p-0.5 dark:border-border-dark dark:bg-surface-dark">
            {loaiNut('CARD', 'Thẻ tín dụng')}
            {loaiNut('LOAN', 'Khoản vay')}
          </div>
        </div>
        <label className="flex flex-col gap-1">
          <span className={nhan}>Tên</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={laThe ? 'VPBank, HSBC…' : 'Vay Techcombank…'} className={`w-40 ${o}`} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={nhan}>Dư nợ hiện tại (đ)</span>
          <MoneyInput value={duNo} onChange={setDuNo} className={`w-36 ${so}`} />
        </label>
        {laThe && (
          <label className="flex flex-col gap-1">
            <span className={nhan}>Hạn mức (đ)</span>
            <MoneyInput value={hanMuc} onChange={setHanMuc} className={`w-36 ${so}`} />
          </label>
        )}
        <label className="flex flex-col gap-1">
          <span className={nhan}>{laThe ? 'Định trả/tháng (đ)' : 'Trả góp/tháng (đ)'}</span>
          <MoneyInput value={traThang} onChange={setTraThang} className={`w-36 ${so}`} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={nhan}>Lãi %/năm</span>
          <input value={lai} onChange={(e) => setLai(e.target.value)} inputMode="decimal" placeholder={laThe ? '30' : '10,5'} className={`w-20 ${so}`} />
        </label>
        {laThe && (
          <label className="flex flex-col gap-1">
            <span className={nhan}>Ngày sao kê</span>
            <input value={saoKe} onChange={(e) => setSaoKe(e.target.value)} inputMode="numeric" placeholder="20" className={`w-20 ${so}`} />
          </label>
        )}
        <label className="flex flex-col gap-1">
          <span className={nhan}>Ngày đến hạn</span>
          <input value={denHan} onChange={(e) => setDenHan(e.target.value)} inputMode="numeric" placeholder="10" className={`w-20 ${so}`} />
        </label>
        {laThe ? (
          <div className="flex flex-col gap-1">
            <span className={nhan}>Đáo hạn hàng tháng</span>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={daoHan} onChange={(e) => setDaoHan(e.target.checked)} aria-label="Thẻ có đáo hạn hàng tháng" className="h-4 w-4" />
              <input value={phiDaoHan} onChange={(e) => setPhiDaoHan(e.target.value)} disabled={!daoHan} inputMode="decimal" placeholder="phí %" aria-label="Phí đáo hạn (%)" className={`w-20 ${so} disabled:opacity-40`} />
            </div>
          </div>
        ) : (
          <label className="flex flex-col gap-1">
            <span className={nhan}>Ngày tất toán</span>
            <input type="date" value={tatToan} onChange={(e) => setTatToan(e.target.value)} className={`w-36 ${o}`} />
          </label>
        )}
        <label className="flex min-w-[10rem] flex-1 flex-col gap-1">
          <span className={nhan}>Ghi chú</span>
          <input value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} placeholder="Không bắt buộc" className={o} />
        </label>
      </div>
      {loi !== null && <p role="alert" className="text-[13px] text-red-600 dark:text-red-400">⚠ {loi}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={dangLuu} className={nut}>{dangLuu ? 'Đang lưu…' : initial ? 'Lưu thay đổi' : 'Thêm'}</button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-lg px-4 py-1.5 text-sm font-semibold text-text-muted hover:text-text dark:text-text-muted-dark dark:hover:text-text-dark">Huỷ</button>
        )}
      </div>
    </form>
  );
}
