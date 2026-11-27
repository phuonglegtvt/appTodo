import { useEffect, useRef, useState } from 'react';
import { useDebts } from '../hooks/useDebts';
import { useNetWorthSnapshots } from '../hooks/useNetWorthSnapshots';
import { tongHopNo } from '../lib/debtCalc';
import { dauThang, thayDoi, tinhTaiSanRong, type NetWorthSnapshot } from '../lib/netWorth';
import { formatVnd, formatVndShort } from '../lib/portfolioClassMeta';
import type { PortfolioView } from '../data/portfolioView';
import { ErrorBanner } from './ErrorBanner';
import { LineChart } from './LineChart';

// Mục "Tài sản ròng" của tab Danh mục: tài sản (từ cùng số liệu tỷ trọng) − nợ
// (tab Nợ & thẻ), và lịch sử theo tháng.
//
// Tự lưu số liệu THÁNG HIỆN TẠI mỗi lần mở — nhưng CHỈ khi dữ liệu đủ (không
// thiếu giá / số lượng, đã tải xong nợ). Lưu một con số thiếu phần vào lịch sử
// còn tệ hơn không lưu: biểu đồ sẽ có một cú "sụt" giả mà không ai biết vì sao.

interface Props {
  userId: string;
  view: PortfolioView;
  asOf: string;
}

const viThang = (iso: string) => `${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const mo = 'text-text-muted dark:text-text-muted-dark';

export function NetWorthPanel({ userId, view, asOf }: Props) {
  const { debts, loading: loadingDebts, error: errDebts, clearError: clearDebtErr } = useDebts(userId);
  const { snapshots, loading: loadingSnap, error: errSnap, save, clearError: clearSnapErr } = useNetWorthSnapshots(userId);
  const [loiLuu, setLoiLuu] = useState<string | null>(null);
  const daLuu = useRef<string | null>(null);

  const no = tongHopNo(debts).tongDuNo;
  const parts = {
    stocks_vnd: view.byClass.STOCKS.marketValueVnd,
    crypto_vnd: view.byClass.CRYPTO.marketValueVnd,
    gold_vnd: view.byClass.GOLD.marketValueVnd,
    cash_vnd: view.byClass.CASH.marketValueVnd,
    debt_vnd: no,
  };
  const { assets_vnd, net_vnd } = tinhTaiSanRong(parts);
  const thang = dauThang(asOf);
  const duDuLieu = !view.incompleteData && !loadingDebts && errDebts === null;

  useEffect(() => {
    if (!duDuLieu || loadingSnap || errSnap !== null) return;
    const snap: NetWorthSnapshot = { month: thang, ...parts, assets_vnd, net_vnd };
    const khoa = JSON.stringify(snap);
    if (daLuu.current === khoa) return;
    daLuu.current = khoa;
    save(snap).catch((err: unknown) => {
      console.error('Lỗi lưu tài sản ròng tháng này:', err);
      setLoiLuu('Không lưu được số liệu tài sản ròng tháng này: ' + (err instanceof Error ? err.message : String(err)));
    });
    // parts/assets/net suy ra từ view + debts — đã nằm trong khoá so sánh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duDuLieu, loadingSnap, errSnap, thang, assets_vnd, net_vnd, save]);

  const td = thayDoi(snapshots, thang);
  const doiMau = (v: number | null) => (v === null ? '' : v >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400');
  const dau = (v: number) => (v >= 0 ? '+' : '−') + formatVnd(Math.abs(v));

  // Điểm vẽ: trục X = chỉ số tháng tính từ năm 0 (để khoảng cách đều theo tháng).
  const soThang = (m: string) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1;
  const tuSoThang = (n: number) => `${String((Math.round(n) % 12) + 1).padStart(2, '0')}/${Math.floor(Math.round(n) / 12)}`;

  return (
    <div className="flex flex-col gap-4">
      {errDebts && <ErrorBanner message={errDebts} onClose={clearDebtErr} />}
      {errSnap && <ErrorBanner message={errSnap} onClose={clearSnapErr} />}
      {loiLuu && <ErrorBanner message={loiLuu} onClose={() => setLoiLuu(null)} />}

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(210px,1fr))]">
        <div className="surface-card p-4">
          <div className={`text-[11px] font-bold tracking-[0.09em] ${mo}`}>TÀI SẢN RÒNG</div>
          <div className={`text-[26px] font-bold tracking-tight ${net_vnd < 0 ? 'text-red-600 dark:text-red-400' : 'text-text dark:text-text-dark'}`}>
            {net_vnd < 0 ? '−' : ''}{formatVnd(Math.abs(net_vnd))}
          </div>
          {td.soVoiThangTruoc !== null && td.thangTruoc && (
            <div className={`text-[12px] ${doiMau(td.soVoiThangTruoc)}`}>{dau(td.soVoiThangTruoc)} so với {viThang(td.thangTruoc)}</div>
          )}
        </div>
        <div className="surface-card p-4">
          <div className={`text-[11px] font-bold tracking-[0.09em] ${mo}`}>TỔNG TÀI SẢN</div>
          <div className="text-[22px] font-bold tracking-tight text-text dark:text-text-dark">{formatVnd(assets_vnd)}</div>
          <div className={`text-[12px] ${mo}`}>
            CP {formatVndShort(parts.stocks_vnd)} · Crypto {formatVndShort(parts.crypto_vnd)} · Vàng {formatVndShort(parts.gold_vnd)} · Tiền mặt {formatVndShort(parts.cash_vnd)}
          </div>
        </div>
        <div className="surface-card p-4">
          <div className={`text-[11px] font-bold tracking-[0.09em] ${mo}`}>TỔNG NỢ</div>
          <div className="text-[22px] font-bold tracking-tight text-red-600 dark:text-red-400">{loadingDebts ? '…' : formatVnd(no)}</div>
          <div className={`text-[12px] ${mo}`}>
            {assets_vnd > 0 ? `Nợ / tài sản: ${((no / assets_vnd) * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%` : 'Từ tab Nợ & thẻ'}
          </div>
        </div>
      </div>

      {!duDuLieu && !loadingDebts && (
        <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          Số liệu đang thiếu (thiếu giá / số lượng, hoặc chưa tải được nợ) nên <strong>chưa lưu</strong> vào lịch sử tháng {viThang(thang)} —
          tránh ghi một con số thiếu phần. Bổ sung dữ liệu rồi mở lại.
        </p>
      )}

      <section className="surface-card flex flex-col gap-2 p-4">
        <div className="text-[13px] font-semibold text-text dark:text-text-dark">Tài sản ròng theo tháng</div>
        {snapshots.length < 2 ? (
          <p className={`text-[13px] ${mo}`}>
            {loadingSnap ? 'Đang tải…' : `Mới có ${snapshots.length} tháng số liệu. App tự lưu mỗi tháng khi anh mở mục này — từ tháng sau sẽ có biểu đồ.`}
          </p>
        ) : (
          <LineChart
            ariaLabel={`Tài sản ròng từ ${viThang(snapshots[0].month)} tới ${viThang(snapshots[snapshots.length - 1].month)}`}
            series={[
              { key: 'net', label: 'Tài sản ròng', color: 'var(--viz-stocks)', points: snapshots.map((s) => ({ x: soThang(s.month), y: s.net_vnd })) },
              { key: 'assets', label: 'Tổng tài sản', color: 'var(--viz-cash)', dashed: true, points: snapshots.map((s) => ({ x: soThang(s.month), y: s.assets_vnd })) },
              { key: 'debt', label: 'Tổng nợ', color: 'var(--viz-crypto)', dashed: true, points: snapshots.map((s) => ({ x: soThang(s.month), y: s.debt_vnd })) },
            ]}
            formatX={tuSoThang}
            formatY={formatVndShort}
            formatYFull={formatVnd}
          />
        )}
        {snapshots.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13px]">
              <thead>
                <tr className={`text-right ${mo}`}>
                  <th className="px-2 py-1 text-left font-semibold">Tháng</th>
                  <th className="px-2 py-1 font-semibold">Cổ phiếu</th>
                  <th className="px-2 py-1 font-semibold">Crypto</th>
                  <th className="px-2 py-1 font-semibold">Vàng</th>
                  <th className="px-2 py-1 font-semibold">Tiền mặt</th>
                  <th className="px-2 py-1 font-semibold">Nợ</th>
                  <th className="px-2 py-1 font-semibold">Tài sản ròng</th>
                </tr>
              </thead>
              <tbody className="font-mono tabular-nums text-text dark:text-text-dark">
                {[...snapshots].reverse().map((s) => (
                  <tr key={s.month} className="border-t border-border text-right dark:border-border-dark">
                    <td className="px-2 py-1 text-left">{viThang(s.month)}</td>
                    <td className="px-2 py-1">{formatVndShort(s.stocks_vnd)}</td>
                    <td className="px-2 py-1">{formatVndShort(s.crypto_vnd)}</td>
                    <td className="px-2 py-1">{formatVndShort(s.gold_vnd)}</td>
                    <td className="px-2 py-1">{formatVndShort(s.cash_vnd)}</td>
                    <td className="px-2 py-1 text-red-600 dark:text-red-400">{formatVndShort(s.debt_vnd)}</td>
                    <td className={`px-2 py-1 font-semibold ${s.net_vnd < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>{formatVndShort(s.net_vnd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className={`text-[12px] ${mo}`}>
          Giá trị tài sản theo giá thị trường lúc mở (cổ phiếu, crypto quy theo tỷ giá hôm nay). Mỗi tháng giữ lại lần mở gần nhất.
        </p>
      </section>
    </div>
  );
}
