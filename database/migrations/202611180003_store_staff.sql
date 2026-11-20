-- Lama Market: internal store staff (not third-party sellers).
create table if not exists public.staff_members (
  user_id uuid primary key references neon_auth."user"(id) on delete cascade,
  display_name text not null,
  phone text,
  staff_role text not null check (staff_role in ('manager','cashier','inventory','fulfillment')),
  is_active boolean not null default true,
  created_by uuid references neon_auth."user"(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists staff_members_active_role_idx
  on public.staff_members(is_active, staff_role);
