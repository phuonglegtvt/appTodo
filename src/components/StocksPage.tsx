import { useState } from 'react';
import { useStocks } from '../hooks/useStocks';
import { fetchPrices } from '../lib/stockPrice';
import type { StockGroup } from '../types/stock';
import { PortfolioSummary } from './PortfolioSummary';
import { StockForm } from './StockForm';
import { StockTable } from './StockTable';
import { ErrorBanner } from './ErrorBanner';

interface Props {
  userId: string;
}

/** Trang Cổ phiếu: summary tỷ trọng + nút cập nhật giá + form thêm mã + bảng gom nhóm. */
export function StocksPage({ userId }: Props) {
  const { stocks, loading, error, addStock, updateStock, deleteStock, clearError } = useStocks(userId);
  const [profile, setProfile] = useState<StockGroup>('balance');
  const [priceError, setPriceError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  async function handleUpdatePrices() {
    setPriceError(null);
    const tickers = stocks.map((s) => s.ticker);
    if (tickers.length === 0) return;
    setUpdating(true);
    try {
      const { prices, failed } = await fetchPrices(tickers);
      // Cập nhật current_price cho từng mã lấy được giá (mã lỗi để nguyên giá cũ).
      await Promise.all(
        stocks
          .filter((s) => prices[s.ticker.toUpperCase()] != null)
          .map((s) => updateStock(s.id, { current_price: prices[s.ticker.toUpperCase()] })),
      );
      // Có mã lỗi nhưng không hỏng cả lần: báo rõ mã nào lỗi, không nuốt.
      if (failed.length > 0) {
        const detail = failed.map((f) => `${f.ticker} (${f.message})`).join(', ');
        setPriceError(`Không lấy được giá ${failed.length} mã: ${detail}. Có thể nhập giá tay.`);
      }
    } catch (err) {
      // KHÔNG nuốt lỗi: log + hiện banner; người dùng vẫn nhập tay được.
      console.error('Lỗi cập nhật giá:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setPriceError('Không cập nhật được giá (có thể bị chặn CORS hoặc nguồn đổi). ' + msg);
    } finally {
      setUpdating(false);
    }
  }

  const removeStock = (id: string) => {
    if (confirm('Xóa mã này?')) deleteStock(id);
  };

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-auto p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[22px] font-bold tracking-tight text-text dark:text-text-dark">Cổ phiếu</div>
          <div className="mt-0.5 text-[13px] text-text-muted dark:text-text-muted-dark">
            {stocks.length} mã · giá theo nghìn đồng, số tiền theo đồng
          </div>
        </div>
        <button
          onClick={handleUpdatePrices}
          disabled={updating || stocks.length === 0}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:shadow-md active:scale-95 disabled:opacity-50 dark:bg-primary-dark dark:shadow-soft-dark"
        >
          {updating ? 'Đang cập nhật…' : 'Cập nhật giá'}
        </button>
      </div>

      {error && <ErrorBanner message={error} onClose={clearError} />}
      {priceError && <ErrorBanner message={priceError} onClose={() => setPriceError(null)} />}

      <PortfolioSummary stocks={stocks} profile={profile} onProfile={setProfile} />

      <StockForm onAdd={addStock} />

      {loading ? (
        <p className="py-8 text-center text-sm text-text-muted dark:text-text-muted-dark">Đang tải…</p>
      ) : stocks.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-text-muted dark:border-border-dark dark:text-text-muted-dark">
          Chưa có mã nào. Thêm mã đầu tiên ở form trên.
        </p>
      ) : (
        <StockTable stocks={stocks} onUpdate={updateStock} onDelete={removeStock} />
      )}
    </div>
  );
}
