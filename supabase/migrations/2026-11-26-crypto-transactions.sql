-- Migration: sổ giao dịch crypto (MUA / BÁN) tự cộng dồn vào bảng `public.cryptos`.
--
-- MÔ HÌNH "cộng dồn lên số cũ": `public.cryptos` vẫn giữ số đang có. Mỗi giao
-- dịch lưu trạng thái TRƯỚC và SAU của ba cột quantity / avg_buy_price /
-- invested_amount. Phép tính nằm ở client (src/lib/cryptoTransaction.ts, có
-- test); hai hàm dưới đây chỉ GHI NGUYÊN TỬ và chặn ghi đè:
--   · record_crypto_transaction: cập nhật coin + thêm giao dịch trong CÙNG một
--     transaction, và chỉ khi coin vẫn đúng trạng thái TRƯỚC mà client đã tính
--     (máy khác vừa sửa ⇒ từ chối, không ghi đè lặng lẽ).
--   · undo_crypto_transaction: chỉ hoàn tác giao dịch MỚI NHẤT của coin, và chỉ
--     khi coin vẫn đúng trạng thái SAU của nó (đã sửa tay ⇒ từ chối).
--
-- ĐƠN VỊ: quantity = số coin · price_usd = USD/coin · amount_vnd, invested,
-- realized_pnl_vnd = ĐỒNG tuyệt đối · avg_buy_price = USD/coin.
--
-- CÁCH DÙNG: Supabase Dashboard → SQL Editor → dán toàn bộ file → Run.
-- AN TOÀN CHẠY LẠI NHIỀU LẦN (idempotent).

create table if not exists public.crypto_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  crypto_id uuid not null references public.cryptos (id) on delete cascade,
  side text not null check (side in ('BUY', 'SELL')),
  trade_date date not null,
  quantity numeric not null check (quantity > 0),
  price_usd numeric not null check (price_usd > 0),
  amount_vnd numeric not null check (amount_vnd >= 0),
  note text not null default '',
  before_quantity numeric,
  before_avg_buy_price numeric,
  before_invested_amount numeric,
  after_quantity numeric,
  after_avg_buy_price numeric,
  after_invested_amount numeric,
  realized_pnl_vnd numeric,
  created_at timestamptz not null default now()
);

create index if not exists crypto_transactions_crypto_idx
  on public.crypto_transactions (crypto_id, created_at desc);

alter table public.crypto_transactions enable row level security;

drop policy if exists "crypto_tx_select_own" on public.crypto_transactions;
create policy "crypto_tx_select_own" on public.crypto_transactions
  for select using (auth.uid() = user_id);

drop policy if exists "crypto_tx_insert_own" on public.crypto_transactions;
create policy "crypto_tx_insert_own" on public.crypto_transactions
  for insert with check (auth.uid() = user_id);

-- Không có policy UPDATE: giao dịch đã ghi là bất biến (sai thì hoàn tác rồi ghi lại).
drop policy if exists "crypto_tx_delete_own" on public.crypto_transactions;
create policy "crypto_tx_delete_own" on public.crypto_transactions
  for delete using (auth.uid() = user_id);

-- So hai số "gần bằng": giá trị đi qua JSON của trình duyệt (số thực) nên có
-- thể lệch vài chữ số cuối so với numeric trong DB.
create or replace function public.crypto_num_gan(a numeric, b numeric)
returns boolean language sql immutable as $$
  select case
    when a is null or b is null then a is null and b is null
    else abs(a - b) <= 1e-9 * greatest(1, abs(a), abs(b))
  end;
$$;

-- SECURITY INVOKER (mặc định): RLS của cả hai bảng vẫn áp dụng.
create or replace function public.record_crypto_transaction(
  p_crypto_id uuid, p_side text, p_trade_date date,
  p_quantity numeric, p_price_usd numeric, p_amount_vnd numeric, p_note text,
  p_before_quantity numeric, p_before_avg numeric, p_before_invested numeric,
  p_after_quantity numeric, p_after_avg numeric, p_after_invested numeric,
  p_realized_pnl_vnd numeric
) returns uuid language plpgsql as $$
declare
  v_id uuid;
begin
  update public.cryptos c
     set quantity = p_after_quantity,
         avg_buy_price = p_after_avg,
         invested_amount = p_after_invested
   where c.id = p_crypto_id
     and c.user_id = auth.uid()
     and public.crypto_num_gan(c.quantity, p_before_quantity)
     and public.crypto_num_gan(c.avg_buy_price, p_before_avg)
     and public.crypto_num_gan(c.invested_amount, p_before_invested);
  if not found then
    raise exception 'Số liệu coin vừa thay đổi (có thể từ thiết bị khác) hoặc coin không tồn tại. Tải lại trang rồi thử lại.';
  end if;

  insert into public.crypto_transactions (
    crypto_id, side, trade_date, quantity, price_usd, amount_vnd, note,
    before_quantity, before_avg_buy_price, before_invested_amount,
    after_quantity, after_avg_buy_price, after_invested_amount, realized_pnl_vnd
  ) values (
    p_crypto_id, p_side, p_trade_date, p_quantity, p_price_usd, p_amount_vnd,
    coalesce(p_note, ''),
    p_before_quantity, p_before_avg, p_before_invested,
    p_after_quantity, p_after_avg, p_after_invested, p_realized_pnl_vnd
  ) returning id into v_id;
  return v_id;
end $$;

create or replace function public.undo_crypto_transaction(p_tx_id uuid)
returns void language plpgsql as $$
declare
  t public.crypto_transactions;
begin
  select * into t from public.crypto_transactions
   where id = p_tx_id and user_id = auth.uid();
  if not found then
    raise exception 'Không tìm thấy giao dịch cần hoàn tác.';
  end if;

  if exists (
    select 1 from public.crypto_transactions
     where crypto_id = t.crypto_id and created_at > t.created_at
  ) then
    raise exception 'Chỉ hoàn tác được giao dịch mới nhất của coin này. Hoàn tác các giao dịch sau nó trước.';
  end if;

  update public.cryptos c
     set quantity = t.before_quantity,
         avg_buy_price = t.before_avg_buy_price,
         invested_amount = t.before_invested_amount
   where c.id = t.crypto_id
     and c.user_id = auth.uid()
     and public.crypto_num_gan(c.quantity, t.after_quantity)
     and public.crypto_num_gan(c.avg_buy_price, t.after_avg_buy_price)
     and public.crypto_num_gan(c.invested_amount, t.after_invested_amount);
  if not found then
    raise exception 'Coin đã được sửa tay sau giao dịch này nên không hoàn tác tự động được (sẽ xoá mất phần sửa). Sửa lại số liệu ở bảng cho đúng.';
  end if;

  delete from public.crypto_transactions where id = t.id;
end $$;
