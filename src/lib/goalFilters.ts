import type { Horizon, ViewHorizon } from '../types/goal';
import type { Todo } from '../types/todo';

export interface PeriodRange {
  start: string; // 'YYYY-MM-DD'
  end: string; // 'YYYY-MM-DD'
}

function toDateString(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Thứ Hai (đầu tuần ISO, Mon=đầu tuần) chứa `date`. Không đổi `date` gốc. */
function isoWeekMonday(date: Date): Date {
  const d = new Date(date);
  const dayNum = (d.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  d.setUTCDate(d.getUTCDate() - dayNum);
  return d;
}

/** Năm ISO + số tuần ISO chứa `date` (thuật toán "Thứ Năm gần nhất"). */
function isoWeekOf(date: Date): { isoYear: number; week: number } {
  const d = new Date(date);
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // nhích tới Thứ Năm gần nhất
  const isoYear = d.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86400000));
  return { isoYear, week };
}

export function getPeriodRange(horizon: Horizon, periodKey: string): PeriodRange {
  switch (horizon) {
    case 'five_year': {
      const startYear = Number(periodKey);
      return { start: `${startYear}-01-01`, end: `${startYear + 4}-12-31` };
    }
    case 'year':
      return { start: `${periodKey}-01-01`, end: `${periodKey}-12-31` };
    case 'month': {
      const [y, m] = periodKey.split('-').map(Number);
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
      return { start: `${periodKey}-01`, end: `${periodKey}-${String(lastDay).padStart(2, '0')}` };
    }
    case 'week': {
      const [yearStr, weekStr] = periodKey.split('-W');
      const isoYear = Number(yearStr);
      const week = Number(weekStr);
      // Thứ Hai của tuần 1 ISO year = Thứ Hai chứa ngày 4/1 (04/01 luôn nằm trong tuần 1).
      const week1Monday = isoWeekMonday(new Date(Date.UTC(isoYear, 0, 4)));
      const monday = new Date(week1Monday);
      monday.setUTCDate(monday.getUTCDate() + (week - 1) * 7);
      const sunday = new Date(monday);
      sunday.setUTCDate(sunday.getUTCDate() + 6);
      return { start: toDateString(monday), end: toDateString(sunday) };
    }
  }
}

export function getPeriodKey(horizon: Horizon, date: string): string {
  switch (horizon) {
    case 'five_year': {
      const year = parseDate(date).getUTCFullYear();
      return String(Math.floor(year / 5) * 5);
    }
    case 'year':
      return date.slice(0, 4);
    case 'month':
      return date.slice(0, 7);
    case 'week': {
      const { isoYear, week } = isoWeekOf(parseDate(date));
      return `${isoYear}-W${String(week).padStart(2, '0')}`;
    }
  }
}

/** Period key cho tầng UI, trong đó tầng Ngày dùng chính date làm key. */
export function getViewPeriodKey(horizon: ViewHorizon, date: string): string {
  return horizon === 'day' ? date : getPeriodKey(horizon, date);
}

export function getChildPeriods(horizon: Horizon, periodKey: string): string[] {
  switch (horizon) {
    case 'five_year': {
      const startYear = Number(periodKey);
      return Array.from({ length: 5 }, (_, i) => String(startYear + i));
    }
    case 'year': {
      const year = Number(periodKey);
      return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
    }
    case 'month': {
      const [y, m] = periodKey.split('-').map(Number);
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
      return Array.from({ length: lastDay }, (_, i) => `${periodKey}-${String(i + 1).padStart(2, '0')}`);
    }
    case 'week': {
      const { start } = getPeriodRange('week', periodKey);
      const monday = parseDate(start);
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setUTCDate(d.getUTCDate() + i);
        return toDateString(d);
      });
    }
  }
}

export function countTodosInRange(todos: Todo[], start: string, end: string): { done: number; total: number } {
  const inRange = todos.filter((t) => t.due_date !== null && t.due_date >= start && t.due_date <= end);
  return { done: inRange.filter((t) => t.is_done).length, total: inRange.length };
}

export function shiftPeriod(horizon: Horizon, periodKey: string, delta: number): string {
  switch (horizon) {
    case 'five_year':
      return String(Number(periodKey) + delta * 5);
    case 'year':
      return String(Number(periodKey) + delta);
    case 'month': {
      const [y, m] = periodKey.split('-').map(Number);
      const total = y * 12 + (m - 1) + delta;
      const targetYear = Math.floor(total / 12);
      const targetMonth = ((total % 12) + 12) % 12;
      return `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`;
    }
    case 'week': {
      const { start } = getPeriodRange('week', periodKey);
      const monday = parseDate(start);
      monday.setUTCDate(monday.getUTCDate() + delta * 7);
      return getPeriodKey('week', toDateString(monday));
    }
  }
}
