# Design — Year view rộng hơn, checkbox trong ô tháng, tab neo hôm nay

## Tóm tắt

Điều chỉnh tab Kế hoạch để chế độ Năm dễ đọc và thao tác hơn, đồng thời việc chuyển giữa các tầng thời gian luôn quay về kỳ chứa ngày hiện tại thay vì giữ anchor cũ gây cảm giác nhảy lung tung.

## Phạm vi

- Chỉ áp dụng trong tab Kế hoạch.
- Chỉ thay đổi layout/interaction của chế độ Năm và hành vi bấm trực tiếp các tab `5 Năm`, `Năm`, `Tháng`, `Tuần`, `Ngày`.
- Không thay đổi mô hình dữ liệu todo/goals, Supabase schema, hay logic tạo/sửa/xóa todo hiện có.

## Yêu cầu chức năng

### 1. Ô tháng trong chế độ Năm rộng và dễ đọc hơn

- Lưới 12 tháng đổi từ 4 cột x 3 hàng sang 3 cột x 4 hàng.
- Mỗi ô tháng tăng chiều cao tối thiểu để chứa checkbox và chữ lớn hơn.
- Text của todo trong ô tháng tăng size/weight so với hiện tại để dễ nhìn.
- Giữ nút `+N xem thêm` / `thu gọn` tại chỗ khi tháng có nhiều việc.

### 2. Todo trong ô tháng có checkbox

- Mỗi todo hiển thị trong `MonthCell` có checkbox báo trạng thái hoàn thành.
- Tick/untick checkbox gọi lại luồng `onToggleTodo(id, done)` đang dùng ở các màn khác.
- Todo đã hoàn thành vẫn hiển thị line-through/muted để nhất quán với `TodoItem` và `DayCell`.
- Tương tác checkbox không được làm người dùng bị drill-down sang chế độ Tháng.
- Bấm tiêu đề/tháng vẫn drill-down từ chế độ Năm sang chế độ Tháng như hiện tại.

### 3. Chuyển tab thời gian luôn về hiện tại

- Khi bấm trực tiếp một tab thời gian, `periodKey` được tính từ prop `today`:
  - `5 Năm` -> khối 5 năm chứa hôm nay.
  - `Năm` -> năm hiện tại.
  - `Tháng` -> tháng hiện tại.
  - `Tuần` -> tuần ISO hiện tại.
  - `Ngày` -> ngày hôm nay.
- `openDay` được đóng khi đổi tab.
- Nút điều hướng `‹` / `›` vẫn giữ hành vi kỳ trước/kỳ sau theo kỳ đang xem.
- Drill-down từ cell vẫn giữ ngữ cảnh cell được chọn: `5 Năm` -> năm được bấm, `Năm` -> tháng được bấm.

## Thiết kế kỹ thuật

- `MonthGrid` nhận thêm callback toggle và truyền xuống `MonthCell`.
- `MonthGrid` đổi grid template từ `repeat(4, minmax(0, 1fr))` sang 3 cột.
- `MonthCell` render từng todo bằng label + checkbox + text, dùng `onChange` để toggle.
- `PlanPage.handleHorizon` bỏ anchor theo kỳ cũ, thay bằng `getPeriodKey(newHorizon, today)` hoặc `today` nếu `newHorizon === 'day'`.
- Logic pure hiện có trong `monthCell.ts` giữ nguyên nếu không cần thay đổi max visible; chỉ cập nhật test nếu hành vi hiển thị thay đổi.

## Error handling

- Toggle checkbox dùng chung handler hiện có. Nếu lưu thất bại, app tiếp tục dựa vào cơ chế báo lỗi hiện tại của todo flow, không thêm fallback che lỗi.
- Không nuốt lỗi im lặng trong component mới/sửa.

## Kiểm thử

- Thêm/cập nhật test cho hàm tính anchor tab nếu tách ra helper thuần.
- Chạy `npm test`.
- Chạy `npm run build`.
- Kiểm tra thủ công tab Kế hoạch:
  - Chế độ Năm hiển thị 3 cột x 4 hàng.
  - Checkbox trong ô tháng tick/untick đúng và không mở chế độ Tháng.
  - Bấm từng tab thời gian quay về kỳ chứa hôm nay.
  - Nút `‹` / `›` và drill-down cell vẫn hoạt động.

## Ngoài phạm vi

- Không thêm sửa title/note/tags ngay trong ô tháng.
- Không thay đổi số lượng todo mặc định hiển thị trong ô tháng trừ khi cần để layout cân đối.
- Không xoá branch cũ hoặc thay đổi workflow GitHub/Netlify.
