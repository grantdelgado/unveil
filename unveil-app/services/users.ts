import { supabase } from '@/lib/supabase/client';
import type { UserInsert, UserUpdate, User } from '@/lib/supabase/types';

// User service functions
export const getUserById = async (id: string) => {
  try {
    return await supabase.from('users').select('*').eq('id', id).single();
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

export const getUserByEmail = async (email: string) => {
  try {
    return await supabase.from('users').select('*').eq('email', email).single();
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
  try {
    return await supabase
      .from('users')
      .select('*')
      .or(
        `full_name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`,
      )
      .limit(limit);
  } catch (error) {
    // Handle RLS policy blocks gracefully
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === '42501'
    ) {
      return { data: [], error: null }; // RLS blocked - return empty results
    }
    throw error; // Re-throw unexpected errors
  }
};

export const getUsersWithRoles = async (eventId: string) => {
  try {
    return await supabase
      .from('event_guests')
      .select(
        `
        *,
        users:user_id(*)
      `,
      )
      .eq('event_id', eventId);
  } catch (error) {
    // Handle RLS policy blocks gracefully
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === '42501'
    ) {
      return { data: [], error: null }; // RLS blocked - return empty results
    }
    throw error; // Re-throw unexpected errors
  }
};

// Use the properly typed User interface from MCP-generated types
export type { User as UserProfile };
