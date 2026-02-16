import { requireSupabase } from './supabaseClient.js';

export async function getPublishedArticles(limit = 12) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('articles')
    .select('id, title, content, category, tags, created_at')
    .eq('is_published', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function getArticleById(id) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('articles')
    .select('id, title, content, category, tags, created_at')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}
