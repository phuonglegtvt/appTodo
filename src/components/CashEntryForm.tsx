import { useState } from 'react';
import { danhMucTheoLoai } from '../lib/cashCategories';
import { kiemTraKhoan } from '../lib/cashEntryInput';
import type { CashKind, NewCashEntry } from '../types/cashEntry';

interface Props {
  /** Ngày mặc định (ISO 'YYYY-MM-DD'). Truyền vào để component không tự gọi Date. */
  homNay: string;
  onAdd: (input: NewCashEntry) => Promise<void>;
}

const O = 'rounded-md border border-border bg-surface px-2.5 py-2 text-[13px] text-text outline-none transition-colors focus:border-primary dark:border-border-dark dark:bg-surface-2dark dark:text-text-dark dark:focus:border-primary-dark';

/** Danh mục đầu tiên của một nhóm — dùng khi đổi Thu↔Chi. */
function danhMucDau(kind: CashKind): string {
  return danhMucTheoLoai(kind)[0].key;
}

/** Form thêm một khoản thu hoặc chi. Mọi kiểm tra đầu vào nằm ở `kiemTraKhoan`. */
export function CashEntryForm({ homNay, onAdd }: Props) {
  const [ngay, setNgay] = useState(homNay);
  const [kind, setKind] = useState<CashKind>('CHI');
  const [category, setCategory] = useState(() => danhMucDau('CHI'));
  const [soTien, setSoTien] = useState('');
  const [note, setNote] = useState('');
  const [loi, setLoi] = useState<string | null>(null);

  // Đổi Thu↔Chi phải đổi luôn danh mục: giữ danh mục cũ sẽ thành cặp lệch
  // (loại Thu + danh mục của Chi) mà `kiemTraKhoan` từ chối.
  function doiLoai(k: CashKind) {
    setKind(k);
    setCategory(danhMucDau(k));
    setLoi(null);
  }

  async function them() {
    const kq = kiemTraKhoan({ occurred_on: ngay, kind, category, amountText: soTien, note });
    if (!kq.ok) {
      setLoi(kq.loi);
      return;
    }
    setLoi(null);
    try {
      await onAdd(kq.entry);
      // Giữ lại ngày và loại: nhập nhiều khoản cùng ngày là ca thường gặp nhất.
      setSoTien('');
      setNote('');
    } catch (err) {
      console.error('Lỗi thêm khoản thu-chi:', err);
      setLoi(err instanceof Error ? err.message : String(err));
    }
  }

  const nutLoai = (k: CashKind, mauBat: string) =>
    `rounded-md px-3 py-2 text-[13px] font-semibold transition-colors ${
      kind === k ? mauBat : 'bg-surface-2 text-text-muted dark:bg-surface-2dark dark:text-text-muted-dark'
    }`;

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3 dark:border-border-dark dark:bg-surface-dark">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={ngay}
          onChange={(e) => setNgay(e.target.value)}
          aria-label="Ngày phát sinh"
          className={O}
        />

        <div className="flex gap-1" role="group" aria-label="Loại khoản">
          <button
            type="button"
            onClick={() => doiLoai('THU')}
            aria-pressed={kind === 'THU'}
            className={nutLoai('THU', 'bg-green-600 text-white dark:bg-green-500')}
          >
            + Thu
          </button>
          <button
            type="button"
            onClick={() => doiLoai('CHI')}
            aria-pressed={kind === 'CHI'}
            className={nutLoai('CHI', 'bg-red-600 text-white dark:bg-red-500')}
          >
            − Chi
          </button>
        </div>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Danh mục"
          className={O}
        >
          {danhMucTheoLoai(kind).map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}{c.laVongTien === true ? ' ⟳' : ''}
            </option>
          ))}
        </select>

        <input
          value={soTien}
          onChange={(e) => setSoTien(e.target.value)}
          placeholder="12.000.000"
          inputMode="numeric"
          aria-label="Số tiền (đồng)"
          className={`${O} w-40 text-right font-mono tabular-nums`}
        />

        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ghi chú (không bắt buộc)"
          aria-label="Ghi chú"
          className={`${O} min-w-[180px] flex-1`}
        />

        <button
          type="button"
          onClick={them}
          className="rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-white shadow-soft transition hover:shadow-md active:scale-95 dark:bg-primary-dark dark:text-bg-dark dark:shadow-soft-dark"
        >
          Thêm
        </button>
      </div>

      {loi !== null && (
        <p role="alert" className="text-[13px] text-red-600 dark:text-red-400">⚠ {loi}</p>
      )}
    </section>
  );
}
