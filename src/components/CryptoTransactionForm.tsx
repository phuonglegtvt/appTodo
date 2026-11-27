import { useState } from 'react';
import { nhapTien } from '../lib/moneyTyping';
import { applyTx } from '../lib/cryptoTransaction';
import { parseVnNumber, parseVndAmount } from '../lib/parseNumber';
import type { TxSide, TxResult } from '../lib/cryptoTransaction';
import type { Crypto } from '../types/crypto';
import type { NewCryptoTransaction } from '../types/cryptoTransaction';

// Form ghi một giao dịch MUA / BÁN. Trước khi bấm Ghi, người dùng thấy ngay
// số lượng / giá mua TB / vốn của coin SẼ thành bao nhiêu — dùng đúng hàm
// `applyTx` mà lúc ghi sẽ dùng, để cái thấy trước khớp cái được lưu.

interface Props {
  cryptos: Crypto[];
  onRecord: (coin: Crypto, input: NewCryptoTransaction) => Promise<number | null>;
}

const inputClass =
  'rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none transition-colors placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-border-dark dark:bg-surface-2dark dark:text-text-dark dark:placeholder:text-text-muted-dark dark:focus:border-primary-dark dark:focus:ring-primary-dark/30';
const nhanClass = 'text-[11px] font-bold uppercase tracking-[0.06em] text-text-muted dark:text-text-muted-dark';

/** Ngày hôm nay theo giờ máy, dạng YYYY-MM-DD (input type=date cần đúng dạng này). */
function homNay(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function vnd(v: number): string {
  return Math.round(v).toLocaleString('vi-VN') + ' đ';
}

function soCoin(v: number | null): string {
  return v === null ? '—' : v.toLocaleString('vi-VN', { maximumFractionDigits: 8 });
}

function usd(v: number | null): string {
  return v === null ? '—' : '$' + v.toLocaleString('en-US', { maximumFractionDigits: 6 });
}

export function CryptoTransactionForm({ cryptos, onRecord }: Props) {
  const [cryptoId, setCryptoId] = useState('');
  const [side, setSide] = useState<TxSide>('BUY');
  const [ngay, setNgay] = useState(homNay);
  const [soLuong, setSoLuong] = useState('');
  const [gia, setGia] = useState('');
  const [tien, setTien] = useState('');
  const [ghiChu, setGhiChu] = useState('');
  const [dangGhi, setDangGhi] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  const [xong, setXong] = useState<string | null>(null);

  const coin = cryptos.find((c) => c.id === cryptoId) ?? null;
  const q = parseVnNumber(soLuong);
  const p = parseVnNumber(gia);
  const a = parseVndAmount(tien);

  // Xem trước: chỉ khi đủ dữ liệu. Lỗi nghiệp vụ (bán quá số đang có, coin
  // thiếu giá TB…) hiện ngay ở đây, không đợi bấm Ghi.
  let xemTruoc: TxResult | null = null;
  let loiXemTruoc: string | null = null;
  if (coin && q !== null && p !== null && a !== null) {
    try {
      xemTruoc = applyTx(coin, { side, quantity: q, price_usd: p, amount_vnd: a });
    } catch (err) {
      loiXemTruoc = err instanceof Error ? err.message : String(err);
    }
  }

  function doi<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); setXong(null); setLoi(null); };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoi(null);
    setXong(null);
    // Báo đích danh ô sai, không để ô trống lặng lẽ thành 0.
    if (!coin) { setLoi('Chọn coin.'); return; }
    if (!ngay) { setLoi('Chọn ngày giao dịch.'); return; }
    if (q === null) { setLoi('Số lượng chưa nhập hoặc không phải số.'); return; }
    if (p === null) { setLoi('Giá (USD/coin) chưa nhập hoặc không phải số.'); return; }
    if (a === null) { setLoi('Số tiền (VND) chưa nhập hoặc không phải số tiền hợp lệ.'); return; }

    setDangGhi(true);
    try {
      const laiLo = await onRecord(coin, {
        crypto_id: coin.id, side, trade_date: ngay,
        quantity: q, price_usd: p, amount_vnd: a, note: ghiChu.trim(),
      });
      setXong(
        `Đã ghi ${side === 'BUY' ? 'mua' : 'bán'} ${soCoin(q)} ${coin.symbol}.`
        + (laiLo !== null ? ` Lãi/lỗ đã chốt: ${laiLo >= 0 ? '+' : ''}${vnd(laiLo)}.` : ''),
      );
      setSoLuong('');
      setGia('');
      setTien('');
      setGhiChu('');
    } catch (err) {
      console.error('Lỗi ghi giao dịch crypto:', err);
      setLoi(err instanceof Error ? err.message : String(err));
    } finally {
      setDangGhi(false);
    }
  }

  const nutSide = (s: TxSide, label: string) => (
    <button
      type="button"
      onClick={() => doi(setSide)(s)}
      aria-pressed={side === s}
      className={`rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
        side === s
          ? s === 'BUY'
            ? 'bg-green-600 text-white dark:bg-green-500'
            : 'bg-red-600 text-white dark:bg-red-500'
          : 'text-text-muted dark:text-text-muted-dark'
      }`}
    >
      {label}
    </button>
  );

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-text dark:text-text-dark">Ghi giao dịch</h3>
        <div className="flex gap-0.5 rounded-lg border border-border bg-surface-2 p-0.5 dark:border-border-dark dark:bg-surface-2dark">
          {nutSide('BUY', 'Mua')}
          {nutSide('SELL', 'Bán')}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className={nhanClass}>Coin</span>
          <select
            value={cryptoId}
            onChange={(e) => doi(setCryptoId)(e.target.value)}
            aria-label="Coin"
            className={`w-36 ${inputClass}`}
          >
            <option value="">Chọn…</option>
            {cryptos.map((c) => (
              <option key={c.id} value={c.id}>{c.symbol}{c.name ? ` — ${c.name}` : ''}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={nhanClass}>Ngày</span>
          <input
            type="date"
            value={ngay}
            onChange={(e) => doi(setNgay)(e.target.value)}
            aria-label="Ngày giao dịch"
            className={`w-40 ${inputClass}`}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={nhanClass}>Số lượng</span>
          <input
            value={soLuong}
            onChange={(e) => doi(setSoLuong)(e.target.value)}
            inputMode="decimal"
            placeholder="0,05"
            aria-label="Số lượng coin"
            className={`w-32 ${inputClass}`}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={nhanClass}>Giá (USD/coin)</span>
          <input
            value={gia}
            onChange={(e) => doi(setGia)(e.target.value)}
            inputMode="decimal"
            placeholder="65000"
            aria-label="Giá mỗi coin (USD)"
            className={`w-36 ${inputClass}`}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={nhanClass}>{side === 'BUY' ? 'Số tiền đã chi (VND)' : 'Số tiền nhận (VND)'}</span>
          <input
            value={tien}
            onChange={nhapTien(doi(setTien))}
            inputMode="numeric"
            placeholder="85,000,000"
            aria-label={side === 'BUY' ? 'Số tiền đã chi (VND)' : 'Số tiền nhận về (VND)'}
            className={`w-44 ${inputClass}`}
          />
        </label>
        <label className="flex min-w-[10rem] flex-1 flex-col gap-1">
          <span className={nhanClass}>Ghi chú</span>
          <input
            value={ghiChu}
            onChange={(e) => doi(setGhiChu)(e.target.value)}
            placeholder="Sàn, lý do… (không bắt buộc)"
            aria-label="Ghi chú"
            className={inputClass}
          />
        </label>
        <button
          disabled={dangGhi || cryptos.length === 0}
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:shadow-md active:scale-95 disabled:opacity-50 dark:bg-primary-dark dark:shadow-soft-dark"
        >
          {dangGhi ? 'Đang ghi…' : 'Ghi giao dịch'}
        </button>
      </div>

      {cryptos.length === 0 && (
        <p className="text-[13px] text-text-muted dark:text-text-muted-dark">
          Chưa có coin nào. Thêm coin ở form phía trên trước, rồi ghi giao dịch cho nó.
        </p>
      )}

      {coin && xemTruoc && (
        <p className="text-[13px] leading-relaxed text-text-muted dark:text-text-muted-dark">
          Sau giao dịch, <strong className="text-text dark:text-text-dark">{coin.symbol}</strong>:{' '}
          số lượng {soCoin(coin.quantity)} → <strong className="text-text dark:text-text-dark">{soCoin(xemTruoc.after.quantity)}</strong>
          {' · '}giá mua TB {usd(coin.avg_buy_price)} → <strong className="text-text dark:text-text-dark">{usd(xemTruoc.after.avg_buy_price)}</strong>
          {' · '}đã đầu tư {coin.invested_amount === null ? '—' : vnd(coin.invested_amount)} →{' '}
          <strong className="text-text dark:text-text-dark">
            {xemTruoc.after.invested_amount === null ? '—' : vnd(xemTruoc.after.invested_amount)}
          </strong>
          {xemTruoc.realizedPnlVnd !== null && (
            <>
              {' · '}lãi/lỗ đã chốt{' '}
              <strong className={xemTruoc.realizedPnlVnd >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                {xemTruoc.realizedPnlVnd >= 0 ? '+' : ''}{vnd(xemTruoc.realizedPnlVnd)}
              </strong>
            </>
          )}
        </p>
      )}

      {loiXemTruoc !== null && (
        <p role="alert" className="text-[13px] text-amber-700 dark:text-amber-400">⚠ {loiXemTruoc}</p>
      )}
      {loi !== null && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">⚠ {loi}</p>
      )}
      {xong !== null && (
        <p role="status" className="text-sm text-green-600 dark:text-green-400">✓ {xong}</p>
      )}
    </form>
  );
}
