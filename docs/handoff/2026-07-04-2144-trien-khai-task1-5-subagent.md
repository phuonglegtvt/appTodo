# Handoff — Triển khai Task 1–5 (subagent-driven) + chốt độ bám design (2026-07-04 21:44)

**Tóm tắt:** Đã `git init`, giải nén Claude Design, và triển khai xong Task 1→5 của plan bằng subagent-driven. Vừa chốt: **dựng UI bám sát mockup sidebar dashboard**. Session sau: bắt đầu Task 6.

## Trạng thái hiện tại
- **Repo đã là git**; 8 commit; baseline `5906a73`. Toàn bộ đã verify (test/build/tsc thật, không tô hồng):
  - **Task 1** (`b8cbacb..bc36033`): scaffold Vite+React+TS. Đã sửa 2 lỗi implementer gây ra: (a) lỡ commit rác `Designapp.zip` + `Designapp/` → đã xóa & gitignore; (b) xung đột peer-deps → nâng `eslint-plugin-react-hooks` `^4.6.2`→`^5.0.0`, giờ `npm install` **sạch, không cần `--legacy-peer-deps`**. Dev boots ở :5173.
  - **Task 2** (`b16112c`): Tailwind + **design tokens** (đã lồng vào `tailwind.config.js`) + `theme.ts` (TDD). `npm run build` sạch, 5/5 test.
  - **Task 3** (`f36b8d7`): `types/todo.ts`, `lib/supabaseClient.ts` (throw rõ nếu thiếu env — cố ý), `supabase/schema.sql` (RLS + realtime). tsc sạch.
  - **Task 4** (`f3901c0`): `lib/todoFilters.ts` + test (TDD, 15/15). Toàn bộ suite **20/20 pass**.
  - **Task 5** (`240fd51`): hook `useTheme.ts`. tsc sạch.
- **Chưa có `.env`** → app chưa chạy thật được (đúng kế hoạch, để Task 10). `import.meta.env` chỉ dùng runtime; tsc/build không cần.

## Đang làm dở
- **Task 6 chưa bắt đầu.** Vừa dừng ở bước hỏi độ bám design (đã có câu trả lời — xem Quyết định). Đã đọc kỹ 3 file design: `TaskRow.dc.html`, `Dashboard.dc.html`, `HANDOFF.md`.

## Bước tiếp theo
1. Tiếp tục **subagent-driven** (skill đã load; ledger tại `.superpowers/sdd/progress.md` — nguồn sự thật, sống sót qua compaction). Helper: `bash .../subagent-driven-development/scripts/task-brief PLAN N` sinh brief; model **haiku** cho task chép verbatim.
2. **Task 6** — `useAuth.ts` + `ErrorBanner.tsx` + `LoginPage.tsx`. Logic `useAuth` giữ verbatim theo plan. **LoginPage + ErrorBanner: style theo design system** (bg-bg, surface, primary tím, rounded, font sans, dark mode) — trang login căn giữa (xem mockup login trong `Ứng dụng Todo.dc.html`).
3. **Task 7** — `useTodos.ts` verbatim theo plan (CRUD + realtime), không đụng UI.
4. **Task 8 + 9 — ĐÂY LÀ PHẦN LỚN:** dựng **bám sát mockup sidebar dashboard** (không dùng layout 1 cột tối giản của plan). Xem "Bản đồ design" bên dưới. Giữ nguyên hooks/lib; chỉ viết lại layout+style ở `components/` và `pages/`. Tôi (controller) nên tự author TSX đã style rồi giao subagent transcribe+build (vì controller giữ context design).
5. **Xác minh giao diện:** dùng Chrome tools (mcp__claude-in-chrome__*) render `npm run dev` + chụp màn hình đối chiếu mockup. (Cần `.env` để qua được login; hoặc tạm bypass auth để xem AppPage.)
6. **Task 10:** người dùng tự tạo Supabase + điền `.env` (xem plan Task 10).

## Quyết định & lý do
- **CHỐT: UI bám sát mockup sidebar dashboard** (người dùng chọn), KHÔNG dùng layout 1 cột của plan. Plan mục "Ghi chú thực thi" (dòng 1599) cho phép thay layout/style ở `components/`+`pages/` khi có design, miễn không đụng `lib/`+`hooks/`.
- **Design tokens đã vào `tailwind.config.js`** (Task 2): màu `bg/surface/border/text/primary/priority`, `borderRadius sm..xl`, font `sans=Plus Jakarta Sans, mono=JetBrains Mono`. Font nạp qua `@import` Google Fonts trong `src/index.css`.
- **Review nhẹ (controller-verified) cho Task 2–5** thay vì spawn reviewer subagent — vì code chép verbatim + đã có test/build/tsc chứng minh. Task 8–9 (nhiều phán đoán) sẽ dùng reviewer subagent + final whole-branch review.
- **haiku** cho implementer các task transcription (rẻ, đủ sức).

## Cạm bẫy / lưu ý
- **`git add -A` của subagent dễ nuốt rác** (đã dính 1 lần). Mỗi task sau: kiểm `git show --stat` xem có file lạ không.
- **`.superpowers/` đã gitignore** (scratch quy trình: ledger/brief/report). Đừng commit.
- **Không nuốt lỗi im lặng** (CLAUDE.md): `supabaseClient` throw khi thiếu env; mọi thao tác Supabase phải `console.error` + báo qua `ErrorBanner`. Giữ tinh thần này ở Task 6–9.
- **Chỉ Supabase anon key** ở frontend; không commit service_role.
- Windows: warning CRLF khi commit là bình thường, bỏ qua.
- Brief/report của subagent nằm ở `C:\Users\phuon\.claude\plugins\cache\...\6.1.1\.superpowers\sdd\` (theo task-brief script), report cũng có bản ở `D:\learnAI\appTodo\.superpowers\sdd\`.

## Bản đồ design (rút từ mockup — dùng cho Task 8–9)
- **Tokens:** primary `#5B57E0` (dark `#837FF2`), accent-soft `#EEEDFF`; priority Cao `#E5484D` / TB `#EAB308` / Thấp `#12A150` (badge dạng pill nền nhạt + chấm màu); surface trắng/`#17171C` (dark); radius thẻ 12px (`rounded-lg`).
- **Sidebar (258px):** logo ✓ "Việc của tôi"; nhóm "SMART VIEWS" (Hôm nay/Sắp tới/Tất cả/Đã xong, mục active nền `accent-soft` chữ primary, có badge số đếm); nhóm "NHÃN" (chấm màu + tên tag + số đếm); đáy: avatar + tên + email + nút đăng xuất ⏻.
- **Main:** top bar (ô tìm kiếm, nút lọc Trạng thái/Nhãn/Ưu tiên ▾, toggle theme dạng segmented ☀/☾, nút "＋ Thêm việc" nền primary); tiêu đề view lớn + dòng phụ ngày/đếm; ô "thêm việc nhanh" (nhập tiêu đề + Enter); danh sách chia mục "CẦN LÀM"/"ĐÃ XONG".
- **TaskRow (xem `docs/design/TaskRow.dc.html`):** flex, thẻ surface bo 12px + shadow; tay cầm kéo 6 chấm; checkbox 20px bo 6px (done = nền primary ✓ trắng); tiêu đề 14.5px (done = gạch ngang + mờ); dòng phụ: due (quá hạn = màu `priority.high` + chấm) + chips tag (pill nền nhạt + chấm màu); badge ưu tiên pill; nút Sửa ✎ / Xóa ✕ (28px, hover nền nhạt).
- **Responsive:** desktop = sidebar + main; mobile = 1 cột, smart views thành hàng tab ngang trên đầu (xem mockup mobile trong canvas).

## File quan trọng
- [.superpowers/sdd/progress.md](.superpowers/sdd/progress.md) — **ledger tiến độ** (đọc đầu tiên; đã gitignore).
- [docs/superpowers/plans/2026-07-04-todo-app-phase1.md](docs/superpowers/plans/2026-07-04-todo-app-phase1.md) — plan gốc (code verbatim cho hooks/lib; layout UI thì thay theo design).
- [docs/design/](docs/design/) — mockup + tokens: `TaskRow.dc.html`, `Dashboard.dc.html`, `Kanban.dc.html`, `HANDOFF.md`, `Ứng dụng Todo.dc.html` (canvas tổng, có màn login + mobile + tokens section 07).
- [tailwind.config.js](tailwind.config.js) — tokens đã cấu hình sẵn.
- [CLAUDE.md](CLAUDE.md) — quy ước bắt buộc.

## Câu hỏi mở
- **Kanban view**: design có kèm Kanban nhưng KHÔNG thuộc Phase 1 (PRD). Đang bỏ qua; hỏi lại nếu người dùng muốn thêm.
- Task 10 cần người dùng tự tạo project Supabase + điền `.env` (chưa làm).
