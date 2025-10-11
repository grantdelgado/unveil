'use client';

import { useState } from 'react';
import { Clock, MapPin, Shirt, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ReminderToggle } from './ReminderToggle';
import { fromUTCToEventZone } from '@/lib/utils/timezone';
import { cn } from '@/lib/utils';
import type { Database } from '@/app/reference/supabase.types';

type ScheduleItem = Database['public']['Tables']['event_schedule_items']['Row'];

interface ScheduleItemCardProps {
  item: ScheduleItem;
  eventId: string;
  eventTimeZone?: string;
  isHost?: boolean;
  onEdit?: (item: ScheduleItem) => void;
  onDelete?: (item: ScheduleItem) => void;
  className?: string;
}

export function ScheduleItemCard({
  item,
  eventId,
  eventTimeZone,
  isHost = false,
  onEdit,
  onDelete,
  className,
}: ScheduleItemCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Format times with locale-aware formatting
  const startTime = fromUTCToEventZone(item.start_at, eventTimeZone || 'UTC');
  const endTime = item.end_at 
    ? fromUTCToEventZone(item.end_at, eventTimeZone || 'UTC')
    : null;

  const timeDisplay = startTime?.formatted 
    ? `${startTime.formatted}${endTime ? ` – ${endTime.formatted}` : ''}`
    : 'Time TBD';

  const handleDelete = () => {
    if (showDeleteConfirm) {
      onDelete?.(item);
      setShowDeleteConfirm(false);
    } else {
      setShowDeleteConfirm(true);
      // Auto-cancel after 3 seconds
      setTimeout(() => setShowDeleteConfirm(false), 3000);
    }
  };

  return (
    <div
      className={cn(
        'bg-white rounded-3xl shadow-sm border border-gray-100 p-4 sm:p-5',
        'transition-all duration-200 hover:shadow-md hover:border-gray-200',
        className
      )}
      role="group"
    >
      <div className="grid gap-3">
        {/* Title row: icon + title | actions */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <Clock className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold leading-6 text-gray-900 line-clamp-2">
                {item.title}
              </h3>
            </div>
          </div>

          {/* Actions (host only) */}
          {isHost && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit?.(item)}
                className="h-11 w-11 rounded-xl hover:bg-muted/50 p-0"
                aria-label="Edit schedule item"
              >
                <Edit className="w-5 h-5" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                className={cn(
                  'h-11 w-11 rounded-xl hover:bg-muted/50 p-0',
                  showDeleteConfirm 
                    ? 'text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100' 
                    : 'hover:text-red-600'
                )}
                aria-label={showDeleteConfirm ? 'Confirm delete' : 'Delete schedule item'}
              >
                <Trash2 className="w-5 h-5" />
              </Button>
            </div>
          )}
        </div>

        {/* Meta information */}
        <dl className="grid gap-1.5 text-sm text-gray-600 mt-1">
          {/* Time */}
          <div className="flex items-center gap-2">
            <dt className="sr-only">Time</dt>
            <Clock className="w-[18px] h-[18px] text-gray-400 align-middle" />
            <dd className="tabular-nums tracking-tight text-[15px] font-medium">
              {timeDisplay}
            </dd>
          </div>

          {/* Location */}
          {item.location && (
            <div className="flex items-start gap-2">
              <dt className="sr-only">Location</dt>
              <MapPin className="w-[18px] h-[18px] text-gray-400 align-middle mt-0.5 flex-shrink-0" />
              <dd className="break-words">{item.location}</dd>
            </div>
          )}

          {/* Attire */}
          {item.attire && (
            <div className="flex items-start gap-2">
              <dt className="sr-only">Attire</dt>
              <Shirt className="w-[18px] h-[18px] text-gray-400 align-middle mt-0.5 flex-shrink-0" />
              <dd className="break-words">{item.attire}</dd>
            </div>
          )}
        </dl>

        {/* Divider before reminder */}
        <div className="border-t border-gray-100 my-3" />

        {/* Reminder section */}
        <div className="space-y-2">
          <ReminderToggle
            eventId={eventId}
            timelineId={item.id}
            startAtUtc={item.start_at}
            eventTimeZone={eventTimeZone}
            enhanced={true}
          />
        </div>
      </div>
    </div>
  );
}
