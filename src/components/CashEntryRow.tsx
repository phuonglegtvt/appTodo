import { useState } from 'react';
import { danhMucTheoLoai, laVongTien, nhanDanhMuc } from '../lib/cashCategories';
import { kiemTraKhoan } from '../lib/cashEntryInput';
import { formatVnd } from '../lib/portfolioClassMeta';
import type { CashEntry, CashEntryUpdate, CashKind } from '../types/cashEntry';

interface Props {
  entry: CashEntry;
  onUpdate: (id: string, patch: CashEntryUpdate) => void;
  onDelete: (id: string) => void;
}

const cell = 'px-2 py-2 text-[13px] text-text dark:text-text-dark';
const O = 'rounded border border-border bg-surface px-1.5 py-1 text-[13px] outline-none focus:border-primary dark:border-border-dark dark:bg-surface-2dark dark:text-text-dark';

/** '2026-09-13' → '13/09'. Cắt chuỗi chứ không dựng Date (Date đọc theo UTC, lệch ngày). */
function ngayNgan(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/** Một dòng thu–chi: hiển thị hoặc sửa inline. */
export function CashEntryRow({ entry, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [ngay, setNgay] = useState('');
  const [kind, setKind] = useState<CashKind>('CHI');
  const [category, setCategory] = useState('');
  const [soTien, setSoTien] = useState('');
  const [note, setNote] = useState('');
  const [loi, setLoi] = useState<string | null>(null);

  function batDauSua() {
    setNgay(entry.occurred_on);
    setKind(entry.kind);
    setCategory(entry.category);
    setSoTien(String(entry.amount_vnd));
    setNote(entry.note);
    setLoi(null);
    setEditing(true);
  }

  function luu() {
    const kq = kiemTraKhoan({ occurred_on: ngay, kind, category, amountText: soTien, note });
    if (!kq.ok) {
      setLoi(kq.loi);
      return;
    }
    onUpdate(entry.id, {
      occurred_on: kq.entry.occurred_on,
      kind: kq.entry.kind,
      category: kq.entry.category,
      amount_vnd: kq.entry.amount_vnd,
      note: kq.entry.note,
    });
    setEditing(false);
  }

  function doiLoai(k: CashKind) {
    setKind(k);
    setCategory(danhMucTheoLoai(k)[0].key);
  }

  if (editing) {
    return (
      <tr className="border-t border-border dark:border-border-dark">
        <td className={cell}>
          <input type="date" value={ngay} onChange={(e) => setNgay(e.target.value)} aria-label="Ngày" className={O} />
        </td>
        <td className={cell}>
          <select
            value={kind}
            onChange={(e) => doiLoai(e.target.value as CashKind)}
            aria-label="Loại"
            className={O}
          >
            <option value="THU">Thu</option>
            <option value="CHI">Chi</option>
          </select>
        </td>
        <td className={cell}>
          <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Danh mục" className={O}>
            {danhMucTheoLoai(kind).map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
        </td>
        <td className={cell}>
          <input value={note} onChange={(e) => setNote(e.target.value)} aria-label="Ghi chú" className={`${O} w-full`} />
        </td>
        <td className={`${cell} text-right`}>
          <input
            value={soTien}
            onChange={(e) => setSoTien(e.target.value)}
            inputMode="numeric"
            aria-label="Số tiền"
            className={`${O} w-36 text-right font-mono tabular-nums`}
          />
        </td>
        <td className={`${cell} whitespace-nowrap text-right`}>
          <button onClick={luu} className="mr-2 font-semibold text-primary dark:text-primary-dark">Lưu</button>
          <button onClick={() => setEditing(false)} className="text-text-muted dark:text-text-muted-dark">Hủy</button>
          {loi !== null && (
            <div role="alert" className="mt-1 text-[11px] font-normal text-red-600 dark:text-red-400">⚠ {loi}</div>
          )}
        </td>
      </tr>
    );
  }

  const vongTien = entry.kind === 'CHI' && laVongTien(entry.category);
  const mauTien = vongTien
    ? 'text-amber-600 dark:text-amber-400'
    : entry.kind === 'THU'
      ? 'text-green-600 dark:text-green-400'
      : 'text-red-600 dark:text-red-400';
  // Vòng tiền không mang dấu +/−: nó không cộng vào thu cũng không vào chi.
  const dau = vongTien ? '⟳ ' : entry.kind === 'THU' ? '+' : '−';

  return (
    <tr className="border-t border-border dark:border-border-dark">
      <td className={`${cell} whitespace-nowrap tabular-nums text-text-muted dark:text-text-muted-dark`}>
        {ngayNgan(entry.occurred_on)}
      </td>
      <td className={`${cell} whitespace-nowrap`}>
        {entry.kind === 'THU' ? 'Thu' : 'Chi'}
      </td>
      <td className={cell}>
        {nhanDanhMuc(entry.category)}
        {vongTien && (
          <span
            title="Vòng tiền — tiền ra rồi quay về ví, không tính vào tổng chi"
            className="ml-1 text-[11px] text-amber-600 dark:text-amber-400"
          >
            ⟳
          </span>
        )}
      </td>
      <td className={`${cell} text-text-muted dark:text-text-muted-dark`}>{entry.note || '—'}</td>
      <td className={`${cell} whitespace-nowrap text-right font-mono font-semibold tabular-nums ${mauTien}`}>
        {dau}{formatVnd(entry.amount_vnd)}
      </td>
      <td className={`${cell} whitespace-nowrap text-right`}>
        <button
          onClick={batDauSua}
          aria-label={`Sửa khoản ${nhanDanhMuc(entry.category)} ngày ${entry.occurred_on}`}
          className="mr-2 text-text-muted hover:text-primary dark:text-text-muted-dark dark:hover:text-primary-dark"
        >
          ✎
        </button>
        <button
          onClick={() => onDelete(entry.id)}
          aria-label={`Xoá khoản ${nhanDanhMuc(entry.category)} ngày ${entry.occurred_on}`}
          className="text-text-muted hover:text-red-500 dark:text-text-muted-dark"
        >
          ✕
        </button>
      </td>
    </tr>
  );
}
