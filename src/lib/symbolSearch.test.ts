import { describe, it, expect } from 'vitest';
import { boDau, parseDchartSearch, parseBinanceUsdtBases, xepHang, timTaiCho, type SymbolOption } from './symbolSearch';

describe('boDau', () => {
  it('bỏ dấu và đ', () => {
    expect(boDau('Quỹ Đầu tư Cổ phiếu')).toBe('quy dau tu co phieu');
  });
});

describe('parseDchartSearch', () => {
  it('giữ cổ phiếu/ETF/chỉ số, bỏ phái sinh và chứng quyền', () => {
    const r = parseDchartSearch([
      { symbol: 'VN30', description: 'VN30', type: 'CHỈ SỐ' },
      { symbol: 'VN30F2512', description: 'HĐTL', type: 'HĐ TƯƠNG LAI' },
      { symbol: 'CFPT2501', description: 'CW', type: 'CHỨNG QUYỀN' },
      { symbol: 'E1VFVN30', description: 'Quỹ ETF', type: 'QUỸ HOÁN ĐỔI DM' },
      { symbol: 'fpt', description: 'CTCP FPT', type: 'CỔ PHIẾU' },
    ]);
    expect(r.map((o) => [o.symbol, o.typeLabel])).toEqual([['VN30', 'Chỉ số'], ['E1VFVN30', 'ETF'], ['FPT', 'Cổ phiếu']]);
  });
  it('không phải mảng ⇒ ném lỗi', () => {
    expect(() => parseDchartSearch({})).toThrow();
  });
});

describe('parseBinanceUsdtBases', () => {
  it('chỉ lấy cặp USDT, bỏ trùng', () => {
    expect(parseBinanceUsdtBases([{ symbol: 'BTCUSDT' }, { symbol: 'ETHBTC' }, { symbol: 'ETHUSDT' }, { symbol: 'USDT' }]))
      .toEqual(['BTC', 'ETH']);
  });
});

describe('xepHang', () => {
  const opts: SymbolOption[] = ['VLC', 'VIC', 'V', 'VCB', 'VCBF'].map((s) => ({ kind: 'vn', symbol: s, name: s, typeLabel: 'Cổ phiếu' }));
  it('trùng khít trước, rồi tiền tố ngắn trước', () => {
    expect(xepHang('vcb', opts).map((o) => o.symbol)).toEqual(['VCB', 'VCBF']);
    expect(xepHang('v', opts)[0].symbol).toBe('V');
  });
  it('chuỗi rỗng ⇒ không gợi ý', () => {
    expect(xepHang('  ', opts)).toEqual([]);
  });
});

describe('timTaiCho', () => {
  it('tìm quỹ theo tên không dấu, crypto theo mã', () => {
    const funds = [{ id: 23, shortName: 'VESAF', name: 'Quỹ Đầu tư Cổ phiếu Tiếp cận Thị trường VinaCapital' }];
    expect(timTaiCho('tiep can', [], funds).map((o) => o.symbol)).toEqual(['VESAF']);
    expect(timTaiCho('bt', ['BTC', 'BTTC', 'ETH'], []).map((o) => o.symbol)).toEqual(['BTC', 'BTTC']);
  });
});
