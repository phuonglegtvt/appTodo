import { useCallback, useEffect, useState } from 'react';
import {
  fetchSettings, fetchTargets, saveCashOnHand, saveDcaPlan, saveMonthlyContribution,
  saveTargets,
} from '../data/portfolioRepo';
import type { SettingsRow, TargetRow } from '../types/portfolio';

// Cấu hình tab Danh mục: 4 tỷ trọng mục tiêu + tiền góp hàng tháng + kế hoạch DCA
// + tiền mặt đang có.
// Nguồn: schema `portfolio` (allocation_targets, settings).
//
// KHÔNG realtime: cấu hình do chính người dùng sửa trên màn này, không có
// nguồn nào khác ghi vào. Thêm kênh realtime chỉ để nghe chính mình là phức tạp
// vô ích — sau khi lưu thì tự tải lại.
//
// Lỗi phổ biến nhất ở đây KHÔNG phải lỗi mạng mà là chưa làm hai bước tay:
// chưa thêm `portfolio` vào Exposed schemas, hoặc chưa chạy migration. Cả hai
// đều trả về message rất khó hiểu nếu để nguyên, nên phải dịch lại.

interface UsePortfolioConfig {
  targets: TargetRow[];
  settings: SettingsRow | null;
  loading: boolean;
  error: string | null;
  saveTargetRows: (rows: TargetRow[]) => Promise<void>;
  saveContribution: (amountVnd: number) => Promise<void>;
  saveDca: (capitalVnd: number, months: number | null) => Promise<void>;
  saveCash: (amountVnd: number) => Promise<void>;
  clearError: () => void;
}

/** Dịch lỗi hạ tầng thành việc người dùng làm được. */
function dienGiaiLoi(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/schema must be one of|schema "portfolio"|does not exist/i.test(msg)) {
    return (
      'Chưa mở schema `portfolio` cho API. Vào Supabase Dashboard → Settings → API → '
      + 'Exposed schemas → thêm `portfolio` → Save, rồi tải lại trang. '
      + `(Chi tiết: ${msg})`
    );
  }
  if (/relation .* does not exist|Could not find the table/i.test(msg)) {
    return (
      'Chưa chạy migration của module Danh mục. Làm theo docs/portfolio-db-setup.md '
      + `rồi tải lại trang. (Chi tiết: ${msg})`
    );
  }
  return msg;
}

export function usePortfolioConfig(userId: string): UsePortfolioConfig {
  const [targets, setTargets] = useState<TargetRow[]>([]);
  const [settings, setSettings] = useState<SettingsRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const taiLai = useCallback(async () => {
    const [t, s] = await Promise.all([fetchTargets(userId), fetchSettings(userId)]);
    setTargets(t);
    setSettings(s);
  }, [userId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    taiLai()
      .catch((err) => {
        if (!active) return;
        console.error('Lỗi tải cấu hình danh mục:', err);
        setError(dienGiaiLoi(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [taiLai]);

  // Ném lại lỗi cho form hiển thị cạnh ô nhập, KHÔNG chỉ set state ở đây: form
  // cần biết lần lưu thất bại để không hiện "Đã lưu".
  const saveTargetRows = useCallback(async (rows: TargetRow[]) => {
    await saveTargets(userId, rows);
    await taiLai();
  }, [userId, taiLai]);

  const saveContribution = useCallback(async (amountVnd: number) => {
    await saveMonthlyContribution(userId, amountVnd);
    await taiLai();
  }, [userId, taiLai]);

  const saveDca = useCallback(async (capitalVnd: number, months: number | null) => {
    await saveDcaPlan(userId, capitalVnd, months);
    await taiLai();
  }, [userId, taiLai]);

  const saveCash = useCallback(async (amountVnd: number) => {
    await saveCashOnHand(userId, amountVnd);
    await taiLai();
  }, [userId, taiLai]);

  const clearError = useCallback(() => setError(null), []);

  return {
    targets, settings, loading, error,
    saveTargetRows, saveContribution, saveDca, saveCash, clearError,
  };
}
