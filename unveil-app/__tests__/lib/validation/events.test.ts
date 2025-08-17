import { 
  eventDetailsSchema, 
  validateField, 
  formatWebsiteUrl,
  transformEventDetailsForDB 
} from '@/lib/validation/events';

describe('Event Details Validation', () => {
  describe('eventDetailsSchema', () => {
    it('validates valid event data', () => {
      const validData = {
        title: 'Sarah & David Wedding',
        event_date: '2025-08-15',
        time_zone: 'America/Los_Angeles',
        location: 'Test Venue',
        website_url: 'https://theknot.com/sarah-david',
        is_public: false,
        allow_open_signup: true,
      };

      const result = eventDetailsSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('rejects invalid title', () => {
      const invalidData = {
        title: 'A', // Too short
        event_date: '2025-08-15',
        time_zone: 'America/Los_Angeles',
        is_public: false,
        allow_open_signup: true,
      };

      const result = eventDetailsSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('at least 3 characters');
      }
    });

    it('rejects invalid date format', () => {
      const invalidData = {
        title: 'Valid Title',
        event_date: '15-08-2025', // Wrong format
        time_zone: 'America/Los_Angeles',
        is_public: false,
        allow_open_signup: true,
      };

      const result = eventDetailsSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('normalizes website URL', () => {
      const dataWithoutProtocol = {
        title: 'Valid Title',
        event_date: '2025-08-15',
        time_zone: 'America/Los_Angeles',
        website_url: 'theknot.com/sarah-david',
        is_public: false,
        allow_open_signup: true,
      };

      const result = eventDetailsSchema.safeParse(dataWithoutProtocol);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.website_url).toBe('https://theknot.com/sarah-david');
      }
    });

    it('handles empty location', () => {
      const dataWithEmptyLocation = {
        title: 'Valid Title',
        event_date: '2025-08-15',
        time_zone: 'America/Los_Angeles',
        location: '',
        is_public: false,
        allow_open_signup: true,
      };

      const result = eventDetailsSchema.safeParse(dataWithEmptyLocation);
      expect(result.success).toBe(true);
    });
  });

  describe('validateField', () => {
    it('validates individual field correctly', () => {
      const error = validateField('title', 'Valid Event Title');
      expect(error).toBeNull();
    });

    it('returns error for invalid field', () => {
      const error = validateField('title', 'A');
      expect(error).toContain('at least 3 characters');
    });
  });

  describe('formatWebsiteUrl', () => {
    it('extracts domain from URL', () => {
      const domain = formatWebsiteUrl('https://www.theknot.com/sarah-david');
      expect(domain).toBe('theknot.com');
    });

    it('handles null URL', () => {
      const domain = formatWebsiteUrl(null);
      expect(domain).toBeNull();
    });

    it('handles invalid URL', () => {
      const domain = formatWebsiteUrl('not-a-url');
      expect(domain).toBe('Invalid URL');
    });
  });

  describe('transformEventDetailsForDB', () => {
    it('transforms form data for database', () => {
      const formData = {
        title: 'Test Event',
        event_date: '2025-08-15',
        time_zone: 'America/Los_Angeles',
        location: 'Test Location',
        website_url: 'https://test.com',
        is_public: false,
        allow_open_signup: true,
      };

      const transformed = transformEventDetailsForDB(formData);
      
      expect(transformed).toEqual({
        title: 'Test Event',
        event_date: '2025-08-15',
        time_zone: 'America/Los_Angeles',
        location: 'Test Location',
        website_url: 'https://test.com',
        is_public: false,
        allow_open_signup: true,
      });
    });

    it('converts empty strings to null', () => {
      const formData = {
        title: 'Test Event',
        event_date: '2025-08-15',
        time_zone: 'America/Los_Angeles',
        location: '',
        website_url: '',
        is_public: false,
        allow_open_signup: true,
      };

      const transformed = transformEventDetailsForDB(formData);
      
      expect(transformed.location).toBeNull();
      expect(transformed.website_url).toBeNull();
    });
  });
});
