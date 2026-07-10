# Handoff — Nhập nội dung chi tiết (notes) cho công việc (2026-07-10 18:34)

**Tóm tắt:** Session vừa deploy xong tính năng lịch ngày Google Calendar; đang chuẩn bị làm tính năng mới "cho phép nhập notes chi tiết cho công việc" — thiết kế đã được duyệt, CHƯA code.

## Trạng thái hiện tại
- **Đã deploy production**: tính năng lịch ngày kiểu Google Calendar + thêm việc nhanh trên tab Kế hoạch. Đã merge fast-forward vào `master`, push lên `origin/master` (Netlify auto-deploy → apptodo-phuong.netlify.app). Commit `264aac5..0531807` (5 commit). `npm test` 58/58 pass, `npm run build` OK.
- **Đã sửa trước đó**: lỗi bảng `public.goals` chưa tồn tại — đã chạy migration [supabase/migrations/2026-07-10-goals.sql](supabase/migrations/2026-07-10-goals.sql) trên Supabase Dashboard, lỗi hết.
- Branch hiện tại: `master`. Working tree chỉ có `package-lock.json` bị modified (không đáng kể).
- ⚠️ `npm run lint` **fail** — repo CHƯA có file cấu hình ESLint (`lint` script là `eslint .` nhưng không có `eslint.config.js`). Gap có sẵn, KHÔNG do các thay đổi gần đây. Đừng coi đây là lỗi hồi quy.

## Đang làm dở — TÍNH NĂNG NOTES (thiết kế đã duyệt, chưa code)
Người dùng: "cho phép nhập nội dung cụ thể cho công việc, hiện mới chỉ nhập tiêu đề."

**Phát hiện quan trọng:** field `notes` ĐÃ có sẵn trong type `Todo`/`NewTodo`/`TodoUpdate` và DB. Form **Sửa việc** ([TodoItem.tsx:74-79](src/components/TodoItem.tsx#L74-L79)) ĐÃ có textarea "Ghi chú" hoạt động. Chỉ 2 chỗ thiếu:
1. Form thêm việc nhanh chưa nhập được notes.
2. Danh sách không hiển thị notes ra đâu cả.

**Thiết kế đã chốt (chỉ 2 file, không đụng DB/type):**

- **A. [TodoForm.tsx](src/components/TodoForm.tsx):** thêm nút text nhỏ **"＋ chi tiết"** dưới hàng nhập; bấm → hiện textarea "Ghi chú chi tiết…". Khi Thêm: gộp `notes: notes.trim() || null` vào NewTodo; sau đó reset ô notes + thu gọn lại. (Cần thêm state `notes` và `showNotes`.)
- **B. [TodoItem.tsx](src/components/TodoItem.tsx) — chế độ hiển thị (không phải edit):** việc có notes → hiện nút **▾** cạnh tiêu đề; bấm xổ toàn bộ notes inline dưới phần meta (giữ xuống dòng bằng `whitespace-pre-wrap`, chữ nhỏ/mờ), bấm lại thu gọn. Việc không có notes → không hiện gì. (Cần state `showNotes` local.)

## Bước tiếp theo
1. Ghi spec ngắn vào `docs/superpowers/specs/2026-07-10-todo-notes-design.md` (thiết kế nhỏ, spec ngắn là đủ) rồi commit — HOẶC vì phạm vi rất nhỏ (2 file UI), có thể bỏ qua ceremony và implement thẳng. Session sau tự cân nhắc, nhưng thiết kế đã được người dùng duyệt rồi nên KHÔNG cần brainstorm lại.
2. Tạo nhánh feature mới (VD `feat/todo-notes`) — không code thẳng master.
3. Implement A (TodoForm) + B (TodoItem hiển thị).
4. Verify: `npm run build` OK, `npm test` 58/58 vẫn pass, kiểm thử tay (thêm việc có notes → thấy ▾ → xổ ra đúng).
5. Merge + push để deploy (Netlify từ `origin/master`).

## Quyết định & lý do
- Form thêm dùng nút "＋ chi tiết" (không phải textarea luôn hiện) — vì giữ form thêm gọn cho người không cần notes.
- Hiển thị dạng bấm ▾ xổ toàn bộ (không cắt dòng) — người dùng chọn, để đọc đủ nội dung khi cần.
- **DayPopover (thêm nhanh trên lịch) GIỮ NGUYÊN chỉ tiêu đề** — người dùng đã đồng ý; muốn ghi chú thì "Mở ngày →" rồi Sửa.
- Form Sửa việc KHÔNG đụng (đã có notes sẵn).
- Không viết unit test mới — thay đổi thuần UI, không có logic thuần đáng test riêng.

## Cạm bẫy / lưu ý
- 🔴 **Bảo mật CHƯA xử lý**: GitHub Personal Access Token (`ghp_...`) đang nhúng trong URL remote origin (`git remote -v` lộ ra). Đã dặn người dùng revoke + tạo token mới + `git remote set-url origin https://github.com/phuonglegtvt/appTodo.git`. Nhắc lại nếu chưa làm.
- Netlify deploy từ `origin/master` (không có `netlify.toml`, cấu hình build ở Netlify UI). Push master = deploy production.
- Polish còn nợ từ tính năng lịch (Minor, chưa làm): popover có thể bị cắt ở ô rìa phải/hàng cuối; thứ tự 3 dòng preview trong ô chưa chắc khớp day-view; popover thiếu `role="dialog"` + trả focus khi đóng.

## File quan trọng
- [src/components/TodoForm.tsx](src/components/TodoForm.tsx) — form thêm việc, cần thêm "＋ chi tiết" + notes.
- [src/components/TodoItem.tsx](src/components/TodoItem.tsx) — item việc; edit đã có notes, cần thêm hiển thị notes ở chế độ view.
- [src/types/todo.ts](src/types/todo.ts) — `notes` đã có trong Todo/NewTodo/TodoUpdate (không cần sửa).

## Câu hỏi mở
- Không còn — thiết kế đã duyệt đầy đủ, người dùng đã nói "ok tiếp tục đi". Chỉ cần chọn có ghi spec hay implement thẳng.
