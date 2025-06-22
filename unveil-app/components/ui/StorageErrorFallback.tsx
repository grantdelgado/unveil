'use client'

import React from 'react'
import { Button } from './Button'

interface StorageErrorFallbackProps {
  error: Error
  onRetry: () => void
  onCancel: () => void
}

export const StorageErrorFallback: React.FC<StorageErrorFallbackProps> = ({
  error,
  onRetry,
  onCancel,
}) => {
  // Parse common storage error types
  const getErrorMessage = (error: Error) => {
    const message = error.message.toLowerCase()
    
    if (message.includes('bucket') || message.includes('not found')) {
      return {
        title: 'Storage Setup Required',
        description: 'The media storage bucket needs to be configured. Please contact support or try again later.',
        canRetry: false,
      }
    }
    
    if (message.includes('size') || message.includes('too large')) {
      return {
        title: 'File Too Large',
        description: 'Please choose a file smaller than 50MB or compress your image.',
        canRetry: false,
      }
    }
    
    if (message.includes('type') || message.includes('format')) {
      return {
        title: 'Unsupported File Type',
        description: 'Please choose a JPG, PNG, or MP4 file.',
        canRetry: false,
      }
    }
    
    if (message.includes('network') || message.includes('timeout')) {
      return {
        title: 'Connection Problem',
        description: 'Please check your internet connection and try again.',
        canRetry: true,
      }
    }
    
    if (message.includes('permission') || message.includes('unauthorized')) {
      return {
        title: 'Permission Denied',
        description: 'You don&apos;t have permission to upload to this event. Please check with the host.',
        canRetry: false,
      }
    }
    
    // Generic fallback
    return {
      title: 'Upload Failed',
      description: 'Something went wrong while uploading your file. Please try again.',
      canRetry: true,
    }
  }

  const errorInfo = getErrorMessage(error)

  return (
    <div className="bg-app rounded-xl shadow-sm border border-rose-200 p-6">
      <div className="text-center">
        <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-6 h-6 text-rose-600"
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

        <h3 className="text-lg font-medium text-stone-800 mb-2">
          {errorInfo.title}
        </h3>

        <p className="text-stone-600 mb-4">
          {errorInfo.description}
        </p>

        {process.env.NODE_ENV === 'development' && (
          <details className="text-left mb-4 p-3 bg-stone-50 rounded-lg">
            <summary className="cursor-pointer text-xs font-medium text-stone-700 mb-2">
              Debug Info
            </summary>
            <pre className="text-xs text-rose-600 whitespace-pre-wrap break-words">
              {error.message}
            </pre>
          </details>
        )}

        <div className="flex gap-3 justify-center">
          {errorInfo.canRetry && (
            <Button onClick={onRetry} size="sm">
              Try Again
            </Button>
          )}
          <Button onClick={onCancel} variant="outline" size="sm">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}

interface RealtimeErrorFallbackProps {
  error: Error
  onReconnect: () => void
  connectionStatus: 'connecting' | 'connected' | 'disconnected'
}

export const RealtimeErrorFallback: React.FC<RealtimeErrorFallbackProps> = ({
  error,
  onReconnect,
  connectionStatus,
}) => {
  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'text-green-600 bg-green-100'
      case 'connecting':
        return 'text-yellow-600 bg-yellow-100'
      case 'disconnected':
        return 'text-rose-600 bg-rose-100'
    }
  }

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Connected'
      case 'connecting':
        return 'Reconnecting...'
      case 'disconnected':
        return 'Disconnected'
    }
  }

  return (
    <div className="bg-app rounded-lg border border-stone-200 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${getStatusColor()}`} />
          <div>
            <p className="text-sm font-medium text-stone-800">
              Real-time Updates
            </p>
            <p className="text-xs text-stone-600">
              {getStatusText()}
            </p>
          </div>
        </div>

        {connectionStatus === 'disconnected' && (
          <Button onClick={onReconnect} size="sm" variant="outline">
            Reconnect
          </Button>
        )}
      </div>

      {connectionStatus === 'disconnected' && (
        <div className="mt-3 pt-3 border-t border-stone-200">
          <p className="text-xs text-stone-600">
            You&apos;ll need to refresh to see new messages and uploads.
          </p>
        </div>
      )}

      {process.env.NODE_ENV === 'development' && error && (
        <details className="mt-3 pt-3 border-t border-stone-200">
          <summary className="cursor-pointer text-xs font-medium text-stone-700">
            Connection Error
          </summary>
          <pre className="text-xs text-rose-600 mt-2 whitespace-pre-wrap">
            {error.message}
          </pre>
        </details>
      )}
    </div>
  )
} 