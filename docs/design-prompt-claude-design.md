# Prompt tạo giao diện trên Claude Design

> Mở **claude.design** → tạo dự án mới → dán nguyên khối prompt bên dưới.
> Sau khi có kết quả, xuất HTML/CSS hoặc bảng design tokens (màu, font, spacing)
> rồi đưa lại cho Claude Code để hiện thực bằng React + Tailwind.

## Prompt (copy từ đây)

```
Thiết kế giao diện cho một web app quản lý công việc cá nhân (Todo),
phong cách hiện đại, tối giản, sạch sẽ, có hỗ trợ Dark Mode và Responsive
(dùng tốt trên cả điện thoại lẫn máy tính). Ngôn ngữ hiển thị: tiếng Việt.

Cần thiết kế các màn hình / thành phần sau:

1. TRANG ĐĂNG NHẬP
   - Logo/tên app đơn giản.
   - Nút "Đăng nhập với Google".
   - Ô nhập email + nút "Gửi magic link" (đăng nhập không mật khẩu).

2. TRANG CHÍNH (danh sách việc)
   - Thanh bên hoặc tab lọc nhanh "Smart Views": Hôm nay / Sắp tới / Tất cả / Đã xong.
   - Thanh tìm kiếm theo từ khóa.
   - Bộ lọc: theo trạng thái (đang làm/đã xong/tất cả), theo nhãn (tag), theo độ ưu tiên.
   - Ô thêm việc nhanh (chỉ cần nhập tiêu đề là thêm được).
   - Nút bật/tắt Dark Mode.
   - Nút đăng xuất.

3. MỘT DÒNG VIỆC (Todo Item) — quan trọng, thiết kế kỹ:
   - Checkbox đánh dấu hoàn thành (việc đã xong hiển thị gạch ngang, mờ đi).
   - Tiêu đề việc.
   - Hạn chót (due date); việc QUÁ HẠN phải nổi bật (ví dụ chữ/màu đỏ).
   - Nhãn ưu tiên phân biệt bằng màu: Cao (đỏ) / Trung bình (vàng) / Thấp (xanh/xám).
   - Danh sách nhãn (tags) nhỏ gọn dạng chip.
   - Nút Sửa và nút Xóa.
   - Có "tay cầm" để kéo-thả sắp xếp lại thứ tự các việc.

4. FORM THÊM/SỬA VIỆC (dạng modal hoặc panel):
   - Tiêu đề (bắt buộc), Ghi chú (tùy chọn).
   - Chọn hạn chót (date picker).
   - Chọn độ ưu tiên (Cao/Trung bình/Thấp).
   - Thêm nhiều nhãn (tags).
   - Nút Lưu / Hủy.

5. TRẠNG THÁI RỖNG & THÔNG BÁO LỖI:
   - Màn hình khi chưa có việc nào (empty state thân thiện).
   - Dải thông báo lỗi (error banner) ở đầu trang khi mất mạng / lưu thất bại.

Yêu cầu về design system: hãy đưa ra bảng màu (light + dark), kiểu chữ,
khoảng cách, bo góc, và các design tokens rõ ràng để lập trình viên hiện thực
lại bằng React + Tailwind CSS.
```
