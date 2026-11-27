import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { applyStockTx, planStockTxDelete, planStockTxEdit, toRecordedStockTxs } from '../lib/stockTransaction';
import type { Recalc } from '../lib/txChain';
import type { StockHolding } from '../lib/stockTransaction';
import type { Stock } from '../types/stock';
import type { NewStockTransaction, StockTransaction } from '../types/stockTransaction';

// Sổ giao dịch cổ phiếu — cùng cách làm với useCryptoTransactions: ghi qua hai
// hàm Postgres (rpc) để "cập nhật mã + thêm giao dịch" là MỘT thao tác nguyên
// tử. Dòng mã trong bảng tự cập nhật nhờ realtime của `useStocks`.

interface UseStockTransactions {
  transactions: StockTransaction[];
  loading: boolean;
  error: string | null;
  /** Trả về lãi/lỗ đã chốt (nghìn đồng) của lệnh bán, để form báo lại. */
  record: (stock: Stock, input: NewStockTransaction) => Promise<number | null>;
  /** Xoá một giao dịch bất kỳ; các giao dịch sau nó của cùng mã tính lại. */
  remove: (txId: string) => Promise<void>;
  /**
   * Sửa một giao dịch đã ghi, có thể chuyển sang mã khác (`stock`). Tính lại
   * mọi giao dịch sau nó của mã cũ và (nếu đổi) của mã mới.
   */
  edit: (txId: string, stock: Stock, input: NewStockTransaction) => Promise<void>;
  clearError: () => void;
}

function dienGiaiLoi(msg: string): string {
  if (/edit_stock_transaction/i.test(msg) && /does not exist|Could not find/i.test(msg)) {
    return 'Chưa chạy migration sửa giao dịch. Vào Supabase → SQL Editor, chạy file '
      + `supabase/migrations/2026-11-27-tx-edit-move.sql rồi thử lại. (Chi tiết: ${msg})`;
  }
  if (/delete_stock_transaction/i.test(msg) && /does not exist|Could not find/i.test(msg)) {
    return 'Chưa chạy migration xoá giao dịch. Vào Supabase → SQL Editor, chạy file '
      + `supabase/migrations/2026-11-27-tx-delete.sql rồi thử lại. (Chi tiết: ${msg})`;
  }
  if (/stock_transactions|record_stock_transaction|undo_stock_transaction/i.test(msg)
    && /does not exist|Could not find/i.test(msg)) {
    return 'Chưa chạy migration sổ giao dịch cổ phiếu. Vào Supabase → SQL Editor, chạy file '
      + `supabase/migrations/2026-11-26-stocks-longterm.sql rồi tải lại trang. (Chi tiết: ${msg})`;
  }
  return msg;
}

/** Kế hoạch tính lại → dạng JSON mà các hàm rpc sửa/xoá đọc. */
function dongCapNhat(us: Recalc<StockHolding>[]) {
  return us.map((u) => ({
    id: u.id,
    before_quantity: u.before.quantity,
    before_invested: u.before.invested_amount,
    after_quantity: u.after.quantity,
    after_invested: u.after.invested_amount,
    realized: u.realized,
  }));
}

export function useStockTransactions(userId: string): UseStockTransactions {
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const taiLai = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('stock_transactions')
      .select('*')
      .order('trade_date', { ascending: false })
      .order('created_at', { ascending: false });
    if (err) throw new Error(dienGiaiLoi(err.message));
    setTransactions((data ?? []) as StockTransaction[]);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    taiLai()
      .catch((err: unknown) => {
        if (!active) return;
        console.error('Lỗi tải sổ giao dịch cổ phiếu:', err);
        setError('Không tải được lịch sử giao dịch: ' + (err instanceof Error ? err.message : String(err)));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [userId, taiLai]);

  const record = useCallback(async (stock: Stock, input: NewStockTransaction) => {
    const before = { quantity: stock.quantity, invested_amount: stock.invested_amount };
    const { after, realizedPnlThousand } = applyStockTx(before, input);

    const { error: err } = await supabase.rpc('record_stock_transaction', {
      p_stock_id: stock.id,
      p_side: input.side,
      p_trade_date: input.trade_date,
      p_quantity: input.quantity,
      p_price_thousand: input.price_thousand,
      p_amount_thousand: input.amount_thousand,
      p_note: input.note,
      p_before_quantity: before.quantity,
      p_before_invested: before.invested_amount,
      p_after_quantity: after.quantity,
      p_after_invested: after.invested_amount,
      p_realized_pnl_thousand: realizedPnlThousand,
    });
    if (err) throw new Error(dienGiaiLoi(err.message));
    await taiLai();
    return realizedPnlThousand;
  }, [taiLai]);

  const remove = useCallback(async (txId: string) => {
    const plan = planStockTxDelete(toRecordedStockTxs(transactions), txId);
    const { error: err } = await supabase.rpc('delete_stock_transaction', {
      p_tx_id: txId,
      p_expected_quantity: plan.expected.quantity,
      p_expected_invested: plan.expected.invested_amount,
      p_final_quantity: plan.final.quantity,
      p_final_invested: plan.final.invested_amount,
      p_updates: dongCapNhat(plan.updates),
    });
    if (err) throw new Error(dienGiaiLoi(err.message));
    await taiLai();
  }, [transactions, taiLai]);

  const edit = useCallback(async (txId: string, stock: Stock, input: NewStockTransaction) => {
    const plan = planStockTxEdit(toRecordedStockTxs(transactions), txId, input, {
      stockId: stock.id,
      current: { quantity: stock.quantity, invested_amount: stock.invested_amount },
    });
    const { source: src, target: dst } = plan;
    const { error: err } = await supabase.rpc('edit_stock_transaction', {
      p_tx_id: txId,
      p_asset_id: stock.id,
      p_side: input.side,
      p_trade_date: input.trade_date,
      p_quantity: input.quantity,
      p_price_thousand: input.price_thousand,
      p_amount_thousand: input.amount_thousand,
      p_note: input.note,
      p_src_expected_quantity: src.expected.quantity,
      p_src_expected_invested: src.expected.invested_amount,
      p_src_final_quantity: src.final.quantity,
      p_src_final_invested: src.final.invested_amount,
      p_src_updates: dongCapNhat(src.updates),
      p_dst_expected_quantity: dst?.expected.quantity ?? null,
      p_dst_expected_invested: dst?.expected.invested_amount ?? null,
      p_dst_final_quantity: dst?.final.quantity ?? null,
      p_dst_final_invested: dst?.final.invested_amount ?? null,
      p_dst_updates: dst ? dongCapNhat(dst.updates) : [],
    });
    if (err) throw new Error(dienGiaiLoi(err.message));
    await taiLai();
  }, [transactions, taiLai]);

  const clearError = useCallback(() => setError(null), []);

  return { transactions, loading, error, record, remove, edit, clearError };
}
