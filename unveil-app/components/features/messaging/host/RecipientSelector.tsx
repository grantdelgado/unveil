'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { FieldLabel } from '@/components/ui/Typography';
import { Button } from '@/components/ui/Button';
import type { RecipientFilter } from '@/lib/types/messaging';
import { useAvailableTags } from '@/hooks/messaging/useRecipientPreview';

interface RecipientSelectorProps {
  eventId: string;
  filter: RecipientFilter;
  onFilterChange: (filter: RecipientFilter) => void;
  recipientCount?: number;
  className?: string;
}

/**
 * Enhanced recipient selector with RSVP status and tag-based filtering
 * Supports both AND/OR logic for complex filtering scenarios
 */
export function RecipientSelector({
  eventId,
  filter,
  onFilterChange,
  recipientCount = 0,
  className
}: RecipientSelectorProps) {
  const [activeTab, setActiveTab] = useState<'rsvp' | 'tags' | 'combined'>('rsvp');
  const { tags: availableTags, tagCounts, loading: tagsLoading } = useAvailableTags(eventId);

  // RSVP status options with display names and emojis
  const rsvpOptions = [
    { value: 'attending', label: 'Attending', emoji: '✅', color: 'text-green-700' },
    { value: 'pending', label: 'Pending', emoji: '⏰', color: 'text-yellow-700' },
    { value: 'maybe', label: 'Maybe', emoji: '🤔', color: 'text-blue-700' },
    { value: 'declined', label: 'Declined', emoji: '❌', color: 'text-red-700' }
  ];

  // Tag options with emojis (can be customized per event)
  const getTagEmoji = (tag: string): string => {
    const emojiMap: Record<string, string> = {
      'family': '👨‍👩‍👧‍👦',
      'college friends': '🎓',
      'work colleagues': '💼',
      'neighbors': '🏠',
      'school friends': '📚',
      'sports team': '⚽',
      'church': '⛪',
      'close friends': '❤️',
      'relatives': '👪',
      'coworkers': '💼'
    };
    
    return emojiMap[tag.toLowerCase()] || '🏷️';
  };

  /**
   * Handle RSVP status selection
   */
  const handleRsvpChange = (status: string, checked: boolean) => {
    const currentStatuses = filter.rsvpStatuses || [];
    
    let newStatuses: string[];
    if (checked) {
      newStatuses = [...currentStatuses, status];
    } else {
      newStatuses = currentStatuses.filter(s => s !== status);
    }

    const newFilter: RecipientFilter = {
      ...filter,
      type: newStatuses.length === 0 && (!filter.tags?.length) ? 'all' : 'combined',
      rsvpStatuses: newStatuses.length > 0 ? newStatuses : undefined
    };

    onFilterChange(newFilter);
  };

  /**
   * Handle tag selection
   */
  const handleTagChange = (tag: string, checked: boolean) => {
    const currentTags = filter.tags || [];
    
    let newTags: string[];
    if (checked) {
      newTags = [...currentTags, tag];
    } else {
      newTags = currentTags.filter(t => t !== tag);
    }

    const newFilter: RecipientFilter = {
      ...filter,
      type: newTags.length === 0 && (!filter.rsvpStatuses?.length) ? 'all' : 'combined',
      tags: newTags.length > 0 ? newTags : undefined
    };

    onFilterChange(newFilter);
  };

  /**
   * Toggle AND/OR logic for tag filtering
   */
  const handleTagLogicChange = (requireAll: boolean) => {
    onFilterChange({
      ...filter,
      requireAllTags: requireAll
    });
  };

  /**
   * Clear all filters
   */
  const handleClearFilters = () => {
    onFilterChange({ type: 'all' });
  };

  /**
   * Quick filter presets
   */
  const handleQuickFilter = (filterType: 'all' | 'pending' | 'attending') => {
    switch (filterType) {
      case 'all':
        onFilterChange({ type: 'all' });
        break;
      case 'pending':
        onFilterChange({ 
          type: 'rsvp_status', 
          rsvpStatuses: ['pending'] 
        });
        break;
      case 'attending':
        onFilterChange({ 
          type: 'rsvp_status', 
          rsvpStatuses: ['attending'] 
        });
        break;
    }
  };

  const hasActiveFilters = filter.type !== 'all';
  const selectedRsvpCount = filter.rsvpStatuses?.length || 0;
  const selectedTagCount = filter.tags?.length || 0;
  const hasMultipleFilters = selectedRsvpCount > 0 && selectedTagCount > 0;

  // Active filter summary for mobile
  const getActiveFilterSummary = () => {
    const parts = [];
    if (selectedRsvpCount > 0) {
      parts.push(`${selectedRsvpCount} RSVP status${selectedRsvpCount > 1 ? 'es' : ''}`);
    }
    if (selectedTagCount > 0) {
      parts.push(`${selectedTagCount} tag${selectedTagCount > 1 ? 's' : ''}`);
    }
    if (parts.length === 0) return 'All guests';
    if (parts.length === 1) return parts[0];
    
    const logic = filter.requireAllTags ? 'AND' : 'OR';
    return `${parts.join(` ${logic} `)}`;
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header with recipient count and active filters */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <FieldLabel className="text-gray-700 font-medium">
            Send To
          </FieldLabel>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-purple-700">
              {recipientCount} recipients
            </span>
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearFilters}
                className="text-xs h-6 px-2"
              >
                Clear All
              </Button>
            )}
          </div>
        </div>
        
        {/* Active filter summary for mobile */}
        {hasActiveFilters && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-2 sm:p-3">
            <div className="flex items-center justify-between">
              <div className="text-xs sm:text-sm text-purple-800">
                <span className="font-medium">Active filters:</span> {getActiveFilterSummary()}
              </div>
              {hasMultipleFilters && (
                <div className="flex items-center gap-1 ml-2">
                  <span className="text-xs text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded">
                    {filter.requireAllTags ? 'AND' : 'OR'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Quick filter buttons */}
      <div className="grid grid-cols-3 gap-2">
        <Button
          variant={filter.type === 'all' ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => handleQuickFilter('all')}
          className="text-xs"
        >
          👥 All Guests
        </Button>
        <Button
          variant={filter.rsvpStatuses?.includes('pending') && filter.rsvpStatuses.length === 1 ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => handleQuickFilter('pending')}
          className="text-xs"
        >
          ⏰ Pending RSVPs
        </Button>
        <Button
          variant={filter.rsvpStatuses?.includes('attending') && filter.rsvpStatuses.length === 1 ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => handleQuickFilter('attending')}
          className="text-xs"
        >
          ✅ Attending
        </Button>
      </div>

      {/* Advanced filtering tabs */}
      <div className="border rounded-lg">
        {/* Tab navigation */}
        <div className="flex border-b bg-gray-50 rounded-t-lg">
          <button
            onClick={() => setActiveTab('rsvp')}
            className={cn(
              'flex-1 py-2 px-3 text-sm font-medium transition-colors',
              activeTab === 'rsvp'
                ? 'bg-white border-b-2 border-purple-500 text-purple-700'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            RSVP Status
            {selectedRsvpCount > 0 && (
              <span className="ml-1 bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full text-xs">
                {selectedRsvpCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('tags')}
            className={cn(
              'flex-1 py-2 px-3 text-sm font-medium transition-colors',
              activeTab === 'tags'
                ? 'bg-white border-b-2 border-purple-500 text-purple-700'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            Guest Tags
            {selectedTagCount > 0 && (
              <span className="ml-1 bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full text-xs">
                {selectedTagCount}
              </span>
            )}
          </button>
        </div>

        {/* Tab content */}
        <div className="p-3">
          {activeTab === 'rsvp' && (
            <div className="space-y-3">
              <div className="text-xs text-gray-500">
                Select one or more RSVP statuses
              </div>
              
              {/* Mobile-optimized RSVP selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {rsvpOptions.map((option) => (
                  <label
                    key={option.value}
                    className={cn(
                      "flex items-center space-x-3 p-3 cursor-pointer rounded-lg border-2 transition-all",
                      "hover:bg-gray-50 focus-within:ring-2 focus-within:ring-purple-500",
                      filter.rsvpStatuses?.includes(option.value)
                        ? "border-purple-300 bg-purple-50"
                        : "border-gray-200 bg-white"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={filter.rsvpStatuses?.includes(option.value) || false}
                      onChange={(e) => handleRsvpChange(option.value, e.target.checked)}
                      className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                    />
                    <span className="text-xl">{option.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <span className={cn('text-sm font-medium', option.color)}>
                        {option.label}
                      </span>
                    </div>
                  </label>
                ))}
              </div>

              {/* Logic selector for multiple RSVP selections */}
              {selectedRsvpCount > 1 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="text-xs font-medium text-blue-900 mb-2">
                    Multiple RSVP statuses selected - guests matching ANY of these will be included
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'tags' && (
            <div className="space-y-3">
              <div className="text-xs text-gray-500">
                Select guest tags to include in your message
              </div>

              {/* Enhanced tag logic selector */}
              {selectedTagCount > 1 && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3">
                  <div className="text-xs font-medium text-blue-900 mb-2">
                    Multiple tags selected - choose logic:
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className={cn(
                      "flex items-center space-x-2 p-2 cursor-pointer rounded-lg border transition-all",
                      !filter.requireAllTags 
                        ? "border-blue-300 bg-blue-100 text-blue-800"
                        : "border-blue-200 bg-white text-blue-600 hover:bg-blue-50"
                    )}>
                      <input
                        type="radio"
                        checked={!filter.requireAllTags}
                        onChange={() => handleTagLogicChange(false)}
                        className="h-4 w-4 text-blue-600"
                      />
                      <div>
                        <div className="text-xs font-medium">Any (OR)</div>
                        <div className="text-xs opacity-75">Match guests with ANY selected tag</div>
                      </div>
                    </label>
                    <label className={cn(
                      "flex items-center space-x-2 p-2 cursor-pointer rounded-lg border transition-all",
                      filter.requireAllTags 
                        ? "border-blue-300 bg-blue-100 text-blue-800"
                        : "border-blue-200 bg-white text-blue-600 hover:bg-blue-50"
                    )}>
                      <input
                        type="radio"
                        checked={filter.requireAllTags || false}
                        onChange={() => handleTagLogicChange(true)}
                        className="h-4 w-4 text-blue-600"
                      />
                      <div>
                        <div className="text-xs font-medium">All (AND)</div>
                        <div className="text-xs opacity-75">Match guests with ALL selected tags</div>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* Enhanced tag selection */}
              {tagsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <div className="text-xs text-gray-500">Loading tags...</div>
                </div>
              ) : availableTags.length === 0 ? (
                <div className="text-center py-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <div className="text-2xl mb-2">🏷️</div>
                  <div className="text-xs text-gray-500">
                    No tags available yet
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Add tags to guests to enable tag-based filtering
                  </div>
                </div>
              ) : (
                <div className="space-y-1 max-h-40 overflow-y-auto border border-gray-200 rounded-lg">
                  {availableTags.map((tag, index) => (
                    <label
                      key={tag}
                      className={cn(
                        "flex items-center space-x-3 p-2 cursor-pointer transition-all",
                        "hover:bg-purple-50 focus-within:bg-purple-50",
                        filter.tags?.includes(tag) 
                          ? "bg-purple-50 border-l-4 border-purple-300"
                          : "bg-white border-l-4 border-transparent",
                        index !== availableTags.length - 1 && "border-b border-gray-100"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={filter.tags?.includes(tag) || false}
                        onChange={(e) => handleTagChange(tag, e.target.checked)}
                        className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                      />
                      <span className="text-lg flex-shrink-0">{getTagEmoji(tag)}</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-gray-700 capitalize">
                          {tag}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                        {tagCounts[tag] || 0}
                      </span>
                    </label>
                  ))}
                </div>
              )}

              {/* Filter combination explanation */}
              {hasMultipleFilters && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
                  <div className="text-xs text-amber-800">
                    <span className="font-medium">💡 Combining filters:</span> Guests matching{' '}
                    {selectedRsvpCount > 0 && selectedTagCount > 0 && (
                      <>
                        <span className="font-medium">
                          {filter.requireAllTags ? 'ALL' : 'ANY'} selected tags AND ANY selected RSVP status
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
