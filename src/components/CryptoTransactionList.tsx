import { useState } from 'react';
import type { Crypto } from '../types/crypto';
import type { CryptoTransaction } from '../types/cryptoTransaction';

// Danh sách giao dịch, mới nhất trước. Chỉ giao dịch MỚI NHẤT của mỗi coin có
// nút Hoàn tác: hoàn tác = trả coin về trạng thái TRƯỚC giao dịch, mà trạng thái
// đó chỉ còn đúng khi không có giao dịch nào chồng lên sau (DB cũng chặn lại).

interface Props {
  transactions: CryptoTransaction[];
  cryptos: Crypto[];
  onUndo: (txId: string) => Promise<void>;
}

/** id giao dịch mới nhất (theo thời điểm ghi) của từng coin. */
export function latestTxIds(list: CryptoTransaction[]): Set<string> {
  const moiNhat = new Map<string, CryptoTransaction>();
  for (const t of list) {
    const cu = moiNhat.get(t.crypto_id);
    if (!cu || t.created_at > cu.created_at) moiNhat.set(t.crypto_id, t);
  }
  return new Set([...moiNhat.values()].map((t) => t.id));
}

function vnd(v: number): string {
  return Math.round(v).toLocaleString('vi-VN') + ' đ';
}

const th = 'px-2 py-2 text-[11px] font-bold uppercase tracking-[0.06em] text-text-muted dark:text-text-muted-dark';
const td = 'px-2 py-2 text-[13px] tabular-nums text-text dark:text-text-dark';

export function CryptoTransactionList({ transactions, cryptos, onUndo }: Props) {
  const [dangHoanTac, setDangHoanTac] = useState<string | null>(null);
  const [loi, setLoi] = useState<string | null>(null);

  const kyHieu = new Map(cryptos.map((c) => [c.id, c.symbol]));
  const coTheHoanTac = latestTxIds(transactions);

  async function hoanTac(t: CryptoTransaction) {
    const ten = kyHieu.get(t.crypto_id) ?? 'coin';
    if (!confirm(`Hoàn tác giao dịch ${t.side === 'BUY' ? 'mua' : 'bán'} ${t.quantity} ${ten}? Số liệu coin sẽ về như trước giao dịch.`)) return;
    setLoi(null);
    setDangHoanTac(t.id);
    try {
      await onUndo(t.id);
    } catch (err) {
      console.error('Lỗi hoàn tác giao dịch crypto:', err);
      setLoi(err instanceof Error ? err.message : String(err));
    } finally {
      setDangHoanTac(null);
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
              <tr key={t.id} className="border-b border-border text-right last:border-0 dark:border-border-dark">
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
                <td className={td}>
                  {coTheHoanTac.has(t.id) && (
                    <button
                      onClick={() => hoanTac(t)}
                      disabled={dangHoanTac !== null}
                      className="rounded-md px-2 py-1 text-[12px] font-semibold text-text-muted transition hover:bg-surface-2 hover:text-text disabled:opacity-50 dark:text-text-muted-dark dark:hover:bg-surface-2dark dark:hover:text-text-dark"
                    >
                      {dangHoanTac === t.id ? 'Đang hoàn tác…' : 'Hoàn tác'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
