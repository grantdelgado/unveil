# 🗄️ Supabase Storage Bucket Setup Guide

## Overview

The Unveil app requires a storage bucket named `event-media` for photo and video uploads. This must be created manually in the Supabase Dashboard due to RLS security constraints.

## Step-by-Step Setup Instructions

### 1. Access Supabase Dashboard

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to project: `unveil-app` (ID: `wvhtbqvnamerdkkjknuv`)
3. Click on **Storage** in the left sidebar

### 2. Create Storage Bucket

1. Click **New bucket** button
2. Configure bucket settings:
   - **Name:** `event-media`
   - **Public bucket:** ✅ **Enable** (required for guest access)
   - **File size limit:** `52428800` (50MB in bytes)
   - **Allowed MIME types:**
     ```
     image/jpeg
     image/png
     image/webp
     image/gif
     video/mp4
     video/mov
     video/avi
     video/quicktime
     ```

### 3. Configure Bucket Policies

The bucket should automatically inherit RLS policies, but verify these settings:

#### Storage Policies Required:

1. **SELECT (read):** Allow authenticated users to read files from events they participate in
2. **INSERT (upload):** Allow authenticated users to upload files to events they participate in
3. **DELETE:** Allow users to delete their own uploads

#### Example RLS Policy (should be auto-applied):

```sql
-- Allow participants to read media from their events
CREATE POLICY "event_media_select" ON storage.objects
FOR SELECT USING (
  bucket_id = 'event-media'
  AND EXISTS (
    SELECT 1 FROM event_participants ep
    JOIN media m ON m.event_id = ep.event_id
    WHERE m.storage_path = (storage.foldername(name) || '/' || storage.filename(name))
    AND ep.user_id = auth.uid()
  )
);

-- Allow participants to insert media to their events
CREATE POLICY "event_media_insert" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'event-media'
  AND EXISTS (
    SELECT 1 FROM event_participants ep
    WHERE ep.event_id::text = storage.foldername(name)
    AND ep.user_id = auth.uid()
  )
);
```

### 4. Test Bucket Configuration

#### Manual Test:

1. Go to **Storage > event-media** bucket
2. Try uploading a test image (should succeed)
3. Verify the file appears in the bucket list
4. Test public URL access

#### Automated Test:

Run our verification script:

```bash
npx tsx scripts/verify-storage-setup.ts
```

## Folder Structure

The bucket will automatically organize files by event:

```
event-media/
├── [event-id-1]/
│   ├── image-1.jpg
│   ├── video-1.mp4
│   └── ...
├── [event-id-2]/
│   ├── image-2.png
│   └── ...
```

## Security Considerations

- ✅ **Public read access:** Required for image gallery display
- ✅ **RLS enforcement:** Only event participants can upload/view
- ✅ **File validation:** MIME types and size limits enforced
- ✅ **Path restrictions:** Files organized by event ID

## Troubleshooting

### Common Issues:

1. **"Bucket not found" error:** Verify bucket name is exactly `event-media`
2. **Upload fails:** Check MIME type restrictions and file size
3. **Access denied:** Verify user is authenticated and participant in event
4. **Public URL 404:** Ensure bucket is marked as public

### Verification Commands:

```bash
# Test bucket exists and is accessible
npx tsx scripts/verify-storage-setup.ts

# Test upload functionality
npm run dev
# Navigate to event page > media section > try upload
```

## Success Criteria

- ✅ Bucket `event-media` exists and is public
- ✅ MIME types configured for images and videos
- ✅ 50MB file size limit enforced
- ✅ RLS policies protect user data
- ✅ PhotoUpload component works end-to-end
- ✅ Images display correctly in gallery

## Next Steps

Once bucket is configured:

1. Run verification script to confirm setup
2. Test PhotoUpload component with real files
3. Verify gallery display with uploaded images
4. Mark task as complete in `reference/MVP-ProjectPlan.md`
