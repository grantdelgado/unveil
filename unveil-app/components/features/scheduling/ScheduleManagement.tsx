'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Calendar,
  Clock,
  MapPin,
  Shirt,
  Edit,
  Trash2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { syncEventReminderOnTimeChange, upsertEventReminder } from '@/lib/services/messaging-client';
import {
  CardContainer,
  PrimaryButton,
  SecondaryButton,
  LoadingSpinner,
} from '@/components/ui';
import { ScheduleItemModal } from './ScheduleItemModal';
import { ReminderToggle } from './ReminderToggle';
import { formatEventDate } from '@/lib/utils/date';
import { fromUTCToEventZone, getTimezoneLabel } from '@/lib/utils/timezone';
import type { Database } from '@/app/reference/supabase.types';

type Event = {
  id: string;
  title: string;
  event_date: string;
  location: string | null;
  time_zone: string | null;
  host_user_id: string;
};

type ScheduleItem = Database['public']['Tables']['event_schedule_items']['Row'];

interface ScheduleManagementProps {
  eventId: string;
  event: Event;
}

export function ScheduleManagement({
  eventId,
  event,
}: ScheduleManagementProps) {
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);

  // Load schedule items
  const loadScheduleItems = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('event_schedule_items')
        .select('*')
        .eq('event_id', eventId)
        .order('start_at', { ascending: true });

      if (fetchError) {
        console.error('Error loading schedule items:', fetchError);
        setError('Failed to load schedule items');
        return;
      }

      setScheduleItems(data || []);
    } catch (error) {
      console.error('Unexpected error loading schedule:', error);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadScheduleItems();
  }, [eventId, loadScheduleItems]);

  // Handle item creation/update
  const handleItemSaved = async () => {
    // If we were editing an existing item, sync any reminder timing
    if (editingItem) {
      try {
        await syncEventReminderOnTimeChange(eventId, editingItem.id);
      } catch (error) {
        console.error('Failed to sync reminder after schedule update:', error);
        // Don't block the UI update for reminder sync failures
      }
    }
    
    setShowModal(false);
    setEditingItem(null);
    loadScheduleItems();
  };

  // Handle item deletion
  const handleDeleteItem = async (item: ScheduleItem) => {
    if (!confirm(`Are you sure you want to delete "${item.title}"?`)) {
      return;
    }

    try {
      // First, cancel any existing reminder for this item
      try {
        await upsertEventReminder(eventId, item.id, false);
      } catch (reminderError) {
        console.error('Failed to cancel reminder before deletion:', reminderError);
        // Continue with deletion even if reminder cancellation fails
      }

      // Then delete the schedule item
      const { error: deleteError } = await supabase
        .from('event_schedule_items')
        .delete()
        .eq('id', item.id);

      if (deleteError) {
        console.error('Error deleting schedule item:', deleteError);
        // TODO: Replace with proper error handling in Phase 2
        alert('Failed to delete schedule item. Please try again.');
        return;
      }

      // Refresh the list
      loadScheduleItems();
    } catch (error) {
      console.error('Unexpected error deleting item:', error);
      // TODO: Replace with proper error handling in Phase 2
      alert('An unexpected error occurred. Please try again.');
    }
  };

  // Group items by date (in event timezone)
  const groupedItems = scheduleItems.reduce(
    (groups, item) => {
      const eventTimeData = fromUTCToEventZone(
        item.start_at,
        event.time_zone || 'UTC',
      );
      const dateKey = eventTimeData?.date || item.start_at.split('T')[0];

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(item);
      return groups;
    },
    {} as Record<string, ScheduleItem[]>,
  );

  const sortedDates = Object.keys(groupedItems).sort();

  if (loading) {
    return (
      <CardContainer className="p-8">
        <div className="flex items-center justify-center">
          <LoadingSpinner size="lg" />
          <span className="ml-3 text-gray-600">Loading schedule...</span>
        </div>
      </CardContainer>
    );
  }

  if (error) {
    return (
      <CardContainer className="p-8">
        <div className="text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Error Loading Schedule
          </h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <SecondaryButton onClick={loadScheduleItems}>
            Try Again
          </SecondaryButton>
        </div>
      </CardContainer>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header with Add Button */}
        <CardContainer className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-1">
                Schedule Items
              </h2>
              <p className="text-sm text-gray-600">
                {scheduleItems.length === 0
                  ? 'No schedule items yet. Add your first item to get started.'
                  : `${scheduleItems.length} item${scheduleItems.length === 1 ? '' : 's'} scheduled`}
              </p>
            </div>
            <PrimaryButton
              onClick={() => setShowModal(true)}
              className="flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Item</span>
            </PrimaryButton>
          </div>
        </CardContainer>

        {/* Event Info */}
        <CardContainer className="p-6">
          <div className="flex items-start space-x-4">
            <Calendar className="w-5 h-5 text-purple-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-gray-900">
                {formatEventDate(event.event_date)}
              </h3>
              {event.location && (
                <p className="text-sm text-gray-600 mt-1">{event.location}</p>
              )}
              {event.time_zone && (
                <div className="mt-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-lg inline-block">
                  <p className="text-blue-800 text-xs font-medium">
                    {getTimezoneLabel(event.time_zone)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContainer>

        {/* Schedule Items */}
        {scheduleItems.length === 0 ? (
          <CardContainer className="p-12">
            <div className="text-center">
              <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No Schedule Items
              </h3>
              <p className="text-gray-600 mb-6">
                Create your first schedule item to start building your event
                timeline.
              </p>
              <PrimaryButton
                onClick={() => setShowModal(true)}
                className="flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add First Item</span>
              </PrimaryButton>
            </div>
          </CardContainer>
        ) : (
          <div className="space-y-6">
            {sortedDates.map((date) => (
              <CardContainer key={date} className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  {formatEventDate(date)}
                </h3>
                <div className="space-y-4">
                  {groupedItems[date].map((item) => {
                    const startTime = fromUTCToEventZone(
                      item.start_at,
                      event.time_zone || 'UTC',
                    );
                    const endTime = item.end_at
                      ? fromUTCToEventZone(
                          item.end_at,
                          event.time_zone || 'UTC',
                        )
                      : null;

                    return (
                      <div
                        key={item.id}
                        className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg"
                      >
                        <Clock className="w-5 h-5 text-gray-500 mt-0.5 flex-shrink-0" />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div className="min-w-0 flex-1">
                              <h4 className="font-medium text-gray-900 truncate">
                                {item.title}
                              </h4>

                              <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                                <span className="font-mono">
                                  {startTime?.formatted}
                                  {endTime && ` - ${endTime.formatted}`}
                                </span>
                              </div>

                              <div className="flex flex-wrap gap-3 mt-2">
                                {item.location && (
                                  <div className="flex items-center space-x-1 text-sm text-gray-600">
                                    <MapPin className="w-3 h-3" />
                                    <span>{item.location}</span>
                                  </div>
                                )}

                                {item.attire && (
                                  <div className="flex items-center space-x-1 text-sm text-gray-600">
                                    <Shirt className="w-3 h-3" />
                                    <span>{item.attire}</span>
                                  </div>
                                )}
                              </div>

                              {/* Reminder Toggle */}
                              <div className="mt-3 pt-3 border-t border-gray-200">
                                <ReminderToggle
                                  eventId={eventId}
                                  timelineId={item.id}
                                  startAtUtc={item.start_at}
                                  eventTimeZone={event.time_zone || undefined}
                                />
                              </div>
                            </div>

                            <div className="flex items-center space-x-2 ml-4">
                              <button
                                onClick={() => {
                                  setEditingItem(item);
                                  setShowModal(true);
                                }}
                                className="p-2 text-gray-400 hover:text-purple-600 hover:bg-white rounded-lg transition-colors"
                                title="Edit item"
                              >
                                <Edit className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => handleDeleteItem(item)}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-white rounded-lg transition-colors"
                                title="Delete item"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContainer>
            ))}
          </div>
        )}
      </div>

      {/* Modal for Add/Edit */}
      {showModal && (
        <ScheduleItemModal
          eventId={eventId}
          event={event}
          item={editingItem}
          onSave={handleItemSaved}
          onCancel={() => {
            setShowModal(false);
            setEditingItem(null);
          }}
        />
      )}
    </>
  );
}
