import { useState } from 'react';
import { usePriceRules, type NewPriceRule } from '../hooks/usePriceRules';
import { danhGiaQuyTac, moTaQuyTac, sapXepDanhGia, type RuleAction, type RuleDirection, type RuleEval } from '../lib/priceRules';
import { dsTaiSan, formatGiaQuyTac, khoaTaiSan, type RuleAsset } from '../lib/ruleAssets';
import { parseVnNumber } from '../lib/parseNumber';
import { formatVnd } from '../lib/portfolioClassMeta';
import type { Stock } from '../types/stock';
import type { Crypto } from '../types/crypto';
import { ErrorBanner } from './ErrorBanner';
import { MoneyInput } from './MoneyInput';
import { SearchSelect } from './SearchSelect';

// Mục "Cảnh báo giá" (tab Danh mục): thêm quy tắc "khi giá ≥/≤ X thì bán p% /
// mua y đồng / theo dõi", xem quy tắc nào đã chạm ngưỡng so với giá hiện tại.
// Phép đánh giá ở src/lib/priceRules.ts (có test).

interface Props {
  userId: string;
  stocks: Stock[];
  cryptos: Crypto[];
}

const o = 'rounded-md border border-border bg-surface px-2 py-1.5 text-[13px] text-text outline-none focus:border-primary dark:border-border-dark dark:bg-surface-2dark dark:text-text-dark dark:focus:border-primary-dark';
const so = `${o} text-right font-mono tabular-nums`;
const nhan = 'text-[11px] font-bold uppercase tracking-[0.06em] text-text-muted dark:text-text-muted-dark';
const mo = 'text-text-muted dark:text-text-muted-dark';
const chon = (on: boolean) => `rounded-md px-2.5 py-1 text-[12.5px] font-semibold ${on ? 'bg-primary text-white dark:bg-primary-dark dark:text-bg-dark' : mo}`;

export function PriceRulesPanel({ userId, stocks, cryptos }: Props) {
  const { rules, loading, error, addRule, updateRule, deleteRule, clearError } = usePriceRules(userId);
  const taiSan = dsTaiSan(stocks, cryptos);
  const theoKhoa = new Map(taiSan.map((a) => [khoaTaiSan(a.kind, a.symbol), a]));

  const [khoa, setKhoa] = useState('');
  const [huong, setHuong] = useState<RuleDirection>('ABOVE');
  const [giaText, setGiaText] = useState('');
  const [hanhDong, setHanhDong] = useState<RuleAction>('SELL');
  const [pctText, setPctText] = useState('');
  const [tienMua, setTienMua] = useState<number | null>(null);
  const [ghiChu, setGhiChu] = useState('');
  const [loi, setLoi] = useState<string | null>(null);
  const [dangLuu, setDangLuu] = useState(false);

  const chonTs = theoKhoa.get(khoa) ?? null;

  async function them(e: React.FormEvent) {
    e.preventDefault();
    setLoi(null);
    if (!chonTs) return setLoi('Chọn mã cổ phiếu / coin.');
    const gia = parseVnNumber(giaText);
    if (gia === null || !(gia > 0)) return setLoi(chonTs.kind === 'STOCK' ? 'Nhập giá ngưỡng (nghìn đồng, VD 45).' : 'Nhập giá ngưỡng (USD).');
    const pct = hanhDong === 'SELL' && pctText.trim() !== '' ? parseVnNumber(pctText) : null;
    if (pct !== null && !(pct > 0 && pct <= 100)) return setLoi('% bán phải từ trên 0 đến 100.');
    const r: NewPriceRule = {
      asset_kind: chonTs.kind, symbol: chonTs.symbol, direction: huong, price: gia, action: hanhDong,
      sell_pct: hanhDong === 'SELL' ? pct : null,
      buy_amount_vnd: hanhDong === 'BUY' ? tienMua : null,
      note: ghiChu.trim(), active: true,
    };
    setDangLuu(true);
    try {
      await addRule(r);
      setGiaText(''); setPctText(''); setTienMua(null); setGhiChu('');
    } catch (err) {
      console.error('Lỗi thêm quy tắc giá:', err);
      setLoi(err instanceof Error ? err.message : String(err));
    } finally {
      setDangLuu(false);
    }
  }

  async function lam(fn: () => Promise<void>) {
    setLoi(null);
    try { await fn(); } catch (err) {
      console.error('Lỗi cập nhật quy tắc giá:', err);
      setLoi(err instanceof Error ? err.message : String(err));
    }
  }

  const danhGia = sapXepDanhGia(rules.map((r) => {
    const ts = theoKhoa.get(khoaTaiSan(r.asset_kind, r.symbol));
    return danhGiaQuyTac(r, ts?.gia ?? null, ts?.soLuong ?? null);
  }));
  const soCham = danhGia.filter((e) => e.status === 'CHAM').length;

  return (
    <div className="flex flex-col gap-4">
      {error && <ErrorBanner message={error} onClose={clearError} />}
      {loi && <ErrorBanner message={loi} onClose={() => setLoi(null)} />}

      <section className="surface-card flex flex-col gap-3 p-4">
        <div>
          <div className="text-[15px] font-bold text-text dark:text-text-dark">Thêm quy tắc giá</div>
          <div className={`text-[12px] ${mo}`}>
            App không tự đặt lệnh — chỉ so với giá hiện tại (bấm “Cập nhật giá” ở tab Cổ phiếu / Crypto) và báo khi chạm ngưỡng.
          </div>
        </div>
        <form onSubmit={them} className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <span className={nhan}>Mã</span>
            <SearchSelect
              options={taiSan.map((a: RuleAsset) => ({ value: khoaTaiSan(a.kind, a.symbol), symbol: a.symbol, name: `${a.kind === 'STOCK' ? 'CP' : 'Crypto'} · ${a.name}` }))}
              value={khoa} onChange={setKhoa} ariaLabel="Mã" placeholder="Gõ mã…" className={`w-32 ${o}`} />
          </div>
          <div className="flex flex-col gap-1">
            <span className={nhan}>Khi giá</span>
            <div className="flex gap-0.5 rounded-lg border border-border bg-surface p-0.5 dark:border-border-dark dark:bg-surface-dark">
              <button type="button" onClick={() => setHuong('ABOVE')} className={chon(huong === 'ABOVE')}>≥ lên tới</button>
              <button type="button" onClick={() => setHuong('BELOW')} className={chon(huong === 'BELOW')}>≤ xuống tới</button>
            </div>
          </div>
          <label className="flex flex-col gap-1">
            <span className={nhan}>{chonTs?.kind === 'CRYPTO' ? 'Giá (USD)' : 'Giá (nghìn đ)'}</span>
            <input value={giaText} onChange={(e) => setGiaText(e.target.value)} inputMode="decimal"
              placeholder={chonTs?.kind === 'CRYPTO' ? '160000' : '45'} className={`w-28 ${so}`} />
            {chonTs && chonTs.gia !== null && <span className={`text-[11px] ${mo}`}>hiện {formatGiaQuyTac(chonTs.kind, chonTs.gia)}</span>}
          </label>
          <div className="flex flex-col gap-1">
            <span className={nhan}>Thì</span>
            <div className="flex gap-0.5 rounded-lg border border-border bg-surface p-0.5 dark:border-border-dark dark:bg-surface-dark">
              <button type="button" onClick={() => setHanhDong('SELL')} className={chon(hanhDong === 'SELL')}>Bán</button>
              <button type="button" onClick={() => setHanhDong('BUY')} className={chon(hanhDong === 'BUY')}>Mua</button>
              <button type="button" onClick={() => setHanhDong('WATCH')} className={chon(hanhDong === 'WATCH')}>Theo dõi</button>
            </div>
          </div>
          {hanhDong === 'SELL' && (
            <label className="flex flex-col gap-1">
              <span className={nhan}>% số đang giữ</span>
              <input value={pctText} onChange={(e) => setPctText(e.target.value)} inputMode="decimal" placeholder="50" className={`w-20 ${so}`} />
            </label>
          )}
          {hanhDong === 'BUY' && (
            <label className="flex flex-col gap-1">
              <span className={nhan}>Số tiền (đ)</span>
              <MoneyInput value={tienMua} onChange={setTienMua} className={`w-36 ${so}`} />
            </label>
          )}
          <label className="flex min-w-[10rem] flex-1 flex-col gap-1">
            <span className={nhan}>Ghi chú</span>
            <input value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} placeholder="Không bắt buộc" className={o} />
          </label>
          <button type="submit" disabled={dangLuu}
            className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-white transition hover:opacity-90 active:scale-95 disabled:opacity-50 dark:bg-primary-dark dark:text-bg-dark">
            {dangLuu ? 'Đang lưu…' : 'Thêm'}
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-2">
        <div className="text-[15px] font-bold text-text dark:text-text-dark">
          Quy tắc ({rules.length}){soCham > 0 && <span className="ml-2 text-red-600 dark:text-red-400">· {soCham} đã chạm ngưỡng</span>}
        </div>
        {loading ? (
          <p className={`text-sm ${mo}`}>Đang tải…</p>
        ) : rules.length === 0 ? (
          <p className={`rounded-xl border border-dashed border-border py-6 text-center text-sm dark:border-border-dark ${mo}`}>
            Chưa có quy tắc nào. VD: BTC ≥ 160.000 USD → Bán 50%; E1VFVN30 ≥ 45 → Bán 50%.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {danhGia.map((e) => <DongQuyTac key={e.rule.id} e={e}
              onToggle={() => void lam(() => updateRule(e.rule.id, { active: !e.rule.active }))}
              onDelete={() => { if (confirm(`Xoá quy tắc ${e.rule.symbol}?`)) void lam(() => deleteRule(e.rule.id)); }} />)}
          </ul>
        )}
      </section>
    </div>
  );
}

function DongQuyTac({ e, onToggle, onDelete }: { e: RuleEval; onToggle: () => void; onDelete: () => void }) {
  const r = e.rule;
  const fg = (v: number) => formatGiaQuyTac(r.asset_kind, v);
  const mau = e.status === 'CHAM'
    ? 'border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950'
    : 'border-border bg-surface dark:border-border-dark dark:bg-surface-dark';
  return (
    <li className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border px-3 py-2 text-[13px] ${mau} ${e.status === 'TAT' ? 'opacity-50' : ''}`}>
      <span className="min-w-[16rem] font-semibold text-text dark:text-text-dark">{moTaQuyTac(r, fg, formatVnd)}</span>
      <span className={mo}>Giá hiện tại: <strong className="text-text dark:text-text-dark">{e.giaHienTai === null ? 'chưa có' : fg(e.giaHienTai)}</strong></span>
      <span>
        {e.status === 'CHAM' && <strong className="text-red-600 dark:text-red-400">⚑ ĐÃ CHẠM NGƯỠNG</strong>}
        {e.status === 'CHUA' && <span className={mo}>còn cách {e.conCachPct?.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%</span>}
        {e.status === 'THIEU_GIA' && <span className="text-amber-700 dark:text-amber-400">chưa có giá — bấm Cập nhật giá</span>}
        {e.status === 'TAT' && <span className={mo}>đang tắt</span>}
      </span>
      {e.soLuongBan !== null && (
        <span className={mo}>
          = bán {e.soLuongBan.toLocaleString('vi-VN', { maximumFractionDigits: r.asset_kind === 'CRYPTO' ? 6 : 0 })} {r.asset_kind === 'CRYPTO' ? r.symbol : 'cổ'}
        </span>
      )}
      {r.note && <span className={`truncate ${mo}`} title={r.note}>· {r.note}</span>}
      <span className="ml-auto flex gap-1">
        <button onClick={onToggle} className="rounded-md px-2 py-1 text-[12px] font-semibold text-text-muted hover:bg-surface-2 hover:text-text dark:text-text-muted-dark dark:hover:bg-surface-2dark">
          {r.active ? 'Tắt' : 'Bật'}
        </button>
        <button onClick={onDelete} className="rounded-md px-2 py-1 text-[12px] font-semibold text-text-muted hover:bg-red-50 hover:text-red-600 dark:text-text-muted-dark dark:hover:bg-red-950">
          Xoá
        </button>
      </span>
    </li>
  );
}
