import { useState } from 'react';
import { monthlyPool } from '../domain/dcaPool';
import { ASSET_CLASSES } from '../domain/types';
import { CLASS_META } from '../lib/portfolioClassMeta';
import { parseVnNumber, parseVndAmount } from '../lib/parseNumber';
import type { AssetClass } from '../domain/types';
import type { SettingsRow, TargetRow } from '../types/portfolio';

// Màn Cấu hình: sửa 4 tỷ trọng mục tiêu + band, số tiền góp hàng tháng, kế
// hoạch DCA và tiền mặt đang có.
//
// ĐÂY LÀ ĐƯỜNG GHI THẬT ĐẦU TIÊN của module portfolio. Hệ quả: hai lỗ `NaN` mà
// bản bàn giao 2026-08-22 mục 2 để lại vì "chưa có đường ghi nào" từ nay có
// thể chạm tới. Chặn ở ba lớp, cố ý trùng nhau:
//   ① form này (message tiếng Việt, ngay cạnh ô nhập)
//   ② portfolioRepo.saveTargets (chặn cả khi gọi từ chỗ khác)
//   ③ buildSnapshot.mapToSnapshot (chặn cả khi dữ liệu vào DB bằng đường khác)

interface Props {
  targets: TargetRow[];
  settings: SettingsRow | null;
  onSaveTargets: (rows: TargetRow[]) => Promise<void>;
  onSaveContribution: (amountVnd: number) => Promise<void>;
  onSaveDca: (capitalVnd: number, months: number | null) => Promise<void>;
  onSaveCash: (amountVnd: number) => Promise<void>;
}

type Nhap = Record<AssetClass, { target: string; min: string; max: string }>;

function toNhap(targets: TargetRow[]): Nhap {
  const out = {} as Nhap;
  for (const c of ASSET_CLASSES) {
    const t = targets.find((x) => x.asset_class === c);
    out[c] = {
      target: t ? String(t.target_pct) : '0',
      min: t ? String(t.min_pct) : '0',
      max: t ? String(t.max_pct) : '0',
    };
  }
  return out;
}

/** Định dạng tiền VND để hiện lại cho người dùng đọc. */
function dinhDangVnd(v: number): string {
  return v.toLocaleString('vi-VN') + ' đ';
}

export function TargetSettingsForm({
  targets, settings, onSaveTargets, onSaveContribution, onSaveDca, onSaveCash,
}: Props) {
  const [nhap, setNhap] = useState<Nhap>(() => toNhap(targets));
  const [z, setZ] = useState(() =>
    settings === null ? '' : String(settings.monthly_contribution_vnd),
  );
  const [von, setVon] = useState(() =>
    settings === null || settings.dca_capital_vnd === 0
      ? '' : String(settings.dca_capital_vnd),
  );
  const [soThang, setSoThang] = useState(() =>
    settings?.dca_months == null ? '' : String(settings.dca_months),
  );
  const [tienMat, setTienMat] = useState(() =>
    settings === null || settings.cash_on_hand_vnd === 0
      ? '' : String(settings.cash_on_hand_vnd),
  );
  const [loi, setLoi] = useState<string | null>(null);
  const [xong, setXong] = useState<string | null>(null);
  const [dangLuu, setDangLuu] = useState(false);

  // Tổng hiện ngay khi gõ: người dùng thấy mình đang lệch 100% TRƯỚC khi bấm
  // Lưu, thay vì bị từ chối sau khi bấm.
  const tongTarget = ASSET_CLASSES.reduce(
    (s, c) => s + (parseVnNumber(nhap[c].target) ?? 0), 0,
  );
  const tongDung = Math.abs(tongTarget - 100) < 0.01;

  // Tính lại NGAY khi gõ, dùng đúng hàm engine sẽ dùng (domain/dcaPool) — không
  // viết lại phép chia ở đây, để cái người dùng thấy trước khi Lưu đúng bằng cái
  // app sẽ tính sau khi Lưu.
  const zHienTai = parseVndAmount(z) ?? 0;
  const vonHienTai = parseVndAmount(von) ?? 0;
  const thangHienTai = parseVnNumber(soThang);
  const poolXemTruoc = monthlyPool({
    contributionVnd: Math.max(0, zHienTai),
    capitalVnd: Math.max(0, vonHienTai),
    months: thangHienTai,
  });

  // Có tiền mặt mà mục tiêu nhóm Tiền mặt ĐÃ LƯU vẫn là 0% ⇒ engine coi toàn bộ
  // số tiền đó là "vượt mục tiêu" và đòi bán bớt. Đọc từ `targets` (đã lưu),
  // không phải ô đang gõ, vì đó mới là thứ engine đang dùng.
  const tienMatHienTai = parseVndAmount(tienMat) ?? 0;
  const mucTieuCashDaLuu = targets.find((t) => t.asset_class === 'CASH')?.target_pct ?? 0;
  const canhBaoMucTieuCash = tienMatHienTai > 0 && mucTieuCashDaLuu === 0;

  function set(c: AssetClass, khoa: 'target' | 'min' | 'max', v: string) {
    setNhap((p) => ({ ...p, [c]: { ...p[c], [khoa]: v } }));
    setXong(null);
  }

  async function luuTargets() {
    setLoi(null);
    setXong(null);

    const rows: TargetRow[] = [];
    for (const c of ASSET_CLASSES) {
      const t = parseVnNumber(nhap[c].target);
      const mn = parseVnNumber(nhap[c].min);
      const mx = parseVnNumber(nhap[c].max);
      // parseNumber trả null khi không đọc được — báo đích danh nhóm và ô nào,
      // không để một ô trống lặng lẽ thành 0.
      if (t === null || mn === null || mx === null) {
        setLoi(`Nhóm ${CLASS_META[c].label}: có ô chưa nhập hoặc không phải số.`);
        return;
      }
      rows.push({ asset_class: c, target_pct: t, min_pct: mn, max_pct: mx });
    }

    setDangLuu(true);
    try {
      await onSaveTargets(rows);
      setXong('Đã lưu tỷ trọng mục tiêu.');
    } catch (err) {
      console.error('Lỗi lưu tỷ trọng mục tiêu:', err);
      setLoi(err instanceof Error ? err.message : String(err));
    } finally {
      setDangLuu(false);
    }
  }

  async function luuZ() {
    setLoi(null);
    setXong(null);
    const n = parseVndAmount(z);
    if (n === null) {
      setLoi('Số tiền góp hàng tháng chưa nhập hoặc không phải số.');
      return;
    }
    setDangLuu(true);
    try {
      await onSaveContribution(n);
      setXong('Đã lưu số tiền góp hàng tháng.');
    } catch (err) {
      console.error('Lỗi lưu số tiền góp hàng tháng:', err);
      setLoi(err instanceof Error ? err.message : String(err));
    } finally {
      setDangLuu(false);
    }
  }

  async function luuDca() {
    setLoi(null);
    setXong(null);

    const v = parseVndAmount(von);
    // Ô trống nghĩa là "không có vốn DCA" ⇒ 0, hợp lệ. Nhưng gõ chữ vào thì
    // parseVndAmount trả null — phải phân biệt hai ca, không nuốt thành 0.
    const vonSo = von.trim() === '' ? 0 : v;
    if (vonSo === null) {
      setLoi('Vốn không phải số tiền hợp lệ.');
      return;
    }

    const thangSo = soThang.trim() === '' ? null : parseVnNumber(soThang);
    if (soThang.trim() !== '' && (thangSo === null || !Number.isInteger(thangSo) || thangSo <= 0)) {
      setLoi('Số tháng DCA phải là số nguyên lớn hơn 0. Để trống nếu chưa muốn rải.');
      return;
    }

    setDangLuu(true);
    try {
      await onSaveDca(vonSo, thangSo);
      setXong('Đã lưu kế hoạch DCA.');
    } catch (err) {
      console.error('Lỗi lưu kế hoạch DCA:', err);
      setLoi(err instanceof Error ? err.message : String(err));
    } finally {
      setDangLuu(false);
    }
  }

  async function luuTienMat() {
    setLoi(null);
    setXong(null);
    // Ô trống = không có tiền mặt ⇒ 0, hợp lệ. Gõ chữ thì parseVndAmount trả
    // null — phải báo, không nuốt thành 0.
    const n = tienMat.trim() === '' ? 0 : parseVndAmount(tienMat);
    if (n === null) {
      setLoi('Số tiền mặt không phải số tiền hợp lệ.');
      return;
    }
    setDangLuu(true);
    try {
      await onSaveCash(n);
      setXong('Đã lưu số tiền mặt.');
    } catch (err) {
      console.error('Lỗi lưu số tiền mặt:', err);
      setLoi(err instanceof Error ? err.message : String(err));
    } finally {
      setDangLuu(false);
    }
  }

  const oNhap = 'w-full rounded-md border border-border bg-surface px-2 py-1.5 text-right font-mono text-[13px] tabular-nums text-text outline-none focus:border-primary dark:border-border-dark dark:bg-surface-2dark dark:text-text-dark dark:focus:border-primary-dark';
  const nut = 'rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition ease-out hover:opacity-90 active:scale-95 disabled:opacity-50 dark:bg-primary-dark dark:text-bg-dark';

  return (
    <section className="flex flex-col gap-5">
      <div>
        <h3 className="text-sm font-bold text-text dark:text-text-dark">
          Tỷ trọng mục tiêu
        </h3>
        <p className="mt-1 text-[13px] leading-relaxed text-text-muted dark:text-text-muted-dark">
          Bốn nhóm phải cộng đúng <strong>100</strong>. Giới hạn dưới ≤ mục tiêu ≤
          giới hạn trên. Nhóm nào để mục tiêu <strong>0</strong> và giới hạn{' '}
          <strong>0–0</strong> thì coi như không theo dõi nhóm đó.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse">
          <thead>
            <tr className="border-b border-border dark:border-border-dark">
              <th className="px-2 py-2 text-left text-[11px] font-bold uppercase tracking-[0.06em] text-text-muted dark:text-text-muted-dark">
                Nhóm
              </th>
              <th className="px-2 py-2 text-right text-[11px] font-bold uppercase tracking-[0.06em] text-text-muted dark:text-text-muted-dark">
                Mục tiêu %
              </th>
              <th className="px-2 py-2 text-right text-[11px] font-bold uppercase tracking-[0.06em] text-text-muted dark:text-text-muted-dark">
                Dưới %
              </th>
              <th className="px-2 py-2 text-right text-[11px] font-bold uppercase tracking-[0.06em] text-text-muted dark:text-text-muted-dark">
                Trên %
              </th>
            </tr>
          </thead>
          <tbody>
            {ASSET_CLASSES.map((c) => (
              <tr key={c} className="border-b border-border last:border-0 dark:border-border-dark">
                <td className="px-2 py-2 text-sm">
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="h-2.5 w-2.5 flex-none rounded-sm"
                      style={{ backgroundColor: CLASS_META[c].colorVar }}
                    />
                    <span className="text-text dark:text-text-dark">{CLASS_META[c].label}</span>
                  </span>
                </td>
                {(['target', 'min', 'max'] as const).map((khoa) => (
                  <td key={khoa} className="w-24 px-2 py-2">
                    <input
                      value={nhap[c][khoa]}
                      onChange={(e) => set(c, khoa, e.target.value)}
                      inputMode="decimal"
                      aria-label={`${CLASS_META[c].label} — ${
                        khoa === 'target' ? 'mục tiêu' : khoa === 'min' ? 'giới hạn dưới' : 'giới hạn trên'
                      }`}
                      className={oNhap}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="px-2 py-2 text-sm font-semibold text-text dark:text-text-dark">
                Tổng
              </td>
              <td
                className={`px-2 py-2 text-right font-mono text-[13px] font-bold tabular-nums ${
                  tongDung
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {tongTarget.toFixed(1)}
              </td>
              <td colSpan={2} className="px-2 py-2 text-[12px] text-text-muted dark:text-text-muted-dark">
                {tongDung ? 'đúng 100' : 'phải bằng 100'}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div>
        <button onClick={luuTargets} disabled={dangLuu || !tongDung} className={nut}>
          {dangLuu ? 'Đang lưu…' : 'Lưu tỷ trọng mục tiêu'}
        </button>
      </div>

      <hr className="border-border dark:border-border-dark" />

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-bold text-text dark:text-text-dark">
          Tiền góp hàng tháng
        </h3>
        <p className="text-[13px] leading-relaxed text-text-muted dark:text-text-muted-dark">
          Đơn vị <strong>đồng</strong>. Đây là số tiền app chia vào các nhóm ở cột
          “Góp tháng này”.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={z}
            onChange={(e) => { setZ(e.target.value); setXong(null); }}
            inputMode="numeric"
            placeholder="3.000.000"
            aria-label="Số tiền góp hàng tháng (đồng)"
            className={`${oNhap} max-w-[200px]`}
          />
          <button onClick={luuZ} disabled={dangLuu} className={nut}>
            {dangLuu ? 'Đang lưu…' : 'Lưu'}
          </button>
        </div>
      </div>

      <hr className="border-border dark:border-border-dark" />

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-bold text-text dark:text-text-dark">
          Vốn có sẵn rải dần (DCA)
        </h3>
        <p className="text-[13px] leading-relaxed text-text-muted dark:text-text-muted-dark">
          Đơn vị <strong>đồng</strong>. Có sẵn một cục vốn và muốn rải trong nhiều
          tháng thì nhập ở đây. <strong>Vốn bổ sung</strong> mỗi tháng ={' '}
          <em>Vốn ÷ số tháng</em>, và nó được cộng vào tiền góp hàng tháng để ra số
          app chia ở cột “Góp tháng này”.
        </p>

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-text-muted dark:text-text-muted-dark">
              Vốn
            </span>
            <input
              value={von}
              onChange={(e) => { setVon(e.target.value); setXong(null); }}
              inputMode="numeric"
              placeholder="120.000.000"
              aria-label="Vốn có sẵn để rải (đồng)"
              className={`${oNhap} w-[190px]`}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-text-muted dark:text-text-muted-dark">
              Số tháng DCA
            </span>
            <input
              value={soThang}
              onChange={(e) => { setSoThang(e.target.value); setXong(null); }}
              inputMode="numeric"
              placeholder="12"
              aria-label="Số tháng rải hết vốn"
              className={`${oNhap} w-[110px]`}
            />
          </label>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-text-muted dark:text-text-muted-dark">
              Vốn bổ sung / tháng
            </span>
            {/* Ô CHỈ ĐỌC: đây là số tính ra, không phải số nhập. Cho sửa được thì
                nó lệch khỏi Vốn ÷ số tháng và không ai biết số nào đang đúng. */}
            <output
              className="block w-[190px] rounded-md border border-dashed border-border bg-surface-2 px-2 py-1.5 text-right font-mono text-[13px] font-bold tabular-nums text-text dark:border-border-dark dark:bg-surface-2dark dark:text-text-dark"
            >
              {dinhDangVnd(poolXemTruoc.dcaSliceVnd)}
            </output>
          </div>

          <button onClick={luuDca} disabled={dangLuu} className={nut}>
            {dangLuu ? 'Đang lưu…' : 'Lưu'}
          </button>
        </div>

        {/* Nói THẲNG vì sao vốn bổ sung = 0 — người dùng nhập vốn rồi rất dễ
            tưởng app đã rải, trong khi số tháng còn trống. */}
        {poolXemTruoc.lyDoKhongCoDca === 'chua-dat-thang' && (
          <p role="alert" className="text-[13px] text-amber-700 dark:text-amber-400">
            ⚠ Đã có vốn nhưng <strong>chưa nhập số tháng DCA</strong> nên vốn bổ sung
            vẫn là 0 đ. Nhập số tháng rồi bấm Lưu.
          </p>
        )}

        <p className="text-[13px] leading-relaxed text-text dark:text-text-dark">
          Tháng này app sẽ chia:{' '}
          <strong>{dinhDangVnd(poolXemTruoc.totalVnd)}</strong>{' '}
          <span className="text-text-muted dark:text-text-muted-dark">
            = {dinhDangVnd(poolXemTruoc.contributionVnd)} góp hàng tháng
            {' + '}{dinhDangVnd(poolXemTruoc.dcaSliceVnd)} vốn bổ sung
          </span>
        </p>
      </div>

      <hr className="border-border dark:border-border-dark" />

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-bold text-text dark:text-text-dark">
          Tiền mặt đang có
        </h3>
        <p className="text-[13px] leading-relaxed text-text-muted dark:text-text-muted-dark">
          Đơn vị <strong>đồng</strong>. Tổng tiền mặt bạn đang giữ (ví, tài khoản
          ngân hàng…). Số này được tính vào nhóm <strong>Tiền mặt</strong> trong tỷ
          trọng danh mục. Nhập tay — cập nhật lại khi số dư thay đổi. Để trống = 0.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={tienMat}
            onChange={(e) => { setTienMat(e.target.value); setXong(null); }}
            inputMode="numeric"
            placeholder="50.000.000"
            aria-label="Tiền mặt đang có (đồng)"
            className={`${oNhap} max-w-[200px]`}
          />
          <button onClick={luuTienMat} disabled={dangLuu} className={nut}>
            {dangLuu ? 'Đang lưu…' : 'Lưu'}
          </button>
        </div>
        {canhBaoMucTieuCash && (
          <p role="alert" className="text-[13px] text-amber-700 dark:text-amber-400">
            ⚠ Mục tiêu nhóm <strong>Tiền mặt</strong> đang là <strong>0%</strong> nên
            app sẽ coi toàn bộ tiền mặt là vượt mục tiêu. Đặt % mục tiêu cho Tiền mặt
            ở bảng “Tỷ trọng mục tiêu” phía trên rồi bấm Lưu.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-[13px] leading-relaxed text-text-muted dark:border-border-dark dark:bg-surface-2dark dark:text-text-muted-dark">
        <strong className="text-text dark:text-text-dark">App chưa theo dõi khoản
        góp thực tế.</strong> Tab này tính tỷ trọng từ cổ phiếu, crypto, vàng đang
        giữ và số tiền mặt nhập ở trên. Việc “tháng này đã nộp tiền chưa”, cổ tức, lãi/lỗ đã thực
        hiện và Crash Reserve đều cần sổ giao dịch — chưa làm ở đợt này, nên app
        không cảnh báo về chúng thay vì cảnh báo dựa trên số liệu không có.
      </div>

      {loi !== null && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">⚠ {loi}</p>
      )}
      {xong !== null && (
        <p role="status" className="text-sm text-green-600 dark:text-green-400">✓ {xong}</p>
      )}
    </section>
  );
}
