# appTodo

Web app quản lý công việc (todo) cá nhân, đồng bộ nhiều thiết bị.

- **Yêu cầu sản phẩm:** [`prd.md`](./prd.md)
- **Thiết kế kỹ thuật:** [`docs/superpowers/specs/2026-07-04-todo-app-design.md`](./docs/superpowers/specs/2026-07-04-todo-app-design.md)
- **Hướng dẫn cho Claude Code:** [`CLAUDE.md`](./CLAUDE.md)

## Stack
React + Vite + TypeScript + Tailwind CSS · Supabase (Auth / Postgres / Realtime) · Vitest

## Bắt đầu
> Dự án đang ở giai đoạn tài liệu. Các bước dưới sẽ dùng được sau khi scaffold code.

```bash
npm install
cp .env.example .env   # rồi điền thông tin Supabase
npm run dev
```

## Biến môi trường
Xem [`.env.example`](./.env.example). Cần một project Supabase (miễn phí) với:
- Bảng `todos` + Row Level Security (SQL trong thư mục `supabase/`)
- Bật Auth provider Google và Email (magic link)
- Bật Realtime cho bảng `todos`

## Trạng thái
Phase 1 (MVP) — xem phạm vi trong `prd.md`.
