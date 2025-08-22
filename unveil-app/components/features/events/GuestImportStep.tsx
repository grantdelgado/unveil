'use client';

import { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  SecondaryButton,
  PrimaryButton,
  TextInput,
  MicroCopy,
} from '@/components/ui';
import { EventCreationService } from '@/lib/services/eventCreation';
import type {
  GuestImportInput,
  GuestImportResult,
  CSVParseResult,
} from '@/lib/services/eventCreation';
import { cn } from '@/lib/utils';

interface GuestImportStepProps {
  importMethod: 'skip' | 'csv' | 'manual';
  guestCount: number;
  onMethodChange: (method: 'skip' | 'csv' | 'manual') => void;
  onGuestCountChange: (count: number) => void;
  disabled: boolean;
  eventId?: string; // Optional for wizard mode, required for import execution
}

export function GuestImportStep({
  importMethod,
  onMethodChange,
  onGuestCountChange,
  disabled,
  eventId,
}: GuestImportStepProps) {
  // State for import functionality
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<GuestImportInput[]>([]);
  const [csvErrors, setCsvErrors] = useState<
    { row: number; message: string }[]
  >([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<GuestImportResult | null>(
    null,
  );
  const [manualGuests, setManualGuests] = useState<GuestImportInput[]>([
    { guest_name: '', phone: '', guest_email: '', role: 'guest', notes: '' },
  ]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const options = [
    {
      id: 'skip',
      title: 'Skip for now',
      description: 'Add guests later from your event dashboard',
      icon: '⏭️',
      recommended: true,
    },
    {
      id: 'csv',
      title: 'Upload CSV file',
      description: 'Import guests from a spreadsheet',
      icon: '📄',
    },
    {
      id: 'manual',
      title: 'Add manually',
      description: 'Enter guest information one by one',
      icon: '✍️',
    },
  ];

  // CSV file handling
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setCsvFile(file);
      parseCSVFile(file);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv'],
      'text/plain': ['.csv'],
    },
    maxSize: 5 * 1024 * 1024, // 5MB
    multiple: false,
    disabled: disabled || isImporting,
  });

  const parseCSVFile = useCallback(
    async (file: File) => {
      try {
        const content = await file.text();
        const parseResult: CSVParseResult =
          EventCreationService.parseCSV(content);

        if (parseResult.success && parseResult.data) {
          setCsvData(parseResult.data);
          setCsvErrors([]);
          onGuestCountChange(parseResult.data.length);
        } else {
          setCsvData([]);
          setCsvErrors(parseResult.errors || []);
          onGuestCountChange(0);
        }
      } catch (error) {
        setCsvErrors([
          {
            row: 0,
            message: `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ]);
        setCsvData([]);
        onGuestCountChange(0);
      }
    },
    [onGuestCountChange],
  );

  // Manual guest handling
  const addManualGuest = useCallback(() => {
    setManualGuests((prev) => [
      ...prev,
      { guest_name: '', phone: '', guest_email: '', role: 'guest', notes: '' },
    ]);
  }, []);

  const updateManualGuest = useCallback(
    (index: number, field: keyof GuestImportInput, value: string) => {
      setManualGuests((prev) =>
        prev.map((guest, i) =>
          i === index ? { ...guest, [field]: value } : guest,
        ),
      );

      // Update guest count
      const validGuests = manualGuests.filter(
        (g) => g.guest_name.trim() && g.phone.trim(),
      );
      onGuestCountChange(validGuests.length);
    },
    [manualGuests, onGuestCountChange],
  );

  const removeManualGuest = useCallback(
    (index: number) => {
      setManualGuests((prev) => {
        const newGuests = prev.filter((_, i) => i !== index);
        const validGuests = newGuests.filter(
          (g) => g.guest_name.trim() && g.phone.trim(),
        );
        onGuestCountChange(validGuests.length);
        return newGuests;
      });
    },
    [onGuestCountChange],
  );

  // Import execution
  const executeImport = useCallback(async () => {
    if (!eventId) {
      console.warn('No event ID provided for import');
      return;
    }

    setIsImporting(true);
    setImportResult(null);

    try {
      const guestsToImport =
        importMethod === 'csv'
          ? csvData
          : manualGuests.filter((g) => g.guest_name.trim() && g.phone.trim());

      const result = await EventCreationService.importGuests(
        eventId,
        guestsToImport,
        'current-user-id', // This should be passed from parent or context
      );

      setImportResult(result);

      if (result.success) {
        onGuestCountChange(result.data?.imported_count || 0);
      }
    } catch (error) {
      setImportResult({
        success: false,
        error: {
          code: 'IMPORT_ERROR',
          message: error instanceof Error ? error.message : 'Import failed',
        },
      });
    } finally {
      setIsImporting(false);
    }
  }, [eventId, importMethod, csvData, manualGuests, onGuestCountChange]);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <MicroCopy className="text-base">
          How would you like to add your guest list? (This step is optional)
        </MicroCopy>
      </div>

      {/* Method Selection */}
      <div className="space-y-3">
        {options.map((option) => (
          <div
            key={option.id}
            className={cn(
              'relative border rounded-lg p-4 cursor-pointer transition-all duration-200',
              importMethod === option.id
                ? 'border-pink-500 bg-pink-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50',
              disabled && 'opacity-50 cursor-not-allowed',
            )}
            onClick={() => {
              if (!disabled) {
                onMethodChange(option.id as 'skip' | 'csv' | 'manual');
                // Reset state when changing methods
                setCsvFile(null);
                setCsvData([]);
                setCsvErrors([]);
                setImportResult(null);
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
                  disabled={disabled}
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
                After creating your wedding hub, you&apos;ll have a dedicated
                dashboard where you can:
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

      {/* CSV Import Implementation */}
      {importMethod === 'csv' && (
        <div className="space-y-4">
          {/* CSV Format Instructions */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-900 mb-2">
              CSV Format Requirements
            </h4>
            <p className="text-sm text-gray-600 mb-2">
              Your CSV file should have the following columns (name and phone
              are required):
            </p>
            <div className="bg-white rounded border p-2 text-xs font-mono">
              name,phone,email,role,notes,tags
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Example: &quot;John Doe,+1234567890,john@example.com,guest,Best
              man,groomsmen;vip&quot;
            </p>
          </div>

          {/* File Upload Area */}
          {!csvFile ? (
            <div
              {...getRootProps()}
              className={cn(
                'w-full p-6 border-2 border-dashed rounded-lg transition-colors cursor-pointer',
                isDragActive
                  ? 'border-pink-400 bg-pink-50'
                  : 'border-gray-300 hover:border-pink-300 hover:bg-gray-50',
                disabled && 'cursor-not-allowed opacity-50',
              )}
            >
              <input {...getInputProps()} ref={fileInputRef} />
              <div className="text-center space-y-2">
                <div className="text-3xl">📄</div>
                <div>
                  <p className="text-base font-medium text-gray-700">
                    {isDragActive
                      ? 'Drop your CSV file here'
                      : 'Upload CSV file'}
                  </p>
                  <p className="text-sm text-gray-500">
                    Drag & drop or click to browse • CSV files up to 5MB
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* File Info */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-green-600 text-xl">📄</span>
                    <div>
                      <p className="text-sm font-medium text-green-900">
                        {csvFile.name}
                      </p>
                      <p className="text-xs text-green-600">
                        {(csvFile.size / 1024).toFixed(1)} KB • {csvData.length}{' '}
                        guests parsed
                      </p>
                    </div>
                  </div>
                  <SecondaryButton
                    onClick={() => {
                      setCsvFile(null);
                      setCsvData([]);
                      setCsvErrors([]);
                      onGuestCountChange(0);
                    }}
                    disabled={disabled || isImporting}
                    className="text-xs"
                  >
                    Remove
                  </SecondaryButton>
                </div>
              </div>

              {/* CSV Errors */}
              {csvErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-red-900 mb-2">
                    Errors found in CSV file:
                  </h4>
                  <ul className="text-sm text-red-700 space-y-1">
                    {csvErrors.map((error, index) => (
                      <li key={index}>
                        Row {error.row}: {error.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* CSV Preview */}
              {csvData.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">
                    Preview ({csvData.length} guests)
                  </h4>
                  <div className="max-h-32 overflow-y-auto">
                    <div className="space-y-1 text-xs">
                      {csvData.slice(0, 5).map((guest, index) => (
                        <div
                          key={index}
                          className="flex items-center space-x-2 text-gray-600"
                        >
                          <span className="w-4 text-gray-400">
                            {index + 1}.
                          </span>
                          <span className="font-medium">
                            {guest.guest_name}
                          </span>
                          <span>•</span>
                          <span>{guest.phone}</span>
                          {guest.guest_email && (
                            <>
                              <span>•</span>
                              <span>{guest.guest_email}</span>
                            </>
                          )}
                        </div>
                      ))}
                      {csvData.length > 5 && (
                        <p className="text-gray-400 italic">
                          ... and {csvData.length - 5} more
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Import Action */}
              {csvData.length > 0 && eventId && (
                <div className="flex justify-center">
                  <PrimaryButton
                    onClick={executeImport}
                    loading={isImporting}
                    disabled={disabled || isImporting}
                    className="min-h-[44px] px-8"
                  >
                    {isImporting
                      ? 'Importing...'
                      : `Import ${csvData.length} Guests`}
                  </PrimaryButton>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Manual Entry Implementation */}
      {importMethod === 'manual' && (
        <div className="space-y-4">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-900 mb-1">
              Add guests manually
            </h4>
            <p className="text-sm text-gray-600">
              Enter guest information one by one. You can add more guests after
              creating your event.
            </p>
          </div>

          {/* Manual Guest Forms */}
          <div className="space-y-3">
            {manualGuests.map((guest, index) => (
              <div
                key={index}
                className="bg-white border border-gray-200 rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <h5 className="text-sm font-medium text-gray-900">
                    Guest {index + 1}
                  </h5>
                  {manualGuests.length > 1 && (
                    <SecondaryButton
                      onClick={() => removeManualGuest(index)}
                      disabled={disabled}
                      className="text-xs text-red-600 hover:text-red-700"
                    >
                      Remove
                    </SecondaryButton>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <TextInput
                    placeholder="Guest name *"
                    value={guest.guest_name}
                    onChange={(e) =>
                      updateManualGuest(index, 'guest_name', e.target.value)
                    }
                    disabled={disabled}
                    className="text-sm"
                  />
                  <TextInput
                    placeholder="5551234567 or +1 (555) 123-4567"
                    value={guest.phone}
                    onChange={(e) =>
                      updateManualGuest(index, 'phone', e.target.value)
                    }
                    disabled={disabled}
                    className="text-sm"
                  />
                  <TextInput
                    placeholder="Email (optional)"
                    value={guest.guest_email || ''}
                    onChange={(e) =>
                      updateManualGuest(index, 'guest_email', e.target.value)
                    }
                    disabled={disabled}
                    className="text-sm"
                  />
                  <select
                    value={guest.role}
                    onChange={(e) =>
                      updateManualGuest(index, 'role', e.target.value)
                    }
                    disabled={disabled}
                    className="text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-pink-400 text-gray-900"
                  >
                    <option value="guest">Guest</option>
                    <option value="host">Co-host</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div className="mt-3">
                  <TextInput
                    placeholder="Notes (optional)"
                    value={guest.notes || ''}
                    onChange={(e) =>
                      updateManualGuest(index, 'notes', e.target.value)
                    }
                    disabled={disabled}
                    className="text-sm"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Add More Button */}
          <div className="flex justify-center">
            <SecondaryButton
              onClick={addManualGuest}
              disabled={disabled || manualGuests.length >= 10}
              className="min-h-[44px]"
            >
              + Add Another Guest
            </SecondaryButton>
          </div>

          {/* Manual Import Action */}
          {manualGuests.some((g) => g.guest_name.trim() && g.phone.trim()) &&
            eventId && (
              <div className="flex justify-center">
                <PrimaryButton
                  onClick={executeImport}
                  loading={isImporting}
                  disabled={disabled || isImporting}
                  className="min-h-[44px] px-8"
                >
                  {isImporting ? 'Adding...' : 'Add Guests'}
                </PrimaryButton>
              </div>
            )}
        </div>
      )}

      {/* Import Result Display */}
      {importResult && (
        <div
          className={cn(
            'rounded-lg p-4 border',
            importResult.success
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200',
          )}
        >
          <div className="flex items-start space-x-3">
            <div
              className={cn(
                'text-xl',
                importResult.success ? 'text-green-600' : 'text-red-600',
              )}
            >
              {importResult.success ? '✅' : '❌'}
            </div>
            <div className="flex-1">
              <h4
                className={cn(
                  'text-sm font-medium mb-1',
                  importResult.success ? 'text-green-900' : 'text-red-900',
                )}
              >
                {importResult.success ? 'Import Successful!' : 'Import Failed'}
              </h4>
              {importResult.success && importResult.data ? (
                <div className="text-sm text-green-700">
                  <p>
                    Successfully imported {importResult.data.imported_count}{' '}
                    guests
                  </p>
                  {importResult.data.failed_count > 0 && (
                    <p className="text-orange-700 mt-1">
                      {importResult.data.failed_count} guests failed to import
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-red-700">
                  {importResult.error?.message || 'Unknown error occurred'}
                </p>
              )}
            </div>
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
