do $$
begin
  if to_regclass('public.tips') is null and to_regclass('public.news') is not null then
    alter table public.news rename to tips;
  end if;
end
$$;

alter index if exists public.idx_news_created_at rename to idx_tips_created_at;
alter index if exists public.idx_news_category rename to idx_tips_category;
alter index if exists public.idx_news_published rename to idx_tips_published;
