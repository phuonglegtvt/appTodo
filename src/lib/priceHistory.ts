// Tải chuỗi giá LỊCH SỬ (giá đóng cửa theo ngày) cho giả lập DCA.
// Gọi thẳng từ trình duyệt (Phase 1 không có server), cả ba nguồn đều mở CORS:
//
// - 'vn'     → VNDirect dchart: cổ phiếu, ETF (E1VFVN30, FUESSVFL…), chỉ số
//              (VNINDEX, VN30…). Giá cổ phiếu/ETF theo NGHÌN ĐỒNG, đã điều chỉnh
//              theo chia tách/cổ tức (FPT năm 2020 ra ~18, không phải ~58).
// - 'crypto' → Binance klines cặp <MÃ>USDT, giá USD. BTCUSDT có từ 08/2017.
// - 'fund'   → Fmarket: NAV/ccq của quỹ mở (VESAF, DCDS…), đơn vị đồng.
//
// Nguồn lỗi / đổi định dạng ⇒ NÉM lỗi tiếng Việt, không trả mảng rỗng âm thầm.
// Các hàm parse* là thuần và có test; các hàm fetch* chỉ lo gọi mạng.

import type { PricePoint } from './dcaBacktest';

export type AssetKind = 'vn' | 'crypto' | 'fund';

export interface PriceHistory {
  /** Mã đã chuẩn hoá (viết hoa). */
  symbol: string;
  kind: AssetKind;
  /** Đơn vị của `close` để hiển thị giá vốn TB / giá hiện tại. */
  unit: 'đ' | 'điểm' | 'USD';
  prices: PricePoint[];
}

/** Chỉ số thị trường: giá là ĐIỂM, không nhân 1000. */
const VN_INDEXES = new Set(['VNINDEX', 'VN30', 'VN100', 'VNMID', 'VNSML', 'HNXINDEX', 'HNX30', 'UPCOMINDEX', 'VNXALL']);

export function isVnIndex(symbol: string): boolean {
  return VN_INDEXES.has(symbol.toUpperCase());
}

function isoUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * dchart UDF history → PricePoint[]. `t` là giây (00:00 UTC của ngày giao dịch).
 * `nhan` = hệ số đổi đơn vị (1000 cho cổ phiếu/ETF: nghìn đồng → đồng).
 */
export function parseDchartHistory(json: unknown, nhan: number): PricePoint[] {
  if (!json || typeof json !== 'object') throw new Error('Dữ liệu VNDirect không đúng định dạng.');
  const o = json as Record<string, unknown>;
  if (o.s === 'no_data') return [];
  if (o.s !== 'ok') throw new Error(`VNDirect trả trạng thái lạ: ${String(o.s)}`);
  if (!Array.isArray(o.t) || !Array.isArray(o.c) || o.t.length !== o.c.length) {
    throw new Error('Dữ liệu VNDirect thiếu mảng thời gian / giá đóng cửa.');
  }
  const t = o.t as unknown[];
  const c = o.c as unknown[];
  const out: PricePoint[] = [];
  for (let i = 0; i < t.length; i++) {
    const ts = t[i];
    const close = c[i];
    if (typeof ts === 'number' && typeof close === 'number' && Number.isFinite(close) && close > 0) {
      out.push({ date: isoUtc(ts * 1000), close: close * nhan });
    }
  }
  return out;
}

/** Binance klines: mảng [openTimeMs, open, high, low, close(chuỗi), …]. */
export function parseBinanceKlines(json: unknown): PricePoint[] {
  if (!Array.isArray(json)) {
    const msg = json && typeof json === 'object' ? (json as Record<string, unknown>).msg : undefined;
    throw new Error(`Binance trả dữ liệu không đúng định dạng${msg ? `: ${String(msg)}` : ''}.`);
  }
  const out: PricePoint[] = [];
  for (const k of json) {
    if (!Array.isArray(k) || typeof k[0] !== 'number') continue;
    const close = Number(k[4]);
    if (Number.isFinite(close) && close > 0) out.push({ date: isoUtc(k[0]), close });
  }
  return out;
}

export interface FundInfo {
  id: number;
  shortName: string;
  name: string;
}

/** Fmarket /products/filter → danh sách quỹ. */
export function parseFmarketFunds(json: unknown): FundInfo[] {
  const rows = (json as { data?: { rows?: unknown } } | null)?.data?.rows;
  if (!Array.isArray(rows)) throw new Error('Danh sách quỹ Fmarket không đúng định dạng.');
  const out: FundInfo[] = [];
  for (const r of rows) {
    const x = r as Record<string, unknown>;
    if (typeof x.id === 'number' && typeof x.shortName === 'string') {
      out.push({ id: x.id, shortName: x.shortName.toUpperCase(), name: typeof x.name === 'string' ? x.name : x.shortName });
    }
  }
  return out;
}

/** Fmarket /product/get-nav-history → PricePoint[] (sắp lại tăng dần, bỏ ngày trùng). */
export function parseFmarketNav(json: unknown): PricePoint[] {
  const data = (json as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) throw new Error('Lịch sử NAV Fmarket không đúng định dạng.');
  const byDate = new Map<string, number>();
  for (const r of data) {
    const x = r as Record<string, unknown>;
    if (typeof x.navDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.navDate)
      && typeof x.nav === 'number' && Number.isFinite(x.nav) && x.nav > 0) {
      byDate.set(x.navDate, x.nav);
    }
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, close]) => ({ date, close }));
}

// ---------------------------------------------------------------------------
// Gọi mạng
// ---------------------------------------------------------------------------

async function docJson(res: Response, nguon: string): Promise<unknown> {
  if (!res.ok) throw new Error(`${nguon} trả lỗi HTTP ${res.status}.`);
  try {
    return await res.json();
  } catch {
    throw new Error(`${nguon} trả dữ liệu không phải JSON.`);
  }
}

async function fetchVn(symbol: string, fromSec: number, toSec: number): Promise<PriceHistory> {
  const url = `https://dchart-api.vndirect.com.vn/dchart/history?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${fromSec}&to=${toSec}`;
  const json = await docJson(await fetch(url), 'VNDirect');
  const index = isVnIndex(symbol);
  return { symbol, kind: 'vn', unit: index ? 'điểm' : 'đ', prices: parseDchartHistory(json, index ? 1 : 1000) };
}

async function fetchCrypto(symbol: string, fromMs: number, toMs: number): Promise<PriceHistory> {
  const pair = `${symbol}USDT`;
  const prices: PricePoint[] = [];
  let start = fromMs;
  // Binance giới hạn 1000 nến mỗi lần ⇒ lật trang theo startTime. Chặn 20 trang
  // (~55 năm) để một lỗi logic không thành vòng lặp gọi mạng vô hạn.
  for (let trang = 0; trang < 20 && start < toMs; trang++) {
    const url = `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=1d&startTime=${start}&endTime=${toMs}&limit=1000`;
    const res = await fetch(url);
    if (res.status === 400) throw new Error(`Binance không có cặp ${pair}.`);
    const page = parseBinanceKlines(await docJson(res, 'Binance'));
    if (page.length === 0) break;
    prices.push(...page);
    if (page.length < 1000) break;
    const [y, m, d] = page[page.length - 1].date.split('-').map(Number);
    start = Date.UTC(y, m - 1, d) + 86_400_000;
  }
  return { symbol, kind: 'crypto', unit: 'USD', prices };
}

let fundListCache: Promise<FundInfo[]> | null = null;

/** Danh sách quỹ mở trên Fmarket (cache theo phiên trang, lỗi thì cho thử lại). */
export function fetchFundList(): Promise<FundInfo[]> {
  if (fundListCache === null) {
    fundListCache = (async () => {
      const res = await fetch('https://api.fmarket.vn/res/products/filter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          types: ['NEW_FUND', 'TRADING_FUND'], issuerIds: [], sortOrder: 'DESC', sortField: 'navTo6Months',
          page: 1, pageSize: 200, isIpo: false, fundAssetTypes: [], bondRemainPeriods: [], searchField: '',
          isBuyByReward: false, thirdAppIds: [],
        }),
      });
      return parseFmarketFunds(await docJson(res, 'Fmarket'));
    })();
    fundListCache.catch(() => { fundListCache = null; });
  }
  return fundListCache;
}

function yyyymmdd(iso: string): string {
  return iso.replace(/-/g, '');
}

async function fetchFund(symbol: string, denNgay: string): Promise<PriceHistory> {
  const funds = await fetchFundList();
  const fund = funds.find((f) => f.shortName === symbol);
  if (!fund) throw new Error(`Không tìm thấy quỹ mở “${symbol}” trên Fmarket.`);
  const res = await fetch('https://api.fmarket.vn/res/product/get-nav-history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isAllData: 1, productId: fund.id, fromDate: null, toDate: yyyymmdd(denNgay) }),
  });
  return { symbol, kind: 'fund', unit: 'đ', prices: parseFmarketNav(await docJson(res, 'Fmarket')) };
}

/** Tải lịch sử giá ngày của một mã trong khoảng [tuNgay, denNgay] (ISO). */
export async function fetchPriceHistory(
  kind: AssetKind, rawSymbol: string, tuNgay: string, denNgay: string,
): Promise<PriceHistory> {
  const symbol = rawSymbol.trim().toUpperCase();
  if (!/^[A-Z0-9-]{1,20}$/.test(symbol)) throw new Error(`Mã “${rawSymbol}” không hợp lệ.`);
  const [y1, m1, d1] = tuNgay.split('-').map(Number);
  const [y2, m2, d2] = denNgay.split('-').map(Number);
  const fromMs = Date.UTC(y1, m1 - 1, d1);
  const toMs = Date.UTC(y2, m2 - 1, d2) + 86_399_999;

  let h: PriceHistory;
  if (kind === 'vn') h = await fetchVn(symbol, Math.floor(fromMs / 1000), Math.floor(toMs / 1000));
  else if (kind === 'crypto') h = await fetchCrypto(symbol, fromMs, toMs);
  else h = await fetchFund(symbol, denNgay);

  if (h.prices.length === 0) {
    throw new Error(`Không có dữ liệu giá của ${symbol} trong khoảng ${tuNgay} → ${denNgay}.`);
  }
  return h;
}

// ---------------------------------------------------------------------------
// Giới hạn lịch sử của từng nguồn (đo ngày 2026-11-27 bằng from=0 / startTime=0):
// VNDirect dchart chỉ có cổ phiếu/ETF từ 02/01/2013 và chỉ số từ 24/08/2017;
// Binance có BTCUSDT từ 17/08/2017. Mã lên sàn TRƯỚC các mốc này sẽ bắt đầu từ
// mốc, không phải từ ngày lên sàn — UI phải nói ra, không để người dùng tưởng
// "lâu nhất" là từ ngày lên sàn.
// ---------------------------------------------------------------------------

const MOC_NGUON: { kind: AssetKind; laChiSo?: boolean; ngay: string; nguon: string }[] = [
  { kind: 'vn', laChiSo: false, ngay: '2013-01-02', nguon: 'VNDirect chỉ có giá cổ phiếu/ETF từ 02/01/2013' },
  { kind: 'vn', laChiSo: true, ngay: '2017-08-24', nguon: 'VNDirect chỉ có giá chỉ số từ 24/08/2017' },
  { kind: 'crypto', ngay: '2017-08-17', nguon: 'Binance chỉ có giá từ 17/08/2017' },
];

/**
 * Nếu ngày dữ liệu đầu tiên của mã trùng (±7 ngày) với mốc giới hạn của nguồn
 * ⇒ nhiều khả năng mã có lịch sử dài hơn mà nguồn không có. Trả câu giải thích,
 * ngược lại null (ngày đầu tiên chính là ngày lên sàn / ra mắt).
 */
export function gioiHanNguon(kind: AssetKind, symbol: string, ngayDau: string): string | null {
  const laChiSo = isVnIndex(symbol);
  const moc = MOC_NGUON.find((m) => m.kind === kind && (m.laChiSo === undefined || m.laChiSo === laChiSo));
  if (!moc) return null;
  const lech = (Date.parse(ngayDau) - Date.parse(moc.ngay)) / 86_400_000;
  return lech <= 7 ? moc.nguon : null;
}
