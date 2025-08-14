'use client';

import { ChangeEvent } from 'react';
import { TextInput, MicroCopy } from '@/components/ui';
import type { EventFormData, EventFormErrors } from './CreateEventWizard';

interface EventBasicsStepProps {
  formData: EventFormData;
  errors: EventFormErrors;
  onUpdate: (field: keyof EventFormData, value: string | boolean) => void;
  disabled: boolean;
}

export function EventBasicsStep({ formData, errors, onUpdate, disabled }: EventBasicsStepProps) {
  return (
    <div className="space-y-6">
      {/* Event Name */}
      <div className="space-y-2">
        <label htmlFor="title" className="block text-sm font-medium text-gray-700">
          What would you like your guests to see as the title of your wedding? <span className="text-red-500">*</span>
        </label>
        <TextInput
          id="title"
          value={formData.title}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onUpdate('title', e.target.value)}
          placeholder="e.g., Sarah & Max's Wedding"
          disabled={disabled}
          error={errors.title}
          autoFocus
          maxLength={100}
          className="text-[16px] min-h-[44px]"
        />
        <MicroCopy>This will be the main title for your wedding hub</MicroCopy>
      </div>

      {/* Date and Time Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Event Date */}
        <div className="space-y-2">
          <label htmlFor="event_date" className="block text-sm font-medium text-gray-700">
            Wedding Date <span className="text-red-500">*</span>
          </label>
          <TextInput
            type="date"
            id="event_date"
            value={formData.event_date}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onUpdate('event_date', e.target.value)}
            disabled={disabled}
            error={errors.event_date}
            min={new Date().toISOString().split('T')[0]}
            className="text-[16px] min-h-[44px]"
          />
        </div>

        {/* Event Time */}
        <div className="space-y-2">
          <label htmlFor="event_time" className="block text-sm font-medium text-gray-700">
            Wedding Time <span className="text-red-500">*</span>
          </label>
          <TextInput
            type="time"
            id="event_time"
            value={formData.event_time}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onUpdate('event_time', e.target.value)}
            disabled={disabled}
            error={errors.event_time}
            className="text-[16px] min-h-[44px]"
          />
        </div>
      </div>

      {/* Event Location */}
      <div className="space-y-2">
        <label htmlFor="location" className="block text-sm font-medium text-gray-700">
          Location
        </label>
        <TextInput
          id="location"
          value={formData.location}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onUpdate('location', e.target.value)}
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
            onChange={(e: ChangeEvent<HTMLInputElement>) => onUpdate('is_public', e.target.checked)}
            className="h-5 w-5 text-pink-500 focus:ring-pink-300 border-gray-300 rounded mt-0.5"
            disabled={disabled}
          />
          <div className="space-y-1">
            <label
              htmlFor="is_public"
              className="text-base font-medium text-gray-700"
            >
              Publish your wedding hub now?
            </label>
            <MicroCopy>
              Guests will be able to see your wedding hub as soon as they log in with their invited phone number. You can also choose to add guests before publishing.
            </MicroCopy>
          </div>
        </div>
      </div>
    </div>
  );
} 