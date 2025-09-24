'use client';

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { CardContainer } from '@/components/ui';
import { useErrorHandler } from '@/hooks/common';

import { useDropzone } from 'react-dropzone';
import { cn } from '@/lib/utils';
import { validatePhoneNumber } from '@/lib/validations';
import { useGuests } from '@/hooks/useGuests';
import { normalizePhoneNumber } from '@/lib/utils/phone';

// Format phone number for display (###) ###-####
const formatPhoneForDisplay = (phone: string): string => {
  if (!phone) return '';
  
  // Extract digits only
  const digits = phone.replace(/\D/g, '');
  
  // Format US numbers (10 or 11 digits)
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  
  // For international or other formats, return as-is
  return phone;
};

interface CSVImportModalProps {
  eventId: string;
  onClose: () => void;
  onImportComplete: () => void;
}

interface ParsedGuest {
  rowIndex: number;
  guest_name: string;
  phone: string;
  status: 'valid' | 'error';
  errors: string[];
}

interface ImportSummary {
  imported: number;
  updated: number;
  errors: number;
}

// Mobile-optimized CSV import modal with compact layout and improved UX - v2.0
export function CSVImportModal({ eventId, onClose, onImportComplete }: CSVImportModalProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'complete'>('upload');
  const [, setCsvFile] = useState<File | null>(null);
  const [parsedGuests, setParsedGuests] = useState<ParsedGuest[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportSummary | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const { handleError } = useErrorHandler();

  const { importGuests } = useGuests(eventId);

  // Validation summary
  const validGuests = parsedGuests.filter(g => g.status === 'valid');
  const errorGuests = parsedGuests.filter(g => g.status === 'error');

  // Parse CSV file
  const parseCSVFile = useCallback(async (file: File) => {
    try {
      const content = await file.text();
      
      // Handle BOM
      const cleanContent = content.replace(/^\uFEFF/, '');
      
      // Split lines and handle different line endings
      const lines = cleanContent.split(/\r?\n/).filter(line => line.trim());
      
      if (lines.length === 0) {
        throw new Error('No rows found in CSV file');
      }

      // Parse header
      const headerLine = lines[0];
      const headers = headerLine.split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
      
      // Check for required headers (name + phone only)
      const nameIndex = headers.findIndex(h => 
        ['name', 'full name', 'guest name', 'guest_name'].includes(h)
      );
      const phoneIndex = headers.findIndex(h => 
        ['phone', 'phone number', 'mobile', 'cell', 'telephone'].includes(h)
      );

      if (nameIndex === -1) {
        throw new Error('Required column "name" not found. Expected headers: name, phone');
      }
      if (phoneIndex === -1) {
        throw new Error('Required column "phone" not found. Expected headers: name, phone');
      }

      // Parse data rows
      const guests: ParsedGuest[] = [];
      const phonesSeen = new Set<string>();

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue; // Skip empty lines

        // Improved CSV parsing (handles quoted fields and spaces)
        const values = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
        const cleanValues = values.map(v => v.replace(/^"|"$/g, '').trim());

        // Only extract name and phone (ignore other columns)
        const guest_name = cleanValues[nameIndex] || '';
        const phone = cleanValues[phoneIndex] || '';
        
        // Debug CSV parsing for problematic entries
        if (phone.includes('947-4453') || guest_name.includes('Delgado')) {
          console.log('🔍 CSV parsing debug:', {
            line: line,
            values: values,
            cleanValues: cleanValues,
            nameIndex: nameIndex,
            phoneIndex: phoneIndex,
            extracted_name: guest_name,
            extracted_phone: phone,
            formatted_phone: formatPhoneForDisplay(phone)
          });
        }

        const errors: string[] = [];

        // Validate name
        if (!guest_name) {
          errors.push('Name is required');
        } else if (guest_name.length > 100) {
          errors.push('Name must be 100 characters or less');
        }

        // Validate phone with US default
        if (!phone) {
          errors.push('Phone number is required');
        } else {
          const phoneValidation = validatePhoneNumber(phone);
          // Debug logging for phone validation
          if (phone.includes('(310)') || phone.includes('947-4453')) {
            console.log('🔍 Phone validation debug:', {
              original: phone,
              digits: phone.replace(/\D/g, ''),
              isValid: phoneValidation.isValid,
              normalized: phoneValidation.normalized,
              error: phoneValidation.error
            });
          }
          if (!phoneValidation.isValid) {
            errors.push(phoneValidation.error || 'Invalid phone number format');
          } else {
            const normalizedPhone = phoneValidation.normalized!;
            if (phonesSeen.has(normalizedPhone)) {
              errors.push('Duplicate phone number in this file');
            } else {
              phonesSeen.add(normalizedPhone);
            }
          }
        }

        const status: 'valid' | 'error' = errors.length > 0 ? 'error' : 'valid';

        guests.push({
          rowIndex: i + 1,
          guest_name,
          phone,
          status,
          errors,
        });
      }

      setParsedGuests(guests);
      setStep('preview');
    } catch (error) {
      console.error('CSV parsing error:', error);
      handleError(error, { context: 'Parse CSV file' });
    }
  }, [handleError]);

  // File drop handler
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setCsvFile(file);
      parseCSVFile(file);
    }
  }, [parseCSVFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles, rejectedFiles) => {
      // Clear previous errors
      setUploadError(null);
      
      // Log modal interaction
      console.log('CSV Upload Event:', {
        event: 'csv_file_selected',
        accepted_count: acceptedFiles.length,
        rejected_count: rejectedFiles.length,
      });

      // Handle rejected files
      if (rejectedFiles.length > 0) {
        const rejection = rejectedFiles[0];
        if (rejection.errors.some(e => e.code === 'file-too-large')) {
          setUploadError('File is too large. Maximum size is 5 MB.');
        } else if (rejection.errors.some(e => e.code === 'file-invalid-type')) {
          setUploadError('Invalid file type. Please select a .csv file.');
        } else {
          setUploadError('Unable to process this file. Please try a different CSV file.');
        }
        return;
      }

      // Handle accepted files
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];
        
        // Log file selection (PII-safe)
        console.log('CSV Upload Event:', {
          event: 'csv_file_accepted',
          file_size_bytes: Math.min(file.size, 10 * 1024 * 1024), // Cap at 10MB for logging
          file_type: file.type || 'unknown',
        });
        
        onDrop(acceptedFiles);
      }
    },
    accept: {
      'text/csv': ['.csv'],
      'text/plain': ['.csv'],
    },
    maxSize: 5 * 1024 * 1024, // 5MB
    multiple: false,
  });

  // Import guests
  const handleImport = useCallback(async () => {
    const validGuestsToImport = validGuests;
    if (validGuestsToImport.length === 0) return;

    setStep('importing');
    setImportProgress(0);
    const startTime = Date.now();

    try {
      const guestsToImport = validGuestsToImport.map(guest => ({
        event_id: eventId,
        phone: normalizePhoneNumber(guest.phone).normalized || guest.phone,
        guest_name: guest.guest_name,
        notes: null,
        rsvp_status: 'pending' as const,
        guest_tags: null,
        role: 'guest' as const,
      }));

      // Simulate progress for UX
      const progressInterval = setInterval(() => {
        setImportProgress(prev => Math.min(prev + 10, 90));
      }, 100);

      const result = await importGuests(eventId, guestsToImport);
      
      clearInterval(progressInterval);
      setImportProgress(100);

      // For now, we'll count all successful results as "imported"
      // The RPC doesn't distinguish between insert/update/restore
      const imported = result.length;
      const updated = 0; // Will be enhanced when RPC provides operation details
      const errors = errorGuests.length;

      // PII-safe telemetry
      const duration = Date.now() - startTime;
      console.log('CSV Upload Event:', {
        event: 'csv_import_completed',
        rows_total: parsedGuests.length,
        rows_imported: imported,
        rows_updated: updated,
        rows_errors: errors,
        duration_ms: duration,
      });

      setImportResult({
        imported,
        updated,
        errors,
      });

      setStep('complete');
      
      // Complete after a brief delay to show 100% progress
      setTimeout(() => {
        onImportComplete();
      }, 1500);

    } catch (error) {
      console.error('Import error:', error);
      handleError(error, { context: 'Import guests' });
      setStep('preview');
    }
  }, [validGuests, errorGuests, parsedGuests.length, eventId, importGuests, onImportComplete, handleError]);



  // Log modal opening
  React.useEffect(() => {
    const instanceId = Math.random().toString(36).substr(2, 9);
    console.log(`🔄 CSV Modal v2.1 LOADED [${instanceId}] - FORCED STYLES - Mobile optimizations GUARANTEED!`);
    console.log('CSV Upload Event:', {
      event: 'csv_upload_modal_opened',
      timestamp: Date.now(),
      instanceId,
    });
  }, []);

  // Log preview opened
  React.useEffect(() => {
    if (step === 'preview' && parsedGuests.length > 0) {
      console.log('CSV Upload Event:', {
        event: 'csv_preview_opened',
        rows_total: parsedGuests.length,
        rows_ready: validGuests.length,
        rows_errors: errorGuests.length,
      });
    }
  }, [step, parsedGuests.length, validGuests.length, errorGuests.length]);

  return (
    <CardContainer className="max-w-4xl mx-auto relative">
      {/* Version indicator for debugging - visible on ALL steps */}
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        backgroundColor: '#10b981',
        color: 'white',
        padding: '4px 8px',
        borderRadius: '6px',
        fontSize: '12px',
        fontWeight: 'bold',
        zIndex: 1000,
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
      }}>
        v2.1 ACTIVE - {step.toUpperCase()}
      </div>
      <div className="space-y-6 px-4 sm:px-6">
        {/* Header - Reduced spacing by ~25% */}
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-1.5">
            Import Guests
          </h2>
          <p className="text-gray-600 mb-1.5">
            Upload a CSV with name and phone.
          </p>
          <p className="text-sm text-gray-500 mb-3">
            US numbers can omit +1 · Max 5 MB · .csv only
          </p>
          {/* Required column badges */}
          <div className="flex items-center justify-center gap-2 mb-3">
            <span 
              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
              title="Accepts: name, full name, guest name, guest_name"
            >
              name
            </span>
            <span 
              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
              title="Accepts: phone, phone number, mobile, cell, telephone"
            >
              phone
            </span>
          </div>
        </div>

        {/* Upload Step */}
        {step === 'upload' && (
          <div className="space-y-6">
            {/* Compact File Upload Area */}
            <div className="space-y-4">
              <div
                {...getRootProps()}
                className={cn(
                  'w-full p-6 border-2 border-dashed rounded-lg transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2',
                  isDragActive
                    ? 'border-pink-400 bg-pink-50'
                    : 'border-gray-300 hover:border-pink-300 hover:bg-gray-50'
                )}
                role="button"
                tabIndex={0}
                aria-label="Upload CSV file"
                aria-describedby="upload-description"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    (document.querySelector('input[type="file"]') as HTMLInputElement)?.click();
                  }
                  if (e.key === 'Escape') {
                    onClose();
                  }
                }}
              >
                <input 
                  {...getInputProps()} 
                  aria-label="Choose CSV file"
                />
                <div className="text-center space-y-3">
                  <div className="text-2xl">📄</div>
                  <div>
                    <p className="text-lg font-medium text-gray-700">
                      {isDragActive ? 'Drop your CSV file here' : 'Choose CSV'}
                    </p>
                    <p className="text-sm text-gray-500">
                      or drag & drop
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Error display */}
              {uploadError && (
                <div 
                  role="status" 
                  aria-live="polite"
                  className="bg-red-50 border border-red-200 rounded-lg p-3 text-center"
                >
                  <p className="text-sm text-red-600">{uploadError}</p>
                </div>
              )}
              
              {/* Helper text */}
              <p id="upload-description" className="text-sm text-gray-500 text-center">
                Other columns will be ignored.
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 sm:justify-end pt-4 pb-safe">
              <Button 
                onClick={() => (document.querySelector('input[type="file"]') as HTMLInputElement)?.click()}
                className="min-h-[44px] order-2 sm:order-1"
              >
                Choose CSV
              </Button>
              <Button 
                onClick={onClose} 
                variant="outline"
                className="min-h-[44px] order-1 sm:order-2"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Preview Step */}
        {step === 'preview' && (
          <div className="space-y-4">
            {/* Compact Summary Banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center space-x-3">
                <div className="text-lg">📊</div>
                <div>
                  <p className="text-sm font-medium text-blue-900">
                    {validGuests.length}/{parsedGuests.length} ready
                    {errorGuests.length > 0 && ` • ${errorGuests.length} errors`}
                  </p>
                  <p className="text-xs text-blue-700">
                    Review the guests below before importing
                  </p>
                </div>
              </div>
            </div>

            {/* Duplicate explanation helper */}
            <p className="text-xs text-gray-500 text-center">
              Duplicates in this file are shown as errors. Existing guests are counted as Updated after import.
            </p>

            {/* Guest Preview Table - Mobile optimized v2.1 FORCED STYLES */}
            <div 
              className="border border-gray-200 rounded-lg overflow-hidden" 
              style={{backgroundColor: '#fff'}}
              data-testid="csv-preview-table-v2"
            >
              <div className="overflow-y-auto" style={{maxHeight: '20rem'}}>
                <table 
                  className="w-full" 
                  style={{
                    tableLayout: 'auto',
                    borderCollapse: 'collapse'
                  }}
                >
                  <thead 
                    className="bg-gray-50 sticky" 
                    style={{
                      position: 'sticky',
                      top: '0',
                      zIndex: 20,
                      backgroundColor: '#f9fafb'
                    }}
                  >
                    <tr>
                      <th 
                        style={{
                          padding: '0.75rem 0.5rem',
                          width: '3rem',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          textAlign: 'left',
                          color: '#6b7280',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em'
                        }}
                      >
                        Status
                      </th>
                      <th 
                        style={{
                          padding: '0.75rem 0.5rem',
                          minWidth: '12rem',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          textAlign: 'left',
                          color: '#6b7280',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em'
                        }}
                      >
                        Name
                      </th>
                      <th 
                        style={{
                          padding: '0.75rem 0.5rem',
                          width: '10rem',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          textAlign: 'right',
                          color: '#6b7280',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em'
                        }}
                      >
                        Phone
                      </th>
                      <th 
                        style={{
                          padding: '0.75rem 0.5rem',
                          minWidth: '10rem',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          textAlign: 'left',
                          color: '#6b7280',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em'
                        }}
                      >
                        Issues
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {parsedGuests.map((guest, index) => (
                      <tr 
                        key={index} 
                        className={cn(guest.status === 'error' ? 'bg-red-50' : 'bg-white')}
                        style={{
                          backgroundColor: guest.status === 'error' ? '#fef2f2' : '#ffffff'
                        }}
                      >
                        <td style={{
                          padding: '0.75rem 0.5rem',
                          verticalAlign: 'top',
                          width: '3rem'
                        }}>
                          {guest.status === 'valid' && (
                            <span 
                              className="inline-flex items-center rounded-full font-medium"
                              style={{
                                padding: '0.125rem 0.5rem',
                                fontSize: '0.75rem',
                                backgroundColor: '#dcfce7',
                                color: '#166534'
                              }}
                            >
                              ✓
                            </span>
                          )}
                          {guest.status === 'error' && (
                            <span 
                              className="inline-flex items-center rounded-full font-medium"
                              style={{
                                padding: '0.125rem 0.5rem',
                                fontSize: '0.75rem',
                                backgroundColor: '#fee2e2',
                                color: '#dc2626'
                              }}
                            >
                              ✗
                            </span>
                          )}
                        </td>
                        <td 
                          className="text-sm text-gray-900"
                          style={{
                            padding: '0.75rem 0.5rem',
                            fontSize: '0.875rem',
                            color: '#111827',
                            verticalAlign: 'top',
                            minWidth: '12rem',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {guest.guest_name || <span style={{color: '#9ca3af', fontStyle: 'italic'}}>Missing</span>}
                        </td>
                        <td 
                          className="text-sm text-gray-900"
                          style={{
                            padding: '0.75rem 0.5rem',
                            textAlign: 'right',
                            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
                            fontSize: '0.875rem',
                            color: '#111827',
                            verticalAlign: 'top',
                            width: '10rem',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden'
                          }}
                        >
                          {guest.phone ? formatPhoneForDisplay(guest.phone) : <span style={{color: '#9ca3af', fontStyle: 'italic'}}>Missing</span>}
                        </td>
                        <td 
                          className="text-xs"
                          style={{
                            padding: '0.75rem 0.5rem',
                            fontSize: '0.75rem',
                            verticalAlign: 'top',
                            minWidth: '10rem'
                          }}
                        >
                          {guest.errors.length > 0 && (
                            <div 
                              className="text-red-600" 
                              style={{
                                lineHeight: '1.2',
                                color: '#dc2626'
                              }}
                            >
                              {guest.errors.map((error, i) => (
                                <div 
                                  key={i} 
                                  style={{
                                    marginBottom: '0.125rem'
                                  }}
                                >
                                  • {error}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Compact footer with safe area */}
            <div className="flex flex-col sm:flex-row gap-2 sm:justify-between pt-3 pb-4">
              <Button onClick={() => setStep('upload')} variant="outline" size="sm">
                Back to Upload
              </Button>
              <div className="flex gap-2">
                <Button onClick={onClose} variant="outline" size="sm">
                  Cancel
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={validGuests.length === 0}
                  size="sm"
                  className={cn(
                    validGuests.length === 0 && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  Import {validGuests.length} Guest{validGuests.length !== 1 ? 's' : ''}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Importing Step */}
        {step === 'importing' && (
          <div className="space-y-6 text-center">
            <div className="text-6xl">⏳</div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Importing Guests...
              </h3>
              <p className="text-gray-600 mb-4">
                Please wait while we add your guests to the event
              </p>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-pink-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${importProgress}%` }}
                />
              </div>
              <p className="text-sm text-gray-500 mt-2">{importProgress}% complete</p>
            </div>
          </div>
        )}

        {/* Complete Step */}
        {step === 'complete' && importResult && (
          <div className="space-y-6 text-center">
            <div className="text-6xl">🎉</div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Import Complete!
              </h3>
              <p className="text-gray-600 mb-4">
                Imported {importResult.imported} • Updated {importResult.updated} • Errors {importResult.errors}
              </p>
            </div>
          </div>
        )}
      </div>
    </CardContainer>
  );
}
