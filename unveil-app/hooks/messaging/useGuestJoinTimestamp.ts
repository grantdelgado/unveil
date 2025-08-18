import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

interface UseGuestJoinTimestampProps {
  eventId: string;
}

export function useGuestJoinTimestamp({ eventId }: UseGuestJoinTimestampProps) {
  const [joinTimestamp, setJoinTimestamp] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) {
      setLoading(false);
      return;
    }

    const fetchJoinTimestamp = async () => {
      try {
        setLoading(true);
        setError(null);

        // TODO: Implement get_guest_join_timestamp RPC function in database
        // For now, return null to allow build to proceed
        const data = null;
        const rpcError = null;

        if (rpcError) {
          throw rpcError;
        }

        setJoinTimestamp(data ? new Date(data) : null);
      } catch (err) {
        console.error('Error fetching guest join timestamp:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch join timestamp');
        setJoinTimestamp(null);
      } finally {
        setLoading(false);
      }
    };

    fetchJoinTimestamp();
  }, [eventId]);

  return {
    joinTimestamp,
    loading,
    error,
  };
}
