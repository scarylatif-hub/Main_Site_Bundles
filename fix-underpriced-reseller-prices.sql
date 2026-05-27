-- Fix ONLY reseller/store custom prices that are below the main-site price.
--
-- IMPORTANT:
-- This script needs public.reseller_price_floors to contain one row per
-- DataKazina package_id used in public.reseller_prices.
--
-- Columns expected:
--   reseller_price_floors.package_id     = reseller_prices.package_id
--   reseller_price_floors.minimum_price  = the main-site price customers see

begin;

create table if not exists public.reseller_price_floors (
  package_id integer primary key,
  network_id integer not null,
  minimum_price numeric(10, 2) not null check (minimum_price > 0),
  updated_at timestamptz not null default now()
);

-- 1. Stop here if floors have not been populated.
do $$
begin
  if not exists (select 1 from public.reseller_price_floors) then
    raise exception 'reseller_price_floors is empty. Populate package_id minimum prices first, then rerun.';
  end if;
end;
$$;

-- 2. Preview only rows that are currently below the main-site price.
select
  rp.reseller_id,
  p.store_name,
  p.email,
  rp.package_id,
  rp.network_id,
  rp.selling_price as current_underpriced_price,
  f.minimum_price as corrected_main_site_price
from public.reseller_prices rp
join public.reseller_price_floors f
  on f.package_id = rp.package_id
left join public.profiles p
  on p.id = rp.reseller_id
where rp.selling_price < f.minimum_price
order by p.store_name nulls last, rp.reseller_id, rp.package_id;

-- 3. Fix ONLY those underpriced rows.
update public.reseller_prices rp
set selling_price = f.minimum_price
from public.reseller_price_floors f
where f.package_id = rp.package_id
  and rp.selling_price < f.minimum_price;

-- 4. Verify the fix. This must return zero rows.
select
  rp.reseller_id,
  rp.package_id,
  rp.network_id,
  rp.selling_price,
  f.minimum_price
from public.reseller_prices rp
join public.reseller_price_floors f
  on f.package_id = rp.package_id
where rp.selling_price < f.minimum_price;

commit;
