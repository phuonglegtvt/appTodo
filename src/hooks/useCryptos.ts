import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Crypto, NewCrypto, CryptoUpdate } from '../types/crypto';

interface UseCryptos {
  cryptos: Crypto[];
  loading: boolean;
  error: string | null;
  addCrypto: (input: NewCrypto) => Promise<void>;
  updateCrypto: (id: string, patch: CryptoUpdate) => Promise<void>;
  deleteCrypto: (id: string) => Promise<void>;
  clearError: () => void;
}

function sortCryptos(list: Crypto[]): Crypto[] {
  return [...list].sort((a, b) => a.sort_order - b.sort_order);
}

export function useCryptos(userId: string): UseCryptos {
  const [cryptos, setCryptos] = useState<Crypto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tải lần đầu.
  useEffect(() => {
    let active = true;
    setLoading(true);
    supabase
      .from('cryptos')
      .select('*')
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error('Lỗi tải crypto:', error);
          setError('Không tải được danh mục crypto: ' + error.message);
        } else {
          setCryptos(sortCryptos((data ?? []) as Crypto[]));
        }
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  // Đồng bộ realtime: nghe thay đổi trên bảng cryptos của user này.
  useEffect(() => {
    const channel = supabase
      .channel('cryptos-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cryptos', filter: `user_id=eq.${userId}` },
        (payload) => {
          setCryptos((prev) => {
            if (payload.eventType === 'INSERT') {
              const row = payload.new as Crypto;
              if (prev.some((c) => c.id === row.id)) return prev;
              return sortCryptos([...prev, row]);
            }
            if (payload.eventType === 'UPDATE') {
              const row = payload.new as Crypto;
              return sortCryptos(prev.map((c) => (c.id === row.id ? row : c)));
            }
            if (payload.eventType === 'DELETE') {
              const old = payload.old as { id: string };
              return prev.filter((c) => c.id !== old.id);
            }
            return prev;
          });
        },
      )
      .subscribe((status, err) => {
        const s = String(status);
        if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') {
          console.error('Lỗi kênh đồng bộ realtime (cryptos):', status, err);
          setError('Mất kết nối đồng bộ thời gian thực — hãy tải lại trang.');
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const addCrypto = useCallback(
    async (input: NewCrypto) => {
      const { error } = await supabase.from('cryptos').insert({
        user_id: userId,
        symbol: input.symbol,
        name: input.name ?? '',
        quantity: input.quantity ?? null,
        avg_buy_price: input.avg_buy_price ?? null,
        current_price: input.current_price ?? null,
        peak_price: input.peak_price ?? null,
      });
      if (error) {
        console.error('Lỗi thêm crypto:', error);
        setError('Không thêm được coin: ' + error.message);
      }
    },
    [userId],
  );

  const updateCrypto = useCallback(async (id: string, patch: CryptoUpdate) => {
    const { error } = await supabase.from('cryptos').update(patch).eq('id', id);
    if (error) {
      console.error('Lỗi cập nhật crypto:', error);
      setError('Không cập nhật được coin: ' + error.message);
    }
  }, []);

  const deleteCrypto = useCallback(async (id: string) => {
    const { error } = await supabase.from('cryptos').delete().eq('id', id);
    if (error) {
      console.error('Lỗi xóa crypto:', error);
      setError('Không xóa được coin: ' + error.message);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { cryptos, loading, error, addCrypto, updateCrypto, deleteCrypto, clearError };
}
