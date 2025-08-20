import { supabase } from '@/lib/supabase/client';
import type { Database } from '@/app/reference/supabase.types';
import { logger } from '@/lib/logger';

type EventInsert = Database['public']['Tables']['events']['Insert'];
type EventGuestInsert = Database['public']['Tables']['event_guests']['Insert'];

export interface EventCreationInput {
  title: string;
  event_date: string;
  location?: string;
  is_public: boolean;
  header_image?: File;
}

export interface EventCreationResult {
  success: boolean;
  data?: {
    event_id: string;
    title: string;
    host_user_id: string;
    created_at: string;
    header_image_url?: string;
  };
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface HostGuestProfile {
  full_name?: string;
  phone: string;
}

export interface GuestImportInput {
  guest_name: string;
  phone: string;
  guest_email?: string;
  role?: 'guest' | 'host' | 'admin';
  notes?: string;
  guest_tags?: string[];
}

export interface GuestImportResult {
  success: boolean;
  data?: {
    imported_count: number;
    failed_count: number;
    failed_rows?: GuestImportError[];
    event_id: string;
  };
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface GuestImportError {
  row_index: number;
  guest_data: GuestImportInput;
  error_code: string;
  error_message: string;
}

export interface CSVParseError {
  row: number;
  message: string;
  data?: unknown;
}

export interface CSVParseResult {
  success: boolean;
  data?: GuestImportInput[];
  errors?: CSVParseError[];
}

/**
 * Centralized Event Creation Service
 * Handles atomic event creation with host guest entry and optional image upload
 * Follows project MCP conventions for Supabase interactions
 */
export class EventCreationService {
  
  /**
   * Create a new event with host guest entry in a single atomic operation
   */
  static async createEventWithHost(
    input: EventCreationInput, 
    userId: string
  ): Promise<EventCreationResult> {
    const operationId = `event-creation-${Date.now()}`;
    
    try {
      logger.info('Starting event creation', { 
        operationId, 
        userId, 
        title: input.title 
      });

      // Step 1: Validate user session
      const sessionValidation = await this.validateUserSession(userId);
      if (!sessionValidation.valid) {
        return {
          success: false,
          error: {
            code: 'AUTH_ERROR',
            message: 'Authentication error. Please try logging in again.',
            details: sessionValidation.error
          }
        };
      }

      // Step 2: Upload image if provided
      let headerImageUrl: string | null = null;
      if (input.header_image) {
        const imageResult = await this.uploadEventImage(input.header_image, userId);
        if (!imageResult.success) {
          return {
            success: false,
            error: {
              code: 'IMAGE_UPLOAD_ERROR',
              message: imageResult.error || 'Failed to upload image',
              details: imageResult.details
            }
          };
        }
        headerImageUrl = imageResult.url || null;
      }

      // Step 3: Attempt atomic event creation with host guest
      const creationResult = await this.createEventAtomic(input, userId, headerImageUrl);
      
      if (!creationResult.success) {
        // Cleanup uploaded image if event creation failed
        if (headerImageUrl) {
          await this.cleanupImage(headerImageUrl);
        }
        return creationResult;
      }

      logger.info('Event creation completed successfully', {
        operationId,
        eventId: creationResult.data?.event_id
      });

      return creationResult;

    } catch (error) {
      logger.error('Unexpected error during event creation', {
        operationId,
        error,
        userId,
        title: input.title
      });

      return {
        success: false,
        error: {
          code: 'UNEXPECTED_ERROR',
          message: 'An unexpected error occurred. Please try again.',
          details: error
        }
      };
    }
  }

  /**
   * Validate user session and authentication
   */
  private static async validateUserSession(userId: string): Promise<{
    valid: boolean;
    error?: unknown;
  }> {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.user?.id || session.user.id !== userId) {
        return { valid: false, error: sessionError };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error };
    }
  }

  /**
   * Upload event header image to Supabase storage
   */
  private static async uploadEventImage(
    file: File, 
    userId: string
  ): Promise<{
    success: boolean;
    url?: string;
    error?: string;
    details?: unknown;
  }> {
    try {
      // Validate file
      if (file.size > 10 * 1024 * 1024) {
        return {
          success: false,
          error: 'Image must be smaller than 10MB'
        };
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${Date.now()}.${fileExt}`;

      // Upload to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('event-images')
        .upload(fileName, file);

      if (uploadError || !uploadData) {
        throw new Error(uploadError?.message || 'Upload failed');
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('event-images')
        .getPublicUrl(fileName);

      return {
        success: true,
        url: urlData.publicUrl
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown upload error',
        details: error
      };
    }
  }

  /**
   * Create event and host guest entry atomically
   * Uses database function if available, otherwise implements client-side transaction simulation
   */
  private static async createEventAtomic(
    input: EventCreationInput,
    userId: string,
    headerImageUrl: string | null
  ): Promise<EventCreationResult> {
    
    // Try using database function for true atomicity first
    try {
      const atomicResult = await this.createEventWithRPC(input, userId, headerImageUrl);
      if (atomicResult.success) {
        return atomicResult;
      }
      // Fall back to client-side simulation if RPC fails
      logger.warn('RPC method failed, falling back to client-side transaction simulation');
    } catch (rpcError) {
      logger.warn('RPC method not available, using client-side transaction simulation', { rpcError });
    }

    // Client-side transaction simulation with rollback
    return await this.createEventClientSide(input, userId, headerImageUrl);
  }

  /**
   * Attempt atomic creation using Supabase RPC/database function
   */
  private static async createEventWithRPC(
    input: EventCreationInput,
    userId: string,
    headerImageUrl: string | null
  ): Promise<EventCreationResult> {
    
    // Prepare event data
    const eventData = {
      title: input.title.trim(),
      event_date: input.event_date,
      location: input.location?.trim() || null,

      header_image_url: headerImageUrl,
      host_user_id: userId,
      is_public: input.is_public,
    };

    // Try to call database function (if it exists)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc('create_event_with_host_atomic', {
      event_data: eventData
    });

    if (error) {
      throw error;
    }

    // Type the response from our custom function
    const atomicResult = data as { success: boolean; event_id?: string; created_at?: string; error_message?: string };

    if (atomicResult && atomicResult.success) {
      return {
        success: true,
        data: {
          event_id: atomicResult.event_id!,
          title: eventData.title,
          host_user_id: userId,
          created_at: atomicResult.created_at!,
          header_image_url: headerImageUrl || undefined
        }
      };
    }

    throw new Error('RPC function did not return success');
  }

  /**
   * Client-side transaction simulation with rollback capability
   */
  private static async createEventClientSide(
    input: EventCreationInput,
    userId: string,
    headerImageUrl: string | null
  ): Promise<EventCreationResult> {
    
    let createdEventId: string | null = null;

    try {
      // Step 1: Create event record
      const eventData: EventInsert = {
        title: input.title.trim(),
        event_date: input.event_date,
        location: input.location?.trim() || null,
  
        header_image_url: headerImageUrl,
        host_user_id: userId,
        is_public: input.is_public,
      };

      const { data: newEvent, error: insertError } = await supabase
        .from('events')
        .insert(eventData)
        .select('id, title, host_user_id, created_at')
        .single();

      if (insertError) {
        return {
          success: false,
          error: {
            code: insertError.code || 'INSERT_ERROR',
            message: this.mapEventInsertError(insertError),
            details: insertError
          }
        };
      }

      if (!newEvent) {
        return {
          success: false,
          error: {
            code: 'NO_DATA_RETURNED',
            message: 'Event creation completed but no data returned.'
          }
        };
      }

      createdEventId = newEvent.id;

      // Step 2: Create host guest entry
      const hostProfile = await this.getHostProfile(userId);
      const hostGuestResult = await this.createHostGuestEntry(newEvent.id, userId, hostProfile);

      if (!hostGuestResult.success) {
        // Rollback: Delete the created event
        logger.warn('Event rollback triggered due to guest insert failure', {
          eventId: newEvent.id,
          userId,
          error: hostGuestResult.error
        });
        
        await this.rollbackEventCreation(newEvent.id);
        return {
          success: false,
          error: {
            code: 'HOST_GUEST_ERROR',
            message: 'Failed to create host guest entry. Event creation rolled back.',
            details: hostGuestResult.error
          }
        };
      }

      // Success!
      return {
        success: true,
        data: {
          event_id: newEvent.id,
          title: newEvent.title,
          host_user_id: newEvent.host_user_id,
          created_at: newEvent.created_at || new Date().toISOString(),
          header_image_url: headerImageUrl || undefined
        }
      };

    } catch (error) {
      // Cleanup on any unexpected error
      if (createdEventId) {
        await this.rollbackEventCreation(createdEventId);
      }
      
      throw error;
    }
  }

  /**
   * Get host profile information for guest entry
   */
  private static async getHostProfile(userId: string): Promise<HostGuestProfile> {
    try {
      const { data: hostProfile } = await supabase
        .from('users')
        .select('full_name, phone')
        .eq('id', userId)
        .single();

      if (!hostProfile?.phone) {
        throw new Error('Host phone number is required but not found');
      }

      return {
        full_name: hostProfile.full_name || undefined,
        phone: hostProfile.phone!
      };
    } catch (error) {
      logger.error('Failed to fetch host profile', { error, userId });
      throw new Error('Host profile not found or missing required phone number');
    }
  }

  /**
   * Create host guest entry
   */
  private static async createHostGuestEntry(
    eventId: string,
    userId: string,
    hostProfile: HostGuestProfile
  ): Promise<{ success: boolean; error?: unknown }> {
    try {
      const hostGuestData: EventGuestInsert = {
        event_id: eventId,
        user_id: userId,
        phone: hostProfile.phone, // Use actual host phone number from profile
        guest_name: hostProfile.full_name || 'Host',
        role: 'host',
        rsvp_status: 'attending',
        preferred_communication: 'sms',
        sms_opt_out: false, // Hosts should be opted into SMS for their own events
      };

      const { error: guestError } = await supabase
        .from('event_guests')
        .insert(hostGuestData);

      if (guestError) {
        return { success: false, error: guestError };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error };
    }
  }

  /**
   * Rollback event creation by deleting the event record
   */
  private static async rollbackEventCreation(eventId: string): Promise<void> {
    try {
      await supabase
        .from('events')
        .delete()
        .eq('id', eventId);
      
      logger.info('Event creation rolled back successfully', { eventId });
    } catch (error) {
      logger.error('Failed to rollback event creation', { error, eventId });
    }
  }

  /**
   * Cleanup uploaded image
   */
  private static async cleanupImage(imageUrl: string): Promise<void> {
    try {
      // Extract file path from URL
      const urlParts = imageUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];
      const userFolder = urlParts[urlParts.length - 2];
      const filePath = `${userFolder}/${fileName}`;

      await supabase.storage
        .from('event-images')
        .remove([filePath]);
      
      logger.info('Cleaned up uploaded image', { filePath });
    } catch (error) {
      logger.warn('Failed to cleanup uploaded image', { error, imageUrl });
    }
  }

  /**
   * Map database insert errors to user-friendly messages
   */
  private static mapEventInsertError(error: { code?: string; message?: string }): string {
    switch (error.code) {
      case '23505':
        return 'An event with this name already exists. Please choose a different name.';
      case '23503':
        return 'User validation failed. Please log out and log back in.';
      case '23514':
        return 'Invalid event data. Please check your inputs.';
      default:
        return `Failed to create event: ${error.message || 'Unknown error'}`;
    }
  }

  /**
   * Import guests to an existing event
   * Supports batch operations with rollback on failure
   */
  static async importGuests(
    eventId: string,
    guests: GuestImportInput[],
    userId: string
  ): Promise<GuestImportResult> {
    const operationId = `guest-import-${Date.now()}`;
    
    try {
      logger.info('Starting guest import', {
        operationId,
        eventId,
        userId,
        guestCount: guests.length
      });

      // Step 1: Validate user can import guests to this event
      const permissionCheck = await this.validateGuestImportPermission(eventId, userId);
      if (!permissionCheck.valid) {
        return {
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: 'You do not have permission to import guests to this event.',
            details: permissionCheck.error
          }
        };
      }

      // Step 2: Validate guest data
      const validationResult = this.validateGuestData(guests);
      if (!validationResult.success) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Guest data validation failed. Please check your data.',
            details: validationResult.errors
          }
        };
      }

      // Step 2.5: Validate no guest phone conflicts with host
      const hostPhoneValidation = await this.validateGuestPhonesNotHost(eventId, validationResult.validGuests!);
      if (!hostPhoneValidation.success) {
        return {
          success: false,
          error: {
            code: 'HOST_PHONE_CONFLICT',
            message: hostPhoneValidation.message || 'One or more guest phone numbers belong to the event host.',
            details: hostPhoneValidation.conflictingPhones
          }
        };
      }

      // Step 3: Perform batch import with error tracking
      const importResult = await this.performBatchGuestImport(
        eventId,
        validationResult.validGuests!,
        operationId
      );

      logger.info('Guest import completed', {
        operationId,
        eventId,
        importedCount: importResult.imported_count,
        failedCount: importResult.failed_count
      });

      // Step 4: SMS invitations removed - guests are now added without auto-invite
      // This supports the "add now, invite later" flow where hosts manually send invitations
      logger.info('Guest import completed without auto-invitations', {
        operationId,
        eventId,
        importedCount: importResult.imported_count,
        note: 'Guests added without invited_at timestamp - use Send Invitations to invite them'
      });

      if (importResult.successfully_imported.length > 0) {
        // On client-side, we'll handle SMS via a separate API call after import
        logger.info('Client-side import completed, SMS invitations will be handled separately', {
          operationId,
          eventId,
          guestCount: importResult.successfully_imported.length
        });
      }

      return {
        success: true,
        data: {
          imported_count: importResult.imported_count,
          failed_count: importResult.failed_count,
          failed_rows: importResult.failed_rows,
          event_id: eventId
        }
      };

    } catch (error) {
      logger.error('Unexpected error during guest import', {
        operationId,
        error,
        eventId,
        userId,
        guestCount: guests.length
      });

      return {
        success: false,
        error: {
          code: 'UNEXPECTED_ERROR',
          message: 'An unexpected error occurred during import. Please try again.',
          details: error
        }
      };
    }
  }

  /**
   * Parse CSV file content into guest data
   */
  static parseCSV(csvContent: string): CSVParseResult {
    try {
      const lines = csvContent.trim().split('\n');
      
      if (lines.length === 0) {
        return {
          success: false,
          errors: [{ row: 0, message: 'CSV file is empty' }]
        };
      }

      // Expected header: name, phone, email (optional), role (optional), notes (optional)
      const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
      const requiredHeaders = ['name', 'phone'];
      
      // Validate headers
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
      if (missingHeaders.length > 0) {
        return {
          success: false,
          errors: [{
            row: 0,
            message: `Missing required headers: ${missingHeaders.join(', ')}. Expected: name, phone`
          }]
        };
      }

      const guests: GuestImportInput[] = [];
      const errors: CSVParseError[] = [];

      // Parse data rows
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        
        if (values.length === 0 || values.every(v => !v)) {
          continue; // Skip empty rows
        }

        try {
          const guest: GuestImportInput = {
            guest_name: values[headers.indexOf('name')] || '',
            phone: values[headers.indexOf('phone')] || '',
            guest_email: values[headers.indexOf('email')] || undefined,
            role: (values[headers.indexOf('role')] as 'guest' | 'host') || 'guest',
            notes: values[headers.indexOf('notes')] || undefined,
            guest_tags: values[headers.indexOf('tags')] 
              ? values[headers.indexOf('tags')].split(';').filter(t => t.trim())
              : undefined
          };

          // Basic validation
          if (!guest.guest_name.trim()) {
            errors.push({
              row: i + 1,
              message: 'Guest name is required',
              data: guest
            });
            continue;
          }

          if (!guest.phone.trim()) {
            errors.push({
              row: i + 1,
              message: 'Phone number is required',
              data: guest
            });
            continue;
          }

          guests.push(guest);
        } catch (parseError) {
          errors.push({
            row: i + 1,
            message: `Failed to parse row: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
            data: values
          });
        }
      }

      return {
        success: errors.length === 0,
        data: guests,
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error) {
      return {
        success: false,
        errors: [{
          row: 0,
          message: `Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      };
    }
  }

  /**
   * Validate user permission to import guests
   */
  private static async validateGuestImportPermission(
    eventId: string,
    userId: string
  ): Promise<{ valid: boolean; error?: unknown }> {
    try {
      // Check if user is authenticated
      const sessionCheck = await this.validateUserSession(userId);
      if (!sessionCheck.valid) {
        return { valid: false, error: 'Invalid session' };
      }

      // Check if user is host of the event
      const { data: event } = await supabase
        .from('events')
        .select('host_user_id')
        .eq('id', eventId)
        .single();

      if (!event || event.host_user_id !== userId) {
        return { valid: false, error: 'User is not the host of this event' };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error };
    }
  }

  /**
   * Validate that guest phone numbers don't conflict with the host
   */
  private static async validateGuestPhonesNotHost(
    eventId: string, 
    guests: GuestImportInput[]
  ): Promise<{
    success: boolean;
    message?: string;
    conflictingPhones?: string[];
  }> {
    try {
      const conflictingPhones: string[] = [];
      
      for (const guest of guests) {
        if (guest.phone) {
          const { data: isValid, error } = await supabase
            .rpc('validate_guest_phone_not_host', {
              p_event_id: eventId,
              p_phone: guest.phone
            });

          if (error) {
            logger.error('Error validating guest phone against host', { eventId, phone: guest.phone, error });
            continue; // Skip validation on error, let it through
          }

          if (!isValid) {
            conflictingPhones.push(guest.phone);
          }
        }
      }

      if (conflictingPhones.length > 0) {
        return {
          success: false,
          message: `Cannot add guest(s) with phone number(s) that belong to the event host: ${conflictingPhones.join(', ')}`,
          conflictingPhones
        };
      }

      return { success: true };
    } catch (error) {
      logger.error('Error in host phone validation', { eventId, error });
      // On validation error, allow through (fail open)
      return { success: true };
    }
  }

  /**
   * Validate guest data array
   */
  private static validateGuestData(guests: GuestImportInput[]): {
    success: boolean;
    validGuests?: GuestImportInput[];
    errors?: string[];
  } {
    const errors: string[] = [];
    const validGuests: GuestImportInput[] = [];

    if (guests.length === 0) {
      return {
        success: false,
        errors: ['No guests provided for import']
      };
    }

    if (guests.length > 500) {
      return {
        success: false,
        errors: ['Too many guests. Maximum 500 guests per import.']
      };
    }

    guests.forEach((guest, index) => {
      // Validate required fields
      if (!guest.guest_name?.trim()) {
        errors.push(`Row ${index + 1}: Guest name is required`);
        return;
      }

      if (!guest.phone?.trim()) {
        errors.push(`Row ${index + 1}: Phone number is required`);
        return;
      }

      // Validate phone format (basic)
      const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
      const cleanPhone = guest.phone.replace(/[\s\-\(\)]/g, '');
      if (!phoneRegex.test(cleanPhone)) {
        errors.push(`Row ${index + 1}: Invalid phone number format`);
        return;
      }

      // Validate email if provided
      if (guest.guest_email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(guest.guest_email)) {
          errors.push(`Row ${index + 1}: Invalid email format`);
          return;
        }
      }

      // Validate role
      if (guest.role && !['guest', 'host', 'admin'].includes(guest.role)) {
        errors.push(`Row ${index + 1}: Role must be 'guest', 'host', or 'admin'`);
        return;
      }

      // Validate guest tags (database constraint: max 10 tags)
      if (guest.guest_tags && guest.guest_tags.length > 10) {
        errors.push(`Row ${index + 1}: Maximum 10 tags allowed per guest`);
        return;
      }

      validGuests.push({
        ...guest,
        guest_name: guest.guest_name.trim(),
        phone: cleanPhone,
        guest_email: guest.guest_email?.trim() || undefined,
        role: guest.role || 'guest',
        notes: guest.notes?.trim() || undefined
      });
    });

    return {
      success: errors.length === 0,
      validGuests: errors.length === 0 ? validGuests : undefined,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Perform batch guest import with error tracking and immediate user linking
   */
  private static async performBatchGuestImport(
    eventId: string,
    guests: GuestImportInput[],
    operationId: string
  ): Promise<{
    imported_count: number;
    failed_count: number;
    failed_rows: GuestImportError[];
    successfully_imported: Array<{ phone: string; guest_name?: string }>;
  }> {
    let imported_count = 0;
    let failed_count = 0;
    const failed_rows: GuestImportError[] = [];
    const successfully_imported: Array<{ phone: string; guest_name?: string }> = [];

    // Process guests individually using canonical add_or_restore_guest RPC
    // This handles duplicates, restores removed guests, and preserves history
    for (let i = 0; i < guests.length; i++) {
      const guest = guests[i];
      
      try {
        // Use canonical add_or_restore_guest RPC
        const { data: result, error } = await supabase
          .rpc('add_or_restore_guest', {
            p_event_id: eventId,
            p_phone: guest.phone || '',
            p_name: guest.guest_name || undefined,
            p_email: guest.guest_email || undefined,
            p_role: guest.role || 'guest'
          });

        if (error) {
          failed_count++;
          failed_rows.push({
            row_index: i,
            guest_data: guest,
            error_code: error.code || 'RPC_ERROR',
            error_message: error.message || 'Unknown error during guest creation'
          });
          continue;
        }

        const resultData = result as { 
          success: boolean; 
          guest_id: string; 
          operation: 'restored' | 'updated' | 'inserted';
          event_id: string;
          phone: string;
          name: string;
          email: string;
          role: string;
        };
        
        if (!result || !resultData.guest_id) {
          failed_count++;
          failed_rows.push({
            row_index: i,
            guest_data: guest,
            error_code: 'INVALID_RESULT',
            error_message: 'Invalid result from add_or_restore_guest'
          });
          continue;
        }

        // Success - RPC returns operation details
        imported_count++;
        successfully_imported.push({
          phone: guest.phone,
          guest_name: guest.guest_name
        });

        logger.info('Guest added/restored successfully', {
          operationId,
          guestIndex: i + 1,
          phone: guest.phone,
          operation: resultData.operation, // 'created', 'restored', or 'updated'
          guestId: resultData.guest_id
        });

      } catch (guestError) {
        // Handle unexpected error for individual guest
        failed_count++;
        failed_rows.push({
          row_index: i,
          guest_data: guest,
          error_code: 'UNEXPECTED_ERROR',
          error_message: `Unexpected error: ${guestError instanceof Error ? guestError.message : 'Unknown error'}`
        });
      }

      // Add small delay between individual calls to prevent overwhelming
      if (i < guests.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    logger.info('Canonical guest import completed', {
      operationId,
      eventId,
      totalGuests: guests.length,
      imported_count,
      failed_count
    });

    return {
      imported_count,
      failed_count,
      failed_rows,
      successfully_imported
    };
  }

  /**
   * Map guest insert errors to user-friendly messages
   */
  private static mapGuestInsertError(error: { code?: string; message?: string }): string {
    switch (error.code) {
      case '23505':
        return 'A guest with this phone number already exists for this event';
      case '23503':
        return 'Invalid event reference';
      case '23514':
        return 'Invalid guest data format';
      default:
        return `Failed to add guest: ${error.message || 'Unknown error'}`;
    }
  }
}