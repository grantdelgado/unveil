'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import Image from 'next/image';
import { MicroCopy } from '@/components/ui';
import { cn } from '@/lib/utils';

interface EventImageStepProps {
  headerImage: File | null;
  imagePreview: string;
  onImageChange: (file: File | null) => void;
  onPreviewChange: (preview: string) => void;
  error?: string;
  disabled: boolean;
}

export function EventImageStep({
  headerImage,
  imagePreview,
  onImageChange,
  onPreviewChange,
  error,
  disabled,
}: EventImageStepProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file) {
        onImageChange(file);

        // Create preview URL
        const reader = new FileReader();
        reader.onload = () => {
          onPreviewChange(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
    },
    [onImageChange, onPreviewChange],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: false,
    disabled,
  });

  const removeImage = useCallback(() => {
    onImageChange(null);
    onPreviewChange('');
  }, [onImageChange, onPreviewChange]);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <MicroCopy className="text-base">
          Add a beautiful header image to make your wedding hub memorable
          (optional)
        </MicroCopy>
      </div>

      {!imagePreview ? (
        <div
          {...getRootProps()}
          className={cn(
            'w-full p-8 border-2 border-dashed rounded-lg transition-colors cursor-pointer min-h-[200px] flex items-center justify-center',
            isDragActive
              ? 'border-pink-400 bg-pink-50'
              : 'border-gray-300 hover:border-pink-300 hover:bg-gray-50',
            error && 'border-red-300 bg-red-50',
            disabled && 'cursor-not-allowed opacity-50',
          )}
        >
          <input {...getInputProps()} />
          <div className="text-center space-y-4">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div>
              <p className="text-lg font-medium text-gray-700">
                {isDragActive
                  ? 'Drop your image here'
                  : 'Upload a beautiful header image'}
              </p>
              <MicroCopy className="mt-2">
                Drag & drop or click to browse • PNG, JPG up to 10MB
              </MicroCopy>
            </div>

            {/* Mobile-friendly upload button */}
            <div className="sm:hidden">
              <div className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 min-h-[44px]">
                📷 Choose Photo
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative">
          <div className="relative w-full h-64 rounded-lg overflow-hidden">
            <Image
              src={imagePreview}
              alt="Event header preview"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          </div>
          <button
            type="button"
            onClick={removeImage}
            disabled={disabled}
            className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors shadow-lg min-h-[44px] min-w-[44px] flex items-center justify-center disabled:opacity-50"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          {/* Image info */}
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>{headerImage?.name}</span>
              <span>
                {headerImage
                  ? (headerImage.size / (1024 * 1024)).toFixed(1)
                  : 0}
                MB
              </span>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* Skip option */}
      <div className="text-center">
        <MicroCopy>
          You can always add or change your header image later in your event
          settings
        </MicroCopy>
      </div>
    </div>
  );
}
