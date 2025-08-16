/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ScheduleComposer } from '../ScheduleComposer';

// Mock hooks and services
jest.mock('@/hooks/messaging/useRecipientPreview', () => ({
  useRecipientPreview: () => ({
    previewData: {
      guests: [
        { id: '1', displayName: 'John Doe', tags: ['Family'], rsvpStatus: 'attending', hasPhone: true },
        { id: '2', displayName: 'Jane Smith', tags: ['Friends'], rsvpStatus: 'pending', hasPhone: true },
      ],
      totalCount: 2,
      validRecipientsCount: 2,
      tagCounts: { 'Family': 1, 'Friends': 1 },
      rsvpStatusCounts: { 'attending': 1, 'pending': 1 }
    },
    loading: false
  })
}));

jest.mock('@/hooks/messaging/useScheduledMessages', () => ({
  useScheduledMessages: () => ({
    createScheduledMessage: jest.fn().mockResolvedValue({ success: true })
  })
}));

describe('ScheduleComposer', () => {
  const defaultProps = {
    eventId: 'test-event-id',
    onMessageScheduled: jest.fn(),
    onCancel: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders schedule composer interface', () => {
    render(<ScheduleComposer {...defaultProps} />);
    
    expect(screen.getByText('Schedule Message')).toBeInTheDocument();
    expect(screen.getByText('Message Type')).toBeInTheDocument();
    expect(screen.getByText('Schedule Delivery')).toBeInTheDocument();
    expect(screen.getByText('Delivery Method')).toBeInTheDocument();
    expect(screen.getByText('Message Content')).toBeInTheDocument();
  });

  it('shows message type selection with emojis', () => {
    render(<ScheduleComposer {...defaultProps} />);
    
    expect(screen.getByText('📢')).toBeInTheDocument(); // Announcement
    expect(screen.getByText('📧')).toBeInTheDocument(); // RSVP Reminder
    expect(screen.getByText('🎉')).toBeInTheDocument(); // Thank You
    
    expect(screen.getByText('Announcement')).toBeInTheDocument();
    expect(screen.getByText('RSVP Reminder')).toBeInTheDocument();
    expect(screen.getByText('Thank You')).toBeInTheDocument();
  });

  it('requires future date and time for scheduling', () => {
    render(<ScheduleComposer {...defaultProps} />);
    
    const dateInput = screen.getByLabelText('Date');
    const timeInput = screen.getByLabelText('Time');
    
    // Should have minimum date/time restrictions
    expect(dateInput).toHaveAttribute('type', 'date');
    expect(timeInput).toHaveAttribute('type', 'time');
    expect(dateInput).toHaveAttribute('min');
  });

  it('shows delivery method options', () => {
    render(<ScheduleComposer {...defaultProps} />);
    
    expect(screen.getByLabelText(/Push Notification/)).toBeInTheDocument();
    expect(screen.getByLabelText(/SMS Text Message/)).toBeInTheDocument();
    
    // Push should be checked by default
    expect(screen.getByLabelText(/Push Notification/)).toBeChecked();
    expect(screen.getByLabelText(/SMS Text Message/)).not.toBeChecked();
  });

  it('validates required fields before allowing schedule', () => {
    render(<ScheduleComposer {...defaultProps} />);
    
    const scheduleButton = screen.getByRole('button', { name: /Schedule Message/ });
    
    // Should be disabled initially (no message content, date, or time)
    expect(scheduleButton).toBeDisabled();
  });

  it('enables schedule button when all fields are valid', async () => {
    render(<ScheduleComposer {...defaultProps} />);
    
    // Fill in message content
    const messageTextarea = screen.getByPlaceholderText('Write your scheduled message here...');
    fireEvent.change(messageTextarea, { target: { value: 'Test scheduled message' } });
    
    // Set future date and time
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    const dateInput = screen.getByLabelText('Date');
    const timeInput = screen.getByLabelText('Time');
    
    fireEvent.change(dateInput, { target: { value: tomorrowStr } });
    fireEvent.change(timeInput, { target: { value: '14:30' } });
    
    await waitFor(() => {
      const scheduleButton = screen.getByRole('button', { name: /Schedule Message/ });
      expect(scheduleButton).not.toBeDisabled();
    });
  });

  it('shows character count for message content', () => {
    render(<ScheduleComposer {...defaultProps} />);
    
    const messageTextarea = screen.getByPlaceholderText('Write your scheduled message here...');
    
    expect(screen.getByText('0/1000')).toBeInTheDocument();
    
    fireEvent.change(messageTextarea, { target: { value: 'Hello world' } });
    expect(screen.getByText('11/1000')).toBeInTheDocument();
  });

  it('shows scheduling summary when fields are filled', async () => {
    render(<ScheduleComposer {...defaultProps} />);
    
    // Fill in message content
    const messageTextarea = screen.getByPlaceholderText('Write your scheduled message here...');
    fireEvent.change(messageTextarea, { target: { value: 'Test message' } });
    
    // Set future date and time
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    const dateInput = screen.getByLabelText('Date');
    const timeInput = screen.getByLabelText('Time');
    
    fireEvent.change(dateInput, { target: { value: tomorrowStr } });
    fireEvent.change(timeInput, { target: { value: '14:30' } });
    
    await waitFor(() => {
      expect(screen.getByText('📊 Scheduling Summary')).toBeInTheDocument();
      expect(screen.getByText('2 guests')).toBeInTheDocument(); // Recipients from mock
    });
  });

  it('warns about delivery method requirement', () => {
    render(<ScheduleComposer {...defaultProps} />);
    
    // Uncheck push notification (default)
    const pushCheckbox = screen.getByLabelText(/Push Notification/);
    fireEvent.click(pushCheckbox);
    
    expect(screen.getByText('❌ Please select at least one delivery method')).toBeInTheDocument();
  });

  it('calls onCancel when cancel button is clicked', () => {
    render(<ScheduleComposer {...defaultProps} />);
    
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelButton);
    
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it('shows time until send when date/time are set', async () => {
    render(<ScheduleComposer {...defaultProps} />);
    
    // Set future date and time
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    const dateInput = screen.getByLabelText('Date');
    const timeInput = screen.getByLabelText('Time');
    
    fireEvent.change(dateInput, { target: { value: tomorrowStr } });
    fireEvent.change(timeInput, { target: { value: '14:30' } });
    
    await waitFor(() => {
      expect(screen.getByText(/⏳ Delivery:/)).toBeInTheDocument();
      expect(screen.getByText(/in.*day/)).toBeInTheDocument();
    });
  });
});
