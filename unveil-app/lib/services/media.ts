import { supabase } from '@/lib/supabase/client';

// Upload event media
export async function uploadEventMedia(
  eventId: string,
  file: File,
  userId: string,
) {
  try {
    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${eventId}/${userId}/${Date.now()}.${fileExt}`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('event-media')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('event-media')
      .getPublicUrl(fileName);

    // Create media record
    const { data: mediaRecord, error: mediaError } = await supabase
      .from('media')
      .insert({
        event_id: eventId,
        storage_path: fileName,
        media_type: file.type.startsWith('image/') ? 'image' : 'video',
        uploader_user_id: userId,
      })
      .select()
      .single();

    if (mediaError) throw mediaError;

    return {
      success: true,
      data: {
        mediaRecord: {
          ...mediaRecord,
          url: urlData.publicUrl,
        },
      },
    };
  } catch (error) {
    console.error('Error uploading media:', error);
    return { success: false, error };
  }
}

// Note: Message sending functionality moved to lib/services/messaging.ts
// Use sendMessageToEvent() from messaging service for all message operations
