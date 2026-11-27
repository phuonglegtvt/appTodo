-- Migration: cho phép SỬA một giao dịch cổ phiếu đã ghi.
--
-- Bảng `stock_transactions` cố ý KHÔNG có policy UPDATE: sửa thẳng một dòng sẽ
-- làm đứt dây chuyền TRƯỚC/SAU giữa các giao dịch và lệch với `public.stocks`.
-- Thay vào đó, mọi lần sửa đi qua hàm dưới đây:
--   · Phép tính lại nằm ở TypeScript (`planStockTxEdit`, src/lib/stockTransaction.ts,
--     có test). Hàm này chỉ GHI và CHẶN.
--   · Trong MỘT transaction: cập nhật mã + giao dịch được sửa + mọi giao dịch
--     sau nó. Hỏng ở bước nào thì không có gì được ghi.
--   · Chặn khi mã đã đổi so với lúc lập kế hoạch (thiết bị khác vừa ghi, hoặc
--     sửa tay ở bảng), và khi danh sách giao dịch sau nó không khớp.
--
-- SECURITY DEFINER vì bảng không có policy UPDATE; bù lại MỌI câu lệnh đều lọc
-- `user_id = auth.uid()` nên không chạm được dữ liệu người khác.
--
-- CÁCH DÙNG: Supabase Dashboard → SQL Editor → dán toàn bộ file → Run.
-- Cần chạy SAU 2026-11-26-stocks-longterm.sql. AN TOÀN CHẠY LẠI NHIỀU LẦN.

create or replace function public.edit_stock_transaction(
  p_tx_id uuid,
  p_side text, p_trade_date date,
  p_quantity numeric, p_price_thousand numeric, p_amount_thousand numeric, p_note text,
  p_expected_quantity numeric, p_expected_invested numeric,
  p_final_quantity numeric, p_final_invested numeric,
  -- [{ id, before_quantity, before_invested, after_quantity, after_invested, realized_pnl }]
  -- theo thứ tự ghi, phần tử đầu là chính giao dịch được sửa.
  p_updates jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.stock_transactions;
  u jsonb;
  v_can_sua int;
  v_gui int;
begin
  if auth.uid() is null then
    raise exception 'Chưa đăng nhập.';
  end if;

  select * into t from public.stock_transactions
   where id = p_tx_id and user_id = auth.uid();
  if not found then
    raise exception 'Không tìm thấy giao dịch cần sửa.';
  end if;

  -- Danh sách gửi lên phải đúng bằng "giao dịch này + mọi giao dịch sau nó".
  select count(*) into v_can_sua from public.stock_transactions
   where stock_id = t.stock_id and user_id = auth.uid() and created_at >= t.created_at;
  select count(*) into v_gui from public.stock_transactions s
   where s.user_id = auth.uid() and s.stock_id = t.stock_id and s.created_at >= t.created_at
     and s.id in (select (e->>'id')::uuid from jsonb_array_elements(p_updates) e);
  if v_can_sua <> v_gui or v_gui <> jsonb_array_length(p_updates)
     or (p_updates->0->>'id')::uuid <> p_tx_id then
    raise exception 'Lịch sử giao dịch của mã vừa thay đổi (có thể từ thiết bị khác). Tải lại trang rồi sửa lại.';
  end if;

  update public.stocks s
     set quantity = p_final_quantity,
         invested_amount = p_final_invested
   where s.id = t.stock_id
     and s.user_id = auth.uid()
     and public.crypto_num_gan(s.quantity, p_expected_quantity)
     and public.crypto_num_gan(s.invested_amount, p_expected_invested);
  if not found then
    raise exception 'Mã đã được sửa tay ở bảng (hoặc vừa đổi từ thiết bị khác) sau giao dịch cuối, nên không tính lại tự động được. Tải lại trang, hoặc sửa số liệu ở bảng.';
  end if;

  update public.stock_transactions
     set side = p_side,
         trade_date = p_trade_date,
         quantity = p_quantity,
         price_thousand = p_price_thousand,
         amount_thousand = p_amount_thousand,
         note = coalesce(p_note, '')
   where id = p_tx_id and user_id = auth.uid();

  for u in select * from jsonb_array_elements(p_updates) loop
    update public.stock_transactions
       set before_quantity = (u->>'before_quantity')::numeric,
           before_invested_amount = (u->>'before_invested')::numeric,
           after_quantity = (u->>'after_quantity')::numeric,
           after_invested_amount = (u->>'after_invested')::numeric,
           realized_pnl_thousand = (u->>'realized_pnl')::numeric
     where id = (u->>'id')::uuid and user_id = auth.uid() and stock_id = t.stock_id;
  end loop;
end $$;

-- Người chưa đăng nhập không có lý do gọi hàm này. Hàm mới mặc định cấp quyền
-- chạy cho PUBLIC (gồm cả anon), nên thu lại rồi chỉ cấp cho `authenticated`.
revoke execute on function public.edit_stock_transaction(
  uuid, text, date, numeric, numeric, numeric, text, numeric, numeric, numeric, numeric, jsonb
) from public, anon;
grant execute on function public.edit_stock_transaction(
  uuid, text, date, numeric, numeric, numeric, text, numeric, numeric, numeric, numeric, jsonb
) to authenticated;
