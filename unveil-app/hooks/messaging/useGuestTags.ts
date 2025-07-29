import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Guest, TagWithUsage } from '@/lib/types/messaging';

export function useGuestTags(eventId: string) {
  const [tags, setTags] = useState<string[]>([]);
  const [tagStats, setTagStats] = useState<TagWithUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;

    async function fetchGuestTags() {
      try {
        setLoading(true);

        // Fetch all guests with their tags
        const { data: guests, error: guestsError } = await supabase
          .from('event_guests')
          .select(`
            *,
            users(*)
          `)
          .eq('event_id', eventId);

        if (guestsError) throw guestsError;

        // Extract and count tags
        const tagMap = new Map<string, Guest[]>();
        const allTags = new Set<string>();

        guests?.forEach((guest) => {
          const guestTags = guest.guest_tags || [];
          guestTags.forEach((tag) => {
            allTags.add(tag);
            if (!tagMap.has(tag)) {
              tagMap.set(tag, []);
            }
            tagMap.get(tag)?.push(guest as Guest);
          });
        });

        const tagStatsData: TagWithUsage[] = Array.from(tagMap.entries()).map(([tag, guestList]) => ({
          tag,
          guestCount: guestList.length,
          guests: guestList,
        }));

        setTags(Array.from(allTags));
        setTagStats(tagStatsData);
      } catch (err) {
        console.error('Error fetching guest tags:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch guest tags');
      } finally {
        setLoading(false);
      }
    }

    fetchGuestTags();
  }, [eventId]);

  const getGuestsByTags = (selectedTags: string[]): Guest[] => {
    if (selectedTags.length === 0) return [];

    return tagStats
      .filter(stat => selectedTags.includes(stat.tag))
      .flatMap(stat => stat.guests)
      .filter((guest, index, array) => 
        array.findIndex(g => g.id === guest.id) === index
      );
  };

  const addTagToGuests = async (guestIds: string[], tag: string) => {
    try {
      for (const guestId of guestIds) {
        const { data: guest } = await supabase
          .from('event_guests')
          .select('guest_tags')
          .eq('id', guestId)
          .single();

        if (guest) {
          const currentTags = guest.guest_tags || [];
          if (!currentTags.includes(tag)) {
            await supabase
              .from('event_guests')
              .update({
                guest_tags: [...currentTags, tag]
              })
              .eq('id', guestId);
          }
        }
      }
    } catch (err) {
      console.error('Error adding tag to guests:', err);
      setError(err instanceof Error ? err.message : 'Failed to add tag');
    }
  };

  const removeTagFromGuests = async (guestIds: string[], tag: string) => {
    try {
      for (const guestId of guestIds) {
        const { data: guest } = await supabase
          .from('event_guests')
          .select('guest_tags')
          .eq('id', guestId)
          .single();

        if (guest) {
          const currentTags = guest.guest_tags || [];
          await supabase
            .from('event_guests')
            .update({
              guest_tags: currentTags.filter(t => t !== tag)
            })
            .eq('id', guestId);
        }
      }
    } catch (err) {
      console.error('Error removing tag from guests:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove tag');
    }
  };

  // Additional functions expected by components
  const createTag = async (tagName: string) => {
    // Implementation would create a new tag
    console.log('Create tag:', tagName);
  };

  const updateTag = async (oldTag: string, newTag: string) => {
    // Implementation would rename a tag
    console.log('Update tag:', oldTag, 'to', newTag);
  };

  const deleteTag = async (tagName: string) => {
    // Implementation would delete a tag
    console.log('Delete tag:', tagName);
  };

  const assignTagsToGuests = async (guestIds: string[], tagNames: string[]) => {
    // Implementation would assign multiple tags to multiple guests
    console.log('Assign tags:', tagNames, 'to guests:', guestIds);
  };

  const refresh = () => {
    // Refresh implementation
    console.log('Refresh guest tags');
  };

  // Get all guests for components that need them
  const guests = tagStats.flatMap(stat => stat.guests);

  return {
    tags,
    tagStats,
    guests,
    loading,
    error,
    getGuestsByTags,
    addTagToGuests,
    removeTagFromGuests,
    createTag,
    updateTag,
    deleteTag,
    assignTagsToGuests,
    refresh,
  };
} 