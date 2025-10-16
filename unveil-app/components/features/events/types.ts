/**
 * Event Creation Types
 *
 * Shared types for the event creation wizard to avoid circular dependencies
 */

export interface EventFormData {
  title: string;
  event_date: string;
  location: string;
  is_public: boolean;
  sms_tag: string;
}

export interface EventFormErrors {
  title?: string;
  event_date?: string;
  location?: string;
  image?: string;
  general?: string;
  sms_tag?: string;
}

export interface EventWizardStep {
  title: string;
  isValid: boolean;
  canProceed: boolean;
}

export type EventWizardStepName = 'basics' | 'image' | 'review';
