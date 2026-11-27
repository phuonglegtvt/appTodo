import { useRef, useState } from 'react';
import { chayDca, luiNam, soNgay, type DcaResult } from '../lib/dcaBacktest';
import { fetchPriceHistory, type AssetKind, type PriceHistory } from '../lib/priceHistory';
import { SymbolPicker } from './SymbolPicker';
import { parseVnNumber } from '../lib/parseNumber';
import { formatVnd, formatVndShort } from '../lib/portfolioClassMeta';
import { MoneyInput } from './MoneyInput';
import { LineChart, type LineSeries } from './LineChart';
import { ErrorBanner } from './ErrorBanner';

// Giả lập DCA: "nếu mỗi tháng mua X đồng mã này từ ngày đó thì giờ có bao nhiêu".
// Tải giá lịch sử (src/lib/priceHistory.ts) rồi chạy chayDca (src/lib/dcaBacktest.ts,
// có test). So sánh tối đa 3 mã cùng lúc, kèm đường "gửi tiết kiệm" cùng dòng tiền.

interface Asset {
  kind: AssetKind;
  symbol: string;
  /** Nhãn loại cụ thể từ ô tìm mã ("ETF", "Chỉ số"…); thiếu thì dùng KIND_LABEL. */
  typeLabel?: string;
}

interface AssetRun {
  asset: Asset;
  history: PriceHistory;
  result: DcaResult;
}

const KIND_LABEL: Record<AssetKind, string> = {
  vn: 'CP / ETF / Chỉ số',
  crypto: 'Crypto',
  fund: 'Quỹ mở',
};

const GOI_Y: Asset[] = [
  { kind: 'vn', symbol: 'VNINDEX', typeLabel: 'Chỉ số' },
  { kind: 'vn', symbol: 'E1VFVN30', typeLabel: 'ETF' },
  { kind: 'vn', symbol: 'FPT', typeLabel: 'Cổ phiếu' },
  { kind: 'crypto', symbol: 'BTC', typeLabel: 'Crypto' },
  { kind: 'fund', symbol: 'VESAF', typeLabel: 'Quỹ mở' },
  { kind: 'fund', symbol: 'DCDS', typeLabel: 'Quỹ mở' },
];

const MAU = ['var(--viz-stocks)', 'var(--viz-crypto)', 'var(--viz-gold)'];
const MAU_VON = '#8a8a94';
const MAU_GUI = 'var(--viz-cash)';
const TOI_DA = 3;

const oNhap = 'w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-[14px] tabular-nums text-text outline-none focus:border-primary dark:border-border-dark dark:bg-surface-2dark dark:text-text-dark dark:focus:border-primary-dark';
const nhan = 'text-[13px] font-semibold text-text dark:text-text-dark';
const muted = 'text-text-muted dark:text-text-muted-dark';
const nutPhu = (on: boolean) =>
  `rounded-lg border px-2.5 py-1 text-[13px] font-semibold transition ease-out ${
    on
      ? 'border-primary bg-primary-soft text-primary dark:border-primary-dark dark:bg-primary-soft-dark dark:text-primary-dark'
      : 'border-border text-text-muted hover:text-text dark:border-border-dark dark:text-text-muted-dark dark:hover:text-text-dark'
  }`;
const nutChinh = 'rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition ease-out hover:opacity-90 active:scale-95 disabled:opacity-50 dark:bg-primary-dark dark:text-bg-dark';

/** Hôm nay theo giờ máy người dùng, YYYY-MM-DD. */
function homNay(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const viDate = (iso: string) => iso.split('-').reverse().join('/');
const ngaySangIso = (n: number) => new Date(n * 86_400_000).toISOString().slice(0, 10);
const pct = (v: number) => `${v >= 0 ? '+' : ''}${v.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%`;
const mauLaiLo = (v: number) => (v >= 0 ? 'text-priority-low' : 'text-priority-high');

function formatGia(v: number, unit: PriceHistory['unit']): string {
  if (unit === 'USD') return '$' + v.toLocaleString('en-US', { maximumFractionDigits: v < 10 ? 4 : 2 });
  if (unit === 'điểm') return v.toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + ' điểm';
  return Math.round(v).toLocaleString('vi-VN') + ' đ';
}

function formatDonVi(v: number): string {
  return v.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
}

export function DcaSimulator() {
  const today = homNay();
  const [assets, setAssets] = useState<Asset[]>([GOI_Y[0]]);
  const [soTien, setSoTien] = useState<number | null>(3_000_000);
  const [soNamChon, setSoNamChon] = useState<number | null>(5);
  const [tuNgay, setTuNgay] = useState(luiNam(today, 5));
  const [denNgay, setDenNgay] = useState(today);
  const [ngayText, setNgayText] = useState('5');
  const [phiText, setPhiText] = useState('0');
  const [laiGuiText, setLaiGuiText] = useState('6');

  const [dangChay, setDangChay] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  const [runs, setRuns] = useState<AssetRun[] | null>(null);
  const [batDauChung, setBatDauChung] = useState<string | null>(null);
  const lanChay = useRef(0);

  function themMa(a: Asset) {
    const symbol = a.symbol.trim().toUpperCase();
    if (!symbol) return;
    if (assets.length >= TOI_DA) {
      setLoi(`Chỉ so sánh tối đa ${TOI_DA} mã cùng lúc.`);
      return;
    }
    if (assets.some((x) => x.kind === a.kind && x.symbol === symbol)) return;
    setAssets([...assets, { kind: a.kind, symbol, typeLabel: a.typeLabel }]);
  }

  function chonSoNam(n: number) {
    setSoNamChon(n);
    setTuNgay(luiNam(denNgay, n));
  }

  async function chay() {
    setLoi(null);
    const ngay = parseVnNumber(ngayText);
    const phi = parseVnNumber(phiText);
    const laiGui = parseVnNumber(laiGuiText);
    if (assets.length === 0) return setLoi('Thêm ít nhất một mã để giả lập.');
    if (soTien === null) return setLoi('Số tiền mỗi kỳ chưa hợp lệ.');
    if (ngay === null || phi === null || laiGui === null) return setLoi('Ngày mua, phí và lãi gửi phải là số.');

    const id = ++lanChay.current;
    setDangChay(true);
    try {
      const settled = await Promise.allSettled(
        assets.map((a) => fetchPriceHistory(a.kind, a.symbol, tuNgay, denNgay)),
      );
      if (id !== lanChay.current) return; // đã bấm chạy lần mới, bỏ kết quả cũ
      const hongs = settled.flatMap((s, i) =>
        s.status === 'rejected' ? [`${assets[i].symbol}: ${s.reason instanceof Error ? s.reason.message : String(s.reason)}`] : []);
      if (hongs.length > 0) {
        settled.forEach((s) => { if (s.status === 'rejected') console.error('Lỗi tải giá lịch sử:', s.reason); });
        throw new Error(`Không tải được giá — ${hongs.join(' · ')}`);
      }
      const histories = settled.map((s) => (s as PromiseFulfilledResult<PriceHistory>).value);

      // So sánh công bằng: mọi mã bắt đầu cùng một tháng. Mã nào lên sàn muộn
      // nhất quyết định điểm bắt đầu chung — báo rõ cho người dùng.
      const dauDuLieuMuonNhat = histories
        .map((h) => h.prices.find((p) => p.date >= tuNgay)?.date ?? h.prices[0].date)
        .reduce((a, b) => (a > b ? a : b));
      const batDau = dauDuLieuMuonNhat.slice(0, 7) > tuNgay.slice(0, 7) ? `${dauDuLieuMuonNhat.slice(0, 7)}-01` : tuNgay;

      const ketQua = histories.map((history, i) => ({
        asset: assets[i],
        history,
        result: chayDca({
          prices: history.prices,
          soTienMoiKy: soTien,
          tuNgay: batDau,
          denNgay,
          ngayTrongThang: ngay,
          phiMuaPct: phi,
          laiGuiPct: laiGui,
        }),
      }));
      setRuns(ketQua);
      setBatDauChung(batDau > tuNgay ? batDau : null);
    } catch (e) {
      if (id !== lanChay.current) return;
      console.error('Lỗi giả lập DCA:', e);
      setLoi(e instanceof Error ? e.message : String(e));
      setRuns(null);
    } finally {
      if (id === lanChay.current) setDangChay(false);
    }
  }

  const dau = runs?.[0]?.result;
  const coCrypto = runs?.some((r) => r.asset.kind === 'crypto') ?? false;
  const laiGuiHienThi = parseVnNumber(laiGuiText) ?? 0;

  const series: LineSeries[] = runs === null || !dau ? [] : [
    ...runs.map((r, i) => ({
      key: `${r.asset.kind}-${r.asset.symbol}`,
      label: r.asset.symbol,
      color: MAU[i],
      points: r.result.series.map((p) => ({ x: soNgay(p.date), y: p.giaTri })),
    })),
    { key: 'gui', label: `Gửi tiết kiệm ${laiGuiHienThi}%/năm`, color: MAU_GUI, dashed: true,
      points: dau.series.map((p) => ({ x: soNgay(p.date), y: p.guiTietKiem })) },
    { key: 'von', label: 'Vốn đã bỏ', color: MAU_VON, dashed: true,
      points: dau.series.map((p) => ({ x: soNgay(p.date), y: p.von })) },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-[17px] font-bold text-text dark:text-text-dark">Giả lập DCA</h2>
        <p className={`text-[12px] ${muted}`}>
          Nếu mỗi tháng đều đặn mua một số tiền cố định từ một ngày trong quá khứ, hôm nay
          bạn có bao nhiêu? Tính trên giá lịch sử thật của cổ phiếu, ETF, chỉ số, crypto hoặc quỹ mở.
        </p>
      </div>

      {loi !== null && <ErrorBanner message={loi} onClose={() => setLoi(null)} />}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        {/* ---- Cột nhập ---- */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className={nhan}>Mã giả lập (tối đa {TOI_DA})</span>
            <ul className="flex flex-wrap gap-2">
              {assets.map((a, i) => (
                <li key={`${a.kind}-${a.symbol}`}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-[13px] dark:border-border-dark">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: MAU[i] }} />
                  <strong className="text-text dark:text-text-dark">{a.symbol}</strong>
                  <span className={`text-[11px] ${muted}`}>{a.typeLabel ?? KIND_LABEL[a.kind]}</span>
                  <button type="button" aria-label={`Bỏ ${a.symbol}`}
                    onClick={() => setAssets(assets.filter((_, j) => j !== i))}
                    className={`ml-1 ${muted} hover:text-priority-high`}>×</button>
                </li>
              ))}
            </ul>
            <SymbolPicker
              onPick={(o) => themMa(o)}
              disabled={assets.length >= TOI_DA}
              daChon={assets}
            />
            <div className="flex flex-wrap gap-1.5">
              {GOI_Y.filter((g) => !assets.some((a) => a.symbol === g.symbol)).map((g) => (
                <button key={g.symbol} type="button" onClick={() => themMa(g)} disabled={assets.length >= TOI_DA}
                  className={`${nutPhu(false)} text-[12px] disabled:opacity-40`}>+ {g.symbol}</button>
              ))}
            </div>
          </div>

          <label className="flex flex-col gap-1">
            <span className={nhan}>Mỗi tháng đầu tư (đ)</span>
            <MoneyInput value={soTien} onChange={setSoTien} className={`${oNhap} text-right`} />
            <div className="flex flex-wrap gap-1.5">
              {[1, 3, 5, 10].map((tr) => (
                <button key={tr} type="button" onClick={() => setSoTien(tr * 1e6)} className={nutPhu(soTien === tr * 1e6)}>
                  {tr} tr
                </button>
              ))}
            </div>
          </label>

          <div className="flex flex-col gap-1">
            <span className={nhan}>Khoảng thời gian</span>
            <div className="flex flex-wrap gap-1.5">
              {[1, 3, 5, 10].map((n) => (
                <button key={n} type="button" onClick={() => chonSoNam(n)} className={nutPhu(soNamChon === n)}>
                  {n} năm
                </button>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-0.5">
                <span className={`text-[12px] ${muted}`}>Từ ngày</span>
                <input type="date" value={tuNgay} max={denNgay}
                  onChange={(e) => { setTuNgay(e.target.value); setSoNamChon(null); }} className={oNhap} />
              </label>
              <label className="flex flex-col gap-0.5">
                <span className={`text-[12px] ${muted}`}>Đến ngày</span>
                <input type="date" value={denNgay} max={today}
                  onChange={(e) => { setDenNgay(e.target.value); setSoNamChon(null); }} className={oNhap} />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <label className="flex flex-col gap-0.5">
              <span className={`text-[12px] ${muted}`}>Ngày mua (1–28)</span>
              <input inputMode="numeric" value={ngayText} onChange={(e) => setNgayText(e.target.value)} className={`${oNhap} text-right`} />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className={`text-[12px] ${muted}`}>Phí mua (%)</span>
              <input inputMode="decimal" value={phiText} onChange={(e) => setPhiText(e.target.value)} className={`${oNhap} text-right`} />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className={`text-[12px] ${muted}`}>So gửi (%/năm)</span>
              <input inputMode="decimal" value={laiGuiText} onChange={(e) => setLaiGuiText(e.target.value)} className={`${oNhap} text-right`} />
            </label>
          </div>

          <button type="button" onClick={() => void chay()} disabled={dangChay} className={nutChinh}>
            {dangChay ? 'Đang tải giá lịch sử…' : 'Chạy giả lập'}
          </button>
        </div>

        {/* ---- Cột kết quả ---- */}
        <div className="flex min-w-0 flex-col gap-4">
          {runs === null && !dangChay && (
            <p className={`rounded-lg border border-dashed border-border p-6 text-center text-sm dark:border-border-dark ${muted}`}>
              Chọn mã, số tiền, khoảng thời gian rồi bấm <strong>Chạy giả lập</strong>.
            </p>
          )}

          {runs !== null && dau && (
            <>
              <div className="rounded-lg bg-primary-soft p-4 text-[14px] leading-relaxed text-text dark:bg-primary-soft-dark dark:text-text-dark">
                Mỗi tháng mua <strong>{formatVnd(runs[0].result.buys[0].soTien)}</strong>{' '}
                <strong>{runs[0].asset.symbol}</strong> từ {viDate(dau.buys[0].date)} ({dau.buys.length} kỳ,
                tổng vốn {formatVndShort(dau.tongVon)}) thì tới {viDate(dau.ngayDinhGia)} có{' '}
                <strong>{formatVndShort(dau.giaTriCuoi)}</strong>, {dau.laiLo >= 0 ? 'lãi' : 'lỗ'}{' '}
                <strong className={mauLaiLo(dau.laiLo)}>{formatVndShort(Math.abs(dau.laiLo))} ({pct(dau.laiLoPct)})</strong>
                {dau.xirrPct !== null && <>, tương đương <strong>{pct(dau.xirrPct)}/năm</strong></>}.
                Cùng dòng tiền gửi tiết kiệm {laiGuiHienThi}%/năm sẽ thành {formatVndShort(dau.giaTriGuiTietKiem)}
                {' '}({dau.giaTriCuoi >= dau.giaTriGuiTietKiem ? 'ít hơn' : 'nhiều hơn'}{' '}
                {formatVndShort(Math.abs(dau.giaTriCuoi - dau.giaTriGuiTietKiem))}).
              </div>

              {batDauChung !== null && (
                <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
                  Có mã chưa có dữ liệu giá ở “Từ ngày” nên mọi mã cùng bắt đầu từ tháng{' '}
                  {viDate(batDauChung).slice(3)} để so sánh công bằng.
                </p>
              )}

              <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(250px,1fr))]">
                {runs.map((r, i) => <KetQuaCard key={`${r.asset.kind}-${r.asset.symbol}`} run={r} color={MAU[i]} />)}
              </div>

              <section className="rounded-lg border border-border p-3 dark:border-border-dark">
                <div className="mb-2 text-[13px] font-semibold text-text dark:text-text-dark">Giá trị danh mục theo thời gian</div>
                <LineChart
                  ariaLabel={`Giá trị danh mục DCA từ ${viDate(dau.buys[0].date)} tới ${viDate(dau.ngayDinhGia)}`}
                  series={series}
                  formatX={(x) => viDate(ngaySangIso(Math.round(x)))}
                  formatXTick={(x) => viDate(ngaySangIso(Math.round(x))).slice(3)}
                  formatY={formatVndShort}
                  formatYFull={formatVnd}
                />
              </section>

              <p className={`text-[12px] leading-relaxed ${muted}`}>
                Giá khớp = giá đóng cửa phiên đầu tiên từ ngày mua trở đi (ngày nghỉ dời sang phiên sau).
                Giá cổ phiếu/ETF từ VNDirect đã điều chỉnh theo chia tách và cổ tức, nên cổ tức coi như
                được tái đầu tư. Chưa tính thuế bán.
                {coCrypto && ' Crypto quy theo giá USD với tỷ giá USD/VND cố định suốt kỳ — chưa tính biến động tỷ giá.'}
                {' '}Kết quả quá khứ không đảm bảo cho tương lai.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function KetQuaCard({ run, color }: { run: AssetRun; color: string }) {
  const { asset, history, result: r } = run;
  const dong = (nhanText: string, giaTri: React.ReactNode, cls = 'text-text dark:text-text-dark') => (
    <div className="flex items-baseline justify-between gap-2">
      <span className={muted}>{nhanText}</span>
      <span className={`font-mono tabular-nums ${cls}`}>{giaTri}</span>
    </div>
  );
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border p-3 text-[13px] dark:border-border-dark">
      <div className="flex items-center gap-2">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
        <strong className="text-text dark:text-text-dark">{asset.symbol}</strong>
        <span className={`text-[11px] ${muted}`}>{asset.typeLabel ?? KIND_LABEL[asset.kind]}</span>
      </div>
      <div className="text-[22px] font-bold tracking-tight text-text dark:text-text-dark">{formatVnd(r.giaTriCuoi)}</div>
      <div className={`text-[12px] ${muted}`}>Giá trị ngày {viDate(r.ngayDinhGia)}</div>
      {dong(`Vốn đã bỏ (${r.buys.length} kỳ)`, formatVnd(r.tongVon))}
      {dong('Lãi / lỗ', `${formatVndShort(r.laiLo)} (${pct(r.laiLoPct)})`, mauLaiLo(r.laiLo))}
      {dong('Mỗi năm (XIRR)', r.xirrPct === null ? '—' : pct(r.xirrPct), r.xirrPct === null ? undefined : mauLaiLo(r.xirrPct))}
      {dong('Lãi cao nhất', `${pct(r.laiCaoNhat.pct)} · ${viDate(r.laiCaoNhat.date)}`, mauLaiLo(r.laiCaoNhat.pct))}
      {dong('Lỗ sâu nhất', `${pct(r.loSauNhat.pct)} · ${viDate(r.loSauNhat.date)}`, mauLaiLo(r.loSauNhat.pct))}
      {/* Chỉ hiện số lượng khi giá theo đồng: với crypto (giá USD) "đơn vị" tính
          ra là tiền VND / giá USD — không phải số coin thật vì không dùng tỷ giá;
          với chỉ số thì không có "số lượng" để nắm giữ. Giá vốn TB vẫn đúng đơn vị. */}
      {history.unit === 'đ' && dong('Số lượng nắm giữ', formatDonVi(r.tongDonVi))}
      {dong('Giá vốn TB', formatGia(r.giaVonTb, history.unit))}
      {dong('Giá hiện tại', formatGia(r.giaCuoi, history.unit))}
      {r.tongPhi > 0 && dong('Tổng phí mua', formatVnd(r.tongPhi))}
    </div>
  );
}
