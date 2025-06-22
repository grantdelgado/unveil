import { useCallback, useEffect, useState } from 'react';

type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection' | 'impact';

interface HapticCapabilities {
  vibrate: boolean;
  taptic: boolean; // iOS Taptic Engine
  gamepad: boolean; // Gamepad vibration
}

interface HapticFeedbackHook {
  triggerHaptic: (pattern?: HapticPattern) => void;
  isSupported: boolean;
  capabilities: HapticCapabilities;
}

export function useHapticFeedback(): HapticFeedbackHook {
  const [capabilities, setCapabilities] = useState<HapticCapabilities>({
    vibrate: false,
    taptic: false,
    gamepad: false,
  });

  const isSupported = capabilities.vibrate || capabilities.taptic;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const detectCapabilities = () => {
      setCapabilities({
        vibrate: 'vibrate' in navigator,
        taptic: /iPhone|iPad|iPod/i.test(navigator.userAgent) && 'ontouchstart' in window,
        gamepad: 'getGamepads' in navigator,
      });
    };

    detectCapabilities();
  }, []);

  const triggerHaptic = useCallback((pattern: HapticPattern = 'light') => {
    if (!isSupported) return;

    try {
      // iOS Haptic Engine (Taptic Engine) - Modern approach
      if (capabilities.taptic && 'DeviceMotionEvent' in window) {
        // Try to use iOS Haptic Feedback API if available
        // This is a progressive enhancement for newer iOS devices
        const hapticPatterns = {
          light: 'impactOccurred', // UIImpactFeedbackStyleLight
          medium: 'impactOccurred', // UIImpactFeedbackStyleMedium  
          heavy: 'impactOccurred', // UIImpactFeedbackStyleHeavy
          success: 'notificationOccurred', // UINotificationFeedbackTypeSuccess
          warning: 'notificationOccurred', // UINotificationFeedbackTypeWarning
          error: 'notificationOccurred', // UINotificationFeedbackTypeError
          selection: 'selectionChanged', // UISelectionFeedbackGenerator
          impact: 'impactOccurred',
        };

        // Attempt to trigger iOS haptic feedback (this is experimental)
        if ((window as any).TapticEngine) {
          (window as any).TapticEngine[hapticPatterns[pattern]]();
          return;
        }
      }

      // Fallback to Vibration API for Android and other devices
      if (capabilities.vibrate && 'vibrate' in navigator) {
        const vibrationPatterns = {
          light: [10], // Short, gentle
          medium: [25], // Medium intensity
          heavy: [50], // Strong feedback
          success: [10, 50, 10], // Two quick pulses
          warning: [25, 100, 25], // Medium pulse with pause
          error: [50, 100, 50, 100, 50], // Strong error pattern
          selection: [5], // Very light selection feedback
          impact: [15], // Quick impact
        };

        navigator.vibrate(vibrationPatterns[pattern]);
      }
    } catch (error) {
      // Silently fail on unsupported devices
      if (process.env.NODE_ENV === 'development') {
        console.debug('Haptic feedback not available:', error);
      }
    }
  }, [isSupported, capabilities]);

  return {
    triggerHaptic,
    isSupported,
    capabilities,
  };
} 