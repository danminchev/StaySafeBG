import { requireSupabase } from './supabaseClient.js';

/**
 * Ensures a user has a role.
 * DEPRECATED: This is now handled by a database trigger on auth.users insert.
 * Kept for compatibility.
 */
export async function ensureUserRole(userId) {
  // No-op: DB trigger handles creation.
  return;
}

export async function getUserRole(userId) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching user role:', error);
    return 'user';
  }
  
  return data?.role || 'user';
}
