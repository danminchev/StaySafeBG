import { requireSupabase } from './supabaseClient.js';

export async function getPublishedArticles({ category, q, sort = 'newest', limit = 9, offset = 0 } = {}) {
  const supabase = requireSupabase();
  
  let query = supabase
    .from('news')
    // removed reading_time as it doesn't exist in DB
    .select('id, title, content, category, tags, created_at', { count: 'exact' })
    .eq('is_published', true);

  // Apply filters
  if (category) {
    query = query.eq('category', category);
  }

  if (q) {
    // ILIKE search on title. 
    // For production, Full Text Search (FTS) is better, but this works for basic usage.
    query = query.ilike('title', `%${q}%`);
  }

  // Apply Sorting
  switch (sort) {
    case 'oldest':
      query = query.order('created_at', { ascending: true });
      break;
    case 'az':
      query = query.order('title', { ascending: true });
      break;
    case 'newest':
    default:
      query = query.order('created_at', { ascending: false });
      break;
  }

  // Apply Pagination
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) throw error;
  return { data: data || [], count };
}

export async function getArticleById(id) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('news')
    .select('id, title, content, category, tags, is_published, created_at')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createArticle(articleData) {
  const supabase = requireSupabase();
  
  // Get current user to set as author
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('news')
    .insert([{
        ...articleData,
        author_id: user.id
    }])
    .select();

  if (error) throw error;
  return data?.[0];
}

export async function getAdminArticles({ limit = 100, offset = 0 } = {}) {
  const supabase = requireSupabase();

  const { data, error, count } = await supabase
    .from('news')
    .select('id, title, category, is_published, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return { data: data || [], count: count || 0 };
}

export async function updateArticle(articleId, articleData) {
  const supabase = requireSupabase();

  const payload = {
    title: articleData.title,
    category: articleData.category,
    content: articleData.content,
    is_published: articleData.is_published,
    tags: articleData.tags || []
  };

  const { data, error } = await supabase
    .from('news')
    .update(payload)
    .eq('id', articleId)
    .select('id, title, category, is_published, created_at')
    .single();

  if (error) throw error;
  return data;
}
