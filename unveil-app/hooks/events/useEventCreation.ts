import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export interface EventFormData {
  title: string;
  event_date: string;
  event_time: string;
  location: string;
  description: string;
  is_public: boolean;
}

export interface EventFormErrors {
  title?: string;
  event_date?: string;
  event_time?: string;
  location?: string;
  description?: string;
  image?: string;
}

export interface UseEventCreationReturn {
  // Form state
  formData: EventFormData;
  errors: EventFormErrors;
  isLoading: boolean;
  formMessage: string;
  
  // Form actions
  updateFormData: (field: keyof EventFormData, value: string | boolean) => void;
  validateStep: (step: string) => boolean;
  clearErrors: () => void;
  setFormMessage: (message: string) => void;
  
  // Image state
  headerImage: File | null;
  imagePreview: string;
  setHeaderImage: (file: File | null) => void;
  setImagePreview: (preview: string) => void;
  
  // Guest import state
  guestImportMethod: 'skip' | 'csv' | 'manual';
  guestCount: number;
  setGuestImportMethod: (method: 'skip' | 'csv' | 'manual') => void;
  setGuestCount: (count: number) => void;
  
  // Form submission
  submitEvent: () => Promise<void>;
}

/**
 * Custom hook for event creation form management
 * Extracted from CreateEventWizard for better separation of concerns
 */
export function useEventCreation(): UseEventCreationReturn {
  const router = useRouter();
  
  // Form data state
  const [formData, setFormData] = useState<EventFormData>({
    title: '',
    event_date: '',
    event_time: '15:00',
    location: '',
    description: '',
    is_public: true,
  });
  
  // Error and UI state
  const [errors, setErrors] = useState<EventFormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [formMessage, setFormMessage] = useState('');
  
  // Image state
  const [headerImage, setHeaderImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  
  // Guest import state
  const [guestImportMethod, setGuestImportMethod] = useState<'skip' | 'csv' | 'manual'>('skip');
  const [guestCount, setGuestCount] = useState(0);

  // Update form data with error clearing
  const updateFormData = useCallback((field: keyof EventFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear errors when user makes changes
    if (errors[field as keyof EventFormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  }, [errors]);

  // Step validation logic
  const validateStep = useCallback((step: string): boolean => {
    const newErrors: EventFormErrors = {};
    
    switch (step) {
      case 'basics':
        if (!formData.title.trim()) {
          newErrors.title = 'Event name is required';
        } else if (formData.title.length < 3) {
          newErrors.title = 'Event name must be at least 3 characters';
        }
        
        if (!formData.event_date) {
          newErrors.event_date = 'Event date is required';
        } else {
          const selectedDate = new Date(formData.event_date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (selectedDate < today) {
            newErrors.event_date = 'Event date cannot be in the past';
          }
        }
        
        if (!formData.event_time) {
          newErrors.event_time = 'Event time is required';
        }
        break;
        
      case 'image':
        if (headerImage && headerImage.size > 10 * 1024 * 1024) {
          newErrors.image = 'Image must be smaller than 10MB';
        }
        break;
        
      case 'guests':
        // No validation required - this step is optional
        break;
        
      case 'review':
        // Final validation would be done here if needed
        break;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, headerImage]);

  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  // Event submission logic
  const submitEvent = useCallback(async () => {
    setIsLoading(true);
    setFormMessage('');
    
    try {
      // TODO: Implement actual event creation logic
      // This would involve:
      // 1. Creating the event record
      // 2. Uploading header image if provided
      // 3. Importing guests if specified
      // 4. Redirecting to the new event
      
      console.log('Creating event with data:', {
        formData,
        headerImage: headerImage?.name,
        guestImportMethod,
        guestCount,
      });
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setFormMessage('Event created successfully!');
      
      // Redirect to the new event (placeholder)
      setTimeout(() => {
        router.push('/host/events');
      }, 1000);
      
    } catch (error) {
      console.error('Error creating event:', error);
      setFormMessage('Failed to create event. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [formData, headerImage, guestImportMethod, guestCount, router]);

  return {
    // Form state
    formData,
    errors,
    isLoading,
    formMessage,
    
    // Form actions
    updateFormData,
    validateStep,
    clearErrors,
    setFormMessage,
    
    // Image state
    headerImage,
    imagePreview,
    setHeaderImage,
    setImagePreview,
    
    // Guest import state
    guestImportMethod,
    guestCount,
    setGuestImportMethod,
    setGuestCount,
    
    // Form submission
    submitEvent,
  };
} 