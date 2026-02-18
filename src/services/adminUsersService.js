import { requireSupabase } from './supabaseClient.js';

export async function getAdminUsers() {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc('admin_list_users');

  if (error) throw error;
  return data || [];
}

export async function deleteUserByAdmin(userId) {
  const supabase = requireSupabase();
  const { error } = await supabase.rpc('admin_delete_user', {
    target_user_id: userId,
  });

  if (error) throw error;
}

export async function updateUserRole(userId, newRole) {
  const supabase = requireSupabase();
  const { error } = await supabase.rpc('admin_update_user_role', {
    target_user_id: userId,
    new_role: newRole
  });

  if (error) throw error;
}
