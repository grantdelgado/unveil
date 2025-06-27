import { supabase } from '@/lib/supabase';
import type { Tables } from '@/app/reference/supabase.types';

type EventGuest = Tables<'event_guests'>;

export interface TagStats {
  tag: string;
  guestCount: number;
  lastUsed?: Date;
}

export interface TagAssignmentResult {
  success: boolean;
  assignedCount: number;
  errors?: string[];
}

export interface BulkTagAssignment {
  guestIds: string[];
  tagsToAdd: string[];
  tagsToRemove?: string[];
}

/**
 * Get all tags for an event with usage statistics
 */
export async function getEventTags(eventId: string): Promise<TagStats[]> {
  try {
    // Get all guests for the event with their tags
    const { data: guests, error } = await supabase
      .from('event_guests')
      .select('guest_tags')
      .eq('event_id', eventId)
      .not('guest_tags', 'is', null);

    if (error) {
      throw new Error(`Failed to fetch event guests: ${error.message}`);
    }

    // Count tag usage
    const tagCounts = new Map<string, number>();
    
    guests?.forEach(guest => {
      if (guest.guest_tags) {
        guest.guest_tags.forEach(tag => {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        });
      }
    });

    // Convert to TagStats array
    return Array.from(tagCounts.entries())
      .map(([tag, guestCount]) => ({
        tag,
        guestCount
      }))
      .sort((a, b) => b.guestCount - a.guestCount);

  } catch (error) {
    console.error('Error fetching event tags:', error);
    throw error;
  }
}

/**
 * Get guests for an event with their tags
 */
export async function getEventGuests(eventId: string): Promise<EventGuest[]> {
  try {
    const { data: guests, error } = await supabase
      .from('event_guests')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch event guests: ${error.message}`);
    }

    return guests || [];

  } catch (error) {
    console.error('Error fetching event guests:', error);
    throw error;
  }
}

/**
 * Create a new tag and optionally assign it to guests
 */
export async function createTag(
  eventId: string, 
  tagName: string, 
  initialGuestIds?: string[]
): Promise<TagStats> {
  try {
    // Validate tag name
    const trimmedTag = tagName.trim().toLowerCase();
    if (!trimmedTag) {
      throw new Error('Tag name cannot be empty');
    }
    
    if (trimmedTag.length > 20) {
      throw new Error('Tag name cannot exceed 20 characters');
    }
    
    if (!/^[a-zA-Z0-9\s-_]+$/.test(trimmedTag)) {
      throw new Error('Tag name can only contain letters, numbers, spaces, hyphens, and underscores');
    }

    // Check if tag already exists
    const existingTags = await getEventTags(eventId);
    if (existingTags.some(tag => tag.tag === trimmedTag)) {
      throw new Error('Tag already exists');
    }

    let guestCount = 0;

    // If initial guests are provided, assign the tag to them
    if (initialGuestIds && initialGuestIds.length > 0) {
      const result = await assignTagsToGuests(eventId, initialGuestIds, [trimmedTag]);
      guestCount = result.assignedCount;
    }

    return {
      tag: trimmedTag,
      guestCount
    };

  } catch (error) {
    console.error('Error creating tag:', error);
    throw error;
  }
}

/**
 * Update/rename a tag across all guests
 */
export async function updateTag(
  eventId: string, 
  oldTagName: string, 
  newTagName: string
): Promise<TagStats> {
  try {
    const trimmedNewTag = newTagName.trim().toLowerCase();
    const trimmedOldTag = oldTagName.trim().toLowerCase();
    
    // Validate new tag name
    if (!trimmedNewTag) {
      throw new Error('Tag name cannot be empty');
    }
    
    if (trimmedNewTag.length > 20) {
      throw new Error('Tag name cannot exceed 20 characters');
    }
    
    if (!/^[a-zA-Z0-9\s-_]+$/.test(trimmedNewTag)) {
      throw new Error('Tag name can only contain letters, numbers, spaces, hyphens, and underscores');
    }

    // Check if new tag name already exists (and is different from old)
    if (trimmedNewTag !== trimmedOldTag) {
      const existingTags = await getEventTags(eventId);
      if (existingTags.some(tag => tag.tag === trimmedNewTag)) {
        throw new Error('A tag with this name already exists');
      }
    }

    // Get all guests with the old tag
    const { data: guests, error: fetchError } = await supabase
      .from('event_guests')
      .select('id, guest_tags')
      .eq('event_id', eventId)
      .contains('guest_tags', [trimmedOldTag]);

    if (fetchError) {
      throw new Error(`Failed to fetch guests with tag: ${fetchError.message}`);
    }

    if (!guests || guests.length === 0) {
      throw new Error('No guests found with this tag');
    }

    // Update each guest's tags array
    const updatePromises = guests.map(async (guest) => {
      if (!guest.guest_tags) return;
      
      const updatedTags = guest.guest_tags.map(tag => 
        tag === trimmedOldTag ? trimmedNewTag : tag
      );

      const { error } = await supabase
        .from('event_guests')
        .update({ guest_tags: updatedTags })
        .eq('id', guest.id);

      if (error) {
        throw new Error(`Failed to update guest ${guest.id}: ${error.message}`);
      }
    });

    await Promise.all(updatePromises);

    return {
      tag: trimmedNewTag,
      guestCount: guests.length
    };

  } catch (error) {
    console.error('Error updating tag:', error);
    throw error;
  }
}

/**
 * Delete a tag from all guests
 */
export async function deleteTag(eventId: string, tagName: string): Promise<void> {
  try {
    const trimmedTag = tagName.trim().toLowerCase();

    // Get all guests with this tag
    const { data: guests, error: fetchError } = await supabase
      .from('event_guests')
      .select('id, guest_tags')
      .eq('event_id', eventId)
      .contains('guest_tags', [trimmedTag]);

    if (fetchError) {
      throw new Error(`Failed to fetch guests with tag: ${fetchError.message}`);
    }

    if (!guests || guests.length === 0) {
      // Tag doesn't exist or no guests have it
      return;
    }

    // Remove tag from each guest's tags array
    const updatePromises = guests.map(async (guest) => {
      if (!guest.guest_tags) return;
      
      const updatedTags = guest.guest_tags.filter(tag => tag !== trimmedTag);

      const { error } = await supabase
        .from('event_guests')
        .update({ guest_tags: updatedTags })
        .eq('id', guest.id);

      if (error) {
        throw new Error(`Failed to update guest ${guest.id}: ${error.message}`);
      }
    });

    await Promise.all(updatePromises);

  } catch (error) {
    console.error('Error deleting tag:', error);
    throw error;
  }
}

/**
 * Assign tags to multiple guests
 */
export async function assignTagsToGuests(
  eventId: string,
  guestIds: string[],
  tags: string[]
): Promise<TagAssignmentResult> {
  try {
    if (guestIds.length === 0 || tags.length === 0) {
      throw new Error('Guest IDs and tags are required');
    }

    // Normalize tag names
    const normalizedTags = tags.map(tag => tag.trim().toLowerCase());
    
    // Validate tags
    for (const tag of normalizedTags) {
      if (!tag) continue;
      if (tag.length > 20) {
        throw new Error(`Tag "${tag}" exceeds 20 character limit`);
      }
      if (!/^[a-zA-Z0-9\s-_]+$/.test(tag)) {
        throw new Error(`Tag "${tag}" contains invalid characters`);
      }
    }

    // Get existing guest data
    const { data: guests, error: fetchError } = await supabase
      .from('event_guests')
      .select('id, guest_tags')
      .eq('event_id', eventId)
      .in('id', guestIds);

    if (fetchError) {
      throw new Error(`Failed to fetch guests: ${fetchError.message}`);
    }

    if (!guests || guests.length === 0) {
      throw new Error('No valid guests found');
    }

    let assignedCount = 0;
    const errors: string[] = [];

    // Update each guest's tags
    const updatePromises = guests.map(async (guest) => {
      try {
        const existingTags = guest.guest_tags || [];
        const newTags = [...new Set([...existingTags, ...normalizedTags])]; // Merge and dedupe

        const { error } = await supabase
          .from('event_guests')
          .update({ guest_tags: newTags })
          .eq('id', guest.id);

        if (error) {
          errors.push(`Failed to update guest ${guest.id}: ${error.message}`);
        } else {
          assignedCount++;
        }
      } catch (err) {
        errors.push(`Error processing guest ${guest.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    });

    await Promise.all(updatePromises);

    return {
      success: errors.length === 0,
      assignedCount,
      errors: errors.length > 0 ? errors : undefined
    };

  } catch (error) {
    console.error('Error assigning tags to guests:', error);
    throw error;
  }
}

/**
 * Remove tags from multiple guests
 */
export async function removeTagsFromGuests(
  eventId: string,
  guestIds: string[],
  tags: string[]
): Promise<TagAssignmentResult> {
  try {
    if (guestIds.length === 0 || tags.length === 0) {
      throw new Error('Guest IDs and tags are required');
    }

    // Normalize tag names
    const normalizedTags = tags.map(tag => tag.trim().toLowerCase());

    // Get existing guest data
    const { data: guests, error: fetchError } = await supabase
      .from('event_guests')
      .select('id, guest_tags')
      .eq('event_id', eventId)
      .in('id', guestIds);

    if (fetchError) {
      throw new Error(`Failed to fetch guests: ${fetchError.message}`);
    }

    if (!guests || guests.length === 0) {
      throw new Error('No valid guests found');
    }

    let assignedCount = 0;
    const errors: string[] = [];

    // Update each guest's tags
    const updatePromises = guests.map(async (guest) => {
      try {
        const existingTags = guest.guest_tags || [];
        const newTags = existingTags.filter(tag => !normalizedTags.includes(tag));

        const { error } = await supabase
          .from('event_guests')
          .update({ guest_tags: newTags })
          .eq('id', guest.id);

        if (error) {
          errors.push(`Failed to update guest ${guest.id}: ${error.message}`);
        } else {
          assignedCount++;
        }
      } catch (err) {
        errors.push(`Error processing guest ${guest.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    });

    await Promise.all(updatePromises);

    return {
      success: errors.length === 0,
      assignedCount,
      errors: errors.length > 0 ? errors : undefined
    };

  } catch (error) {
    console.error('Error removing tags from guests:', error);
    throw error;
  }
}

/**
 * Get guests by tag(s) for an event
 */
export async function getGuestsByTags(
  eventId: string,
  tags: string[],
  requireAllTags = false
): Promise<EventGuest[]> {
  try {
    if (tags.length === 0) {
      return [];
    }

    const normalizedTags = tags.map(tag => tag.trim().toLowerCase());

    if (requireAllTags) {
      // Get guests that have ALL specified tags
      const { data: guests, error } = await supabase
        .from('event_guests')
        .select('*')
        .eq('event_id', eventId)
        .contains('guest_tags', normalizedTags);

      if (error) {
        throw new Error(`Failed to fetch guests by tags: ${error.message}`);
      }

      return guests || [];
    } else {
      // Get guests that have ANY of the specified tags
      const { data: guests, error } = await supabase
        .from('event_guests')
        .select('*')
        .eq('event_id', eventId)
        .not('guest_tags', 'is', null);

      if (error) {
        throw new Error(`Failed to fetch guests: ${error.message}`);
      }

      if (!guests) return [];

      // Filter guests that have at least one of the specified tags
      return guests.filter(guest => {
        if (!guest.guest_tags) return false;
        return guest.guest_tags.some(tag => normalizedTags.includes(tag));
      });
    }

  } catch (error) {
    console.error('Error fetching guests by tags:', error);
    throw error;
  }
}

/**
 * Bulk tag operations
 */
export async function bulkTagOperation(
  eventId: string,
  operation: BulkTagAssignment
): Promise<TagAssignmentResult> {
  try {
    const { guestIds, tagsToAdd, tagsToRemove } = operation;
    
    if (guestIds.length === 0) {
      throw new Error('No guests specified');
    }

    let totalAssigned = 0;
    const allErrors: string[] = [];

    // Add tags if specified
    if (tagsToAdd && tagsToAdd.length > 0) {
      const addResult = await assignTagsToGuests(eventId, guestIds, tagsToAdd);
      totalAssigned += addResult.assignedCount;
      if (addResult.errors) {
        allErrors.push(...addResult.errors.map(err => `Add operation: ${err}`));
      }
    }

    // Remove tags if specified
    if (tagsToRemove && tagsToRemove.length > 0) {
      const removeResult = await removeTagsFromGuests(eventId, guestIds, tagsToRemove);
      if (removeResult.errors) {
        allErrors.push(...removeResult.errors.map(err => `Remove operation: ${err}`));
      }
    }

    return {
      success: allErrors.length === 0,
      assignedCount: totalAssigned,
      errors: allErrors.length > 0 ? allErrors : undefined
    };

  } catch (error) {
    console.error('Error in bulk tag operation:', error);
    throw error;
  }
}