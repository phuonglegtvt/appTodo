# Thiết kế: Liệt kê công việc trong ô tháng (chế độ Năm)

- Ngày: 2026-07-10
- Phạm vi: Trang **Kế hoạch** → chế độ xem **Năm** (12 ô tháng).
- File liên quan hiện có: [PlanPage.tsx](../../../src/components/PlanPage.tsx),
  [PeriodGrid.tsx](../../../src/components/PeriodGrid.tsx),
  [PeriodCell.tsx](../../../src/components/PeriodCell.tsx),
  [DayCell.tsx](../../../src/components/DayCell.tsx),
  [goalFilters.ts](../../../src/lib/goalFilters.ts).

## 1. Mục tiêu

Trong chế độ **Năm**, mỗi ô tháng phải **liệt kê các công việc (todo) có hạn trong
tháng đó**, thay vì chỉ hiện số `done/total` như hiện tại. Mỗi tháng hiển thị **tối
đa 6 việc**; nếu nhiều hơn thì có nút **"xem thêm"** để **bung hết tại chỗ**.

Đây là dự án học lập trình → ưu tiên code rõ ràng, tách logic thuần để test.

## 2. Phạm vi & bố cục

- Chỉ đổi chế độ **Năm** (`horizon === 'year'`, lưới 12 ô tháng).
- Chế độ **5 Năm** (ô năm) **giữ nguyên** — vẫn dùng `PeriodGrid`/`PeriodCell` cũ
  (nhãn năm + `done/total` + tooltip goals khi hover).
- Giữ **lưới 4 cột × 3 hàng**. Số cột **không đổi**; mỗi ô tháng **cao lên**
  (min-height) để chứa danh sách việc. Chiều rộng cột giữ nguyên → tiêu đề việc
  dài sẽ **cắt bớt bằng `…`** (truncate), giống ô ngày trong [DayCell.tsx](../../../src/components/DayCell.tsx).

## 3. Nội dung mỗi ô tháng

- **Dòng đầu (header của ô):** nhãn **`Tháng MM`** + số **`done/total`**.
  - Nhãn tháng là phần **bấm để đi xuống** chế độ Tháng (xem mục 4).
- **Danh sách việc:** các `todo` có `due_date` nằm trong tháng đó
  (`start..end` của tháng, dùng `getPeriodRange('month', key)`), sắp bằng
  `sortByDoneThenOrder` (việc chưa xong lên trên, đã xong xuống dưới).
  - Việc **đã xong**: gạch ngang, chữ mờ (`line-through`, text-muted).
  - Việc **chưa xong**: nền nhạt màu primary, giống dòng việc trong ô ngày.
- **Mặc định hiện tối đa 6 việc.** Nếu tổng > 6:
  - Khi **chưa mở rộng**: hiện 6 việc đầu + nút **`+N xem thêm`** (N = số việc còn lại).
  - Khi **đã mở rộng**: hiện **tất cả** việc + nút **`thu gọn`**.
- Tháng **không có việc nào**: không hiện danh sách, chỉ hiện nhãn tháng (không hiện
  `done/total` khi total = 0, giữ đúng hành vi hiện tại).

### Số đếm `done/total`

Chuyển sang tính theo **todo trong tháng** (khớp với danh sách đang liệt kê):
`total` = số todo có hạn trong tháng, `done` = số todo đã xong trong đó.

> Thay đổi so với hiện tại: ô tháng đang gộp cả *goals* của tháng vào số đếm và
> hiện tiêu đề goals ở tooltip. Vì ô tháng giờ liệt kê **todo**, số đếm cũng tính
> theo **todo** cho nhất quán. Goals của tháng **không** hiển thị trong ô tháng ở
> chế độ Năm nữa (vẫn xem được khi đi xuống chế độ Tháng). Quyết định này đã được
> NewPL đồng ý.

## 4. Hành vi

- **Bấm nhãn tháng (`Tháng MM`)** → đi xuống chế độ **Tháng** của tháng đó
  (giữ nguyên `handleSelectCell` hiện có: `setHorizon('month')` + `setPeriodKey(key)`).
- **Bấm `+N xem thêm`** → bung tại chỗ, hiện hết việc trong tháng đó; đổi nút thành
  **`thu gọn`**. **Không rời màn hình.** State mở rộng là **cục bộ trong từng ô**
  (mỗi ô tháng tự nhớ đang mở hay đóng).
- Các **dòng việc chỉ để xem** — không bấm được, không toggle. (Giữ đúng phạm vi
  yêu cầu; tương tác việc vẫn làm ở chế độ Tháng/Ngày.)

## 5. Cấu trúc code

### Component mới (chỉ dùng khi `horizon === 'year'`)

- **`MonthCell`** — 1 ô tháng: header (nhãn tháng bấm được + `done/total`), danh sách
  việc cắt 6 / bung hết, nút xem thêm / thu gọn. Tự giữ state `expanded` cục bộ.
- **`MonthGrid`** — lưới 4 cột chứa các `MonthCell`.

`PeriodGrid`/`PeriodCell` **không sửa** (vẫn phục vụ chế độ 5 Năm).

### Logic thuần (tách ra để test)

Thêm hàm dựng dữ liệu ô tháng, ví dụ trong một module `lib/monthCell.ts`:

```ts
interface MonthCellData {
  key: string;        // 'YYYY-MM'
  monthLabel: string; // 'Tháng MM'
  todos: Todo[];      // todo trong tháng, đã sort done-last
  doneCount: number;
  totalCount: number;
}
```

- Hàm `buildMonthCells(todos, yearPeriodKey)`:
  - Lấy 12 tháng qua `getChildPeriods('year', yearPeriodKey)`.
  - Với mỗi tháng: lọc todo có `due_date` trong `getPeriodRange('month', key)`,
    sort bằng `sortByDoneThenOrder`, đếm done/total.
- Hàm hiển thị cắt 6 (dùng trong `MonthCell` hoặc tách riêng, tuỳ tiện test):
  `visibleTodos(todos, expanded, max=6)` → `{ visible: Todo[], overflow: number }`.

### PlanPage

- Thêm memo dựng `MonthCellData[]` cho chế độ Năm (tách khỏi memo `grid` hiện tại,
  hoặc thay nhánh `horizon === 'year'` trong `grid` bằng dữ liệu mới).
- Khi `horizon === 'year'` → render `<MonthGrid>`; khi `horizon === 'five_year'`
  → vẫn render `<PeriodGrid>` như cũ.
- Truyền `onSelect(key)` = `handleSelectCell` để bấm nhãn tháng đi xuống chế độ Tháng.

## 6. Kiểm thử (Vitest)

Test cho logic thuần:
- `buildMonthCells`:
  - Gom đúng todo vào đúng tháng theo `due_date` (biên đầu/cuối tháng).
  - Todo `due_date = null` không rơi vào tháng nào.
  - `doneCount`/`totalCount` đúng.
  - Thứ tự: việc chưa xong trước, đã xong sau.
- `visibleTodos` (cắt 6):
  - ≤ 6 việc → `overflow = 0`, hiện đủ.
  - > 6 việc, chưa mở rộng → `visible.length = 6`, `overflow = tổng - 6`.
  - đã mở rộng → hiện tất cả, `overflow = 0`.

Trước khi báo xong: chạy `npm test` và `npm run build`, xác nhận pass.

## 7. Ngoài phạm vi (YAGNI)

- Không thêm tương tác toggle/sửa việc ngay trong ô tháng.
- Không đổi chế độ 5 Năm, Tháng, Tuần, Ngày.
- Không đổi số cột (giữ 4 cột).
- Không thêm phân trang; "xem thêm" chỉ bung/thu gọn tại chỗ.
