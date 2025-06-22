'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

interface WelcomeBannerProps {
  guestCount: number;
  onImportGuests?: () => void;
  onSendFirstMessage?: () => void;
}

export function WelcomeBanner({
  guestCount,
  onImportGuests,
  onSendFirstMessage,
}: WelcomeBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  // Calculate completion status
  const hasGuests = guestCount > 0;
  const completedSteps = [hasGuests].filter(Boolean).length;
  const totalSteps = 1;

  // Don't show if all steps completed or dismissed
  if (isDismissed || completedSteps === totalSteps) {
    return null;
  }

  const steps = [
    {
      id: 'guests',
      title: 'Import your guest list',
      description: 'Upload a spreadsheet or add guests manually to get started',
      completed: hasGuests,
      action: onImportGuests,
      icon: '👥',
      buttonText: 'Import Guests',
    },
  ];

  const nextStep = steps.find((step) => !step.completed);

  return (
    <div className="bg-gradient-to-r from-purple-50 to-rose-50 border border-purple-200 rounded-2xl p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <div className="text-2xl mr-3">✨</div>
          <div>
            <h2 className="text-xl font-semibold text-stone-800">
              Welcome to your wedding hub!
            </h2>
            <p className="text-stone-600">
              {completedSteps} of {totalSteps} setup steps completed
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsDismissed(true)}
          className="text-stone-400 hover:text-stone-600 transition-colors"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-stone-600 mb-2">
          <span>Setup Progress</span>
          <span>{Math.round((completedSteps / totalSteps) * 100)}%</span>
        </div>
        <div className="w-full bg-white rounded-full h-2 overflow-hidden">
          <div
            className="bg-gradient-to-r from-purple-500 to-rose-500 h-full transition-all duration-500"
            style={{ width: `${(completedSteps / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* Next step */}
      {nextStep && (
        <div className="bg-white rounded-xl p-4 border border-purple-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="text-2xl mr-3">{nextStep.icon}</div>
              <div>
                <h3 className="font-semibold text-stone-800">
                  {nextStep.title}
                </h3>
                <p className="text-sm text-stone-600">{nextStep.description}</p>
              </div>
            </div>
            {nextStep.action && (
              <Button
                onClick={nextStep.action}
                className="bg-gradient-to-r from-purple-500 to-rose-500 hover:from-purple-600 hover:to-rose-600"
              >
                {nextStep.buttonText}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Completion celebration */}
      {completedSteps === totalSteps && (
        <div className="mt-6 text-center">
          <div className="text-4xl mb-2">🎉</div>
          <h3 className="text-lg font-semibold text-stone-800 mb-1">
            Your wedding hub is ready!
          </h3>
          <p className="text-sm text-stone-600">
            Guests can now RSVP and start sharing in your celebration
          </p>
          {onSendFirstMessage && (
            <Button
              onClick={onSendFirstMessage}
              variant="secondary"
              size="sm"
              className="mt-3"
            >
              Send Welcome Message
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
