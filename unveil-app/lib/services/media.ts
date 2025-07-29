import { supabase } from '@/lib/supabase/client';

// Upload event media
export async function uploadEventMedia(eventId: string, file: File, userId: string) {
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
        }
      }
    };
  } catch (error) {
    console.error('Error uploading media:', error);
    return { success: false, error };
  }
}

// Send message (for query hooks)
export async function sendMessage(messageData: { eventId: string; content: string; messageType?: string }) {
  try {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        event_id: messageData.eventId,
        content: messageData.content,
        message_type: (messageData.messageType || 'direct') as 'direct' | 'announcement' | 'channel',
        sender_user_id: (await supabase.auth.getUser()).data.user?.id,
      })
      .select()
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Error sending message:', error);
    return { success: false, error };
  }
} 