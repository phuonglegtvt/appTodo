-- Migration: sửa giao dịch — cho phép ĐỔI MÃ / ĐỔI COIN, và thêm sửa cho sổ crypto.
--
-- Thay hàm `edit_stock_transaction` của 2026-11-27-stock-tx-edit.sql (thêm tham
-- số mã mới + kế hoạch cho mã mới) và tạo `edit_crypto_transaction` cùng khuôn.
--
-- Phép tính lại nằm ở TypeScript (src/lib/txChain.ts, có test). Hàm ở đây chỉ
-- GHI và CHẶN, tất cả trong MỘT transaction:
--   · tài sản gốc  (src): cập nhật số cuối + TRƯỚC/SAU của các giao dịch sau X;
--   · tài sản mới  (dst, chỉ khi đổi mã): cập nhật số cuối + X + các giao dịch
--     ghi sau X của tài sản mới;
--   · từ chối nếu tài sản không còn đúng số liệu lúc lập kế hoạch, hoặc danh
--     sách giao dịch gửi lên không khớp đúng phần cần tính lại.
--
-- Hai dạng gọi:
--   · KHÔNG đổi mã: p_asset_id = mã hiện tại; p_src_updates = [X, các giao dịch
--     sau X]; nhóm p_dst_* để null / '[]'.
--   · ĐỔI mã:       p_asset_id = mã mới; p_src_updates = [các giao dịch sau X]
--     (có thể rỗng); p_dst_updates = [X, các giao dịch của mã mới ghi sau X].
--
-- SECURITY DEFINER vì hai bảng giao dịch không có policy UPDATE; bù lại MỌI câu
-- lệnh đều lọc `user_id = auth.uid()`.
--
-- CÁCH DÙNG: Supabase Dashboard → SQL Editor → dán toàn bộ file → Run.
-- Chạy SAU 2026-11-27-stock-tx-edit.sql. AN TOÀN CHẠY LẠI NHIỀU LẦN.

-- ===========================================================================
-- Kiểm tra danh sách id gửi lên khớp ĐÚNG tập giao dịch cần tính lại.
-- ===========================================================================
create or replace function public.tx_ids_khop(p_updates jsonb, p_expected uuid[])
returns boolean language sql immutable as $$
  select coalesce(jsonb_array_length(p_updates), 0) = coalesce(array_length(p_expected, 1), 0)
     and not exists (
       select 1 from jsonb_array_elements(coalesce(p_updates, '[]'::jsonb)) e
        where not ((e->>'id')::uuid = any (coalesce(p_expected, '{}')))
     );
$$;

-- ===========================================================================
-- CỔ PHIẾU
-- ===========================================================================
drop function if exists public.edit_stock_transaction(
  uuid, text, date, numeric, numeric, numeric, text, numeric, numeric, numeric, numeric, jsonb
);

create or replace function public.edit_stock_transaction(
  p_tx_id uuid, p_asset_id uuid,
  p_side text, p_trade_date date,
  p_quantity numeric, p_price_thousand numeric, p_amount_thousand numeric, p_note text,
  p_src_expected_quantity numeric, p_src_expected_invested numeric,
  p_src_final_quantity numeric, p_src_final_invested numeric,
  p_src_updates jsonb,
  p_dst_expected_quantity numeric, p_dst_expected_invested numeric,
  p_dst_final_quantity numeric, p_dst_final_invested numeric,
  p_dst_updates jsonb
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  t public.stock_transactions;
  doi_ma boolean;
  u jsonb;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập.'; end if;

  select * into t from public.stock_transactions where id = p_tx_id and user_id = auth.uid();
  if not found then raise exception 'Không tìm thấy giao dịch cần sửa.'; end if;
  doi_ma := p_asset_id is distinct from t.stock_id;

  if doi_ma then
    if not exists (select 1 from public.stocks where id = p_asset_id and user_id = auth.uid()) then
      raise exception 'Không tìm thấy mã mới.';
    end if;
    if not public.tx_ids_khop(p_src_updates, array(
         select id from public.stock_transactions
          where user_id = auth.uid() and stock_id = t.stock_id and created_at > t.created_at))
       or not public.tx_ids_khop(p_dst_updates, array(
         select id from public.stock_transactions
          where user_id = auth.uid() and (id = t.id or (stock_id = p_asset_id and created_at > t.created_at))))
    then
      raise exception 'Lịch sử giao dịch vừa thay đổi (có thể từ thiết bị khác). Tải lại trang rồi sửa lại.';
    end if;
  else
    if not public.tx_ids_khop(p_src_updates, array(
         select id from public.stock_transactions
          where user_id = auth.uid() and stock_id = t.stock_id and created_at >= t.created_at))
    then
      raise exception 'Lịch sử giao dịch vừa thay đổi (có thể từ thiết bị khác). Tải lại trang rồi sửa lại.';
    end if;
  end if;

  update public.stocks s
     set quantity = p_src_final_quantity, invested_amount = p_src_final_invested
   where s.id = t.stock_id and s.user_id = auth.uid()
     and public.crypto_num_gan(s.quantity, p_src_expected_quantity)
     and public.crypto_num_gan(s.invested_amount, p_src_expected_invested);
  if not found then
    raise exception 'Mã % đã được sửa tay ở bảng (hoặc vừa đổi từ thiết bị khác) sau giao dịch cuối, nên không tính lại tự động được. Tải lại trang, hoặc sửa số liệu ở bảng.',
      (select ticker from public.stocks where id = t.stock_id);
  end if;

  if doi_ma then
    update public.stocks s
       set quantity = p_dst_final_quantity, invested_amount = p_dst_final_invested
     where s.id = p_asset_id and s.user_id = auth.uid()
       and public.crypto_num_gan(s.quantity, p_dst_expected_quantity)
       and public.crypto_num_gan(s.invested_amount, p_dst_expected_invested);
    if not found then
      raise exception 'Mã % đã được sửa tay ở bảng (hoặc vừa đổi từ thiết bị khác), nên không chuyển giao dịch sang được. Tải lại trang, hoặc sửa số liệu ở bảng.',
        (select ticker from public.stocks where id = p_asset_id);
    end if;
  end if;

  update public.stock_transactions
     set stock_id = p_asset_id, side = p_side, trade_date = p_trade_date,
         quantity = p_quantity, price_thousand = p_price_thousand,
         amount_thousand = p_amount_thousand, note = coalesce(p_note, '')
   where id = p_tx_id and user_id = auth.uid();

  for u in select * from jsonb_array_elements(coalesce(p_src_updates, '[]'::jsonb) || coalesce(p_dst_updates, '[]'::jsonb)) loop
    update public.stock_transactions
       set before_quantity = (u->>'before_quantity')::numeric,
           before_invested_amount = (u->>'before_invested')::numeric,
           after_quantity = (u->>'after_quantity')::numeric,
           after_invested_amount = (u->>'after_invested')::numeric,
           realized_pnl_thousand = (u->>'realized')::numeric
     where id = (u->>'id')::uuid and user_id = auth.uid();
  end loop;
end $$;

revoke execute on function public.edit_stock_transaction(
  uuid, uuid, text, date, numeric, numeric, numeric, text,
  numeric, numeric, numeric, numeric, jsonb, numeric, numeric, numeric, numeric, jsonb
) from public, anon;
grant execute on function public.edit_stock_transaction(
  uuid, uuid, text, date, numeric, numeric, numeric, text,
  numeric, numeric, numeric, numeric, jsonb, numeric, numeric, numeric, numeric, jsonb
) to authenticated;

-- ===========================================================================
-- CRYPTO (ba cột: quantity, avg_buy_price USD, invested_amount VND)
-- ===========================================================================
create or replace function public.edit_crypto_transaction(
  p_tx_id uuid, p_asset_id uuid,
  p_side text, p_trade_date date,
  p_quantity numeric, p_price_usd numeric, p_amount_vnd numeric, p_note text,
  p_src_expected_quantity numeric, p_src_expected_avg numeric, p_src_expected_invested numeric,
  p_src_final_quantity numeric, p_src_final_avg numeric, p_src_final_invested numeric,
  p_src_updates jsonb,
  p_dst_expected_quantity numeric, p_dst_expected_avg numeric, p_dst_expected_invested numeric,
  p_dst_final_quantity numeric, p_dst_final_avg numeric, p_dst_final_invested numeric,
  p_dst_updates jsonb
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  t public.crypto_transactions;
  doi_coin boolean;
  u jsonb;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập.'; end if;

  select * into t from public.crypto_transactions where id = p_tx_id and user_id = auth.uid();
  if not found then raise exception 'Không tìm thấy giao dịch cần sửa.'; end if;
  doi_coin := p_asset_id is distinct from t.crypto_id;

  if doi_coin then
    if not exists (select 1 from public.cryptos where id = p_asset_id and user_id = auth.uid()) then
      raise exception 'Không tìm thấy coin mới.';
    end if;
    if not public.tx_ids_khop(p_src_updates, array(
         select id from public.crypto_transactions
          where user_id = auth.uid() and crypto_id = t.crypto_id and created_at > t.created_at))
       or not public.tx_ids_khop(p_dst_updates, array(
         select id from public.crypto_transactions
          where user_id = auth.uid() and (id = t.id or (crypto_id = p_asset_id and created_at > t.created_at))))
    then
      raise exception 'Lịch sử giao dịch vừa thay đổi (có thể từ thiết bị khác). Tải lại trang rồi sửa lại.';
    end if;
  else
    if not public.tx_ids_khop(p_src_updates, array(
         select id from public.crypto_transactions
          where user_id = auth.uid() and crypto_id = t.crypto_id and created_at >= t.created_at))
    then
      raise exception 'Lịch sử giao dịch vừa thay đổi (có thể từ thiết bị khác). Tải lại trang rồi sửa lại.';
    end if;
  end if;

  update public.cryptos c
     set quantity = p_src_final_quantity, avg_buy_price = p_src_final_avg, invested_amount = p_src_final_invested
   where c.id = t.crypto_id and c.user_id = auth.uid()
     and public.crypto_num_gan(c.quantity, p_src_expected_quantity)
     and public.crypto_num_gan(c.avg_buy_price, p_src_expected_avg)
     and public.crypto_num_gan(c.invested_amount, p_src_expected_invested);
  if not found then
    raise exception 'Coin % đã được sửa tay ở bảng (hoặc vừa đổi từ thiết bị khác) sau giao dịch cuối, nên không tính lại tự động được. Tải lại trang, hoặc sửa số liệu ở bảng.',
      (select symbol from public.cryptos where id = t.crypto_id);
  end if;

  if doi_coin then
    update public.cryptos c
       set quantity = p_dst_final_quantity, avg_buy_price = p_dst_final_avg, invested_amount = p_dst_final_invested
     where c.id = p_asset_id and c.user_id = auth.uid()
       and public.crypto_num_gan(c.quantity, p_dst_expected_quantity)
       and public.crypto_num_gan(c.avg_buy_price, p_dst_expected_avg)
       and public.crypto_num_gan(c.invested_amount, p_dst_expected_invested);
    if not found then
      raise exception 'Coin % đã được sửa tay ở bảng (hoặc vừa đổi từ thiết bị khác), nên không chuyển giao dịch sang được. Tải lại trang, hoặc sửa số liệu ở bảng.',
        (select symbol from public.cryptos where id = p_asset_id);
    end if;
  end if;

  update public.crypto_transactions
     set crypto_id = p_asset_id, side = p_side, trade_date = p_trade_date,
         quantity = p_quantity, price_usd = p_price_usd,
         amount_vnd = p_amount_vnd, note = coalesce(p_note, '')
   where id = p_tx_id and user_id = auth.uid();

  for u in select * from jsonb_array_elements(coalesce(p_src_updates, '[]'::jsonb) || coalesce(p_dst_updates, '[]'::jsonb)) loop
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
end $$;

revoke execute on function public.edit_crypto_transaction(
  uuid, uuid, text, date, numeric, numeric, numeric, text,
  numeric, numeric, numeric, numeric, numeric, numeric, jsonb,
  numeric, numeric, numeric, numeric, numeric, numeric, jsonb
) from public, anon;
grant execute on function public.edit_crypto_transaction(
  uuid, uuid, text, date, numeric, numeric, numeric, text,
  numeric, numeric, numeric, numeric, numeric, numeric, jsonb,
  numeric, numeric, numeric, numeric, numeric, numeric, jsonb
) to authenticated;
