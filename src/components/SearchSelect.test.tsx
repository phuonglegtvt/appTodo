import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchSelect } from './SearchSelect';

const options = [
  { value: '1', symbol: 'ACB', name: 'Ngân hàng TMCP Á Châu' },
  { value: '2', symbol: 'HPG', name: 'Công ty Cổ phần Tập đoàn Hòa Phát' },
  { value: '3', symbol: 'HND', name: 'Nhiệt điện Hải Phòng' },
];

function setup(value = '') {
  const onChange = vi.fn();
  render(<SearchSelect options={options} value={value} onChange={onChange} ariaLabel="Mã" className="" />);
  return { onChange, input: screen.getByRole('combobox', { name: 'Mã' }) };
}

describe('SearchSelect', () => {
  it('bấm vào hiện toàn bộ danh sách', () => {
    const { input } = setup();
    fireEvent.focus(input);
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('gõ tiền tố mã thì lọc, Enter chọn mục đầu', () => {
    const { input, onChange } = setup();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'h' } });
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      expect.stringContaining('HND'), expect.stringContaining('HPG'),
    ]);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('2');
  });

  it('tìm theo tên không dấu', () => {
    const { input, onChange } = setup();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'hoa phat' } });
    fireEvent.mouseDown(screen.getByRole('option'));
    expect(onChange).toHaveBeenCalledWith('2');
  });

  it('rời ô khi chưa chọn thì vẫn hiện mã đang chọn', () => {
    const { input } = setup('1');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'zzz' } });
    fireEvent.blur(input);
    expect((input as HTMLInputElement).value).toBe('ACB');
  });
});
