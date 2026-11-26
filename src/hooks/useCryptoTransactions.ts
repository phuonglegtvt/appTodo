import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { applyTx } from '../lib/cryptoTransaction';
import type { Crypto } from '../types/crypto';
import type { CryptoTransaction, NewCryptoTransaction } from '../types/cryptoTransaction';

// Sổ giao dịch crypto. Ghi qua hai hàm Postgres (rpc) để "cập nhật coin + thêm
// giao dịch" là MỘT thao tác nguyên tử — ghi hai lệnh rời từ trình duyệt thì
// mất mạng giữa chừng sẽ để coin và sổ lệch nhau mà không ai biết.
//
// Dòng coin trong bảng tự cập nhật nhờ realtime của `useCryptos`; hook này chỉ
// tải lại danh sách giao dịch sau mỗi lần ghi.

interface UseCryptoTransactions {
  transactions: CryptoTransaction[];
  loading: boolean;
  error: string | null;
  /** Trả về lãi/lỗ đã chốt (đồng) của lệnh bán, để form báo lại cho người dùng. */
  record: (coin: Crypto, input: NewCryptoTransaction) => Promise<number | null>;
  undo: (txId: string) => Promise<void>;
  clearError: () => void;
}

/** Dịch lỗi "chưa chạy migration" thành việc người dùng làm được. */
function dienGiaiLoi(msg: string): string {
  if (/crypto_transactions|record_crypto_transaction|undo_crypto_transaction/i.test(msg)
    && /does not exist|Could not find/i.test(msg)) {
    return 'Chưa chạy migration sổ giao dịch crypto. Vào Supabase → SQL Editor, chạy file '
      + `supabase/migrations/2026-11-26-crypto-transactions.sql rồi tải lại trang. (Chi tiết: ${msg})`;
  }
  return msg;
}

export function useCryptoTransactions(userId: string): UseCryptoTransactions {
  const [transactions, setTransactions] = useState<CryptoTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const taiLai = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('crypto_transactions')
      .select('*')
      .order('trade_date', { ascending: false })
      .order('created_at', { ascending: false });
    if (err) throw new Error(dienGiaiLoi(err.message));
    setTransactions((data ?? []) as CryptoTransaction[]);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    taiLai()
      .catch((err: unknown) => {
        if (!active) return;
        console.error('Lỗi tải sổ giao dịch crypto:', err);
        setError('Không tải được sổ giao dịch: ' + (err instanceof Error ? err.message : String(err)));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [userId, taiLai]);

  // Ném lỗi lên cho form hiện cạnh ô nhập — không chỉ set state ở đây, vì form
  // cần biết lần ghi thất bại để không xoá trắng những gì người dùng đã gõ.
  const record = useCallback(async (coin: Crypto, input: NewCryptoTransaction) => {
    const before = {
      quantity: coin.quantity,
      avg_buy_price: coin.avg_buy_price,
      invested_amount: coin.invested_amount,
    };
    const { after, realizedPnlVnd } = applyTx(before, input);

    const { error: err } = await supabase.rpc('record_crypto_transaction', {
      p_crypto_id: coin.id,
      p_side: input.side,
      p_trade_date: input.trade_date,
      p_quantity: input.quantity,
      p_price_usd: input.price_usd,
      p_amount_vnd: input.amount_vnd,
      p_note: input.note,
      p_before_quantity: before.quantity,
      p_before_avg: before.avg_buy_price,
      p_before_invested: before.invested_amount,
      p_after_quantity: after.quantity,
      p_after_avg: after.avg_buy_price,
      p_after_invested: after.invested_amount,
      p_realized_pnl_vnd: realizedPnlVnd,
    });
    if (err) throw new Error(dienGiaiLoi(err.message));
    await taiLai();
    return realizedPnlVnd;
  }, [taiLai]);

  const undo = useCallback(async (txId: string) => {
    const { error: err } = await supabase.rpc('undo_crypto_transaction', { p_tx_id: txId });
    if (err) throw new Error(dienGiaiLoi(err.message));
    await taiLai();
  }, [taiLai]);

  const clearError = useCallback(() => setError(null), []);

  return { transactions, loading, error, record, undo, clearError };
}
