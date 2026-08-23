import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Gold, NewGold, GoldUpdate } from '../types/gold';

// Khuôn y hệt useCryptos: tải lần đầu + realtime + CRUD, KHÔNG nuốt lỗi.
// ĐƠN VỊ: avg_buy_price / current_price là ĐỒNG trên MỘT LƯỢNG (không nghìn đồng).

interface UseGolds {
  golds: Gold[];
  loading: boolean;
  error: string | null;
  addGold: (input: NewGold) => Promise<void>;
  updateGold: (id: string, patch: GoldUpdate) => Promise<void>;
  deleteGold: (id: string) => Promise<void>;
  clearError: () => void;
}

function sortGolds(list: Gold[]): Gold[] {
  return [...list].sort((a, b) => a.sort_order - b.sort_order);
}

export function useGolds(userId: string): UseGolds {
  const [golds, setGolds] = useState<Gold[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    supabase
      .from('golds')
      .select('*')
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error('Lỗi tải vàng:', error);
          setError('Không tải được danh mục vàng: ' + error.message);
        } else {
          setGolds(sortGolds((data ?? []) as Gold[]));
        }
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    const channel = supabase
      .channel('golds-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'golds', filter: `user_id=eq.${userId}` },
        (payload) => {
          setGolds((prev) => {
            if (payload.eventType === 'INSERT') {
              const row = payload.new as Gold;
              if (prev.some((g) => g.id === row.id)) return prev;
              return sortGolds([...prev, row]);
            }
            if (payload.eventType === 'UPDATE') {
              const row = payload.new as Gold;
              return sortGolds(prev.map((g) => (g.id === row.id ? row : g)));
            }
            if (payload.eventType === 'DELETE') {
              const old = payload.old as { id: string };
              return prev.filter((g) => g.id !== old.id);
            }
            return prev;
          });
        },
      )
      .subscribe((status, err) => {
        const s = String(status);
        if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') {
          console.error('Lỗi kênh đồng bộ realtime (golds):', status, err);
          setError('Mất kết nối đồng bộ thời gian thực — hãy tải lại trang.');
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const addGold = useCallback(
    async (input: NewGold) => {
      const { error } = await supabase.from('golds').insert({
        user_id: userId,
        label: input.label,
        quantity: input.quantity ?? null,
        avg_buy_price: input.avg_buy_price ?? null,
        current_price: input.current_price ?? null,
      });
      if (error) {
        console.error('Lỗi thêm vàng:', error);
        setError('Không thêm được dòng vàng: ' + error.message);
      }
    },
    [userId],
  );

  const updateGold = useCallback(async (id: string, patch: GoldUpdate) => {
    const { error } = await supabase.from('golds').update(patch).eq('id', id);
    if (error) {
      console.error('Lỗi cập nhật vàng:', error);
      setError('Không cập nhật được dòng vàng: ' + error.message);
    }
  }, []);

  const deleteGold = useCallback(async (id: string) => {
    const { error } = await supabase.from('golds').delete().eq('id', id);
    if (error) {
      console.error('Lỗi xóa vàng:', error);
      setError('Không xóa được dòng vàng: ' + error.message);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { golds, loading, error, addGold, updateGold, deleteGold, clearError };
}
