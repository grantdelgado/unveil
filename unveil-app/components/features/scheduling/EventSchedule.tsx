'use client';

import { formatEventDate } from '@/lib/utils/date';
import { getTimezoneLabel, getTimezoneInfo, formatTimeWithTimezone } from '@/lib/utils/timezone';

interface EventScheduleProps {
  eventDate: string;
  location?: string | null;
  timeZone?: string | null;
}

export default function EventSchedule({
  eventDate,
  location,
  timeZone,
}: EventScheduleProps) {
  // Get timezone info for display
  const timeZoneInfo = timeZone ? getTimezoneInfo(timeZone) : null;
  const timeZoneLabel = getTimezoneLabel(timeZone);

  // Sample schedule - in a real app, this would come from the database
  // For now, these are hardcoded times that will be displayed in event timezone
  const scheduleItems = [
    { time: '2:00 PM', event: 'Guest Arrival & Cocktails', icon: '🥂' },
    { time: '3:00 PM', event: 'Wedding Ceremony', icon: '💒' },
    { time: '3:30 PM', event: 'Photos & Mingling', icon: '📸' },
    { time: '5:00 PM', event: 'Reception Begins', icon: '🎉' },
    { time: '6:00 PM', event: 'Dinner Service', icon: '🍽️' },
    { time: '8:00 PM', event: 'First Dance', icon: '💃' },
    { time: '8:30 PM', event: 'Dancing & Celebration', icon: '🕺' },
    { time: '11:00 PM', event: 'Last Dance', icon: '🌙' },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">
        📋 Event Schedule
      </h2>

      <div className="mb-4">
        <h3 className="font-semibold text-gray-900">
          {formatEventDate(eventDate)}
        </h3>
        {location && <p className="text-gray-600 text-sm">{location}</p>}
        
        {/* Timezone label */}
        <div className="mt-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-lg inline-block">
          <p className="text-blue-800 text-xs font-medium">
            {timeZoneLabel}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {scheduleItems.map((item, index) => (
          <div
            key={index}
            className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg"
          >
            <div className="text-2xl">{item.icon}</div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900">{item.event}</span>
                <span className="text-sm text-gray-600 font-mono">
                  {formatTimeWithTimezone(item.time, timeZoneInfo)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-blue-800 text-sm">
          <span className="font-medium">💡 Tip:</span> Times are approximate and
          may vary slightly on the day.
        </p>
      </div>
    </div>
  );
}
