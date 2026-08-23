import { describe, it, expect } from 'vitest';
import { evaluateCrashReserve, DEFAULT_CRASH_LEVELS } from './crashReserve';
import type { CrashEventRecord } from './types';

const EPISODE_START = '2026-06-01';
const RESERVE = 100_000_000;

function check(
  drawdownPct: number,
  over: { cashReserveVnd?: number; history?: CrashEventRecord[] } = {},
) {
  return evaluateCrashReserve({
    portfolioDrawdownPct: drawdownPct,
    currentEpisodeStart: EPISODE_START,
    cashReserveVnd: over.cashReserveVnd ?? RESERVE,
    levels: DEFAULT_CRASH_LEVELS,
    history: over.history ?? [],
  });
}

describe('DEFAULT_CRASH_LEVELS', () => {
  it('5 bậc, tổng đúng 100% (bậc 5 dùng phần còn lại)', () => {
    expect(DEFAULT_CRASH_LEVELS).toHaveLength(5);
    const total = DEFAULT_CRASH_LEVELS.reduce((s, l) => s + l.deployPctOfReserve, 0);
    expect(total).toBe(100);
  });

  it('ngưỡng sụt giảm đúng §8: 15/25/35/45/55', () => {
    expect(DEFAULT_CRASH_LEVELS.map((l) => l.drawdownPct)).toEqual([15, 25, 35, 45, 55]);
  });
});

describe('evaluateCrashReserve — chưa tới ngưỡng', () => {
  const r = check(3.2);

  it('không bậc nào kích hoạt', () => {
    expect(r.triggeredLevels).toEqual([]);
    expect(r.totalDeployVnd).toBe(0);
  });

  it('cho biết bậc kế tiếp còn cách bao nhiêu (để UI hiện)', () => {
    expect(r.nextLevel).toEqual({ level: 1, drawdownPct: 15, gapPp: 11.8 });
  });

  it('chụp ảnh reserve của đợt = số dư hiện tại (đợt chưa có sự kiện nào)', () => {
    expect(r.reserveAtEpisodeStartVnd).toBe(RESERVE);
  });
});

describe('evaluateCrashReserve — kích hoạt lần đầu', () => {
  it('sụt 18% → chỉ bậc 1, giải ngân 10% của 100tr = 10tr', () => {
    const r = check(18);
    expect(r.triggeredLevels).toEqual([{ level: 1, drawdownPct: 15, deployVnd: 10_000_000 }]);
    expect(r.totalDeployVnd).toBe(10_000_000);
    expect(r.nextLevel).toEqual({ level: 2, drawdownPct: 25, gapPp: 7 });
  });

  it('sụt 28% (nhảy hai bậc cùng lúc) → bậc 1 + bậc 2 = 25tr', () => {
    const r = check(28);
    expect(r.triggeredLevels.map((t) => t.level)).toEqual([1, 2]);
    expect(r.totalDeployVnd).toBe(25_000_000);
  });

  it('sụt 60% → cả 5 bậc, tổng đúng bằng toàn bộ reserve', () => {
    const r = check(60);
    expect(r.triggeredLevels.map((t) => t.level)).toEqual([1, 2, 3, 4, 5]);
    expect(r.totalDeployVnd).toBe(100_000_000);
    expect(r.nextLevel).toBeNull();
  });
});

describe('evaluateCrashReserve — bậc đã dùng trong CÙNG đợt', () => {
  const usedLevel1History: CrashEventRecord[] = [
    { level: 1, episodeStart: EPISODE_START, reserveAtEpisodeStartVnd: 100_000_000 },
  ];

  it('không kích hoạt lại bậc 1 (không lải nhải mỗi tháng)', () => {
    const r = check(28, { history: usedLevel1History });
    expect(r.triggeredLevels.map((t) => t.level)).toEqual([2]);
  });

  it('% TÍNH TRÊN SỐ DƯ LÚC ĐỢT BẮT ĐẦU (100tr), không phải số dư hiện tại (90tr)', () => {
    // Đây là điểm §8 bỏ trống. Tính trên 90tr sẽ ra 13,5tr — sai.
    const r = check(28, { history: usedLevel1History, cashReserveVnd: 90_000_000 });
    expect(r.reserveAtEpisodeStartVnd).toBe(100_000_000);
    expect(r.triggeredLevels).toEqual([{ level: 2, drawdownPct: 25, deployVnd: 15_000_000 }]);
  });
});

describe('evaluateCrashReserve — đợt MỚI thì reset 5 bậc', () => {
  it('lịch sử thuộc đợt cũ → bậc 1 kích hoạt lại được', () => {
    const oldEpisodeHistory: CrashEventRecord[] = [
      { level: 1, episodeStart: '2025-03-01', reserveAtEpisodeStartVnd: 50_000_000 },
      { level: 2, episodeStart: '2025-03-01', reserveAtEpisodeStartVnd: 50_000_000 },
    ];
    const r = check(18, { history: oldEpisodeHistory });
    expect(r.triggeredLevels.map((t) => t.level)).toEqual([1]);
    // Đợt mới ⇒ chụp ảnh lại theo số dư hiện tại, không dùng 50tr của đợt cũ.
    expect(r.reserveAtEpisodeStartVnd).toBe(RESERVE);
  });
});

describe('evaluateCrashReserve — không giải ngân quá số tiền đang có', () => {
  it('reserve 50tr nhưng các bậc còn lại đòi hơn thế → cắt đúng ở 50tr', () => {
    // Đợt này đã dùng bậc 1 với mốc chụp ảnh 100tr, nhưng ví hiện chỉ còn 50tr.
    // ⇒ bậc 2 và 3 đủ tiền (15tr + 20tr = 35tr), bậc 4 đòi 25tr mà chỉ còn 15tr
    // nên BỊ CẮT, bậc 5 hết tiền.
    const usedLevel1History: CrashEventRecord[] = [
      { level: 1, episodeStart: EPISODE_START, reserveAtEpisodeStartVnd: 100_000_000 },
    ];
    const r = check(60, { cashReserveVnd: 50_000_000, history: usedLevel1History });
    expect(r.reserveAtEpisodeStartVnd).toBe(100_000_000);
    expect(r.triggeredLevels.map((t) => t.level)).toEqual([2, 3, 4, 5]);
    expect(r.triggeredLevels.map((t) => t.deployVnd))
      .toEqual([15_000_000, 20_000_000, 15_000_000, 0]);
    expect(r.totalDeployVnd).toBe(50_000_000);
  });

  it('reserve = 0 → vẫn BÁO bậc đã đạt nhưng giải ngân 0, không nuốt im lặng', () => {
    const r = check(18, { cashReserveVnd: 0 });
    expect(r.triggeredLevels).toEqual([{ level: 1, drawdownPct: 15, deployVnd: 0 }]);
    expect(r.totalDeployVnd).toBe(0);
  });
});

describe('evaluateCrashReserve — biên', () => {
  it('sụt đúng bằng ngưỡng (15%) thì kích hoạt (bao gồm biên)', () => {
    expect(check(15).triggeredLevels.map((t) => t.level)).toEqual([1]);
  });

  it('sụt 14,9% thì chưa', () => {
    expect(check(14.9).triggeredLevels).toEqual([]);
  });

  it('danh sách bậc rỗng → không kích hoạt gì, nextLevel null', () => {
    const r = evaluateCrashReserve({
      portfolioDrawdownPct: 60, currentEpisodeStart: EPISODE_START,
      cashReserveVnd: RESERVE, levels: [], history: [],
    });
    expect(r.triggeredLevels).toEqual([]);
    expect(r.nextLevel).toBeNull();
  });

  it('bậc truyền vào không theo thứ tự vẫn xử lý đúng từ thấp lên cao', () => {
    const shuffled = [...DEFAULT_CRASH_LEVELS].reverse();
    const r = evaluateCrashReserve({
      portfolioDrawdownPct: 28, currentEpisodeStart: EPISODE_START,
      cashReserveVnd: RESERVE, levels: shuffled, history: [],
    });
    expect(r.triggeredLevels.map((t) => t.level)).toEqual([1, 2]);
  });
});
