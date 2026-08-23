# CLAUDE.md

Hướng dẫn cho Claude Code khi làm việc trong repo này.

## Dự án là gì
Web app **Todo cá nhân, đồng bộ nhiều thiết bị**. Đây là dự án học lập trình —
ưu tiên code rõ ràng, dễ đọc, giải thích được, hơn là "thông minh" khó hiểu.

- Yêu cầu sản phẩm: `prd.md`
- Thiết kế kỹ thuật: `docs/superpowers/specs/2026-07-04-todo-app-design.md`

## Stack
- **Frontend:** React + Vite + TypeScript, style bằng **Tailwind CSS**.
- **Backend:** **Supabase** (Auth: Google + email magic link; Postgres; Realtime).
  Phase 1 **không có server tự viết** — truy cập dữ liệu đi thẳng tới Supabase,
  bảo vệ bằng Row Level Security.
- **Kiểm thử:** Vitest.

## Lệnh thường dùng
> Cập nhật lại khi đã có `package.json`.
- `npm install` — cài phụ thuộc
- `npm run dev` — chạy dev server (Vite)
- `npm run build` — build production
- `npm test` — chạy test (Vitest)
- `npm run lint` — kiểm tra lint

## Quy ước code
- **TypeScript** ở mọi nơi; tránh `any`.
- Mỗi component/hook **một trách nhiệm rõ ràng**. File phình to → tách nhỏ.
- Đặt tên rõ nghĩa; comment giải thích "vì sao", không mô tả lại code hiển nhiên.
- Component đặt trong `src/components/`, logic tái dùng trong `src/hooks/`,
  kết nối Supabase trong `src/lib/`, kiểu dữ liệu trong `src/types/`.
- Style bằng class Tailwind; hỗ trợ dark mode qua class `dark:`.

## Nguyên tắc quan trọng
- **KHÔNG nuốt lỗi im lặng.** Mất mạng / đăng nhập / lưu thất bại phải báo cho
  người dùng và log ra console. Không dùng fallback che giấu lỗi thật.
- **Bảo mật:** chỉ dùng Supabase `anon` key ở frontend (an toàn nhờ RLS).
  **Tuyệt đối không** đưa `service_role` key vào frontend hay commit lên repo.
- Biến môi trường để trong `.env` (đã .gitignore); giữ `.env.example` cập nhật.
- **Không tự ý mở rộng phạm vi.** Bám Phase 1 trong `prd.md`; việc thuộc Phase 2
  chỉ làm khi được yêu cầu.

## Kiểm thử & xác minh
- Viết test cho **logic thuần** trước (lọc, sắp xếp, smart-view, ánh xạ dữ liệu).
- Trước khi báo "xong": chạy `npm test` và `npm run build`, xác nhận thực sự pass —
  không khẳng định thành công khi chưa chạy kiểm chứng.

## Thiết kế giao diện
Giao diện dự kiến dựng bằng **Claude Design** rồi hiện thực trong React + Tailwind.
Nếu chưa có thiết kế từ Claude Design, dựng UI Tailwind tối giản, sạch sẽ làm mặc
định (dễ thay bằng thiết kế chính thức sau). Xem mục 7 của spec thiết kế.

## Ngôn ngữ
Giao diện và trao đổi bằng **tiếng Việt** (thuật ngữ kỹ thuật giữ tiếng Anh).

## Module Portfolio (Phase 3)

Module cân bằng danh mục đầu tư, sẽ nằm ở tab `portfolio` (đợt 4).
- Yêu cầu & thiết kế: `docs/superpowers/specs/2026-08-22-portfolio-rebalancing-design.md`
- Dữ liệu: schema Postgres riêng `portfolio` (KHÔNG dùng `public`). Bảng
  `public.stocks` / `public.cryptos` giữ nguyên, chỉ đọc, đóng vai watchlist.

### Luật cứng cho `src/domain/`
- **0 dependency.** Cấm import `@supabase/supabase-js`, `react`, và mọi thứ gọi `fetch`.
- **Cấm `Date.now()` và `new Date()` không tham số.** Thời điểm truyền vào qua tham số
  (`snapshot.asOf`) để test tái lập được và để tính lại kế hoạch tháng cũ.
- **Đơn vị: VND (đồng) tuyệt đối.** Quy đổi nghìn đồng / USD chỉ được xảy ra ở tầng
  biên đọc dữ liệu (`src/data/holdingsMap.ts` và `src/data/portfolioRepo.ts` hôm nay,
  `src/providers/` từ đợt 4). Đơn vị của bảng cũ `public.*` (chốt 2026-08-23):
  `stocks.current_price` / `stocks.invested_amount` / `stocks.peak_price` = **nghìn
  đồng**; `stocks.dividend` = **đồng**; `cryptos.*_price` = **USD**;
  `golds.*_price` = **đồng/lượng**.
- Mỗi module một trách nhiệm, mỗi module một file test cạnh nó.

### Sổ giao dịch bất biến
`portfolio.transactions` không có policy UPDATE. Ghi sai thì ghi thêm một dòng
`ADJUSTMENT` bù, không sửa bản ghi cũ. Chỉ được xoá trong 24h đầu.
