import { useState } from 'react';
import { useCryptos } from '../hooks/useCryptos';
import { useCurrency } from '../hooks/useCurrency';
import { fetchCryptoPrices, fetchCryptoPeaks } from '../lib/cryptoPrice';
import { nextPeak } from '../lib/peakDrawdown';
import { filterCryptos } from '../lib/cryptoFilters';
import type { Currency, CryptoUpdate } from '../types/crypto';
import { CryptoSummary } from './CryptoSummary';
import { CryptoForm } from './CryptoForm';
import { CryptoTable } from './CryptoTable';
import { ErrorBanner } from './ErrorBanner';

interface Props {
  userId: string;
}

/** Trang Crypto: tổng danh mục + cập nhật giá Binance + chuyển USD/VND + form + bảng. */
export function CryptoPage({ userId }: Props) {
  const { cryptos, loading, error, addCrypto, updateCrypto, deleteCrypto, clearError } = useCryptos(userId);
  const { currency, setCurrency, rate, refreshRate, loadingRate, rateError, clearRateError } = useCurrency();
  const [priceError, setPriceError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [query, setQuery] = useState('');

  async function handleUpdatePrices() {
    setPriceError(null);
    const symbols = cryptos.map((c) => c.symbol);
    if (symbols.length === 0) return;
    setUpdating(true);
    try {
      // Giá (Binance, mỗi coin một request) và ATH (CoinGecko, một request cho cả
      // danh sách) đi song song — hai nguồn khác nhau, không gộp được.
      const [{ prices, failed }, { peaks, failed: peakFailed }] = await Promise.all([
        fetchCryptoPrices(symbols),
        fetchCryptoPeaks(symbols),
      ]);

      // Một lần ghi cho mỗi coin, gộp giá + đỉnh (xem lý do ở StocksPage).
      await Promise.all(
        cryptos.map((c) => {
          const key = c.symbol.toUpperCase();
          const gia = prices[key];
          const dinh = nextPeak(c.peak_price, peaks[key], gia ?? c.current_price);

          const patch: CryptoUpdate = {};
          if (gia != null) patch.current_price = gia;
          if (dinh != null && dinh !== c.peak_price) patch.peak_price = dinh;
          return Object.keys(patch).length > 0 ? updateCrypto(c.id, patch) : null;
        }).filter((p): p is Promise<void> => p !== null),
      );

      if (failed.length > 0) {
        const detail = failed.map((f) => `${f.symbol} (${f.message})`).join(', ');
        setPriceError(`Không lấy được giá ${failed.length} coin: ${detail}. Có thể nhập giá tay.`);
      } else if (peakFailed.length > 0) {
        const detail = peakFailed.map((f) => f.symbol).join(', ');
        setPriceError(
          `Giá đã cập nhật xong. Riêng đỉnh lịch sử không lấy được cho ${peakFailed.length} coin: `
          + `${detail}. Nhập tay ở cột “Đỉnh LS” nếu cần.`,
        );
      }
    } catch (err) {
      console.error('Lỗi cập nhật giá crypto:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setPriceError('Không cập nhật được giá (có thể bị chặn CORS hoặc nguồn đổi). ' + msg);
    } finally {
      setUpdating(false);
    }
  }

  // Chuyển tiền tệ; khi bật VND mà chưa có tỷ giá thì lấy tỷ giá live ngay.
  async function handleCurrency(c: Currency) {
    setCurrency(c);
    if (c === 'VND' && rate == null) await refreshRate();
  }

  const removeCrypto = (id: string) => {
    if (confirm('Xóa coin này?')) deleteCrypto(id);
  };

  const visible = filterCryptos(cryptos, query);
  const currencyBtn = (c: Currency, label: string) => (
    <button
      onClick={() => handleCurrency(c)}
      // Disable khi đang tải tỷ giá để tránh gọi refreshRate chồng nhau (re-entrancy).
      disabled={loadingRate}
      aria-pressed={currency === c}
      className={`rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
        currency === c
          ? 'bg-surface text-text shadow-sm dark:bg-surface-dark dark:text-text-dark'
          : 'text-text-muted dark:text-text-muted-dark'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-auto p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[22px] font-bold tracking-tight text-text dark:text-text-dark">Crypto</div>
          <div className="mt-0.5 text-[13px] text-text-muted dark:text-text-muted-dark">
            {query.trim()
              ? `${visible.length}/${cryptos.length} coin khớp "${query.trim()}"`
              : `${cryptos.length} coin · giá gốc USD${
                  currency === 'VND' ? (rate != null ? ` · tỷ giá ${rate.toLocaleString('vi-VN')}đ/USD` : ' · chưa có tỷ giá') : ''
                }`}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5 rounded-lg border border-border bg-surface-2 p-0.5 dark:border-border-dark dark:bg-surface-2dark">
            {currencyBtn('USD', 'USD')}
            {currencyBtn('VND', loadingRate ? 'VND…' : 'VND')}
          </div>
          {/* Tỷ giá được cache ở localStorage nên có thể cũ theo thời gian → cho phép làm mới thủ công khi đang xem VND. */}
          {currency === 'VND' && (
            <button
              onClick={refreshRate}
              disabled={loadingRate}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-text shadow-soft transition hover:shadow-md active:scale-95 disabled:opacity-50 dark:border-border-dark dark:bg-surface-2dark dark:text-text-dark dark:shadow-soft-dark"
            >
              {loadingRate ? 'Đang lấy tỷ giá…' : 'Làm mới tỷ giá'}
            </button>
          )}
          <button
            onClick={handleUpdatePrices}
            disabled={updating || cryptos.length === 0}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:shadow-md active:scale-95 disabled:opacity-50 dark:bg-primary-dark dark:shadow-soft-dark"
          >
            {updating ? 'Đang cập nhật…' : 'Cập nhật giá'}
          </button>
        </div>
      </div>

      {error && <ErrorBanner message={error} onClose={clearError} />}
      {priceError && <ErrorBanner message={priceError} onClose={() => setPriceError(null)} />}
      {rateError && <ErrorBanner message={rateError} onClose={clearRateError} />}

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Tìm theo mã hoặc tên coin…"
        aria-label="Tìm coin"
        className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none transition-colors placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-border-dark dark:bg-surface-2dark dark:text-text-dark dark:placeholder:text-text-muted-dark dark:focus:border-primary-dark"
      />

      <CryptoSummary cryptos={cryptos} currency={currency} rate={rate} />

      <CryptoForm onAdd={addCrypto} />

      {loading ? (
        <p className="py-8 text-center text-sm text-text-muted dark:text-text-muted-dark">Đang tải…</p>
      ) : cryptos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-text-muted dark:border-border-dark dark:text-text-muted-dark">
          Chưa có coin nào. Thêm coin đầu tiên ở form trên.
        </p>
      ) : visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-text-muted dark:border-border-dark dark:text-text-muted-dark">
          Không có coin nào khớp "{query.trim()}".
        </p>
      ) : (
        <CryptoTable cryptos={visible} currency={currency} rate={rate} onUpdate={updateCrypto} onDelete={removeCrypto} />
      )}
    </div>
  );
}
