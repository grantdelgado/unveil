'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { ColumnMappingType, GuestImportData } from '@/lib/guest-import';

interface ColumnMappingProps {
  headers: string[];
  mapping: ColumnMappingType;
  onMappingChange: (mapping: ColumnMappingType) => void;
  sampleData?: Record<string, string>[];
}

const FIELD_OPTIONS: Array<{
  value: keyof GuestImportData | null;
  label: string;
  description: string;
  required?: boolean;
}> = [
  {
    value: null,
    label: 'Skip this column',
    description: 'Don&apos;t import this column',
  },
  {
    value: 'phone',
    label: 'Phone Number',
    description: 'Contact phone number (required)',
    required: true,
  },
  {
    value: 'guest_name',
    label: 'Guest Name',
    description:
      'Full name of the guest (optional - will use phone if not provided)',
  },
  {
    value: 'guest_email',
    label: 'Email Address',
    description: 'Guest&apos;s email for additional contact',
  },
  {
    value: 'notes',
    label: 'Notes',
    description: 'Special requests, dietary restrictions, etc.',
  },
  {
    value: 'guest_tags',
    label: 'Tags/Groups',
    description:
      'Categories like &quot;Family&quot;, &quot;Friends&quot; (comma-separated)',
  },
  {
    value: 'rsvp_status',
    label: 'RSVP Status',
    description: 'Current response status',
  },
];

export const ColumnMapping: React.FC<ColumnMappingProps> = ({
  headers,
  mapping,
  onMappingChange,
  sampleData = [],
}) => {
  const handleMappingChange = (
    header: string,
    field: keyof GuestImportData | null,
  ) => {
    const newMapping = { ...mapping };
    newMapping[header] = field;
    onMappingChange(newMapping);
  };

  const getSampleValue = (header: string): string => {
    if (sampleData.length > 0) {
      return sampleData[0][header] || '';
    }
    return '';
  };

  const getUsedFields = (): Set<keyof GuestImportData> => {
    const used = new Set<keyof GuestImportData>();
    Object.values(mapping).forEach((field) => {
      if (field) used.add(field);
    });
    return used;
  };

  const usedFields = getUsedFields();
  const hasRequiredPhone = Object.values(mapping).includes('phone');

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-stone-800 mb-2">
          Map Your Columns
        </h3>
        <p className="text-stone-600 text-sm">
          Tell us which columns in your file correspond to guest information.
          Phone numbers are required for invitations.
        </p>
      </div>

      {!hasRequiredPhone && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <svg
              className="w-5 h-5 text-amber-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            <p className="text-amber-800 text-sm font-medium">
              Please map at least one column to &quot;Phone Number&quot; to
              continue
            </p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {headers.map((header) => {
          const sampleValue = getSampleValue(header);
          const currentMapping = mapping[header];

          return (
            <div
              key={header}
              className="bg-white border border-stone-200 rounded-lg p-4"
            >
              <div className="flex items-start justify-between space-x-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-2">
                    <h4 className="font-medium text-stone-800 truncate">
                      {header}
                    </h4>
                    {sampleValue && (
                      <span className="text-xs bg-stone-100 text-stone-600 px-2 py-1 rounded">
                        e.g., &quot;{sampleValue}&quot;
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex-shrink-0 w-64">
                  <select
                    value={currentMapping || ''}
                    onChange={(e) =>
                      handleMappingChange(
                        header,
                        (e.target.value as keyof GuestImportData) || null,
                      )
                    }
                    className={cn(
                      'w-full px-3 py-2 border rounded-lg text-sm',
                      'focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-300',
                      currentMapping === 'phone'
                        ? 'border-green-300 bg-green-50'
                        : 'border-stone-300',
                    )}
                  >
                    {FIELD_OPTIONS.map((option) => {
                      const isUsed =
                        option.value &&
                        usedFields.has(option.value) &&
                        mapping[header] !== option.value;

                      return (
                        <option
                          key={option.value || 'skip'}
                          value={option.value || ''}
                          disabled={!!isUsed}
                        >
                          {option.label}
                          {option.required && ' *'}
                          {isUsed && ' (already used)'}
                        </option>
                      );
                    })}
                  </select>

                  {currentMapping && (
                    <p className="text-xs text-stone-500 mt-1">
                      {
                        FIELD_OPTIONS.find(
                          (opt) => opt.value === currentMapping,
                        )?.description
                      }
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-stone-50 rounded-lg p-4">
        <h4 className="font-medium text-stone-800 mb-2">Mapping Summary</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-stone-600">Columns to import:</span>
            <span className="ml-2 font-medium text-stone-800">
              {Object.values(mapping).filter(Boolean).length} of{' '}
              {headers.length}
            </span>
          </div>
          <div>
            <span className="text-stone-600">Required fields:</span>
            <span
              className={cn(
                'ml-2 font-medium',
                hasRequiredPhone ? 'text-green-600' : 'text-red-600',
              )}
            >
              {hasRequiredPhone ? 'Complete' : 'Missing phone field'}
            </span>
          </div>
        </div>
      </div>

      {hasRequiredPhone && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <svg
              className="w-5 h-5 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-green-800 text-sm">
              Great! Your guests will receive SMS invitations and can join via
              text message or the app.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
