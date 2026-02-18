create or replace function public.can_manage_news()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or public.is_moderator();
$$;

grant execute on function public.can_manage_news() to authenticated;

drop policy if exists "articles_read_published_or_admin" on public.news;
drop policy if exists "articles_admin_insert" on public.news;
drop policy if exists "articles_admin_update" on public.news;
drop policy if exists "articles_admin_delete" on public.news;

create policy "news_read_published_or_admin_or_moderator"
on public.news
for select
to anon, authenticated
using (
  is_published = true
  or public.can_manage_news()
);

create policy "news_admin_or_moderator_insert"
on public.news
for insert
to authenticated
with check (public.can_manage_news());

create policy "news_admin_or_moderator_update"
on public.news
for update
to authenticated
using (public.can_manage_news())
with check (public.can_manage_news());

create policy "news_admin_or_moderator_delete"
on public.news
for delete
to authenticated
using (public.can_manage_news());