import { useState } from 'react';
import type { Crypto, CryptoUpdate, Currency } from '../types/crypto';
import { CryptoRow } from './CryptoRow';
import { SortableTh } from './SortableTh';
import { nextSort, sortRows, type SortState } from '../lib/tableSort';
import { CRYPTO_COLUMNS, cryptoSortValue, type CryptoSortKey } from '../lib/cryptoSort';

interface Props {
  cryptos: Crypto[];
  currency: Currency;
  rate: number | null;
  onUpdate: (id: string, patch: CryptoUpdate) => void;
  onDelete: (id: string) => void;
}

const th = 'px-2 py-2 text-left text-[11px] font-bold tracking-[0.06em] text-text-muted dark:text-text-muted-dark';

/** Bảng coin: mã, tên, số lượng, giá mua TB, giá hiện tại, đỉnh lịch sử, % so đỉnh, giá trị, lời/lỗ. */
export function CryptoTable({ cryptos, currency, rate, onUpdate, onDelete }: Props) {
  // Sort chỉ trong bộ nhớ trang, không ghi xuống `sort_order`.
  // Thứ tự KHÔNG phụ thuộc `currency`/`rate`: quy đổi USD→VND là nhân một hằng
  // số dương nên đổi đơn vị hiển thị không làm bảng nhảy thứ tự.
  const [sort, setSort] = useState<SortState<CryptoSortKey> | null>(null);
  const doiSort = (key: CryptoSortKey) => setSort((cu) => nextSort(cu, key));

  const rows = sortRows(cryptos, sort, cryptoSortValue);

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-xl border border-border dark:border-border-dark">
        <table className="w-full min-w-[900px] border-collapse">
          <thead>
            <tr className="bg-surface-2 dark:bg-surface-2dark">
              {CRYPTO_COLUMNS.map((c) => (
                <SortableTh
                  key={c.key}
                  colKey={c.key}
                  label={c.label}
                  sort={sort}
                  onSort={doiSort}
                  className={th}
                />
              ))}
              <th className={th}></th>
            </tr>
          </thead>
          <tbody className="bg-surface dark:bg-surface-dark">
            {rows.map((c) => (
              <CryptoRow
                key={c.id}
                crypto={c}
                currency={currency}
                rate={rate}
                onUpdate={onUpdate}
                onDelete={onDelete}
              />
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-text-muted dark:text-text-muted-dark">
        <span className="font-semibold text-green-600 dark:text-green-400">Xanh</span> = lãi ·{' '}
        <span className="font-semibold text-red-600 dark:text-red-400">Đỏ</span> = lỗ ·{' '}
        <strong>Sắp xếp</strong>: bấm tiêu đề cột (tăng → giảm → bỏ), ô chưa nhập nằm cuối
      </p>
    </div>
  );
}
