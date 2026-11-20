-- P1: enforce one default delivery address and one redemption per customer/coupon.
create unique index if not exists addresses_one_default_per_user_idx
  on public.addresses(user_id) where is_default = true;
create unique index if not exists coupon_redemptions_coupon_customer_idx
  on public.coupon_redemptions(coupon_id, customer_id);
