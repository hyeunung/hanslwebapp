-- Migration: Add vendor_name column to purchase_request_items and create trigger to populate it automatically

-- 1. Add new column
alter table purchase_request_items
  add column if not exists vendor_name text;

-- 2. Backfill existing rows
update purchase_request_items i
set    vendor_name = v.vendor_name
from   purchase_requests r
join   vendors v on v.id = r.vendor_id
where  r.purchase_order_number = i.purchase_order_number;

-- 3. Trigger function to keep vendor_name up-to-date
create or replace function set_vendor_name_on_items()
returns trigger as $$
declare
  _name text;
begin
  select v.vendor_name
    into _name
    from purchase_requests r
    join vendors v on v.id = r.vendor_id
   where r.purchase_order_number = new.purchase_order_number;

  new.vendor_name := _name;
  return new;
end;
$$ language plpgsql;

-- 4. Trigger on purchase_request_items (insert / update)
create or replace trigger trg_set_vendor_name_on_items
before insert or update on purchase_request_items
for each row execute function set_vendor_name_on_items();

-- 5. (Optional) Trigger on purchase_requests to propagate vendor changes
-- If vendor_id on a purchase_request row changes, update related items.
create or replace function propagate_vendor_name_change()
returns trigger as $$
begin
  update purchase_request_items i
     set vendor_name = (select v.vendor_name from vendors v where v.id = new.vendor_id)
   where i.purchase_order_number = new.purchase_order_number;
  return new;
end;
$$ language plpgsql;

create or replace trigger trg_propagate_vendor_name_change
after update of vendor_id on purchase_requests
for each row execute function propagate_vendor_name_change();
