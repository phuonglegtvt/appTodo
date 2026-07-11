import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Stock, NewStock, StockUpdate, StockGroup } from '../types/stock';

interface UseStocks {
  stocks: Stock[];
  loading: boolean;
  error: string | null;
  addStock: (input: NewStock) => Promise<void>;
  updateStock: (id: string, patch: StockUpdate) => Promise<void>;
  deleteStock: (id: string) => Promise<void>;
  clearError: () => void;
}

// Thứ tự hiển thị các nhóm: Tấn công → Cân bằng → Phòng thủ.
const GROUP_ORDER: Record<StockGroup, number> = { attack: 0, balance: 1, defense: 2 };

function sortStocks(list: Stock[]): Stock[] {
  return [...list].sort((a, b) => {
    if (a.group !== b.group) return GROUP_ORDER[a.group] - GROUP_ORDER[b.group];
    return a.sort_order - b.sort_order;
  });
}

export function useStocks(userId: string): UseStocks {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tải lần đầu.
  useEffect(() => {
    let active = true;
    setLoading(true);
    supabase
      .from('stocks')
      .select('*')
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error('Lỗi tải cổ phiếu:', error);
          setError('Không tải được danh mục cổ phiếu: ' + error.message);
        } else {
          setStocks(sortStocks((data ?? []) as Stock[]));
        }
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  // Đồng bộ realtime: nghe thay đổi trên bảng stocks của user này.
  useEffect(() => {
    const channel = supabase
      .channel('stocks-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stocks', filter: `user_id=eq.${userId}` },
        (payload) => {
          setStocks((prev) => {
            if (payload.eventType === 'INSERT') {
              const row = payload.new as Stock;
              if (prev.some((s) => s.id === row.id)) return prev;
              return sortStocks([...prev, row]);
            }
            if (payload.eventType === 'UPDATE') {
              const row = payload.new as Stock;
              return sortStocks(prev.map((s) => (s.id === row.id ? row : s)));
            }
            if (payload.eventType === 'DELETE') {
              const old = payload.old as { id: string };
              return prev.filter((s) => s.id !== old.id);
            }
            return prev;
          });
        },
      )
      .subscribe((status, err) => {
        const s = String(status);
        if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') {
          console.error('Lỗi kênh đồng bộ realtime (stocks):', status, err);
          setError('Mất kết nối đồng bộ thời gian thực — hãy tải lại trang.');
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const addStock = useCallback(
    async (input: NewStock) => {
      const { error } = await supabase.from('stocks').insert({
        user_id: userId,
        ticker: input.ticker,
        company_name: input.company_name,
        group: input.group,
        price_threshold: input.price_threshold ?? null,
        price_protect: input.price_protect ?? null,
        current_price: input.current_price ?? null,
        dividend: input.dividend ?? null,
        invested_amount: input.invested_amount ?? null,
      });
      if (error) {
        console.error('Lỗi thêm cổ phiếu:', error);
        setError('Không thêm được cổ phiếu: ' + error.message);
      }
    },
    [userId],
  );

  const updateStock = useCallback(async (id: string, patch: StockUpdate) => {
    const { error } = await supabase.from('stocks').update(patch).eq('id', id);
    if (error) {
      console.error('Lỗi cập nhật cổ phiếu:', error);
      setError('Không cập nhật được cổ phiếu: ' + error.message);
    }
  }, []);

  const deleteStock = useCallback(async (id: string) => {
    const { error } = await supabase.from('stocks').delete().eq('id', id);
    if (error) {
      console.error('Lỗi xóa cổ phiếu:', error);
      setError('Không xóa được cổ phiếu: ' + error.message);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { stocks, loading, error, addStock, updateStock, deleteStock, clearError };
}
