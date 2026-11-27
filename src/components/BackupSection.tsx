import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { BOM, toCsv } from '../lib/csv';

// Sao lưu dữ liệu: tải từng bảng về CSV (mở bằng Excel) hoặc tất cả thành MỘT
// file JSON. Chỉ ĐỌC — không ghi gì lên máy chủ. RLS bảo đảm chỉ tải dữ liệu của
// chính người đang đăng nhập.
//
// Bảng chưa chạy migration (chưa tồn tại) không chặn cả lần sao lưu: báo tên
// bảng lỗi, các bảng còn lại vẫn tải.

const BANG: { ten: string; nhan: string }[] = [
  { ten: 'stocks', nhan: 'Cổ phiếu' },
  { ten: 'stock_transactions', nhan: 'Giao dịch cổ phiếu' },
  { ten: 'cryptos', nhan: 'Crypto' },
  { ten: 'crypto_transactions', nhan: 'Giao dịch crypto' },
  { ten: 'golds', nhan: 'Vàng' },
  { ten: 'cash_entries', nhan: 'Thu – Chi' },
  { ten: 'cash_budgets', nhan: 'Ngân sách' },
  { ten: 'cash_recurring', nhan: 'Khoản định kỳ' },
  { ten: 'debts', nhan: 'Nợ & thẻ' },
  { ten: 'price_rules', nhan: 'Cảnh báo giá' },
  { ten: 'financial_goals', nhan: 'Mục tiêu tài chính' },
  { ten: 'net_worth_snapshots', nhan: 'Tài sản ròng theo tháng' },
  { ten: 'user_prefs', nhan: 'Cài đặt giao diện' },
  { ten: 'todos', nhan: 'Việc' },
  { ten: 'goals', nhan: 'Mục tiêu (Kế hoạch)' },
];

function homNay(): string {
  return new Date().toLocaleDateString('en-CA');
}

function taiFile(ten: string, noiDung: string, kieu: string) {
  const url = URL.createObjectURL(new Blob([noiDung], { type: kieu }));
  const a = document.createElement('a');
  a.href = url;
  a.download = ten;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function docBang(ten: string): Promise<Record<string, unknown>[]> {
  const { data, error } = await supabase.from(ten).select('*');
  if (error) throw new Error(`${ten}: ${error.message}`);
  return (data ?? []) as Record<string, unknown>[];
}

const mo = 'text-text-muted dark:text-text-muted-dark';

export function BackupSection() {
  const [dang, setDang] = useState<string | null>(null);
  const [loi, setLoi] = useState<string | null>(null);
  const [xong, setXong] = useState<string | null>(null);

  async function taiCsv(ten: string, nhan: string) {
    setLoi(null); setXong(null); setDang(ten);
    try {
      const rows = await docBang(ten);
      taiFile(`apptodo-${ten}-${homNay()}.csv`, BOM + toCsv(rows), 'text/csv;charset=utf-8');
      setXong(`Đã tải ${nhan}: ${rows.length} dòng.`);
    } catch (err) {
      console.error('Lỗi sao lưu bảng:', err);
      setLoi(err instanceof Error ? err.message : String(err));
    } finally {
      setDang(null);
    }
  }

  async function taiTatCa() {
    setLoi(null); setXong(null); setDang('*');
    const ketQua = await Promise.allSettled(BANG.map((b) => docBang(b.ten)));
    const du: Record<string, unknown> = { xuat_luc: new Date().toISOString(), bang: {} };
    const hong: string[] = [];
    ketQua.forEach((k, i) => {
      if (k.status === 'fulfilled') (du.bang as Record<string, unknown>)[BANG[i].ten] = k.value;
      else { hong.push(BANG[i].ten); console.error('Lỗi sao lưu bảng:', k.reason); }
    });
    taiFile(`apptodo-saoluu-${homNay()}.json`, JSON.stringify(du, null, 2), 'application/json');
    setDang(null);
    const soDong = Object.values(du.bang as Record<string, unknown[]>).reduce((s, r) => s + r.length, 0);
    setXong(`Đã tải bản sao lưu: ${BANG.length - hong.length} bảng, ${soDong} dòng.`);
    if (hong.length > 0) setLoi(`Không đọc được ${hong.length} bảng (có thể chưa chạy migration): ${hong.join(', ')} — các bảng còn lại vẫn có trong file.`);
  }

  return (
    <section className="surface-card flex flex-col gap-3 p-5">
      <div>
        <div className="text-[15px] font-bold text-text dark:text-text-dark">Sao lưu dữ liệu</div>
        <div className={`text-[12px] ${mo}`}>
          Tải về máy để lưu trữ hoặc mở bằng Excel. Chỉ đọc, không thay đổi dữ liệu. Nên tải bản JSON định kỳ (VD mỗi tháng).
        </div>
      </div>
      <button onClick={() => void taiTatCa()} disabled={dang !== null}
        className="self-start rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50 dark:bg-primary-dark dark:text-bg-dark">
        {dang === '*' ? 'Đang tải…' : 'Tải toàn bộ (1 file JSON)'}
      </button>
      <div className="flex flex-wrap gap-1.5">
        {BANG.map((b) => (
          <button key={b.ten} onClick={() => void taiCsv(b.ten, b.nhan)} disabled={dang !== null}
            className="rounded-lg border border-border px-2.5 py-1 text-[12.5px] font-semibold text-text-muted hover:text-text disabled:opacity-50 dark:border-border-dark dark:text-text-muted-dark dark:hover:text-text-dark">
            {dang === b.ten ? 'Đang tải…' : `${b.nhan} (CSV)`}
          </button>
        ))}
      </div>
      {xong && <p role="status" className="text-[13px] text-green-600 dark:text-green-400">✓ {xong}</p>}
      {loi && <p role="alert" className="text-[13px] text-red-600 dark:text-red-400">⚠ {loi}</p>}
    </section>
  );
}
