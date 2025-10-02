import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';
import { normalizeName } from '@/lib/avatar';

export interface CurrentUser {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
  phone: string | null;
}

interface UseCurrentUserReturn {
  user: CurrentUser | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to get current user profile data for avatar display
 * Provides normalized user data with consistent interface
 */
export function useCurrentUser(): UseCurrentUserReturn {
  const { user: authUser, isAuthenticated } = useAuth();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserProfile = async () => {
    if (!authUser?.id || !isAuthenticated) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch user profile from users table
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('id, full_name, avatar_url, phone')
        .eq('id', authUser.id)
        .single();

      if (profileError) {
        console.error('Profile fetch error:', profileError);
        setError('Unable to load profile data');
        return;
      }

      if (profileData) {
        setUser({
          id: profileData.id,
          fullName: normalizeName(profileData.full_name),
          avatarUrl: profileData.avatar_url,
          phone: profileData.phone,
        });
      }
    } catch (err) {
      console.error('Unexpected error fetching user profile:', err);
      setError('Unable to load profile data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserProfile();
  }, [authUser?.id, isAuthenticated]);

  return {
    user,
    loading,
    error,
    refetch: fetchUserProfile,
  };
}
