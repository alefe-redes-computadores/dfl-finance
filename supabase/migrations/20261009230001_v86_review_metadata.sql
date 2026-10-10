-- Apply with the V84 contract before publishing V86. Does not settle or backfill transactions.
-- Source stays immutable: a manual review is separate from capture provenance.
alter table public.transactions add column if not exists reviewed_at timestamptz;
comment on column public.transactions.reviewed_at is 'Explicit owner review timestamp. Does not represent payment or alter account balance.';
