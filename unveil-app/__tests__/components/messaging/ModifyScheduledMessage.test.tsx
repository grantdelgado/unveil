import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MessageComposer } from '@/components/features/messaging/host/MessageComposer';

// Mock other dependencies
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              title: 'Test Event',
              event_date: '2024-12-31',
              time_zone: 'America/New_York',
              host: { full_name: 'Test Host' },
            },
            error: null,
          }),
        }),
      }),
    }),
  },
}));

vi.mock('@/hooks/messaging/useGuestSelection', () => ({
  useGuestSelection: () => ({
    filteredGuests: [],
    selectedGuestIds: [],
    totalSelected: 0,
    willReceiveMessage: 5,
    toggleGuestSelection: vi.fn(),
    selectAllEligible: vi.fn(),
    clearAllSelection: vi.fn(),
    setSearchQuery: vi.fn(),
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}));

vi.mock('@/lib/services/messaging-client', () => ({
  updateScheduledMessage: vi.fn().mockResolvedValue({
    success: true,
  }),
}));

describe('ModifyScheduledMessage', () => {
  const mockScheduledMessage = {
    id: 'test-message-id',
    content: 'Original message content',
    send_at: '2024-12-31T15:00:00Z',
    message_type: 'announcement',
    target_all_guests: true,
    target_guest_ids: null,
    target_guest_tags: null,
    status: 'scheduled',
    event_id: 'test-event-id',
    sender_user_id: 'test-user-id',
    created_at: '2024-12-30T10:00:00Z',
    updated_at: null,
    version: 1,
    modification_count: 0,
    modified_at: null,
  };

  const defaultProps = {
    eventId: 'test-event-id',
    onMessageSent: vi.fn(),
    onMessageScheduled: vi.fn(),
    onMessageUpdated: vi.fn(),
    onClear: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders composer in edit mode when editingMessage is provided', async () => {
    render(
      <MessageComposer
        {...defaultProps}
        editingMessage={mockScheduledMessage}
      />
    );

    // Wait for component to load and prefill
    await waitFor(() => {
      expect(screen.getByDisplayValue('Original message content')).toBeInTheDocument();
    });

    // Verify the button shows "Update Scheduled Message"
    expect(screen.getByText('Update Scheduled Message')).toBeInTheDocument();
  });

  it('prefills form with existing message data', async () => {
    render(
      <MessageComposer
        {...defaultProps}
        editingMessage={mockScheduledMessage}
      />
    );

    await waitFor(() => {
      // Check message content is prefilled
      expect(screen.getByDisplayValue('Original message content')).toBeInTheDocument();
      
      // Check schedule mode is selected
      expect(screen.getByText('Schedule for Later')).toBeInTheDocument();
      
      // Check message type is set to announcement
      expect(screen.getByText('📢 Everyone in this event')).toBeInTheDocument();
    });
  });

  it('shows correct button text in edit mode', async () => {
    render(
      <MessageComposer
        {...defaultProps}
        editingMessage={mockScheduledMessage}
      />
    );

    await waitFor(() => {
      // Main composer button should show "Update Scheduled Message"
      expect(screen.getByText('Update Scheduled Message')).toBeInTheDocument();
      
      // Should not show "Schedule Message" or "Send Now"
      expect(screen.queryByText('Schedule Message')).not.toBeInTheDocument();
      expect(screen.queryByText('Send Now')).not.toBeInTheDocument();
    });
  });

  it('calls onMessageUpdated when update is successful', async () => {
    const onMessageUpdated = vi.fn();
    
    render(
      <MessageComposer
        {...defaultProps}
        editingMessage={mockScheduledMessage}
        onMessageUpdated={onMessageUpdated}
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Original message content')).toBeInTheDocument();
    });

    // Update the message content
    const textarea = screen.getByDisplayValue('Original message content');
    fireEvent.change(textarea, { target: { value: 'Updated message content' } });

    // Click update button
    const updateButton = screen.getByText('Update Scheduled Message');
    fireEvent.click(updateButton);

    // Wait for update to complete
    await waitFor(() => {
      expect(onMessageUpdated).toHaveBeenCalled();
    });
  });

  it('modify capability is always enabled (no feature flag)', () => {
    // Modify functionality is now always-on, gated only by business rules
    // (status === 'scheduled' AND timing constraints)
    
    // This test verifies that modify works without any feature flag checks
    render(
      <MessageComposer
        {...defaultProps}
        editingMessage={mockScheduledMessage}
      />
    );

    // Should always show modify functionality when editing
    expect(screen.getByText('Update Scheduled Message')).toBeInTheDocument();
  });
});
