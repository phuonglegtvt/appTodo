// Kiểm tra ô nhập của form Thu–Chi — hàm THUẦN, không I/O, không React.
//
// Tách khỏi component để test được mọi ca gõ sai mà không phải dựng form.
// Chặn ở đây TRƯỚC khi gửi, vì lỗi do DB trả về là tên constraint tiếng Anh
// ("cash_entries_amount_vnd_check"), người dùng đọc xong không biết sai ở đâu.

import { CASH_CATEGORIES } from './cashCategories';
import { parseVndAmount } from './parseNumber';
import type { CashKind, NewCashEntry } from '../types/cashEntry';

export interface DraftCashEntry {
  occurred_on: string;
  kind: CashKind;
  category: string;
  amountText: string;
  note: string;
}

export type KiemTraKetQua =
  | { ok: true; entry: NewCashEntry }
  | { ok: false; loi: string };

export function kiemTraKhoan(draft: DraftCashEntry): KiemTraKetQua {
  if (draft.occurred_on.trim() === '') {
    return { ok: false, loi: 'Chưa chọn ngày phát sinh.' };
  }

  // Danh mục phải thuộc đúng loại đang chọn: tổng thu/chi dựa hẳn vào `kind`,
  // nên cặp lệch (kind THU + danh mục của CHI) sẽ hiện nhãn một đằng mà cộng
  // số một nẻo.
  const dm = CASH_CATEGORIES.find((c) => c.key === draft.category);
  if (dm === undefined) {
    return { ok: false, loi: 'Chưa chọn danh mục hợp lệ.' };
  }
  if (dm.kind !== draft.kind) {
    const ten = draft.kind === 'THU' ? 'Thu' : 'Chi';
    return { ok: false, loi: `Danh mục "${dm.label}" không thuộc nhóm ${ten}.` };
  }

  // `parseVndAmount` GIỮ dấu trừ (không nuốt) để chỗ này từ chối được với đúng
  // lý do, thay vì lặng lẽ biến −5tr thành 5tr.
  const soTien = parseVndAmount(draft.amountText);
  if (soTien === null) {
    return { ok: false, loi: 'Chưa nhập số tiền, hoặc số tiền không đọc được.' };
  }
  if (soTien < 0) {
    return {
      ok: false,
      loi: 'Số tiền không thể âm — chọn Thu hay Chi ở ô bên cạnh, đừng gõ dấu trừ.',
    };
  }
  if (soTien === 0) {
    return { ok: false, loi: 'Số tiền phải lớn hơn 0.' };
  }

  return {
    ok: true,
    entry: {
      occurred_on: draft.occurred_on,
      kind: draft.kind,
      category: draft.category,
      amount_vnd: soTien,
      note: draft.note.trim(),
    },
  };
}
