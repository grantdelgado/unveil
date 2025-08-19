'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { CardContainer } from '@/components/ui/CardContainer';
import { SectionTitle, FieldLabel, MicroCopy } from '@/components/ui/Typography';
import type { GuestImportData } from '@/lib/guest-import';
import { useGuests } from '@/hooks/useGuests';
import { 
  checkGuestExists, 
  clearGuestExistsCache, 
  validateGuestField, 
  type FieldValidation 
} from '@/lib/utils/guestHelpers';
import { normalizePhoneNumber } from '@/lib/utils/validation';
import { cn } from '@/lib/utils';
// Note: Guest functionality handled via domain hooks

interface GuestImportWizardProps {
  eventId: string;
  onClose: () => void;
  onImportComplete: () => void;
  startInManualMode?: boolean;
}

// Using GuestImportData from guest import service
type GuestEntry = GuestImportData;

// Enhanced guest entry with validation states
interface EnhancedGuestEntry extends GuestEntry {
  id: string;
  validationStates: {
    guest_name: FieldValidation;
    phone: FieldValidation;
    guest_email: FieldValidation;
  };
  touchedFields: {
    guest_name: boolean;
    phone: boolean;
    guest_email: boolean;
  };
  duplicateWarning?: string;
  isCollapsed: boolean;
}

const createEmptyGuest = (): EnhancedGuestEntry => ({
  id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
  guest_name: '',
  phone: '',
  guest_email: '',
  notes: '',
  validationStates: {
    guest_name: { isValid: true },
    phone: { isValid: true },
    guest_email: { isValid: true },
  },
  touchedFields: {
    guest_name: false,
    phone: false,
    guest_email: false,
  },
  isCollapsed: false,
});

export function GuestImportWizard({
  eventId,
  onClose,
  onImportComplete,
  startInManualMode = false,
}: GuestImportWizardProps) {
  const [step, setStep] = useState<'method' | 'manual' | 'csv' | 'processing'>(
    startInManualMode ? 'manual' : 'method',
  );
  const [guests, setGuests] = useState<EnhancedGuestEntry[]>(
    startInManualMode ? [createEmptyGuest()] : []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeGuestIndex, setActiveGuestIndex] = useState<number | null>(
    startInManualMode ? 0 : null
  );
  const { importGuests } = useGuests();
  const nameInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleAddManualGuest = () => {
    const newGuest = createEmptyGuest();
    setGuests([...guests, newGuest]);
    setActiveGuestIndex(guests.length);
    
    // Focus the name input for the new guest
    setTimeout(() => {
      nameInputRefs.current[guests.length]?.focus();
    }, 100);
  };

  const handleUpdateGuest = async (
    index: number,
    field: keyof GuestEntry,
    value: string,
  ) => {
    const updated = [...guests];
    updated[index] = { ...updated[index], [field]: value };
    
    // Mark field as touched
    if (field === 'guest_name') {
      updated[index].touchedFields.guest_name = true;
    } else if (field === 'phone') {
      updated[index].touchedFields.phone = true;
    } else if (field === 'guest_email') {
      updated[index].touchedFields.guest_email = true;
    }
    
    // Update validation state for the field (only for validated fields)
    const validatedFields: readonly string[] = ['guest_name', 'phone', 'guest_email'];
    const validation = validatedFields.includes(field) 
      ? validateGuestField(field as 'guest_name' | 'phone' | 'guest_email', value)
      : { isValid: true };
    
    // Update validation state based on field type
    if (field === 'guest_name') {
      updated[index].validationStates.guest_name = validation;
    } else if (field === 'phone') {
      updated[index].validationStates.phone = validation;
    } else if (field === 'guest_email') {
      updated[index].validationStates.guest_email = validation;
    }
    
    // Handle phone number validation and duplicate check
    if (field === 'phone') {
      // Store the raw input without auto-formatting to avoid feedback loops
      updated[index].phone = value;
      
      // Check for duplicates when phone is valid
      if (validation.isValid) {
        try {
          // Normalize for duplicate checking 
          const normalizedForCheck = normalizePhoneNumber(value);
          const exists = await checkGuestExists(eventId, normalizedForCheck);
          if (exists) {
            updated[index].duplicateWarning = '⚠ Guest already added to this event';
          } else {
            updated[index].duplicateWarning = undefined;
          }
        } catch {
          // Silently handle duplicate check errors
          updated[index].duplicateWarning = undefined;
        }
      } else {
        updated[index].duplicateWarning = undefined;
      }
    }
    
    // Note: Removed auto-collapse behavior - users should manually control when to proceed
    
    setGuests(updated);
  };

  const handleRemoveGuest = (index: number) => {
    const updated = guests.filter((_, i) => i !== index);
    setGuests(updated);
    
    // Adjust active guest index
    if (activeGuestIndex === index) {
      setActiveGuestIndex(null);
    } else if (activeGuestIndex !== null && activeGuestIndex > index) {
      setActiveGuestIndex(activeGuestIndex - 1);
    }
  };

  const handleToggleCollapse = (index: number) => {
    const updated = [...guests];
    updated[index].isCollapsed = !updated[index].isCollapsed;
    setGuests(updated);
    
    if (!updated[index].isCollapsed) {
      setActiveGuestIndex(index);
    }
  };

  const handleProcessGuests = useCallback(async () => {
    const validGuestsToImport = guests.filter(isGuestValid);
    if (validGuestsToImport.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      // Transform guest data to EventGuestInsert format
      const guestsToImport = validGuestsToImport.map(guest => ({
        event_id: eventId,
        phone: normalizePhoneNumber(guest.phone),
        guest_name: guest.guest_name || null,
        guest_email: guest.guest_email || null,
        notes: guest.notes || null,
        rsvp_status: 'pending',
        guest_tags: null,
        role: 'guest',
      }));

      // Import guests using the hook
      const result = await importGuests(eventId, guestsToImport);
      
      console.log(`Successfully imported ${result.length} guests`);

      // Clear duplicate check cache after successful import
      clearGuestExistsCache(eventId);

      // Complete the import first, then send SMS invitations asynchronously
      onImportComplete();

      // SMS invitations removed for "add now, invite later" flow
      if (false && result.length > 0) { // Disabled auto-SMS
        // Fire and forget - don't block the UI for SMS sending
        setTimeout(async () => {
          try {
            console.log(`📱 SMS Debug: Starting SMS invitation process...`);
            console.log(`📱 SMS Debug: Event ID: ${eventId}`);
            console.log(`📱 SMS Debug: Imported ${result.length} guests successfully`);
            
            const { sendGuestInvitationsAPI } = await import('@/lib/api/sms-invitations');
            
            const guestsForSMS = validGuestsToImport.map(guest => ({
              phone: normalizePhoneNumber(guest.phone),
              guestName: guest.guest_name || undefined
            }));

            console.log(`📱 SMS Debug: Prepared ${guestsForSMS.length} guests for SMS:`, {
              guests: guestsForSMS.map(g => ({
                phone: g.phone.slice(0, 6) + '...', // Redact for privacy
                hasName: !!g.guestName
              })),
              maxConcurrency: 1,
              skipRateLimit: false
            });

            const smsResult = await sendGuestInvitationsAPI(eventId, guestsForSMS, {
              maxConcurrency: 1, // Further reduce to avoid overwhelming
              skipRateLimit: false
            });

            console.log(`📱 SMS Debug: SMS API call completed:`, {
              success: smsResult.success,
              sent: smsResult.sent,
              failed: smsResult.failed,
              rateLimited: smsResult.rateLimited,
              hasError: !!smsResult.error
            });

            if (smsResult.success && smsResult.sent > 0) {
              console.log(`✅ Background SMS: Successfully sent invitations to ${smsResult.sent} guests`);
              if (smsResult.results) {
                console.log(`📱 SMS Debug: Individual results:`, smsResult.results.map(r => ({
                  phone: r.phone?.slice(0, 6) + '...',
                  success: r.success,
                  error: r.error,
                  rateLimited: r.rateLimited
                })));
              }
            } else {
              console.warn('⚠️ Background SMS: Some invitations failed', {
                sent: smsResult.sent,
                failed: smsResult.failed,
                error: smsResult.error
              });
            }
          } catch (smsError) {
            // Log but don't disrupt user experience
            console.warn('⚠️ Background SMS failed:', smsError instanceof Error ? smsError.message : 'Unknown error');
            console.log('ℹ️ Guests were imported successfully. SMS invitations can be sent manually from the dashboard.');
          }
        }, 100); // Small delay to ensure UI updates first
      }

    } catch (err) {
      console.error('Error processing guests:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to import guests. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [guests, eventId, onImportComplete, importGuests]);

  const isGuestValid = (guest: EnhancedGuestEntry): boolean => {
    return (
      guest.validationStates.guest_name.isValid &&
      guest.validationStates.phone.isValid &&
      guest.validationStates.guest_email.isValid
    );
  };

  const validGuests = guests.filter(isGuestValid);
  const incompleteGuests = guests.filter(guest => !isGuestValid(guest));

  // Initialize first guest when entering manual step
  useEffect(() => {
    if (step === 'manual' && guests.length === 0) {
      const newGuest = createEmptyGuest();
      setGuests([newGuest]);
      setActiveGuestIndex(0);
    }
  }, [step, guests.length]);

  if (loading) {
    return (
      <CardContainer>
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner />
          <span className="ml-3">Processing guests...</span>
        </div>
      </CardContainer>
    );
  }

  return (
    <CardContainer>
      <SectionTitle>Import Guests</SectionTitle>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="text-red-800">{error}</div>
        </div>
      )}

      {step === 'method' && (
        <div className="space-y-4">
          <MicroCopy>
            How would you like to add guests to your event?
          </MicroCopy>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => setStep('manual')}
              className="p-6 border-2 border-gray-200 rounded-xl hover:border-purple-300 hover:bg-purple-50 transition-colors text-left"
            >
              <div className="text-3xl mb-3">✍️</div>
              <div className="font-semibold text-gray-800">Add Manually</div>
              <div className="text-sm text-gray-600">
                Enter guest details one by one
              </div>
            </button>

            <button
              onClick={() => setStep('csv')}
              className="p-6 border-2 border-gray-200 rounded-xl hover:border-purple-300 hover:bg-purple-50 transition-colors text-left"
            >
              <div className="text-3xl mb-3">📄</div>
              <div className="font-semibold text-gray-800">Upload CSV</div>
              <div className="text-sm text-gray-600">
                Import from a spreadsheet
              </div>
            </button>
          </div>
        </div>
      )}

      {step === 'manual' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-800">Add Guests Manually</h3>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {guests.map((guest, index) => (
              <div key={guest.id}>
                {guest.isCollapsed ? (
                  // Collapsed Guest Summary
                  <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <span className="font-medium text-gray-900">
                          {guest.guest_name}
                        </span>
                        <span className="text-gray-600 ml-2">
                          {guest.phone}
                        </span>
                        {guest.guest_email && (
                          <span className="text-gray-500 text-sm ml-2">
                            • {guest.guest_email}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleToggleCollapse(index)}
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                          aria-label={`Edit ${guest.guest_name}`}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => handleRemoveGuest(index)}
                          className="text-red-600 hover:text-red-700 text-sm font-medium ml-2"
                          aria-label={`Remove ${guest.guest_name}`}
                        >
                          ❌ Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Expanded Guest Form
                  <div className="border border-gray-200 rounded-lg p-4 bg-white">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      {/* Name Field */}
                      <div>
                        <FieldLabel htmlFor={`guest-${index}-name`} required>
                          Full Name
                        </FieldLabel>
                        <input
                          ref={(el) => {
                            nameInputRefs.current[index] = el;
                          }}
                          id={`guest-${index}-name`}
                          type="text"
                          value={guest.guest_name || ''}
                          onChange={(e) =>
                            handleUpdateGuest(index, 'guest_name', e.target.value)
                          }
                          placeholder="John Doe"
                          className={cn(
                            'w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pink-300 focus:border-pink-300 transition-colors text-gray-900',
                            guest.touchedFields.guest_name && guest.validationStates.guest_name.isValid === false && guest.guest_name
                              ? 'border-red-300 bg-red-50'
                              : guest.touchedFields.guest_name && guest.validationStates.guest_name.isValid
                                ? 'border-green-300 bg-green-50'
                                : 'border-gray-300'
                          )}
                        />
                        {/* Field Error/Success Message */}
                        {guest.touchedFields.guest_name && guest.validationStates.guest_name.error && (
                          <p className="mt-1 text-sm text-red-600">
                            {guest.validationStates.guest_name.error}
                          </p>
                        )}
                        {guest.touchedFields.guest_name && guest.validationStates.guest_name.success && (
                          <p className="mt-1 text-sm text-green-600">
                            {guest.validationStates.guest_name.success}
                          </p>
                        )}
                      </div>

                      {/* Phone Field */}
                      <div>
                        <FieldLabel htmlFor={`guest-${index}-phone`} required>
                          Phone Number
                        </FieldLabel>
                        <input
                          id={`guest-${index}-phone`}
                          type="tel"
                          value={guest.phone}
                          onChange={(e) =>
                            handleUpdateGuest(index, 'phone', e.target.value)
                          }
                          placeholder="5551234567 or +1 (555) 123-4567"
                          className={cn(
                            'w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pink-300 focus:border-pink-300 transition-colors text-gray-900',
                            guest.touchedFields.phone && guest.validationStates.phone.isValid === false && guest.phone
                              ? 'border-red-300 bg-red-50'
                              : guest.touchedFields.phone && guest.validationStates.phone.isValid
                                ? 'border-green-300 bg-green-50'
                                : 'border-gray-300'
                          )}
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Enter 10 digits (5551234567) or full format (+1 555 123 4567)
                        </p>
                        {/* Field Error/Success Message */}
                        {guest.touchedFields.phone && guest.validationStates.phone.error && (
                          <p className="mt-1 text-sm text-red-600">
                            {guest.validationStates.phone.error}
                          </p>
                        )}
                        {guest.touchedFields.phone && guest.validationStates.phone.success && (
                          <p className="mt-1 text-sm text-green-600">
                            {guest.validationStates.phone.success}
                          </p>
                        )}
                        {/* Duplicate Warning */}
                        {guest.duplicateWarning && (
                          <p className="mt-1 text-sm text-orange-600">
                            {guest.duplicateWarning}
                          </p>
                        )}
                      </div>

                      {/* Email Field */}
                      <div>
                        <FieldLabel htmlFor={`guest-${index}-email`}>
                          Email (Optional)
                        </FieldLabel>
                        <input
                          id={`guest-${index}-email`}
                          type="email"
                          value={guest.guest_email || ''}
                          onChange={(e) =>
                            handleUpdateGuest(index, 'guest_email', e.target.value)
                          }
                          placeholder="john@example.com"
                          className={cn(
                            'w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pink-300 focus:border-pink-300 transition-colors text-gray-900',
                            guest.touchedFields.guest_email && guest.validationStates.guest_email.isValid === false && guest.guest_email
                              ? 'border-red-300 bg-red-50'
                              : guest.touchedFields.guest_email && guest.validationStates.guest_email.isValid && guest.guest_email
                                ? 'border-green-300 bg-green-50'
                                : 'border-gray-300'
                          )}
                        />
                        {/* Field Error/Success Message */}
                        {guest.touchedFields.guest_email && guest.validationStates.guest_email.error && (
                          <p className="mt-1 text-sm text-red-600">
                            {guest.validationStates.guest_email.error}
                          </p>
                        )}
                        {guest.touchedFields.guest_email && guest.validationStates.guest_email.success && (
                          <p className="mt-1 text-sm text-green-600">
                            {guest.validationStates.guest_email.success}
                          </p>
                        )}
                      </div>

                      {/* Notes Field */}
                      <div>
                        <FieldLabel htmlFor={`guest-${index}-notes`}>
                          Notes (Optional)
                        </FieldLabel>
                        <input
                          id={`guest-${index}-notes`}
                          type="text"
                          value={guest.notes || ''}
                          onChange={(e) =>
                            handleUpdateGuest(index, 'notes', e.target.value)
                          }
                          placeholder="Plus one, dietary restrictions, etc."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-300 focus:border-pink-300 transition-colors text-gray-900"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        onClick={() => handleRemoveGuest(index)}
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                      >
                        Remove Guest
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add Another Guest Button */}
          <div className="flex justify-center pt-4">
            <Button 
              onClick={handleAddManualGuest} 
              variant="outline"
              className="flex items-center gap-2"
            >
              <span>+</span>
              Add Another Guest
            </Button>
          </div>

          {/* Status and Action Bar */}
          <div className="flex justify-between items-center pt-6 border-t">
            <div className="text-sm text-gray-600">
              {validGuests.length === 0 && incompleteGuests.length > 0 && (
                <span className="text-orange-600">
                  {incompleteGuests.length} guest{incompleteGuests.length > 1 ? 's' : ''} incomplete – fill required fields
                </span>
              )}
              {validGuests.length > 0 && incompleteGuests.length === 0 && (
                <span className="text-green-600">
                  All guests ready to import
                </span>
              )}
              {validGuests.length > 0 && incompleteGuests.length > 0 && (
                <span>
                  <span className="text-green-600">{validGuests.length} ready</span>
                  <span className="text-gray-400"> • </span>
                  <span className="text-orange-600">{incompleteGuests.length} incomplete</span>
                </span>
              )}
            </div>
            <div className="flex space-x-3">
              <Button onClick={onClose} variant="outline">
                Cancel
              </Button>
              <Button
                onClick={handleProcessGuests}
                disabled={validGuests.length === 0}
                className={cn(
                  validGuests.length === 0 && 'opacity-50 cursor-not-allowed'
                )}
              >
                {validGuests.length === 1 ? 'Add Guest' : `Add ${validGuests.length} Guests`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {step === 'csv' && (
        <div className="space-y-6">
          <div>
            <h3 className="font-medium text-gray-800 mb-2">CSV Import</h3>
            <MicroCopy className="mb-4">
              This feature is coming soon. For now, please use the manual import
              option.
            </MicroCopy>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <MicroCopy>
                When available, your CSV should include these columns:
              </MicroCopy>
              <ul className="list-disc ml-5 space-y-1">
                <li>Full Name (required)</li>
                <li>Phone Number (required)</li>
                <li>Email (optional)</li>

                <li>Notes (optional)</li>
              </ul>
            </div>
          </div>

          <div className="flex justify-between">
            <Button onClick={() => setStep('method')} variant="outline">
              Back to Options
            </Button>
            <Button onClick={onClose} variant="outline">
              Cancel
            </Button>
          </div>
        </div>
      )}
    </CardContainer>
  );
}
