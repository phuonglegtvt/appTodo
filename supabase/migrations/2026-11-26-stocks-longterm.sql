-- Migration: thêm nhóm cổ phiếu "Đầu tư dài hạn" (`longterm`).
--
-- Ràng buộc cũ chỉ cho 'attack' | 'balance' | 'defense' (xem 2026-07-11-stocks.sql).
-- Tên constraint do Postgres tự đặt khi tạo bảng là `stocks_group_check`.
--
-- CÁCH DÙNG: Supabase Dashboard → SQL Editor → dán toàn bộ file → Run.
-- AN TOÀN CHẠY LẠI NHIỀU LẦN (idempotent).

alter table public.stocks drop constraint if exists stocks_group_check;
alter table public.stocks
  add constraint stocks_group_check
  check ("group" in ('attack', 'balance', 'defense', 'longterm'));

-- ===========================================================================
-- Sổ giao dịch cổ phiếu (MUA / BÁN) tự cộng dồn vào `public.stocks`.
-- Cùng khuôn với sổ crypto (2026-11-26-crypto-transactions.sql) — dùng lại hàm
-- `public.crypto_num_gan` đã tạo ở đó, nên PHẢI chạy file crypto trước.
--
-- ĐƠN VỊ: quantity = số cổ · price_thousand, amount_thousand, invested,
-- realized_pnl_thousand = NGHÌN ĐỒNG (khớp `stocks.invested_amount`).
-- ===========================================================================

create table if not exists public.stock_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  stock_id uuid not null references public.stocks (id) on delete cascade,
  side text not null check (side in ('BUY', 'SELL')),
  trade_date date not null,
  quantity numeric not null check (quantity > 0),
  price_thousand numeric not null check (price_thousand > 0),
  amount_thousand numeric not null check (amount_thousand >= 0),
  note text not null default '',
  before_quantity numeric,
  before_invested_amount numeric,
  after_quantity numeric,
  after_invested_amount numeric,
  realized_pnl_thousand numeric,
  created_at timestamptz not null default now()
);

create index if not exists stock_transactions_stock_idx
  on public.stock_transactions (stock_id, created_at desc);

alter table public.stock_transactions enable row level security;

drop policy if exists "stock_tx_select_own" on public.stock_transactions;
create policy "stock_tx_select_own" on public.stock_transactions
  for select using (auth.uid() = user_id);

drop policy if exists "stock_tx_insert_own" on public.stock_transactions;
create policy "stock_tx_insert_own" on public.stock_transactions
  for insert with check (auth.uid() = user_id);

-- Không có policy UPDATE: giao dịch đã ghi là bất biến (sai thì hoàn tác rồi ghi lại).
drop policy if exists "stock_tx_delete_own" on public.stock_transactions;
create policy "stock_tx_delete_own" on public.stock_transactions
  for delete using (auth.uid() = user_id);

create or replace function public.record_stock_transaction(
  p_stock_id uuid, p_side text, p_trade_date date,
  p_quantity numeric, p_price_thousand numeric, p_amount_thousand numeric, p_note text,
  p_before_quantity numeric, p_before_invested numeric,
  p_after_quantity numeric, p_after_invested numeric,
  p_realized_pnl_thousand numeric
) returns uuid language plpgsql as $$
declare
  v_id uuid;
begin
  update public.stocks s
     set quantity = p_after_quantity,
         invested_amount = p_after_invested
   where s.id = p_stock_id
     and s.user_id = auth.uid()
     and public.crypto_num_gan(s.quantity, p_before_quantity)
     and public.crypto_num_gan(s.invested_amount, p_before_invested);
  if not found then
    raise exception 'Số liệu mã vừa thay đổi (có thể từ thiết bị khác) hoặc mã không tồn tại. Tải lại trang rồi thử lại.';
  end if;

  insert into public.stock_transactions (
    stock_id, side, trade_date, quantity, price_thousand, amount_thousand, note,
    before_quantity, before_invested_amount,
    after_quantity, after_invested_amount, realized_pnl_thousand
  ) values (
    p_stock_id, p_side, p_trade_date, p_quantity, p_price_thousand, p_amount_thousand,
    coalesce(p_note, ''),
    p_before_quantity, p_before_invested,
    p_after_quantity, p_after_invested, p_realized_pnl_thousand
  ) returning id into v_id;
  return v_id;
end $$;

create or replace function public.undo_stock_transaction(p_tx_id uuid)
returns void language plpgsql as $$
declare
  t public.stock_transactions;
begin
  select * into t from public.stock_transactions
   where id = p_tx_id and user_id = auth.uid();
  if not found then
    raise exception 'Không tìm thấy giao dịch cần hoàn tác.';
  end if;

  if exists (
    select 1 from public.stock_transactions
     where stock_id = t.stock_id and created_at > t.created_at
  ) then
    raise exception 'Chỉ hoàn tác được giao dịch mới nhất của mã này. Hoàn tác các giao dịch sau nó trước.';
  end if;

  update public.stocks s
     set quantity = t.before_quantity,
         invested_amount = t.before_invested_amount
   where s.id = t.stock_id
     and s.user_id = auth.uid()
     and public.crypto_num_gan(s.quantity, t.after_quantity)
     and public.crypto_num_gan(s.invested_amount, t.after_invested_amount);
  if not found then
    raise exception 'Mã đã được sửa tay sau giao dịch này nên không hoàn tác tự động được (sẽ xoá mất phần sửa). Sửa lại số liệu ở bảng cho đúng.';
  end if;

  delete from public.stock_transactions where id = t.id;
end $$;
