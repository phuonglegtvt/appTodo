import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { applyStockTx, planStockTxEdit, recordedChainOf } from '../lib/stockTransaction';
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
  undo: (txId: string) => Promise<void>;
  /** Sửa một giao dịch đã ghi; tính lại mọi giao dịch sau nó của cùng mã. */
  edit: (txId: string, input: NewStockTransaction) => Promise<void>;
  clearError: () => void;
}

function dienGiaiLoi(msg: string): string {
  if (/edit_stock_transaction/i.test(msg) && /does not exist|Could not find/i.test(msg)) {
    return 'Chưa chạy migration sửa giao dịch. Vào Supabase → SQL Editor, chạy file '
      + `supabase/migrations/2026-11-27-stock-tx-edit.sql rồi thử lại. (Chi tiết: ${msg})`;
  }
  if (/stock_transactions|record_stock_transaction|undo_stock_transaction/i.test(msg)
    && /does not exist|Could not find/i.test(msg)) {
    return 'Chưa chạy migration sổ giao dịch cổ phiếu. Vào Supabase → SQL Editor, chạy file '
      + `supabase/migrations/2026-11-26-stocks-longterm.sql rồi tải lại trang. (Chi tiết: ${msg})`;
  }
  return msg;
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

  const undo = useCallback(async (txId: string) => {
    const { error: err } = await supabase.rpc('undo_stock_transaction', { p_tx_id: txId });
    if (err) throw new Error(dienGiaiLoi(err.message));
    await taiLai();
  }, [taiLai]);

  const edit = useCallback(async (txId: string, input: NewStockTransaction) => {
    const goc = transactions.find((t) => t.id === txId);
    if (!goc) throw new Error('Không tìm thấy giao dịch cần sửa — tải lại trang.');
    const plan = planStockTxEdit(recordedChainOf(transactions, goc.stock_id), txId, input);

    const { error: err } = await supabase.rpc('edit_stock_transaction', {
      p_tx_id: txId,
      p_side: input.side,
      p_trade_date: input.trade_date,
      p_quantity: input.quantity,
      p_price_thousand: input.price_thousand,
      p_amount_thousand: input.amount_thousand,
      p_note: input.note,
      p_expected_quantity: plan.expectedCurrent.quantity,
      p_expected_invested: plan.expectedCurrent.invested_amount,
      p_final_quantity: plan.final.quantity,
      p_final_invested: plan.final.invested_amount,
      p_updates: plan.updates.map((u) => ({
        id: u.id,
        before_quantity: u.before.quantity,
        before_invested: u.before.invested_amount,
        after_quantity: u.after.quantity,
        after_invested: u.after.invested_amount,
        realized_pnl: u.realizedPnlThousand,
      })),
    });
    if (err) throw new Error(dienGiaiLoi(err.message));
    await taiLai();
  }, [transactions, taiLai]);

  const clearError = useCallback(() => setError(null), []);

  return { transactions, loading, error, record, undo, edit, clearError };
}
