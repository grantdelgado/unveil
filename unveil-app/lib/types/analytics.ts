// Google Analytics gtag types
export interface GtagConfig {
  event_category?: string;
  event_label?: string;
  value?: number;
  non_interaction?: boolean;
  custom_map?: Record<string, string | number | boolean>;
}

export interface WindowWithGtag extends Window {
  gtag?: (command: string, targetId: string, config?: GtagConfig) => void;
} 