import type { Crypto, CryptoUpdate, Currency } from '../types/crypto';
import { CryptoRow } from './CryptoRow';

interface Props {
  cryptos: Crypto[];
  currency: Currency;
  rate: number | null;
  onUpdate: (id: string, patch: CryptoUpdate) => void;
  onDelete: (id: string) => void;
}

const th = 'px-2 py-2 text-left text-[11px] font-bold tracking-[0.06em] text-text-muted dark:text-text-muted-dark';

/** Bảng coin: mã, tên, số lượng, giá mua TB, giá hiện tại, giá trị, lời/lỗ. */
export function CryptoTable({ cryptos, currency, rate, onUpdate, onDelete }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-xl border border-border dark:border-border-dark">
        <table className="w-full min-w-[760px] border-collapse">
          <thead>
            <tr className="bg-surface-2 dark:bg-surface-2dark">
              <th className={th}>Mã</th>
              <th className={th}>Tên</th>
              <th className={th}>Số lượng</th>
              <th className={th}>Giá mua TB</th>
              <th className={th}>Giá hiện tại</th>
              <th className={th}>Giá trị</th>
              <th className={th}>Lời/Lỗ</th>
              <th className={th}></th>
            </tr>
          </thead>
          <tbody className="bg-surface dark:bg-surface-dark">
            {cryptos.map((c) => (
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
        <span className="font-semibold text-red-600 dark:text-red-400">Đỏ</span> = lỗ
      </p>
    </div>
  );
}
