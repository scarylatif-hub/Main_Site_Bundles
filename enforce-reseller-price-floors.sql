-- Enforce reseller/store prices so they can never be below main-site prices.
-- Run in Supabase SQL editor after filling package_id values from your current
-- /api/packages output. The package_id must match reseller_prices.package_id.

begin;

create table if not exists public.reseller_price_floors (
  package_id integer primary key,
  network_id integer not null,
  minimum_price numeric(10, 2) not null check (minimum_price > 0),
  updated_at timestamptz not null default now()
);

-- Replace/add rows here with every package_id returned by /api/packages.
-- Example format:
-- insert into public.reseller_price_floors (package_id, network_id, minimum_price) values
--   (12345, 1, 4.29),
--   (12346, 1, 8.58),
--   (22345, 3, 4.29)
-- on conflict (package_id) do update set
--   network_id = excluded.network_id,
--   minimum_price = excluded.minimum_price,
--   updated_at = now();

create or replace function public.reject_reseller_price_below_floor()
returns trigger
language plpgsql
as $$
declare
  floor_price numeric(10, 2);
begin
  select minimum_price
    into floor_price
  from public.reseller_price_floors
  where package_id = new.package_id;

  if floor_price is null then
    raise exception 'No reseller price floor configured for package_id %', new.package_id;
  end if;

  if new.selling_price < floor_price then
    raise exception 'Reseller price % for package_id % is below main-site price %',
      new.selling_price, new.package_id, floor_price;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_reject_reseller_price_below_floor on public.reseller_prices;

create trigger trg_reject_reseller_price_below_floor
before insert or update of selling_price, package_id
on public.reseller_prices
for each row
execute function public.reject_reseller_price_below_floor();

-- Audit existing bad rows. This should return zero rows after the UPDATE below.
select
  rp.reseller_id,
  rp.package_id,
  rp.network_id,
  rp.selling_price,
  f.minimum_price
from public.reseller_prices rp
join public.reseller_price_floors f on f.package_id = rp.package_id
where rp.selling_price < f.minimum_price;

-- Repair existing underpriced rows by raising them to the main-site floor.
update public.reseller_prices rp
set selling_price = f.minimum_price
from public.reseller_price_floors f
where f.package_id = rp.package_id
  and rp.selling_price < f.minimum_price;

-- Strict check: fail the transaction if any underpriced row remains.
do $$
begin
  if exists (
    select 1
    from public.reseller_prices rp
    join public.reseller_price_floors f on f.package_id = rp.package_id
    where rp.selling_price < f.minimum_price
  ) then
    raise exception 'Underpriced reseller_prices rows still exist';
  end if;
end;
$$;

commit;
