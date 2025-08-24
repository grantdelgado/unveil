/**
 * Tests for audience prefill behavior in modify scheduled message flow
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessageComposer } from '@/components/features/messaging/host/MessageComposer';
import type { Database } from '@/app/reference/supabase.types';

type ScheduledMessage = Database['public']['Tables']['scheduled_messages']['Row'];

// Mock dependencies
jest.mock('@/hooks/messaging/useGuestSelection', () => ({
  useGuestSelection: jest.fn(() => ({
    allGuests: [
      { id: 'guest-1', displayName: 'Alice Smith', hasValidPhone: true, isOptedOut: false },
      { id: 'guest-2', displayName: 'Bob Jones', hasValidPhone: true, isOptedOut: false },
      { id: 'guest-3', displayName: 'Carol Davis', hasValidPhone: true, isOptedOut: false },
    ],
    eligibleGuests: [
      { id: 'guest-1', displayName: 'Alice Smith', hasValidPhone: true, isOptedOut: false },
      { id: 'guest-2', displayName: 'Bob Jones', hasValidPhone: true, isOptedOut: false },
      { id: 'guest-3', displayName: 'Carol Davis', hasValidPhone: true, isOptedOut: false },
    ],
    filteredGuests: [
      { id: 'guest-1', displayName: 'Alice Smith', hasValidPhone: true, isOptedOut: false },
      { id: 'guest-2', displayName: 'Bob Jones', hasValidPhone: true, isOptedOut: false },
      { id: 'guest-3', displayName: 'Carol Davis', hasValidPhone: true, isOptedOut: false },
    ],
    selectedGuestIds: [],
    totalSelected: 0,
    willReceiveMessage: 0,
    toggleGuestSelection: jest.fn(),
    selectAllEligible: jest.fn(),
    clearAllSelection: jest.fn(),
    setSearchQuery: jest.fn(),
    loading: false,
    error: null,
    refresh: jest.fn(),
  })),
}));

jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({
            data: {
              title: 'Test Event',
              event_date: '2025-01-01',
              host_name: 'Test Host',
              time_zone: 'America/New_York',
            },
            error: null,
          })),
        })),
      })),
    })),
  },
}));

describe('MessageComposer - Modify Audience Prefill', () => {
  const mockEventId = 'test-event-id';
  
  const createDirectScheduledMessage = (selectedGuestIds: string[]): ScheduledMessage => ({
    id: 'test-message-id',
    event_id: mockEventId,
    sender_user_id: 'test-user-id',
    content: 'Test message content',
    message_type: 'direct',
    send_at: '2025-01-01T15:00:00Z',
    target_all_guests: false,
    target_guest_ids: selectedGuestIds,
    target_guest_tags: null,
    send_via_sms: true,
    send_via_push: true,
    status: 'scheduled',
    created_at: '2025-01-01T10:00:00Z',
    updated_at: '2025-01-01T10:00:00Z',
    sent_at: null,
    recipient_count: selectedGuestIds.length,
    success_count: 0,
    failure_count: 0,
    subject: null,
    scheduled_tz: 'America/New_York',
    scheduled_local: '2025-01-01T10:00:00',
    idempotency_key: null,
    version: 1,
    modified_at: null,
    modification_count: 0,
  });

  it('should prefill exact recipients for Direct message edit', async () => {
    const editingMessage = createDirectScheduledMessage(['guest-1', 'guest-2']);
    
    const mockToggleGuestSelection = jest.fn();
    const mockClearAllSelection = jest.fn();
    
    // Mock the hook to return our controlled state
    const useGuestSelectionMock = require('@/hooks/messaging/useGuestSelection').useGuestSelection;
    useGuestSelectionMock.mockReturnValue({
      allGuests: [
        { id: 'guest-1', displayName: 'Alice Smith', hasValidPhone: true, isOptedOut: false },
        { id: 'guest-2', displayName: 'Bob Jones', hasValidPhone: true, isOptedOut: false },
        { id: 'guest-3', displayName: 'Carol Davis', hasValidPhone: true, isOptedOut: false },
      ],
      eligibleGuests: [
        { id: 'guest-1', displayName: 'Alice Smith', hasValidPhone: true, isOptedOut: false },
        { id: 'guest-2', displayName: 'Bob Jones', hasValidPhone: true, isOptedOut: false },
        { id: 'guest-3', displayName: 'Carol Davis', hasValidPhone: true, isOptedOut: false },
      ],
      filteredGuests: [
        { id: 'guest-1', displayName: 'Alice Smith', hasValidPhone: true, isOptedOut: false },
        { id: 'guest-2', displayName: 'Bob Jones', hasValidPhone: true, isOptedOut: false },
        { id: 'guest-3', displayName: 'Carol Davis', hasValidPhone: true, isOptedOut: false },
      ],
      selectedGuestIds: ['guest-1', 'guest-2'], // Prefilled selection
      totalSelected: 2,
      willReceiveMessage: 2,
      toggleGuestSelection: mockToggleGuestSelection,
      selectAllEligible: jest.fn(),
      clearAllSelection: mockClearAllSelection,
      setSearchQuery: jest.fn(),
      loading: false,
      error: null,
      refresh: jest.fn(),
    });

    render(
      <MessageComposer
        eventId={mockEventId}
        editingMessage={editingMessage}
      />
    );

    // Wait for component to load and prefill
    await waitFor(() => {
      expect(screen.getByDisplayValue('Test message content')).toBeInTheDocument();
    });

    // Should show edit mode indicator
    expect(screen.getByText('📝 Editing scheduled message')).toBeInTheDocument();
    expect(screen.getByText('Delivery mode is locked to scheduled time')).toBeInTheDocument();

    // Should show correct audience count
    expect(screen.getByText('📝 Selected recipients only — 2 selected')).toBeInTheDocument();
    expect(screen.getByText('Selected Recipients')).toBeInTheDocument();

    // Should have cleared selection first, then restored exact recipients
    expect(mockClearAllSelection).toHaveBeenCalled();
    
    // Should have called toggleGuestSelection for each target guest
    await waitFor(() => {
      expect(mockToggleGuestSelection).toHaveBeenCalledWith('guest-1');
      expect(mockToggleGuestSelection).toHaveBeenCalledWith('guest-2');
    });
  });

  it('should hide Send Now toggle in edit mode', async () => {
    const editingMessage = createDirectScheduledMessage(['guest-1']);
    
    render(
      <MessageComposer
        eventId={mockEventId}
        editingMessage={editingMessage}
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test message content')).toBeInTheDocument();
    });

    // Send Now button should not be visible
    expect(screen.queryByText('Send Now')).not.toBeInTheDocument();
    
    // Schedule for Later button should not be visible
    expect(screen.queryByText('Schedule for Later')).not.toBeInTheDocument();

    // Should show edit mode indicator instead
    expect(screen.getByText('📝 Editing scheduled message')).toBeInTheDocument();
  });

  it('should show Update Scheduled Message CTA in edit mode', async () => {
    const editingMessage = createDirectScheduledMessage(['guest-1']);
    
    render(
      <MessageComposer
        eventId={mockEventId}
        editingMessage={editingMessage}
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test message content')).toBeInTheDocument();
    });

    // Should show update CTA instead of send/schedule
    expect(screen.getByText('Update Scheduled Message')).toBeInTheDocument();
    
    // Should not show regular send CTAs
    expect(screen.queryByText('Send Now')).not.toBeInTheDocument();
    expect(screen.queryByText('Schedule Message')).not.toBeInTheDocument();
  });

  it('should handle announcement message edit mode correctly', async () => {
    const announcementMessage: ScheduledMessage = {
      ...createDirectScheduledMessage([]),
      message_type: 'announcement',
      target_all_guests: true,
      target_guest_ids: null,
    };
    
    const mockSelectAllEligible = jest.fn();
    
    const useGuestSelectionMock = require('@/hooks/messaging/useGuestSelection').useGuestSelection;
    useGuestSelectionMock.mockReturnValue({
      allGuests: [
        { id: 'guest-1', displayName: 'Alice Smith', hasValidPhone: true, isOptedOut: false },
        { id: 'guest-2', displayName: 'Bob Jones', hasValidPhone: true, isOptedOut: false },
      ],
      eligibleGuests: [
        { id: 'guest-1', displayName: 'Alice Smith', hasValidPhone: true, isOptedOut: false },
        { id: 'guest-2', displayName: 'Bob Jones', hasValidPhone: true, isOptedOut: false },
      ],
      filteredGuests: [
        { id: 'guest-1', displayName: 'Alice Smith', hasValidPhone: true, isOptedOut: false },
        { id: 'guest-2', displayName: 'Bob Jones', hasValidPhone: true, isOptedOut: false },
      ],
      selectedGuestIds: ['guest-1', 'guest-2'], // All selected
      totalSelected: 2,
      willReceiveMessage: 2,
      toggleGuestSelection: jest.fn(),
      selectAllEligible: mockSelectAllEligible,
      clearAllSelection: jest.fn(),
      setSearchQuery: jest.fn(),
      loading: false,
      error: null,
      refresh: jest.fn(),
    });

    render(
      <MessageComposer
        eventId={mockEventId}
        editingMessage={announcementMessage}
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test message content')).toBeInTheDocument();
    });

    // Should call selectAllEligible for announcement messages
    expect(mockSelectAllEligible).toHaveBeenCalled();
  });
});
