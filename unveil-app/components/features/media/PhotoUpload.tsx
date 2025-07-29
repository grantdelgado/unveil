'use client';

import { useState, useCallback, useRef } from 'react';
import { Camera, Upload, X, Image as ImageIcon, Video } from 'lucide-react';
import Image from 'next/image';
// Note: Media upload functionality now uses domain hooks
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils/cn';
import { uploadEventMedia } from '@/lib/services/media';

interface PhotoUploadProps {
  eventId: string;
  userId: string;
  onUploadComplete?: (mediaId: string) => void;
  onUploadError?: (error: string) => void;
  className?: string;
  maxFiles?: number;
  disabled?: boolean;
  acceptVideo?: boolean;
}

interface UploadProgress {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  error?: string;
  preview?: string;
  type: 'image' | 'video';
}

export default function PhotoUpload({
  eventId,
  userId,
  onUploadComplete,
  onUploadError,
  className,
  maxFiles = 5,
  disabled = false,
  acceptVideo = true,
}: PhotoUploadProps) {
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Detect if we're on mobile
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // Compress image before upload
  const compressImage = useCallback((file: File): Promise<File> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new window.Image();

      img.onload = () => {
        // Calculate new dimensions (max 1920px width)
        const maxWidth = 1920;
        const maxHeight = 1080;
        let { width, height } = img;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }

        canvas.width = width;
        canvas.height = height;

        // Draw and compress
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          0.8, // 80% quality
        );
      };

      img.src = URL.createObjectURL(file);
    });
  }, []);

  // Create preview URL for file
  const createPreview = useCallback((file: File): string => {
    return URL.createObjectURL(file);
  }, []);

  // Handle file selection
  const handleFiles = useCallback(
    async (files: FileList) => {
      if (disabled) return;

      const fileArray = Array.from(files);
      const validFiles = fileArray.filter((file) => {
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        const isValidSize = file.size <= 50 * 1024 * 1024; // 50MB limit

        if (!isImage && !isVideo) {
          onUploadError?.('Please select only image or video files');
          return false;
        }
        if (!isValidSize) {
          onUploadError?.('File size must be less than 50MB');
          return false;
        }
        if (isVideo && !acceptVideo) {
          onUploadError?.('Video uploads are not allowed');
          return false;
        }
        return true;
      });

      if (validFiles.length === 0) return;

      // Check max files limit
      const currentUploads = uploads.filter(
        (upload) => upload.status !== 'complete',
      ).length;
      const filesToProcess = validFiles.slice(0, maxFiles - currentUploads);

      if (filesToProcess.length < validFiles.length) {
        onUploadError?.(`Only uploading first ${filesToProcess.length} files (limit: ${maxFiles})`);
      }

      // Initialize upload progress for each file
      const newUploads: UploadProgress[] = filesToProcess.map((file) => ({
        file,
        progress: 0,
        status: 'pending',
        preview: createPreview(file),
        type: file.type.startsWith('video/') ? 'video' : 'image',
      }));

      setUploads((prev) => [...prev, ...newUploads]);

      // Process uploads
      for (let i = 0; i < filesToProcess.length; i++) {
        const file = filesToProcess[i];
        const uploadIndex = uploads.length + i;

        try {
          // Update status to uploading
          setUploads((prev) =>
            prev.map((upload, idx) =>
              idx === uploadIndex
                ? { ...upload, status: 'uploading', progress: 10 }
                : upload,
            ),
          );

          // Compress if image
          let processedFile = file;
          if (file.type.startsWith('image/')) {
            processedFile = await compressImage(file);
            setUploads((prev) =>
              prev.map((upload, idx) =>
                idx === uploadIndex
                  ? { ...upload, progress: 30 }
                  : upload,
              ),
            );
          }

          // Upload to Supabase
          const result = await uploadEventMedia(eventId, processedFile, userId);

          if (result.error) {
            throw new Error(result.error instanceof Error ? result.error.message : 'Upload failed');
          }

          // Update progress to complete
          setUploads((prev) =>
            prev.map((upload, idx) =>
              idx === uploadIndex
                ? { ...upload, status: 'complete', progress: 100 }
                : upload,
            ),
          );

          onUploadComplete?.(result.data?.mediaRecord?.id || '');
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Upload failed';

          setUploads((prev) =>
            prev.map((upload, idx) =>
              idx === uploadIndex
                ? { ...upload, status: 'error', error: errorMessage }
                : upload,
            ),
          );

          onUploadError?.(errorMessage);
        }
      }
    },
    [
      disabled,
      maxFiles,
      acceptVideo,
      onUploadError,
      createPreview,
      compressImage,
      eventId,
      userId,
      onUploadComplete,
      uploads,
    ],
  );

  // Handle camera capture
  const handleCameraCapture = useCallback(() => {
    if (disabled || !cameraInputRef.current) return;
    
    cameraInputRef.current.click();
  }, [disabled]);

  // Handle file picker
  const handleFilePicker = useCallback(() => {
    if (disabled || !fileInputRef.current) return;
    
    fileInputRef.current.click();
  }, [disabled]);

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragOver(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      
      if (disabled) return;

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFiles(files);
      }
    },
    [disabled, handleFiles],
  );

  // Remove upload
  const removeUpload = useCallback((index: number) => {
    setUploads((prev) => {
      const newUploads = [...prev];
      const upload = newUploads[index];
      
      // Revoke preview URL to prevent memory leaks
      if (upload.preview) {
        URL.revokeObjectURL(upload.preview);
      }
      
      newUploads.splice(index, 1);
      return newUploads;
    });
  }, []);

  // Calculate upload stats
  const activeUploads = uploads.filter(upload => upload.status !== 'complete').length;
  const canUploadMore = activeUploads < maxFiles;
  const hasActiveUploads = uploads.some(upload => upload.status === 'uploading');

  return (
    <div className={cn('space-y-4', className)}>
      {/* Upload Area */}
      <div
        className={cn(
          'relative border-2 border-dashed rounded-lg transition-all duration-200',
          'min-h-[120px] md:min-h-[160px]', // Smaller on mobile
          isDragOver && !disabled
            ? 'border-pink-400 bg-pink-50'
            : 'border-gray-300 hover:border-gray-400',
          disabled && 'opacity-50 cursor-not-allowed',
          !disabled && 'cursor-pointer',
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={isMobile ? undefined : handleFilePicker}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
          <div className="space-y-4">
            {/* Icon */}
            <div className="mx-auto w-12 h-12 text-gray-400">
              <ImageIcon className="w-full h-full" />
            </div>

            {/* Text Content */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-900">
                {isMobile ? 'Add photos & videos' : 'Drop photos & videos here'}
              </p>
              <p className="text-xs text-gray-500">
                {acceptVideo ? 'PNG, JPG, MP4 up to 50MB' : 'PNG, JPG up to 50MB'}
              </p>
            </div>

            {/* Mobile-optimized buttons */}
            {isMobile && canUploadMore && (
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCameraCapture();
                  }}
                  disabled={disabled}
                  className="flex items-center gap-2 min-h-[44px] px-4"
                >
                  <Camera className="w-4 h-4" />
                  Camera
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFilePicker();
                  }}
                  disabled={disabled}
                  className="flex items-center gap-2 min-h-[44px] px-4"
                >
                  <Upload className="w-4 h-4" />
                  Upload
                </Button>
              </div>
            )}

            {/* Desktop upload button */}
            {!isMobile && canUploadMore && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleFilePicker();
                }}
                disabled={disabled}
                className="flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Choose Files
              </Button>
            )}

            {!canUploadMore && (
              <p className="text-xs text-amber-600 font-medium">
                Maximum {maxFiles} files reached
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={acceptVideo ? "image/*,video/*" : "image/*"}
        className="hidden"
        onChange={(e) => {
          if (e.target.files) {
            handleFiles(e.target.files);
          }
        }}
        disabled={disabled}
      />

      {/* Camera input for mobile */}
      <input
        ref={cameraInputRef}
        type="file"
        accept={acceptVideo ? "image/*,video/*" : "image/*"}
        capture="environment" // Use rear camera by default
        className="hidden"
        onChange={(e) => {
          if (e.target.files) {
            handleFiles(e.target.files);
          }
        }}
        disabled={disabled}
      />

      {/* Upload Progress List */}
      {uploads.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-900">
            {hasActiveUploads ? 'Uploading...' : 'Recent Uploads'}
          </h4>
          
          <div className="space-y-2">
            {uploads.map((upload, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
              >
                {/* Preview thumbnail */}
                <div className="relative w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-gray-200">
                  {upload.preview && (
                    <>
                      {upload.type === 'video' ? (
                        <div className="w-full h-full flex items-center justify-center">
                          <Video className="w-6 h-6 text-gray-500" />
                        </div>
                      ) : (
                        <Image
                          src={upload.preview}
                          alt="Preview"
                          fill
                          className="object-cover"
                        />
                      )}
                    </>
                  )}
                </div>

                {/* Upload info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {upload.file.name}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1">
                      {upload.status === 'uploading' && (
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div
                            className="bg-pink-500 h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${upload.progress}%` }}
                          />
                        </div>
                      )}
                      {upload.status === 'complete' && (
                        <p className="text-xs text-green-600 font-medium">
                          ✓ Uploaded
                        </p>
                      )}
                      {upload.status === 'error' && (
                        <p className="text-xs text-red-600 font-medium">
                          ✗ {upload.error || 'Upload failed'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Remove button */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeUpload(index)}
                  className="p-1 w-8 h-8 flex-shrink-0"
                  disabled={upload.status === 'uploading'}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 