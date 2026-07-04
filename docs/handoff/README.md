# docs/handoff — bàn giao giữa các session

Thư mục này chứa các **bản bàn giao (handoff)**: ảnh chụp trạng thái công việc ở
cuối một phiên làm việc với Claude Code, để phiên sau đọc lại và tiếp tục liền
mạch mà không phải bắt đầu lạnh.

## Cách dùng

- **Cuối session** — gõ `/handoff` (hoặc `/handoff save`): Claude tự tổng hợp
  session hiện tại và ghi một file mới `YYYY-MM-DD-HHmm-<slug>.md` vào thư mục này.
- **Đầu session mới** — gõ `/handoff read` (hoặc `/handoff resume`): Claude đọc
  bản **mới nhất** và tóm tắt lại đang ở đâu, bước tiếp theo là gì.

Việc đọc là **thủ công** — không tự động load khi mở session. Muốn tiếp tục việc
cũ thì chủ động gõ `/handoff read`.

## Quy ước

- Tên file: `YYYY-MM-DD-HHmm-<slug>.md` (timestamp để sắp xếp; slug mô tả chủ đề).
- Mỗi lần bàn giao tạo **file mới**, không ghi đè — giữ được lịch sử tiến độ.
- File `README.md` này không phải bản handoff; `/handoff read` sẽ bỏ qua nó.

## Handoff khác gì với memory và specs/plans?

| Nơi lưu | Chứa gì |
|---|---|
| `docs/handoff/` (đây) | **Tiến độ ngắn hạn** giữa các phiên: đang làm dở gì, bước tiếp theo, quyết định gần đây. |
| Memory (`~/.claude/.../memory/`) | **Sự thật bền vững**: sở thích người dùng, ràng buộc dự án. |
| `docs/superpowers/specs` & `plans` | **Thiết kế & kế hoạch** tổng thể của sản phẩm. |

Đừng nhồi sự thật bền vững vào handoff — chúng thuộc về memory.
