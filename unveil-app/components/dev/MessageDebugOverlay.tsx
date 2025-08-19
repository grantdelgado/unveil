'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';

interface MessageDebugOverlayProps {
  eventId: string;
  userId?: string | null;
  guestId?: string;
}

export function MessageDebugOverlay({ eventId, userId, guestId }: MessageDebugOverlayProps) {
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const fetchDebugInfo = async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      // Get message deliveries for this user
      const { data: deliveries, error: deliveryError } = await supabase
        .from('message_deliveries')
        .select(`
          id,
          message_id,
          user_id,
          guest_id,
          sms_status,
          created_at,
          message:messages!message_deliveries_message_id_fkey (
            id,
            content,
            event_id,
            created_at
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);

      // Get event guest record
      const { data: eventGuest, error: guestError } = await supabase
        .from('event_guests')
        .select('id, display_name, user_id, phone, sms_opt_out')
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .single();

      // Get all messages for this event (for comparison)
      const { data: allMessages, error: messagesError } = await supabase
        .from('messages')
        .select('id, content, created_at')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
        .limit(5);

      setDebugInfo({
        userId,
        eventId,
        guestId,
        deliveries: deliveries || [],
        eventGuest: eventGuest || null,
        allMessages: allMessages || [],
        errors: {
          deliveryError: deliveryError?.message,
          guestError: guestError?.message,
          messagesError: messagesError?.message
        }
      });
    } catch (error) {
      console.error('Debug info fetch error:', error);
      setDebugInfo({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  if (!showOverlay) {
    return (
      <button
        onClick={() => setShowOverlay(true)}
        className="fixed bottom-4 right-4 bg-red-500 text-white px-2 py-1 text-xs rounded opacity-50 hover:opacity-100 z-50"
        title="Debug Messages (Dev Only)"
      >
        🐛 MSG
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-4xl max-h-96 overflow-auto p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Message Debug Info</h3>
          <button
            onClick={() => setShowOverlay(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <button
            onClick={fetchDebugInfo}
            disabled={loading}
            className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Fetch Debug Info'}
          </button>

          {debugInfo && (
            <div className="space-y-3">
              <div className="bg-gray-100 p-3 rounded">
                <h4 className="font-semibold">Context:</h4>
                <pre className="text-xs">{JSON.stringify({
                  userId: debugInfo.userId,
                  eventId: debugInfo.eventId,
                  guestId: debugInfo.guestId
                }, null, 2)}</pre>
              </div>

              <div className="bg-green-100 p-3 rounded">
                <h4 className="font-semibold">Event Guest Record:</h4>
                <pre className="text-xs">{JSON.stringify(debugInfo.eventGuest, null, 2)}</pre>
              </div>

              <div className="bg-blue-100 p-3 rounded">
                <h4 className="font-semibold">Message Deliveries ({debugInfo.deliveries?.length || 0}):</h4>
                <pre className="text-xs">{JSON.stringify(debugInfo.deliveries, null, 2)}</pre>
              </div>

              <div className="bg-yellow-100 p-3 rounded">
                <h4 className="font-semibold">All Event Messages ({debugInfo.allMessages?.length || 0}):</h4>
                <pre className="text-xs">{JSON.stringify(debugInfo.allMessages, null, 2)}</pre>
              </div>

              {debugInfo.errors && Object.values(debugInfo.errors).some(Boolean) && (
                <div className="bg-red-100 p-3 rounded">
                  <h4 className="font-semibold">Errors:</h4>
                  <pre className="text-xs">{JSON.stringify(debugInfo.errors, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
