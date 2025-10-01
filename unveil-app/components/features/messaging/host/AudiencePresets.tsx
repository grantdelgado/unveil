'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { Save, ChevronDown, Trash2 } from 'lucide-react';

interface AudiencePreset {
  id: string;
  name: string;
  createdAt: string;
  selection: {
    selectedGuestIds: string[];
    searchQuery: string;
    filterOptions?: Record<string, unknown>;
  };
  guestCount: number;
}

interface AudiencePresetsProps {
  eventId: string;
  currentSelection: {
    selectedGuestIds: string[];
    searchQuery: string;
    filterOptions?: Record<string, unknown>;
  };
  onLoadPreset: (selection: AudiencePreset['selection']) => void;
  className?: string;
}

const STORAGE_KEY_PREFIX = 'unveil:audience-presets:v1:';
const MAX_PRESETS = 10;

export function AudiencePresets({
  eventId,
  currentSelection,
  onLoadPreset,
  className,
}: AudiencePresetsProps) {
  const [presets, setPresets] = useState<AudiencePreset[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showPresetsDropdown, setShowPresetsDropdown] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const storageKey = `${STORAGE_KEY_PREFIX}${eventId}`;

  // Load presets from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsedPresets = JSON.parse(stored);
        setPresets(parsedPresets);
      }
    } catch (error) {
      console.warn('Failed to load audience presets:', error);
    }
  }, [storageKey]);

  // Save presets to localStorage
  const savePresetsToStorage = (newPresets: AudiencePreset[]) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(newPresets));
      setPresets(newPresets);
    } catch (error) {
      console.warn('Failed to save audience presets:', error);
    }
  };

  // Generate unique preset name
  const generatePresetName = (baseName: string): string => {
    const existingNames = presets.map(p => p.name);
    if (!existingNames.includes(baseName)) {
      return baseName;
    }
    
    let counter = 2;
    while (existingNames.includes(`${baseName} (${counter})`)) {
      counter++;
    }
    return `${baseName} (${counter})`;
  };

  // Save current selection as preset
  const handleSavePreset = async () => {
    if (!presetName.trim() || isSaving) return;
    
    setIsSaving(true);
    
    try {
      const finalName = generatePresetName(presetName.trim());
      const newPreset: AudiencePreset = {
        id: `preset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: finalName,
        createdAt: new Date().toISOString(),
        selection: currentSelection,
        guestCount: currentSelection.selectedGuestIds.length,
      };

      // Add new preset and limit to MAX_PRESETS
      const updatedPresets = [newPreset, ...presets].slice(0, MAX_PRESETS);
      savePresetsToStorage(updatedPresets);
      
      setPresetName('');
      setShowSaveModal(false);
      
      // Dev observability
      if (process.env.NODE_ENV === 'development') {
        console.log('audience_preset', { 
          action: 'save', 
          name: finalName, 
          count: newPreset.guestCount 
        });
      }
    } catch (error) {
      console.error('Failed to save preset:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Load preset
  const handleLoadPreset = (preset: AudiencePreset) => {
    onLoadPreset(preset.selection);
    setShowPresetsDropdown(false);
    
    // Dev observability
    if (process.env.NODE_ENV === 'development') {
      console.log('audience_preset', { 
        action: 'load', 
        name: preset.name, 
        count: preset.guestCount 
      });
    }
  };

  // Delete preset
  const handleDeletePreset = (presetId: string) => {
    const preset = presets.find(p => p.id === presetId);
    const updatedPresets = presets.filter(p => p.id !== presetId);
    savePresetsToStorage(updatedPresets);
    
    // Dev observability
    if (process.env.NODE_ENV === 'development' && preset) {
      console.log('audience_preset', { 
        action: 'delete', 
        name: preset.name, 
        count: preset.guestCount 
      });
    }
  };

  const canSave = currentSelection.selectedGuestIds.length > 0;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Save Preset Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowSaveModal(true)}
        disabled={!canSave}
        className="min-h-[44px] px-3"
        title={canSave ? 'Save current audience selection' : 'Select guests to save preset'}
      >
        <Save className="h-4 w-4" />
      </Button>

      {/* Load Presets Dropdown */}
      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowPresetsDropdown(!showPresetsDropdown)}
          disabled={presets.length === 0}
          className="min-h-[44px] px-3"
          title={presets.length > 0 ? 'Load saved preset' : 'No presets saved yet'}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>

        {/* Dropdown Menu */}
        {showPresetsDropdown && presets.length > 0 && (
          <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
            <div className="p-2 border-b border-gray-100">
              <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                Saved Presets
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {presets.map((preset) => (
                <div
                  key={preset.id}
                  className="flex items-center justify-between p-3 hover:bg-gray-50 group"
                >
                  <button
                    onClick={() => handleLoadPreset(preset)}
                    className="flex-1 text-left min-h-[44px] flex flex-col justify-center"
                  >
                    <div className="font-medium text-gray-900 text-sm">
                      {preset.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {preset.guestCount} guest{preset.guestCount !== 1 ? 's' : ''} • {' '}
                      {new Date(preset.createdAt).toLocaleDateString()}
                    </div>
                  </button>
                  <button
                    onClick={() => handleDeletePreset(preset.id)}
                    className="p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="Delete preset"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Save Audience Preset
              </h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="preset-name" className="block text-sm font-medium text-gray-700 mb-2">
                    Preset name
                  </label>
                  <input
                    id="preset-name"
                    type="text"
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    placeholder="e.g., Family members, Wedding party"
                    maxLength={40}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    autoFocus
                  />
                  <div className="flex justify-between items-center mt-1">
                    <div className="text-xs text-gray-500">
                      {currentSelection.selectedGuestIds.length} guest{currentSelection.selectedGuestIds.length !== 1 ? 's' : ''} selected
                    </div>
                    <div className="text-xs text-gray-400">
                      {presetName.length}/40
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowSaveModal(false);
                    setPresetName('');
                  }}
                  disabled={isSaving}
                  className="min-h-[44px]"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSavePreset}
                  disabled={!presetName.trim() || isSaving}
                  className="min-h-[44px]"
                >
                  {isSaving ? 'Saving...' : 'Save Preset'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close dropdown */}
      {showPresetsDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowPresetsDropdown(false)}
        />
      )}
    </div>
  );
}
