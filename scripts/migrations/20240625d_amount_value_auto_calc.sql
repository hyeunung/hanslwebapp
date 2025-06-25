-- Migration: Auto-calculate amount_value as quantity * unit_price_value on purchase_request_items

-- Backfill existing rows (ensure column exists first)

update purchase_request_items
   set amount_value = coalesce(quantity,0) * coalesce(unit_price_value,0)
 where amount_value is null
    or amount_value <> coalesce(quantity,0) * coalesce(unit_price_value,0);

-- Create/recreate trigger function
create or replace function calc_amount_value_on_items()
returns trigger as $$
begin
  new.amount_value := coalesce(new.quantity,0) * coalesce(new.unit_price_value,0);
  return new;
end;
$$ language plpgsql;

-- Drop old trigger if exists
DROP TRIGGER IF EXISTS trg_calc_amount_value_on_items ON purchase_request_items;

-- Create new trigger before insert or update of quantity or unit_price_value
create trigger trg_calc_amount_value_on_items
before insert or update of quantity, unit_price_value on purchase_request_items
for each row execute function calc_amount_value_on_items();