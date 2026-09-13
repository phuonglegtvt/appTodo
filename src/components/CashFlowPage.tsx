import { useEffect, useMemo, useState } from 'react';
import { useCashEntries } from '../hooks/useCashEntries';
import { useStocks } from '../hooks/useStocks';
import { useCryptos } from '../hooks/useCryptos';
import { useGolds } from '../hooks/useGolds';
import { useCurrency } from '../hooks/useCurrency';
import { tongVonDaBo } from '../data/holdingsMap';
import {
  locTheoThang, moiNhatTruoc, nhanThang, thangCua, thangSau, thangTruoc, tongHop,
} from '../lib/cashFlow';
import { formatVnd } from '../lib/portfolioClassMeta';
import { CashEntryForm } from './CashEntryForm';
import { CashEntryList } from './CashEntryList';
import { InvestedTotals } from './InvestedTotals';
import { ErrorBanner } from './ErrorBanner';

// Tab Thu–Chi: sổ thu–chi cá nhân theo tháng + khối lũy kế đã đầu tư.
//
// Trang này KHÔNG tính gì. Mọi phép tính nằm trong hàm thuần có test:
// `tongHop`/`locTheoThang` (cashFlow.ts) và `tongVonDaBo` (holdingsMap.ts).
// Ở đây chỉ có: gọi dữ liệu, xử lý trạng thái, và vẽ.

interface Props {
  userId: string;
}

/** Ngày hôm nay theo giờ ĐỊA PHƯƠNG. Không dùng toISOString — nó theo UTC nên
 *  với giờ VN (UTC+7) lúc 0–7h sáng sẽ ra "hôm qua". 'en-CA' cho YYYY-MM-DD. */
function homNayLocal(): string {
  return new Date().toLocaleDateString('en-CA');
}

const O_TONG = 'flex flex-col gap-1 rounded-xl border border-border bg-surface px-4 py-3 dark:border-border-dark dark:bg-surface-dark';
const NHAN_TONG = 'text-[11px] font-bold tracking-[0.06em] text-text-muted dark:text-text-muted-dark';

export function CashFlowPage({ userId }: Props) {
  const homNay = homNayLocal();
  const [thang, setThang] = useState(() => thangCua(homNay));

  const {
    entries, loading, error, addEntry, updateEntry, deleteEntry, clearError,
  } = useCashEntries(userId);

  // Ba nguồn dưới đây CHỈ để dựng khối "Lũy kế đã đầu tư" — chỉ đọc.
  const { stocks, error: errStocks, clearError: clearStocks } = useStocks(userId);
  const { cryptos, error: errCryptos, clearError: clearCryptos } = useCryptos(userId);
  const { golds, error: errGolds, clearError: clearGolds } = useGolds(userId);
  const { rate, refreshRate, loadingRate, rateError, clearRateError } = useCurrency();

  // Chỉ lấy tỷ giá khi thật sự có crypto cần quy đổi — cùng cách tab Danh mục làm.
  const coCrypto = cryptos.some((c) => c.quantity !== null && c.quantity > 0);
  useEffect(() => {
    if (coCrypto && rate === null && !loadingRate && rateError === null) void refreshRate();
  }, [coCrypto, rate, loadingRate, rateError, refreshRate]);

  const cuaThang = useMemo(
    () => moiNhatTruoc(locTheoThang(entries, thang)),
    [entries, thang],
  );
  const tong = useMemo(() => tongHop(cuaThang), [cuaThang]);

  // `tongVonDaBo` không ném lỗi khi thiếu tỷ giá — nó trả null cho phần crypto
  // để khối lũy kế vẫn hiện được cổ phiếu và vàng.
  const von = useMemo(
    () => tongVonDaBo({ stocks, cryptos, golds, usdVnd: rate ?? 0 }),
    [stocks, cryptos, golds, rate],
  );

  const xoaKhoan = (id: string) => {
    if (confirm('Xoá khoản này?')) void deleteEntry(id);
  };

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-auto p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[22px] font-bold tracking-tight text-text dark:text-text-dark">Thu – Chi</div>
          <div className="mt-0.5 text-[13px] text-text-muted dark:text-text-muted-dark">
            {cuaThang.length} khoản trong {nhanThang(thang).toLowerCase()} · số tiền theo đồng
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setThang(thangTruoc(thang))}
            aria-label="Tháng trước"
            className="btn-icon h-8 w-8 text-sm"
          >
            ‹
          </button>
          <span className="min-w-[120px] text-center text-[14px] font-semibold text-text dark:text-text-dark">
            {nhanThang(thang)}
          </span>
          <button
            onClick={() => setThang(thangSau(thang))}
            aria-label="Tháng sau"
            className="btn-icon h-8 w-8 text-sm"
          >
            ›
          </button>
          {thang !== thangCua(homNay) && (
            <button
              onClick={() => setThang(thangCua(homNay))}
              className="ml-1 rounded-md px-2 py-1 text-[12px] font-semibold text-primary hover:bg-primary-soft dark:text-primary-dark dark:hover:bg-primary-soft-dark"
            >
              Về tháng này
            </button>
          )}
        </div>
      </div>

      {error && <ErrorBanner message={error} onClose={clearError} />}
      {errStocks && <ErrorBanner message={errStocks} onClose={clearStocks} />}
      {errCryptos && <ErrorBanner message={errCryptos} onClose={clearCryptos} />}
      {errGolds && <ErrorBanner message={errGolds} onClose={clearGolds} />}
      {rateError && <ErrorBanner message={rateError} onClose={clearRateError} />}

      {/* Ba số của tháng. Vòng tiền đứng riêng bên dưới, không lẫn vào đây. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className={O_TONG}>
          <span className={NHAN_TONG}>TỔNG THU</span>
          <span className="font-mono text-[20px] font-bold tabular-nums text-green-600 dark:text-green-400">
            {formatVnd(tong.thu)}
          </span>
        </div>
        <div className={O_TONG}>
          <span className={NHAN_TONG}>TỔNG CHI</span>
          <span className="font-mono text-[20px] font-bold tabular-nums text-red-600 dark:text-red-400">
            {formatVnd(tong.chi)}
          </span>
        </div>
        <div className={O_TONG}>
          <span className={NHAN_TONG}>CÒN LẠI</span>
          <span
            className={`font-mono text-[20px] font-bold tabular-nums ${
              tong.conLai < 0
                ? 'text-red-600 dark:text-red-400'
                : 'text-text dark:text-text-dark'
            }`}
          >
            {formatVnd(tong.conLai)}
          </span>
        </div>
      </div>

      {tong.vongTien > 0 && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-800 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-300">
          ⟳ <strong>Vòng tiền {formatVnd(tong.vongTien)}</strong> (đáo hạn thẻ) — tiền ra
          rồi quay về ví nên <strong>không</strong> tính vào tổng chi. Riêng phí đáo hạn
          là chi thật, ghi bằng danh mục "Phí đáo hạn thẻ".
        </p>
      )}

      <CashEntryForm homNay={homNay} onAdd={addEntry} />

      {loading ? (
        <p className="py-8 text-center text-sm text-text-muted dark:text-text-muted-dark">Đang tải…</p>
      ) : (
        <CashEntryList entries={cuaThang} onUpdate={updateEntry} onDelete={xoaKhoan} />
      )}

      <InvestedTotals von={von} dangChoTyGia={coCrypto && rate === null && rateError === null} />
    </div>
  );
}
