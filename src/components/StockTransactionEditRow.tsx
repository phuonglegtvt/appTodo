import { avgCostThousand, planStockTxEdit, toRecordedStockTxs, type StockHolding } from '../lib/stockTransaction';
import type { Stock } from '../types/stock';
import type { NewStockTransaction, StockTransaction } from '../types/stockTransaction';
import { TxEditRow } from './TxEditRow';

// Form sửa giao dịch CỔ PHIẾU: TxEditRow + đơn vị nghìn đồng + xem trước bằng
// planStockTxEdit (cùng phép tính hook gửi lên DB).

interface Props {
  tx: StockTransaction;
  stocks: Stock[];
  transactions: StockTransaction[];
  colSpan: number;
  onSave: (txId: string, stock: Stock, input: NewStockTransaction) => Promise<void>;
  onClose: () => void;
}

const fmt = (v: number | null) => (v === null ? '—' : v.toLocaleString('vi-VN', { maximumFractionDigits: 2 }));
const dong = (thousand: number | null) => (thousand === null ? '—' : Math.round(thousand * 1000).toLocaleString('vi-VN') + ' đ');
const manh = 'text-text dark:text-text-dark';

function Dong({ ma, tu, den }: { ma: string; tu: StockHolding; den: StockHolding }) {
  return (
    <div>
      <strong className={manh}>{ma}</strong>: số lượng {fmt(tu.quantity)} → <strong className={manh}>{fmt(den.quantity)}</strong>
      {' · '}vốn {dong(tu.invested_amount)} → <strong className={manh}>{dong(den.invested_amount)}</strong>
      {' · '}giá vốn TB {fmt(avgCostThousand(tu))} → <strong className={manh}>{fmt(avgCostThousand(den))}</strong> nghìn/cổ
    </div>
  );
}

export function StockTransactionEditRow({ tx, stocks, transactions, colSpan, onSave, onClose }: Props) {
  const theoId = new Map(stocks.map((s) => [s.id, s]));
  const ma = (id: string) => theoId.get(id)?.ticker ?? '?';

  return (
    <TxEditRow
      title={`Sửa giao dịch ${ma(tx.stock_id)}`}
      colSpan={colSpan}
      assetLabel="Mã"
      assetOptions={stocks.map((s) => ({ value: s.id, symbol: s.ticker, name: s.company_name }))}
      initial={{
        assetId: tx.stock_id, side: tx.side, trade_date: tx.trade_date,
        quantity: Number(tx.quantity), price: Number(tx.price_thousand), amount: Number(tx.amount_thousand), note: tx.note,
      }}
      labels={{ price: 'Giá (nghìn)', amountBuy: 'Tiền đã chi (nghìn)', amountSell: 'Tiền nhận (nghìn)' }}
      preview={(v) => {
        const stock = theoId.get(v.assetId);
        if (!stock) throw new Error('Chọn mã cổ phiếu.');
        const plan = planStockTxEdit(toRecordedStockTxs(transactions), tx.id,
          { side: v.side, quantity: v.quantity, price_thousand: v.price, amount_thousand: v.amount },
          { stockId: stock.id, current: { quantity: stock.quantity, invested_amount: stock.invested_amount } });
        const soGdSau = plan.source.updates.length + (plan.target?.updates.length ?? 0) - 1;
        return (
          <>
            <div>Sau khi sửa:</div>
            <Dong ma={ma(tx.stock_id)} tu={plan.source.expected} den={plan.source.final} />
            {plan.target && <Dong ma={stock.ticker} tu={plan.target.expected} den={plan.target.final} />}
            {soGdSau > 0 && <div>Tự tính lại {soGdSau} giao dịch ghi sau giao dịch này.</div>}
          </>
        );
      }}
      onSave={async (v) => {
        const stock = theoId.get(v.assetId);
        if (!stock) throw new Error('Chọn mã cổ phiếu.');
        await onSave(tx.id, stock, {
          side: v.side, trade_date: v.trade_date, quantity: v.quantity,
          price_thousand: v.price, amount_thousand: v.amount, note: v.note,
        });
      }}
      onClose={onClose}
    />
  );
}
