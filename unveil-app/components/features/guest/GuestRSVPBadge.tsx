'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GuestRSVPBadgeProps {
  currentStatus: string | null;
  onStatusUpdate: (status: string) => Promise<void>;
  isScrolled?: boolean;
}

const RSVP_OPTIONS = [
  { value: 'Attending', label: 'Attending', color: 'emerald' },
  { value: 'Maybe', label: 'Maybe', color: 'amber' },
  { value: 'Declined', label: 'Not Attending', color: 'stone' },
];

export function GuestRSVPBadge({ currentStatus, onStatusUpdate, isScrolled = false }: GuestRSVPBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getBadgeText = () => {
    if (!currentStatus) return 'RSVP Required';
    
    const option = RSVP_OPTIONS.find(opt => opt.value.toLowerCase() === currentStatus.toLowerCase());
    return option ? `Your RSVP: ${option.label}` : 'Your RSVP: Pending';
  };

  const getBadgeColor = () => {
    if (!currentStatus) return 'bg-purple-50 text-purple-700 border-purple-200';
    
    switch (currentStatus.toLowerCase()) {
      case 'attending':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'maybe':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'declined':
        return 'bg-stone-50 text-stone-700 border-stone-200';
      default:
        return 'bg-stone-50 text-stone-700 border-stone-200';
    }
  };

  const handleStatusSelect = async (status: string) => {
    setIsUpdating(true);
    try {
      await onStatusUpdate(status);
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to update RSVP:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isUpdating}
        className={cn(
          "min-w-[180px] h-10 rounded-full border px-4 py-2 text-sm font-medium bg-white shadow-sm transition-all duration-200 ease-in-out",
          "hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:ring-offset-2",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "flex items-center justify-between",
          isScrolled ? "text-xs px-3 h-8 min-w-[160px]" : "",
          getBadgeColor()
        )}
      >
        <span className="truncate">{getBadgeText()}</span>
        {isUpdating ? (
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin ml-2 flex-shrink-0" />
        ) : (
          <ChevronDown className={cn(
            "w-4 h-4 ml-2 flex-shrink-0 transition-transform duration-200",
            isOpen ? "rotate-180" : ""
          )} />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-stone-200 py-2 z-50">
          {RSVP_OPTIONS.map((option) => {
            const isSelected = currentStatus?.toLowerCase() === option.value.toLowerCase();
            
            return (
              <button
                key={option.value}
                onClick={() => handleStatusSelect(option.value)}
                className={cn(
                  "w-full px-4 py-3 text-left text-sm hover:bg-stone-50 transition-colors duration-150",
                  "flex items-center justify-between",
                  "focus:outline-none focus:bg-stone-50",
                  isSelected ? "text-stone-900 font-medium" : "text-stone-700"
                )}
              >
                <span>{option.label}</span>
                {isSelected && (
                  <Check className="w-4 h-4 text-emerald-600" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
