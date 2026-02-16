import { requireSupabase } from './supabaseClient.js';

export async function ensureUserRole(userId) {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from('user_roles')
    .upsert({ user_id: userId, role: 'user' }, { onConflict: 'user_id' });

  if (error) throw error;
}

export async function getUserRole(userId) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data?.role || 'user';
}
