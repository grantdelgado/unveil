'use client';

import React, { useCallback } from 'react';
import { useDropzone, type FileRejection } from 'react-dropzone';
import { cn } from '@/lib/utils';
import { validateImportFile } from '@/lib/guest-import';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  onError: (error: string) => void;
  isLoading?: boolean;
  className?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  onError,
  isLoading = false,
  className,
}) => {
  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      if (rejectedFiles.length > 0) {
        onError('Please upload a CSV or Excel file');
        return;
      }

      if (acceptedFiles.length === 0) {
        onError('No file selected');
        return;
      }

      const file = acceptedFiles[0];
      const validation = validateImportFile(file);

      if (!validation.valid) {
        onError(validation.error!);
        return;
      }

      onFileSelect(file);
    },
    [onFileSelect, onError],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
        '.xlsx',
      ],
    },
    multiple: false,
    disabled: isLoading,
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200',
        isDragActive
          ? 'border-purple-400 bg-purple-50'
          : 'border-stone-300 hover:border-purple-300 hover:bg-stone-50',
        isLoading && 'opacity-50 cursor-not-allowed',
        className,
      )}
    >
      <input {...getInputProps()} />

      <div className="space-y-4">
        {isLoading ? (
          <>
            <div className="w-12 h-12 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin mx-auto" />
            <p className="text-stone-600">Processing file...</p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-rose-100 rounded-full flex items-center justify-center mx-auto">
              <svg
                className="w-8 h-8 text-purple-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>

            <div>
              <p className="text-lg font-medium text-stone-800 mb-2">
                {isDragActive
                  ? 'Drop your file here'
                  : 'Upload your guest list'}
              </p>
              <p className="text-stone-600 text-sm">
                Drag & drop a CSV or Excel file, or click to browse
              </p>
              <p className="text-stone-500 text-xs mt-2">
                Supports .csv, .xls, .xlsx files up to 10MB
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
