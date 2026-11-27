import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { applyTx, planCryptoTxDelete, planCryptoTxEdit, toRecordedCryptoTxs, type Holding } from '../lib/cryptoTransaction';
import type { Recalc } from '../lib/txChain';
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
  /** Xoá một giao dịch bất kỳ; các giao dịch sau nó của cùng coin tính lại. */
  remove: (txId: string) => Promise<void>;
  /**
   * Sửa một giao dịch đã ghi, có thể chuyển sang coin khác (`coin`). Tính lại
   * mọi giao dịch sau nó của coin cũ và (nếu đổi) của coin mới.
   */
  edit: (txId: string, coin: Crypto, input: NewCryptoTransaction) => Promise<void>;
  clearError: () => void;
}

/** Dịch lỗi "chưa chạy migration" thành việc người dùng làm được. */
function dienGiaiLoi(msg: string): string {
  if (/edit_crypto_transaction/i.test(msg) && /does not exist|Could not find/i.test(msg)) {
    return 'Chưa chạy migration sửa giao dịch. Vào Supabase → SQL Editor, chạy file '
      + `supabase/migrations/2026-11-27-tx-edit-move.sql rồi thử lại. (Chi tiết: ${msg})`;
  }
  if (/delete_crypto_transaction/i.test(msg) && /does not exist|Could not find/i.test(msg)) {
    return 'Chưa chạy migration xoá giao dịch. Vào Supabase → SQL Editor, chạy file '
      + `supabase/migrations/2026-11-27-tx-delete.sql rồi thử lại. (Chi tiết: ${msg})`;
  }
  if (/crypto_transactions|record_crypto_transaction|undo_crypto_transaction/i.test(msg)
    && /does not exist|Could not find/i.test(msg)) {
    return 'Chưa chạy migration sổ giao dịch crypto. Vào Supabase → SQL Editor, chạy file '
      + `supabase/migrations/2026-11-26-crypto-transactions.sql rồi tải lại trang. (Chi tiết: ${msg})`;
  }
  return msg;
}

/** Kế hoạch tính lại → dạng JSON mà các hàm rpc sửa/xoá đọc. */
function dongCapNhat(us: Recalc<Holding>[]) {
  return us.map((u) => ({
    id: u.id,
    before_quantity: u.before.quantity,
    before_avg: u.before.avg_buy_price,
    before_invested: u.before.invested_amount,
    after_quantity: u.after.quantity,
    after_avg: u.after.avg_buy_price,
    after_invested: u.after.invested_amount,
    realized: u.realized,
  }));
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

  const remove = useCallback(async (txId: string) => {
    const plan = planCryptoTxDelete(toRecordedCryptoTxs(transactions), txId);
    const { error: err } = await supabase.rpc('delete_crypto_transaction', {
      p_tx_id: txId,
      p_expected_quantity: plan.expected.quantity,
      p_expected_avg: plan.expected.avg_buy_price,
      p_expected_invested: plan.expected.invested_amount,
      p_final_quantity: plan.final.quantity,
      p_final_avg: plan.final.avg_buy_price,
      p_final_invested: plan.final.invested_amount,
      p_updates: dongCapNhat(plan.updates),
    });
    if (err) throw new Error(dienGiaiLoi(err.message));
    await taiLai();
  }, [transactions, taiLai]);

  const edit = useCallback(async (txId: string, coin: Crypto, input: NewCryptoTransaction) => {
    const plan = planCryptoTxEdit(toRecordedCryptoTxs(transactions), txId, input, {
      cryptoId: coin.id,
      current: { quantity: coin.quantity, avg_buy_price: coin.avg_buy_price, invested_amount: coin.invested_amount },
    });
    const { source: src, target: dst } = plan;
    const { error: err } = await supabase.rpc('edit_crypto_transaction', {
      p_tx_id: txId,
      p_asset_id: coin.id,
      p_side: input.side,
      p_trade_date: input.trade_date,
      p_quantity: input.quantity,
      p_price_usd: input.price_usd,
      p_amount_vnd: input.amount_vnd,
      p_note: input.note,
      p_src_expected_quantity: src.expected.quantity,
      p_src_expected_avg: src.expected.avg_buy_price,
      p_src_expected_invested: src.expected.invested_amount,
      p_src_final_quantity: src.final.quantity,
      p_src_final_avg: src.final.avg_buy_price,
      p_src_final_invested: src.final.invested_amount,
      p_src_updates: dongCapNhat(src.updates),
      p_dst_expected_quantity: dst?.expected.quantity ?? null,
      p_dst_expected_avg: dst?.expected.avg_buy_price ?? null,
      p_dst_expected_invested: dst?.expected.invested_amount ?? null,
      p_dst_final_quantity: dst?.final.quantity ?? null,
      p_dst_final_avg: dst?.final.avg_buy_price ?? null,
      p_dst_final_invested: dst?.final.invested_amount ?? null,
      p_dst_updates: dst ? dongCapNhat(dst.updates) : [],
    });
    if (err) throw new Error(dienGiaiLoi(err.message));
    await taiLai();
  }, [transactions, taiLai]);

  const clearError = useCallback(() => setError(null), []);

  return { transactions, loading, error, record, remove, edit, clearError };
}
