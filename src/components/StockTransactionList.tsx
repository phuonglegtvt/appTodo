import { Fragment, useState } from 'react';
import type { Stock } from '../types/stock';
import type { NewStockTransaction, StockTransaction } from '../types/stockTransaction';
import { StockTransactionEditRow } from './StockTransactionEditRow';

// Lịch sử giao dịch cổ phiếu, mới nhất trước. Mọi giao dịch đều Sửa / Xoá được:
// các giao dịch ghi sau nó của cùng mã được tính lại (lib/txChain.ts). Xoá giao
// dịch mới nhất của một mã = hoàn tác nó.

interface Props {
  transactions: StockTransaction[];
  stocks: Stock[];
  onDelete: (txId: string) => Promise<void>;
  onEdit: (txId: string, stock: Stock, input: NewStockTransaction) => Promise<void>;
}

/** Nghìn đồng → chuỗi đồng đầy đủ. */
function dong(thousand: number): string {
  return Math.round(thousand * 1_000).toLocaleString('vi-VN') + ' đ';
}

const th = 'px-2 py-2 text-[11px] font-bold uppercase tracking-[0.06em] text-text-muted dark:text-text-muted-dark';
const td = 'px-2 py-2 text-[13px] tabular-nums text-text dark:text-text-dark';

export function StockTransactionList({ transactions, stocks, onDelete, onEdit }: Props) {
  const [dangXoa, setDangXoa] = useState<string | null>(null);
  const [loi, setLoi] = useState<string | null>(null);
  const [dangSua, setDangSua] = useState<string | null>(null);

  const maCuaId = new Map(stocks.map((s) => [s.id, s.ticker]));

  async function xoa(t: StockTransaction) {
    const ma = maCuaId.get(t.stock_id) ?? 'mã';
    const ngay = t.trade_date.split('-').reverse().join('/');
    if (!confirm(
      `Xoá giao dịch ${t.side === 'BUY' ? 'mua' : 'bán'} ${Number(t.quantity).toLocaleString('vi-VN')} cổ ${ma} ngày ${ngay}?\n\n`
      + `Số lượng và vốn của ${ma} sẽ tính lại như thể giao dịch này chưa từng được ghi. Không khôi phục lại được.`,
    )) return;
    setLoi(null);
    setDangXoa(t.id);
    try {
      await onDelete(t.id);
      if (dangSua === t.id) setDangSua(null);
    } catch (err) {
      console.error('Lỗi xoá giao dịch cổ phiếu:', err);
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
              <th className={`${th} text-left`}>Mã</th>
              <th className={`${th} text-left`}>Loại</th>
              <th className={th}>Số lượng</th>
              <th className={th}>Giá (nghìn)</th>
              <th className={th}>Số tiền</th>
              <th className={th}>Lãi/lỗ chốt</th>
              <th className={`${th} text-left`}>Ghi chú</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => {
              const laiLo = t.realized_pnl_thousand === null ? null : Number(t.realized_pnl_thousand);
              return (
                <Fragment key={t.id}>
                <tr className="border-b border-border text-right last:border-0 dark:border-border-dark">
                  <td className={`${td} text-left`}>{t.trade_date.split('-').reverse().join('/')}</td>
                  <td className={`${td} text-left font-semibold`}>{maCuaId.get(t.stock_id) ?? '?'}</td>
                  <td className={`${td} text-left`}>
                    <span className={t.side === 'BUY' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                      {t.side === 'BUY' ? 'Mua' : 'Bán'}
                    </span>
                  </td>
                  <td className={`${td} font-mono`}>{Number(t.quantity).toLocaleString('vi-VN')}</td>
                  <td className={`${td} font-mono`}>{Number(t.price_thousand).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}</td>
                  <td className={`${td} font-mono`}>{dong(Number(t.amount_thousand))}</td>
                  <td className={`${td} font-mono`}>
                    {laiLo === null ? (
                      <span className="text-text-muted dark:text-text-muted-dark">—</span>
                    ) : (
                      <span className={laiLo >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                        {laiLo >= 0 ? '+' : ''}{dong(laiLo)}
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
                  <StockTransactionEditRow
                    tx={t}
                    stocks={stocks}
                    transactions={transactions}
                    colSpan={9}
                    onSave={onEdit}
                    onClose={() => setDangSua(null)}
                  />
                )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
