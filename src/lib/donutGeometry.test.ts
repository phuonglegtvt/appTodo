// Hình học biểu đồ tròn — hàm thuần, không React, không SVG thật.
// Tách khỏi component để test được phần dễ sai nhất: góc, khe hở, và ca 100%.

import { describe, it, expect } from 'vitest';
import { donutSegments, arcPath } from './donutGeometry';

const OPTS = { radius: 100, innerRadius: 62, gapDeg: 2 };

describe('donutSegments — chia góc theo tỷ trọng', () => {
  it('hai phần bằng nhau → mỗi phần 50%', () => {
    const segs = donutSegments([50, 50], OPTS);
    expect(segs).toHaveLength(2);
    expect(segs[0].fractionPct).toBe(50);
    expect(segs[1].fractionPct).toBe(50);
  });

  it('tổng góc quét + tổng khe hở = đúng 360°', () => {
    const segs = donutSegments([60, 30, 10], OPTS);
    const tongQuet = segs.reduce((s, g) => s + (g.endAngle - g.startAngle), 0);
    expect(tongQuet + segs.length * OPTS.gapDeg).toBeCloseTo(360, 9);
  });

  it('bắt đầu từ 12 giờ và chạy theo chiều kim đồng hồ', () => {
    const segs = donutSegments([60, 30, 10], OPTS);
    expect(segs[0].startAngle).toBeCloseTo(OPTS.gapDeg / 2, 9);
    expect(segs[1].startAngle).toBeGreaterThan(segs[0].endAngle);
  });
});

describe('donutSegments — ca biên mà biểu đồ tròn thường vẽ sai', () => {
  it('tổng = 0 → KHÔNG vẽ gì, không sinh NaN', () => {
    expect(donutSegments([0, 0, 0], OPTS)).toEqual([]);
  });

  it('mảng rỗng → không vẽ gì', () => {
    expect(donutSegments([], OPTS)).toEqual([]);
  });

  it('bỏ qua phần bằng 0 — không vẽ lát vô hình chiếm khe hở', () => {
    const segs = donutSegments([100, 0, 0], OPTS);
    expect(segs).toHaveLength(1);
  });

  it('một phần chiếm 100% → đánh dấu isFullCircle (path arc không vẽ nổi vòng kín)', () => {
    // Cung SVG 360° có điểm đầu trùng điểm cuối ⇒ trình duyệt vẽ ra RỖNG.
    // Component phải đổi sang <circle>, nên hình học phải nói ra ca này.
    const segs = donutSegments([100], OPTS);
    expect(segs).toHaveLength(1);
    expect(segs[0].isFullCircle).toBe(true);
    expect(segs[0].fractionPct).toBe(100);
  });

  it('nhiều phần thì không phần nào là vòng kín', () => {
    const segs = donutSegments([99, 1], OPTS);
    expect(segs.every((s) => !s.isFullCircle)).toBe(true);
  });

  it('giá trị âm → ném lỗi, không vẽ ngược chiều im lặng', () => {
    expect(() => donutSegments([-10, 50], OPTS)).toThrow(/âm/);
  });

  it('giá trị NaN → ném lỗi (NaN làm mọi góc thành NaN)', () => {
    expect(() => donutSegments([NaN, 50], OPTS)).toThrow(/không phải số/);
  });
});

describe('donutSegments — lát quá nhỏ so với khe hở', () => {
  it('không sinh góc quét âm khi lát nhỏ hơn cả khe hở', () => {
    // 3 lát, khe 2° mỗi lát: lát 0,1% chỉ được 0,36° < 2°. Nếu trừ thẳng khe
    // sẽ ra góc âm ⇒ cung vẽ ngược. Phải kẹp về 0, không được âm.
    const segs = donutSegments([99.8, 0.1, 0.1], OPTS);
    expect(segs.every((s) => s.endAngle >= s.startAngle)).toBe(true);
  });
});

describe('arcPath — chuỗi path SVG', () => {
  it('sinh path hình vành khuyên có đủ hai cung và lệnh đóng', () => {
    const d = arcPath(0, 90, 100, 62);
    expect(d).toMatch(/^M /);
    expect(d.match(/A /g)).toHaveLength(2);
    expect(d.trimEnd().endsWith('Z')).toBe(true);
  });

  it('cung > 180° dùng cờ large-arc = 1', () => {
    const nho = arcPath(0, 90, 100, 62);
    const to = arcPath(0, 270, 100, 62);
    expect(nho).toContain(' 0 0 1 ');
    expect(to).toContain(' 1 1 ');
  });

  it('không sinh NaN trong path', () => {
    const d = arcPath(0, 137.5, 100, 62);
    expect(d).not.toMatch(/NaN/);
  });
});
