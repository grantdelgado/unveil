'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  eventDetailsSchema,
  type EventDetailsFormData,
} from '@/lib/validation/events';
import { COMMON_TIMEZONES } from '@/lib/utils/timezone';
import { formatEventDate } from '@/lib/utils/date';
import {
  CardContainer,
  SectionTitle,
  FieldLabel,
  TextInput,
  PrimaryButton,
  SecondaryButton,
  MicroCopy,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import type { Database } from '@/app/reference/supabase.types';

type Event = Database['public']['Tables']['events']['Row'];

interface EventDetailsEditorProps {
  event: Event;
  onSave: (
    data: EventDetailsFormData,
  ) => Promise<{ success: boolean; error?: string }>;
  onCancel: () => void;
  onPreviewGuestView: () => void;
}

// Unsaved changes warning component
function useUnsavedChanges(hasChanges: boolean) {
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue =
          'You have unsaved changes. Are you sure you want to leave?';
      }
    };

    if (hasChanges) {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasChanges]);
}

export function EventDetailsEditor({
  event,
  onSave,
  onCancel,
  onPreviewGuestView,
}: EventDetailsEditorProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
    timestamp?: Date;
  }>({ type: null, message: '' });

  // Get available timezones (fallback to common list if browser doesn't support Intl.supportedValuesOf)
  const availableTimezones = (() => {
    try {
      // Modern browsers support this
      if ('supportedValuesOf' in Intl) {
        return (Intl as { supportedValuesOf: (type: string) => string[] })
          .supportedValuesOf('timeZone')
          .map((tz: string) => ({ value: tz, label: tz.replace(/_/g, ' ') }))
          .sort((a, b) => a.label.localeCompare(b.label));
      }
    } catch {
      // Fallback to common timezones
    }
    return COMMON_TIMEZONES;
  })();

  // Initialize form with current event data
  const form = useForm<EventDetailsFormData>({
    resolver: zodResolver(eventDetailsSchema),
    defaultValues: {
      title: event.title || '',
      event_date: event.event_date || '',
      time_zone: event.time_zone || '',
      location: event.location || '',
      website_url: event.website_url || '',
      photo_album_url: event.photo_album_url || '',
      sms_tag: event.sms_tag || '',
      is_public: event.is_public ?? false,
      allow_open_signup: event.allow_open_signup ?? true,
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isDirty, isValid },
    setValue,
    clearErrors,
  } = form;

  const watchedValues = watch();

  // Enable unsaved changes warning
  useUnsavedChanges(isDirty);

  // Clear save status after a delay
  useEffect(() => {
    if (saveStatus.type === 'success' && saveStatus.timestamp) {
      const timer = setTimeout(() => {
        setSaveStatus({ type: null, message: '' });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [saveStatus]);

  // Handle form submission
  const onSubmit = async (data: EventDetailsFormData) => {
    setIsSubmitting(true);
    setSaveStatus({ type: null, message: '' });

    try {
      const result = await onSave(data);

      if (result.success) {
        setSaveStatus({
          type: 'success',
          message: 'Event details saved successfully!',
          timestamp: new Date(),
        });
      } else {
        setSaveStatus({
          type: 'error',
          message: result.error || 'Failed to save event details',
        });
      }
    } catch {
      setSaveStatus({
        type: 'error',
        message: 'An unexpected error occurred',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle timezone selection
  const handleTimezoneChange = (value: string) => {
    setValue('time_zone', value, { shouldValidate: true, shouldDirty: true });
    clearErrors('time_zone');
  };

  // Handle website URL input with normalization hint
  const handleWebsiteUrlChange = (value: string) => {
    setValue('website_url', value, { shouldValidate: true, shouldDirty: true });
    clearErrors('website_url');
  };

  // Handle photo album URL input with normalization hint
  const handlePhotoAlbumUrlChange = (value: string) => {
    setValue('photo_album_url', value, {
      shouldValidate: true,
      shouldDirty: true,
    });
    clearErrors('photo_album_url');
  };

  // Handle cancel with unsaved changes check
  const handleCancel = () => {
    if (isDirty) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to cancel?',
      );
      if (!confirmed) return;
    }
    onCancel();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Form Header */}
      <CardContainer className="p-6">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-gray-900">
            Edit Event Details
          </h1>
          <MicroCopy>
            Update the information your guests will see about your event
          </MicroCopy>
        </div>
      </CardContainer>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basics Group */}
        <CardContainer className="p-6">
          <div className="space-y-6">
            <SectionTitle className="flex items-center gap-2">
              <span className="text-2xl">📝</span>
              Basics
            </SectionTitle>

            {/* Event Title */}
            <div className="space-y-2">
              <FieldLabel htmlFor="title" required>
                Event Title
              </FieldLabel>
              <TextInput
                id="title"
                {...register('title')}
                placeholder="e.g., Sarah & David's Wedding"
                error={errors.title?.message}
                disabled={isSubmitting}
              />
              <MicroCopy>
                This will appear at the top of your guest pages
              </MicroCopy>
            </div>

            {/* Event Date */}
            <div className="space-y-2">
              <FieldLabel htmlFor="event_date" required>
                Event Date
              </FieldLabel>
              <TextInput
                type="date"
                id="event_date"
                {...register('event_date')}
                error={errors.event_date?.message}
                disabled={isSubmitting}
              />
              <MicroCopy>
                {watchedValues.event_date && (
                  <>Preview: {formatEventDate(watchedValues.event_date)}</>
                )}
              </MicroCopy>
            </div>

            {/* Time Zone */}
            <div className="space-y-2">
              <FieldLabel htmlFor="time_zone" required>
                Time Zone
              </FieldLabel>
              <div className="relative">
                <select
                  id="time_zone"
                  {...register('time_zone')}
                  onChange={(e) => handleTimezoneChange(e.target.value)}
                  className={cn(
                    'w-full py-3 px-4 border rounded-lg text-base bg-white',
                    'focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-400',
                    'transition-colors duration-200',
                    errors.time_zone ? 'border-red-300' : 'border-gray-300',
                  )}
                  disabled={isSubmitting}
                >
                  <option value="">Select time zone...</option>
                  {availableTimezones.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>
              {errors.time_zone && (
                <p className="text-red-600 text-sm">
                  {errors.time_zone.message}
                </p>
              )}
              <MicroCopy>
                All schedule times will be displayed in this timezone
              </MicroCopy>
            </div>
          </div>
        </CardContainer>

        {/* Location Group */}
        <CardContainer className="p-6">
          <div className="space-y-6">
            <SectionTitle className="flex items-center gap-2">
              <span className="text-2xl">📍</span>
              Location
            </SectionTitle>

            <div className="space-y-2">
              <FieldLabel htmlFor="location">
                Where is your event taking place?
              </FieldLabel>
              <textarea
                id="location"
                {...register('location')}
                placeholder="e.g., The Grand Ballroom, 123 Main St, City, State"
                rows={3}
                className={cn(
                  'w-full py-3 px-4 border rounded-lg text-base placeholder-gray-400',
                  'focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-400',
                  'transition-colors duration-200 resize-none',
                  errors.location ? 'border-red-300' : 'border-gray-300',
                )}
                disabled={isSubmitting}
              />
              {errors.location && (
                <p className="text-red-600 text-sm">
                  {errors.location.message}
                </p>
              )}
              <MicroCopy>
                Optional: Provide venue details for your guests
              </MicroCopy>
            </div>
          </div>
        </CardContainer>

        {/* Website Group */}
        <CardContainer className="p-6">
          <div className="space-y-6">
            <SectionTitle className="flex items-center gap-2">
              <span className="text-2xl">🔗</span>
              Website
            </SectionTitle>

            <div className="space-y-2">
              <FieldLabel htmlFor="website_url">Wedding Website</FieldLabel>
              <TextInput
                type="url"
                id="website_url"
                {...register('website_url')}
                placeholder="e.g., theknot.com/sarah-david-2025"
                error={errors.website_url?.message}
                disabled={isSubmitting}
                onChange={(e) => handleWebsiteUrlChange(e.target.value)}
              />
              <MicroCopy>
                We&apos;ll add https:// if missing • Optional but recommended
              </MicroCopy>
            </div>
          </div>
        </CardContainer>

        {/* Photo Album Group */}
        <CardContainer className="p-6">
          <div className="space-y-6">
            <SectionTitle className="flex items-center gap-2">
              <span className="text-2xl">📸</span>
              Photo Album
            </SectionTitle>

            <div className="space-y-2">
              <FieldLabel htmlFor="photo_album_url">
                Photo Album Link
              </FieldLabel>
              <TextInput
                type="url"
                id="photo_album_url"
                {...register('photo_album_url')}
                placeholder="e.g., icloud.com/sharedalbum/..., photos.google.com/share/..."
                error={errors.photo_album_url?.message}
                disabled={isSubmitting}
                onChange={(e) => handlePhotoAlbumUrlChange(e.target.value)}
              />
              <MicroCopy>
                Paste a link to your shared album (iCloud, Google Photos,
                Dropbox, etc.). We&apos;ll add https:// if missing.
              </MicroCopy>
            </div>
          </div>
        </CardContainer>

        {/* SMS Branding Group */}
        <CardContainer className="p-6">
          <div className="space-y-6">
            <SectionTitle className="flex items-center gap-2">
              <span className="text-2xl">💬</span>
              SMS Branding
            </SectionTitle>

            <div className="space-y-2">
              <FieldLabel htmlFor="sms_tag">
                Event Tag for SMS
              </FieldLabel>
              <TextInput
                id="sms_tag"
                {...register('sms_tag')}
                placeholder="e.g., Sarah + David, Wedding 2025"
                error={errors.sms_tag?.message}
                disabled={isSubmitting}
                maxLength={24}
              />
              <MicroCopy>
                Optional: This tag appears at the start of SMS messages to identify your event.
                Max 24 characters. Leave empty to auto-generate from event title.
                {watchedValues.sms_tag && (
                  <>
                    <br />
                    <span className="font-medium">Preview:</span> {watchedValues.sms_tag}: Your message text here...
                  </>
                )}
              </MicroCopy>
            </div>
          </div>
        </CardContainer>

        {/* Visibility Group */}
        <CardContainer className="p-6">
          <div className="space-y-6">
            <div>
              <SectionTitle className="flex items-center gap-2">
                <span className="text-2xl">👁️</span>
                Visibility
              </SectionTitle>
            </div>

            <div className="space-y-4">
              {/* Show Event to Invited Guests Toggle */}
              <div className="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  id="is_public"
                  {...register('is_public')}
                  className="h-5 w-5 text-rose-600 focus:ring-rose-300 border-gray-300 rounded mt-0.5"
                  disabled={isSubmitting}
                />
                <div className="space-y-1 flex-1">
                  <label
                    htmlFor="is_public"
                    className="text-base font-medium text-gray-700"
                  >
                    Show event to invited guests
                  </label>
                  <MicroCopy>
                    Invited guests who sign in with their phone number can find
                    this event and will be added automatically.
                  </MicroCopy>
                  <div
                    className={cn(
                      'text-xs px-2 py-1 rounded-md mt-2 inline-block',
                      watchedValues.is_public
                        ? 'bg-green-50 text-green-700'
                        : 'bg-amber-50 text-amber-700',
                    )}
                  >
                    {watchedValues.is_public
                      ? 'Guests on your list will see and join this event after they sign in.'
                      : "This event won't appear automatically. Share an invite link or add guests manually."}
                  </div>
                </div>
              </div>

              {/* Hidden field for allow_open_signup - keep it true for invited guests */}
              <input
                type="hidden"
                {...register('allow_open_signup')}
                value="true"
              />
            </div>

            {/* Helper Row - Show when toggle is OFF */}
            {!watchedValues.is_public && (
              <div className="border-t border-gray-200 pt-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <SecondaryButton
                      type="button"
                      onClick={() => {
                        // Copy invite link functionality - placeholder for now
                        navigator.clipboard?.writeText(
                          `${window.location.origin}/guest/events/${event.id}/home`,
                        );
                        // TODO: Replace with actual copy invite handler
                      }}
                      className="text-sm bg-white hover:bg-gray-50 border-blue-300 text-blue-700"
                      disabled={isSubmitting}
                    >
                      Copy invite link
                    </SecondaryButton>
                    <SecondaryButton
                      type="button"
                      onClick={() => {
                        window.location.href = `/host/events/${event.id}/guests`;
                      }}
                      className="text-sm bg-white hover:bg-gray-50 border-blue-300 text-blue-700"
                      disabled={isSubmitting}
                    >
                      Manage guests
                    </SecondaryButton>
                  </div>
                </div>
              </div>
            )}

            <MicroCopy>
              Anyone can create an Unveil account. This setting only controls
              access to this event.
            </MicroCopy>
          </div>
        </CardContainer>

        {/* Action Buttons */}
        <CardContainer className="p-6">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
            <div className="flex flex-col sm:flex-row gap-3">
              <PrimaryButton
                type="submit"
                disabled={!isDirty || !isValid || isSubmitting}
                loading={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </PrimaryButton>

              <SecondaryButton
                type="button"
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                Cancel
              </SecondaryButton>
            </div>

            <SecondaryButton
              type="button"
              onClick={onPreviewGuestView}
              disabled={isSubmitting}
              className="border-blue-300 text-blue-700 hover:bg-blue-50"
            >
              Preview Guest View
            </SecondaryButton>
          </div>

          {/* Save Status */}
          {saveStatus.type && (
            <div className="mt-4">
              <div
                className={cn(
                  'p-4 rounded-lg text-center text-sm',
                  saveStatus.type === 'success'
                    ? 'bg-green-50 text-green-700 border border-green-100'
                    : 'bg-red-50 text-red-700 border border-red-100',
                )}
              >
                {saveStatus.message}
                {saveStatus.type === 'success' && saveStatus.timestamp && (
                  <div className="text-xs mt-1 opacity-75">
                    Saved {saveStatus.timestamp.toLocaleTimeString()}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContainer>
      </form>
    </div>
  );
}
