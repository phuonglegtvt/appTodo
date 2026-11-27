import { useMemo, useState } from 'react';
import { buildPortfolioView, type PortfolioViewInput } from '../data/portfolioView';
import { lapKeHoachPhanBo, type AllocationPlan } from '../lib/longtermAllocation';
import { CLASS_META, formatVnd } from '../lib/portfolioClassMeta';
import { danhGiaQuyTac, moTaQuyTac } from '../lib/priceRules';
import { dsTaiSan, formatGiaQuyTac, khoaTaiSan } from '../lib/ruleAssets';
import { sapDenHan } from '../lib/debtCalc';
import { useLongtermTargets } from '../hooks/useLongtermTargets';
import { usePriceRules } from '../hooks/usePriceRules';
import { useDebts } from '../hooks/useDebts';
import type { PortfolioView } from '../data/portfolioView';
import { MoneyInput } from './MoneyInput';

// Mục "Kế hoạch tháng" (tab Danh mục): nhập số tiền định đầu tư tháng này →
//   ① chia cho từng nhóm tài sản bằng ĐÚNG engine của cột "Góp tháng này"
//      (buildPortfolioView chạy lại với số tiền đó);
//   ② phần cổ phiếu chia tiếp xuống từng mã nhóm Đầu tư dài hạn theo tỷ trọng
//      đã đặt ở tab Cổ phiếu (lapKeHoachPhanBo);
//   ③ việc cần chú ý: quy tắc giá đã chạm ngưỡng, nợ đến hạn trong 7 ngày.
// App KHÔNG đặt lệnh — đây là danh sách để anh tự làm rồi ghi giao dịch.

interface Props {
  userId: string;
  input: PortfolioViewInput;
  view: PortfolioView;
}

const mo = 'text-text-muted dark:text-text-muted-dark';

export function MonthlyPlanPanel({ userId, input, view }: Props) {
  const [tien, setTien] = useState<number | null>(view.monthlyPool.totalVnd || null);
  const { targets: ltTargets } = useLongtermTargets(userId);
  const { rules } = usePriceRules(userId);
  const { debts } = useDebts(userId);

  // ① Chạy lại engine với số tiền tháng này (bỏ phần DCA rải để số nhập là tổng).
  const { plan, loiPlan } = useMemo(() => {
    if (tien === null || tien <= 0 || input.settings === null) return { plan: null, loiPlan: null };
    try {
      const v = buildPortfolioView({
        ...input,
        settings: { ...input.settings, monthly_contribution_vnd: tien, dca_capital_vnd: 0, dca_months: null },
      });
      return { plan: v.plan, loiPlan: null };
    } catch (err) {
      return { plan: null, loiPlan: err instanceof Error ? err.message : String(err) };
    }
  }, [tien, input]);

  const tienCoPhieu = plan?.buys.find((b) => b.assetClass === 'STOCKS')?.amountVnd ?? 0;

  // ② Phần cổ phiếu → từng mã dài hạn.
  const lt = input.stocks.filter((s) => s.group === 'longterm');
  const { ltPlan, ltLoi } = useMemo((): { ltPlan: AllocationPlan | null; ltLoi: string | null } => {
    if (tienCoPhieu <= 0 || lt.length === 0 || ltTargets === null) return { ltPlan: null, ltLoi: null };
    try {
      return {
        ltPlan: lapKeHoachPhanBo(lt.map((s) => ({
          id: s.id, ticker: s.ticker, priceVnd: s.current_price === null ? null : s.current_price * 1000,
          quantity: s.quantity, targetPct: ltTargets[s.id] ?? 0,
        })), Math.floor(tienCoPhieu), 1),
        ltLoi: null,
      };
    } catch (err) {
      return { ltPlan: null, ltLoi: err instanceof Error ? err.message : String(err) };
    }
  }, [tienCoPhieu, lt, ltTargets]);

  // ③ Cần chú ý.
  const taiSan = new Map(dsTaiSan(input.stocks, input.cryptos).map((a) => [khoaTaiSan(a.kind, a.symbol), a]));
  const quyTacCham = rules
    .map((r) => { const a = taiSan.get(khoaTaiSan(r.asset_kind, r.symbol)); return danhGiaQuyTac(r, a?.gia ?? null, a?.soLuong ?? null); })
    .filter((e) => e.status === 'CHAM');
  const homNay = input.asOf;
  const noDenHan = sapDenHan(debts, homNay, 7);

  return (
    <div className="flex flex-col gap-4">
      <section className="surface-card flex flex-wrap items-end gap-3 p-4">
        <label className="flex flex-col gap-1">
          <span className={`text-[11px] font-bold uppercase tracking-[0.06em] ${mo}`}>Số tiền đầu tư tháng này (đ)</span>
          <MoneyInput value={tien} onChange={setTien}
            className="w-48 rounded-md border border-border bg-surface px-3 py-2 text-right font-mono text-[14px] text-text outline-none focus:border-primary dark:border-border-dark dark:bg-surface-2dark dark:text-text-dark" />
        </label>
        <p className={`max-w-xl text-[12px] ${mo}`}>
          Mặc định = góp hàng tháng + phần vốn DCA ở màn Cấu hình ({formatVnd(view.monthlyPool.totalVnd)}). Sửa số này để
          xem nếu tháng này nạp nhiều / ít hơn thì chia thế nào.
        </p>
      </section>

      {loiPlan && <p role="alert" className="text-[13px] text-red-600 dark:text-red-400">⚠ {loiPlan}</p>}

      {plan && (
        <section className="surface-card flex flex-col gap-2 p-4">
          <div className="text-[15px] font-bold text-text dark:text-text-dark">① Chia theo nhóm tài sản</div>
          <ul className="flex flex-col gap-1 text-[13px]">
            {plan.buys.filter((b) => b.amountVnd > 0).map((b) => (
              <li key={b.assetClass} className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: CLASS_META[b.assetClass].colorVar }} />
                <strong className="w-24 text-text dark:text-text-dark">MUA {CLASS_META[b.assetClass].label}</strong>
                <span className="font-mono tabular-nums text-text dark:text-text-dark">{formatVnd(b.amountVnd)}</span>
              </li>
            ))}
            {plan.doNotBuy.map((d) => (
              <li key={d.assetClass} className={`flex items-center gap-2 ${mo}`}>
                <span className="inline-block h-2.5 w-2.5 rounded-full opacity-40" style={{ background: CLASS_META[d.assetClass].colorVar }} />
                <span className="w-24">KHÔNG MUA {CLASS_META[d.assetClass].label}</span>
                <span>{d.reason}</span>
              </li>
            ))}
            {plan.unallocatedVnd > 0 && <li className={mo}>Chưa chia: {formatVnd(plan.unallocatedVnd)}</li>}
          </ul>
        </section>
      )}

      {plan && tienCoPhieu > 0 && (
        <section className="surface-card flex flex-col gap-2 p-4">
          <div className="text-[15px] font-bold text-text dark:text-text-dark">② Phần cổ phiếu ({formatVnd(tienCoPhieu)}) → từng mã Đầu tư dài hạn</div>
          {lt.length === 0 ? (
            <p className={`text-[13px] ${mo}`}>Chưa có mã nào ở nhóm Đầu tư dài hạn.</p>
          ) : ltTargets === null ? (
            <p className={`text-[13px] ${mo}`}>Chưa lưu tỷ trọng từng mã — vào tab Cổ phiếu → “Phân bổ Đầu tư dài hạn” bấm Lưu tỷ trọng.</p>
          ) : ltLoi ? (
            <p role="alert" className="text-[13px] text-amber-700 dark:text-amber-400">⚠ {ltLoi}</p>
          ) : ltPlan && (
            <>
              <ul className="grid gap-1 text-[13px] [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
                {ltPlan.rows.filter((r) => r.buyShares > 0).map((r) => (
                  <li key={r.id} className="flex justify-between gap-2 rounded-md bg-surface-2 px-2 py-1 dark:bg-surface-2dark">
                    <strong className="text-text dark:text-text-dark">{r.ticker} +{r.buyShares.toLocaleString('vi-VN')} cổ</strong>
                    <span className={`font-mono tabular-nums ${mo}`}>{formatVnd(r.buyVnd)}</span>
                  </li>
                ))}
              </ul>
              <p className={`text-[12px] ${mo}`}>Dùng {formatVnd(ltPlan.spentVnd)}, dư {formatVnd(ltPlan.leftoverVnd)}. Chỉ chia cho nhóm Đầu tư dài hạn; các nhóm cổ phiếu khác anh tự chọn.</p>
            </>
          )}
        </section>
      )}

      <section className="surface-card flex flex-col gap-2 p-4">
        <div className="text-[15px] font-bold text-text dark:text-text-dark">③ Cần chú ý</div>
        {quyTacCham.length === 0 && noDenHan.length === 0 ? (
          <p className={`text-[13px] ${mo}`}>Không có quy tắc giá nào chạm ngưỡng, không có khoản nợ đến hạn trong 7 ngày.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-[13px] text-text dark:text-text-dark">
            {quyTacCham.map((e) => (
              <li key={e.rule.id}>⚑ {moTaQuyTac(e.rule, (v) => formatGiaQuyTac(e.rule.asset_kind, v), formatVnd)} — <span className="text-red-600 dark:text-red-400">đã chạm</span> (giá {e.giaHienTai === null ? '?' : formatGiaQuyTac(e.rule.asset_kind, e.giaHienTai)})</li>
            ))}
            {noDenHan.map(({ debt, conNgay }) => (
              <li key={debt.id}>▭ {debt.name} đến hạn {conNgay === 0 ? 'hôm nay' : `sau ${conNgay} ngày`} — dư nợ {formatVnd(Number(debt.balance_vnd))}{debt.monthly_payment_vnd !== null && `, định trả ${formatVnd(Number(debt.monthly_payment_vnd))}`}</li>
            ))}
          </ul>
        )}
      </section>

      <p className={`text-[12px] ${mo}`}>App không tự đặt lệnh. Làm xong anh ghi giao dịch ở tab Cổ phiếu / Crypto để số liệu tự cập nhật.</p>
    </div>
  );
}
