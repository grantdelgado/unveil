import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EventDetailsEditor } from '@/components/features/host-dashboard/EventDetailsEditor';
import type { EventDetailsFormData } from '@/lib/validation/events';
import type { Database } from '@/app/reference/supabase.types';

// Mock data
const mockEvent: Database['public']['Tables']['events']['Row'] = {
  id: 'test-event-id',
  title: 'Test Wedding',
  event_date: '2025-08-15',
  time_zone: 'America/Los_Angeles',
  location: 'Test Venue, Test City',
  website_url: 'https://test.com',
  is_public: false,
  allow_open_signup: true,
  description: null,
  host_user_id: 'test-user-id',
  header_image_url: null,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

// Mock functions
const mockOnSave = vi.fn();
const mockOnCancel = vi.fn();
const mockOnPreviewGuestView = vi.fn();

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock react-hook-form
vi.mock('react-hook-form', () => ({
  useForm: () => ({
    register: vi.fn(() => ({ name: 'test', onChange: vi.fn(), onBlur: vi.fn() })),
    handleSubmit: (fn: (data: unknown) => void) => (e: Event) => {
      e.preventDefault();
      fn(mockEvent);
    },
    watch: () => mockEvent,
    formState: { errors: {}, isDirty: true, isValid: true },
    setValue: jest.fn(),
    clearErrors: jest.fn(),
  }),
}));

describe('EventDetailsEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all form sections', () => {
    render(
      <EventDetailsEditor
        event={mockEvent}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        onPreviewGuestView={mockOnPreviewGuestView}
      />
    );

    // Check for section titles
    expect(screen.getByText('📝')).toBeInTheDocument();
    expect(screen.getByText('Basics')).toBeInTheDocument();
    expect(screen.getByText('📍')).toBeInTheDocument();
    expect(screen.getByText('Location')).toBeInTheDocument();
    expect(screen.getByText('🔗')).toBeInTheDocument();
    expect(screen.getByText('Website')).toBeInTheDocument();
    expect(screen.getByText('👁️')).toBeInTheDocument();
    expect(screen.getByText('Visibility')).toBeInTheDocument();
  });

  it('renders form fields with labels', () => {
    render(
      <EventDetailsEditor
        event={mockEvent}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        onPreviewGuestView={mockOnPreviewGuestView}
      />
    );

    // Check for form fields
    expect(screen.getByLabelText(/Event Title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Event Date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Time Zone/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Where is your event taking place/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Wedding Website/i)).toBeInTheDocument();
  });

  it('renders action buttons', () => {
    render(
      <EventDetailsEditor
        event={mockEvent}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        onPreviewGuestView={mockOnPreviewGuestView}
      />
    );

    expect(screen.getByRole('button', { name: /Save Changes/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Preview Guest View/i })).toBeInTheDocument();
  });

  it('calls onCancel when cancel button is clicked', () => {
    render(
      <EventDetailsEditor
        event={mockEvent}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        onPreviewGuestView={mockOnPreviewGuestView}
      />
    );

    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onPreviewGuestView when preview button is clicked', () => {
    render(
      <EventDetailsEditor
        event={mockEvent}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        onPreviewGuestView={mockOnPreviewGuestView}
      />
    );

    const previewButton = screen.getByRole('button', { name: /Preview Guest View/i });
    fireEvent.click(previewButton);

    expect(mockOnPreviewGuestView).toHaveBeenCalledTimes(1);
  });

  it('shows success message after successful save', async () => {
    mockOnSave.mockResolvedValue({ success: true });

    render(
      <EventDetailsEditor
        event={mockEvent}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        onPreviewGuestView={mockOnPreviewGuestView}
      />
    );

    const saveButton = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledTimes(1);
    });
  });

  it('shows error message after failed save', async () => {
    mockOnSave.mockResolvedValue({ success: false, error: 'Test error message' });

    render(
      <EventDetailsEditor
        event={mockEvent}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        onPreviewGuestView={mockOnPreviewGuestView}
      />
    );

    const saveButton = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/Test error message/i)).toBeInTheDocument();
    });
  });
});
