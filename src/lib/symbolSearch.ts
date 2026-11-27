// Tìm mã cho giả lập DCA: gõ vài chữ → gợi ý từ cả ba nguồn giá.
//
// - Cổ phiếu / ETF / chỉ số: VNDirect dchart /search (tìm theo TIỀN TỐ mã,
//   trả cả mô tả và loại). Gọi mạng theo từng lần gõ (đã debounce ở UI).
// - Crypto: danh sách cặp <MÃ>USDT của Binance, tải một lần rồi lọc tại chỗ.
// - Quỹ mở: danh sách quỹ Fmarket (dùng chung cache với priceHistory), lọc
//   tại chỗ theo cả mã lẫn tên — không phân biệt dấu tiếng Việt.
//
// Lỗi một nguồn KHÔNG chặn các nguồn khác: UI hiện gợi ý từ nguồn còn sống và
// báo rõ nguồn nào lỗi.

import type { AssetKind, FundInfo } from './priceHistory';

export interface SymbolOption {
  kind: AssetKind;
  symbol: string;
  /** Tên đầy đủ / mô tả để người dùng nhận ra mã. */
  name: string;
  /** Nhãn loại ngắn: "Cổ phiếu", "ETF", "Chỉ số", "Crypto", "Quỹ mở". */
  typeLabel: string;
}

/** Bỏ dấu tiếng Việt + viết thường, để "quy dau tu" khớp "Quỹ đầu tư". */
export function boDau(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}

/** Loại của dchart → nhãn hiển thị. Loại không dùng được cho DCA trả null. */
function nhanLoaiVn(type: string): string | null {
  switch (type) {
    case 'CỔ PHIẾU': return 'Cổ phiếu';
    case 'QUỸ HOÁN ĐỔI DM': return 'ETF';
    case 'CHỈ SỐ': return 'Chỉ số';
    case 'CHỨNG CHỈ QUỸ': return 'Chứng chỉ quỹ';
    // Hợp đồng tương lai, chứng quyền: có hạn đáo hạn, mua đều hàng tháng
    // nhiều năm là vô nghĩa ⇒ không gợi ý.
    default: return null;
  }
}

/** dchart /search → gợi ý (bỏ phái sinh, chứng quyền). */
export function parseDchartSearch(json: unknown): SymbolOption[] {
  if (!Array.isArray(json)) throw new Error('Kết quả tìm mã VNDirect không đúng định dạng.');
  const out: SymbolOption[] = [];
  for (const r of json) {
    const x = r as Record<string, unknown>;
    if (typeof x.symbol !== 'string' || typeof x.type !== 'string') continue;
    const typeLabel = nhanLoaiVn(x.type);
    if (typeLabel === null) continue;
    out.push({
      kind: 'vn',
      symbol: x.symbol.toUpperCase(),
      name: typeof x.description === 'string' ? x.description : x.symbol,
      typeLabel,
    });
  }
  return out;
}

/** Binance /ticker/price → danh sách mã gốc của các cặp USDT. */
export function parseBinanceUsdtBases(json: unknown): string[] {
  if (!Array.isArray(json)) throw new Error('Danh sách cặp Binance không đúng định dạng.');
  const out = new Set<string>();
  for (const r of json) {
    const s = (r as Record<string, unknown>).symbol;
    if (typeof s === 'string' && s.endsWith('USDT') && s.length > 4) out.add(s.slice(0, -4));
  }
  return [...out];
}

/**
 * Xếp hạng: mã trùng khít → mã bắt đầu bằng chuỗi gõ (ngắn trước) → tên chứa
 * chuỗi gõ. Không khớp gì thì loại. Trả tối đa `gioiHan` phần tử.
 */
export function xepHang(query: string, options: SymbolOption[], gioiHan = 8): SymbolOption[] {
  const q = query.trim().toUpperCase();
  if (!q) return [];
  const qName = boDau(query.trim());
  const diem = (o: SymbolOption): number | null => {
    if (o.symbol === q) return 0;
    if (o.symbol.startsWith(q)) return 1 + o.symbol.length / 100;
    if (qName.length >= 2 && boDau(o.name).includes(qName)) return 2;
    return null;
  };
  return options
    .map((o) => ({ o, d: diem(o) }))
    .filter((x): x is { o: SymbolOption; d: number } => x.d !== null)
    .sort((a, b) => a.d - b.d || a.o.symbol.localeCompare(b.o.symbol))
    .slice(0, gioiHan)
    .map((x) => x.o);
}

/** Lọc danh sách crypto + quỹ (đã tải sẵn) theo chuỗi gõ. */
export function timTaiCho(query: string, cryptoBases: string[], funds: FundInfo[], gioiHan = 6): SymbolOption[] {
  const crypto = xepHang(query, cryptoBases.map((b) => ({ kind: 'crypto' as const, symbol: b, name: `${b} / USDT`, typeLabel: 'Crypto' })), gioiHan);
  const quy = xepHang(query, funds.map((f) => ({ kind: 'fund' as const, symbol: f.shortName, name: f.name, typeLabel: 'Quỹ mở' })), gioiHan);
  return [...crypto, ...quy];
}

// ---------------------------------------------------------------------------
// Gọi mạng
// ---------------------------------------------------------------------------

export async function timMaVn(query: string, signal?: AbortSignal): Promise<SymbolOption[]> {
  const q = query.trim().toUpperCase();
  // dchart chỉ tìm theo tiền tố MÃ, nên chuỗi có dấu cách / dấu tiếng Việt
  // (người dùng gõ tên công ty) không bao giờ khớp — khỏi gọi.
  if (!/^[A-Z0-9]{1,12}$/.test(q)) return [];
  const res = await fetch(`https://dchart-api.vndirect.com.vn/dchart/search?query=${q}&limit=50`, { signal });
  if (!res.ok) throw new Error(`VNDirect trả lỗi HTTP ${res.status}.`);
  return xepHang(q, parseDchartSearch(await res.json()), 8);
}

let cryptoCache: Promise<string[]> | null = null;

/** Danh sách mã crypto có cặp USDT trên Binance (cache theo phiên, lỗi thì cho thử lại). */
export function fetchCryptoBases(): Promise<string[]> {
  if (cryptoCache === null) {
    cryptoCache = (async () => {
      const res = await fetch('https://api.binance.com/api/v3/ticker/price');
      if (!res.ok) throw new Error(`Binance trả lỗi HTTP ${res.status}.`);
      return parseBinanceUsdtBases(await res.json());
    })();
    cryptoCache.catch(() => { cryptoCache = null; });
  }
  return cryptoCache;
}

