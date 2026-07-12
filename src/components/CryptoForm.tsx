import { useState } from 'react';
import type { NewCrypto } from '../types/crypto';
import { parseVnNumber } from '../lib/parseNumber';

const inputClass =
  'rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none transition-colors placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-border-dark dark:bg-surface-2dark dark:text-text-dark dark:placeholder:text-text-muted-dark dark:focus:border-primary-dark dark:focus:ring-primary-dark/30';

/** Form thêm coin: mã (bắt buộc), tên, số lượng, giá mua TB (USD). */
export function CryptoForm({ onAdd }: { onAdd: (c: NewCrypto) => void }) {
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [avgBuy, setAvgBuy] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const sym = symbol.trim().toUpperCase();
    if (!sym) return;
    onAdd({
      symbol: sym,
      name: name.trim(),
      quantity: parseVnNumber(quantity),
      avg_buy_price: parseVnNumber(avgBuy),
    });
    setSymbol('');
    setName('');
    setQuantity('');
    setAvgBuy('');
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-3 dark:border-border-dark dark:bg-surface-dark"
    >
      <input
        value={symbol}
        onChange={(e) => setSymbol(e.target.value)}
        placeholder="Mã (VD BTC)"
        aria-label="Mã coin"
        className={`w-28 ${inputClass}`}
      />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Tên (VD Bitcoin)"
        aria-label="Tên coin"
        className={`min-w-[10rem] flex-1 ${inputClass}`}
      />
      <input
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        placeholder="Số lượng"
        aria-label="Số lượng nắm giữ"
        inputMode="decimal"
        className={`w-32 ${inputClass}`}
      />
      <input
        value={avgBuy}
        onChange={(e) => setAvgBuy(e.target.value)}
        placeholder="Giá mua TB (USD)"
        aria-label="Giá mua trung bình (USD)"
        inputMode="decimal"
        className={`w-40 ${inputClass}`}
      />
      <button className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:shadow-md active:scale-95 dark:bg-primary-dark dark:shadow-soft-dark dark:hover:shadow-md-dark">
        Thêm coin
      </button>
    </form>
  );
}
