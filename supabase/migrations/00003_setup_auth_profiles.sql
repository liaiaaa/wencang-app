create type public.user_role as enum ('user', 'admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  phone text,
  role public.user_role not null default 'user',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.get_user_role(uid uuid)
returns public.user_role
language sql
security definer
set search_path = public
as $$
  select role from public.profiles where id = uid;
$$;

create policy "profiles_admin_all" on public.profiles for all to authenticated using (get_user_role(auth.uid()) = 'admin'::public.user_role);
create policy "profiles_select_own" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = id) with check (role is not distinct from get_user_role(auth.uid()));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, phone, role)
  values (new.id, new.email, new.phone, 'user'::public.user_role);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();