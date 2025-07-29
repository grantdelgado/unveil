'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/utils';
import { Calendar, Filter, RefreshCw, Clock, CheckCircle2, AlertCircle, X } from 'lucide-react';
// Note: Scheduled messages now handled via useMessages domain hook
import { ScheduledMessageCard } from './ScheduledMessageCard';
import type { Tables } from '@/app/reference/supabase.types';

type ScheduledMessage = Tables<'scheduled_messages'>;

interface MessageQueueProps {
  eventId: string;
  onEdit?: (message: ScheduledMessage) => void;
  onScheduleNew?: () => void;
  className?: string;
}

type StatusFilter = 'all' | 'scheduled' | 'sending' | 'sent' | 'failed' | 'cancelled';
type SortOption = 'send_time_asc' | 'send_time_desc' | 'created_asc' | 'created_desc';

export function MessageQueue({
  eventId,
  onEdit,
  onScheduleNew,
  className
}: MessageQueueProps) {
  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortOption, setSortOption] = useState<SortOption>('send_time_asc');

  const loadMessages = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const filters: ScheduledMessageFilters = {
        eventId
      };

      if (statusFilter !== 'all') {
        filters.status = [statusFilter];
      }

      const data = await getScheduledMessages(filters);
      setMessages(data);
    } catch (err) {
      console.error('Error loading scheduled messages:', err);
      setError('Failed to load scheduled messages');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId, statusFilter]);

  useEffect(() => {
    loadMessages();
  }, [eventId, statusFilter, loadMessages]);

  const sortedMessages = useMemo(() => {
    const sorted = [...messages];
    
    switch (sortOption) {
      case 'send_time_asc':
        return sorted.sort((a, b) => new Date(a.send_at).getTime() - new Date(b.send_at).getTime());
      case 'send_time_desc':
        return sorted.sort((a, b) => new Date(b.send_at).getTime() - new Date(a.send_at).getTime());
      case 'created_asc':
        return sorted.sort((a, b) => 
          new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime()
        );
      case 'created_desc':
        return sorted.sort((a, b) => 
          new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime()
        );
      default:
        return sorted;
    }
  }, [messages, sortOption]);

  const getStatusCounts = () => {
    const counts = {
      all: messages.length,
      scheduled: 0,
      sending: 0,
      sent: 0,
      failed: 0,
      cancelled: 0
    };

    messages.forEach(message => {
      const status = message.status || 'scheduled';
      if (status in counts) {
        counts[status as keyof typeof counts]++;
      }
    });

    return counts;
  };

  const statusCounts = getStatusCounts();

  const getFilterButtonClass = (filter: StatusFilter) => {
    const isActive = statusFilter === filter;
    const count = statusCounts[filter];
    
    if (count === 0) {
      return 'text-gray-400 cursor-not-allowed';
    }
    
    if (isActive) {
      return 'bg-blue-100 text-blue-700 border-blue-200';
    }
    
    return 'text-gray-600 hover:text-gray-800 hover:bg-gray-50';
  };

  const getStatusIcon = (status: StatusFilter) => {
    switch (status) {
      case 'scheduled':
        return <Clock className="w-3 h-3" />;
      case 'sent':
        return <CheckCircle2 className="w-3 h-3" />;
      case 'failed':
        return <AlertCircle className="w-3 h-3" />;
      case 'cancelled':
        return <X className="w-3 h-3" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <LoadingSpinner size="lg" />
            <p className="text-sm text-gray-600">Loading scheduled messages...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-red-800 mb-2">Error Loading Messages</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={() => loadMessages()} variant="secondary">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <Calendar className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Message Queue</h2>
            <p className="text-sm text-gray-600">
              {messages.length} scheduled message{messages.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => loadMessages(true)}
            disabled={refreshing}
            className="p-2"
          >
            <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
          </Button>

          {onScheduleNew && (
            <Button onClick={onScheduleNew}>
              Schedule New
            </Button>
          )}
        </div>
      </div>

      {/* Filters and Sorting */}
      <div className="space-y-4">
        {/* Status Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 text-sm text-gray-600">
            <Filter className="w-4 h-4" />
            <span>Filter:</span>
          </div>
          
          {(['all', 'scheduled', 'sending', 'sent', 'failed', 'cancelled'] as StatusFilter[]).map(status => (
            <button
              key={status}
              onClick={() => statusCounts[status] > 0 && setStatusFilter(status)}
              disabled={statusCounts[status] === 0}
              className={cn(
                'inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full border transition-colors',
                getFilterButtonClass(status)
              )}
            >
              {getStatusIcon(status)}
              <span className="capitalize">{status}</span>
              <span className="text-xs opacity-75">({statusCounts[status]})</span>
            </button>
          ))}
        </div>

        {/* Sort Options */}
        <div className="flex items-center gap-4">
          <label className="text-sm text-gray-600">
            Sort by:
          </label>
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as SortOption)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="send_time_asc">Send Time (Earliest first)</option>
            <option value="send_time_desc">Send Time (Latest first)</option>
            <option value="created_asc">Created (Oldest first)</option>
            <option value="created_desc">Created (Newest first)</option>
          </select>
        </div>
      </div>

      {/* Message List */}
      {sortedMessages.length === 0 ? (
        <EmptyState
          variant="messages"
          title={statusFilter === 'all' ? 'No scheduled messages' : `No ${statusFilter} messages`}
          description={
            statusFilter === 'all' 
              ? 'You haven&apos;t scheduled any messages yet. Create your first scheduled message to get started.'
              : `There are no messages with status "${statusFilter}".`
          }
          actionText={onScheduleNew && statusFilter === 'all' ? 'Schedule Message' : undefined}
          onAction={onScheduleNew && statusFilter === 'all' ? onScheduleNew : undefined}
        />
      ) : (
        <div className="space-y-4">
          {sortedMessages.map(message => (
            <ScheduledMessageCard
              key={message.id}
              message={message}
              onUpdate={() => loadMessages(true)}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}

      {/* Summary Stats */}
      {messages.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-lg font-semibold text-blue-600">{statusCounts.scheduled}</div>
              <div className="text-xs text-gray-600">Scheduled</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-green-600">{statusCounts.sent}</div>
              <div className="text-xs text-gray-600">Sent</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-red-600">{statusCounts.failed}</div>
              <div className="text-xs text-gray-600">Failed</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-600">{statusCounts.cancelled}</div>
              <div className="text-xs text-gray-600">Cancelled</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 