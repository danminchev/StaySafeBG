create or replace function public.admin_list_users()
returns table (
  user_id uuid,
  email text,
  full_name text,
  role text,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  curr_user_id uuid;
begin
  curr_user_id := auth.uid();
  
  if curr_user_id is null then
    raise exception 'User not authenticated';
  end if;

  if not exists (select 1 from public.user_roles ur where ur.user_id = curr_user_id and ur.role = 'admin') then
    raise exception 'Access denied';
  end if;

  return query
  select
    p.id as user_id,
    p.email,
    coalesce(p.full_name, '') as full_name,
    coalesce(ur.role, 'user') as role,
    p.created_at,
    null::timestamptz as last_sign_in_at
  from public.profiles p
  left join public.user_roles ur on ur.user_id = p.id
  order by p.created_at desc;
end;
$$;

revoke all on function public.admin_list_users() from public;
grant execute on function public.admin_list_users() to authenticated;

create or replace function public.admin_delete_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can delete users';
  end if;

  if target_user_id is null then
    raise exception 'target_user_id is required';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'Admin cannot delete own account';
  end if;

  delete from auth.users
  where id = target_user_id;

  if not found then
    raise exception 'User not found';
  end if;
end;
$$;

revoke all on function public.admin_delete_user(uuid) from public;
grant execute on function public.admin_delete_user(uuid) to authenticated;
