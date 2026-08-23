-- Migration: 3 view suy ra vị thế từ sổ giao dịch bất biến.
-- Spec: docs/superpowers/specs/2026-08-22-portfolio-rebalancing-design.md
-- Mục 3.2③ và 3.5.
--
-- ⚠️ BẮT BUỘC `with (security_invoker = true)` trên CẢ BA view.
-- Thiếu nó, view chạy bằng quyền owner ⇒ RLS bị vô hiệu hoàn toàn,
-- và lỗi này KHÔNG có triệu chứng nào nhìn thấy được.
--
-- Quy ước dấu: `transactions.amount_vnd` LUÔN DƯƠNG. Dấu (+/−) chỉ tồn tại
-- ở đây — một chỗ duy nhất trong toàn hệ thống.
--
-- ĐƠN VỊ: mọi cột *_vnd là VND (đồng) tuyệt đối, cùng quy tắc với migration core.
--
-- AN TOÀN CHẠY LẠI NHIỀU LẦN (idempotent): `create or replace view` tự thay
-- thế định nghĩa cũ; `grant` lặp lại là no-op.

create or replace view portfolio.v_legs
with (security_invoker = true) as
  -- chân 1: số lượng + giá vốn của TÀI SẢN (không phải CASH)
  select t.user_id, t.instrument_id,
         case t.type when 'BUY'        then  coalesce(t.quantity,0)
                     when 'SELL'       then -coalesce(t.quantity,0)
                     when 'ADJUSTMENT' then  coalesce(t.quantity,0)
                     else 0 end                          as qty_delta,
         case t.type when 'BUY'        then  t.amount_vnd
                     when 'SELL'       then -t.amount_vnd
                     when 'ADJUSTMENT' then  t.amount_vnd
                     else 0 end                          as cost_delta_vnd,
         0::numeric                                      as cash_delta_vnd
    from portfolio.transactions t
    join portfolio.instruments i on i.id = t.instrument_id
   where i.asset_class <> 'CASH'

union all
  -- chân 2: tiền đối ứng (BUY/SELL/DIVIDEND/FEE/TRANSFER-nguồn)
  select t.user_id, t.cash_instrument_id, 0::numeric, 0::numeric,
         case t.type when 'BUY'      then -t.amount_vnd
                     when 'SELL'     then  t.amount_vnd
                     when 'DIVIDEND' then  t.amount_vnd
                     when 'FEE'      then -t.amount_vnd
                     when 'TRANSFER' then -t.amount_vnd
                     else 0 end
    from portfolio.transactions t
   where t.cash_instrument_id is not null

union all
  -- chân 3: dòng tiền thuần trên chính túi CASH (gồm TRANSFER-đích)
  select t.user_id, t.instrument_id, 0::numeric, 0::numeric,
         case t.type when 'DEPOSIT'    then  t.amount_vnd
                     when 'WITHDRAWAL' then -t.amount_vnd
                     when 'INTEREST'   then  t.amount_vnd
                     when 'TRANSFER'   then  t.amount_vnd
                     when 'ADJUSTMENT' then  t.amount_vnd
                     when 'FEE'        then -t.amount_vnd
                     else 0 end
    from portfolio.transactions t
    join portfolio.instruments i on i.id = t.instrument_id
   where i.asset_class = 'CASH';

create or replace view portfolio.v_positions
with (security_invoker = true) as
select l.user_id, l.instrument_id,
       i.asset_class, i.symbol, i.name, i.currency,
       i.earmarked_for, i.price_source, i.lot_size, i.watchlist_stock_id,
       sum(l.qty_delta)        as quantity,
       sum(l.cost_delta_vnd)   as cost_basis_vnd,
       sum(l.cash_delta_vnd)   as cash_balance_vnd
  from portfolio.v_legs l
  join portfolio.instruments i on i.id = l.instrument_id
 group by l.user_id, l.instrument_id, i.asset_class, i.symbol, i.name,
          i.currency, i.earmarked_for, i.price_source, i.lot_size,
          i.watchlist_stock_id;

create or replace view portfolio.v_allocation
with (security_invoker = true) as
with latest as (
  select distinct on (user_id, instrument_id)
         user_id, instrument_id, price_vnd, as_of
    from portfolio.prices
   order by user_id, instrument_id, as_of desc
)
select p.*, lp.price_vnd, lp.as_of as price_as_of,
       case when p.asset_class = 'CASH' then p.cash_balance_vnd
            else coalesce(p.quantity,0) * lp.price_vnd end as market_value_vnd
  from portfolio.v_positions p
  left join latest lp
    on lp.user_id = p.user_id and lp.instrument_id = p.instrument_id;

-- Tài sản đang giữ mà thiếu giá → market_value_vnd = NULL (spec mục 3.5,
-- ngay dưới định nghĩa v_allocation). Engine phát hiện và từ chối tạo kế
-- hoạch (mục 6.4) thay vì âm thầm coi là 0đ.

-- ---------- Grant (view mới tạo cần quyền tường minh) ----------
grant select on portfolio.v_legs, portfolio.v_positions, portfolio.v_allocation
  to authenticated;
