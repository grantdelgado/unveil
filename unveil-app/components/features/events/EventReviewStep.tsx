'use client';

import { formatEventDate } from '@/lib/utils/date';
import type { EventFormData } from './types';

interface EventReviewStepProps {
  formData: EventFormData;
}

export function EventReviewStep({
  formData,
}: EventReviewStepProps) {
  return (
    <div className="space-y-4">
      {/* Instruction */}
      <p className="text-center text-[15px] text-gray-600">
        Here&apos;s what you&apos;ve set up. You can go back to make changes, or create your hub now.
      </p>

      {/* Event Preview Card */}
      <div className="bg-gradient-to-r from-pink-50 to-rose-50 rounded-lg overflow-hidden border border-pink-100">
        {/* Event Details */}
        <div className="p-5 space-y-3">
          <div className="text-center">
            <h3 className="text-xl font-bold text-gray-900 mb-1">
              {formData.title}
            </h3>
            <p className="text-[15px] text-gray-700">
              {formatEventDate(formData.event_date)}
            </p>
          </div>

          {formData.location && (
            <div className="text-center">
              <p className="text-[15px] text-gray-600 flex items-center justify-center gap-1.5">
                <span>📍</span>
                {formData.location}
              </p>
            </div>
          )}

          {/* Configuration inline */}
          <div className="pt-3 border-t border-pink-100 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Visibility</span>
              <span className="font-medium text-gray-900">
                {formData.is_public ? 'Visible to guests' : 'Hidden'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-600">SMS Tag</span>
              <span className="font-medium text-gray-900">
                {formData.sms_tag}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Final confirmation */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="text-blue-600 text-xl flex-shrink-0">🎉</div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-blue-900 mb-2">
              Ready to create your wedding hub?
            </h4>
            <ul className="text-sm text-blue-800 space-y-1.5 list-disc pl-5 ml-0.5">
              <li className="pl-1">Your event hub will be created instantly</li>
              <li className="pl-1">You&apos;ll be taken to your dashboard where you can invite guests, send messages, and manage everything</li>
              <li className="pl-1">All settings can be edited later</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
