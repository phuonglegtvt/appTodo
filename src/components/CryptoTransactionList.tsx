import { Fragment, useState } from 'react';
import type { Crypto } from '../types/crypto';
import type { CryptoTransaction, NewCryptoTransaction } from '../types/cryptoTransaction';
import { CryptoTransactionEditRow } from './CryptoTransactionEditRow';

// Sổ giao dịch crypto, mới nhất trước. Mọi giao dịch đều Sửa / Xoá được (kể cả
// đổi coin): các giao dịch ghi sau nó của cùng coin được tính lại
// (lib/txChain.ts). Xoá giao dịch mới nhất của một coin = hoàn tác nó.

interface Props {
  transactions: CryptoTransaction[];
  cryptos: Crypto[];
  onDelete: (txId: string) => Promise<void>;
  onEdit: (txId: string, coin: Crypto, input: NewCryptoTransaction) => Promise<void>;
}

function vnd(v: number): string {
  return Math.round(v).toLocaleString('vi-VN') + ' đ';
}

const th = 'px-2 py-2 text-[11px] font-bold uppercase tracking-[0.06em] text-text-muted dark:text-text-muted-dark';
const td = 'px-2 py-2 text-[13px] tabular-nums text-text dark:text-text-dark';

export function CryptoTransactionList({ transactions, cryptos, onDelete, onEdit }: Props) {
  const [dangXoa, setDangXoa] = useState<string | null>(null);
  const [loi, setLoi] = useState<string | null>(null);
  const [dangSua, setDangSua] = useState<string | null>(null);

  const kyHieu = new Map(cryptos.map((c) => [c.id, c.symbol]));

  async function xoa(t: CryptoTransaction) {
    const ten = kyHieu.get(t.crypto_id) ?? 'coin';
    const ngay = t.trade_date.split('-').reverse().join('/');
    if (!confirm(
      `Xoá giao dịch ${t.side === 'BUY' ? 'mua' : 'bán'} ${Number(t.quantity).toLocaleString('vi-VN', { maximumFractionDigits: 8 })} ${ten} ngày ${ngay}?\n\n`
      + `Số lượng, giá mua TB và vốn của ${ten} sẽ tính lại như thể giao dịch này chưa từng được ghi. Không khôi phục lại được.`,
    )) return;
    setLoi(null);
    setDangXoa(t.id);
    try {
      await onDelete(t.id);
      if (dangSua === t.id) setDangSua(null);
    } catch (err) {
      console.error('Lỗi xoá giao dịch crypto:', err);
      setLoi(err instanceof Error ? err.message : String(err));
    } finally {
      setDangXoa(null);
    }
  }

  if (transactions.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border py-6 text-center text-sm text-text-muted dark:border-border-dark dark:text-text-muted-dark">
        Chưa có giao dịch nào. Ghi lần mua/bán đầu tiên ở form trên.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {loi !== null && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">⚠ {loi}</p>
      )}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface dark:border-border-dark dark:bg-surface-dark">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="border-b border-border text-right dark:border-border-dark">
              <th className={`${th} text-left`}>Ngày</th>
              <th className={`${th} text-left`}>Coin</th>
              <th className={`${th} text-left`}>Loại</th>
              <th className={th}>Số lượng</th>
              <th className={th}>Giá (USD)</th>
              <th className={th}>Số tiền (VND)</th>
              <th className={th}>Lãi/lỗ chốt</th>
              <th className={`${th} text-left`}>Ghi chú</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <Fragment key={t.id}>
              <tr className="border-b border-border text-right last:border-0 dark:border-border-dark">
                <td className={`${td} text-left`}>{t.trade_date.split('-').reverse().join('/')}</td>
                <td className={`${td} text-left font-semibold`}>{kyHieu.get(t.crypto_id) ?? '?'}</td>
                <td className={`${td} text-left`}>
                  <span className={t.side === 'BUY' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                    {t.side === 'BUY' ? 'Mua' : 'Bán'}
                  </span>
                </td>
                <td className={`${td} font-mono`}>{Number(t.quantity).toLocaleString('vi-VN', { maximumFractionDigits: 8 })}</td>
                <td className={`${td} font-mono`}>${Number(t.price_usd).toLocaleString('en-US', { maximumFractionDigits: 6 })}</td>
                <td className={`${td} font-mono`}>{vnd(Number(t.amount_vnd))}</td>
                <td className={`${td} font-mono`}>
                  {t.realized_pnl_vnd === null ? (
                    <span className="text-text-muted dark:text-text-muted-dark">—</span>
                  ) : (
                    <span className={t.realized_pnl_vnd >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                      {t.realized_pnl_vnd >= 0 ? '+' : ''}{vnd(Number(t.realized_pnl_vnd))}
                    </span>
                  )}
                </td>
                <td className={`${td} max-w-[14rem] truncate text-left text-text-muted dark:text-text-muted-dark`} title={t.note}>
                  {t.note}
                </td>
                <td className={`${td} whitespace-nowrap`}>
                  <button
                    onClick={() => setDangSua(dangSua === t.id ? null : t.id)}
                    disabled={dangXoa !== null}
                    aria-expanded={dangSua === t.id}
                    className="rounded-md px-2 py-1 text-[12px] font-semibold text-text-muted transition hover:bg-surface-2 hover:text-text disabled:opacity-50 dark:text-text-muted-dark dark:hover:bg-surface-2dark dark:hover:text-text-dark"
                  >
                    {dangSua === t.id ? 'Đóng' : 'Sửa'}
                  </button>
                  <button
                    onClick={() => xoa(t)}
                    disabled={dangXoa !== null}
                    className="rounded-md px-2 py-1 text-[12px] font-semibold text-text-muted transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:text-text-muted-dark dark:hover:bg-red-950 dark:hover:text-red-400"
                  >
                    {dangXoa === t.id ? 'Đang xoá…' : 'Xoá'}
                  </button>
                </td>
              </tr>
              {dangSua === t.id && (
                <CryptoTransactionEditRow
                  tx={t}
                  cryptos={cryptos}
                  transactions={transactions}
                  colSpan={9}
                  onSave={onEdit}
                  onClose={() => setDangSua(null)}
                />
              )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
