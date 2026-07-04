# Handoff — Brainstorm + Spec + Plan cho Todo app (2026-07-04 18:29)

**Tóm tắt:** Session này đã brainstorm yêu cầu, viết xong bộ tài liệu (PRD, spec thiết kế, CLAUDE.md) và **implementation plan 10 task**. Chưa viết một dòng code nào. Session sau: bắt đầu triển khai theo plan.

## Trạng thái hiện tại
- **Tài liệu đã xong** (đã tự rà soát, nhất quán với nhau):
  - [prd.md](prd.md) — yêu cầu Phase 1 (FR-1…FR-18).
  - [docs/superpowers/specs/2026-07-04-todo-app-design.md](docs/superpowers/specs/2026-07-04-todo-app-design.md) — thiết kế kỹ thuật (kiến trúc, data model, cấu trúc thư mục type-based, quy trình Claude Design).
  - [CLAUDE.md](CLAUDE.md) — quy ước làm việc trong repo.
  - [docs/superpowers/plans/2026-07-04-todo-app-phase1.md](docs/superpowers/plans/2026-07-04-todo-app-phase1.md) — **kế hoạch triển khai 10 task, có code đầy đủ cho từng bước** (đây là thứ session sau bám theo).
- **Khung thư mục** đã tạo rỗng: `src/{components,pages,hooks,lib,types}/`, `supabase/` (chỉ có `.gitkeep`). Đã có `.env.example`, `.gitignore`, `README.md`.
- **CHƯA có code chạy được:** không có `package.json`, chưa `npm install`, chưa test/build nào chạy. Không có gì đang fail vì chưa có gì để chạy.
- Repo **CHƯA phải git** (`git init` chưa chạy) — các bước commit trong plan cần git.

## Đang làm dở
- Không có việc code dở. Điểm dừng: vừa viết xong plan + bổ sung chức năng "sửa việc" (edit) vào `TodoItem` (đã sửa trong file plan), đang chờ người dùng chọn cách thực thi.

## Bước tiếp theo
1. **Người dùng chọn cách thực thi** (câu hỏi mở #1 bên dưới): Subagent-Driven (khuyến nghị) hay Inline Execution.
2. Hỏi/ xác nhận `git init` để các bước commit trong plan hoạt động.
3. Bắt đầu **Task 1** của plan: scaffold Vite + React + TS (`package.json`, `index.html`, `vite.config.ts`, `tsconfig*`, `src/main.tsx`, `src/App.tsx`) → `npm install` → `npm run dev`.
4. Đi tuần tự Task 2→10. Ưu tiên TDD cho logic thuần (Task 2 `theme.ts`, Task 4 `todoFilters.ts`).
5. **Task 10 cần người dùng tự làm phần Supabase** (không tự động thay được): tạo project Supabase miễn phí, chạy `supabase/schema.sql`, bật Auth Google + Email magic link, thêm redirect `http://localhost:5173`, điền `.env`.

## Quyết định & lý do
- **Stack:** React + Vite + TS + Tailwind + Supabase — vì người dùng mới học, muốn stack dễ nhất mà vẫn đồng bộ nhiều thiết bị; Supabase lo Auth+DB+Realtime, không cần server tự viết.
- **Đăng nhập:** Google OAuth **và** email magic link (người dùng yêu cầu cả hai).
- **Cấu trúc type-based (flat), KHÔNG feature-based** — app 1 domain (todos), người mới; đã được 1 agent review xác nhận đúng chuẩn. Cố ý tránh over-engineering (không Redux/React Router/services layer/Atomic Design — xem spec mục 6.1).
- **Logic thuần tách ra `src/lib/todoFilters.ts` + `theme.ts`** để unit test không cần render UI (đúng CLAUDE.md "test logic thuần trước").
- **Chức năng chốt Phase 1:** CRUD, due date, priority, tags, search/filter, kéo-thả (@dnd-kit), smart views (Hôm nay/Sắp tới/Tất cả/Đã xong), dark mode, responsive, realtime. Đã cắt Phase 2 (natural language, subtask, recurring, reminders, Pomodoro, habit, AI).

## Cạm bẫy / lưu ý
- **`AskUserQuestion` từng lỗi parse** khi truyền JSON có ký tự Unicode tiếng Việt qua wrapper — gọi trực tiếp với mảng `questions` thì OK.
- **Không nuốt lỗi im lặng** (CLAUDE.md): plan đã thiết kế `ErrorBanner` + `console.error` ở mọi thao tác Supabase — giữ nguyên tinh thần này khi code.
- **Chỉ dùng Supabase anon key** ở frontend; tuyệt đối không đưa `service_role` vào repo.
- **Claude Design (claude.design):** Claude Code KHÔNG tự kết nối được. Quy trình: người dùng tự dùng claude.design tạo UI → đưa vào repo; nếu chưa có, dùng UI Tailwind tối giản mặc định trong plan (chỉ đụng `components/`+`pages/`, không đụng `lib/`+`hooks/` khi thay thiết kế).
- `due_date` là chuỗi `'YYYY-MM-DD'`; `applySmartView` nhận `today` dạng chuỗi để test được.

## File quan trọng
- [docs/superpowers/plans/2026-07-04-todo-app-phase1.md](docs/superpowers/plans/2026-07-04-todo-app-phase1.md) — **plan chính, bám theo để code**.
- [docs/superpowers/specs/2026-07-04-todo-app-design.md](docs/superpowers/specs/2026-07-04-todo-app-design.md) — thiết kế/lý do.
- [prd.md](prd.md) — checklist yêu cầu để đối chiếu.
- [CLAUDE.md](CLAUDE.md) — quy ước bắt buộc.

## Câu hỏi mở
1. **Chọn cách thực thi plan:** Subagent-Driven (khuyến nghị) hay Inline Execution?
2. Có cho `git init` không (để commit theo plan)?
3. Đã sẵn sàng tạo project Supabase + điền `.env` cho Task 10 chưa (bước này người dùng phải tự làm)?
