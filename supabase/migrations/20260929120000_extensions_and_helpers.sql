-- Extensions and shared helper functions used by later migrations.

create extension if not exists "pgcrypto";

-- Generic updated_at maintenance, attached per-table where needed.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
