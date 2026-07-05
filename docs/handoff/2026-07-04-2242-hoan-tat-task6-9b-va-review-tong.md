# Handoff — Hoàn tất Task 6→9b + review tổng cả nhánh (2026-07-04 22:42)

**Tóm tắt:** Đã code xong toàn bộ Phase 1 (Task 6→9b, gồm **Kanban view mới thêm**) bằng subagent-driven, qua review từng task + review tổng cả nhánh và đã sửa hết Important. Chỉ còn **Task 10** (người dùng tạo Supabase + `.env`) — mai làm tiếp, cần tôi hướng dẫn.

## Trạng thái hiện tại
- **Toàn bộ xanh thật (không tô hồng):** `npx tsc -b` = 0 lỗi; `npm test` = **20/20 pass**; `npm run build` = OK. HEAD = `503d6dd`, nhánh `master`.
- Đã xong & commit (mỗi task qua review + fix):
  - **Task 6** `8f0708f`: `useAuth` + `ErrorBanner` (verbatim) + `LoginPage` (tôi tự style theo design, card căn giữa). Review Approved.
  - **Task 7** `baee5bd`: `useTodos` (CRUD + realtime), verbatim. Controller-verified.
  - **Task 8** `4570a88` + fix `acf4fc5`: 7 component UI bám design + `lib/tagColor.ts`. Reviewer Needs-fixes → đã sửa (KeyboardSensor, token `primary-dark`, radius 12px, aria-label).
  - **Task 9** `e989110` + fix `c43e4d7`: `AppPage` + `Sidebar` dashboard + `App` auth-gate + toggle Danh sách/Bảng. Reviewer tìm **1 Critical** (kéo-thả nuốt việc + trùng `sort_order` khi đang lọc) + 2 Important → đã sửa, **re-review Approved**.
  - **Task 9b** `fd79953`: `KanbanCard` + `KanbanBoard` — cột theo ưu tiên, kéo-thả đổi ưu tiên.
  - **Review tổng nhánh** (opus, `5906a73..`) → **Ready with follow-ups**. Fix 3 Important tích hợp trong `503d6dd`.
- **CHƯA chạy thử trên trình duyệt** — vì chưa có `.env`, `supabaseClient` cố ý `throw` khi thiếu env. Nghiệm thu giao diện thật thuộc Task 10.

## Đang làm dở
- Không có việc dở giữa chừng. Điểm dừng sạch: đã commit hết, ledger cập nhật đủ. Chờ Task 10.

## Bước tiếp theo (Task 10 — mai làm, HƯỚNG DẪN người dùng)
1. Người dùng tạo project Supabase (miễn phí) tại supabase.com.
2. SQL Editor → chạy toàn bộ [supabase/schema.sql](supabase/schema.sql) (bảng todos + RLS + realtime).
3. Authentication > Providers: bật **Email** (magic link) + **Google** (điền Client ID/Secret từ Google Cloud); thêm `http://localhost:5173` vào Redirect URLs.
4. `cp .env.example .env` → điền `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (Project Settings > API). **Chỉ anon key**, không service_role.
5. `npm run dev` → tôi dùng Chrome tools (mcp__claude-in-chrome__*) chụp màn hình đối chiếu mockup + chạy checklist Task 10 trong plan (đăng nhập, thêm/tick/xóa, smart views, tìm/lọc, kéo-thả reorder, Kanban đổi ưu tiên, dark mode nhớ lựa chọn, realtime 2 tab, ngắt mạng thấy banner lỗi).
6. Cập nhật README (bỏ dòng "đang ở giai đoạn tài liệu") + commit cuối.
7. Sau khi e2e xanh → dùng superpowers:finishing-a-development-branch để chốt nhánh.

## Quyết định & lý do
- **THÊM Kanban view** (người dùng chốt) — ngoài PRD gốc. **Cột theo PRIORITY** (Cao/TB/Thấp), kéo thẻ sang cột = `updateTodo(id,{priority})` — vì cột theo thời gian (mockup) thì kéo-thả đổi `due_date` mơ hồ. Toggle Danh sách/Bảng ở top bar.
- **UI bám mockup sidebar dashboard** (không dùng layout 1 cột của plan). Controller tự author TSX đã style; subagent chỉ dùng cho task logic verbatim + review.
- **Đổi interface `FilterBar`**: bỏ `view/onView` (smart view chuyển sang `Sidebar`). `App` lift `useTheme` (áp cả trang login); `AppPage` nhận `theme/toggleTheme/userEmail` qua props.
- **Sửa `useTodos` lệch bản verbatim của plan** (có chủ đích, vì review tìm bug thật): thêm status callback cho realtime; reorder gán `sort_order` mới vào state.
- Follow-up **chấp nhận cho Phase 1** (KHÔNG chặn merge): `PriorityBadge`/`KanbanBoard` hardcode hex ưu tiên (dùng trong `style` động, không dùng được class Tailwind). Nếu muốn gọn: tách 1 hằng `PRIORITY_COLORS` dùng chung.

## Cạm bẫy / lưu ý
- **`reorderTodos` làm `setTodos(ordered)` thay thế cả mảng** → chỉ được truyền TOÀN BỘ todos, không truyền tập con đã lọc. `AppPage.reorderGroup` đã ghép nhóm trở lại full list; đừng phá logic này.
- **CRUD không optimistic** — dựa vào echo realtime để cập nhật UI. Nếu realtime rớt kênh, đã có banner báo lỗi (fix `503d6dd`). Task 10 nhớ test kịch bản ngắt mạng.
- `today` phải theo **giờ địa phương** (`toLocaleDateString('en-CA')`), không dùng `toISOString()` (UTC lệch ngày cho VN).
- Subagent `git add -A` dễ nuốt rác → luôn dùng explicit file list; đã theo suốt phiên.
- `.superpowers/` đã gitignore (ledger/brief/report). Windows CRLF warning bỏ qua.
- Chưa xác minh render thật — có thể có class Tailwind token sai (build không báo lỗi class không tồn tại). Kiểm mắt thường ở Task 10.

## File quan trọng
- [.superpowers/sdd/progress.md](.superpowers/sdd/progress.md) — **ledger tiến độ** (đọc đầu tiên; Task 1→9b done, chỉ còn Task 10).
- [docs/superpowers/plans/2026-07-04-todo-app-phase1.md](docs/superpowers/plans/2026-07-04-todo-app-phase1.md) — plan gốc; Task 10 ở dòng ~1553.
- [src/pages/AppPage.tsx](src/pages/AppPage.tsx) — lắp ráp chính (layout, filter, toggle List/Kanban, reorderGroup).
- [src/components/](src/components/) — Sidebar, TodoItem/List, KanbanCard/Board, Form, Filter, Search, badge, theme.
- [src/hooks/useTodos.ts](src/hooks/useTodos.ts) — CRUD + realtime (đã có status callback).
- [docs/design/](docs/design/) — mockup đối chiếu ở Task 10 (Dashboard, TaskRow, Kanban, KanbanCard).

## Câu hỏi mở
- Task 10 chờ người dùng: tạo project Supabase + cấu hình Google OAuth (cần tài khoản Google Cloud) + điền `.env`. Khi sẵn sàng, nhắn để tôi hướng dẫn từng bước.
