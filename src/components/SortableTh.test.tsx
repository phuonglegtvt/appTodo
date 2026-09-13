// Ô tiêu đề bấm được. Test tập trung vào thứ thấy được và thứ screen reader
// đọc được — không test class Tailwind.

import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SortableTh } from './SortableTh';
import type { SortState } from '../lib/tableSort';

type K = 'gia' | 'ten';

function ve(sort: SortState<K> | null, onSort = vi.fn()) {
  render(
    <table><thead><tr>
      <SortableTh colKey={'gia' as K} label="Giá ngưỡng" sort={sort} onSort={onSort} />
    </tr></thead></table>,
  );
  return onSort;
}

describe('SortableTh', () => {
  test('hiện nhãn cột', () => {
    ve(null);
    expect(screen.getByRole('button', { name: /Giá ngưỡng/ })).toBeInTheDocument();
  });

  test('chưa sort thì aria-sort là none', () => {
    ve(null);
    expect(screen.getByRole('columnheader')).toHaveAttribute('aria-sort', 'none');
  });

  test('đang sort tăng dần thì aria-sort là ascending', () => {
    ve({ key: 'gia', dir: 'asc' });
    expect(screen.getByRole('columnheader')).toHaveAttribute('aria-sort', 'ascending');
  });

  test('đang sort giảm dần thì aria-sort là descending', () => {
    ve({ key: 'gia', dir: 'desc' });
    expect(screen.getByRole('columnheader')).toHaveAttribute('aria-sort', 'descending');
  });

  test('cột KHÁC đang được sort thì cột này vẫn là none', () => {
    ve({ key: 'ten', dir: 'asc' });
    expect(screen.getByRole('columnheader')).toHaveAttribute('aria-sort', 'none');
  });

  test('bấm vào tiêu đề thì báo đúng khoá cột', () => {
    const onSort = ve(null);
    screen.getByRole('button').click();
    expect(onSort).toHaveBeenCalledWith('gia');
  });

  test('cột CHƯA sort vẫn hiện icon, để biết cột này bấm được', () => {
    // Chỉ hiện mũi tên ở cột đang sort thì người dùng không biết những cột kia
    // cũng bấm được — phải dò từng cột mới biết.
    ve(null);
    expect(screen.getByRole('button').textContent).toMatch(/↕/);
  });

  test('cột đang tăng dần hiện ↑', () => {
    ve({ key: 'gia', dir: 'asc' });
    const chu = screen.getByRole('button').textContent ?? '';
    expect(chu).toMatch(/↑/);
    expect(chu).not.toMatch(/↕/);
  });

  test('cột đang giảm dần hiện ↓', () => {
    ve({ key: 'gia', dir: 'desc' });
    const chu = screen.getByRole('button').textContent ?? '';
    expect(chu).toMatch(/↓/);
    expect(chu).not.toMatch(/↕/);
  });

  test('cột KHÁC đang sort thì cột này quay về icon trung tính', () => {
    ve({ key: 'ten', dir: 'asc' });
    expect(screen.getByRole('button').textContent).toMatch(/↕/);
  });
});
