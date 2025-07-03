import { supabase } from './client';

// Auth helpers
export const getCurrentUser = async () => {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  return { user, error };
};

export const getCurrentSession = async () => {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  return { session, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

// User profile helpers for phone-based auth
export const createUserProfile = async (userData: {
  phone: string;
  full_name?: string;
  email?: string;
}) => {
  const { user } = await getCurrentUser();
  if (!user) throw new Error('No authenticated user');

  return await supabase
    .from('users')
    .insert({
      id: user.id,
      email: userData.email || user.email || '',
      phone: userData.phone,
      full_name: userData.full_name || null,
    })
    .select()
    .single();
};

export const updateUserProfile = async (userData: {
  phone?: string;
  full_name?: string;
  email?: string;
}) => {
  const { user } = await getCurrentUser();
  if (!user) throw new Error('No authenticated user');

  return await supabase
    .from('users')
    .update(userData)
    .eq('id', user.id)
    .select()
    .single();
};

export const getUserByPhone = async (phone: string) => {
  try {
    return await supabase.from('users').select('*').eq('phone', phone).single();
  } catch (error) {
    // Handle RLS policy blocks gracefully
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error.code === 'PGRST116' || error.code === '42501')
    ) {
      return { data: null, error: null }; // RLS blocked or user not found
    }
    throw error; // Re-throw unexpected errors
  }
};
