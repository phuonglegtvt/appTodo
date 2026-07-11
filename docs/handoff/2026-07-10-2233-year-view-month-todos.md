# Handoff — chế độ Năm hiển thị việc trong ô tháng + câu hỏi gh CLI (2026-07-10 22:33)

**Tóm tắt:** Đã làm xong & deploy production tính năng "ô tháng liệt kê việc" ở chế độ Năm. Session dừng giữa lúc trả lời câu hỏi của NewPL về việc tại sao gh CLI không đăng nhập bằng tài khoản đúng.

## Trạng thái hiện tại
- **Feature HOÀN TẤT & đã LIVE production.** Tab Kế hoạch → chế độ Năm: mỗi ô tháng liệt kê todo có hạn trong tháng (tối đa 6), nút `+N xem thêm`/`thu gọn` bung/thu tại chỗ. Giữ lưới 4 cột; 5 Năm giữ nguyên.
- Đã verify: `npm test` **69/69 pass**, `npm run build` sạch (chạy cả trên kết quả merge).
- Đã merge vào `master` và push (`32d6f6a..ddaf8a6`). Netlify auto-deploy → `apptodo-phuong.netlify.app`. Xác minh feature thật sự lên bằng cách grep chuỗi đặc trưng `min-h-[7rem]` + `repeat(4, minmax` trong bundle JS production (không dựa vào hash vì Netlify build độc lập).
- Quy trình đầy đủ: brainstorm → spec → plan → subagent-driven execution (3 task, review từng task + final opus review sạch, 0 Critical/Important).

## Đang làm dở
- **Câu hỏi mở của NewPL (chưa trả lời xong):** "sao dự án này không đăng nhập gh CLI bằng phuonglegtvt/appTodo, hay cần cấp quyền thế nào?"
- Em vừa định chạy lệnh kiểm tra `gh auth status` + git credential + check account `phuonglegtvt` có thật không thì **NewPL interrupt để chạy /handoff**. Lệnh đó BỊ HỦY, chưa có kết quả.

## Bước tiếp theo
1. Trả lời câu hỏi gh CLI cho NewPL. Nội dung đã nắm chắc (không cần chạy lại lệnh nếu không muốn):
   - **Vì sao không tự đăng nhập lại được:** `gh auth login` là luồng **tương tác** (mở browser hoặc dán token) — session không tương tác của Claude không chạy được, và theo nguyên tắc không được xin/nhập token, auth code.
   - **3 cách NewPL tự xử lý:**
     - **(a) Đăng nhập gh bằng đúng tài khoản** sở hữu repo: NewPL tự chạy `gh auth login` (chọn github.com, account `phuonglegtvt`), rồi `gh auth switch` nếu cần. Sau đó `gh pr create` sẽ chạy.
     - **(b) Dùng Personal Access Token (PAT)** của `phuonglegtvt` (scope `repo`): `gh auth login --with-token < token.txt`. NewPL tự làm, không đưa token cho Claude.
     - **(c) Cấp quyền collaborator:** thêm tài khoản đang đăng nhập gh (`PhuongLeHong`) làm collaborator trên repo `phuonglegtvt/appTodo` — khi đó gh chạy bằng `PhuongLeHong` vẫn tạo được PR.
   - Khuyến nghị (a) hoặc (c) tùy hai account đó có phải cùng một người không.
2. (Nếu NewPL muốn) mở PR thủ công: `https://github.com/phuonglegtvt/appTodo/pull/new/feat/year-view-month-todos` — lưu ý code đã trong master rồi.

## Quyết định & lý do
- Merge thẳng vào master để deploy — vì NewPL nói "deploy lên môi trường thực tế luôn" (durable authorization). Đây là dự án học, workflow lâu nay commit thẳng master.
- Số `done/total` ở ô tháng đổi sang tính theo **todo trong tháng** (bỏ goals) — NewPL đã đồng ý trong brainstorm; goals vẫn xem được khi vào chế độ Tháng.
- Giữ 4 cột (không rộng gấp 5 lần như câu chữ ban đầu) — NewPL chọn "4 cột × 3 hàng" trong AskUserQuestion; ô cao lên chứ không rộng ra.

## Cạm bẫy / lưu ý
- **gh CLI ≠ git credential:** git push chạy ổn (credential `phuonglegtvt` trong keychain), nhưng gh authed `PhuongLeHong` → `gh pr create` lỗi "Could not resolve to a Repository" vì repo private không có quyền. Đã ghi memory [deploy-and-gh](../../../.claude/projects/-Users-arent-Documents-createAppProjects-appTodo/memory/deploy-and-gh.md).
- Verify deploy: **đừng so hash bundle với build local** (Netlify build riêng, hash khác) — grep className/chuỗi đặc trưng trong `/assets/index-*.js` production.
- Branch `feat/year-view-month-todos` vẫn còn (local + remote), chưa xoá — chờ NewPL quyết.

## File quan trọng
- [src/lib/monthCell.ts](../../src/lib/monthCell.ts) — logic thuần `buildMonthCells` + `visibleTodos` (8 test ở `monthCell.test.ts`).
- [src/components/MonthCell.tsx](../../src/components/MonthCell.tsx), [src/components/MonthGrid.tsx](../../src/components/MonthGrid.tsx) — UI ô tháng (chỉ dùng chế độ Năm).
- [src/components/PlanPage.tsx](../../src/components/PlanPage.tsx) — nối MonthGrid vào nhánh `horizon === 'year'`.
- [docs/superpowers/specs/2026-07-10-year-view-month-todos-design.md](../superpowers/specs/2026-07-10-year-view-month-todos-design.md) — spec.
- [docs/superpowers/plans/2026-07-10-year-view-month-todos.md](../superpowers/plans/2026-07-10-year-view-month-todos.md) — plan.
- `.superpowers/sdd/progress.md` — ledger tiến độ (đã đánh dấu feature complete).

## Câu hỏi mở
- Trả lời NewPL về gh CLI (bước tiếp theo #1) — NewPL muốn đi hướng (a), (b) hay (c)?
- Có xoá branch `feat/year-view-month-todos` (local + remote) không?
