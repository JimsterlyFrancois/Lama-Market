-- Lama Market single-store commerce schema. Requires Neon Auth and the catalogue migration 202611170001.
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create table if not exists public.categories (
  slug text primary key, name text not null, description text, image_url text,
  sort_order integer not null default 0, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
insert into public.categories(slug,name,sort_order) values
 ('epicerie','Épicerie',1),('maison','Maison',2),('beaute','Beauté',3),
 ('electronique','Électronique',4),('mode','Mode',5),('bons-plans','Bons plans',6)
on conflict(slug) do nothing;

alter table public.products
 add column if not exists sku text,
 add column if not exists slug text,
 add column if not exists cost_price numeric(12,2),
 add column if not exists low_stock_threshold integer not null default 5,
 add column if not exists is_featured boolean not null default false,
 add column if not exists deleted_at timestamptz;
create unique index if not exists products_sku_unique_idx on public.products(sku) where sku is not null;
create unique index if not exists products_slug_unique_idx on public.products(slug) where slug is not null;
do $$ begin
 if not exists (select 1 from pg_constraint where conname='products_category_fkey' and conrelid='public.products'::regclass) then
  alter table public.products add constraint products_category_fkey foreign key(category) references public.categories(slug) on update cascade on delete restrict;
 end if;
end $$;

create table if not exists public.user_roles (
 user_id uuid not null references neon_auth."user"(id) on delete cascade,
 role text not null check(role in ('customer','admin','courier')),
 is_active boolean not null default true, created_at timestamptz not null default now(),
 created_by uuid references neon_auth."user"(id) on delete set null, primary key(user_id,role)
);
create table if not exists public.customer_profiles (
 user_id uuid primary key references neon_auth."user"(id) on delete cascade,
 phone text, preferred_name text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.courier_profiles (
 user_id uuid primary key references neon_auth."user"(id) on delete cascade,
 phone text not null, display_name text not null,
 employment_type text not null default 'mandated' check(employment_type in ('employee','mandated')),
 is_active boolean not null default true, notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.addresses (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references neon_auth."user"(id) on delete cascade,
 recipient_name text not null, phone text not null, address_line text not null,
 department text, city text not null, area text, landmark text, delivery_instructions text,
 is_default boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists addresses_user_idx on public.addresses(user_id);

create table if not exists public.carts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null unique references neon_auth."user"(id) on delete cascade,
 status text not null default 'active' check(status in ('active','converted','abandoned')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.cart_items (
 id uuid primary key default gen_random_uuid(), cart_id uuid not null references public.carts(id) on delete cascade,
 product_id uuid not null references public.products(id) on delete restrict,
 quantity integer not null check(quantity > 0), created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), unique(cart_id,product_id)
);

create table if not exists public.delivery_zones (
 id uuid primary key default gen_random_uuid(), name text not null unique, department text, city text not null, area text,
 is_active boolean not null default true, estimated_min_days integer not null default 1 check(estimated_min_days>=0),
 estimated_max_days integer not null default 3 check(estimated_max_days>=estimated_min_days),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.delivery_rates (
 id uuid primary key default gen_random_uuid(), zone_id uuid not null references public.delivery_zones(id) on delete cascade,
 fee numeric(12,2) not null check(fee>=0), free_from numeric(12,2) check(free_from is null or free_from>=0),
 is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists delivery_rates_zone_idx on public.delivery_rates(zone_id,is_active);

create table if not exists public.orders (
 id uuid primary key default gen_random_uuid(), order_number text not null unique,
 customer_id uuid not null references neon_auth."user"(id) on delete restrict,
 status text not null default 'pending' check(status in ('pending','confirmed','preparing','ready_for_delivery','completed','cancelled')),
 payment_status text not null default 'unpaid' check(payment_status in ('unpaid','pending','paid','failed','refunded','partially_refunded','cash_due','cash_collected')),
 delivery_status text not null default 'unassigned' check(delivery_status in ('unassigned','assigned','preparing','in_transit','delivered','failed','returned')),
 currency char(3) not null default 'HTG' check(currency='HTG'),
 subtotal numeric(12,2) not null check(subtotal>=0), discount_total numeric(12,2) not null default 0 check(discount_total>=0),
 delivery_fee numeric(12,2) not null default 0 check(delivery_fee>=0), total numeric(12,2) not null check(total>=0),
 address_snapshot jsonb not null, customer_note text, idempotency_key text not null unique,
 expires_at timestamptz, confirmed_at timestamptz, completed_at timestamptz, cancelled_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists orders_customer_created_idx on public.orders(customer_id,created_at desc);
create index if not exists orders_status_created_idx on public.orders(status,created_at desc);
create table if not exists public.order_items (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
 product_id uuid references public.products(id) on delete set null, product_name text not null, product_sku text,
 unit_price numeric(12,2) not null check(unit_price>=0), quantity integer not null check(quantity>0),
 line_total numeric(12,2) not null check(line_total>=0), created_at timestamptz not null default now()
);
create index if not exists order_items_order_idx on public.order_items(order_id);

create table if not exists public.stock_movements (
 id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete restrict,
 quantity_delta integer not null check(quantity_delta<>0),
 movement_type text not null check(movement_type in ('initial','purchase','sale','reservation_release','return','adjustment','damage')),
 reference_type text, reference_id uuid, note text, created_by uuid references neon_auth."user"(id) on delete set null,
 created_at timestamptz not null default now()
);
create index if not exists stock_movements_product_created_idx on public.stock_movements(product_id,created_at desc);
create table if not exists public.stock_reservations (
 id uuid primary key default gen_random_uuid(), order_item_id uuid not null unique references public.order_items(id) on delete cascade,
 product_id uuid not null references public.products(id) on delete restrict, quantity integer not null check(quantity>0),
 status text not null default 'reserved' check(status in ('reserved','consumed','released','expired')),
 expires_at timestamptz not null, consumed_at timestamptz, released_at timestamptz, created_at timestamptz not null default now()
);
create index if not exists stock_reservations_active_idx on public.stock_reservations(product_id,status,expires_at);

create table if not exists public.payments (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete restrict,
 method text not null check(method in ('cash_on_delivery','moncash','natcash','other')), provider text,
 amount numeric(12,2) not null check(amount>=0), currency char(3) not null default 'HTG' check(currency='HTG'),
 status text not null default 'pending' check(status in ('pending','paid','failed','cancelled','refunded','partially_refunded','cash_collected')),
 external_reference text, idempotency_key text not null unique, metadata jsonb not null default '{}'::jsonb,
 paid_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists payments_order_idx on public.payments(order_id,created_at desc);
create table if not exists public.payment_transactions (
 id uuid primary key default gen_random_uuid(), payment_id uuid not null references public.payments(id) on delete cascade,
 provider_event_id text not null unique, event_type text not null, signature_valid boolean not null default false,
 payload jsonb not null default '{}'::jsonb, processed_at timestamptz, created_at timestamptz not null default now()
);

create table if not exists public.deliveries (
 id uuid primary key default gen_random_uuid(), order_id uuid not null unique references public.orders(id) on delete restrict,
 zone_id uuid references public.delivery_zones(id) on delete set null,
 courier_id uuid references neon_auth."user"(id) on delete set null,
 assigned_by uuid references neon_auth."user"(id) on delete set null,
 status text not null default 'unassigned' check(status in ('unassigned','assigned','preparing','in_transit','delivered','failed','returned')),
 fee numeric(12,2) not null default 0 check(fee>=0), scheduled_at timestamptz, assigned_at timestamptz,
 picked_up_at timestamptz, delivered_at timestamptz, recipient_name text, proof_url text, failure_reason text,
 courier_note text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists deliveries_courier_status_idx on public.deliveries(courier_id,status,created_at desc);
create table if not exists public.delivery_events (
 id uuid primary key default gen_random_uuid(), delivery_id uuid not null references public.deliveries(id) on delete cascade,
 status text not null, note text, location_label text, proof_url text,
 actor_id uuid references neon_auth."user"(id) on delete set null, created_at timestamptz not null default now()
);
create index if not exists delivery_events_delivery_created_idx on public.delivery_events(delivery_id,created_at);

create table if not exists public.coupons (
 id uuid primary key default gen_random_uuid(), code text not null unique,
 discount_type text not null check(discount_type in ('fixed','percent')), discount_value numeric(12,2) not null check(discount_value>0),
 minimum_order numeric(12,2) not null default 0 check(minimum_order>=0), max_uses integer check(max_uses is null or max_uses>0),
 starts_at timestamptz, ends_at timestamptz, is_active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.coupon_redemptions (
 id uuid primary key default gen_random_uuid(), coupon_id uuid not null references public.coupons(id) on delete restrict,
 order_id uuid not null unique references public.orders(id) on delete cascade,
 customer_id uuid not null references neon_auth."user"(id) on delete restrict,
 discount_amount numeric(12,2) not null check(discount_amount>=0), created_at timestamptz not null default now()
);
create table if not exists public.notifications (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references neon_auth."user"(id) on delete cascade,
 type text not null, title text not null, message text not null, data jsonb not null default '{}'::jsonb,
 read_at timestamptz, created_at timestamptz not null default now()
);
create index if not exists notifications_user_unread_idx on public.notifications(user_id,created_at desc) where read_at is null;
create table if not exists public.store_settings (
 key text primary key, value jsonb not null, updated_by uuid references neon_auth."user"(id) on delete set null,
 updated_at timestamptz not null default now()
);
create table if not exists public.audit_logs (
 id uuid primary key default gen_random_uuid(), actor_id uuid references neon_auth."user"(id) on delete set null,
 action text not null, entity_type text not null, entity_id text, details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists audit_logs_created_idx on public.audit_logs(created_at desc);
create index if not exists audit_logs_entity_idx on public.audit_logs(entity_type,entity_id,created_at desc);

do $$ declare t text; begin
 foreach t in array array['categories','customer_profiles','courier_profiles','addresses','carts','cart_items','delivery_zones','delivery_rates','orders','payments','deliveries','coupons']
 loop
  execute format('drop trigger if exists set_updated_at on public.%I',t);
  execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',t);
 end loop;
end $$;
