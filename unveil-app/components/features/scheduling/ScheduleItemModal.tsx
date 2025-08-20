'use client';

// Import convention: Use barrel exports from @/components/ui for consistency
// FieldLabel replaces Label; native textarea elements used instead of TextArea component
import { useState, useEffect } from 'react';
import { X, Calendar, Clock, MapPin, Shirt } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { 
  PrimaryButton, 
  SecondaryButton,
  LoadingSpinner,
  Input,
  FieldLabel
} from '@/components/ui';
import { toUTCFromEventZone, fromUTCToEventZone } from '@/lib/utils/timezone';
import { cn } from '@/lib/utils';
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

interface ScheduleItemModalProps {
  eventId: string;
  event: Event;
  item?: ScheduleItem | null;
  onSave: () => void;
  onCancel: () => void;
}

interface FormData {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  attire: string;
}

export function ScheduleItemModal({ 
  eventId, 
  event, 
  item, 
  onSave, 
  onCancel 
}: ScheduleItemModalProps) {
  const [formData, setFormData] = useState<FormData>({
    title: '',
    date: event.event_date,
    startTime: '',
    endTime: '',
    location: '',
    attire: ''
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize form data for editing
  useEffect(() => {
    if (item) {
      // Convert UTC times back to event timezone for editing
      const startTimeData = fromUTCToEventZone(item.start_at, event.time_zone || 'UTC');
      const endTimeData = item.end_at 
        ? fromUTCToEventZone(item.end_at, event.time_zone || 'UTC')
        : null;

      setFormData({
        title: item.title,
        date: startTimeData?.date || event.event_date,
        startTime: startTimeData?.time || '',
        endTime: endTimeData?.time || '',
        location: item.location || '',
        attire: item.attire || ''
      });
    }
  }, [item, event]);

  // Validation
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData.date) {
      newErrors.date = 'Date is required';
    }

    if (!formData.startTime) {
      newErrors.startTime = 'Start time is required';
    }

    // If end time is provided, validate it's after start time
    if (formData.endTime && formData.startTime) {
      const startMinutes = timeToMinutes(formData.startTime);
      const endMinutes = timeToMinutes(formData.endTime);
      
      if (endMinutes <= startMinutes) {
        newErrors.endTime = 'End time must be after start time';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Convert HH:MM to minutes for comparison
  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Convert local date/time to UTC using event timezone
      const startAtUTC = toUTCFromEventZone(
        formData.date,
        formData.startTime,
        event.time_zone || 'UTC'
      );

      const endAtUTC = formData.endTime
        ? toUTCFromEventZone(
            formData.date,
            formData.endTime,
            event.time_zone || 'UTC'
          )
        : null;

      if (!startAtUTC) {
        setErrors({ startTime: 'Invalid start time' });
        setLoading(false);
        return;
      }

      const itemData = {
        event_id: eventId,
        title: formData.title.trim(),
        start_at: startAtUTC,
        end_at: endAtUTC,
        location: formData.location.trim() || null,
        attire: formData.attire.trim() || null
      };

      let result;
      if (item) {
        // Update existing item
        result = await supabase
          .from('event_schedule_items')
          .update(itemData)
          .eq('id', item.id);
      } else {
        // Create new item
        result = await supabase
          .from('event_schedule_items')
          .insert(itemData);
      }

      if (result.error) {
        console.error('Error saving schedule item:', result.error);
        setErrors({ general: 'Failed to save schedule item. Please try again.' });
        setLoading(false);
        return;
      }

      onSave();
    } catch (error) {
      console.error('Unexpected error:', error);
      setErrors({ general: 'An unexpected error occurred. Please try again.' });
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {item ? 'Edit Schedule Item' : 'Add Schedule Item'}
          </h2>
          <button
            onClick={onCancel}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errors.general && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{errors.general}</p>
            </div>
          )}

          {/* Title */}
          <div>
            <FieldLabel htmlFor="title" required className="flex items-center space-x-2">
              <Calendar className="w-4 h-4" />
              <span>Event Title</span>
            </FieldLabel>
            <Input
              id="title"
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="e.g., Wedding Ceremony"
              className={cn(errors.title && 'border-red-300')}
              maxLength={100}
            />
            {errors.title && (
              <p className="text-sm text-red-600 mt-1">{errors.title}</p>
            )}
          </div>

          {/* Date */}
          <div>
            <FieldLabel htmlFor="date" required>Date</FieldLabel>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => handleInputChange('date', e.target.value)}
              className={cn(errors.date && 'border-red-300')}
            />
            {errors.date && (
              <p className="text-sm text-red-600 mt-1">{errors.date}</p>
            )}
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel htmlFor="startTime" required className="flex items-center space-x-2">
                <Clock className="w-4 h-4" />
                <span>Start Time</span>
              </FieldLabel>
              <Input
                id="startTime"
                type="time"
                value={formData.startTime}
                onChange={(e) => handleInputChange('startTime', e.target.value)}
                className={cn(errors.startTime && 'border-red-300')}
              />
              {errors.startTime && (
                <p className="text-sm text-red-600 mt-1">{errors.startTime}</p>
              )}
            </div>

            <div>
              <FieldLabel htmlFor="endTime">End Time</FieldLabel>
              <Input
                id="endTime"
                type="time"
                value={formData.endTime}
                onChange={(e) => handleInputChange('endTime', e.target.value)}
                className={cn(errors.endTime && 'border-red-300')}
              />
              {errors.endTime && (
                <p className="text-sm text-red-600 mt-1">{errors.endTime}</p>
              )}
            </div>
          </div>

          {/* Location */}
          <div>
            <FieldLabel htmlFor="location" className="flex items-center space-x-2">
              <MapPin className="w-4 h-4" />
              <span>Location</span>
            </FieldLabel>
            <Input
              id="location"
              type="text"
              value={formData.location}
              onChange={(e) => handleInputChange('location', e.target.value)}
              placeholder="e.g., Main Chapel"
              maxLength={100}
            />
          </div>

          {/* Attire */}
          <div>
            <FieldLabel htmlFor="attire" className="flex items-center space-x-2">
              <Shirt className="w-4 h-4" />
              <span>Attire</span>
            </FieldLabel>
            <Input
              id="attire"
              type="text"
              value={formData.attire}
              onChange={(e) => handleInputChange('attire', e.target.value)}
              placeholder="e.g., Cocktail attire"
              maxLength={50}
            />
          </div>

          {/* Timezone Info */}
          {event.time_zone && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Times will be saved in {event.time_zone} timezone
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex space-x-3 pt-4">
            <SecondaryButton 
              type="button" 
              onClick={onCancel}
              className="flex-1"
              disabled={loading}
            >
              Cancel
            </SecondaryButton>
            <PrimaryButton 
              type="submit" 
              className="flex-1"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center justify-center space-x-2">
                  <LoadingSpinner size="sm" />
                  <span>Saving...</span>
                </div>
              ) : (
                item ? 'Update Item' : 'Add Item'
              )}
            </PrimaryButton>
          </div>
        </form>
      </div>
    </div>
  );
}
