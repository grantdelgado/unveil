// Application Constants
export const APP_CONFIG = {
  name: 'Unveil',
  description:
    'Focus on presence, not logistics. Streamline wedding communication and preserve shared memories in one elegant space.',
  version: '0.1.0',
} as const;

// Route Constants
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  PROFILE: '/profile',
  SELECT_EVENT: '/select-event',
  RESET_PASSWORD: '/reset-password',
  HOST: {
    EVENTS: '/host/events',
    CREATE_EVENT: '/host/events/create',
    EVENT_DASHBOARD: (eventId: string) => `/host/events/${eventId}/dashboard`,
  },
  GUEST: {
    // HOME: '/guest/home', // REMOVED: Obsolete route, use EVENT_HOME instead
    EVENTS: '/guest/events',
    EVENT_HOME: (eventId: string) => `/guest/events/${eventId}/home`,
  },
} as const;

// Database Constants
export const DB_ENUMS = {
  RSVP_STATUS: {
    ATTENDING: 'attending',
    DECLINED: 'declined',
    MAYBE: 'maybe',
    PENDING: 'pending',
  },
  MESSAGE_TYPE: {
    DIRECT: 'direct',
    ANNOUNCEMENT: 'announcement',
    CHANNEL: 'channel',
  },
  MEDIA_TYPE: {
    IMAGE: 'image',
    VIDEO: 'video',
  },
  USER_ROLE: {
    GUEST: 'guest',
    HOST: 'host',
    ADMIN: 'admin',
  },
} as const;

// UI Constants
export const UI_CONFIG = {
  PAGINATION: {
    DEFAULT_PAGE_SIZE: 20,
    MEDIA_PAGE_SIZE: 12,
    MESSAGES_PAGE_SIZE: 50,
  },
  TIMEOUTS: {
    TOAST_DURATION: 3000,
    REDIRECT_DELAY: 1000,
    DEBOUNCE_DELAY: 300,
  },
  FILE_UPLOAD: {
    MAX_SIZE_MB: 10,
    ACCEPTED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
    ACCEPTED_VIDEO_TYPES: ['video/mp4', 'video/webm'],
  },
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  GENERIC: 'Something went wrong. Please try again.',
  NETWORK: 'Network error. Please check your connection.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  VALIDATION: 'Please check your input and try again.',
  FILE_TOO_LARGE: `File size must be less than ${UI_CONFIG.FILE_UPLOAD.MAX_SIZE_MB}MB`,
  INVALID_FILE_TYPE: 'Invalid file type. Please upload an image or video.',
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  PROFILE_UPDATED: 'Profile updated successfully',
  EVENT_CREATED: 'Wedding hub created successfully!',
  RSVP_UPDATED: 'RSVP updated successfully',
  MESSAGE_SENT: 'Message sent successfully',
  MEDIA_UPLOADED: 'Photo uploaded successfully',
} as const;
