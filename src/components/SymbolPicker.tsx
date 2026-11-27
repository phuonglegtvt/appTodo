import { useEffect, useId, useRef, useState } from 'react';
import { fetchFundList, type FundInfo } from '../lib/priceHistory';
import { fetchCryptoBases, timMaVn, timTaiCho, type SymbolOption } from '../lib/symbolSearch';

// Ô tìm mã kiểu combobox: gõ "fp", "btc", "vesaf", "tiep can"… → gợi ý từ cả
// ba nguồn, loại tài sản tự nhận theo nguồn nên không phải chọn loại trước.
// Logic lọc/xếp hạng ở src/lib/symbolSearch.ts (có test); file này lo nhập liệu,
// gọi mạng có debounce, và điều hướng bằng bàn phím.

interface Props {
  onPick: (o: SymbolOption) => void;
  disabled?: boolean;
  /** Các mã đã chọn — vẫn hiện trong gợi ý nhưng đánh dấu "đã thêm". */
  daChon: { kind: SymbolOption['kind']; symbol: string }[];
}

const DEBOUNCE_MS = 250;

export function SymbolPicker({ onPick, disabled, daChon }: Props) {
  const listId = useId();
  const [query, setQuery] = useState('');
  const [mo, setMo] = useState(false);
  const [chiSo, setChiSo] = useState(0);

  // Danh sách tải một lần, lúc người dùng bấm vào ô lần đầu.
  const [cryptoBases, setCryptoBases] = useState<string[]>([]);
  const [funds, setFunds] = useState<FundInfo[]>([]);
  const [daTaiDs, setDaTaiDs] = useState(false);
  const [loiNguon, setLoiNguon] = useState<string[]>([]);

  const [vn, setVn] = useState<SymbolOption[]>([]);
  const [dangTimVn, setDangTimVn] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function taiDanhSach() {
    if (daTaiDs) return;
    setDaTaiDs(true);
    fetchCryptoBases().then(setCryptoBases).catch((e: unknown) => {
      console.error('Lỗi tải danh sách crypto:', e);
      setLoiNguon((l) => [...l, `crypto (${e instanceof Error ? e.message : String(e)})`]);
    });
    fetchFundList().then(setFunds).catch((e: unknown) => {
      console.error('Lỗi tải danh sách quỹ mở:', e);
      setLoiNguon((l) => [...l, `quỹ mở (${e instanceof Error ? e.message : String(e)})`]);
    });
  }

  // Tìm cổ phiếu/ETF/chỉ số qua mạng: đợi người dùng ngừng gõ, huỷ request cũ
  // để kết quả của "F" về muộn không đè lên kết quả của "FPT".
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setVn([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setDangTimVn(true);
      timMaVn(q, ctrl.signal)
        .then((r) => {
          setVn(r);
          setLoiNguon((l) => l.filter((x) => !x.startsWith('cổ phiếu')));
        })
        .catch((e: unknown) => {
          if (ctrl.signal.aborted) return;
          console.error('Lỗi tìm mã VNDirect:', e);
          setVn([]);
          setLoiNguon((l) => [...l.filter((x) => !x.startsWith('cổ phiếu')), `cổ phiếu (${e instanceof Error ? e.message : String(e)})`]);
        })
        .finally(() => { if (!ctrl.signal.aborted) setDangTimVn(false); });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  const goiY = [...vn, ...timTaiCho(query, cryptoBases, funds)];
  const daCo = (o: SymbolOption) => daChon.some((d) => d.kind === o.kind && d.symbol === o.symbol);
  const hienList = mo && query.trim() !== '';

  function chon(o: SymbolOption) {
    if (daCo(o)) return;
    onPick(o);
    setQuery('');
    setChiSo(0);
    inputRef.current?.focus();
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
      e.preventDefault();
      const o = goiY[chiSo];
      if (o) chon(o);
    } else if (e.key === 'Escape') {
      setMo(false);
    }
  }

  const optId = (i: number) => `${listId}-opt-${i}`;

  return (
    <div className="relative">
      <input
        ref={inputRef}
        role="combobox"
        aria-expanded={hienList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={hienList && goiY[chiSo] ? optId(chiSo) : undefined}
        aria-label="Tìm mã cổ phiếu, ETF, chỉ số, crypto hoặc quỹ mở"
        value={query}
        disabled={disabled}
        placeholder={disabled ? 'Đã đủ 3 mã — bỏ bớt để thêm' : 'Tìm mã: FPT, VNINDEX, BTC, VESAF…'}
        onFocus={() => { taiDanhSach(); setMo(true); }}
        onBlur={() => setMo(false)}
        onChange={(e) => { setQuery(e.target.value); setMo(true); setChiSo(0); }}
        onKeyDown={onKeyDown}
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-[14px] text-text outline-none placeholder:text-text-muted focus:border-primary disabled:opacity-50 dark:border-border-dark dark:bg-surface-2dark dark:text-text-dark dark:placeholder:text-text-muted-dark dark:focus:border-primary-dark"
      />
      {hienList && (
        <div className="absolute left-0 right-0 z-20 mt-1 max-h-80 overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-lg dark:border-border-dark dark:bg-surface-dark dark:shadow-lg-dark">
          <ul id={listId} role="listbox">
            {goiY.map((o, i) => {
              const co = daCo(o);
              return (
                <li
                  key={`${o.kind}-${o.symbol}`}
                  id={optId(i)}
                  role="option"
                  aria-selected={i === chiSo}
                  aria-disabled={co}
                  // mousedown thay vì click: click đến SAU blur, lúc đó list đã đóng.
                  onMouseDown={(e) => { e.preventDefault(); chon(o); }}
                  onMouseEnter={() => setChiSo(i)}
                  className={`flex cursor-pointer items-baseline gap-2 px-3 py-1.5 text-[13px] ${
                    i === chiSo ? 'bg-surface-2 dark:bg-surface-2dark' : ''
                  } ${co ? 'cursor-default opacity-50' : ''}`}
                >
                  <strong className="font-mono text-text dark:text-text-dark">{o.symbol}</strong>
                  <span className="pill bg-primary-soft text-[10px] text-primary dark:bg-primary-soft-dark dark:text-primary-dark">
                    {o.typeLabel}
                  </span>
                  <span title={o.name} className="min-w-0 flex-1 truncate text-text-muted dark:text-text-muted-dark">{o.name}</span>
                  {co && <span className="text-[11px] text-text-muted dark:text-text-muted-dark">đã thêm</span>}
                </li>
              );
            })}
          </ul>
          {goiY.length === 0 && (
            <p className="px-3 py-2 text-[13px] text-text-muted dark:text-text-muted-dark">
              {dangTimVn ? 'Đang tìm…' : 'Không thấy mã nào khớp.'}
            </p>
          )}
          {loiNguon.length > 0 && (
            <p role="alert" className="border-t border-border px-3 py-1.5 text-[12px] text-priority-high dark:border-border-dark">
              Không tìm được ở nguồn: {loiNguon.join('; ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
