import { describe, it, expect } from 'vitest';
import { drawdownFromPeakPct, gapToPricePct, nextPeak } from './peakDrawdown';

describe('drawdownFromPeakPct', () => {
  it('giá dưới đỉnh: trả số ÂM (đang giảm bao nhiêu % so với đỉnh)', () => {
    // ACB: đỉnh 35, hiện tại 22,75 ⇒ (22,75 − 35) / 35 = −35%
    expect(drawdownFromPeakPct(22.75, 35)).toBeCloseTo(-35, 10);
  });

  it('giá bằng đỉnh: 0%', () => {
    expect(drawdownFromPeakPct(35, 35)).toBe(0);
  });

  it('giá VƯỢT đỉnh đang lưu: trả số DƯƠNG, không kẹp về 0', () => {
    // Ca thật: vừa lập đỉnh mới mà cột đỉnh chưa kịp cập nhật. Kẹp về 0 sẽ che
    // mất chuyện dữ liệu đỉnh đã cũ.
    expect(drawdownFromPeakPct(42, 35)).toBeCloseTo(20, 10);
  });

  it('thiếu giá hiện tại hoặc thiếu đỉnh ⇒ null, KHÔNG phải 0%', () => {
    expect(drawdownFromPeakPct(null, 35)).toBeNull();
    expect(drawdownFromPeakPct(22.75, null)).toBeNull();
    expect(drawdownFromPeakPct(null, null)).toBeNull();
  });

  it('đỉnh = 0 hoặc âm ⇒ null (không chia cho 0, không trả số vô nghĩa)', () => {
    expect(drawdownFromPeakPct(22.75, 0)).toBeNull();
    expect(drawdownFromPeakPct(22.75, -35)).toBeNull();
  });

  it('NaN / Infinity ⇒ null (không để lọt vào phép chia)', () => {
    expect(drawdownFromPeakPct(NaN, 35)).toBeNull();
    expect(drawdownFromPeakPct(22.75, NaN)).toBeNull();
    expect(drawdownFromPeakPct(Infinity, 35)).toBeNull();
  });
});

describe('nextPeak', () => {
  it('lấy số lớn nhất trong các ứng viên', () => {
    expect(nextPeak(30, 35, 22)).toBe(35);
  });

  it('chưa có đỉnh nào: giá hiện tại chính là đỉnh biết được', () => {
    expect(nextPeak(null, null, 22.75)).toBe(22.75);
  });

  it('API trả thiếu KHÔNG kéo đỉnh đang lưu xuống', () => {
    expect(nextPeak(35, null, 22)).toBe(35);
  });

  it('đỉnh nhập tay cao hơn đỉnh API: giữ đỉnh nhập tay', () => {
    // Lý do cột này cho sửa tay: dchart có thể thiếu lịch sử / chưa điều chỉnh
    // chia tách. Người dùng gõ đè rồi thì lần cập nhật sau không được đạp xuống.
    expect(nextPeak(60, 35, 22)).toBe(60);
  });

  it('không ứng viên nào hợp lệ ⇒ null', () => {
    expect(nextPeak(null, null, null)).toBeNull();
  });

  it('bỏ qua NaN, Infinity và undefined', () => {
    expect(nextPeak(35, NaN, 22)).toBe(35);
    expect(nextPeak(NaN, Infinity, undefined)).toBeNull();
  });

  it('bỏ qua số 0 và số âm — giá ≤ 0 không phải một đỉnh', () => {
    expect(nextPeak(0, null, 10)).toBe(10);
    expect(nextPeak(-5, null, null)).toBeNull();
  });
});

describe('gapToPricePct — còn cách mốc giá bao nhiêu %', () => {
  it('giá CAO hơn mốc: số dương = còn phải giảm bấy nhiêu % mới về mốc', () => {
    // MSB: ngưỡng 14,5 — hiện tại 15,9 ⇒ +9,7%, tức chưa đáng mua
    expect(gapToPricePct(15.9, 14.5)).toBeCloseTo(9.66, 1);
  });

  it('giá THẤP hơn mốc: số âm = đã qua mốc bấy nhiêu %', () => {
    // ACB: ngưỡng 30,1 — hiện tại 22,75 ⇒ −24,4%, đã dưới ngưỡng khá sâu
    expect(gapToPricePct(22.75, 30.1)).toBeCloseTo(-24.4, 1);
  });

  it('giá bằng mốc: 0%', () => {
    expect(gapToPricePct(30.1, 30.1)).toBe(0);
  });

  it('thiếu giá hoặc thiếu mốc ⇒ null, KHÔNG phải 0%', () => {
    expect(gapToPricePct(null, 30.1)).toBeNull();
    expect(gapToPricePct(22.75, null)).toBeNull();
  });

  it('mốc ≤ 0 hoặc NaN ⇒ null, không chia cho 0', () => {
    expect(gapToPricePct(22.75, 0)).toBeNull();
    expect(gapToPricePct(22.75, NaN)).toBeNull();
    expect(gapToPricePct(NaN, 30.1)).toBeNull();
  });
});
