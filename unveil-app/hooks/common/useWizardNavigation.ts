import { useState, useCallback } from 'react';

export interface WizardConfig<T extends string> {
  steps: readonly T[];
  initialStep?: T;
  onStepValidation?: (step: T) => boolean;
  onStepChange?: (step: T) => void;
}

export interface UseWizardNavigationReturn<T extends string> {
  currentStep: T;
  currentStepIndex: number;
  totalSteps: number;
  isFirstStep: boolean;
  isLastStep: boolean;
  goToStep: (step: T, skipValidation?: boolean) => boolean;
  goToNextStep: () => boolean;
  goToPreviousStep: () => void;
  goToFirstStep: () => void;
  goToLastStep: () => boolean;
  getStepProgress: () => number;
}

/**
 * Reusable wizard navigation hook
 * Extracted from CreateEventWizard for use across multi-step forms
 */
export function useWizardNavigation<T extends string>({
  steps,
  initialStep,
  onStepValidation,
  onStepChange,
}: WizardConfig<T>): UseWizardNavigationReturn<T> {
  const [currentStep, setCurrentStep] = useState<T>(initialStep || steps[0]);

  const currentStepIndex = steps.indexOf(currentStep);
  const totalSteps = steps.length;
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === totalSteps - 1;

  const goToStep = useCallback((step: T, skipValidation = false): boolean => {
    // Validate current step before moving (unless skipped)
    if (!skipValidation && onStepValidation) {
      if (!onStepValidation(currentStep)) {
        return false; // Validation failed
      }
    }

    setCurrentStep(step);
    onStepChange?.(step);
    return true;
  }, [currentStep, onStepValidation, onStepChange]);

  const goToNextStep = useCallback((): boolean => {
    if (isLastStep) return false;
    
    const nextStep = steps[currentStepIndex + 1];
    return goToStep(nextStep);
  }, [currentStepIndex, isLastStep, steps, goToStep]);

  const goToPreviousStep = useCallback(() => {
    if (!isFirstStep) {
      const previousStep = steps[currentStepIndex - 1];
      goToStep(previousStep, true); // Skip validation when going back
    }
  }, [currentStepIndex, isFirstStep, steps, goToStep]);

  const goToFirstStep = useCallback(() => {
    goToStep(steps[0], true);
  }, [steps, goToStep]);

  const goToLastStep = useCallback((): boolean => {
    return goToStep(steps[totalSteps - 1]);
  }, [steps, totalSteps, goToStep]);

  const getStepProgress = useCallback((): number => {
    return Math.round(((currentStepIndex + 1) / totalSteps) * 100);
  }, [currentStepIndex, totalSteps]);

  return {
    currentStep,
    currentStepIndex,
    totalSteps,
    isFirstStep,
    isLastStep,
    goToStep,
    goToNextStep,
    goToPreviousStep,
    goToFirstStep,
    goToLastStep,
    getStepProgress,
  };
} 