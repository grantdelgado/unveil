import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock localStorage for testing
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Types for audience presets
interface AudiencePreset {
  id: string;
  name: string;
  createdAt: string;
  selection: {
    selectedGuestIds: string[];
    searchQuery: string;
    filterOptions: any;
  };
  guestCount: number;
}

// Mock preset management functions (extracted from component for testability)
class AudiencePresetManager {
  private storageKey: string;

  constructor(eventId: string) {
    this.storageKey = `unveil:audience-presets:v1:${eventId}`;
  }

  loadPresets(): AudiencePreset[] {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        return JSON.parse(stored);
      }
      return [];
    } catch (error) {
      console.warn('Failed to load audience presets:', error);
      return [];
    }
  }

  savePresets(presets: AudiencePreset[]): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(presets));
    } catch (error) {
      console.warn('Failed to save audience presets:', error);
    }
  }

  generatePresetName(baseName: string, existingPresets: AudiencePreset[]): string {
    const existingNames = existingPresets.map(p => p.name);
    if (!existingNames.includes(baseName)) {
      return baseName;
    }
    
    let counter = 2;
    while (existingNames.includes(`${baseName} (${counter})`)) {
      counter++;
    }
    return `${baseName} (${counter})`;
  }

  createPreset(
    name: string,
    selection: AudiencePreset['selection'],
    existingPresets: AudiencePreset[]
  ): AudiencePreset {
    const finalName = this.generatePresetName(name, existingPresets);
    return {
      id: `preset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: finalName,
      createdAt: new Date().toISOString(),
      selection,
      guestCount: selection.selectedGuestIds.length,
    };
  }

  addPreset(preset: AudiencePreset, maxPresets: number = 10): AudiencePreset[] {
    const existingPresets = this.loadPresets();
    const updatedPresets = [preset, ...existingPresets].slice(0, maxPresets);
    this.savePresets(updatedPresets);
    return updatedPresets;
  }

  deletePreset(presetId: string): AudiencePreset[] {
    const existingPresets = this.loadPresets();
    const updatedPresets = existingPresets.filter(p => p.id !== presetId);
    this.savePresets(updatedPresets);
    return updatedPresets;
  }
}

describe('Audience Preset Manager', () => {
  let manager: AudiencePresetManager;
  const eventId = 'test-event-123';

  beforeEach(() => {
    manager = new AudiencePresetManager(eventId);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('loadPresets', () => {
    it('should return empty array when no presets stored', () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      const result = manager.loadPresets();
      
      expect(result).toEqual([]);
      expect(localStorageMock.getItem).toHaveBeenCalledWith(`unveil:audience-presets:v1:${eventId}`);
    });

    it('should parse and return stored presets', () => {
      const mockPresets = [
        {
          id: 'preset1',
          name: 'Family',
          createdAt: '2025-01-01T00:00:00.000Z',
          selection: { selectedGuestIds: ['guest1', 'guest2'], searchQuery: '', filterOptions: {} },
          guestCount: 2,
        },
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockPresets));
      
      const result = manager.loadPresets();
      
      expect(result).toEqual(mockPresets);
    });

    it('should return empty array on parse error', () => {
      localStorageMock.getItem.mockReturnValue('invalid json');
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const result = manager.loadPresets();
      
      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to load audience presets:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('generatePresetName', () => {
    it('should return original name when no conflicts', () => {
      const existingPresets: AudiencePreset[] = [];
      
      const result = manager.generatePresetName('Family', existingPresets);
      
      expect(result).toBe('Family');
    });

    it('should append (2) for first conflict', () => {
      const existingPresets: AudiencePreset[] = [
        {
          id: 'preset1',
          name: 'Family',
          createdAt: '2025-01-01T00:00:00.000Z',
          selection: { selectedGuestIds: [], searchQuery: '', filterOptions: {} },
          guestCount: 0,
        },
      ];
      
      const result = manager.generatePresetName('Family', existingPresets);
      
      expect(result).toBe('Family (2)');
    });

    it('should increment counter for multiple conflicts', () => {
      const existingPresets: AudiencePreset[] = [
        {
          id: 'preset1',
          name: 'Family',
          createdAt: '2025-01-01T00:00:00.000Z',
          selection: { selectedGuestIds: [], searchQuery: '', filterOptions: {} },
          guestCount: 0,
        },
        {
          id: 'preset2',
          name: 'Family (2)',
          createdAt: '2025-01-01T00:00:00.000Z',
          selection: { selectedGuestIds: [], searchQuery: '', filterOptions: {} },
          guestCount: 0,
        },
      ];
      
      const result = manager.generatePresetName('Family', existingPresets);
      
      expect(result).toBe('Family (3)');
    });
  });

  describe('createPreset', () => {
    it('should create preset with correct structure', () => {
      const selection = {
        selectedGuestIds: ['guest1', 'guest2', 'guest3'],
        searchQuery: 'family',
        filterOptions: {},
      };
      const existingPresets: AudiencePreset[] = [];
      
      const result = manager.createPreset('Family Members', selection, existingPresets);
      
      expect(result).toMatchObject({
        name: 'Family Members',
        selection,
        guestCount: 3,
      });
      expect(result.id).toMatch(/^preset_\d+_[a-z0-9]+$/);
      expect(result.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should handle name conflicts', () => {
      const selection = {
        selectedGuestIds: ['guest1'],
        searchQuery: '',
        filterOptions: {},
      };
      const existingPresets: AudiencePreset[] = [
        {
          id: 'existing',
          name: 'Test Preset',
          createdAt: '2025-01-01T00:00:00.000Z',
          selection: { selectedGuestIds: [], searchQuery: '', filterOptions: {} },
          guestCount: 0,
        },
      ];
      
      const result = manager.createPreset('Test Preset', selection, existingPresets);
      
      expect(result.name).toBe('Test Preset (2)');
    });
  });

  describe('addPreset', () => {
    it('should add preset and save to localStorage', () => {
      const preset: AudiencePreset = {
        id: 'new-preset',
        name: 'New Preset',
        createdAt: '2025-01-01T00:00:00.000Z',
        selection: { selectedGuestIds: ['guest1'], searchQuery: '', filterOptions: {} },
        guestCount: 1,
      };
      localStorageMock.getItem.mockReturnValue('[]');
      
      const result = manager.addPreset(preset);
      
      expect(result).toEqual([preset]);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        `unveil:audience-presets:v1:${eventId}`,
        JSON.stringify([preset])
      );
    });

    it('should limit presets to maximum count', () => {
      const existingPresets = Array.from({ length: 10 }, (_, i) => ({
        id: `preset${i}`,
        name: `Preset ${i}`,
        createdAt: '2025-01-01T00:00:00.000Z',
        selection: { selectedGuestIds: [], searchQuery: '', filterOptions: {} },
        guestCount: 0,
      }));
      localStorageMock.getItem.mockReturnValue(JSON.stringify(existingPresets));
      
      const newPreset: AudiencePreset = {
        id: 'new-preset',
        name: 'New Preset',
        createdAt: '2025-01-01T00:00:00.000Z',
        selection: { selectedGuestIds: [], searchQuery: '', filterOptions: {} },
        guestCount: 0,
      };
      
      const result = manager.addPreset(newPreset, 10);
      
      expect(result).toHaveLength(10);
      expect(result[0]).toEqual(newPreset); // New preset should be first
      expect(result[9]).toEqual(existingPresets[8]); // Last existing preset should be dropped
    });
  });

  describe('deletePreset', () => {
    it('should remove preset by id and save to localStorage', () => {
      const presets: AudiencePreset[] = [
        {
          id: 'preset1',
          name: 'Preset 1',
          createdAt: '2025-01-01T00:00:00.000Z',
          selection: { selectedGuestIds: [], searchQuery: '', filterOptions: {} },
          guestCount: 0,
        },
        {
          id: 'preset2',
          name: 'Preset 2',
          createdAt: '2025-01-01T00:00:00.000Z',
          selection: { selectedGuestIds: [], searchQuery: '', filterOptions: {} },
          guestCount: 0,
        },
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(presets));
      
      const result = manager.deletePreset('preset1');
      
      expect(result).toEqual([presets[1]]);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        `unveil:audience-presets:v1:${eventId}`,
        JSON.stringify([presets[1]])
      );
    });

    it('should handle deletion of non-existent preset', () => {
      const presets: AudiencePreset[] = [
        {
          id: 'preset1',
          name: 'Preset 1',
          createdAt: '2025-01-01T00:00:00.000Z',
          selection: { selectedGuestIds: [], searchQuery: '', filterOptions: {} },
          guestCount: 0,
        },
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(presets));
      
      const result = manager.deletePreset('non-existent');
      
      expect(result).toEqual(presets); // No change
    });
  });
});
