'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { cn } from '@/lib/utils';
import { useHapticFeedback } from '@/hooks/common';
import { 
  Calendar, Clock, Users, MessageSquare, Edit3, X, Trash2, 
  CheckCircle2, AlertCircle, Pause, Send, Mail, Smartphone 
} from 'lucide-react';
import { 
  cancelScheduledMessage, 
  deleteScheduledMessage
} from '@/services/messaging/scheduled';
import type { Tables } from '@/app/reference/supabase.types';

type ScheduledMessage = Tables<'scheduled_messages'>;

interface ScheduledMessageCardProps {
  message: ScheduledMessage;
  onUpdate?: () => void;
  onEdit?: (message: ScheduledMessage) => void;
  className?: string;
}

export function ScheduledMessageCard({
  message,
  onUpdate,
  onEdit,
  className
}: ScheduledMessageCardProps) {
  const [loading, setLoading] = useState<'cancel' | 'delete' | null>(null);
  const { triggerHaptic } = useHapticFeedback();

  const handleCancel = async () => {
    if (message.status !== 'scheduled') return;
    
    setLoading('cancel');
    try {
      await cancelScheduledMessage(message.id);
      triggerHaptic('success');
      onUpdate?.();
    } catch (error) {
      console.error('Error cancelling message:', error);
      triggerHaptic('error');
    } finally {
      setLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this scheduled message? This action cannot be undone.')) {
      return;
    }

    setLoading('delete');
    try {
      await deleteScheduledMessage(message.id);
      triggerHaptic('success');
      onUpdate?.();
    } catch (error) {
      console.error('Error deleting message:', error);
      triggerHaptic('error');
    } finally {
      setLoading(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'sending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'sent':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <Clock className="w-3 h-3" />;
      case 'sending':
        return <Send className="w-3 h-3" />;
      case 'sent':
        return <CheckCircle2 className="w-3 h-3" />;
      case 'failed':
        return <AlertCircle className="w-3 h-3" />;
      case 'cancelled':
        return <X className="w-3 h-3" />;
      default:
        return <Clock className="w-3 h-3" />;
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isTomorrow = date.toDateString() === new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString();
    
    const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (isToday) {
      return `Today at ${timeString}`;
    } else if (isTomorrow) {
      return `Tomorrow at ${timeString}`;
    } else {
      return `${date.toLocaleDateString()} at ${timeString}`;
    }
  };

  const getDeliveryMethods = () => {
    const methods = [];
    if (message.send_via_sms) methods.push('SMS');
    if (message.send_via_push) methods.push('Push');
    if (message.send_via_email) methods.push('Email');
    return methods;
  };

  const getDeliveryIcons = () => {
    const icons = [];
    if (message.send_via_sms) {
      icons.push(<Smartphone key="sms" className="w-3 h-3" />);
    }
    if (message.send_via_push) {
      icons.push(<MessageSquare key="push" className="w-3 h-3" />);
    }
    if (message.send_via_email) {
      icons.push(<Mail key="email" className="w-3 h-3" />);
    }
    return icons;
  };

  const getTargetDescription = () => {
    if (message.target_all_guests) {
      return 'All guests';
    } else if (message.target_guest_tags?.length) {
      return `Tags: ${message.target_guest_tags.join(', ')}`;
    } else if (message.target_guest_ids?.length) {
      return `${message.target_guest_ids.length} specific guests`;
    } else {
      return 'Unknown targeting';
    }
  };

  const canEdit = message.status === 'scheduled';
  const canCancel = message.status === 'scheduled';
  const canDelete = ['scheduled', 'cancelled', 'failed'].includes(message.status || '');

  return (
    <div className={cn(
      'bg-white border border-gray-200 rounded-lg p-4 space-y-4',
      className
    )}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn(
              'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full border',
              getStatusColor(message.status || 'scheduled')
            )}>
              {getStatusIcon(message.status || 'scheduled')}
              {(message.status || 'scheduled').charAt(0).toUpperCase() + (message.status || 'scheduled').slice(1)}
            </span>
            <span className="text-xs text-gray-500">
              {message.message_type?.charAt(0).toUpperCase()}{message.message_type?.slice(1)}
            </span>
          </div>
          {message.subject && (
            <h3 className="font-medium text-gray-900 mb-1">{message.subject}</h3>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {canEdit && onEdit && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onEdit(message)}
              className="p-2"
            >
              <Edit3 className="w-3 h-3" />
            </Button>
          )}
          
          {canCancel && (
            <Button
              size="sm"
              variant="secondary"
              onClick={handleCancel}
              disabled={loading === 'cancel'}
              className="p-2"
            >
              {loading === 'cancel' ? (
                <LoadingSpinner size="sm" />
              ) : (
                <Pause className="w-3 h-3" />
              )}
            </Button>
          )}

          {canDelete && (
            <Button
              size="sm"
              variant="secondary"
              onClick={handleDelete}
              disabled={loading === 'delete'}
              className="p-2 text-red-600 hover:text-red-700"
            >
              {loading === 'delete' ? (
                <LoadingSpinner size="sm" />
              ) : (
                <Trash2 className="w-3 h-3" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Content Preview */}
      <div className="bg-gray-50 rounded-lg p-3">
        <p className="text-sm text-gray-700 line-clamp-3">
          {message.content}
        </p>
      </div>

      {/* Schedule Details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-gray-600">
            <Calendar className="w-4 h-4" />
            <span>{formatDateTime(message.send_at)}</span>
          </div>
          
          <div className="flex items-center gap-2 text-gray-600">
            <Users className="w-4 h-4" />
            <span>
              {getTargetDescription()} ({message.recipient_count || 0} recipients)
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-gray-600">
            <div className="flex items-center gap-1">
              {getDeliveryIcons()}
            </div>
            <span>{getDeliveryMethods().join(', ')}</span>
          </div>

          {/* Delivery Stats */}
          {(message.success_count !== null || message.failure_count !== null) && (
            <div className="text-xs text-gray-500">
              {message.success_count !== null && (
                <span className="text-green-600">
                  ✓ {message.success_count} sent
                </span>
              )}
              {message.success_count !== null && message.failure_count !== null && ' • '}
              {message.failure_count !== null && message.failure_count > 0 && (
                <span className="text-red-600">
                  ✗ {message.failure_count} failed
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Additional Status Info */}
      {message.status === 'failed' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-red-800">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Message failed to send</span>
          </div>
          <p className="text-xs text-red-600 mt-1">
            Please check the recipient settings and try again.
          </p>
        </div>
      )}

      {message.status === 'cancelled' && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-gray-700">
            <X className="w-4 h-4" />
            <span className="text-sm">Message was cancelled</span>
          </div>
        </div>
      )}

      {message.status === 'sent' && message.sent_at && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-green-800">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-sm">
              Sent {formatDateTime(message.sent_at)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
} 