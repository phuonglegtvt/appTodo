import { useState } from 'react';
import { useStocks } from '../hooks/useStocks';
import { useStockTransactions } from '../hooks/useStockTransactions';
import { fetchQuotes } from '../lib/stockPrice';
import { nextPeak } from '../lib/peakDrawdown';
import { filterStocks } from '../lib/stockFilters';
import type { RiskProfile, StockUpdate } from '../types/stock';
import { PortfolioSummary } from './PortfolioSummary';
import { StockForm } from './StockForm';
import { StockTable } from './StockTable';
import { ErrorBanner } from './ErrorBanner';
import { StockTransactionForm } from './StockTransactionForm';
import { StockTransactionList } from './StockTransactionList';

interface Props {
  userId: string;
}

/** Trang Cổ phiếu: summary tỷ trọng + nút cập nhật giá + form thêm mã + bảng gom nhóm + lịch sử giao dịch. */
export function StocksPage({ userId }: Props) {
  const { stocks, loading, error, addStock, updateStock, deleteStock, clearError } = useStocks(userId);
  const [profile, setProfile] = useState<RiskProfile>('balance');
  const [priceError, setPriceError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [query, setQuery] = useState('');
  const {
    transactions, loading: loadingTx, error: txError, record, undo, clearError: clearTxError,
  } = useStockTransactions(userId);

  async function handleUpdatePrices() {
    setPriceError(null);
    const tickers = stocks.map((s) => s.ticker);
    if (tickers.length === 0) return;
    setUpdating(true);
    try {
      // MỘT request/mã lấy cả giá lẫn đỉnh — xem fetchQuotes để biết vì sao gộp.
      const { quotes, failed } = await fetchQuotes(tickers);

      // MỘT lần ghi cho mỗi mã, gộp cả giá lẫn đỉnh: ghi hai lần liên tiếp lên
      // cùng một dòng làm realtime bắn hai sự kiện và bảng nháy hai nhịp.
      await Promise.all(
        stocks.map((s) => {
          const q = quotes[s.ticker.toUpperCase()];
          if (q === undefined) return null; // mã lỗi: đã nằm trong `failed`

          // Đỉnh chỉ được TĂNG (xem nextPeak): nguồn trả thấp hơn đỉnh đang lưu
          // thì giữ đỉnh cũ, không đạp xuống.
          const dinh = nextPeak(s.peak_price, q.peakVnd, q.priceVnd ?? s.current_price);

          const patch: StockUpdate = {};
          if (q.priceVnd != null) patch.current_price = q.priceVnd;
          if (dinh != null && dinh !== s.peak_price) patch.peak_price = dinh;
          return Object.keys(patch).length > 0 ? updateStock(s.id, patch) : null;
        }).filter((p): p is Promise<void> => p !== null),
      );

      // Có mã lỗi nhưng không hỏng cả lần: báo rõ mã nào lỗi, không nuốt.
      if (failed.length > 0) {
        const detail = failed.map((f) => `${f.ticker} (${f.message})`).join(', ');
        setPriceError(
          `Không lấy được số của ${failed.length} mã: ${detail}. `
          + 'Có thể nhập giá và đỉnh tay.',
        );
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

  const visibleStocks = filterStocks(stocks, query);

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-auto p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[22px] font-bold tracking-tight text-text dark:text-text-dark">Cổ phiếu</div>
          <div className="mt-0.5 text-[13px] text-text-muted dark:text-text-muted-dark">
            {query.trim()
              ? `${visibleStocks.length}/${stocks.length} mã khớp "${query.trim()}"`
              : `${stocks.length} mã · giá & số tiền đầu tư theo nghìn đồng, cổ tức theo đồng`}
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
      {txError && <ErrorBanner message={txError} onClose={clearTxError} />}

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Tìm theo mã hoặc tên công ty…"
        aria-label="Tìm cổ phiếu"
        className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none transition-colors placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-border-dark dark:bg-surface-2dark dark:text-text-dark dark:placeholder:text-text-muted-dark dark:focus:border-primary-dark"
      />

      <PortfolioSummary stocks={stocks} profile={profile} onProfile={setProfile} />

      <StockForm onAdd={addStock} />

      {loading ? (
        <p className="py-8 text-center text-sm text-text-muted dark:text-text-muted-dark">Đang tải…</p>
      ) : stocks.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-text-muted dark:border-border-dark dark:text-text-muted-dark">
          Chưa có mã nào. Thêm mã đầu tiên ở form trên.
        </p>
      ) : visibleStocks.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-text-muted dark:border-border-dark dark:text-text-muted-dark">
          Không có mã nào khớp "{query.trim()}".
        </p>
      ) : (
        <StockTable stocks={visibleStocks} onUpdate={updateStock} onDelete={removeStock} />
      )}

      <section className="flex flex-col gap-3">
        <div>
          <div className="text-[17px] font-bold tracking-tight text-text dark:text-text-dark">Lịch sử đầu tư</div>
          <div className="mt-0.5 text-[13px] text-text-muted dark:text-text-muted-dark">
            Mỗi lần mua/bán tự cộng dồn vào bảng trên: số lượng, đã đầu tư và giá vốn TB.
          </div>
        </div>
        <StockTransactionForm stocks={stocks} onRecord={record} />
        {loadingTx ? (
          <p className="py-4 text-center text-sm text-text-muted dark:text-text-muted-dark">Đang tải lịch sử giao dịch…</p>
        ) : (
          <StockTransactionList transactions={transactions} stocks={stocks} onUndo={undo} />
        )}
      </section>
    </div>
  );
}
