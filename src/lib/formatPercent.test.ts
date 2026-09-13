import { describe, expect, test } from 'vitest';
import { formatPctBoDauTru } from './formatPercent';

describe('formatPctBoDauTru — bỏ dấu trừ, GIỮ dấu cộng', () => {
  test('số âm bỏ dấu trừ', () => {
    expect(formatPctBoDauTru(-38.7)).toBe('38.7%');
  });

  test('số dương GIỮ dấu cộng', () => {
    // Giữ '+' là thứ duy nhất còn phân biệt "đắt hơn ngưỡng" với "rẻ hơn ngưỡng"
    // sau khi bỏ dấu trừ. Bỏ nốt thì 38.7% và 144.1% nhìn như cùng loại.
    expect(formatPctBoDauTru(144.1)).toBe('+144.1%');
  });

  test('đúng 0 không mang dấu nào', () => {
    expect(formatPctBoDauTru(0)).toBe('0.0%');
  });

  test('làm tròn 1 chữ số thập phân', () => {
    expect(formatPctBoDauTru(-28.737)).toBe('28.7%');
    expect(formatPctBoDauTru(1.618)).toBe('+1.6%');
  });

  test('số âm rất nhỏ KHÔNG ra "-0.0%"', () => {
    // (-0.04).toFixed(1) === '-0.0' — cắt ký tự '-' bằng slice sẽ ra '0.0%',
    // nhưng nếu quên thì hiện ra '-0.0%' đúng cái dấu vừa bảo là bỏ.
    expect(formatPctBoDauTru(-0.04)).toBe('0.0%');
  });

  test('số dương rất nhỏ làm tròn về 0 thì không mang dấu cộng thừa', () => {
    // 0.04 làm tròn thành '0.0' — hiện '+0.0%' là nói dối rằng nó trên ngưỡng
    // một chút, trong khi hiển thị đã làm tròn về đúng 0.
    expect(formatPctBoDauTru(0.04)).toBe('0.0%');
  });
});
