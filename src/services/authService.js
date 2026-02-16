import { requireSupabase } from './supabaseClient.js';

export async function registerUser({ email, password, firstName, lastName }) {
  const supabase = requireSupabase();
  const metadata = {
    first_name: firstName || null,
    last_name: lastName || null,
  };

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
    },
  });

  if (error) throw error;

  if (data.user) {
    localStorage.setItem(
      'staysafebgUser',
      JSON.stringify({
        id: data.user.id,
        email: data.user.email,
        role: data.user.user_metadata?.role || 'user',
      })
    );
  }

  return data;
}

export async function loginUser({ email, password }) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;

  if (data.user && data.session) {
    localStorage.setItem(
      'staysafebgUser',
      JSON.stringify({
        id: data.user.id,
        email: data.user.email,
        role: data.user.user_metadata?.role || 'user',
      })
    );
    localStorage.setItem('token', data.session.access_token);
  }

  return data;
}

export async function logoutUser() {
  const supabase = requireSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;

  localStorage.removeItem('staysafebgUser');
  localStorage.removeItem('currentUser');
  localStorage.removeItem('user');
  localStorage.removeItem('token');
  localStorage.removeItem('authToken');
}

export async function getCurrentUser() {
  const supabase = requireSupabase();
  const { data, error } = await supabase.auth.getUser();

  if (error) throw error;
  if (!data.user) return null;

  return {
    id: data.user.id,
    email: data.user.email,
    role: data.user.user_metadata?.role || 'user',
    firstName: data.user.user_metadata?.first_name || null,
    lastName: data.user.user_metadata?.last_name || null,
  };
}

export async function getSession() {
  const supabase = requireSupabase();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}
