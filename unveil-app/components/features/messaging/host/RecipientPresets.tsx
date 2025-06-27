'use client';

import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { TagSelector } from './TagSelector';
import { useGuestTags } from '@/hooks/messaging/useGuestTags';
import { Filter, Settings } from 'lucide-react';
import type { Tables } from '@/app/reference/supabase.types';

type EventGuest = Tables<'event_guests'>;

export type RecipientFilter = 'all' | 'attending' | 'pending' | 'maybe' | 'declined' | 'tags' | 'custom';

export interface AdvancedRecipientFilter {
  rsvpStatuses: string[];
  tags: string[];
  requireAllTags: boolean;
  explicitGuestIds?: string[];
}

interface RecipientPreset {
  id: RecipientFilter;
  label: string;
  icon: string;
  description: string;
  getGuests: (guests: EventGuest[]) => EventGuest[];
  getMessageContext: (count: number) => string;
}

interface RecipientPresetsProps {
  eventId: string;
  guests: EventGuest[];
  selectedFilter: RecipientFilter;
  advancedFilter?: AdvancedRecipientFilter;
  onFilterChange: (filter: RecipientFilter, advancedFilter?: AdvancedRecipientFilter) => void;
  showAdvancedFilters?: boolean;
  className?: string;
}

const recipientPresets: RecipientPreset[] = [
  {
    id: 'all',
    label: 'All Guests',
    icon: '👥',
    description: 'Send to everyone invited',
    getGuests: (guests) => guests,
    getMessageContext: (count) => `Sending to all ${count} guests`
  },
  {
    id: 'attending',
    label: 'Attending Only',
    icon: '✅',
    description: 'Only confirmed guests',
    getGuests: (guests) => guests.filter(g => g.rsvp_status === 'attending'),
    getMessageContext: (count) => `Sending to ${count} confirmed guests`
  },
  {
    id: 'pending',
    label: 'Pending Only',
    icon: '⏳',
    description: 'Guests who haven&apos;t responded',
    getGuests: (guests) => guests.filter(g => g.rsvp_status === 'pending'),
    getMessageContext: (count) => `Sending RSVP reminder to ${count} guests`
  },
  {
    id: 'maybe',
    label: 'Maybe Responses',
    icon: '🤔',
    description: 'Guests who said maybe',
    getGuests: (guests) => guests.filter(g => g.rsvp_status === 'maybe'),
    getMessageContext: (count) => `Sending to ${count} guests who said maybe`
  },
  {
    id: 'declined',
    label: 'Declined',
    icon: '❌',
    description: 'Guests who can&apos;t attend',
    getGuests: (guests) => guests.filter(g => g.rsvp_status === 'declined'),
    getMessageContext: (count) => `Sending to ${count} guests who declined`
  },
  {
    id: 'tags',
    label: 'By Tags',
    icon: '🏷️',
    description: 'Filter by guest categories',
    getGuests: () => [], // Will be handled by advanced filtering
    getMessageContext: (count) => `Sending to ${count} tagged guests`
  },
  {
    id: 'custom',
    label: 'Advanced',
    icon: '⚙️',
    description: 'Custom filters & combinations',
    getGuests: () => [], // Will be handled by advanced filtering
    getMessageContext: (count) => `Sending to ${count} selected guests`
  }
];

export function RecipientPresets({ 
  eventId,
  guests, 
  selectedFilter, 
  advancedFilter,
  onFilterChange,
  showAdvancedFilters = false,
  className 
}: RecipientPresetsProps) {
  
  const [showAdvanced, setShowAdvanced] = useState(showAdvancedFilters);
  const [tempAdvancedFilter, setTempAdvancedFilter] = useState<AdvancedRecipientFilter>(
    advancedFilter || {
      rsvpStatuses: [],
      tags: [],
      requireAllTags: false
    }
  );

  // Use tag management hook
  const { tagStats, getGuestsByTags, loading: tagsLoading } = useGuestTags(eventId);

  // Convert tag stats to options for TagSelector
  const tagOptions = useMemo(() => 
    tagStats.map(stat => ({
      tag: stat.tag,
      guestCount: stat.guestCount
    })),
    [tagStats]
  );

  // Get filtered guests based on current selection and advanced filters
  const getFilteredGuests = (filter: RecipientFilter): EventGuest[] => {
    // Handle advanced filtering
    if (filter === 'tags' || filter === 'custom') {
      let filteredGuests = guests;

      // Filter by RSVP status if specified
      if (tempAdvancedFilter.rsvpStatuses.length > 0) {
        filteredGuests = filteredGuests.filter(guest => 
          tempAdvancedFilter.rsvpStatuses.includes(guest.rsvp_status || 'pending')
        );
      }

      // Filter by tags if specified
      if (tempAdvancedFilter.tags.length > 0) {
        const tagFilteredGuests = getGuestsByTags(
          tempAdvancedFilter.tags,
          tempAdvancedFilter.requireAllTags
        );
        
        // Intersect with RSVP filtered guests
        filteredGuests = filteredGuests.filter(guest =>
          tagFilteredGuests.some(tagGuest => tagGuest.id === guest.id)
        );
      }

      // Filter by explicit guest IDs if specified
      if (tempAdvancedFilter.explicitGuestIds && tempAdvancedFilter.explicitGuestIds.length > 0) {
        filteredGuests = filteredGuests.filter(guest =>
          tempAdvancedFilter.explicitGuestIds!.includes(guest.id)
        );
      }

      return filteredGuests;
    }

    // Handle basic presets
    const preset = recipientPresets.find(p => p.id === filter);
    if (!preset) return [];
    return preset.getGuests(guests);
  };

  const getFilteredCount = (filter: RecipientFilter) => {
    return getFilteredGuests(filter).length;
  };

  const selectedPreset = recipientPresets.find(p => p.id === selectedFilter);
  const selectedCount = getFilteredCount(selectedFilter);

  // Handle advanced filter changes
  const handleAdvancedFilterChange = (newAdvancedFilter: AdvancedRecipientFilter) => {
    setTempAdvancedFilter(newAdvancedFilter);
    
    // Auto-apply if we're in tags or custom mode
    if (selectedFilter === 'tags' || selectedFilter === 'custom') {
      onFilterChange(selectedFilter, newAdvancedFilter);
    }
  };

  // Apply advanced filters is handled automatically by handleAdvancedFilterChange

  return (
    <div className={cn('space-y-4', className)}>
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
            <span className="text-base">🎯</span>
            Send to
          </h3>
          
          {/* Advanced filters toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={cn(
              'flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors',
              showAdvanced
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            <Settings className="w-3 h-3" />
            Advanced
          </button>
        </div>
        
        {/* Mobile-first pill layout */}
        <div className="flex flex-wrap gap-2">
          {recipientPresets.map(preset => {
            const count = getFilteredCount(preset.id);
            const isSelected = selectedFilter === preset.id;
            const isDisabled = count === 0 && preset.id !== 'tags' && preset.id !== 'custom';
            
            return (
              <button
                key={preset.id}
                onClick={() => {
                  if (!isDisabled) {
                    if (preset.id === 'tags' || preset.id === 'custom') {
                      setShowAdvanced(true);
                    }
                    onFilterChange(preset.id, preset.id === 'tags' || preset.id === 'custom' ? tempAdvancedFilter : undefined);
                  }
                }}
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

      {/* Advanced filters panel */}
      {showAdvanced && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Advanced Filters
            </h4>
            <button
              onClick={() => setShowAdvanced(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>

          {/* RSVP Status filters */}
          <div>
            <label className="text-xs font-medium text-gray-700 mb-2 block">
              RSVP Status
            </label>
            <div className="flex flex-wrap gap-1">
              {[
                { value: 'attending', label: 'Attending', icon: '✅' },
                { value: 'pending', label: 'Pending', icon: '⏳' },
                { value: 'maybe', label: 'Maybe', icon: '🤔' },
                { value: 'declined', label: 'Declined', icon: '❌' }
              ].map(status => (
                <button
                  key={status.value}
                  onClick={() => {
                    const newStatuses = tempAdvancedFilter.rsvpStatuses.includes(status.value)
                      ? tempAdvancedFilter.rsvpStatuses.filter(s => s !== status.value)
                      : [...tempAdvancedFilter.rsvpStatuses, status.value];
                    
                    handleAdvancedFilterChange({
                      ...tempAdvancedFilter,
                      rsvpStatuses: newStatuses
                    });
                  }}
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 text-xs rounded border transition-colors',
                    tempAdvancedFilter.rsvpStatuses.includes(status.value)
                      ? 'bg-blue-100 border-blue-300 text-blue-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  )}
                >
                  <span>{status.icon}</span>
                  {status.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tag filters */}
          <div>
            <label className="text-xs font-medium text-gray-700 mb-2 block">
              Guest Tags
            </label>
            {tagsLoading ? (
              <div className="text-xs text-gray-500">Loading tags...</div>
            ) : (
              <div className="space-y-2">
                <TagSelector
                  availableTags={tagOptions}
                  selectedTags={tempAdvancedFilter.tags}
                  onTagsChange={(tags) => {
                    handleAdvancedFilterChange({
                      ...tempAdvancedFilter,
                      tags
                    });
                  }}
                  variant="chips"
                  placeholder="Select tags to filter by..."
                  showGuestCounts={true}
                />
                
                {tempAdvancedFilter.tags.length > 1 && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="requireAllTags"
                      checked={tempAdvancedFilter.requireAllTags}
                      onChange={(e) => {
                        handleAdvancedFilterChange({
                          ...tempAdvancedFilter,
                          requireAllTags: e.target.checked
                        });
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="requireAllTags" className="text-xs text-gray-600">
                      Require ALL selected tags (instead of ANY)
                    </label>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

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
              
              {/* Show applied filters */}
              {(selectedFilter === 'tags' || selectedFilter === 'custom') && (
                <div className="mt-2 space-y-1">
                  {tempAdvancedFilter.rsvpStatuses.length > 0 && (
                    <div className="text-xs text-gray-500">
                      RSVP: {tempAdvancedFilter.rsvpStatuses.join(', ')}
                    </div>
                  )}
                  {tempAdvancedFilter.tags.length > 0 && (
                    <div className="text-xs text-gray-500">
                      Tags: {tempAdvancedFilter.tags.join(', ')} 
                      {tempAdvancedFilter.requireAllTags ? ' (all required)' : ' (any match)'}
                    </div>
                  )}
                </div>
              )}
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
                No recipients match these filters
              </p>
              <p className="text-xs text-amber-700">
                {selectedFilter === 'tags' || selectedFilter === 'custom'
                  ? 'Try adjusting your tag or RSVP filters, or choose a different recipient group.'
                  : 'Choose a different recipient group or add guests to your event first.'
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Quick stats for context */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-gray-100">
        {[
          { key: 'all', label: 'Total', value: guests.length, icon: '👥' },
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