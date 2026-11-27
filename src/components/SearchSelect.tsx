import { useId, useRef, useState } from 'react';
import { xepHang } from '../lib/symbolSearch';

// Ô chọn có tìm kiếm cho một danh sách CÓ SẴN (không gọi mạng) — thay cho
// <select> khi danh sách dài như ~60 mã cổ phiếu đang theo dõi.
//
// - Bấm vào: hiện toàn bộ danh sách, cuộn được (dùng như <select> thường).
// - Gõ: lọc theo mã (tiền tố) hoặc theo tên (chứa, không phân biệt dấu).
// - ↑↓ chọn, Enter xác nhận, Esc đóng. Rời ô mà chưa chọn ⇒ giữ lựa chọn cũ.

export interface SearchOption {
  value: string;
  /** Mã hiển thị đậm, ví dụ "HPG". */
  symbol: string;
  /** Tên đầy đủ, ví dụ "Công ty Cổ phần Tập đoàn Hòa Phát". */
  name: string;
}

interface Props {
  options: SearchOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
  className: string;
}

export function SearchSelect({ options, value, onChange, ariaLabel, placeholder, className }: Props) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState<string | null>(null); // null = không đang gõ
  const [mo, setMo] = useState(false);
  const [chiSo, setChiSo] = useState(0);

  const daChon = options.find((o) => o.value === value) ?? null;
  const goiY = query === null || query.trim() === ''
    ? options
    : xepHang(query, options, options.length);

  function chon(o: SearchOption) {
    onChange(o.value);
    setQuery(null);
    setMo(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMo(true);
      setChiSo((i) => Math.min(i + 1, goiY.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setChiSo((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      // Chặn Enter submit form cha khi danh sách đang mở.
      if (mo && goiY[chiSo]) {
        e.preventDefault();
        chon(goiY[chiSo]);
      }
    } else if (e.key === 'Escape') {
      setMo(false);
      setQuery(null);
    }
  }

  const optId = (i: number) => `${listId}-opt-${i}`;
  const hien = query ?? (daChon ? daChon.symbol : '');

  return (
    <div className="relative">
      <input
        ref={inputRef}
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={mo}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={mo && goiY[chiSo] ? optId(chiSo) : undefined}
        value={hien}
        placeholder={placeholder}
        onFocus={(e) => { e.target.select(); setMo(true); setChiSo(0); }}
        onBlur={() => { setMo(false); setQuery(null); }}
        onChange={(e) => { setQuery(e.target.value); setMo(true); setChiSo(0); }}
        onKeyDown={onKeyDown}
        className={className}
      />
      {mo && (
        <div className="absolute left-0 z-20 mt-1 max-h-72 w-80 max-w-[90vw] overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-lg dark:border-border-dark dark:bg-surface-dark dark:shadow-lg-dark">
          <ul id={listId} role="listbox">
            {goiY.map((o, i) => (
              <li
                key={o.value}
                id={optId(i)}
                role="option"
                aria-selected={o.value === value}
                // mousedown: click tới SAU blur, lúc đó danh sách đã đóng.
                onMouseDown={(e) => { e.preventDefault(); chon(o); }}
                onMouseEnter={() => setChiSo(i)}
                className={`flex cursor-pointer items-baseline gap-2 px-3 py-1.5 text-[13px] ${
                  i === chiSo ? 'bg-surface-2 dark:bg-surface-2dark' : ''
                }`}
              >
                <strong className="w-20 shrink-0 font-mono text-text dark:text-text-dark">{o.symbol}</strong>
                <span title={o.name} className="min-w-0 flex-1 truncate text-text-muted dark:text-text-muted-dark">{o.name}</span>
                {o.value === value && <span aria-hidden="true" className="text-primary dark:text-primary-dark">✓</span>}
              </li>
            ))}
          </ul>
          {goiY.length === 0 && (
            <p className="px-3 py-2 text-[13px] text-text-muted dark:text-text-muted-dark">Không thấy mã nào khớp.</p>
          )}
        </div>
      )}
    </div>
  );
}
