do $$
begin
  if to_regclass('public.news') is null and to_regclass('public.articles') is not null then
    alter table public.articles rename to news;
  end if;
end
$$;

alter index if exists public.idx_articles_created_at rename to idx_news_created_at;
alter index if exists public.idx_articles_category rename to idx_news_category;
alter index if exists public.idx_articles_published rename to idx_news_published;
