---
name: handoff
description: Tổng hợp hoặc đọc bản bàn giao (handoff) giữa các session cho dự án todo app. Dùng /handoff (hoặc /handoff save) để ghi lại trạng thái session hiện tại vào docs/handoff/; dùng /handoff read (hoặc /handoff resume) để đọc bản mới nhất khi bắt đầu session mới và tiếp tục liền mạch.
---

# Handoff — bàn giao giữa các session

Skill này giúp giữ **tính liên tục giữa các phiên làm việc**: cuối session ghi lại
"đang ở đâu, làm dở gì, bước tiếp theo là gì"; đầu session sau đọc lại để tiếp tục
không phải bắt đầu lạnh.

Handoff **khác** với hai cơ chế đã có trong repo:

- **Memory** (`~/.claude/.../memory/`): lưu *sự thật bền vững* (sở thích người
  dùng, ràng buộc dự án). KHÔNG nhồi những thứ này vào handoff.
- **Specs/Plans** (`docs/superpowers/`): thiết kế & kế hoạch tổng thể.

Handoff chỉ là **nhật ký tiến độ ngắn hạn** để nối các phiên. Nếu trong lúc tổng
hợp bạn phát hiện một sự thật bền vững đáng nhớ → ghi vào memory, đừng để lạc vào handoff.

## Chọn chế độ theo tham số

Đọc tham số người dùng gõ sau `/handoff`:

- `read` hoặc `resume` → **chế độ ĐỌC** (mục "Đọc handoff" bên dưới).
- không có tham số, hoặc `save` → **chế độ GHI** (mục "Ghi handoff" bên dưới).

## Ghi handoff (`/handoff` hoặc `/handoff save`)

1. Tự tổng hợp session hiện tại — cô đọng, có thể scan nhanh. KHÔNG chép lại toàn
   bộ hội thoại; chỉ giữ những gì session sau thực sự cần để tiếp tục.
2. Lấy thời gian hiện tại và một `<slug>` kebab-case mô tả chủ đề chính của session.
3. Ghi **file mới** (không ghi đè bản cũ — giữ lịch sử bàn giao) tại:
   `docs/handoff/YYYY-MM-DD-HHmm-<slug>.md`
   theo template dưới đây. Bỏ qua mục nào không có nội dung.
4. Báo lại đường dẫn file vừa ghi.

### Nguyên tắc khi ghi

- **Không tô hồng.** Nếu `npm test` / `npm run build` đang fail, hoặc có việc còn
  hỏng, ghi rõ trong "Trạng thái hiện tại" — bám nguyên tắc "không nuốt lỗi im
  lặng" của `CLAUDE.md`.
- Ưu tiên **bước tiếp theo cụ thể** hơn là kể lể quá khứ.
- Ghi rõ **lý do** của các quyết định để session sau không bàn lại từ đầu.
- Dùng tiếng Việt; giữ thuật ngữ kỹ thuật bằng tiếng Anh. Tham chiếu file bằng
  link `[đường/dẫn](đường/dẫn)`.

### Template file handoff

```markdown
# Handoff — <chủ đề> (YYYY-MM-DD HH:mm)

**Tóm tắt:** <một dòng: session này về việc gì>

## Trạng thái hiện tại
- <cái gì đã xong & chạy được; đã verify bằng cách nào (test/build/chạy thật)>
- <nếu có gì đang fail: nói thẳng>

## Đang làm dở
- <việc đang giữa chừng, file đang sửa, tới đâu thì dừng>

## Bước tiếp theo
1. <hành động cụ thể, theo thứ tự>
2. <...>

## Quyết định & lý do
- <chốt gì> — vì <lý do>

## Cạm bẫy / lưu ý
- <lỗi đã gặp, chỗ dễ sai, ràng buộc cần nhớ>

## File quan trọng
- [đường/dẫn/file](đường/dẫn/file) — <vai trò>

## Câu hỏi mở
- <điều còn chờ người dùng quyết>
```

## Đọc handoff (`/handoff read` hoặc `/handoff resume`)

1. Liệt kê `docs/handoff/`, **bỏ qua** `README.md`.
2. Nếu không còn file nào → báo rõ **"Chưa có handoff nào"** và dừng. KHÔNG đọc
   `README.md` thay thế, không bịa nội dung.
3. Nếu có → chọn file **mới nhất** (tên file bắt đầu bằng `YYYY-MM-DD-HHmm` nên
   sắp theo tên là ra bản mới nhất). Đọc nó.
4. Tóm tắt lại cho người dùng, tập trung vào: **đang ở đâu**, **bước tiếp theo là
   gì**, và **câu hỏi mở** nào cần họ quyết trước khi làm tiếp.
