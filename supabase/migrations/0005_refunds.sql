-- Remboursements « satisfait ou remboursé 7 jours » (premier paiement, moins de 3 créations IA).
alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments add constraint payments_status_check check (status in ('pending', 'paid', 'failed', 'cancelled', 'refunded'));
alter table public.payments add column if not exists refunded_at timestamptz;
