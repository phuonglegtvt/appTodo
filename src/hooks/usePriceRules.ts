import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { PriceRule } from '../lib/priceRules';

// Quy tắc giá (`public.price_rules`, migration 2026-11-27-price-rules.sql).
// Thêm/sửa/xoá NÉM lỗi ra cho form hiện cạnh ô nhập; lỗi tải hiện qua `error`.

export type NewPriceRule = Omit<PriceRule, 'id'>;

function dienGiaiLoi(msg: string): string {
  if (/price_rules/i.test(msg) && /does not exist|Could not find/i.test(msg)) {
    return 'Chưa chạy migration cảnh báo giá. Vào Supabase → SQL Editor, chạy file '
      + `supabase/migrations/2026-11-27-price-rules.sql rồi tải lại trang. (Chi tiết: ${msg})`;
  }
  return msg;
}

const COT = 'id,asset_kind,symbol,direction,price,action,sell_pct,buy_amount_vnd,note,active';

function chuanHoa(r: PriceRule): PriceRule {
  return {
    ...r,
    price: Number(r.price),
    sell_pct: r.sell_pct === null ? null : Number(r.sell_pct),
    buy_amount_vnd: r.buy_amount_vnd === null ? null : Number(r.buy_amount_vnd),
  };
}

export function usePriceRules(userId: string): {
  rules: PriceRule[];
  loading: boolean;
  error: string | null;
  addRule: (r: NewPriceRule) => Promise<void>;
  updateRule: (id: string, patch: Partial<NewPriceRule>) => Promise<void>;
  deleteRule: (id: string) => Promise<void>;
  clearError: () => void;
} {
  const [rules, setRules] = useState<PriceRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    supabase.from('price_rules').select(COT).order('created_at').then(({ data, error: err }) => {
      if (!active) return;
      if (err) {
        console.error('Lỗi tải quy tắc giá:', err);
        setError('Không tải được quy tắc giá: ' + dienGiaiLoi(err.message));
      } else {
        setRules(((data ?? []) as PriceRule[]).map(chuanHoa));
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, [userId]);

  const addRule = useCallback(async (r: NewPriceRule) => {
    const { data, error: err } = await supabase.from('price_rules').insert({ ...r, user_id: userId }).select(COT).single();
    if (err) throw new Error(dienGiaiLoi(err.message));
    setRules((prev) => [...prev, chuanHoa(data as PriceRule)]);
  }, [userId]);

  const updateRule = useCallback(async (id: string, patch: Partial<NewPriceRule>) => {
    const { data, error: err } = await supabase.from('price_rules').update(patch).eq('id', id).select(COT).single();
    if (err) throw new Error(dienGiaiLoi(err.message));
    setRules((prev) => prev.map((r) => (r.id === id ? chuanHoa(data as PriceRule) : r)));
  }, []);

  const deleteRule = useCallback(async (id: string) => {
    const { error: err } = await supabase.from('price_rules').delete().eq('id', id);
    if (err) throw new Error(dienGiaiLoi(err.message));
    setRules((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { rules, loading, error, addRule, updateRule, deleteRule, clearError };
}
