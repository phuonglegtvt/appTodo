import { useState } from 'react';
import { danhMucTheoLoai, nhanDanhMuc } from '../lib/cashCategories';
import { canGhiDinhKy, type KhoanDinhKy } from '../lib/cashPlanning';
import { nhanThang } from '../lib/cashFlow';
import { formatVnd } from '../lib/portfolioClassMeta';
import type { CashEntry, CashKind, NewCashEntry } from '../types/cashEntry';
import type { NewKhoanDinhKy } from '../hooks/useCashPlanning';
import { MoneyInput } from './MoneyInput';

// Khoản định kỳ hàng tháng (lương, trả vay, tiền nhà…). Nút "Ghi …" tạo các
// dòng thu–chi cho tháng đang xem — chỉ những khoản CHƯA ghi tháng đó
// (canGhiDinhKy, có test), nên bấm lại không bị trùng.

interface Props {
  recurring: KhoanDinhKy[];
  entries: CashEntry[];
  thang: string;
  onAdd: (k: NewKhoanDinhKy) => Promise<void>;
  onUpdate: (id: string, patch: Partial<NewKhoanDinhKy>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onGhi: (inputs: NewCashEntry[]) => Promise<void>;
}

const mo = 'text-text-muted dark:text-text-muted-dark';
const o = 'rounded-md border border-border bg-surface px-2 py-1.5 text-[13px] text-text outline-none focus:border-primary dark:border-border-dark dark:bg-surface-2dark dark:text-text-dark dark:focus:border-primary-dark';

export function CashRecurringSection({ recurring, entries, thang, onAdd, onUpdate, onDelete, onGhi }: Props) {
  const [kind, setKind] = useState<CashKind>('CHI');
  const [category, setCategory] = useState(danhMucTheoLoai('CHI')[0].key);
  const [tien, setTien] = useState<number | null>(null);
  const [ngay, setNgay] = useState('10');
  const [ghiChu, setGhiChu] = useState('');
  const [loi, setLoi] = useState<string | null>(null);
  const [xong, setXong] = useState<string | null>(null);
  const [dangGhi, setDangGhi] = useState(false);

  const canGhi = canGhiDinhKy(recurring, entries, thang);

  async function chay(fn: () => Promise<void>) {
    setLoi(null); setXong(null);
    try { await fn(); } catch (err) {
      console.error('Lỗi khoản định kỳ:', err);
      setLoi(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <section className="surface-card flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[15px] font-bold text-text dark:text-text-dark">Khoản định kỳ hàng tháng</div>
        {recurring.length > 0 && (
          <button
            disabled={canGhi.length === 0 || dangGhi}
            onClick={() => void chay(async () => {
              setDangGhi(true);
              try { await onGhi(canGhi); setXong(`Đã ghi ${canGhi.length} khoản cho ${nhanThang(thang).toLowerCase()}.`); } finally { setDangGhi(false); }
            })}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50 dark:bg-primary-dark dark:text-bg-dark"
          >
            {canGhi.length === 0 ? `Đã ghi đủ ${nhanThang(thang).toLowerCase()}` : `Ghi ${canGhi.length} khoản định kỳ ${nhanThang(thang).toLowerCase()}`}
          </button>
        )}
      </div>
      {recurring.length === 0 ? (
        <p className={`text-[13px] ${mo}`}>Chưa có khoản định kỳ. Thêm lương, trả vay, tiền nhà… để mỗi tháng chỉ cần bấm một nút.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {recurring.map((k) => (
            <li key={k.id} className={`flex flex-wrap items-center gap-x-3 text-[13px] ${k.active ? '' : 'opacity-50'}`}>
              <span className={`w-16 ${mo}`}>ngày {k.day_of_month}</span>
              <span className={k.kind === 'THU' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>{k.kind === 'THU' ? '+' : '−'}{formatVnd(k.amount_vnd)}</span>
              <span className="font-semibold text-text dark:text-text-dark">{nhanDanhMuc(k.category)}</span>
              {k.note && <span className={mo}>· {k.note}</span>}
              <span className="ml-auto flex gap-1">
                <button onClick={() => void chay(() => onUpdate(k.id, { active: !k.active }))} className={`rounded px-2 text-[12px] ${mo} hover:text-text`}>{k.active ? 'Tạm dừng' : 'Bật lại'}</button>
                <button onClick={() => { if (confirm('Xoá khoản định kỳ này? Các dòng đã ghi vẫn giữ.')) void chay(() => onDelete(k.id)); }} className={`rounded px-2 text-[12px] ${mo} hover:text-red-600`}>Xoá</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => {
        e.preventDefault();
        const d = Number(ngay);
        if (tien === null || tien <= 0) { setLoi('Nhập số tiền.'); return; }
        if (!Number.isInteger(d) || d < 1 || d > 31) { setLoi('Ngày trong tháng phải từ 1 đến 31.'); return; }
        void chay(async () => { await onAdd({ kind, category, amount_vnd: tien, day_of_month: d, note: ghiChu.trim(), active: true }); setTien(null); setGhiChu(''); });
      }}>
        <select value={kind} onChange={(e) => { const k = e.target.value as CashKind; setKind(k); setCategory(danhMucTheoLoai(k)[0].key); }} aria-label="Thu hay chi" className={o}>
          <option value="CHI">Chi</option><option value="THU">Thu</option>
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Danh mục" className={o}>
          {danhMucTheoLoai(kind).map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <MoneyInput value={tien} onChange={setTien} className={`w-32 text-right font-mono ${o}`} />
        <label className={`flex items-center gap-1 text-[13px] ${mo}`}>ngày
          <input value={ngay} onChange={(e) => setNgay(e.target.value)} inputMode="numeric" className={`w-14 text-right ${o}`} aria-label="Ngày trong tháng" />
        </label>
        <input value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} placeholder="Ghi chú (VD: Vay Techcombank)" className={`min-w-[10rem] flex-1 ${o}`} />
        <button type="submit" className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-text hover:bg-surface-2 dark:border-border-dark dark:text-text-dark dark:hover:bg-surface-2dark">Thêm khoản định kỳ</button>
      </form>
      {loi && <p role="alert" className="text-[13px] text-red-600 dark:text-red-400">⚠ {loi}</p>}
      {xong && <p role="status" className="text-[13px] text-green-600 dark:text-green-400">✓ {xong}</p>}
    </section>
  );
}
