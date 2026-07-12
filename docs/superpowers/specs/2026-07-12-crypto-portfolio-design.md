# Thiết kế: Trang Crypto — theo dõi danh mục (có lời/lỗ)

Ngày: 2026-07-12
Trạng thái: đã duyệt thiết kế, chờ viết implementation plan.

## 1. Mục tiêu

Thêm một trang **Crypto** để theo dõi danh mục tiền mã hóa cá nhân với lời/lỗ
(profit & loss). Người dùng nhập số lượng đang giữ và giá mua trung bình cho từng
coin (BTC, BNB, ETH, và coin tùy ý khác); app lấy giá live từ Binance, tính giá trị
hiện tại và lời/lỗ. Hiển thị mặc định theo USD, có nút chuyển sang VND theo tỷ giá live.

Trang này mô phỏng **trang Cổ phiếu** đã có (`StocksPage` + `useStocks` +
`stockPrice.ts` + migration `stocks`), tạo bộ file song song riêng cho crypto —
**không sửa** code cổ phiếu đang chạy tốt (tránh rủi ro hồi quy).

Quyết định đã chốt khi brainstorm:
- Mục đích: **theo dõi danh mục có lời/lỗ** (không chỉ xem giá).
- Coin: **thêm tự do** (nhập mã bất kỳ, app ghép `USDT` để lấy giá Binance).
- Tiền tệ: **mặc định USD**, có nút **chuyển sang VND**.
- Tỷ giá USD→VND: **lấy live** từ API miễn phí, không nuốt lỗi.
- Màu lời/lỗ: **xanh khi lãi, đỏ khi lỗ**.

## 2. Nguyên tắc bám theo (từ CLAUDE.md)

- Phase 1 **không server tự viết**: gọi thẳng Binance & API tỷ giá từ browser.
- **Không nuốt lỗi im lặng**: mạng/CORS/HTTP/nguồn đổi shape → log console + hiện
  `ErrorBanner`. Người dùng vẫn nhập giá tay được khi API lỗi.
- Bảo mật dữ liệu: bảng `cryptos` bật RLS theo `user_id` (chỉ dùng `anon` key).
- TypeScript mọi nơi, tránh `any`; mỗi file một trách nhiệm rõ.
- Test **logic thuần** trước bằng Vitest.

## 3. Mô hình dữ liệu

### Bảng mới `public.cryptos`

Cùng khuôn với `stocks`/`goals`/`todos`: RLS theo `user_id`, realtime đa thiết bị,
trigger `updated_at`, migration idempotent.

| Cột | Kiểu | Ý nghĩa |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `user_id` | uuid FK → auth.users | chủ sở hữu, cascade khi xóa user |
| `symbol` | text not null | mã coin viết hoa (BTC, ETH, BNB, SOL...) |
| `name` | text not null default `''` | tên hiển thị (Bitcoin...), có thể để trống |
| `quantity` | numeric | số lượng nắm giữ (chấp nhận lẻ, vd 0.05) |
| `avg_buy_price` | numeric | giá mua trung bình (USD) |
| `current_price` | numeric | giá live USD từ Binance |
| `sort_order` | numeric not null default 0 | thứ tự hiển thị |
| `created_at` | timestamptz default now() | |
| `updated_at` | timestamptz default now() | qua trigger `set_updated_at()` |

`quantity`, `avg_buy_price`, `current_price` cho phép null (chưa nhập / chưa cập nhật).
**Đơn vị lưu trong DB luôn là USD** — quy đổi VND chỉ ở tầng hiển thị.

### Types — `src/types/crypto.ts`

```ts
export interface Crypto {
  id: string;
  user_id: string;
  symbol: string;
  name: string;
  quantity: number | null;
  avg_buy_price: number | null;
  current_price: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface NewCrypto {
  symbol: string;
  name?: string;
  quantity?: number | null;
  avg_buy_price?: number | null;
  current_price?: number | null;
}

export type CryptoUpdate = Partial<
  Pick<Crypto, 'symbol' | 'name' | 'quantity' | 'avg_buy_price' | 'current_price' | 'sort_order'>
>;
```

## 4. Logic thuần — `src/lib/cryptoCalc.ts` (có test)

```ts
// Cho một coin (null nếu thiếu dữ liệu để tính):
cost(c)        = c.quantity != null && c.avg_buy_price != null ? quantity * avg_buy_price : null
value(c)       = c.quantity != null && c.current_price != null ? quantity * current_price : null
pnl(c)         = value != null && cost != null ? value - cost : null
pnlPercent(c)  = cost != null && cost > 0 && pnl != null ? pnl / cost * 100 : null

// Tổng danh mục (bỏ qua coin thiếu dữ liệu):
portfolioTotals(list) => {
  totalCost: number;    // tổng cost các coin có cost
  totalValue: number;   // tổng value các coin có value
  totalPnl: number;     // totalValue - totalCost
  totalPnlPercent: number | null;  // totalCost>0 ? totalPnl/totalCost*100 : null
}

// Tỷ trọng mỗi coin theo value hiện tại (cho summary): percent = value / totalValue * 100
```

Quy tắc: thiếu dữ liệu trả `null` (không đoán 0), tránh chia cho 0. Đây là điểm test kỹ.

## 5. Nguồn giá crypto — `src/lib/cryptoPrice.ts` (có test)

Mô phỏng `stockPrice.ts`. Binance ticker công khai, CORS mở:

```
GET https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT
→ { "symbol": "BTCUSDT", "price": "64832.10" }
```

- `parseTickerPrice(json): number` — validate shape, `Number(price)`; sai shape/không
  hữu hạn → **ném lỗi rõ** ("nguồn đổi shape").
- `fetchCryptoPrices(symbols: string[]): Promise<FetchPricesResult>`:
  - chuẩn hóa: `symbol.trim().toUpperCase()`, ghép `+ 'USDT'` để gọi Binance.
  - mỗi coin một request, gom bằng `Promise.allSettled` → 1 coin lỗi (mã sai/mạng/CORS)
    **không** làm hỏng cả lần; gom vào `failed: { symbol, message }[]` để báo rõ.
  - trả `{ prices: Record<symbolHoa, number>, failed }` — `prices` khóa theo mã coin
    gốc viết hoa (BTC), không phải cặp BTCUSDT.

Cùng interface tinh thần như `FetchPricesResult` của stocks (đổi `ticker`→`symbol`).

## 6. Tỷ giá USD→VND — `src/lib/fxRate.ts` (có test)

```
GET https://open.er-api.com/v6/latest/USD   (miễn phí, không cần key, CORS mở)
→ { "result": "success", "rates": { "VND": 26000, ... } }
```

- `parseUsdVndRate(json): number` — kiểm tra `result === 'success'` và `rates.VND` là
  số dương hữu hạn; ngược lại **ném lỗi rõ**.
- `fetchUsdVndRate(): Promise<number>` — fetch + parse; HTTP !ok → ném `HTTP <status>`.

Không nuốt lỗi: khi đổi sang VND mà fetch tỷ giá lỗi → `ErrorBanner`, giữ hiển thị USD.

## 7. Hook dữ liệu — `src/hooks/useCryptos.ts`

Sao đúng khuôn `useStocks.ts`:
- tải lần đầu `select('*')` từ bảng `cryptos`;
- realtime channel `cryptos-changes` lọc `user_id=eq.<id>` (INSERT/UPDATE/DELETE);
- `addCrypto / updateCrypto / deleteCrypto / clearError`;
- sắp xếp theo `sort_order`;
- lỗi Supabase → `console.error` + set `error` (không nuốt).

## 8. Lựa chọn tiền tệ — `src/hooks/useCurrency.ts`

- state `currency: 'USD' | 'VND'` + `rate: number | null` (tỷ giá gần nhất).
- lưu `localStorage` (nhớ lựa chọn + tỷ giá gần nhất giữa các lần mở), giống pattern
  `useSidebarCollapsed` / `useTheme`.
- `formatMoney(usdAmount)` → chuỗi hiển thị: USD (`$`) hoặc VND (`đ`, nhân `rate`).
  Nếu VND mà chưa có `rate` → hiển thị USD tạm + gợi ý cập nhật tỷ giá.

## 9. UI

- `src/components/CryptoPage.tsx` — mô phỏng `StocksPage`: tiêu đề + nút **Cập nhật giá**
  (gọi `fetchCryptoPrices`, cập nhật `current_price`, báo coin lỗi) + **nút chuyển USD/VND**
  (khi bật VND lần đầu / bấm làm mới → gọi `fetchUsdVndRate`) + ô tìm kiếm + `CryptoSummary`
  + `CryptoForm` + `CryptoTable`. Hai ErrorBanner (lỗi dữ liệu / lỗi giá & tỷ giá).
- `src/components/CryptoSummary.tsx` — tổng vốn, tổng giá trị, tổng lời/lỗ (+%), tỷ trọng
  mỗi coin. Lời **xanh**, lỗ **đỏ**.
- `src/components/CryptoForm.tsx` — thêm coin: symbol (bắt buộc), name, quantity,
  avg_buy_price. Dùng `parseVnNumber` (chấp nhận dấu phẩy thập phân).
- `src/components/CryptoTable.tsx` + `CryptoRow.tsx` — bảng coin, sửa inline (quantity,
  avg_buy_price), hiện current_price, value, pnl (màu), nút xóa (confirm).
- `src/lib/cryptoFilters.ts` (có test) — `filterCryptos(list, query)` tìm theo symbol/name.

### Điều hướng
- `Sidebar.tsx`: mở rộng union `page` thêm `'crypto'`; thêm mục `{ key: 'crypto',
  label: 'Crypto', icon: '₿' }` vào `PAGES`.
- `AppPage.tsx`: mở rộng `type Page`; render `<CryptoPage userId={userId} />` khi
  `page === 'crypto'`.

## 10. Migration — `supabase/migrations/2026-07-12-cryptos.sql`

Y khuôn `2026-07-11-stocks.sql`: `create table if not exists public.cryptos`, gắn trigger
`set_updated_at`, `enable row level security` + 4 policy own (select/insert/update/delete),
thêm vào publication `supabase_realtime` (bọc trong khối kiểm tra), `replica identity full`.
Idempotent — chạy lại nhiều lần an toàn. Chạy tay trên Supabase SQL Editor.

## 11. Kiểm thử (Vitest) — logic thuần trước

- `cryptoCalc.test.ts`: cost/value/pnl/pnlPercent (đủ dữ liệu, thiếu dữ liệu → null,
  cost=0 → pnlPercent null); `portfolioTotals` (bỏ qua coin thiếu, tổng đúng, lỗ ra âm).
- `cryptoPrice.test.ts`: `parseTickerPrice` (ok, sai shape ném lỗi); `fetchCryptoPrices`
  với mock fetch — 1 coin lỗi vẫn trả các coin còn lại + `failed`.
- `fxRate.test.ts`: `parseUsdVndRate` (ok; thiếu VND / result != success → ném lỗi).
- `cryptoFilters.test.ts`: tìm theo symbol/name, không phân biệt hoa thường, query rỗng.

## 12. Ngoài phạm vi (YAGNI)

Không làm ở lần này: ngày mua, ghi chú theo coin, lịch sử giao dịch nhiều lần mua,
biểu đồ giá, cảnh báo ngưỡng giá, gộp bảng với cổ phiếu. Có thể thêm sau nếu cần.
```