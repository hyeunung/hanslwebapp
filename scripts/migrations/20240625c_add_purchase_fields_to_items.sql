-- Migration: Add purchase_order_number and requester_name to purchase_request_items and update triggers

-- 1. Add new columns if they don't exist
alter table purchase_request_items
  add column if not exists purchase_order_number text,
  add column if not exists requester_name text;

-- 2. Backfill existing rows
update purchase_request_items i
set    purchase_order_number = r.purchase_order_number,
       requester_name = r.requester_name
from   purchase_requests r
where  r.id = i.purchase_request_id;

-- 3. Create/replace trigger function to set vendor_name, purchase_order_number, requester_name on items
create or replace function set_request_info_on_items()
returns trigger as $$
begin
  select r.purchase_order_number,
         v.vendor_name,
         r.requester_name
    into new.purchase_order_number,
         new.vendor_name,
         new.requester_name
    from purchase_requests r
    left join vendors v on v.id = r.vendor_id
   where r.id = new.purchase_request_id;
  return new;
end;
$$ language plpgsql;

-- 4. Recreate trigger on purchase_request_items
--    Remove old trigger if exists then add new one

drop trigger if exists trg_set_vendor_name_on_items on purchase_request_items;

create trigger trg_set_request_info_on_items
before insert or update on purchase_request_items
for each row execute function set_request_info_on_items();

-- 5. Update propagation trigger on purchase_requests
create or replace function propagate_request_info_change()
returns trigger as $$
begin
  update purchase_request_items i
     set vendor_name = (select v.vendor_name from vendors v where v.id = new.vendor_id),
         purchase_order_number = new.purchase_order_number,
         requester_name = new.requester_name
   where i.purchase_request_id = new.id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_propagate_vendor_name_change on purchase_requests;

create trigger trg_propagate_request_info_change
after update of vendor_id, purchase_order_number, requester_name on purchase_requests
for each row execute function propagate_request_info_change();