'use client';

import React, { useState, useCallback, useMemo, memo } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/utils';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Users, 
  Tag, 
  Check, 
  X, 
  AlertCircle,
  Hash,
  Settings
} from 'lucide-react';
import { useGuestTags } from '@/hooks/messaging/useGuestTags';
import type { Tables } from '@/app/reference/supabase.types';

type EventGuest = Tables<'event_guests'>;

interface TagWithUsage {
  tag: string;
  guestCount: number;
  guests: EventGuest[];
}

interface GuestTagManagerProps {
  eventId: string;
  onTagsChange?: (tags: TagWithUsage[]) => void;
  className?: string;
}

function GuestTagManagerComponent({
  eventId,
  onTagsChange,
  className
}: GuestTagManagerProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [editTagName, setEditTagName] = useState('');
  const [showBulkAssignment, setShowBulkAssignment] = useState(false);
  const [selectedGuests, setSelectedGuests] = useState<string[]>([]);
  const [assignmentTags, setAssignmentTags] = useState<string[]>([]);

  const {
    tags,
    guests,
    loading,
    error,
    createTag,
    updateTag,
    deleteTag,
    assignTagsToGuests,
    refresh
  } = useGuestTags(eventId);

  // Memoized expensive computations
  const tagUsageStats = useMemo(() => {
    return tags.reduce((acc, tagName) => {
      const guestsWithTag = guests.filter(guest => 
        guest.guest_tags?.includes(tagName)
      );
      
      acc[tagName] = {
        tag: tagName,
        guestCount: guestsWithTag.length,
        guests: guestsWithTag
      };
      return acc;
    }, {} as Record<string, TagWithUsage>);
  }, [tags, guests]);

  const sortedTagsWithUsage = useMemo(() => {
    return Object.values(tagUsageStats)
      .sort((a, b) => b.guestCount - a.guestCount);
  }, [tagUsageStats]);

  // Memoized validation function
  const validateTagName = useCallback((name: string): string | null => {
    if (!name.trim()) return 'Tag name is required';
    if (name.length > 20) return 'Tag name must be 20 characters or less';
    if (!/^[a-zA-Z0-9\s-_]+$/.test(name)) return 'Tag name can only contain letters, numbers, spaces, hyphens, and underscores';
    if (tags.includes(name.toLowerCase())) return 'Tag already exists';
    return null;
  }, [tags]);

  // Memoized event handlers
  const handleCreateTag = useCallback(async () => {
    const validation = validateTagName(newTagName);
    if (validation) {
      alert(validation);
      return;
    }

    try {
      await createTag(newTagName.trim());
      setNewTagName('');
      setIsCreating(false);
    } catch (err) {
      console.error('Error creating tag:', err);
      alert('Failed to create tag');
    }
  }, [newTagName, validateTagName, createTag]);

  const handleUpdateTag = useCallback(async (oldTag: string) => {
    const validation = validateTagName(editTagName);
    if (validation) {
      alert(validation);
      return;
    }

    try {
      await updateTag(oldTag, editTagName.trim());
      setEditingTag(null);
      setEditTagName('');
    } catch (err) {
      console.error('Error updating tag:', err);
      alert('Failed to update tag');
    }
  }, [editTagName, validateTagName, updateTag]);

  const handleDeleteTag = useCallback(async (tagName: string) => {
    const usage = tagUsageStats[tagName];
    const confirmMessage = usage?.guestCount > 0 
      ? `Delete "${tagName}"? This will remove it from ${usage.guestCount} guest(s).`
      : `Delete "${tagName}"?`;

    if (!confirm(confirmMessage)) return;

    try {
      await deleteTag(tagName);
    } catch (err) {
      console.error('Error deleting tag:', err);
      alert('Failed to delete tag');
    }
  }, [tagUsageStats, deleteTag]);

  const startEditingTag = useCallback((tagName: string) => {
    setEditingTag(tagName);
    setEditTagName(tagName);
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingTag(null);
    setEditTagName('');
  }, []);

  const toggleGuestSelection = useCallback((guestId: string) => {
    setSelectedGuests(prev => 
      prev.includes(guestId) 
        ? prev.filter(id => id !== guestId)
        : [...prev, guestId]
    );
  }, []);

  const handleBulkAssignment = useCallback(async () => {
    if (selectedGuests.length === 0 || assignmentTags.length === 0) {
      alert('Please select guests and tags');
      return;
    }

    try {
      await assignTagsToGuests(selectedGuests, assignmentTags);
      setSelectedGuests([]);
      setAssignmentTags([]);
      setShowBulkAssignment(false);
    } catch (err) {
      console.error('Error in bulk assignment:', err);
      alert('Failed to assign tags');
    }
  }, [selectedGuests, assignmentTags, assignTagsToGuests]);

  // Effect to notify parent of tag changes
  React.useEffect(() => {
    if (onTagsChange) {
      onTagsChange(sortedTagsWithUsage);
    }
  }, [sortedTagsWithUsage, onTagsChange]);

  // Input change handlers
  const handleNewTagNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNewTagName(e.target.value);
  }, []);

  const handleEditTagNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEditTagName(e.target.value);
  }, []);

  // Toggle handlers
  const handleToggleCreating = useCallback(() => {
    setIsCreating(prev => !prev);
    setNewTagName('');
  }, []);

  const handleToggleBulkAssignment = useCallback(() => {
    setShowBulkAssignment(prev => !prev);
    setSelectedGuests([]);
    setAssignmentTags([]);
  }, []);

  if (loading) {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <LoadingSpinner size="lg" />
            <p className="text-sm text-gray-600">Loading tags...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-red-800 mb-2">Error Loading Tags</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={refresh} variant="secondary">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Tag className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Guest Tags</h2>
            <p className="text-sm text-gray-600">
              {tags.length} tag{tags.length !== 1 ? 's' : ''} • {guests.length} guest{guests.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={handleToggleBulkAssignment}
            disabled={tags.length === 0 || guests.length === 0}
          >
            <Settings className="w-4 h-4 mr-2" />
            Bulk Assign
          </Button>

          <Button onClick={handleToggleCreating}>
            <Plus className="w-4 h-4 mr-2" />
            New Tag
          </Button>
        </div>
      </div>

      {/* Create New Tag */}
      {isCreating && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Input
                value={newTagName}
                onChange={handleNewTagNameChange}
                placeholder="Enter tag name (max 20 characters)"
                maxLength={20}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateTag();
                  if (e.key === 'Escape') {
                    setIsCreating(false);
                    setNewTagName('');
                  }
                }}
              />
            </div>
            <Button onClick={handleCreateTag} size="sm">
              <Check className="w-4 h-4" />
            </Button>
            <Button 
              variant="secondary" 
              size="sm"
              onClick={handleToggleCreating}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {newTagName.length}/20 characters
          </p>
        </div>
      )}

      {/* Tag List */}
      {sortedTagsWithUsage.length === 0 ? (
        <EmptyState
          variant="generic"
          title="No tags yet"
          description="Create your first tag to start organizing your guests by categories like family, friends, or plus-ones."
          actionText="Create Tag"
          onAction={handleToggleCreating}
        />
      ) : (
        <div className="space-y-3">
          {sortedTagsWithUsage.map((tagUsage) => (
            <div
              key={tagUsage.tag}
              className="bg-white border border-gray-200 rounded-lg p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {editingTag === tagUsage.tag ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        value={editTagName}
                        onChange={handleEditTagNameChange}
                        className="flex-1"
                        maxLength={20}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleUpdateTag(tagUsage.tag);
                          if (e.key === 'Escape') cancelEditing();
                        }}
                      />
                      <Button 
                        size="sm" 
                        onClick={() => handleUpdateTag(tagUsage.tag)}
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="secondary" 
                        size="sm"
                        onClick={cancelEditing}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <Hash className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-gray-900">
                          {tagUsage.tag}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <Users className="w-3 h-3" />
                        <span>{tagUsage.guestCount}</span>
                      </div>
                    </>
                  )}
                </div>

                {editingTag !== tagUsage.tag && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => startEditingTag(tagUsage.tag)}
                    >
                      <Edit2 className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleDeleteTag(tagUsage.tag)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Show guests with this tag */}
              {tagUsage.guestCount > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex flex-wrap gap-1">
                    {tagUsage.guests.slice(0, 5).map((guest) => (
                      <span
                        key={guest.id}
                        className="inline-flex items-center px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded"
                      >
                        {guest.guest_name || guest.phone}
                      </span>
                    ))}
                    {tagUsage.guestCount > 5 && (
                      <span className="inline-flex items-center px-2 py-1 text-xs bg-gray-100 text-gray-500 rounded">
                        +{tagUsage.guestCount - 5} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Bulk Assignment Modal */}
      {showBulkAssignment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Bulk Tag Assignment
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Select guests and tags to assign
              </p>
            </div>

            <div className="p-6 overflow-y-auto">
              {/* Tag Selection */}
              <div className="mb-6">
                <h4 className="font-medium text-gray-900 mb-3">Select Tags</h4>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setAssignmentTags(prev => 
                        prev.includes(tag) 
                          ? prev.filter(t => t !== tag)
                          : [...prev, tag]
                      )}
                      className={cn(
                        'px-3 py-1 text-sm rounded-full border transition-colors',
                        assignmentTags.includes(tag)
                          ? 'bg-purple-200 border-purple-300 text-purple-700'
                          : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                      )}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Guest Selection */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">
                  Select Guests ({selectedGuests.length} selected)
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {guests.map((guest) => (
                    <label
                      key={guest.id}
                      className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedGuests.includes(guest.id)}
                        onChange={() => toggleGuestSelection(guest.id)}
                        className="rounded border-gray-300"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">
                          {guest.guest_name || 'Unnamed Guest'}
                        </div>
                        <div className="text-sm text-gray-600">
                          {guest.phone}
                          {guest.guest_tags && guest.guest_tags.length > 0 && (
                            <span className="ml-2">
                              Tags: {guest.guest_tags.join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={handleToggleBulkAssignment}
              >
                Cancel
              </Button>
              <Button
                onClick={handleBulkAssignment}
                disabled={selectedGuests.length === 0 || assignmentTags.length === 0}
              >
                Assign Tags
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Memoize the component
export const GuestTagManager = memo(GuestTagManagerComponent); 