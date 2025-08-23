'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import type {
  ImportValidationResult,
  GuestImportData,
} from '@/lib/guest-import';

interface ImportPreviewProps {
  validationResult: ImportValidationResult;
  onImport: (guests: GuestImportData[]) => void;
  onBack: () => void;
  isImporting?: boolean;
}

export const ImportPreview: React.FC<ImportPreviewProps> = ({
  validationResult,
  onImport,
  onBack,
  isImporting = false,
}) => {
  const [showInvalid, setShowInvalid] = useState(false);
  const { validGuests, invalidGuests, summary } = validationResult;

  const handleImport = () => {
    onImport(validGuests);
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-stone-800 mb-2">
          Import Preview
        </h3>
        <p className="text-stone-600 text-sm">
          Review your guest list before importing
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">
            {summary.total}
          </div>
          <div className="text-sm text-blue-800">Total Rows</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-600">
            {summary.valid}
          </div>
          <div className="text-sm text-green-800">Valid Guests</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-red-600">
            {summary.invalid}
          </div>
          <div className="text-sm text-red-800">Invalid Rows</div>
        </div>
        {/* Duplicate emails card removed for phone-only MVP */}
      </div>

      {/* Validation Messages */}
      {summary.invalid > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
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
                {summary.invalid} rows have validation errors and will be
                skipped
              </p>
            </div>
            <button
              onClick={() => setShowInvalid(!showInvalid)}
              className="text-amber-700 hover:text-amber-800 text-sm font-medium"
            >
              {showInvalid ? 'Hide' : 'Show'} Details
            </button>
          </div>
        </div>
      )}

      {/* Valid Guests Preview */}
      {validGuests.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-lg">
          <div className="px-4 py-3 border-b border-stone-200">
            <h4 className="font-medium text-stone-800">
              Valid Guests ({validGuests.length})
            </h4>
          </div>
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-stone-700">
                    Name
                  </th>
                  {/* Email column header removed for phone-only MVP */}
                  <th className="px-4 py-2 text-left font-medium text-stone-700">
                    Phone
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-stone-700">
                    Tags
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-stone-700">
                    RSVP
                  </th>
                </tr>
              </thead>
              <tbody>
                {validGuests.slice(0, 10).map((guest, index) => (
                  <tr key={index} className="border-t border-stone-100">
                    <td className="px-4 py-2 font-medium text-stone-800">
                      {guest.guest_name}
                    </td>
                    {/* Email table cell removed for phone-only MVP */}
                    <td className="px-4 py-2 text-stone-600">
                      {guest.phone || '-'}
                    </td>
                    <td className="px-4 py-2 text-stone-600">
                      {guest.guest_tags?.join(', ') || '-'}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={cn(
                          'px-2 py-1 rounded-full text-xs font-medium',
                          guest.rsvp_status === 'attending' &&
                            'bg-green-100 text-green-800',
                          guest.rsvp_status === 'declined' &&
                            'bg-red-100 text-red-800',
                          guest.rsvp_status === 'maybe' &&
                            'bg-amber-100 text-amber-800',
                          (!guest.rsvp_status ||
                            guest.rsvp_status === 'pending') &&
                            'bg-stone-100 text-stone-800',
                        )}
                      >
                        {guest.rsvp_status
                          ? guest.rsvp_status.charAt(0).toUpperCase() +
                            guest.rsvp_status.slice(1)
                          : 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {validGuests.length > 10 && (
              <div className="px-4 py-2 text-center text-stone-500 text-sm border-t border-stone-100">
                ... and {validGuests.length - 10} more guests
              </div>
            )}
          </div>
        </div>
      )}

      {/* Invalid Guests Details */}
      {showInvalid && invalidGuests.length > 0 && (
        <div className="bg-white border border-red-200 rounded-lg">
          <div className="px-4 py-3 border-b border-red-200 bg-red-50">
            <h4 className="font-medium text-red-800">
              Invalid Rows ({invalidGuests.length})
            </h4>
          </div>
          <div className="max-h-64 overflow-y-auto">
            <div className="space-y-3 p-4">
              {invalidGuests.slice(0, 5).map((invalid, index) => (
                <div
                  key={index}
                  className="border border-red-200 rounded-lg p-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-red-800">
                      Row {invalid.row}
                    </span>
                    <span className="text-xs text-red-600">
                      {invalid.errors.length} error
                      {invalid.errors.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="text-xs text-stone-600 mb-2">
                    Data:{' '}
                    {Object.entries(invalid.data)
                      .slice(0, 3)
                      .map(([k, v]) => `${k}: "${v}"`)
                      .join(', ')}
                    {Object.keys(invalid.data).length > 3 && '...'}
                  </div>
                  <div className="space-y-1">
                    {invalid.errors.map((error, errorIndex) => (
                      <div key={errorIndex} className="text-xs text-red-600">
                        • {error}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {invalidGuests.length > 5 && (
                <div className="text-center text-stone-500 text-sm">
                  ... and {invalidGuests.length - 5} more invalid rows
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-4">
        <Button variant="outline" onClick={onBack} disabled={isImporting}>
          Back to Mapping
        </Button>

        <div className="flex items-center space-x-3">
          {summary.valid > 0 ? (
            <Button
              onClick={handleImport}
              isLoading={isImporting}
              disabled={isImporting}
            >
              Import {summary.valid} Guest{summary.valid !== 1 ? 's' : ''}
            </Button>
          ) : (
            <div className="text-red-600 text-sm">
              No valid guests to import
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
