import { describe, it, expect } from 'vitest';
import { resolveInitialTheme } from './theme';

describe('resolveInitialTheme', () => {
  it('ưu tiên giá trị đã lưu là "dark"', () => {
    expect(resolveInitialTheme('dark', false)).toBe('dark');
  });
  it('ưu tiên giá trị đã lưu là "light"', () => {
    expect(resolveInitialTheme('light', true)).toBe('light');
  });
  it('chưa lưu thì theo hệ điều hành (prefersDark = true → dark)', () => {
    expect(resolveInitialTheme(null, true)).toBe('dark');
  });
  it('chưa lưu và không thích dark → light', () => {
    expect(resolveInitialTheme(null, false)).toBe('light');
  });
  it('giá trị lưu rác thì coi như chưa lưu', () => {
    expect(resolveInitialTheme('bogus', true)).toBe('dark');
  });
});
