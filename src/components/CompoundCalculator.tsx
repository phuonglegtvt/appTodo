import { useMemo, useState } from 'react';
import { tinhLaiKep, type KyGhepLai } from '../lib/compoundInterest';
import { parseVnNumber } from '../lib/parseNumber';
import { formatVnd, formatVndShort } from '../lib/portfolioClassMeta';
import { MoneyInput } from './MoneyInput';
import { LineChart } from './LineChart';

// Máy tính lãi kép: gốc ban đầu + góp đều hàng tháng. Phép tính ở
// src/lib/compoundInterest.ts (có test); file này chỉ nhận số và vẽ.
// Tính lại ngay khi gõ — không cần nút "Tính lãi".

const KY: { value: KyGhepLai; label: string }[] = [
  { value: 1, label: 'Hàng năm' },
  { value: 4, label: 'Hàng quý' },
  { value: 12, label: 'Hàng tháng' },
];

const oNhap = 'w-full rounded-md border border-border bg-surface px-3 py-2 text-right font-mono text-[14px] tabular-nums text-text outline-none focus:border-primary dark:border-border-dark dark:bg-surface-2dark dark:text-text-dark dark:focus:border-primary-dark';
const nhan = 'text-[13px] font-semibold text-text dark:text-text-dark';
const goiY = 'text-[12px] text-text-muted dark:text-text-muted-dark';

export function CompoundCalculator() {
  const [goc, setGoc] = useState<number | null>(10_000_000);
  const [gop, setGop] = useState<number | null>(10_000_000);
  const [namText, setNamText] = useState('10');
  const [laiText, setLaiText] = useState('10');
  const [ky, setKy] = useState<KyGhepLai>(1);
  const [chiTiet, setChiTiet] = useState(false);

  const { ketQua, loi } = useMemo(() => {
    const soNam = parseVnNumber(namText);
    const lai = parseVnNumber(laiText);
    if (goc === null || gop === null || soNam === null || lai === null) {
      return { ketQua: null, loi: 'Điền đủ các ô bằng số.' };
    }
    try {
      return { ketQua: tinhLaiKep({ gocBanDau: goc, gopMoiThang: gop, soNam, laiSuatNamPct: lai, kyMoiNam: ky }), loi: null };
    } catch (e) {
      return { ketQua: null, loi: e instanceof Error ? e.message : String(e) };
    }
  }, [goc, gop, namText, laiText, ky]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-[17px] font-bold text-text dark:text-text-dark">Tính lãi kép</h2>
        <p className={goiY}>
          Gửi một khoản ban đầu, góp thêm đều mỗi tháng, lãi nhập gốc theo kỳ. Tiền góp
          của mỗi kỳ được cộng vào cuối kỳ (kỳ đó chưa sinh lãi).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className={nhan}>Số tiền gốc ban đầu (đ)</span>
          <MoneyInput value={goc} onChange={setGoc} className={oNhap} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={nhan}>Góp thêm mỗi tháng (đ)</span>
          <MoneyInput value={gop} onChange={setGop} className={oNhap} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={nhan}>Thời gian (năm)</span>
          <input inputMode="numeric" value={namText} onChange={(e) => setNamText(e.target.value)} className={oNhap} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={nhan}>Lãi suất (%/năm)</span>
          <input inputMode="decimal" value={laiText} onChange={(e) => setLaiText(e.target.value)} className={oNhap} />
        </label>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <span className={nhan}>Ghép lãi</span>
          <div className="flex flex-wrap gap-2">
            {KY.map((k) => (
              <button
                key={k.value}
                type="button"
                onClick={() => setKy(k.value)}
                aria-pressed={ky === k.value}
                className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition ease-out ${
                  ky === k.value
                    ? 'border-primary bg-primary-soft text-primary dark:border-primary-dark dark:bg-primary-soft-dark dark:text-primary-dark'
                    : 'border-border text-text-muted hover:text-text dark:border-border-dark dark:text-text-muted-dark dark:hover:text-text-dark'
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loi !== null && (
        <p role="alert" className="text-sm font-semibold text-priority-high">{loi}</p>
      )}

      {ketQua !== null && (
        <>
          <div className="rounded-lg bg-surface-2 p-4 dark:bg-surface-2dark">
            <div className="text-[13px] text-text-muted dark:text-text-muted-dark">
              Sau {ketQua.rows.length - 1} năm bạn sẽ có
            </div>
            <div className="text-[28px] font-bold tracking-tight text-text dark:text-text-dark">
              {formatVnd(ketQua.giaTriCuoi)}
            </div>
            <div className="mt-2 grid gap-1 text-[13px] sm:grid-cols-2">
              <div className="flex justify-between gap-2 sm:block">
                <span className="text-text-muted dark:text-text-muted-dark">Tổng tiền đã góp: </span>
                <strong className="font-mono tabular-nums text-text dark:text-text-dark">{formatVnd(ketQua.tongGoc)}</strong>
              </div>
              <div className="flex justify-between gap-2 sm:block">
                <span className="text-text-muted dark:text-text-muted-dark">Tiền lãi: </span>
                <strong className="font-mono tabular-nums text-[color:var(--viz-cash)]">+{formatVnd(ketQua.tongLai)}</strong>
              </div>
            </div>
          </div>

          <LineChart
            ariaLabel={`Giá trị tài khoản tăng từ ${formatVnd(ketQua.rows[0].giaTri)} lên ${formatVnd(ketQua.giaTriCuoi)}`}
            series={[
              { key: 'gt', label: 'Giá trị tương lai', color: 'var(--viz-stocks)', points: ketQua.rows.map((r) => ({ x: r.nam, y: r.giaTri })) },
              { key: 'goc', label: 'Tiền gốc đã góp', color: 'var(--viz-cash)', dashed: true, points: ketQua.rows.map((r) => ({ x: r.nam, y: r.tienGoc })) },
            ]}
            formatX={(x) => `Năm ${Math.round(x)}`}
            formatY={formatVndShort}
            formatYFull={formatVnd}
          />

          <div>
            <button
              type="button"
              onClick={() => setChiTiet((v) => !v)}
              className="text-sm font-semibold text-primary underline decoration-dotted hover:no-underline dark:text-primary-dark"
            >
              {chiTiet ? 'Ẩn bảng chi tiết' : 'Hiện bảng chi tiết theo năm'}
            </button>
            {chiTiet && (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-left text-text-muted dark:text-text-muted-dark">
                      <th className="px-2 py-1 font-semibold">Năm</th>
                      <th className="px-2 py-1 text-right font-semibold">Tiền gốc</th>
                      <th className="px-2 py-1 text-right font-semibold">Tiền lãi</th>
                      <th className="px-2 py-1 text-right font-semibold">Giá trị</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono tabular-nums text-text dark:text-text-dark">
                    {ketQua.rows.map((r) => (
                      <tr key={r.nam} className="border-t border-border dark:border-border-dark">
                        <td className="px-2 py-1">{r.nam}</td>
                        <td className="px-2 py-1 text-right">{formatVnd(r.tienGoc)}</td>
                        <td className="px-2 py-1 text-right">{formatVnd(r.tienLai)}</td>
                        <td className="px-2 py-1 text-right font-semibold">{formatVnd(r.giaTri)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
