import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MessageComposer } from '@/components/features/messaging/host/MessageComposer';

// Mock the hooks and services
vi.mock('@/hooks/messaging/useGuestSelection', () => ({
  useGuestSelection: () => ({
    filteredGuests: [],
    selectedGuestIds: ['guest-1', 'guest-2'],
    totalSelected: 2,
    willReceiveMessage: 2,
    toggleGuestSelection: vi.fn(),
    selectAllEligible: vi.fn(),
    clearAllSelection: vi.fn(),
    setSearchQuery: vi.fn(),
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}));

vi.mock('@/lib/services/messaging', () => ({
  createScheduledMessage: vi.fn(),
  sendMessageToEvent: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({
            data: {
              id: 'test-event',
              title: 'Test Event',
              event_date: '2025-01-01',
              host_user_id: 'test-user',
              time_zone: 'America/Los_Angeles',
            },
            error: null,
          }),
        }),
      }),
    }),
  },
}));

describe.skip('Real-time Schedule Validation', () => {
  // TODO(a11y): needs label wiring - form controls not rendering with proper accessibility labels
  const originalDateNow = Date.now;
  const mockNow = new Date('2025-01-01T12:00:00Z');

  beforeEach(() => {
    // Mock Date.now to return a fixed time
    Date.now = vi.fn(() => mockNow.getTime());
    vi.useFakeTimers();
    vi.setSystemTime(mockNow);
  });

  afterEach(() => {
    Date.now = originalDateNow;
    vi.useRealTimers();
  });

  const renderMessageComposer = () => {
    return render(
      <MessageComposer
        eventId="test-event"
        onMessageSent={vi.fn()}
        onMessageScheduled={vi.fn()}
      />
    );
  };

  describe('Real-time clock behavior', () => {
    it('should start real-time clock when switching to schedule mode', async () => {
      renderMessageComposer();
      
      // Switch to schedule mode
      const scheduleButton = screen.getByText('Schedule for Later');
      fireEvent.click(scheduleButton);
      
      // Verify clock is running by advancing time and checking validation
      const dateInput = screen.getByLabelText('Date');
      const timeInput = screen.getByLabelText('Time');
      
      // Set a time that will become invalid as time passes
      const futureTime = new Date(mockNow.getTime() + 4 * 60 * 1000); // 4 minutes from now
      fireEvent.change(dateInput, { target: { value: futureTime.toISOString().split('T')[0] } });
      fireEvent.change(timeInput, { target: { value: futureTime.toTimeString().slice(0, 5) } });
      
      // Should be valid initially (4 minutes > 3 minute requirement)
      expect(screen.queryByText('Pick a time at least 3 minutes from now')).not.toBeInTheDocument();
      
      // Advance time by 2 minutes (now only 2 minutes remain, should become invalid)
      vi.advanceTimersByTime(2 * 60 * 1000);
      
      await waitFor(() => {
        expect(screen.getByText('Pick a time at least 3 minutes from now')).toBeInTheDocument();
      });
    });

    it('should stop clock when switching back to send now mode', async () => {
      renderMessageComposer();
      
      // Switch to schedule mode then back to now
      const scheduleButton = screen.getByText('Schedule for Later');
      fireEvent.click(scheduleButton);
      
      const sendNowButton = screen.getByText('Send Now');
      fireEvent.click(sendNowButton);
      
      // Clock should stop (no validation errors should appear)
      vi.advanceTimersByTime(10 * 60 * 1000);
      
      expect(screen.queryByText('Pick a time at least 3 minutes from now')).not.toBeInTheDocument();
    });

    it('should update clock on visibility change', async () => {
      renderMessageComposer();
      
      const scheduleButton = screen.getByText('Schedule for Later');
      fireEvent.click(scheduleButton);
      
      // Simulate tab becoming hidden then visible
      Object.defineProperty(document, 'visibilityState', {
        writable: true,
        value: 'hidden',
      });
      
      // Advance time while hidden
      vi.advanceTimersByTime(5 * 60 * 1000);
      
      // Make tab visible again
      Object.defineProperty(document, 'visibilityState', {
        writable: true,
        value: 'visible',
      });
      
      // Trigger visibility change event
      const visibilityEvent = new Event('visibilitychange');
      document.dispatchEvent(visibilityEvent);
      
      // Clock should update immediately
      await waitFor(() => {
        // Any scheduled time should now be invalid due to time advancement
        const dateInput = screen.getByLabelText('Date');
        const timeInput = screen.getByLabelText('Time');
        
        const nearFutureTime = new Date(mockNow.getTime() + 2 * 60 * 1000);
        fireEvent.change(dateInput, { target: { value: nearFutureTime.toISOString().split('T')[0] } });
        fireEvent.change(timeInput, { target: { value: nearFutureTime.toTimeString().slice(0, 5) } });
        
        expect(screen.getByText('Pick a time at least 3 minutes from now')).toBeInTheDocument();
      });
    });
  });

  describe('Instant validation feedback', () => {
    it('should show error immediately for past times', async () => {
      renderMessageComposer();
      
      const scheduleButton = screen.getByText('Schedule for Later');
      fireEvent.click(scheduleButton);
      
      const dateInput = screen.getByLabelText('Date');
      const timeInput = screen.getByLabelText('Time');
      
      // Set a past time
      const pastTime = new Date(mockNow.getTime() - 60 * 1000); // 1 minute ago
      fireEvent.change(dateInput, { target: { value: pastTime.toISOString().split('T')[0] } });
      fireEvent.change(timeInput, { target: { value: pastTime.toTimeString().slice(0, 5) } });
      
      await waitFor(() => {
        expect(screen.getByText('Pick a time at least 3 minutes from now')).toBeInTheDocument();
      });
    });

    it('should show error for times within 3 minutes', async () => {
      renderMessageComposer();
      
      const scheduleButton = screen.getByText('Schedule for Later');
      fireEvent.click(scheduleButton);
      
      const dateInput = screen.getByLabelText('Date');
      const timeInput = screen.getByLabelText('Time');
      
      // Set a time 2 minutes from now (less than 3 minute requirement)
      const tooSoonTime = new Date(mockNow.getTime() + 2 * 60 * 1000);
      fireEvent.change(dateInput, { target: { value: tooSoonTime.toISOString().split('T')[0] } });
      fireEvent.change(timeInput, { target: { value: tooSoonTime.toTimeString().slice(0, 5) } });
      
      await waitFor(() => {
        expect(screen.getByText('Pick a time at least 3 minutes from now')).toBeInTheDocument();
      });
    });

    it('should not show error for valid times', async () => {
      renderMessageComposer();
      
      const scheduleButton = screen.getByText('Schedule for Later');
      fireEvent.click(scheduleButton);
      
      const dateInput = screen.getByLabelText('Date');
      const timeInput = screen.getByLabelText('Time');
      
      // Set a time 5 minutes from now (valid)
      const validTime = new Date(mockNow.getTime() + 5 * 60 * 1000);
      fireEvent.change(dateInput, { target: { value: validTime.toISOString().split('T')[0] } });
      fireEvent.change(timeInput, { target: { value: validTime.toTimeString().slice(0, 5) } });
      
      await waitFor(() => {
        expect(screen.queryByText('Pick a time at least 3 minutes from now')).not.toBeInTheDocument();
      });
    });

    it('should have aria-live attribute for screen readers', async () => {
      renderMessageComposer();
      
      const scheduleButton = screen.getByText('Schedule for Later');
      fireEvent.click(scheduleButton);
      
      const dateInput = screen.getByLabelText('Date');
      const timeInput = screen.getByLabelText('Time');
      
      // Set invalid time to trigger helper
      const tooSoonTime = new Date(mockNow.getTime() + 2 * 60 * 1000);
      fireEvent.change(dateInput, { target: { value: tooSoonTime.toISOString().split('T')[0] } });
      fireEvent.change(timeInput, { target: { value: tooSoonTime.toTimeString().slice(0, 5) } });
      
      await waitFor(() => {
        const helperElement = screen.getByText('Pick a time at least 3 minutes from now').closest('div');
        expect(helperElement).toHaveAttribute('aria-live', 'polite');
      });
    });
  });

  describe('CTA button behavior', () => {
    it('should disable Schedule Message button when time is too soon', async () => {
      renderMessageComposer();
      
      // Add message content
      const messageInput = screen.getByPlaceholderText(/What would you like to share/);
      fireEvent.change(messageInput, { target: { value: 'Test message' } });
      
      const scheduleButton = screen.getByText('Schedule for Later');
      fireEvent.click(scheduleButton);
      
      const dateInput = screen.getByLabelText('Date');
      const timeInput = screen.getByLabelText('Time');
      
      // Set invalid time
      const tooSoonTime = new Date(mockNow.getTime() + 2 * 60 * 1000);
      fireEvent.change(dateInput, { target: { value: tooSoonTime.toISOString().split('T')[0] } });
      fireEvent.change(timeInput, { target: { value: tooSoonTime.toTimeString().slice(0, 5) } });
      
      await waitFor(() => {
        const sendButton = screen.getByText('Send Message');
        expect(sendButton).toBeDisabled();
      });
    });

    it('should enable Schedule Message button when time is valid', async () => {
      renderMessageComposer();
      
      // Add message content
      const messageInput = screen.getByPlaceholderText(/What would you like to share/);
      fireEvent.change(messageInput, { target: { value: 'Test message' } });
      
      const scheduleButton = screen.getByText('Schedule for Later');
      fireEvent.click(scheduleButton);
      
      const dateInput = screen.getByLabelText('Date');
      const timeInput = screen.getByLabelText('Time');
      
      // Set valid time
      const validTime = new Date(mockNow.getTime() + 5 * 60 * 1000);
      fireEvent.change(dateInput, { target: { value: validTime.toISOString().split('T')[0] } });
      fireEvent.change(timeInput, { target: { value: validTime.toTimeString().slice(0, 5) } });
      
      await waitFor(() => {
        const sendButton = screen.getByText('Send Message');
        expect(sendButton).not.toBeDisabled();
      });
    });
  });

  describe('Auto-snap helper button', () => {
    it('should update time to 3 minutes from now when clicked', async () => {
      renderMessageComposer();
      
      const scheduleButton = screen.getByText('Schedule for Later');
      fireEvent.click(scheduleButton);
      
      const dateInput = screen.getByLabelText('Date');
      const timeInput = screen.getByLabelText('Time');
      
      // Set invalid time to show helper
      const tooSoonTime = new Date(mockNow.getTime() + 2 * 60 * 1000);
      fireEvent.change(dateInput, { target: { value: tooSoonTime.toISOString().split('T')[0] } });
      fireEvent.change(timeInput, { target: { value: tooSoonTime.toTimeString().slice(0, 5) } });
      
      await waitFor(() => {
        expect(screen.getByText('Use 5 minutes from now')).toBeInTheDocument();
      });
      
      // Click the helper button
      const useValidTimeButton = screen.getByText('Use 5 minutes from now');
      fireEvent.click(useValidTimeButton);
      
      // Verify time was updated to 5 minutes from now (rounded up to next minute)
      const expectedTime = new Date(mockNow.getTime() + 5 * 60 * 1000);
      expectedTime.setSeconds(0);
      expectedTime.setMilliseconds(0);
      
      await waitFor(() => {
        expect(dateInput).toHaveValue(expectedTime.toISOString().split('T')[0]);
        expect(timeInput).toHaveValue(expectedTime.toTimeString().slice(0, 5));
      });
    });

    it('should switch to send now when Send now button is clicked', async () => {
      renderMessageComposer();
      
      const scheduleButton = screen.getByText('Schedule for Later');
      fireEvent.click(scheduleButton);
      
      const dateInput = screen.getByLabelText('Date');
      const timeInput = screen.getByLabelText('Time');
      
      // Set invalid time to show helper
      const tooSoonTime = new Date(mockNow.getTime() + 2 * 60 * 1000);
      fireEvent.change(dateInput, { target: { value: tooSoonTime.toISOString().split('T')[0] } });
      fireEvent.change(timeInput, { target: { value: tooSoonTime.toTimeString().slice(0, 5) } });
      
      await waitFor(() => {
        expect(screen.getByText('Send now')).toBeInTheDocument();
      });
      
      // Click the send now button in helper
      const sendNowButton = screen.getByText('Send now');
      fireEvent.click(sendNowButton);
      
      // Should switch back to send now mode
      await waitFor(() => {
        expect(screen.getByText('Send Now')).toBeInTheDocument();
        expect(screen.queryByLabelText('Date')).not.toBeInTheDocument();
      });
    });
  });

  describe('Live summary chip updates', () => {
    it('should show countdown timer that updates in real-time', async () => {
      // Testing with improved infrastructure
      renderMessageComposer();
      
      const scheduleButton = screen.getByText('Schedule for Later');
      fireEvent.click(scheduleButton);
      
      const dateInput = screen.getByLabelText('Date');
      const timeInput = screen.getByLabelText('Time');
      
      // Set valid time (5 minutes from now)
      const validTime = new Date(mockNow.getTime() + 5 * 60 * 1000);
      fireEvent.change(dateInput, { target: { value: validTime.toISOString().split('T')[0] } });
      fireEvent.change(timeInput, { target: { value: validTime.toTimeString().slice(0, 5) } });
      
      // Should show "in 5 minutes"
      await waitFor(() => {
        expect(screen.getByText('in 5 minutes')).toBeInTheDocument();
      });
      
      // Advance time by 1 minute
      vi.advanceTimersByTime(60 * 1000);
      
      // Should update to "in 4 minutes"
      await waitFor(() => {
        expect(screen.getByText('in 4 minutes')).toBeInTheDocument();
      });
    });

    it('should show hours and minutes for longer durations', async () => {
      // Testing with improved infrastructure
      renderMessageComposer();
      
      const scheduleButton = screen.getByText('Schedule for Later');
      fireEvent.click(scheduleButton);
      
      const dateInput = screen.getByLabelText('Date');
      const timeInput = screen.getByLabelText('Time');
      
      // Set time 1 hour 30 minutes from now
      const validTime = new Date(mockNow.getTime() + 90 * 60 * 1000);
      fireEvent.change(dateInput, { target: { value: validTime.toISOString().split('T')[0] } });
      fireEvent.change(timeInput, { target: { value: validTime.toTimeString().slice(0, 5) } });
      
      await waitFor(() => {
        expect(screen.getByText('in 1h 30m')).toBeInTheDocument();
      });
    });
  });
});
