import { requireSupabase } from './supabaseClient.js';

export async function registerUser({ email, password, firstName, lastName }) {
  const supabase = requireSupabase();
  
  const options = {
    data: {
      full_name: `${firstName} ${lastName}`.trim(),
    }
  };

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options
  });

  if (error) throw error;
  return data;
}

export async function loginUser({ email, password }) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

export async function logoutUser() {
  const supabase = requireSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  const supabase = requireSupabase();
  // Safe role fetching happens via database, not metadata here,
  // but metadata is fine for display names.
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getSession() {
  const supabase = requireSupabase();
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
}
