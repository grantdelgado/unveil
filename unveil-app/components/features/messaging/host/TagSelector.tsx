'use client';

import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { 
  Search, 
  Tag, 
  Users, 
  X, 
  Check, 
  ChevronDown,
  Hash
} from 'lucide-react';

interface TagOption {
  tag: string;
  guestCount: number;
  color?: string;
}

interface TagSelectorProps {
  availableTags: TagOption[];
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  placeholder?: string;
  maxSelections?: number;
  showGuestCounts?: boolean;
  allowCreate?: boolean;
  onCreateTag?: (tagName: string) => Promise<void>;
  className?: string;
  disabled?: boolean;
  variant?: 'default' | 'compact' | 'chips';
}

export function TagSelector({
  availableTags,
  selectedTags,
  onTagsChange,
  placeholder = 'Select tags...',
  maxSelections,
  showGuestCounts = true,
  allowCreate = false,
  onCreateTag,
  className,
  disabled = false,
  variant = 'default'
}: TagSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Filter tags based on search term
  const filteredTags = useMemo(() => {
    if (!searchTerm) return availableTags;
    
    return availableTags.filter(tagOption =>
      tagOption.tag.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [availableTags, searchTerm]);

  // Check if search term could be a new tag
  const canCreateNewTag = useMemo(() => {
    if (!allowCreate || !searchTerm.trim()) return false;
    
    const trimmedSearch = searchTerm.trim().toLowerCase();
    const tagExists = availableTags.some(tag => 
      tag.tag.toLowerCase() === trimmedSearch
    );
    
    return !tagExists && 
           trimmedSearch.length <= 20 && 
           /^[a-zA-Z0-9\s-_]+$/.test(trimmedSearch);
  }, [allowCreate, searchTerm, availableTags]);

  // Toggle tag selection
  const toggleTag = (tagName: string) => {
    if (disabled) return;
    
    const newSelectedTags = selectedTags.includes(tagName)
      ? selectedTags.filter(tag => tag !== tagName)
      : [...selectedTags, tagName];

    // Check max selections limit
    if (maxSelections && newSelectedTags.length > maxSelections) {
      return;
    }

    onTagsChange(newSelectedTags);
  };

  // Create new tag
  const handleCreateTag = async () => {
    if (!canCreateNewTag || !onCreateTag) return;
    
    setIsCreating(true);
    try {
      await onCreateTag(searchTerm.trim());
      
      // Auto-select the new tag
      const newTag = searchTerm.trim();
      if (!selectedTags.includes(newTag)) {
        onTagsChange([...selectedTags, newTag]);
      }
      
      setSearchTerm('');
    } catch (error) {
      console.error('Error creating tag:', error);
    } finally {
      setIsCreating(false);
    }
  };

  // Remove selected tag
  const removeTag = (tagName: string) => {
    if (disabled) return;
    onTagsChange(selectedTags.filter(tag => tag !== tagName));
  };

  // Clear all selections
  const clearAll = () => {
    if (disabled) return;
    onTagsChange([]);
  };

  // Calculate total guest count for selected tags
  const totalGuestCount = useMemo(() => {
    if (!showGuestCounts) return 0;
    
    // Use Set to avoid counting the same guest multiple times
    const uniqueGuestIds = new Set<string>();
    
    selectedTags.forEach(tagName => {
      const tagOption = availableTags.find(t => t.tag === tagName);
      if (tagOption) {
        // In a real implementation, you'd track actual guest IDs
        // For now, we'll just sum the counts (may have duplicates)
        for (let i = 0; i < tagOption.guestCount; i++) {
          uniqueGuestIds.add(`${tagName}-${i}`);
        }
      }
    });
    
    return uniqueGuestIds.size;
  }, [selectedTags, availableTags, showGuestCounts]);

  // Render compact variant (just selected tags as chips)
  if (variant === 'compact') {
    return (
      <div className={cn('flex flex-wrap gap-1', className)}>
        {selectedTags.length === 0 ? (
          <span className="text-sm text-gray-500">No tags selected</span>
        ) : (
          selectedTags.map((tagName) => {
            const tagOption = availableTags.find(t => t.tag === tagName);
            return (
              <span
                key={tagName}
                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full"
              >
                <Hash className="w-3 h-3" />
                {tagName}
                {showGuestCounts && tagOption && (
                  <span className="text-blue-600">({tagOption.guestCount})</span>
                )}
                {!disabled && (
                  <button
                    onClick={() => removeTag(tagName)}
                    className="ml-1 hover:text-blue-900"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            );
          })
        )}
      </div>
    );
  }

  // Render chips variant (selected tags + dropdown trigger)
  if (variant === 'chips') {
    return (
      <div className={cn('space-y-2', className)}>
        {/* Selected tags */}
        {selectedTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {selectedTags.map((tagName) => {
              const tagOption = availableTags.find(t => t.tag === tagName);
              return (
                <span
                  key={tagName}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full"
                >
                  <Hash className="w-3 h-3" />
                  {tagName}
                  {showGuestCounts && tagOption && (
                    <span className="text-blue-600">({tagOption.guestCount})</span>
                  )}
                  {!disabled && (
                    <button
                      onClick={() => removeTag(tagName)}
                      className="ml-1 hover:text-blue-900"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              );
            })}
            <Button
              variant="secondary"
              size="sm"
              onClick={clearAll}
              disabled={disabled}
              className="text-xs px-2 py-1 h-auto"
            >
              Clear All
            </Button>
          </div>
        )}

        {/* Dropdown trigger */}
        <div className="relative">
          <Button
            variant="secondary"
            onClick={() => setIsOpen(!isOpen)}
            disabled={disabled}
            className="justify-between w-full"
          >
            <span className="flex items-center gap-2">
              <Tag className="w-4 h-4" />
              {selectedTags.length === 0 ? placeholder : `${selectedTags.length} tag${selectedTags.length !== 1 ? 's' : ''} selected`}
            </span>
            <ChevronDown className="w-4 h-4" />
          </Button>

          {/* Dropdown content */}
          {isOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-64 overflow-hidden">
              {/* Search */}
              <div className="p-3 border-b border-gray-200">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search tags..."
                    className="pl-9"
                    autoFocus
                  />
                </div>
              </div>

              {/* Tag options */}
              <div className="max-h-40 overflow-y-auto">
                {filteredTags.length === 0 && !canCreateNewTag ? (
                  <div className="p-3 text-sm text-gray-500 text-center">
                    No tags found
                  </div>
                ) : (
                  <>
                    {filteredTags.map((tagOption) => {
                      const isSelected = selectedTags.includes(tagOption.tag);
                      return (
                        <button
                          key={tagOption.tag}
                          onClick={() => toggleTag(tagOption.tag)}
                          className={cn(
                            'w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center justify-between',
                            isSelected && 'bg-blue-50 text-blue-700'
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <Hash className="w-3 h-3" />
                            <span>{tagOption.tag}</span>
                            {isSelected && <Check className="w-3 h-3" />}
                          </div>
                          {showGuestCounts && (
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <Users className="w-3 h-3" />
                              {tagOption.guestCount}
                            </div>
                          )}
                        </button>
                      );
                    })}

                    {/* Create new tag option */}
                    {canCreateNewTag && (
                      <button
                        onClick={handleCreateTag}
                        disabled={isCreating}
                        className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 border-t border-gray-100 text-green-600"
                      >
                        <Tag className="w-3 h-3" />
                        <span>Create &quot;{searchTerm.trim()}&quot;</span>
                        {isCreating && <div className="w-3 h-3 border border-green-600 border-t-transparent rounded-full animate-spin" />}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Default variant (full dropdown interface)
  return (
    <div className={cn('space-y-3', className)}>
      {/* Selected tags display */}
      {selectedTags.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              Selected Tags ({selectedTags.length})
              {showGuestCounts && totalGuestCount > 0 && (
                <span className="ml-2 text-gray-500">
                  • {totalGuestCount} guest{totalGuestCount !== 1 ? 's' : ''}
                </span>
              )}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={clearAll}
              disabled={disabled}
            >
              Clear All
            </Button>
          </div>
          
          <div className="flex flex-wrap gap-1">
            {selectedTags.map((tagName) => {
              const tagOption = availableTags.find(t => t.tag === tagName);
              return (
                <span
                  key={tagName}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-sm rounded-full"
                >
                  <Hash className="w-3 h-3" />
                  {tagName}
                  {showGuestCounts && tagOption && (
                    <span className="text-blue-600">({tagOption.guestCount})</span>
                  )}
                  {!disabled && (
                    <button
                      onClick={() => removeTag(tagName)}
                      className="ml-1 hover:text-blue-900"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Search and selection interface */}
      <div className="space-y-2">
        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={placeholder}
            className="pl-9"
            disabled={disabled}
          />
        </div>

        {/* Available tags */}
        <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
          {filteredTags.length === 0 && !canCreateNewTag ? (
            <div className="p-4 text-sm text-gray-500 text-center">
              {searchTerm ? 'No matching tags found' : 'No tags available'}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredTags.map((tagOption) => {
                const isSelected = selectedTags.includes(tagOption.tag);
                const isDisabled = disabled || 
                  Boolean(maxSelections && !isSelected && selectedTags.length >= maxSelections);

                return (
                  <button
                    key={tagOption.tag}
                    onClick={() => toggleTag(tagOption.tag)}
                    disabled={isDisabled}
                    className={cn(
                      'w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center justify-between transition-colors',
                      isSelected && 'bg-blue-50 text-blue-700',
                      isDisabled && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-4 h-4 border-2 rounded flex items-center justify-center',
                        isSelected 
                          ? 'border-blue-600 bg-blue-600' 
                          : 'border-gray-300'
                      )}>
                        {isSelected && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Hash className="w-3 h-3" />
                        <span className="font-medium">{tagOption.tag}</span>
                      </div>
                    </div>
                    
                    {showGuestCounts && (
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <Users className="w-3 h-3" />
                        <span>{tagOption.guestCount}</span>
                      </div>
                    )}
                  </button>
                );
              })}

              {/* Create new tag option */}
              {canCreateNewTag && (
                <button
                  onClick={handleCreateTag}
                  disabled={isCreating || disabled}
                  className="w-full px-4 py-3 text-left hover:bg-green-50 flex items-center gap-3 text-green-600 border-t border-gray-200"
                >
                  <Tag className="w-4 h-4" />
                  <span>Create &quot;{searchTerm.trim()}&quot;</span>
                  {isCreating && (
                    <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Selection limits info */}
      {maxSelections && (
        <p className="text-xs text-gray-500">
          {selectedTags.length}/{maxSelections} tags selected
        </p>
      )}
    </div>
  );
} 