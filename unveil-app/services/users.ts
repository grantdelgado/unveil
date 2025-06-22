import { supabase } from '@/lib/supabase/client';
import type { UserInsert, UserUpdate, User } from '@/lib/supabase/types';

// User service functions
export const getUserById = async (id: string) => {
  return await supabase.from('users').select('*').eq('id', id).single();
};

export const getUserByPhone = async (phone: string) => {
  return await supabase.from('users').select('*').eq('phone', phone).single();
};

export const getUserByEmail = async (email: string) => {
  return await supabase.from('users').select('*').eq('email', email).single();
};

export const createUser = async (userData: UserInsert) => {
  return await supabase.from('users').insert(userData).select().single();
};

export const updateUser = async (id: string, updates: UserUpdate) => {
  return await supabase
    .from('users')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
};

export const deleteUser = async (id: string) => {
  return await supabase.from('users').delete().eq('id', id);
};

export const searchUsers = async (query: string, limit: number = 10) => {
  return await supabase
    .from('users')
    .select('*')
    .or(
      `full_name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`,
    )
    .limit(limit);
};

export const getUsersWithRoles = async (eventId: string) => {
  return await supabase
    .from('event_participants')
    .select(
      `
      *,
      user:public_user_profiles(*)
    `,
    )
    .eq('event_id', eventId);
};

// Use the properly typed User interface from MCP-generated types
export type { User as UserProfile };
