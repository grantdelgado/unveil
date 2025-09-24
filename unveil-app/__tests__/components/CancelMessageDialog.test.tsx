import { render, screen, fireEvent } from '@testing-library/react';
import { CancelMessageDialog } from '@/components/ui/CancelMessageDialog';
import type { Database } from '@/app/reference/supabase.types';

type ScheduledMessage = Database['public']['Tables']['scheduled_messages']['Row'];

const mockMessage: ScheduledMessage = {
  id: 'test-id',
  event_id: 'event-id',
  sender_user_id: 'user-id',
  subject: null,
  content: 'Test message content for cancellation',
  message_type: 'announcement',
  send_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
  target_all_guests: true,
  target_sub_event_ids: null,
  target_guest_tags: null,
  target_guest_ids: null,
  send_via_sms: true,
  send_via_push: true,
  status: 'scheduled',
  sent_at: null,
  recipient_count: 5,
  success_count: 0,
  failure_count: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  scheduled_tz: 'America/Los_Angeles',
  scheduled_local: '2024-01-01T15:00:00',
  idempotency_key: 'test-key',
  recipient_snapshot: null,
  version: 1,
  modified_at: null,
  modification_count: 0,
};

describe('CancelMessageDialog', () => {
  const mockOnClose = vi.fn();
  const mockOnConfirm = vi.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders message details correctly', () => {
    render(
      <CancelMessageDialog
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        message={mockMessage}
        isLoading={false}
      />
    );

    expect(screen.getByText('Cancel Scheduled Message')).toBeInTheDocument();
    expect(screen.getByText('Test message content for cancellation')).toBeInTheDocument();
    expect(screen.getByText('5 recipients via Push notification and SMS')).toBeInTheDocument();
    expect(screen.getByText('This message will not be sent')).toBeInTheDocument();
  });

  it('calls onConfirm when Cancel Message button is clicked', () => {
    render(
      <CancelMessageDialog
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        message={mockMessage}
        isLoading={false}
      />
    );

    fireEvent.click(screen.getByText('Cancel Message'));
    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Keep Message button is clicked', () => {
    render(
      <CancelMessageDialog
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        message={mockMessage}
        isLoading={false}
      />
    );

    fireEvent.click(screen.getByText('Keep Message'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('shows loading state correctly', () => {
    render(
      <CancelMessageDialog
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        message={mockMessage}
        isLoading={true}
      />
    );

    expect(screen.getByText('Cancelling...')).toBeInTheDocument();
    expect(screen.getByText('Keep Message')).toBeDisabled();
  });

  it('does not render when message is null', () => {
    const { container } = render(
      <CancelMessageDialog
        isOpen={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        message={null}
        isLoading={false}
      />
    );

    expect(container.firstChild).toBeNull();
  });
});
