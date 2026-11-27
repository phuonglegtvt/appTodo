-- Migration: XOÁ một giao dịch bất kỳ trong sổ cổ phiếu / crypto.
--
-- Khác `undo_*_transaction` (chỉ xoá được giao dịch MỚI NHẤT): ở đây xoá được
-- giao dịch ở giữa — các giao dịch ghi sau nó của cùng tài sản được tính lại từ
-- trạng thái TRƯỚC của giao dịch bị xoá (như thể nó chưa từng được ghi).
--
-- Phép tính lại ở TypeScript (`planDelete`, src/lib/txChain.ts, có test). Hàm ở
-- đây chỉ GHI và CHẶN, trong MỘT transaction:
--   · tài sản phải còn đúng số liệu lúc lập kế hoạch (`p_expected_*`), nếu không
--     (sửa tay ở bảng / thiết bị khác vừa ghi) ⇒ từ chối;
--   · `p_updates` phải đúng bằng tập giao dịch ghi sau giao dịch bị xoá.
--
-- SECURITY DEFINER vì bảng giao dịch không có policy UPDATE; mọi câu lệnh đều
-- lọc `user_id = auth.uid()`.
--
-- CÁCH DÙNG: Supabase Dashboard → SQL Editor → dán toàn bộ file → Run.
-- Chạy SAU 2026-11-27-tx-edit-move.sql (dùng hàm `tx_ids_khop` ở đó).
-- AN TOÀN CHẠY LẠI NHIỀU LẦN.

-- ===========================================================================
-- CỔ PHIẾU
-- ===========================================================================
create or replace function public.delete_stock_transaction(
  p_tx_id uuid,
  p_expected_quantity numeric, p_expected_invested numeric,
  p_final_quantity numeric, p_final_invested numeric,
  -- [{ id, before_quantity, before_invested, after_quantity, after_invested, realized }]
  p_updates jsonb
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  t public.stock_transactions;
  u jsonb;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập.'; end if;

  select * into t from public.stock_transactions where id = p_tx_id and user_id = auth.uid();
  if not found then raise exception 'Không tìm thấy giao dịch cần xoá.'; end if;

  if not public.tx_ids_khop(p_updates, array(
       select id from public.stock_transactions
        where user_id = auth.uid() and stock_id = t.stock_id and created_at > t.created_at))
  then
    raise exception 'Lịch sử giao dịch vừa thay đổi (có thể từ thiết bị khác). Tải lại trang rồi xoá lại.';
  end if;

  update public.stocks s
     set quantity = p_final_quantity, invested_amount = p_final_invested
   where s.id = t.stock_id and s.user_id = auth.uid()
     and public.crypto_num_gan(s.quantity, p_expected_quantity)
     and public.crypto_num_gan(s.invested_amount, p_expected_invested);
  if not found then
    raise exception 'Mã % đã được sửa tay ở bảng (hoặc vừa đổi từ thiết bị khác) sau giao dịch cuối, nên không tính lại tự động được. Tải lại trang, hoặc sửa số liệu ở bảng.',
      (select ticker from public.stocks where id = t.stock_id);
  end if;

  for u in select * from jsonb_array_elements(coalesce(p_updates, '[]'::jsonb)) loop
    update public.stock_transactions
       set before_quantity = (u->>'before_quantity')::numeric,
           before_invested_amount = (u->>'before_invested')::numeric,
           after_quantity = (u->>'after_quantity')::numeric,
           after_invested_amount = (u->>'after_invested')::numeric,
           realized_pnl_thousand = (u->>'realized')::numeric
     where id = (u->>'id')::uuid and user_id = auth.uid();
  end loop;

  delete from public.stock_transactions where id = t.id and user_id = auth.uid();
end $$;

revoke execute on function public.delete_stock_transaction(uuid, numeric, numeric, numeric, numeric, jsonb) from public, anon;
grant execute on function public.delete_stock_transaction(uuid, numeric, numeric, numeric, numeric, jsonb) to authenticated;

-- ===========================================================================
-- CRYPTO
-- ===========================================================================
create or replace function public.delete_crypto_transaction(
  p_tx_id uuid,
  p_expected_quantity numeric, p_expected_avg numeric, p_expected_invested numeric,
  p_final_quantity numeric, p_final_avg numeric, p_final_invested numeric,
  -- [{ id, before_quantity, before_avg, before_invested, after_quantity, after_avg, after_invested, realized }]
  p_updates jsonb
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  t public.crypto_transactions;
  u jsonb;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập.'; end if;

  select * into t from public.crypto_transactions where id = p_tx_id and user_id = auth.uid();
  if not found then raise exception 'Không tìm thấy giao dịch cần xoá.'; end if;

  if not public.tx_ids_khop(p_updates, array(
       select id from public.crypto_transactions
        where user_id = auth.uid() and crypto_id = t.crypto_id and created_at > t.created_at))
  then
    raise exception 'Lịch sử giao dịch vừa thay đổi (có thể từ thiết bị khác). Tải lại trang rồi xoá lại.';
  end if;

  update public.cryptos c
     set quantity = p_final_quantity, avg_buy_price = p_final_avg, invested_amount = p_final_invested
   where c.id = t.crypto_id and c.user_id = auth.uid()
     and public.crypto_num_gan(c.quantity, p_expected_quantity)
     and public.crypto_num_gan(c.avg_buy_price, p_expected_avg)
     and public.crypto_num_gan(c.invested_amount, p_expected_invested);
  if not found then
    raise exception 'Coin % đã được sửa tay ở bảng (hoặc vừa đổi từ thiết bị khác) sau giao dịch cuối, nên không tính lại tự động được. Tải lại trang, hoặc sửa số liệu ở bảng.',
      (select symbol from public.cryptos where id = t.crypto_id);
  end if;

  for u in select * from jsonb_array_elements(coalesce(p_updates, '[]'::jsonb)) loop
    update public.crypto_transactions
       set before_quantity = (u->>'before_quantity')::numeric,
           before_avg_buy_price = (u->>'before_avg')::numeric,
           before_invested_amount = (u->>'before_invested')::numeric,
           after_quantity = (u->>'after_quantity')::numeric,
           after_avg_buy_price = (u->>'after_avg')::numeric,
           after_invested_amount = (u->>'after_invested')::numeric,
           realized_pnl_vnd = (u->>'realized')::numeric
     where id = (u->>'id')::uuid and user_id = auth.uid();
  end loop;

  delete from public.crypto_transactions where id = t.id and user_id = auth.uid();
end $$;

revoke execute on function public.delete_crypto_transaction(uuid, numeric, numeric, numeric, numeric, numeric, numeric, jsonb) from public, anon;
grant execute on function public.delete_crypto_transaction(uuid, numeric, numeric, numeric, numeric, numeric, numeric, jsonb) to authenticated;
