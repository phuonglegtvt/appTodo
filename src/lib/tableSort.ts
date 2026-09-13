// Sắp xếp bảng theo cột — hàm THUẦN, không I/O, không đụng React.
//
// Sort ở phía trình duyệt, KHÔNG ghi xuống DB và KHÔNG đụng cột `sort_order`:
// đây là cách NewPL đang NHÌN bảng lúc này, không phải thứ tự muốn lưu lại.

export type SortDir = 'asc' | 'desc';

/** Cột đang sort và chiều sort. `null` ở chỗ dùng = không sort, giữ thứ tự gốc. */
export interface SortState<K extends string> {
  key: K;
  dir: SortDir;
}

/**
 * Giá trị một ô dùng để SO SÁNH — có thể khác hẳn thứ hiển thị.
 * `null` = CHƯA NHẬP (khác 0), luôn bị đẩy xuống cuối.
 */
export type SortValue = number | string | null;

/**
 * Bấm vào tiêu đề một cột. Ba nhịp: tăng → giảm → tắt.
 *
 * Có nhịp "tắt" vì thứ tự gốc (`sort_order` NewPL tự sắp) là một thông tin
 * riêng — sort xong mà không quay về được thì phải tải lại trang mới thấy lại.
 */
export function nextSort<K extends string>(
  hienTai: SortState<K> | null,
  key: K,
): SortState<K> | null {
  // Cột khác ⇒ bắt đầu lại từ tăng dần, không kế thừa chiều của cột cũ.
  if (hienTai === null || hienTai.key !== key) return { key, dir: 'asc' };
  if (hienTai.dir === 'asc') return { key, dir: 'desc' };
  return null;
}

/**
 * Bộ so sánh chuỗi theo tiếng Việt. Tạo MỘT lần ở đây chứ không gọi
 * `localeCompare` trong vòng lặp: mỗi lần gọi `localeCompare` dựng lại một
 * collator, sort 50 dòng thành hàng nghìn lần dựng.
 *
 * Vì sao không so bằng `<`: so theo mã Unicode đẩy mọi chữ có dấu xuống cuối
 * ('Á Châu', 'Ánh' rơi xuống sau 'Bình') — sai bảng chữ cái tiếng Việt.
 */
const soSanhChu = new Intl.Collator('vi');

/**
 * Trả về MẢNG MỚI đã sắp xếp. Không đụng mảng gốc — mảng gốc là state của React,
 * `Array.prototype.sort` sửa tại chỗ sẽ sửa luôn state mà React không biết.
 *
 * `state === null` trả về chính mảng gốc (cùng tham chiếu) để React khỏi vẽ lại.
 */
export function sortRows<T, K extends string>(
  rows: T[],
  state: SortState<K> | null,
  getValue: (row: T, key: K) => SortValue,
): T[] {
  if (state === null) return rows;

  const { key, dir } = state;
  const heSo = dir === 'asc' ? 1 : -1;

  // `sort` của JS ổn định (ES2019+): hai dòng bằng điểm giữ nguyên thứ tự gốc.
  return [...rows].sort((a, b) => {
    const va = getValue(a, key);
    const vb = getValue(b, key);

    // Ô trống luôn xuống cuối, KHÔNG nhân `heSo`. Nếu để nó đảo theo chiều sort
    // thì bấm "giảm dần" sẽ đẩy toàn bộ mã chưa nhập lên đầu bảng — đúng về mặt
    // "null bé nhất" nhưng vô dụng khi đang muốn tìm mã giảm sâu nhất.
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;

    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * heSo;
    return soSanhChu.compare(String(va), String(vb)) * heSo;
  });
}

/**
 * Khai báo một cột sort được: khoá, nhãn tiêu đề, cách lấy giá trị so sánh.
 * Mỗi bảng tự khai một mảng ColumnDef và dùng nó vẽ `<thead>` — nhãn tiêu đề
 * chỉ tồn tại ở MỘT chỗ.
 */
export interface ColumnDef<T, K extends string> {
  key: K;
  label: string;
  value: (row: T) => SortValue;
}
