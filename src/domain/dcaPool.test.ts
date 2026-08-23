import { describe, it, expect } from 'vitest';
import { monthlyPool } from './dcaPool';

describe('monthlyPool — ghép tiền góp hàng tháng với vốn DCA rải ra', () => {
  it('vốn 120tr rải 12 tháng ⇒ bổ sung 10tr, cộng với 3tr góp = 13tr', () => {
    const p = monthlyPool({ contributionVnd: 3_000_000, capitalVnd: 120_000_000, months: 12 });
    expect(p.contributionVnd).toBe(3_000_000);
    expect(p.dcaSliceVnd).toBe(10_000_000);
    expect(p.totalVnd).toBe(13_000_000);
    expect(p.lyDoKhongCoDca).toBeNull();
  });

  it('làm tròn XUỐNG về đồng — thà rải thiếu vài đồng hơn vượt vốn có thật', () => {
    const p = monthlyPool({ contributionVnd: 0, capitalVnd: 100_000_000, months: 7 });
    expect(p.dcaSliceVnd).toBe(14_285_714); // 100tr/7 = 14.285.714,28…
    expect(p.totalVnd).toBe(14_285_714);
  });

  it('có vốn mà CHƯA nhập số tháng ⇒ bổ sung 0 kèm lý do để UI nói ra', () => {
    const p = monthlyPool({ contributionVnd: 3_000_000, capitalVnd: 120_000_000, months: null });
    expect(p.dcaSliceVnd).toBe(0);
    expect(p.totalVnd).toBe(3_000_000);
    expect(p.lyDoKhongCoDca).toBe('chua-dat-thang');
  });

  it('số tháng = 0 ⇒ KHÔNG chia cho 0, không ra Infinity', () => {
    const p = monthlyPool({ contributionVnd: 3_000_000, capitalVnd: 120_000_000, months: 0 });
    expect(p.dcaSliceVnd).toBe(0);
    expect(p.totalVnd).toBe(3_000_000);
    expect(p.lyDoKhongCoDca).toBe('chua-dat-thang');
    expect(Number.isFinite(p.totalVnd)).toBe(true);
  });

  it('số tháng âm ⇒ cùng cách xử lý như chưa nhập, không sinh bổ sung âm', () => {
    const p = monthlyPool({ contributionVnd: 3_000_000, capitalVnd: 120_000_000, months: -6 });
    expect(p.dcaSliceVnd).toBe(0);
    expect(p.lyDoKhongCoDca).toBe('chua-dat-thang');
  });

  it('vốn = 0: số tháng nào cũng không sinh ra đồng nào, và KHÔNG coi là thiếu cấu hình', () => {
    const p = monthlyPool({ contributionVnd: 3_000_000, capitalVnd: 0, months: null });
    expect(p.dcaSliceVnd).toBe(0);
    expect(p.totalVnd).toBe(3_000_000);
    expect(p.lyDoKhongCoDca).toBeNull();
  });

  it('chưa cấu hình gì cả: pool = 0, không lỗi', () => {
    const p = monthlyPool({ contributionVnd: 0, capitalVnd: 0, months: null });
    expect(p.totalVnd).toBe(0);
    expect(p.lyDoKhongCoDca).toBeNull();
  });

  it('NaN ném lỗi tiếng Việt — pool sai làm CẢ kế hoạch sai mà vẫn trông bình thường', () => {
    expect(() => monthlyPool({ contributionVnd: NaN, capitalVnd: 0, months: 12 }))
      .toThrow(/Tiền góp hàng tháng không phải số tiền hợp lệ/);
    expect(() => monthlyPool({ contributionVnd: 0, capitalVnd: NaN, months: 12 }))
      .toThrow(/Vốn DCA không phải số tiền hợp lệ/);
  });

  it('số tiền âm ném lỗi', () => {
    expect(() => monthlyPool({ contributionVnd: -1, capitalVnd: 0, months: 12 })).toThrow();
    expect(() => monthlyPool({ contributionVnd: 0, capitalVnd: -1, months: 12 })).toThrow();
  });
});
