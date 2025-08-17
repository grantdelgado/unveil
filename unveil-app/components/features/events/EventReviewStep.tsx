'use client';

import Image from 'next/image';
import { formatEventDateTime } from '@/lib/utils/date';
import { MicroCopy } from '@/components/ui';
import type { EventFormData } from './CreateEventWizard';

interface EventReviewStepProps {
  formData: EventFormData;
  headerImage: File | null;
  imagePreview: string;
}

export function EventReviewStep({
  formData,
  headerImage,
  imagePreview
}: EventReviewStepProps) {


  return (
    <div className="space-y-6">
      <div className="text-center">
        <MicroCopy className="text-base">
          Review your wedding hub details before creating
        </MicroCopy>
      </div>

      {/* Event Preview Card */}
      <div className="bg-gradient-to-r from-pink-50 to-rose-50 rounded-lg overflow-hidden border border-pink-100">
        {/* Header Image Preview */}
        {imagePreview && (
          <div className="relative w-full h-32 sm:h-48">
            <Image
              src={imagePreview}
              alt="Event header preview"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
            <div className="absolute inset-0 bg-black bg-opacity-20" />
          </div>
        )}
        
        {/* Event Details */}
        <div className="p-6 space-y-4">
          <div className="text-center">
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {formData.title}
            </h3>
            <p className="text-lg text-gray-700">
              {formatEventDateTime(formData.event_date + 'T' + formData.event_time)}
            </p>
          </div>

          {formData.location && (
            <div className="text-center">
              <p className="text-gray-600 flex items-center justify-center gap-1">
                <span>📍</span>
                {formData.location}
              </p>
            </div>
          )}


        </div>
      </div>

      {/* Configuration Summary */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Configuration</h4>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Visibility:</span>
            <span className="font-medium text-gray-900">
              {formData.is_public ? 'Discoverable' : 'Private'}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Header Image:</span>
            <span className="font-medium text-gray-900">
              {headerImage ? 'Added' : 'None'}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Guest Management:</span>
            <span className="font-medium text-gray-900">
              Available after creation
            </span>
          </div>
        </div>
      </div>

      {/* What happens next */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <div className="text-blue-500 text-xl">🎉</div>
          <div>
            <h4 className="text-sm font-medium text-blue-900 mb-2">
              What happens after you create your hub?
            </h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• You&apos;ll be taken to your event dashboard</li>
              <li>• Start inviting guests and collecting RSVPs</li>
              <li>• Share photos and send updates</li>
              <li>• Track all wedding communication in one place</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Confirmation */}
      <div className="text-center">
        <MicroCopy>
          Ready to create your wedding hub? This will only take a moment!
        </MicroCopy>
      </div>
    </div>
  );
} 