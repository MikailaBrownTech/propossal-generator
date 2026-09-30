-- ClearPath staff profiles, one row per auth.users row.
-- Single-tenant: every profile belongs to the same (implicit) org.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role public.user_role not null default 'staff',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- True if the current session belongs to an owner. security definer so it
-- can be used inside RLS policies without those policies needing direct
-- select access to profiles.
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'owner'
  );
$$;

-- Auto-create a profile row when someone signs up. The very first account
-- becomes the owner; everyone after that starts as staff and must be
-- promoted by an owner (update profiles.role directly).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_role public.user_role;
begin
  if (select count(*) from public.profiles) = 0 then
    assigned_role := 'owner';
  else
    assigned_role := 'staff';
  end if;

  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data ->> 'full_name', assigned_role);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Prevent a non-owner from promoting themselves (or anyone else) via the
-- self-update policy below.
create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role and not public.is_owner() then
    raise exception 'Only an owner can change a user role';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_self_escalation();

alter table public.profiles enable row level security;

-- Any signed-in ClearPath user can see the staff list (e.g. to assign a
-- confirmer or pick a sender).
create policy "profiles_select_authenticated"
  on public.profiles for select
  using (auth.uid() is not null);

-- Users can edit their own profile (name); role changes on this path are
-- blocked by the trigger above unless the caller is already an owner.
create policy "profiles_update_self"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Owners can edit any profile, including role.
create policy "profiles_update_owner"
  on public.profiles for update
  using (public.is_owner())
  with check (public.is_owner());
