import WebApp from '@twa-dev/sdk';

type ImpactStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';
type NotificationType = 'error' | 'success' | 'warning';

/**
 * Haptic Feedback utilities for Telegram WebApp
 * Provides tactile feedback for user interactions
 */
export const haptics = {
  /**
   * Trigger impact feedback (button press, selection change)
   */
  impact: (style: ImpactStyle = 'light') => {
    try {
      WebApp.HapticFeedback?.impactOccurred?.(style);
    } catch {
      // Silently fail if haptics not available
    }
  },

  /**
   * Trigger notification feedback (success, warning, error)
   */
  notification: (type: NotificationType) => {
    try {
      WebApp.HapticFeedback?.notificationOccurred?.(type);
    } catch {
      // Silently fail if haptics not available
    }
  },

  /**
   * Trigger selection changed feedback (swipe between items)
   */
  selection: () => {
    try {
      WebApp.HapticFeedback?.selectionChanged?.();
    } catch {
      // Silently fail if haptics not available
    }
  },

  // Convenience methods
  
  /** Light tap - for minor interactions */
  tap: () => haptics.impact('light'),
  
  /** Medium tap - for button presses */
  button: () => haptics.impact('medium'),
  
  /** Heavy tap - for important actions */
  heavy: () => haptics.impact('heavy'),
  
  /** Success feedback */
  success: () => haptics.notification('success'),
  
  /** Error feedback */
  error: () => haptics.notification('error'),
  
  /** Warning feedback */
  warning: () => haptics.notification('warning'),
};

export default haptics;
