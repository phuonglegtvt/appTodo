import { describe, expect, test } from 'vitest';
import { nextSort, sortRows, type SortState } from './tableSort';

type Khoa = 'gia' | 'ten';

interface Dong {
  ten: string;
  gia: number | null;
}

/** Lấy giá trị so sánh của một ô — khuôn mà 3 bảng thật sẽ tự khai báo. */
const layGiaTri = (d: Dong, k: Khoa) => (k === 'gia' ? d.gia : d.ten);

const ten = (ds: Dong[]) => ds.map((d) => d.ten).join(',');

describe('nextSort — vòng bấm tiêu đề cột', () => {
  test('chưa sort, bấm một cột thì sort tăng dần', () => {
    expect(nextSort<Khoa>(null, 'gia')).toEqual({ key: 'gia', dir: 'asc' });
  });

  test('đang tăng dần, bấm lại cùng cột thì đổi sang giảm dần', () => {
    expect(nextSort<Khoa>({ key: 'gia', dir: 'asc' }, 'gia')).toEqual({ key: 'gia', dir: 'desc' });
  });

  test('đang giảm dần, bấm lần thứ ba thì tắt sort về thứ tự gốc', () => {
    expect(nextSort<Khoa>({ key: 'gia', dir: 'desc' }, 'gia')).toBeNull();
  });

  test('bấm sang cột khác thì bắt đầu lại từ tăng dần', () => {
    expect(nextSort<Khoa>({ key: 'gia', dir: 'desc' }, 'ten')).toEqual({ key: 'ten', dir: 'asc' });
  });
});

describe('sortRows — số', () => {
  const ds: Dong[] = [
    { ten: 'b', gia: 30 },
    { ten: 'a', gia: 10 },
    { ten: 'c', gia: 20 },
  ];

  test('tăng dần xếp số nhỏ lên trước', () => {
    expect(ten(sortRows(ds, { key: 'gia', dir: 'asc' }, layGiaTri))).toBe('a,c,b');
  });

  test('giảm dần xếp số lớn lên trước', () => {
    expect(ten(sortRows(ds, { key: 'gia', dir: 'desc' }, layGiaTri))).toBe('b,c,a');
  });

  test('số âm xếp theo giá trị, không theo chuỗi hiển thị', () => {
    // Sort theo chuỗi thì '-38.7' < '-9.1' (sai). Theo số thì −38.7 < −9.1 (đúng).
    const pct: Dong[] = [
      { ten: 'ít', gia: -9.1 },
      { ten: 'nhiều', gia: -38.7 },
    ];
    expect(ten(sortRows(pct, { key: 'gia', dir: 'asc' }, layGiaTri))).toBe('nhiều,ít');
  });
});

describe('sortRows — ô trống (null = CHƯA NHẬP, không phải 0)', () => {
  const ds: Dong[] = [
    { ten: 'trống', gia: null },
    { ten: 'to', gia: 50 },
    { ten: 'nhỏ', gia: 5 },
  ];

  test('tăng dần: ô trống xuống cuối, không chen lên đầu như số 0', () => {
    expect(ten(sortRows(ds, { key: 'gia', dir: 'asc' }, layGiaTri))).toBe('nhỏ,to,trống');
  });

  test('giảm dần: ô trống VẪN ở cuối, không lật lên đầu', () => {
    expect(ten(sortRows(ds, { key: 'gia', dir: 'desc' }, layGiaTri))).toBe('to,nhỏ,trống');
  });

  test('nhiều ô trống giữ nguyên thứ tự gốc với nhau', () => {
    const nhieu: Dong[] = [
      { ten: 'trống1', gia: null },
      { ten: 'có', gia: 1 },
      { ten: 'trống2', gia: null },
    ];
    expect(ten(sortRows(nhieu, { key: 'gia', dir: 'asc' }, layGiaTri))).toBe('có,trống1,trống2');
  });
});

describe('sortRows — chuỗi tiếng Việt', () => {
  test('xếp theo bảng chữ cái tiếng Việt, chữ có dấu không bị đẩy xuống cuối', () => {
    const ds: Dong[] = [
      { ten: 'Bình', gia: 1 },
      { ten: 'Á Châu', gia: 2 },
      { ten: 'An', gia: 3 },
      { ten: 'Ánh', gia: 4 },
    ];
    // So sánh code-point cho ra 'An,Bình,Á Châu,Ánh' — sai.
    expect(ten(sortRows(ds, { key: 'ten', dir: 'asc' }, layGiaTri))).toBe('Á Châu,An,Ánh,Bình');
  });

  test('không phân biệt hoa thường', () => {
    const ds: Dong[] = [
      { ten: 'beta', gia: 1 },
      { ten: 'Alpha', gia: 2 },
    ];
    expect(ten(sortRows(ds, { key: 'ten', dir: 'asc' }, layGiaTri))).toBe('Alpha,beta');
  });
});

describe('sortRows — an toàn', () => {
  const ds: Dong[] = [
    { ten: 'b', gia: 2 },
    { ten: 'a', gia: 1 },
  ];

  test('state null thì giữ nguyên thứ tự gốc', () => {
    expect(ten(sortRows(ds, null, layGiaTri))).toBe('b,a');
  });

  test('không làm đổi mảng gốc', () => {
    const goc: Dong[] = [...ds];
    sortRows(ds, { key: 'gia', dir: 'asc' }, layGiaTri);
    expect(ds).toEqual(goc);
  });

  test('sort ổn định: hai dòng cùng giá trị giữ nguyên thứ tự tương đối', () => {
    const bang: Dong[] = [
      { ten: 'đầu', gia: 7 },
      { ten: 'giữa', gia: 7 },
      { ten: 'cuối', gia: 7 },
    ];
    const state: SortState<Khoa> = { key: 'gia', dir: 'desc' };
    expect(ten(sortRows(bang, state, layGiaTri))).toBe('đầu,giữa,cuối');
  });
});
