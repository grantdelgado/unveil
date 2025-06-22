'use client';

import React, { useEffect, useState } from 'react';
import { CardContainer } from '@/components/ui';
import { supabase } from '@/lib/supabase';

interface GuestStatusData {
  attending: number;
  declined: number;
  pending: number;
  maybe: number;
  total: number;
}

interface GuestStatusCardProps {
  eventId: string;
  onManageClick: () => void;
}

export function GuestStatusCard({ eventId, onManageClick }: GuestStatusCardProps) {
  const [statusData, setStatusData] = useState<GuestStatusData>({
    attending: 0,
    declined: 0,
    pending: 0,
    maybe: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGuestStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('event_participants')
          .select('rsvp_status')
          .eq('event_id', eventId);

        if (error) throw error;

        const counts = data?.reduce((acc, participant) => {
          const status = participant.rsvp_status || 'pending';
          acc[status as keyof Omit<GuestStatusData, 'total'>] = (acc[status as keyof Omit<GuestStatusData, 'total'>] || 0) + 1;
          acc.total += 1;
          return acc;
        }, {
          attending: 0,
          declined: 0,
          pending: 0,
          maybe: 0,
          total: 0,
        }) || { attending: 0, declined: 0, pending: 0, maybe: 0, total: 0 };

        setStatusData(counts);
      } catch (error) {
        console.error('Error fetching guest status:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGuestStatus();
  }, [eventId]);

  if (loading) {
    return (
      <CardContainer className="border-l-4 border-[#FF6B6B] animate-pulse">
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-8 bg-gray-200 rounded"></div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </CardContainer>
    );
  }

  return (
    <CardContainer className="border-l-4 border-[#FF6B6B] hover:shadow-lg transition-shadow duration-200">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">👥</span>
            <div>
              <h3 className="font-semibold text-gray-900">Participants</h3>
              <p className="text-sm text-gray-500">{statusData.total} total invited</p>
            </div>
          </div>
          <button 
            onClick={onManageClick}
            className="text-[#FF6B6B] hover:text-[#FF5A5A] font-medium text-sm transition-colors duration-200 min-h-[44px] px-3 rounded-lg hover:bg-[#FF6B6B]/5"
          >
            Manage →
          </button>
        </div>

        {/* RSVP Status Summary */}
        <div className="space-y-3">
          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div className="h-full flex">
              {statusData.total > 0 && (
                <>
                  {statusData.attending > 0 && (
                    <div 
                      className="bg-green-500" 
                      style={{ width: `${(statusData.attending / statusData.total) * 100}%` }}
                    />
                  )}
                  {statusData.maybe > 0 && (
                    <div 
                      className="bg-yellow-500" 
                      style={{ width: `${(statusData.maybe / statusData.total) * 100}%` }}
                    />
                  )}
                  {statusData.declined > 0 && (
                    <div 
                      className="bg-red-500" 
                      style={{ width: `${(statusData.declined / statusData.total) * 100}%` }}
                    />
                  )}
                </>
              )}
            </div>
          </div>

          {/* Status Breakdown */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center justify-between p-2 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-gray-700">Attending</span>
              </div>
              <span className="font-medium text-green-700">{statusData.attending}</span>
            </div>
            
            <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                <span className="text-gray-700">Pending</span>
              </div>
              <span className="font-medium text-gray-600">{statusData.pending}</span>
            </div>
            
            {statusData.maybe > 0 && (
              <div className="flex items-center justify-between p-2 bg-yellow-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  <span className="text-gray-700">Maybe</span>
                </div>
                <span className="font-medium text-yellow-700">{statusData.maybe}</span>
              </div>
            )}
            
            {statusData.declined > 0 && (
              <div className="flex items-center justify-between p-2 bg-red-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span className="text-gray-700">Declined</span>
                </div>
                <span className="font-medium text-red-700">{statusData.declined}</span>
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        {statusData.total > 0 && (
          <div className="text-center py-2 bg-gray-50 rounded-lg">
            <span className="text-sm font-medium text-gray-700">
              {Math.round((statusData.attending / statusData.total) * 100)}% confirmed attendance
            </span>
          </div>
        )}

        {/* Empty State */}
        {statusData.total === 0 && (
          <div className="text-center py-4 text-gray-500">
            <p className="text-sm">No participants yet</p>
            <p className="text-xs mt-1">Import your guest list to get started</p>
          </div>
        )}
      </div>
    </CardContainer>
  );
} 