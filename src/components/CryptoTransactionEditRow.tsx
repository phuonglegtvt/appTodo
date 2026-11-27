import { planCryptoTxEdit, toRecordedCryptoTxs, type Holding } from '../lib/cryptoTransaction';
import type { Crypto } from '../types/crypto';
import type { CryptoTransaction, NewCryptoTransaction } from '../types/cryptoTransaction';
import { TxEditRow } from './TxEditRow';

// Form sửa giao dịch CRYPTO: TxEditRow + giá USD, tiền VND + xem trước bằng
// planCryptoTxEdit (cùng phép tính hook gửi lên DB).

interface Props {
  tx: CryptoTransaction;
  cryptos: Crypto[];
  transactions: CryptoTransaction[];
  colSpan: number;
  onSave: (txId: string, coin: Crypto, input: NewCryptoTransaction) => Promise<void>;
  onClose: () => void;
}

const soCoin = (v: number | null) => (v === null ? '—' : v.toLocaleString('vi-VN', { maximumFractionDigits: 8 }));
const usd = (v: number | null) => (v === null ? '—' : '$' + v.toLocaleString('en-US', { maximumFractionDigits: 6 }));
const vnd = (v: number | null) => (v === null ? '—' : Math.round(v).toLocaleString('vi-VN') + ' đ');
const manh = 'text-text dark:text-text-dark';

function Dong({ ma, tu, den }: { ma: string; tu: Holding; den: Holding }) {
  return (
    <div>
      <strong className={manh}>{ma}</strong>: số lượng {soCoin(tu.quantity)} → <strong className={manh}>{soCoin(den.quantity)}</strong>
      {' · '}giá mua TB {usd(tu.avg_buy_price)} → <strong className={manh}>{usd(den.avg_buy_price)}</strong>
      {' · '}vốn {vnd(tu.invested_amount)} → <strong className={manh}>{vnd(den.invested_amount)}</strong>
    </div>
  );
}

export function CryptoTransactionEditRow({ tx, cryptos, transactions, colSpan, onSave, onClose }: Props) {
  const theoId = new Map(cryptos.map((c) => [c.id, c]));
  const ma = (id: string) => theoId.get(id)?.symbol ?? '?';

  return (
    <TxEditRow
      title={`Sửa giao dịch ${ma(tx.crypto_id)}`}
      colSpan={colSpan}
      assetLabel="Coin"
      assetOptions={cryptos.map((c) => ({ value: c.id, symbol: c.symbol, name: c.name }))}
      initial={{
        assetId: tx.crypto_id, side: tx.side, trade_date: tx.trade_date,
        quantity: Number(tx.quantity), price: Number(tx.price_usd), amount: Number(tx.amount_vnd), note: tx.note,
      }}
      labels={{ price: 'Giá (USD)', amountBuy: 'Tiền đã chi (VND)', amountSell: 'Tiền nhận (VND)' }}
      preview={(v) => {
        const coin = theoId.get(v.assetId);
        if (!coin) throw new Error('Chọn coin.');
        const plan = planCryptoTxEdit(toRecordedCryptoTxs(transactions), tx.id,
          { side: v.side, quantity: v.quantity, price_usd: v.price, amount_vnd: v.amount },
          { cryptoId: coin.id, current: { quantity: coin.quantity, avg_buy_price: coin.avg_buy_price, invested_amount: coin.invested_amount } });
        const soGdSau = plan.source.updates.length + (plan.target?.updates.length ?? 0) - 1;
        return (
          <>
            <div>Sau khi sửa:</div>
            <Dong ma={ma(tx.crypto_id)} tu={plan.source.expected} den={plan.source.final} />
            {plan.target && <Dong ma={coin.symbol} tu={plan.target.expected} den={plan.target.final} />}
            {soGdSau > 0 && <div>Tự tính lại {soGdSau} giao dịch ghi sau giao dịch này.</div>}
          </>
        );
      }}
      onSave={async (v) => {
        const coin = theoId.get(v.assetId);
        if (!coin) throw new Error('Chọn coin.');
        await onSave(tx.id, coin, {
          crypto_id: coin.id, side: v.side, trade_date: v.trade_date, quantity: v.quantity,
          price_usd: v.price, amount_vnd: v.amount, note: v.note,
        });
      }}
      onClose={onClose}
    />
  );
}
