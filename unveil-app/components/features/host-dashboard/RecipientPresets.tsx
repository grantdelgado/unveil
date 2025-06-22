'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { Database } from '@/app/reference/supabase.types';

type Participant = Database['public']['Tables']['event_participants']['Row'] & {
  user: Database['public']['Views']['public_user_profiles']['Row'];
};

export type RecipientFilter = 'all' | 'attending' | 'pending' | 'maybe' | 'declined';

interface RecipientPreset {
  id: RecipientFilter;
  label: string;
  icon: string;
  description: string;
  getParticipants: (participants: Participant[]) => Participant[];
  getMessageContext: (count: number) => string;
}

interface RecipientPresetsProps {
  participants: Participant[];
  selectedFilter: RecipientFilter;
  onFilterChange: (filter: RecipientFilter) => void;
  className?: string;
}

const recipientPresets: RecipientPreset[] = [
  {
    id: 'all',
    label: 'All Guests',
    icon: '👥',
    description: 'Send to everyone invited',
    getParticipants: (participants) => participants,
    getMessageContext: (count) => `Sending to all ${count} guests`
  },
  {
    id: 'attending',
    label: 'Attending Only',
    icon: '✅',
    description: 'Only confirmed guests',
    getParticipants: (participants) => participants.filter(p => p.rsvp_status === 'attending'),
    getMessageContext: (count) => `Sending to ${count} confirmed guests`
  },
  {
    id: 'pending',
    label: 'Pending Only',
    icon: '⏳',
    description: 'Guests who haven&apos;t responded',
    getParticipants: (participants) => participants.filter(p => p.rsvp_status === 'pending'),
    getMessageContext: (count) => `Sending RSVP reminder to ${count} guests`
  },
  {
    id: 'maybe',
    label: 'Maybe Responses',
    icon: '🤔',
    description: 'Guests who said maybe',
    getParticipants: (participants) => participants.filter(p => p.rsvp_status === 'maybe'),
    getMessageContext: (count) => `Sending to ${count} guests who said maybe`
  },
  {
    id: 'declined',
    label: 'Declined',
    icon: '❌',
    description: 'Guests who can&apos;t attend',
    getParticipants: (participants) => participants.filter(p => p.rsvp_status === 'declined'),
    getMessageContext: (count) => `Sending to ${count} guests who declined`
  }
];

export function RecipientPresets({ 
  participants, 
  selectedFilter, 
  onFilterChange, 
  className 
}: RecipientPresetsProps) {
  
  const getFilteredCount = (filter: RecipientFilter) => {
    const preset = recipientPresets.find(p => p.id === filter);
    if (!preset) return 0;
    return preset.getParticipants(participants).length;
  };

  const selectedPreset = recipientPresets.find(p => p.id === selectedFilter);
  const selectedCount = getFilteredCount(selectedFilter);

  return (
    <div className={cn('space-y-4', className)}>
      <div>
        <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
          <span className="text-base">🎯</span>
          Send to
        </h3>
        
        {/* Mobile-first pill layout */}
        <div className="flex flex-wrap gap-2">
          {recipientPresets.map(preset => {
            const count = getFilteredCount(preset.id);
            const isSelected = selectedFilter === preset.id;
            const isDisabled = count === 0;
            
            return (
              <button
                key={preset.id}
                onClick={() => !isDisabled && onFilterChange(preset.id)}
                disabled={isDisabled}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-full border transition-all duration-200',
                  'text-sm font-medium min-h-[44px] focus:outline-none focus:ring-2 focus:ring-offset-1',
                  isSelected
                    ? 'bg-[#FF6B6B] border-[#FF6B6B] text-white shadow-sm focus:ring-[#FF6B6B]'
                    : isDisabled
                    ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-white border-gray-300 text-gray-700 hover:border-[#FF6B6B] hover:text-[#FF6B6B] focus:ring-[#FF6B6B] active:scale-[0.98]'
                )}
                aria-pressed={isSelected}
                aria-describedby={`${preset.id}-description`}
              >
                <span 
                  className={cn(
                    'text-base transition-transform duration-200',
                    isSelected && 'scale-110'
                  )}
                  role="img" 
                  aria-hidden="true"
                >
                  {preset.icon}
                </span>
                <span>{preset.label}</span>
                <span 
                  className={cn(
                    'ml-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors duration-200',
                    isSelected
                      ? 'bg-white/20 text-white'
                      : isDisabled
                      ? 'bg-gray-100 text-gray-400'
                      : 'bg-gray-100 text-gray-600'
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected context with message preview */}
      {selectedPreset && selectedCount > 0 && (
        <div className="bg-[#FF6B6B]/5 border border-[#FF6B6B]/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-lg mt-0.5" role="img" aria-hidden="true">
              {selectedPreset.icon}
            </span>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 mb-1">
                {selectedPreset.getMessageContext(selectedCount)}
              </p>
              <p className="text-xs text-gray-600">
                {selectedPreset.description}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* No recipients warning */}
      {selectedCount === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-lg mt-0.5" role="img" aria-hidden="true">⚠️</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800 mb-1">
                No recipients in this group
              </p>
              <p className="text-xs text-amber-700">
                Choose a different recipient group or add guests to your event first.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Quick stats for context */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-gray-100">
        {[
          { key: 'all', label: 'Total', value: participants.length, icon: '👥' },
          { key: 'attending', label: 'Attending', value: getFilteredCount('attending'), icon: '✅' },
          { key: 'pending', label: 'Pending', value: getFilteredCount('pending'), icon: '⏳' },
          { key: 'maybe', label: 'Maybe', value: getFilteredCount('maybe'), icon: '🤔' }
        ].map(stat => (
          <div key={stat.key} className="text-center">
            <div className="text-xs text-gray-500 mb-1 flex items-center justify-center gap-1">
              <span role="img" aria-hidden="true">{stat.icon}</span>
              {stat.label}
            </div>
            <div className="text-lg font-semibold text-gray-900">{stat.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export { recipientPresets };
export type { RecipientPreset }; 