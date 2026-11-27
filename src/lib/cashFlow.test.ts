import { describe, expect, test } from 'vitest';
import type { CashEntry } from '../types/cashEntry';
import {
  locTheoThang, moiNhatTruoc, nhanThang, thangCua, thangSau, thangTruoc, tongHop,
} from './cashFlow';

let dem = 0;
function khoan(over: Partial<CashEntry> = {}): CashEntry {
  dem += 1;
  return {
    id: `id${dem}`, user_id: 'u', occurred_on: '2026-09-10', kind: 'CHI',
    category: 'GIA_DINH', amount_vnd: 1_000_000, note: '',
    created_at: '', updated_at: '',
    ...over,
  };
}

describe('thangCua', () => {
  test('cắt ngày ISO thành tháng', () => {
    expect(thangCua('2026-09-13')).toBe('2026-09');
  });
});

describe('thangTruoc / thangSau', () => {
  test('lùi một tháng trong cùng năm', () => {
    expect(thangTruoc('2026-09')).toBe('2026-08');
  });

  test('lùi qua mốc tháng 1 thì sang năm trước', () => {
    expect(thangTruoc('2026-01')).toBe('2025-12');
  });

  test('tiến một tháng trong cùng năm', () => {
    expect(thangSau('2026-09')).toBe('2026-10');
  });

  test('tiến qua mốc tháng 12 thì sang năm sau', () => {
    expect(thangSau('2026-12')).toBe('2027-01');
  });

  test('luôn giữ 2 chữ số cho tháng', () => {
    expect(thangSau('2026-08')).toBe('2026-09');
    expect(thangTruoc('2026-11')).toBe('2026-10');
  });
});

describe('nhanThang', () => {
  test('hiện kiểu người Việt đọc, bỏ số 0 thừa', () => {
    expect(nhanThang('2026-09')).toBe('Tháng 9/2026');
    expect(nhanThang('2026-12')).toBe('Tháng 12/2026');
  });
});

describe('locTheoThang', () => {
  const ds = [
    khoan({ occurred_on: '2026-09-01' }),
    khoan({ occurred_on: '2026-08-31' }),
    khoan({ occurred_on: '2026-09-30' }),
    khoan({ occurred_on: '2025-09-15' }),
  ];

  test('chỉ lấy đúng tháng đang xem', () => {
    expect(locTheoThang(ds, '2026-09').map((e) => e.occurred_on))
      .toEqual(['2026-09-01', '2026-09-30']);
  });

  test('không lẫn cùng tháng của năm khác', () => {
    expect(locTheoThang(ds, '2026-09').some((e) => e.occurred_on.startsWith('2025'))).toBe(false);
  });

  test('tháng không có khoản nào trả mảng rỗng', () => {
    expect(locTheoThang(ds, '2026-07')).toEqual([]);
  });
});

describe('tongHop — đáo hạn thẻ KHÔNG vào tổng chi', () => {
  test('vòng tiền có tổng riêng, không cộng vào chi', () => {
    const t = tongHop([
      khoan({ kind: 'THU', category: 'LUONG', amount_vnd: 45_000_000 }),
      khoan({ kind: 'CHI', category: 'GIA_DINH', amount_vnd: 12_000_000 }),
      khoan({ kind: 'CHI', category: 'DAO_HAN_THE', amount_vnd: 50_000_000 }),
    ]);
    expect(t.thu).toBe(45_000_000);
    expect(t.chi).toBe(12_000_000);
    expect(t.vongTien).toBe(50_000_000);
  });

  test('còn lại = thu − chi, KHÔNG trừ vòng tiền', () => {
    const t = tongHop([
      khoan({ kind: 'THU', category: 'LUONG', amount_vnd: 45_000_000 }),
      khoan({ kind: 'CHI', category: 'GIA_DINH', amount_vnd: 12_000_000 }),
      khoan({ kind: 'CHI', category: 'DAO_HAN_THE', amount_vnd: 50_000_000 }),
    ]);
    // Trừ cả vòng tiền sẽ ra −17tr, báo động giả một khoản đã quay về ví.
    expect(t.conLai).toBe(33_000_000);
  });

  test('PHÍ đáo hạn LÀ chi thật, có cộng vào tổng chi', () => {
    const t = tongHop([
      khoan({ kind: 'CHI', category: 'DAO_HAN_THE', amount_vnd: 50_000_000 }),
      khoan({ kind: 'CHI', category: 'PHI_DAO_HAN', amount_vnd: 1_000_000 }),
    ]);
    expect(t.chi).toBe(1_000_000);
    expect(t.vongTien).toBe(50_000_000);
  });

  test('danh mục lạ vẫn cộng đúng chiều theo kind của bản ghi', () => {
    // `kind` đến từ DB nên vẫn tin được dù khoá danh mục đã bị bỏ khỏi code.
    const t = tongHop([khoan({ kind: 'THU', category: 'DANH_MUC_CU', amount_vnd: 3_000_000 })]);
    expect(t.thu).toBe(3_000_000);
    expect(t.chi).toBe(0);
  });

  test('tháng trắng cho ra 0 hết, không phải NaN', () => {
    expect(tongHop([])).toEqual({ thu: 0, chi: 0, vongTien: 0, dauTu: 0, conLai: 0, tyLeTietKiem: null });
  });

  test('chi nhiều hơn thu thì còn lại âm', () => {
    const t = tongHop([
      khoan({ kind: 'THU', category: 'LUONG', amount_vnd: 10_000_000 }),
      khoan({ kind: 'CHI', category: 'TRA_VAY', amount_vnd: 15_000_000 }),
    ]);
    expect(t.conLai).toBe(-5_000_000);
  });
});

describe('moiNhatTruoc', () => {
  test('xếp ngày mới nhất lên đầu', () => {
    const ds = [
      khoan({ occurred_on: '2026-09-03' }),
      khoan({ occurred_on: '2026-09-12' }),
      khoan({ occurred_on: '2026-09-07' }),
    ];
    expect(moiNhatTruoc(ds).map((e) => e.occurred_on))
      .toEqual(['2026-09-12', '2026-09-07', '2026-09-03']);
  });

  test('không làm đổi mảng gốc', () => {
    const ds = [khoan({ occurred_on: '2026-09-03' }), khoan({ occurred_on: '2026-09-12' })];
    const goc = ds.map((e) => e.occurred_on);
    moiNhatTruoc(ds);
    expect(ds.map((e) => e.occurred_on)).toEqual(goc);
  });
});

describe('tongHop — chuyển sang đầu tư là để dành, không phải chi', () => {
  test('DAU_TU tách riêng, không trừ vào còn lại; tỷ lệ tiết kiệm = (thu − chi)/thu', () => {
    const mk = (kind: 'THU' | 'CHI', category: string, amount_vnd: number) =>
      ({ id: category, user_id: 'u', occurred_on: '2026-11-05', kind, category, amount_vnd, note: '', created_at: '', updated_at: '' });
    const t = tongHop([mk('THU', 'LUONG', 40_000_000), mk('CHI', 'AN_UONG', 10_000_000), mk('CHI', 'DAU_TU', 15_000_000)]);
    expect(t.chi).toBe(10_000_000);
    expect(t.dauTu).toBe(15_000_000);
    expect(t.conLai).toBe(30_000_000);
    expect(t.tyLeTietKiem).toBeCloseTo(75);
  });
});

test('tiền đáo hạn quay về (THU vòng tiền) không cộng vào tổng thu', () => {
  const mk = (kind: 'THU' | 'CHI', category: string, amount_vnd: number) =>
    ({ id: category + kind, user_id: 'u', occurred_on: '2026-10-28', kind, category, amount_vnd, note: '', created_at: '', updated_at: '' });
  const t = tongHop([mk('THU', 'LUONG', 30_000_000), mk('THU', 'DAO_HAN_VE', 100_000_000), mk('CHI', 'DAO_HAN_THE', 100_000_000)]);
  expect(t.thu).toBe(30_000_000);
  expect(t.vongTien).toBe(200_000_000);
  expect(t.conLai).toBe(30_000_000);
});
