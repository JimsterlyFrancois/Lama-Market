-- P2: payment audit, refund register and notification delivery tracking.
-- All additions are non-destructive and safe for the isolated Preview database.

create table if not exists public.payment_refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  currency char(3) not null default 'HTG' check (currency = 'HTG'),
  status text not null default 'requested'
    check (status in ('requested','processing','completed','failed','cancelled')),
  reason text not null,
  external_reference text,
  proof_storage_key text,
  idempotency_key text not null unique,
  requested_by uuid references neon_auth."user"(id) on delete set null,
  processed_by uuid references neon_auth."user"(id) on delete set null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payment_refunds_payment_created_idx
  on public.payment_refunds(payment_id, created_at desc);
create index if not exists payment_refunds_status_created_idx
  on public.payment_refunds(status, created_at desc);

create table if not exists public.notification_preferences (
  user_id uuid primary key references neon_auth."user"(id) on delete cascade,
  email_enabled boolean not null default true,
  sms_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  channel text not null check (channel in ('email','sms')),
  status text not null default 'queued'
    check (status in ('queued','sent','failed','skipped')),
  recipient text,
  provider text,
  provider_reference text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(notification_id, channel)
);
create index if not exists notification_deliveries_status_created_idx
  on public.notification_deliveries(channel, status, created_at);

create index if not exists payments_provider_reference_idx
  on public.payments(provider, external_reference)
  where provider is not null and external_reference is not null;
create index if not exists payments_status_created_idx
  on public.payments(status, created_at desc);
create index if not exists orders_payment_status_created_idx
  on public.orders(payment_status, created_at desc);
