import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import {
  isValidEmail,
  isValidPhoneNumber,
  normalizePhoneNumber,
} from './utils';
import type { EventGuestInsert } from './supabase';

// Guest import validation schema - phone is now required, name is optional
export const guestImportRowSchema = z.object({
  guest_name: z.string().optional().or(z.literal('')),
  guest_email: z.string().email().optional().or(z.literal('')),
  phone: z.string().min(1, 'Phone number is required'),
  rsvp_status: z.enum(['attending', 'declined', 'maybe', 'pending']).optional(),
  notes: z.string().optional().or(z.literal('')),
  guest_tags: z.array(z.string()).optional(),
});

export type GuestImportData = z.infer<typeof guestImportRowSchema>;

// Common column mappings that users might have - phone is now the primary identifier
export const COMMON_COLUMN_MAPPINGS = {
  phone: [
    'phone',
    'phone number',
    'mobile',
    'cell',
    'telephone',
    'contact',
    'cell phone',
    'mobile number',
  ],
  name: [
    'name',
    'full name',
    'guest name',
    'first name',
    'last name',
    'full_name',
    'guest_name',
  ],
  email: ['email', 'email address', 'e-mail', 'guest email', 'guest_email'],
  notes: [
    'notes',
    'comments',
    'remarks',
    'special requests',
    'dietary restrictions',
  ],
  tags: ['tags', 'group', 'category', 'table', 'side', 'family', 'friends'],
  rsvp: ['rsvp', 'status', 'response', 'attending', 'rsvp_status'],
} as const;

// File parsing results
export interface ParsedFileResult {
  success: boolean;
  data?: Record<string, string>[];
  error?: string;
  headers?: string[];
}

// Import validation results
export interface ImportValidationResult {
  validGuests: GuestImportData[];
  invalidGuests: Array<{
    row: number;
    data: Record<string, string>;
    errors: string[];
  }>;
  summary: {
    total: number;
    valid: number;
    invalid: number;
    duplicateEmails: number;
  };
}

// Column mapping interface
export interface ColumnMappingType {
  [key: string]: keyof GuestImportData | null;
}

/**
 * Parse CSV file
 */
export const parseCSVFile = (file: File): Promise<ParsedFileResult> => {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase(),
      complete: (results) => {
        if (results.errors.length > 0) {
          resolve({
            success: false,
            error: `CSV parsing error: ${results.errors[0].message}`,
          });
          return;
        }

        const data = results.data as Record<string, string>[];
        const headers = results.meta.fields || [];

        resolve({
          success: true,
          data,
          headers,
        });
      },
      error: (error) => {
        resolve({
          success: false,
          error: `Failed to parse CSV: ${error.message}`,
        });
      },
    });
  });
};

/**
 * Parse Excel file
 */
export const parseExcelFile = (file: File): Promise<ParsedFileResult> => {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        // Use the first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert to JSON with header row
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: '',
        }) as string[][];

        if (jsonData.length < 2) {
          resolve({
            success: false,
            error:
              'Excel file must have at least a header row and one data row',
          });
          return;
        }

        // Extract headers and normalize
        const headers = jsonData[0].map((h) => String(h).trim().toLowerCase());

        // Convert to object format
        const parsedData = jsonData
          .slice(1)
          .map((row) => {
            const obj: Record<string, string> = {};
            headers.forEach((header, i) => {
              obj[header] = String(row[i] || '').trim();
            });
            return obj;
          })
          .filter((row) => {
            // Filter out completely empty rows
            return Object.values(row).some((value) => value !== '');
          });

        resolve({
          success: true,
          data: parsedData,
          headers,
        });
      } catch (error) {
        resolve({
          success: false,
          error: `Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    };

    reader.onerror = () => {
      resolve({
        success: false,
        error: 'Failed to read file',
      });
    };

    reader.readAsArrayBuffer(file);
  });
};

/**
 * Auto-detect column mappings based on common patterns
 */
export const autoDetectColumnMapping = (
  headers: string[],
): ColumnMappingType => {
  const mapping: ColumnMappingType = {};

  headers.forEach((header) => {
    const normalizedHeader = header.toLowerCase().trim();

    // Check each mapping category - prioritize phone detection
    for (const [field, patterns] of Object.entries(COMMON_COLUMN_MAPPINGS)) {
      if (patterns.some((pattern) => normalizedHeader.includes(pattern))) {
        mapping[header] = field as keyof GuestImportData;
        break;
      }
    }
  });

  return mapping;
};

/**
 * Validate and transform imported guest data
 */
export const validateImportedGuests = (
  data: Record<string, string>[],
  columnMapping: ColumnMappingType,
): ImportValidationResult => {
  const validGuests: GuestImportData[] = [];
  const invalidGuests: Array<{
    row: number;
    data: Record<string, string>;
    errors: string[];
  }> = [];

  const seenEmails = new Set<string>();
  const seenPhones = new Set<string>();
  let duplicateEmails = 0;

  data.forEach((row, index) => {
    const errors: string[] = [];
    const guestData: Partial<GuestImportData> = {};

    // Map columns to guest fields
    Object.entries(columnMapping).forEach(([csvColumn, guestField]) => {
      if (!guestField) return;

      const value = row[csvColumn]?.trim() || '';

      switch (guestField) {
        case 'phone':
          guestData.phone = value;
          // Validate phone number
          if (!value) {
            errors.push('Phone number is required');
          } else if (!isValidPhoneNumber(value)) {
            errors.push(`Invalid phone number format: ${value}`);
          } else {
            // Check for duplicate phones
            const normalizedPhone = normalizePhoneNumber(value);
            if (seenPhones.has(normalizedPhone)) {
              errors.push(`Duplicate phone number: ${value}`);
            } else {
              seenPhones.add(normalizedPhone);
            }
          }
          break;
        case 'guest_name':
          guestData.guest_name = value;
          break;
        case 'guest_email':
          if (value) {
            if (isValidEmail(value)) {
              if (seenEmails.has(value.toLowerCase())) {
                duplicateEmails++;
                errors.push(`Duplicate email: ${value}`);
              } else {
                seenEmails.add(value.toLowerCase());
                guestData.guest_email = value;
              }
            } else {
              errors.push(`Invalid email format: ${value}`);
            }
          }
          break;
        case 'notes':
          guestData.notes = value;
          break;
        case 'guest_tags':
          if (value) {
            // Split by common delimiters
            const tags = value
              .split(/[,;|]/)
              .map((tag) => tag.trim())
              .filter(Boolean);
            guestData.guest_tags = tags;
          }
          break;
        case 'rsvp_status':
          if (value) {
            const normalizedStatus = value.toLowerCase();
            if (
              ['attending', 'yes', 'going', 'accept'].includes(normalizedStatus)
            ) {
              guestData.rsvp_status = 'attending';
            } else if (
              ['declined', 'no', 'not going', 'decline'].includes(
                normalizedStatus,
              )
            ) {
              guestData.rsvp_status = 'declined';
            } else if (
              ['maybe', 'perhaps', 'unsure'].includes(normalizedStatus)
            ) {
              guestData.rsvp_status = 'maybe';
            } else {
              guestData.rsvp_status = 'pending';
            }
          }
          break;
      }
    });

    // If no name provided, use phone number as fallback display name
    if (!guestData.guest_name && guestData.phone) {
      guestData.guest_name = guestData.phone;
    }

    // Validate the guest data
    const validation = guestImportRowSchema.safeParse(guestData);

    if (!validation.success) {
      validation.error.errors.forEach((err) => {
        errors.push(`${err.path.join('.')}: ${err.message}`);
      });
    }

    if (errors.length > 0) {
      invalidGuests.push({
        row: index + 1,
        data: row,
        errors,
      });
    } else {
      validGuests.push(validation.data!);
    }
  });

  return {
    validGuests,
    invalidGuests,
    summary: {
      total: data.length,
      valid: validGuests.length,
      invalid: invalidGuests.length,
      duplicateEmails,
    },
  };
};

/**
 * Convert validated guest data to database format
 */
export const convertToEventGuests = (
  guests: GuestImportData[],
  eventId: string,
): EventGuestInsert[] => {
  return guests.map((guest) => ({
    event_id: eventId,
    phone: guest.phone,
    guest_name: guest.guest_name || guest.phone,
    guest_email: guest.guest_email || null,
    guest_tags: guest.guest_tags || null,
    user_id: null, // Phone-only guests don't have user accounts initially
    role: 'guest' as const,
    rsvp_status: (guest.rsvp_status?.toLowerCase() || 'pending') as
      | 'attending'
      | 'declined'
      | 'maybe'
      | 'pending',
    notes: guest.notes || null,
    sms_opt_out: false, // Default to SMS enabled
    preferred_communication: 'sms' as const,
  }));
};

/**
 * Validate file type and size
 */
export const validateImportFile = (
  file: File,
): { valid: boolean; error?: string } => {
  const maxSize = 10 * 1024 * 1024; // 10MB
  const allowedTypes = [
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];

  if (file.size > maxSize) {
    return { valid: false, error: 'File size must be less than 10MB' };
  }

  if (
    !allowedTypes.includes(file.type) &&
    !file.name.match(/\.(csv|xlsx|xls)$/i)
  ) {
    return { valid: false, error: 'File must be CSV or Excel format' };
  }

  return { valid: true };
};

/**
 * Generate sample CSV template
 */
export const generateSampleCSV = (): string => {
  const headers = ['Phone', 'Name', 'Email', 'Notes', 'Tags', 'RSVP Status'];
  const sampleData = [
    [
      '(555) 123-4567',
      'John Smith',
      'john@example.com',
      'Vegetarian meal',
      'Family,Groomsmen',
      'attending',
    ],
    [
      '(555) 987-6543',
      'Jane Doe',
      'jane@example.com',
      'Plus one: Mike Johnson',
      'Friends',
      'pending',
    ],
    [
      '(555) 555-0123',
      'Bob Wilson',
      'bob@example.com',
      'Wheelchair accessible seating',
      'Coworkers',
      'maybe',
    ],
  ];

  const csvContent = [headers, ...sampleData]
    .map((row) => row.map((cell) => `"${cell}"`).join(','))
    .join('\n');

  return csvContent;
};
