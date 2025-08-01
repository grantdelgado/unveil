'use client';

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { CardContainer } from '@/components/ui/CardContainer';
import { SectionTitle, FieldLabel, MicroCopy } from '@/components/ui/Typography';
import type { GuestImportData } from '@/lib/guest-import';
import { useGuests } from '@/hooks/useGuests';
// Note: Guest functionality handled via domain hooks

interface GuestImportWizardProps {
  eventId: string;
  onClose: () => void;
  onImportComplete: () => void;
}

// Using GuestImportData from guest import service
type GuestEntry = GuestImportData;

export function GuestImportWizard({
  eventId,
  onClose,
  onImportComplete,
}: GuestImportWizardProps) {
  const [step, setStep] = useState<'method' | 'manual' | 'csv' | 'processing'>(
    'method',
  );
  const [guests, setGuests] = useState<GuestEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { importGuests } = useGuests();

  const handleAddManualGuest = () => {
    setGuests([...guests, { guest_name: '', phone: '' }]);
  };

  const handleUpdateGuest = (
    index: number,
    field: keyof GuestEntry,
    value: string,
  ) => {
    const updated = [...guests];
    updated[index] = { ...updated[index], [field]: value };
    setGuests(updated);
  };

  const handleRemoveGuest = (index: number) => {
    setGuests(guests.filter((_, i) => i !== index));
  };

  const handleProcessGuests = useCallback(async () => {
    if (guests.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      // Transform guest data to EventGuestInsert format
      const guestsToImport = guests.map(guest => ({
        event_id: eventId,
        phone: guest.phone,
        guest_name: guest.guest_name || null,
        guest_email: guest.guest_email || null,
        notes: guest.notes || null,
        rsvp_status: guest.rsvp_status || 'pending',
        guest_tags: guest.guest_tags || null,
        role: 'guest',
      }));

      // Import guests using the hook
      const result = await importGuests(eventId, guestsToImport);
      
      console.log(`Successfully imported ${result.length} guests`);

      onImportComplete();
    } catch (err) {
      console.error('Error processing guests:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to import guests. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [guests, eventId, onImportComplete, importGuests]);

  const validateGuest = (guest: GuestEntry): boolean => {
    return guest.phone.trim().length > 0 && (guest.guest_name || '').trim().length > 0;
  };

  const validGuests = guests.filter(validateGuest);

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
              onClick={() => {
                setStep('manual');
                handleAddManualGuest();
              }}
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
            <Button onClick={handleAddManualGuest} size="sm">
              Add Another
            </Button>
          </div>

          <div className="space-y-4 max-h-96 overflow-y-auto">
            {guests.map((guest, index) => (
              <div
                key={index}
                className="border border-gray-200 rounded-lg p-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <FieldLabel htmlFor={`guest-${index}-name`} required>
                      Full Name
                    </FieldLabel>
                    <input
                      id={`guest-${index}-name`}
                      type="text"
                      value={guest.guest_name || ''}
                      onChange={(e) =>
                        handleUpdateGuest(index, 'guest_name', e.target.value)
                      }
                      placeholder="John Doe"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>

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
                      placeholder="+1 (555) 123-4567"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>

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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>


                </div>

                <div className="mb-4">
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={() => handleRemoveGuest(index)}
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center pt-6 border-t">
            <MicroCopy>
              {validGuests.length} of {guests.length} guests are valid
            </MicroCopy>
            <div className="flex space-x-3">
              <Button onClick={onClose} variant="outline">
                Cancel
              </Button>
              <Button
                onClick={handleProcessGuests}
                disabled={validGuests.length === 0}
              >
                Import {validGuests.length} Guest
                {validGuests.length !== 1 ? 's' : ''}
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
