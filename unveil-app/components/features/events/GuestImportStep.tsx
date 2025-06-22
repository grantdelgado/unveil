'use client';

import { SecondaryButton, MicroCopy } from '@/components/ui';
import { cn } from '@/lib/utils';

interface GuestImportStepProps {
  importMethod: 'skip' | 'csv' | 'manual';
  guestCount: number;
  onMethodChange: (method: 'skip' | 'csv' | 'manual') => void;
  onGuestCountChange: (count: number) => void;
  disabled: boolean;
}

export function GuestImportStep({
  importMethod,
  onMethodChange,
  disabled
}: GuestImportStepProps) {
  const options = [
    {
      id: 'skip',
      title: 'Skip for now',
      description: 'Add guests later from your event dashboard',
      icon: '⏭️',
      recommended: true
    },
    {
      id: 'csv',
      title: 'Upload CSV file',
      description: 'Import guests from a spreadsheet',
      icon: '📄',
      comingSoon: true
    },
    {
      id: 'manual',
      title: 'Add manually',
      description: 'Enter guest information one by one',
      icon: '✍️',
      comingSoon: true
    }
  ];

  return (
    <div className="space-y-6">
      <div className="text-center">
        <MicroCopy className="text-base">
          How would you like to add your guest list? (This step is optional)
        </MicroCopy>
      </div>

      <div className="space-y-3">
        {options.map((option) => (
          <div
            key={option.id}
            className={cn(
              'relative border rounded-lg p-4 cursor-pointer transition-all duration-200',
              importMethod === option.id
                ? 'border-pink-500 bg-pink-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50',
              option.comingSoon && 'opacity-60',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
            onClick={() => {
              if (!disabled && !option.comingSoon) {
                onMethodChange(option.id as 'skip' | 'csv' | 'manual');
              }
            }}
          >
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className="text-2xl">{option.icon}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-medium text-gray-900">
                    {option.title}
                  </h3>
                  {option.recommended && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Recommended
                    </span>
                  )}
                  {option.comingSoon && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                      Coming Soon
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {option.description}
                </p>
              </div>
              <div className="flex-shrink-0">
                <input
                  type="radio"
                  name="importMethod"
                  checked={importMethod === option.id}
                  onChange={() => {}}
                  className="h-4 w-4 text-pink-600 focus:ring-pink-500 border-gray-300"
                  disabled={disabled || option.comingSoon}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Skip method details */}
      {importMethod === 'skip' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <div className="text-blue-500 text-xl">💡</div>
            <div>
              <h4 className="text-sm font-medium text-blue-900 mb-1">
                Pro Tip: Easy guest management
              </h4>
              <p className="text-sm text-blue-700">
                After creating your wedding hub, you&apos;ll have a dedicated dashboard where you can:
              </p>
              <ul className="mt-2 text-sm text-blue-700 space-y-1">
                <li>• Import guests from CSV files</li>
                <li>• Send personalized invitations via SMS</li>
                <li>• Track RSVPs in real-time</li>
                <li>• Manage plus-ones and dietary restrictions</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* CSV method (placeholder for future) */}
      {importMethod === 'csv' && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="text-center space-y-3">
            <div className="text-4xl">🚧</div>
            <h4 className="text-sm font-medium text-gray-900">
              CSV Import Coming Soon
            </h4>
            <p className="text-sm text-gray-600">
              We&apos;re working on this feature! For now, you can skip this step and add guests manually from your dashboard.
            </p>
            <SecondaryButton
              onClick={() => onMethodChange('skip')}
              disabled={disabled}
              className="min-h-[44px]"
            >
              Skip for now
            </SecondaryButton>
          </div>
        </div>
      )}

      {/* Manual method (placeholder for future) */}
      {importMethod === 'manual' && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="text-center space-y-3">
            <div className="text-4xl">🚧</div>
            <h4 className="text-sm font-medium text-gray-900">
              Manual Entry Coming Soon
            </h4>
            <p className="text-sm text-gray-600">
              We&apos;re working on this feature! For now, you can skip this step and add guests manually from your dashboard.
            </p>
            <SecondaryButton
              onClick={() => onMethodChange('skip')}
              disabled={disabled}
              className="min-h-[44px]"
            >
              Skip for now
            </SecondaryButton>
          </div>
        </div>
      )}

      {/* Summary for skip */}
      {importMethod === 'skip' && (
        <div className="text-center">
          <MicroCopy>
            Perfect! You can focus on the essentials now and add guests later.
          </MicroCopy>
        </div>
      )}
    </div>
  );
} 