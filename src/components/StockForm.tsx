import { useState } from 'react';
import type { NewStock, StockGroup } from '../types/stock';
import { parseVnNumber } from '../lib/parseNumber';

const inputClass =
  'rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none transition-colors placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-border-dark dark:bg-surface-2dark dark:text-text-dark dark:placeholder:text-text-muted-dark dark:focus:border-primary-dark dark:focus:ring-primary-dark/30';

/** Form thêm mã cổ phiếu: mã, tên, nhóm, giá ngưỡng, giá bảo vệ, cổ tức, số tiền đầu tư. */
export function StockForm({ onAdd }: { onAdd: (s: NewStock) => void }) {
  const [ticker, setTicker] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [group, setGroup] = useState<StockGroup>('balance');
  const [priceThreshold, setPriceThreshold] = useState('');
  const [priceProtect, setPriceProtect] = useState('');
  const [dividend, setDividend] = useState('');
  const [invested, setInvested] = useState('');
  const [quantity, setQuantity] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const tk = ticker.trim().toUpperCase();
    const name = companyName.trim();
    if (!tk || !name) return;
    onAdd({
      ticker: tk,
      company_name: name,
      group,
      price_threshold: parseVnNumber(priceThreshold),
      price_protect: parseVnNumber(priceProtect),
      dividend: parseVnNumber(dividend),
      invested_amount: parseVnNumber(invested),
      quantity: parseVnNumber(quantity),
    });
    setTicker('');
    setCompanyName('');
    setGroup('balance');
    setPriceThreshold('');
    setPriceProtect('');
    setDividend('');
    setInvested('');
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-3 dark:border-border-dark dark:bg-surface-dark"
    >
      <input
        value={ticker}
        onChange={(e) => setTicker(e.target.value)}
        placeholder="Mã (VD ACB)"
        aria-label="Mã cổ phiếu"
        className={`w-28 ${inputClass}`}
      />
      <input
        value={companyName}
        onChange={(e) => setCompanyName(e.target.value)}
        placeholder="Tên công ty"
        aria-label="Tên công ty"
        className={`min-w-[10rem] flex-1 ${inputClass}`}
      />
      <select
        value={group}
        onChange={(e) => setGroup(e.target.value as StockGroup)}
        aria-label="Nhóm rủi ro"
        className={inputClass}
      >
        <option value="attack">Tấn công</option>
        <option value="balance">Cân bằng</option>
        <option value="defense">Phòng thủ</option>
      </select>
      <input
        value={priceThreshold}
        onChange={(e) => setPriceThreshold(e.target.value)}
        placeholder="Giá ngưỡng (nghìn)"
        aria-label="Giá ngưỡng tích sản (nghìn đồng)"
        inputMode="decimal"
        className={`w-36 ${inputClass}`}
      />
      <input
        value={priceProtect}
        onChange={(e) => setPriceProtect(e.target.value)}
        placeholder="Giá bảo vệ (nghìn)"
        aria-label="Giá bảo vệ (nghìn đồng)"
        inputMode="decimal"
        className={`w-36 ${inputClass}`}
      />
      <input
        value={dividend}
        onChange={(e) => setDividend(e.target.value)}
        placeholder="Cổ tức (đồng)"
        aria-label="Cổ tức tiền/năm (đồng)"
        inputMode="numeric"
        className={`w-32 ${inputClass}`}
      />
      <input
        value={invested}
        onChange={(e) => setInvested(e.target.value)}
        placeholder="Số tiền đầu tư (nghìn)"
        aria-label="Số tiền đã đầu tư (nghìn đồng)"
        inputMode="numeric"
        className={`w-40 ${inputClass}`}
      />
      <input
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        placeholder="Số lượng (cổ)"
        aria-label="Số cổ phiếu đang giữ"
        inputMode="numeric"
        className={`w-32 ${inputClass}`}
      />
      <button className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:shadow-md active:scale-95 dark:bg-primary-dark dark:shadow-soft-dark dark:hover:shadow-md-dark">
        Thêm mã
      </button>
    </form>
  );
}
