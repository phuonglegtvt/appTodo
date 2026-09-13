// Test dòng thu–chi: quy tắc "vòng tiền" (đáo hạn thẻ) phải nhìn thấy được
// ngay trên dòng, không chỉ đúng trong phép tính tổng.

import { describe, expect, test, vi } from 'vitest';
import { render } from '@testing-library/react';
import { CashEntryRow } from './CashEntryRow';
import type { CashEntry } from '../types/cashEntry';

function khoan(over: Partial<CashEntry> = {}): CashEntry {
  return {
    id: 'e1', user_id: 'u', occurred_on: '2026-09-13', kind: 'CHI',
    category: 'GIA_DINH', amount_vnd: 12_000_000, note: '', created_at: '', updated_at: '',
    ...over,
  };
}

function ve(e: CashEntry) {
  const { container } = render(
    <table><tbody>
      <CashEntryRow entry={e} onUpdate={vi.fn()} onDelete={vi.fn()} />
    </tbody></table>,
  );
  return container.textContent ?? '';
}

describe('CashEntryRow — chiều tiền', () => {
  test('khoản thu hiện dấu cộng', () => {
    expect(ve(khoan({ kind: 'THU', category: 'LUONG', amount_vnd: 45_000_000 })))
      .toContain('+45.000.000 đ');
  });

  test('khoản chi hiện dấu trừ', () => {
    expect(ve(khoan({ kind: 'CHI', category: 'GIA_DINH' }))).toContain('−12.000.000 đ');
  });
});

describe('CashEntryRow — đáo hạn thẻ là vòng tiền', () => {
  test('hiện ký hiệu ⟳ chứ KHÔNG hiện dấu trừ', () => {
    // Dấu trừ nói "mất tiền". Đáo hạn thẻ tiền quay về ví nên không được mang
    // dấu trừ, nếu không người đọc tưởng tháng này chi thêm 50tr.
    const chu = ve(khoan({ category: 'DAO_HAN_THE', amount_vnd: 50_000_000 }));
    expect(chu).toContain('⟳');
    expect(chu).not.toContain('−50.000.000');
  });

  test('PHÍ đáo hạn vẫn là chi thật, có dấu trừ', () => {
    const chu = ve(khoan({ category: 'PHI_DAO_HAN', amount_vnd: 1_000_000 }));
    expect(chu).toContain('−1.000.000 đ');
  });
});

describe('CashEntryRow — dữ liệu thiếu', () => {
  test('không có ghi chú hiện gạch ngang, không để trống', () => {
    expect(ve(khoan({ note: '' }))).toContain('—');
  });

  test('danh mục cũ đã bỏ khỏi code vẫn hiện thẳng khoá, không hiện trống', () => {
    expect(ve(khoan({ category: 'DANH_MUC_CU' }))).toContain('DANH_MUC_CU');
  });

  test('hiện ngày dạng ngày/tháng, không lệch ngày do múi giờ', () => {
    // Dựng Date từ '2026-09-01' rồi lấy getDate() cho ra 31/08 ở giờ VN.
    expect(ve(khoan({ occurred_on: '2026-09-01' }))).toContain('01/09');
  });
});
