-- Migration file to add profiles table and ensure auth setup is robust

-- 1. Create profiles table if it doesn't exist
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  updated_at timestamptz,
  created_at timestamptz default now()
);

-- 2. Enable RLS on profiles
alter table public.profiles enable row level security;

-- 3. Create policies for profiles if they don't exist
-- We use DO blocks to avoid errors if policies already exist (though this is a new table usually)

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'profiles' and policyname = 'Public profiles are viewable by everyone'
  ) then
    create policy "Public profiles are viewable by everyone"
    on public.profiles for select
    using ( true );
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'profiles' and policyname = 'Users can insert their own profile'
  ) then
    create policy "Users can insert their own profile"
    on public.profiles for insert
    with check ( auth.uid() = id );
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'profiles' and policyname = 'Users can update their own profile'
  ) then
    create policy "Users can update their own profile"
    on public.profiles for update
    using ( auth.uid() = id );
  end if;
end
$$;


-- 4. Create a trigger to automatically create a profile and user_role for new users
-- This ensures that when a user allows Signup, they get an entry in public.profiles and public.user_roles

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Insert into profiles
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');

  -- Insert into user_roles (default is 'user')
  insert into public.user_roles (user_id, role)
  values (new.id, 'user');

  return new;
end;
$$;

-- Trigger mechanism
-- Drop if exists to ensure clean slate for the trigger definition
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 5. Ensure is_admin exists and is secure (re-asserting security just in case)
-- The function already exists in previous migration, but we ensure permissions here
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_admin() to service_role;
