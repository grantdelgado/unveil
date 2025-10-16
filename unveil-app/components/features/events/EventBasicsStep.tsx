'use client';

import { ChangeEvent } from 'react';
import { TextInput, MicroCopy } from '@/components/ui';
import type { EventFormData, EventFormErrors } from './types';

interface EventBasicsStepProps {
  formData: EventFormData;
  errors: EventFormErrors;
  onUpdate: (field: keyof EventFormData, value: string | boolean) => void;
  disabled: boolean;
}

export function EventBasicsStep({
  formData,
  errors,
  onUpdate,
  disabled,
}: EventBasicsStepProps) {
  return (
    <div className="space-y-6">
      {/* Event Name */}
      <div className="space-y-2">
        <label
          htmlFor="title"
          className="block text-sm font-medium text-gray-700"
        >
          What would you like your guests to see as the title of your wedding?{' '}
          <span className="text-red-500">*</span>
        </label>
        <TextInput
          id="title"
          value={formData.title}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onUpdate('title', e.target.value)
          }
          placeholder="e.g., Sarah & Max's Wedding"
          disabled={disabled}
          error={errors.title}
          autoFocus
          maxLength={100}
          className="text-[16px] min-h-[44px]"
        />
        <MicroCopy>This will be the main title for your wedding hub</MicroCopy>
      </div>

      {/* Wedding Date */}
      <div className="space-y-2">
        <label
          htmlFor="event_date"
          className="block text-sm font-medium text-gray-700"
        >
          Wedding Date <span className="text-red-500">*</span>
        </label>
        <TextInput
          type="date"
          id="event_date"
          value={formData.event_date}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onUpdate('event_date', e.target.value)
          }
          disabled={disabled}
          error={errors.event_date}
          min={new Date().toISOString().split('T')[0]}
          className="text-[16px] min-h-[44px]"
        />
        <MicroCopy>
          You&apos;ll be able to add ceremony, reception, and other events with specific times after creating your Wedding Hub.
        </MicroCopy>
      </div>

      {/* Event Tag for SMS */}
      <div className="space-y-2">
        <label
          htmlFor="sms_tag"
          className="block text-sm font-medium text-gray-700"
        >
          Event Tag for SMS <span className="text-red-500">*</span>
        </label>
        <TextInput
          id="sms_tag"
          value={formData.sms_tag}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onUpdate('sms_tag', e.target.value)
          }
          placeholder="e.g., Sarah + David"
          disabled={disabled}
          error={errors.sms_tag}
          maxLength={20}
          className="text-[16px] min-h-[44px]"
        />
        <MicroCopy>
          Short label shown at the start of each SMS so guests recognize your event. Max 20 characters. Example: Sarah + David.
          {formData.sms_tag.trim() && (
            <>
              <br />
              <span className="font-medium">Preview:</span> {formData.sms_tag.trim()}: Your message text…
            </>
          )}
        </MicroCopy>
      </div>

      {/* Event Location */}
      <div className="space-y-2">
        <label
          htmlFor="location"
          className="block text-sm font-medium text-gray-700"
        >
          Location
        </label>
        <TextInput
          id="location"
          value={formData.location}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onUpdate('location', e.target.value)
          }
          placeholder="e.g., Central Park, New York"
          disabled={disabled}
          maxLength={200}
          className="text-[16px] min-h-[44px]"
        />
        <MicroCopy>Optional: Where will your celebration take place?</MicroCopy>
      </div>

      {/* Privacy Setting */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <input
            type="checkbox"
            id="is_public"
            checked={formData.is_public}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              onUpdate('is_public', e.target.checked)
            }
            className="h-5 w-5 text-pink-500 focus:ring-pink-300 border-gray-300 rounded mt-0.5"
            disabled={disabled}
          />
          <div className="space-y-1">
            <label
              htmlFor="is_public"
              className="text-base font-medium text-gray-700"
            >
              Make your wedding hub visible to invited guests?
            </label>
            <MicroCopy>
              When enabled, invited guests will see this event after logging in. 
              If disabled, you can still invite them now—but they won&apos;t see 
              anything until you publish.
            </MicroCopy>
          </div>
        </div>
      </div>
    </div>
  );
}
