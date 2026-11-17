-- Lama Market product catalogue.
-- Public visitors can read active products only. No public write access is granted.
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text not null check (category in ('epicerie', 'maison', 'beaute', 'electronique', 'mode', 'bons-plans')),
  price numeric(12,2) not null check (price >= 0),
  old_price numeric(12,2) check (old_price is null or old_price >= 0),
  discount_ends_at timestamptz,
  stock integer not null default 0 check (stock >= 0),
  badge text,
  rating numeric(2,1) not null default 0 check (rating >= 0 and rating <= 5),
  reviews integer not null default 0 check (reviews >= 0),
  image_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_active_sort_idx
  on public.products (is_active, sort_order, name);

create index if not exists products_category_active_idx
  on public.products (category, is_active);

alter table public.products enable row level security;

drop policy if exists "Public can view active products" on public.products;
create policy "Public can view active products"
  on public.products
  for select
  to anon, authenticated
  using (is_active = true);
