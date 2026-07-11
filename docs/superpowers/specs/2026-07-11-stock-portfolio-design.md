# Thiết kế: Quản lý danh mục cổ phiếu tích sản

Ngày: 2026-07-11
Trạng thái: Đã duyệt thiết kế, chờ lập kế hoạch triển khai.

## 1. Mục tiêu

Thêm một trang mới **Cổ phiếu** vào app todo để quản lý danh mục cổ phiếu theo
mẫu bảng "tích sản" của AzFin. Kết hợp hai vai trò:

- **Watchlist tham khảo**: lưu các mã theo 3 nhóm rủi ro (Tấn công / Cân bằng /
  Phòng thủ), kèm giá tham khảo và cổ tức — giống bảng AzFin.
- **Theo dõi đã đầu tư**: mỗi mã ghi được **số tiền đã đầu tư**, để biết mình đã
  rót tiền vào đâu và tỷ trọng vốn giữa 3 nhóm.

Ngoài phạm vi (Phase sau, không làm lần này): danh mục nhiều tài khoản/ví, lịch sử
giao dịch mua–bán, lãi/lỗ theo giá vốn, "ngày chốt lời gần nhất" và "tích sản tiếp
tục" trong bảng AzFin, tự động cập nhật giá theo lịch/nền.

## 2. Mô hình dữ liệu — bảng `stocks`

Bảng Supabase mới, cùng khuôn với `todos`/`goals`: RLS theo `user_id`, realtime
đa thiết bị, trigger `set_updated_at()`.

| Cột | Kiểu | Ý nghĩa |
|---|---|---|
| `id` | uuid PK default `gen_random_uuid()` | |
| `user_id` | uuid not null → `auth.users(id)` on delete cascade | chủ sở hữu (RLS) |
| `ticker` | text not null | mã CK, VD `ACB` |
| `company_name` | text not null | tên công ty |
| `group` | text not null check `in ('attack','balance','defense')` | nhóm rủi ro |
| `price_threshold` | numeric null | Giá ngưỡng tích sản (TS), đơn vị **nghìn đồng** (VD 30,1) |
| `price_protect` | numeric null | Giá bảo vệ thành quả, **nghìn đồng** |
| `current_price` | numeric null | Giá hiện tại (nút "Cập nhật giá" điền, hoặc nhập tay), **nghìn đồng** |
| `dividend` | numeric null | Cổ tức tiền trung bình/năm, đơn vị **đồng** (VD 700) |
| `invested_amount` | numeric null | **Số tiền đã đầu tư**, đơn vị **đồng** |
| `sort_order` | numeric not null default 0 | thứ tự trong nhóm |
| `created_at` | timestamptz not null default `now()` | |
| `updated_at` | timestamptz not null default `now()` | trigger tự cập nhật |

**Quy ước đơn vị (đã chốt):** giá (`price_*`, `current_price`) tính bằng **nghìn
đồng** giống cột giá của AzFin; `dividend` và `invested_amount` tính bằng **đồng**.

**Tỷ suất cổ tức KHÔNG lưu trong DB** — luôn tính từ dữ liệu:
`yield% = dividend / (price_threshold × 1000) × 100`.
Kiểm chứng với ảnh AzFin: ACB = 700 / (30,1 × 1000) ≈ 2,3% ✓.

### Migration & schema

- Thêm file `supabase/migrations/2026-07-11-stocks.sql` (idempotent: `if not
  exists`, `drop policy if exists`, khối kiểm tra publication — theo mẫu file
  goals đã có).
- Cập nhật `supabase/schema.sql` để phản ánh bảng mới.
- RLS: 4 policy `select/insert/update/delete` đều `auth.uid() = user_id`.
- `alter publication supabase_realtime add table public.stocks;`
- `alter table public.stocks replica identity full;` (để realtime DELETE/UPDATE
  mang đủ cột, đồng bộ đa thiết bị đúng — giống todos/goals).

## 3. Kiểu dữ liệu — `src/types/stock.ts`

```ts
export type StockGroup = 'attack' | 'balance' | 'defense';

export interface Stock {
  id: string;
  user_id: string;
  ticker: string;
  company_name: string;
  group: StockGroup;
  price_threshold: number | null;
  price_protect: number | null;
  current_price: number | null;
  dividend: number | null;
  invested_amount: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface NewStock {
  ticker: string;
  company_name: string;
  group: StockGroup;
  price_threshold?: number | null;
  price_protect?: number | null;
  current_price?: number | null;
  dividend?: number | null;
  invested_amount?: number | null;
}

export type StockUpdate = Partial<
  Pick<
    Stock,
    | 'ticker' | 'company_name' | 'group' | 'price_threshold' | 'price_protect'
    | 'current_price' | 'dividend' | 'invested_amount' | 'sort_order'
  >
>;
```

## 4. Lấy giá — `src/lib/stockPrice.ts`

- Hàm `fetchPrices(tickers: string[]): Promise<Record<string, number>>` gọi thẳng
  nguồn giá **cho phép CORS** từ trình duyệt (đúng lựa chọn "thử gọi trực tiếp").
- Ứng viên nguồn đầu tiên: **TCBS** (`apipubaws.tcbs.com.vn`, endpoint công khai
  cộng đồng hay dùng). Phải **kiểm chứng CORS thật khi triển khai**; nếu bị chặn,
  thử nguồn khác. Kết quả trả về chuẩn hóa về **nghìn đồng** cho khớp cột giá.
- **Nguyên tắc không nuốt lỗi:** khi fetch lỗi (mạng/CORS/nguồn đổi shape), hàm
  ném lỗi rõ ràng; trang hiển thị `ErrorBanner` + log console; người dùng vẫn nhập
  giá tay được. Không có fallback im lặng che giấu lỗi thật.
- Có unit test parse response với dữ liệu mock (không gọi mạng thật trong test).

## 5. Logic thuần — `src/lib/stockCalc.ts` (có test Vitest)

- `computeYield(stock): number | null` — tỷ suất %; trả `null` nếu thiếu
  `dividend` hoặc `price_threshold`.
- `groupWeights(stocks): { total: number; byGroup: Record<StockGroup, { amount: number; percent: number }> }`
  — tổng vốn đã đầu tư và % mỗi nhóm theo `invested_amount` (bỏ qua mã chưa nhập
  số tiền; nếu total = 0 thì percent = 0, không chia cho 0).
- `TARGET_PROFILES` — 3 khẩu vị rủi ro (đã chốt, lấy hàng trên ảnh AzFin):
  - `attack` (Tấn công / rủi ro cao): TC 30 / CB 30 / PT 40
  - `balance` (Cân bằng / rủi ro trung bình): TC 20 / CB 40 / PT 40
  - `defense` (Phòng thủ / rủi ro thấp): TC 10 / CB 40 / PT 50
- `compareToTarget(weights, profileKey)` — chênh lệch (thực tế − mục tiêu) mỗi nhóm.
- `isBelowThreshold(stock): boolean` — `current_price != null && price_threshold
  != null && current_price <= price_threshold` (để tô màu "chạm ngưỡng").

## 6. Hook — `src/hooks/useStocks.ts`

Sao khuôn `useGoals`: tải lần đầu, subscribe realtime `postgres_changes` lọc theo
`user_id`, các hàm `addStock / updateStock / deleteStock`, state `error` +
`clearError`. Sắp xếp theo `group` rồi `sort_order`.

## 7. Giao diện

### Điều hướng
- `Page = 'todos' | 'plan' | 'stocks'` (mở rộng type trong `AppPage.tsx`).
- `Sidebar.tsx`: cụm nút chuyển trang thêm nút thứ 3 **"Cổ phiếu"**.

### `PortfolioSummary` (trên cùng trang)
- Tổng vốn đã đầu tư (định dạng tiền VND).
- 3 thanh ngang tỷ trọng thực tế theo nhóm (màu theo nhóm).
- Bộ chọn khẩu vị rủi ro (Tấn công / Cân bằng / Phòng thủ) → hiện thanh mục tiêu
  mờ chồng/kề để so sánh thực tế vs mục tiêu (dạng thanh ngang như ảnh AzFin thứ 2).

### `StockTable` + `StockRow`
- Gom theo 3 nhóm; mỗi nhóm một khối có tiêu đề màu: **Tấn công = đỏ, Cân bằng =
  xanh lá, Phòng thủ = xanh dương** (theo ảnh AzFin).
- Cột: Mã · Tên công ty · Giá ngưỡng TS · Giá bảo vệ · Giá hiện tại · Cổ tức ·
  Tỷ suất (tính) · Số tiền đã đầu tư · nút sửa/xóa.
- Mã chạm ngưỡng (`isBelowThreshold`) tô đỏ/đậm — giống dòng in đỏ trong ảnh.
- Hỗ trợ dark mode qua class `dark:`. Bảng cuộn ngang trên màn hình hẹp.

### `StockForm`
- Thêm mã mới: mã, tên công ty, nhóm, giá ngưỡng, giá bảo vệ, cổ tức, số tiền đầu
  tư (giá hiện tại không nhập ở form — do "Cập nhật giá" hoặc sửa inline).
- Sửa: qua form/inline. Xóa: có `confirm('Xóa mã này?')` như todos.

### Thanh trên trang Cổ phiếu
- Nút **"Cập nhật giá"** — gọi `fetchPrices` cho các mã hiện có, cập nhật
  `current_price`; đang tải hiện trạng thái; lỗi hiện `ErrorBanner`.

## 8. Kiểm thử & xác minh

- Unit test (Vitest) cho `stockCalc.ts`: `computeYield`, `groupWeights` (gồm ca
  total = 0), `compareToTarget`, `isBelowThreshold`.
- Unit test parse response trong `stockPrice.ts` với mock (không gọi mạng thật).
- Trước khi báo "xong": chạy `npm test` và `npm run build`, xác nhận pass.

## 9. Danh sách file

Thêm mới:
- `supabase/migrations/2026-07-11-stocks.sql`
- `src/types/stock.ts`
- `src/hooks/useStocks.ts`
- `src/lib/stockCalc.ts` + `src/lib/stockCalc.test.ts`
- `src/lib/stockPrice.ts` + `src/lib/stockPrice.test.ts`
- `src/components/StocksPage.tsx`
- `src/components/StockTable.tsx`
- `src/components/StockRow.tsx`
- `src/components/StockForm.tsx`
- `src/components/PortfolioSummary.tsx`

Sửa:
- `supabase/schema.sql` (thêm bảng `stocks`)
- `src/components/Sidebar.tsx` (nút trang thứ 3)
- `src/pages/AppPage.tsx` (route trang `stocks`, dùng `useStocks`)
