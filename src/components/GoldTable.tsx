import { useState } from 'react';
import { parseVnNumber, parseVndAmount } from '../lib/parseNumber';
import { SortableTh } from './SortableTh';
import { nextSort, sortRows, type SortState } from '../lib/tableSort';
import { GOLD_COLUMNS, goldSortValue, type GoldSortKey } from '../lib/goldSort';
import { formatVnd } from '../lib/portfolioClassMeta';
import type { Gold, NewGold, GoldUpdate } from '../types/gold';

// Bảng vàng: thêm / sửa / xoá. Vàng không có tab riêng nên chỗ nhập nằm ngay
// trong tab Danh mục.
//
// ⚠️ ĐƠN VỊ: giá là ĐỒNG trên MỘT LƯỢNG, KHÔNG phải nghìn đồng (khác `stocks`).
// Nhãn ô nhập nói rõ để không ai gõ 90.000 khi ý là 90.000.000.

interface Props {
  golds: Gold[];
  onAdd: (input: NewGold) => Promise<void>;
  onUpdate: (id: string, patch: GoldUpdate) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const O = 'w-full rounded-md border border-border bg-surface px-2 py-1.5 text-[13px] text-text outline-none focus:border-primary dark:border-border-dark dark:bg-surface-2dark dark:text-text-dark dark:focus:border-primary-dark';
const O_SO = `${O} text-right font-mono tabular-nums`;
const TH = 'px-2 py-2 text-[11px] font-bold uppercase tracking-[0.06em] text-text-muted dark:text-text-muted-dark';

export function GoldTable({ golds, onAdd, onUpdate, onDelete }: Props) {
  const [label, setLabel] = useState('');
  const [soLuong, setSoLuong] = useState('');
  const [giaMua, setGiaMua] = useState('');
  const [giaNay, setGiaNay] = useState('');
  const [daDauTu, setDaDauTu] = useState('');
  const [loi, setLoi] = useState<string | null>(null);
  // Sort chỉ trong bộ nhớ trang, không ghi xuống `sort_order`.
  // Dòng "Thêm" ở cuối bảng nằm NGOÀI danh sách này nên luôn ở cuối, không bị
  // sắp lẫn vào giữa các dòng vàng.
  const [sort, setSort] = useState<SortState<GoldSortKey> | null>(null);
  const doiSort = (key: GoldSortKey) => setSort((cu) => nextSort(cu, key));
  const rows = sortRows(golds, sort, goldSortValue);

  async function them() {
    setLoi(null);
    if (label.trim() === '') {
      setLoi('Chưa nhập tên loại vàng.');
      return;
    }
    try {
      await onAdd({
        label: label.trim(),
        quantity: parseVnNumber(soLuong),
        avg_buy_price: parseVndAmount(giaMua),
        current_price: parseVndAmount(giaNay),
        invested_amount: parseVndAmount(daDauTu),
      });
      setLabel(''); setSoLuong(''); setGiaMua(''); setGiaNay(''); setDaDauTu('');
    } catch (err) {
      console.error('Lỗi thêm vàng:', err);
      setLoi(err instanceof Error ? err.message : String(err));
    }
  }

  /** Sửa inline: ô trống → null (CHƯA NHẬP), không phải 0. */
  function suaSo(
    g: Gold, khoa: 'quantity' | 'avg_buy_price' | 'current_price' | 'invested_amount', v: string,
  ) {
    const n = khoa === 'quantity' ? parseVnNumber(v) : parseVndAmount(v);
    void onUpdate(g.id, { [khoa]: n } as GoldUpdate);
  }

  const hienSo = (v: number | null) => (v === null ? '' : String(v));

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-bold text-text dark:text-text-dark">Vàng đang giữ</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-text-muted dark:text-text-muted-dark">
          Giá nhập bằng <strong>đồng trên một lượng</strong> (ví dụ 90.000.000), không
          phải nghìn đồng. Ô để trống nghĩa là <em>chưa nhập</em> — khác với 0.
          Cột <strong>Đã đầu tư</strong> là tổng tiền đã bỏ ra (đồng) — nhập cột này
          thì tab Thu–Chi tính được cả dòng chưa nhập số lượng.
          Bấm tiêu đề cột để sắp xếp (tăng → giảm → bỏ).
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border dark:border-border-dark">
              {GOLD_COLUMNS.map((c, i) => (
                <SortableTh
                  key={c.key}
                  colKey={c.key}
                  label={c.label}
                  sort={sort}
                  onSort={doiSort}
                  /* Cột đầu (Loại) canh trái, các cột số canh phải — giữ đúng
                     canh lề cũ của bảng. */
                  className={i === 0 ? TH : `${TH} text-right`}
                />
              ))}
              <th className={TH} />
            </tr>
          </thead>
          <tbody>
            {rows.map((g) => {
              const giaTri = g.quantity !== null && g.current_price !== null
                ? g.quantity * g.current_price
                : null;
              return (
                <tr key={g.id} className="border-b border-border last:border-0 dark:border-border-dark">
                  <td className="px-2 py-2 text-sm text-text dark:text-text-dark">{g.label}</td>
                  <td className="w-28 px-2 py-2">
                    <input
                      defaultValue={hienSo(g.quantity)}
                      onBlur={(e) => suaSo(g, 'quantity', e.target.value)}
                      inputMode="decimal" aria-label={`${g.label} — số lượng`} className={O_SO}
                    />
                  </td>
                  <td className="w-40 px-2 py-2">
                    <input
                      defaultValue={hienSo(g.avg_buy_price)}
                      onBlur={(e) => suaSo(g, 'avg_buy_price', e.target.value)}
                      inputMode="numeric" aria-label={`${g.label} — giá mua trung bình`} className={O_SO}
                    />
                  </td>
                  <td className="w-40 px-2 py-2">
                    <input
                      defaultValue={hienSo(g.current_price)}
                      onBlur={(e) => suaSo(g, 'current_price', e.target.value)}
                      inputMode="numeric" aria-label={`${g.label} — giá hiện tại`} className={O_SO}
                    />
                  </td>
                  <td className="w-40 px-2 py-2">
                    <input
                      defaultValue={hienSo(g.invested_amount)}
                      onBlur={(e) => suaSo(g, 'invested_amount', e.target.value)}
                      inputMode="numeric" aria-label={`${g.label} — đã đầu tư`} className={O_SO}
                    />
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-[13px] tabular-nums text-text dark:text-text-dark">
                    {giaTri === null ? '—' : formatVnd(giaTri)}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <button
                      onClick={() => void onDelete(g.id)}
                      aria-label={`Xoá ${g.label}`}
                      className="btn-icon h-7 w-7 text-sm"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}

            <tr>
              <td className="px-2 py-2">
                <input
                  value={label} onChange={(e) => setLabel(e.target.value)}
                  placeholder="SJC 1 lượng" aria-label="Tên loại vàng mới" className={O}
                />
              </td>
              <td className="px-2 py-2">
                <input
                  value={soLuong} onChange={(e) => setSoLuong(e.target.value)}
                  placeholder="2" inputMode="decimal" aria-label="Số lượng" className={O_SO}
                />
              </td>
              <td className="px-2 py-2">
                <input
                  value={giaMua} onChange={(e) => setGiaMua(e.target.value)}
                  placeholder="75.000.000" inputMode="numeric" aria-label="Giá mua trung bình" className={O_SO}
                />
              </td>
              <td className="px-2 py-2">
                <input
                  value={giaNay} onChange={(e) => setGiaNay(e.target.value)}
                  placeholder="90.000.000" inputMode="numeric" aria-label="Giá hiện tại" className={O_SO}
                />
              </td>
              <td className="px-2 py-2">
                <input
                  value={daDauTu} onChange={(e) => setDaDauTu(e.target.value)}
                  placeholder="150.000.000" inputMode="numeric" aria-label="Đã đầu tư" className={O_SO}
                />
              </td>
              <td colSpan={2} className="px-2 py-2">
                <button
                  onClick={them}
                  className="rounded-lg bg-primary px-3 py-1.5 text-[13px] font-semibold text-white transition ease-out hover:opacity-90 active:scale-95 dark:bg-primary-dark dark:text-bg-dark"
                >
                  Thêm
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {loi !== null && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">⚠ {loi}</p>
      )}
    </section>
  );
}
