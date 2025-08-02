'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { EventCreationService } from '@/lib/services/eventCreation';
import type { EventCreationInput } from '@/lib/services/eventCreation';
import {
  PageWrapper,
  CardContainer,
  PageTitle,
  SubTitle,
  SectionTitle,
  PrimaryButton,
  SecondaryButton
} from '@/components/ui';

import { EventBasicsStep } from './EventBasicsStep';
import { EventImageStep } from './EventImageStep';
import { GuestImportStep } from './GuestImportStep';
import { EventReviewStep } from './EventReviewStep';

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
  image?: string;
}

type WizardStep = 'basics' | 'image' | 'guests' | 'review';

const STEP_CONFIG = {
  basics: { title: 'Event Details', icon: '📅', step: 1 },
  image: { title: 'Header Image', icon: '🖼️', step: 2 },
  guests: { title: 'Guest List', icon: '👥', step: 3 },
  review: { title: 'Review & Create', icon: '✅', step: 4 },
};

export default function CreateEventWizard() {
  const router = useRouter();
  
  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>('basics');
  
  // Form data
  const [formData, setFormData] = useState<EventFormData>({
    title: '',
    event_date: '',
    event_time: '15:00',
    location: '',
    description: '',
    is_public: true,
  });
  
  // Image state
  const [headerImage, setHeaderImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  
  // Guest import state
  const [guestImportMethod, setGuestImportMethod] = useState<'skip' | 'csv' | 'manual'>('skip');
  const [guestCount, setGuestCount] = useState(0);
  
  // UI state
  const [errors, setErrors] = useState<EventFormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [formMessage, setFormMessage] = useState('');
  
  // Double-submission protection
  const submissionInProgressRef = useRef(false);

  // Update form data
  const updateFormData = useCallback((field: keyof EventFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear errors when user makes changes
    if (errors[field as keyof EventFormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  }, [errors]);

  // Validate current step
  const validateCurrentStep = useCallback((): boolean => {
    const newErrors: EventFormErrors = {};
    
    switch (currentStep) {
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
  }, [currentStep, formData, headerImage]);

  // Navigate between steps
  const goToStep = useCallback((step: WizardStep) => {
    if (validateCurrentStep()) {
      setCurrentStep(step);
      setFormMessage('');
    }
  }, [validateCurrentStep]);

  const goToNextStep = useCallback(() => {
    const stepOrder: WizardStep[] = ['basics', 'image', 'guests', 'review'];
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex < stepOrder.length - 1) {
      goToStep(stepOrder[currentIndex + 1]);
    }
  }, [currentStep, goToStep]);

  const goToPrevStep = useCallback(() => {
    const stepOrder: WizardStep[] = ['basics', 'image', 'guests', 'review'];
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(stepOrder[currentIndex - 1]);
      setFormMessage('');
    }
  }, [currentStep]);

  // Create event using centralized service
  const handleCreateEvent = useCallback(async () => {
    if (!validateCurrentStep()) return;
    
    // Prevent double-submission with immediate check
    if (submissionInProgressRef.current) {
      console.log('Event creation already in progress, ignoring duplicate submission');
      return;
    }
    
    // Immediately mark submission as in progress
    submissionInProgressRef.current = true;
    setIsLoading(true);
    setFormMessage('');
    
    try {
      // Get current user session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.user?.id) {
        setFormMessage('Authentication error. Please try logging in again.');
        setIsLoading(false);
        return;
      }
      
      // Prepare event creation input
      const eventInput: EventCreationInput = {
        title: formData.title,
        event_date: formData.event_date,
        location: formData.location || undefined,
        description: formData.description || undefined,
        is_public: formData.is_public,
        header_image: headerImage || undefined,
      };
      
      // Call centralized service
      const result = await EventCreationService.createEventWithHost(
        eventInput, 
        session.user.id
      );
      
      if (!result.success) {
        // Display prominent user-facing error message
        const errorMessage = result.error?.code === 'HOST_GUEST_ERROR' 
          ? 'Something went wrong while creating your event. Please try again or contact support if the issue persists.'
          : result.error?.message || 'Something went wrong while creating your event. Please try again or contact support if the issue persists.';
        
        setFormMessage(errorMessage);
        setIsLoading(false);
        submissionInProgressRef.current = false; // Reset for retry
        return;
      }
      
      // Success!
      setFormMessage('Wedding hub created successfully!');
      
      // Navigate to event dashboard
      setTimeout(() => {
        router.push(`/host/events/${result.data!.event_id}/dashboard`);
      }, 1500);
      
      // Note: submissionInProgressRef reset not needed here since user is redirected
      
    } catch (error) {
      console.error('Unexpected error during event creation:', error);
      setFormMessage('Something went wrong while creating your event. Please try again or contact support if the issue persists.');
      setIsLoading(false);
      submissionInProgressRef.current = false; // Reset for retry
    }
  }, [formData, headerImage, validateCurrentStep, router]);

  // Get current step info
  const currentStepConfig = STEP_CONFIG[currentStep];
  const totalSteps = Object.keys(STEP_CONFIG).length;

  return (
    <PageWrapper centered={false}>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <CardContainer maxWidth="xl" className="mb-6">
          <div className="text-center space-y-4">
            <PageTitle>Create Your Wedding Hub</PageTitle>
            <SubTitle>
              Set up your wedding communication center in just a few steps
            </SubTitle>
            
            {/* Progress indicator */}
            <div className="flex items-center justify-center space-x-2 pt-4">
              <div className="flex items-center space-x-1">
                <span className="text-2xl">{currentStepConfig.icon}</span>
                <span className="text-sm font-medium text-gray-600">
                  Step {currentStepConfig.step} of {totalSteps}
                </span>
              </div>
            </div>
            
            {/* Progress bar */}
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-pink-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(currentStepConfig.step / totalSteps) * 100}%` }}
              />
            </div>
          </div>
        </CardContainer>

        {/* Step Content */}
        <CardContainer maxWidth="xl">
          <div className="space-y-6">
            <SectionTitle className="flex items-center gap-2">
              <span className="text-2xl">{currentStepConfig.icon}</span>
              {currentStepConfig.title}
            </SectionTitle>

            {/* Render current step */}
            {currentStep === 'basics' && (
              <EventBasicsStep
                formData={formData}
                errors={errors}
                onUpdate={updateFormData}
                disabled={isLoading}
              />
            )}

            {currentStep === 'image' && (
              <EventImageStep
                headerImage={headerImage}
                imagePreview={imagePreview}
                onImageChange={setHeaderImage}
                onPreviewChange={setImagePreview}
                error={errors.image}
                disabled={isLoading}
              />
            )}

            {currentStep === 'guests' && (
              <GuestImportStep
                importMethod={guestImportMethod}
                guestCount={guestCount}
                onMethodChange={setGuestImportMethod}
                onGuestCountChange={setGuestCount}
                disabled={isLoading}
                eventId={undefined} // No import during wizard - guests added after event creation
              />
            )}

            {currentStep === 'review' && (
              <EventReviewStep
                formData={formData}
                headerImage={headerImage}
                imagePreview={imagePreview}
                guestImportMethod={guestImportMethod}
                guestCount={guestCount}
              />
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-6">
              <div>
                {currentStep !== 'basics' && (
                  <SecondaryButton
                    onClick={goToPrevStep}
                    disabled={isLoading}
                    className="min-h-[44px]"
                  >
                    ← Previous
                  </SecondaryButton>
                )}
              </div>

              <div>
                {currentStep === 'review' ? (
                  <PrimaryButton
                    onClick={handleCreateEvent}
                    loading={isLoading}
                    disabled={isLoading}
                    className="min-h-[44px] px-8"
                  >
                    {isLoading ? 'Creating Hub...' : 'Create Wedding Hub'}
                  </PrimaryButton>
                ) : (
                  <PrimaryButton
                    onClick={goToNextStep}
                    disabled={isLoading}
                    className="min-h-[44px]"
                  >
                    Continue →
                  </PrimaryButton>
                )}
              </div>
            </div>

            {/* Form Message */}
            {formMessage && (
              <div
                className={`p-4 rounded-lg text-center text-sm ${
                  formMessage.includes('error') || formMessage.includes('Failed')
                    ? 'bg-red-50 text-red-700 border border-red-100'
                    : 'bg-green-50 text-green-700 border border-green-100'
                }`}
              >
                {formMessage}
              </div>
            )}
          </div>
        </CardContainer>

        {/* Back to Dashboard */}
        <div className="text-center mt-6">
          <SecondaryButton
            onClick={() => router.back()}
            disabled={isLoading}
            className="min-h-[44px]"
          >
            ← Back to Dashboard
          </SecondaryButton>
        </div>
      </div>
    </PageWrapper>
  );
} 