import { describe, expect, test } from 'vitest';
import { kiemTraKhoan, type DraftCashEntry } from './cashEntryInput';

function draft(over: Partial<DraftCashEntry> = {}): DraftCashEntry {
  return {
    occurred_on: '2026-09-13', kind: 'CHI', category: 'GIA_DINH',
    amountText: '12.000.000', note: '',
    ...over,
  };
}

describe('kiemTraKhoan — ca hợp lệ', () => {
  test('nhận dấu chấm phân cách nghìn kiểu người Việt gõ', () => {
    const r = kiemTraKhoan(draft({ amountText: '12.000.000' }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.entry.amount_vnd).toBe(12_000_000);
  });

  test('cắt khoảng trắng thừa của ghi chú', () => {
    const r = kiemTraKhoan(draft({ note: '  tiền chợ  ' }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.entry.note).toBe('tiền chợ');
  });

  test('giữ nguyên ngày, loại, danh mục đã chọn', () => {
    const r = kiemTraKhoan(draft({ occurred_on: '2026-09-01', kind: 'THU', category: 'LUONG' }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.entry.occurred_on).toBe('2026-09-01');
      expect(r.entry.kind).toBe('THU');
      expect(r.entry.category).toBe('LUONG');
    }
  });
});

describe('kiemTraKhoan — số tiền', () => {
  test('bỏ trống số tiền thì báo lỗi, KHÔNG lưu 0 đồng', () => {
    const r = kiemTraKhoan(draft({ amountText: '' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.loi).toMatch(/số tiền/i);
  });

  test('gõ chữ thì báo lỗi, không âm thầm thành 0', () => {
    const r = kiemTraKhoan(draft({ amountText: 'abc' }));
    expect(r.ok).toBe(false);
  });

  test('số 0 bị từ chối — DB có CHECK amount_vnd > 0', () => {
    const r = kiemTraKhoan(draft({ amountText: '0' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.loi).toMatch(/lớn hơn 0/i);
  });

  test('số âm bị từ chối với lý do rõ ràng, không bị nuốt dấu trừ', () => {
    // Chiều tiền nằm ở `kind`, không nằm ở dấu. Nuốt dấu trừ sẽ biến một khoản
    // nhập nhầm thành khoản hợp lệ.
    const r = kiemTraKhoan(draft({ amountText: '-5.000.000' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.loi).toMatch(/âm/i);
  });
});

describe('kiemTraKhoan — ngày', () => {
  test('thiếu ngày thì báo lỗi', () => {
    const r = kiemTraKhoan(draft({ occurred_on: '' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.loi).toMatch(/ngày/i);
  });
});

describe('kiemTraKhoan — danh mục phải khớp loại', () => {
  test('chọn Thu nhưng danh mục là mục Chi thì bị chặn', () => {
    // Tổng thu/chi dựa hẳn vào cột `kind`. Để lọt cặp lệch này thì bảng vẫn
    // hiện "Chi tiêu gia đình" mà con số lại cộng vào tổng THU.
    const r = kiemTraKhoan(draft({ kind: 'THU', category: 'GIA_DINH' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.loi).toMatch(/danh mục/i);
  });

  test('chọn Chi với danh mục Chi thì hợp lệ', () => {
    expect(kiemTraKhoan(draft({ kind: 'CHI', category: 'TRA_VAY' })).ok).toBe(true);
  });

  test('danh mục không có trong danh sách thì bị chặn', () => {
    expect(kiemTraKhoan(draft({ category: 'KHONG_TON_TAI' })).ok).toBe(false);
  });
});
