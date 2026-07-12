import { useCallback, useState } from 'react';
import { fetchUsdVndRate } from '../lib/fxRate';
import type { Currency } from '../types/crypto';

const CURRENCY_KEY = 'apptodo-currency';
const RATE_KEY = 'apptodo-usdvnd-rate';

interface UseCurrency {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  rate: number | null;
  refreshRate: () => Promise<void>;
  loadingRate: boolean;
  rateError: string | null;
  clearRateError: () => void;
}

function readInitialRate(): number | null {
  const raw = localStorage.getItem(RATE_KEY);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Nhớ lựa chọn tiền tệ + tỷ giá USD→VND gần nhất trong localStorage. Lấy tỷ giá live khi cần. */
export function useCurrency(): UseCurrency {
  const [currency, setCurrencyState] = useState<Currency>(() =>
    localStorage.getItem(CURRENCY_KEY) === 'VND' ? 'VND' : 'USD',
  );
  const [rate, setRate] = useState<number | null>(readInitialRate);
  const [loadingRate, setLoadingRate] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);

  const setCurrency = useCallback((c: Currency) => {
    setCurrencyState(c);
    localStorage.setItem(CURRENCY_KEY, c);
  }, []);

  const refreshRate = useCallback(async () => {
    setLoadingRate(true);
    setRateError(null);
    try {
      const r = await fetchUsdVndRate();
      setRate(r);
      localStorage.setItem(RATE_KEY, String(r));
    } catch (err) {
      // KHÔNG nuốt lỗi: log + set thông báo để trang hiện ErrorBanner.
      console.error('Lỗi lấy tỷ giá USD/VND:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setRateError('Không lấy được tỷ giá USD→VND: ' + msg + '. Tạm hiển thị USD.');
    } finally {
      setLoadingRate(false);
    }
  }, []);

  const clearRateError = useCallback(() => setRateError(null), []);

  return { currency, setCurrency, rate, refreshRate, loadingRate, rateError, clearRateError };
}
