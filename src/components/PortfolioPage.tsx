import { useEffect, useMemo, useState } from 'react';
import { useStocks } from '../hooks/useStocks';
import { useCryptos } from '../hooks/useCryptos';
import { useGolds } from '../hooks/useGolds';
import { useCurrency } from '../hooks/useCurrency';
import { usePortfolioConfig } from '../hooks/usePortfolioConfig';
import { buildPortfolioView } from '../data/portfolioView';
import { formatVnd } from '../lib/portfolioClassMeta';
import { AllocationDonut } from './AllocationDonut';
import { AllocationTable } from './AllocationTable';
import { TargetSettingsForm } from './TargetSettingsForm';
import { GoldTable } from './GoldTable';
import { ErrorBanner } from './ErrorBanner';
import type { PortfolioView } from '../data/portfolioView';

// Tab Danh mục: tỷ trọng thực tế vs mục tiêu + cần bổ sung bao nhiêu vốn.
//
// Nguồn số liệu là holdings THẬT (public.stocks/cryptos/golds), không phải sổ
// giao dịch — xem src/data/holdingsMap.ts để biết vì sao.
//
// Trang này KHÔNG tính gì. Mọi phép tính nằm trong buildPortfolioView (hàm
// thuần, có test). Ở đây chỉ có: gọi dữ liệu, xử lý trạng thái, và vẽ.

type Muc = 'ty-trong' | 'cau-hinh';

interface Props {
  userId: string;
}

/** ISO date của hôm nay. Truyền vào domain qua asOf — domain không tự gọi Date. */
function homNay(): string {
  return new Date().toISOString().slice(0, 10);
}

export function PortfolioPage({ userId }: Props) {
  const [muc, setMuc] = useState<Muc>('ty-trong');

  const { stocks, loading: loadingStocks, error: errStocks } = useStocks(userId);
  const { cryptos, loading: loadingCryptos, error: errCryptos } = useCryptos(userId);
  const {
    golds, loading: loadingGolds, error: errGolds,
    addGold, updateGold, deleteGold, clearError: clearGoldError,
  } = useGolds(userId);
  const {
    targets, settings, loading: loadingConfig, error: errConfig,
    saveTargetRows, saveContribution, saveDca, clearError: clearConfigError,
  } = usePortfolioConfig(userId);
  const { rate, refreshRate, loadingRate, rateError, clearRateError } = useCurrency();

  // Cần tỷ giá để quy đổi crypto. Lấy một lần khi vào tab nếu chưa có bản lưu.
  const coCrypto = cryptos.some((c) => c.quantity !== null && c.quantity > 0);
  useEffect(() => {
    if (coCrypto && rate === null && !loadingRate && rateError === null) void refreshRate();
  }, [coCrypto, rate, loadingRate, rateError, refreshRate]);

  // Có crypto mà chưa có tỷ giá ⇒ CHƯA tính được, và đó là trạng thái ĐANG TẢI
  // chứ không phải lỗi. Không chặn ở đây thì buildPortfolioView nhận usdVnd = 0
  // rồi ném "tỷ giá không hợp lệ: 0", làm banner lỗi nhá lên mỗi lần mở tab
  // trong khi thực tế chỉ là request tỷ giá chưa về.
  const thieuTyGia = coCrypto && rate === null;

  const dangTai =
    loadingStocks || loadingCryptos || loadingGolds || loadingConfig
    || (thieuTyGia && rateError === null);

  // Tính lại khi bất kỳ nguồn nào đổi. Lỗi từ buildPortfolioView (thiếu cấu
  // hình, dữ liệu bất thường) bắt ở đây để hiện banner, KHÔNG để nó làm trắng
  // cả trang.
  const { view, viewError } = useMemo((): {
    view: PortfolioView | null; viewError: string | null;
  } => {
    if (dangTai) return { view: null, viewError: null };
    // Lấy tỷ giá thất bại: KHÔNG gọi buildPortfolioView với usdVnd = 0. Nó sẽ
    // ném "tỷ giá không hợp lệ: 0" — đúng về kỹ thuật nhưng người dùng đọc
    // xong không biết phải làm gì, lại chồng lên banner lỗi tỷ giá đã có.
    if (thieuTyGia) {
      return {
        view: null,
        viewError:
          'Chưa có tỷ giá USD→VND nên không quy đổi được giá trị crypto. '
          + 'Bấm “thử lại” ở trên, hoặc kiểm tra kết nối mạng. '
          + 'Danh mục không hiện số liệu nửa vời.',
      };
    }
    try {
      return {
        view: buildPortfolioView({
          asOf: homNay(),
          stocks, cryptos, golds, targets, settings,
          // rate null nhưng không có crypto nào thì giá trị này không được dùng
          // tới — holdingsMap chỉ kiểm tỷ giá khi thật sự có crypto cần quy đổi.
          usdVnd: rate ?? 0,
        }),
        viewError: null,
      };
    } catch (err) {
      console.error('Lỗi dựng số liệu danh mục:', err);
      return { view: null, viewError: err instanceof Error ? err.message : String(err) };
    }
  }, [dangTai, thieuTyGia, stocks, cryptos, golds, targets, settings, rate]);

  const tabBtn = (k: Muc) =>
    `rounded-lg px-3 py-1.5 text-sm font-semibold transition ease-out ${
      muc === k
        ? 'bg-primary text-white dark:bg-primary-dark dark:text-bg-dark'
        : 'text-text-muted hover:bg-surface-2 hover:text-text dark:text-text-muted-dark dark:hover:bg-surface-2dark dark:hover:text-text-dark'
    }`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setMuc('ty-trong')} className={tabBtn('ty-trong')}>
          Tỷ trọng
        </button>
        <button onClick={() => setMuc('cau-hinh')} className={tabBtn('cau-hinh')}>
          Cấu hình
        </button>
        {/* Hiện cả khi rate = null: đúng lúc lấy tỷ giá thất bại là lúc cần nút
            thử lại nhất. Ẩn nút ở ca đó thì thông báo lỗi bảo "bấm cập nhật"
            mà không có gì để bấm. */}
        {(rate !== null || coCrypto) && (
          <span className="ml-auto text-[12px] text-text-muted dark:text-text-muted-dark">
            {rate === null ? 'Chưa có tỷ giá USD→VND' : `1 USD = ${rate.toLocaleString('vi-VN')} đ`}
            <button
              onClick={() => void refreshRate()}
              disabled={loadingRate}
              className="ml-2 underline decoration-dotted hover:no-underline disabled:opacity-50"
            >
              {loadingRate ? 'đang lấy…' : rate === null ? 'thử lại' : 'cập nhật'}
            </button>
          </span>
        )}
      </div>

      {errStocks !== null && <ErrorBanner message={errStocks} />}
      {errCryptos !== null && <ErrorBanner message={errCryptos} />}
      {errGolds !== null && <ErrorBanner message={errGolds} onClose={clearGoldError} />}
      {errConfig !== null && <ErrorBanner message={errConfig} onClose={clearConfigError} />}
      {rateError !== null && (
        <ErrorBanner
          message={`Không lấy được tỷ giá USD→VND: ${rateError} — giá trị crypto chưa quy đổi được.`}
          onClose={clearRateError}
        />
      )}
      {viewError !== null && <ErrorBanner message={viewError} />}

      {dangTai && (
        <p className="text-sm text-text-muted dark:text-text-muted-dark">
          {thieuTyGia ? 'Đang lấy tỷ giá USD→VND để quy đổi giá trị crypto…' : 'Đang tải…'}
        </p>
      )}

      {muc === 'ty-trong' && view !== null && (
        <>
          {/* Thiếu dữ liệu thì nói ra TRƯỚC biểu đồ — không để người dùng đọc
              một tỷ trọng thiếu phần mà tưởng là đủ. */}
          {view.missingQuantitySymbols.length > 0 && (
            <div
              role="alert"
              className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
            >
              <strong>{view.missingQuantitySymbols.length} mã đã bỏ tiền vào nhưng chưa
              nhập số lượng:</strong>{' '}
              {view.missingQuantitySymbols.join(', ')}. Tỷ trọng dưới đây{' '}
              <strong>chưa tính</strong> các mã này. Vào tab Cổ phiếu điền số lượng để
              số liệu đúng.
            </div>
          )}

          {view.snapshot.missingPriceSymbols.length > 0 && (
            <div
              role="alert"
              className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
            >
              <strong>{view.snapshot.missingPriceSymbols.length} tài sản đang giữ mà
              chưa có giá:</strong> {view.snapshot.missingPriceSymbols.join(', ')}. Nhập
              giá rồi xem lại — kế hoạch tính trên giá thiếu còn tệ hơn không có kế hoạch.
            </div>
          )}

          <section className="surface-card p-5">
            <AllocationDonut
              slices={view.visibleClasses.map((c) => ({
                assetClass: c,
                valueVnd: view.snapshot.classValues[c],
              }))}
              totalVnd={view.plan.totalVnd}
            />
          </section>

          <section className="surface-card flex flex-col gap-2 p-2 sm:p-4">
            <AllocationTable view={view} />
            {/* Cột "Góp tháng này" chia từ một con số ghép — nói ra nó gồm gì,
                nếu không thì bật kế hoạch DCA lên là con số tự nhiên to ra mà
                không có chỗ nào giải thích. */}
            <p className="px-3 text-[12px] leading-relaxed text-text-muted dark:text-text-muted-dark">
              Cột “Góp tháng này” chia từ{' '}
              <strong className="text-text dark:text-text-dark">
                {formatVnd(view.monthlyPool.totalVnd)}
              </strong>
              {' '}= {formatVnd(view.monthlyPool.contributionVnd)} góp hàng tháng
              {' + '}{formatVnd(view.monthlyPool.dcaSliceVnd)} vốn bổ sung DCA.
              {view.monthlyPool.lyDoKhongCoDca === 'chua-dat-thang' && (
                <>
                  {' '}
                  <span className="font-semibold text-amber-700 dark:text-amber-400">
                    Đã có vốn DCA nhưng chưa nhập số tháng nên phần bổ sung vẫn là 0 —
                    vào tab Cấu hình điền số tháng.
                  </span>
                </>
              )}
            </p>
          </section>

          {view.topUp.status === 'OK' && view.topUp.totalNeededVnd > 0 && (
            <section className="surface-card p-5">
              <div className="text-[11px] font-bold tracking-[0.09em] text-text-muted dark:text-text-muted-dark">
                CẦN BỔ SUNG ĐỂ VỀ ĐÚNG MỤC TIÊU
              </div>
              <div className="mt-1 text-[26px] font-bold tracking-tight text-text dark:text-text-dark">
                {formatVnd(view.topUp.totalNeededVnd)}
              </div>
              <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-text-muted dark:text-text-muted-dark">
                Đây là số tiền <strong>mới</strong> cần nạp để mọi nhóm về đúng tỷ
                trọng mà <strong>không phải bán</strong> gì. Nhóm đang vượt xa nhất
                ấn định con số này — nó nhận thêm 0 đồng, các nhóm khác nhận phần
                còn lại (xem cột “Về đúng target”).
              </p>
            </section>
          )}

          {view.topUp.status === 'IMPOSSIBLE_WITHOUT_SELLING' && (
            <section className="surface-card p-5">
              <p className="text-sm leading-relaxed text-text dark:text-text-dark">
                Không thể về đúng mục tiêu bằng cách nạp thêm tiền: nhóm{' '}
                <strong>
                  {view.topUp.blockingClasses.join(', ')}
                </strong>{' '}
                có mục tiêu 0% mà vẫn đang giữ tiền — nạp bao nhiêu cũng không kéo tỷ
                trọng của nó về 0. Phải bán bớt, hoặc đặt lại mục tiêu ở màn Cấu hình.
              </p>
            </section>
          )}

          {view.alerts.length > 0 && (
            <section className="surface-card flex flex-col gap-2 p-5">
              <div className="text-[11px] font-bold tracking-[0.09em] text-text-muted dark:text-text-muted-dark">
                CẢNH BÁO
              </div>
              <ul className="flex flex-col gap-1.5">
                {view.alerts.map((a, i) => (
                  <li
                    key={`${a.code}-${i}`}
                    className="flex items-start gap-2 text-[13px] leading-relaxed text-text dark:text-text-dark"
                  >
                    <span aria-hidden="true">
                      {a.severity === 'ACTION' ? '⚠' : a.severity === 'WARN' ? '△' : 'ⓘ'}
                    </span>
                    <span>{a.message}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {muc === 'cau-hinh' && !dangTai && (
        <>
          <section className="surface-card p-5">
            <TargetSettingsForm
              targets={targets}
              settings={settings}
              onSaveTargets={saveTargetRows}
              onSaveContribution={saveContribution}
              onSaveDca={saveDca}
            />
          </section>
          <section className="surface-card p-2 sm:p-4">
            <GoldTable
              golds={golds}
              onAdd={addGold}
              onUpdate={updateGold}
              onDelete={deleteGold}
            />
          </section>
        </>
      )}
    </div>
  );
}
