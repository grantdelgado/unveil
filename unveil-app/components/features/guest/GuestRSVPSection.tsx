'use client';

import { cn } from '@/lib/utils';

interface GuestRSVPSectionProps {
  onStatusUpdate: (status: string) => Promise<void>;
  isUpdating?: boolean;
}

const RSVPButton = ({ 
  status, 
  children, 
  onClick,
  isUpdating = false
}: { 
  status: string; 
  children: React.ReactNode; 
  onClick: () => void;
  isUpdating?: boolean;
}) => {
  const getColorClasses = () => {
    switch (status) {
      case 'Attending':
        return 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 hover:border-emerald-300 focus:ring-emerald-300';
      case 'Maybe':
        return 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 hover:border-amber-300 focus:ring-amber-300';
      case 'Declined':
        return 'bg-stone-50 text-stone-700 hover:bg-stone-100 border border-stone-200 hover:border-stone-300 focus:ring-stone-300';
      default:
        return 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 hover:border-purple-300 focus:ring-purple-300';
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={isUpdating}
      className={cn(
        "w-full py-4 px-4 rounded-xl font-medium transition-all duration-300",
        "hover:scale-[1.01] hover:shadow-md active:scale-[0.99]",
        "focus:outline-none focus:ring-2 focus:ring-offset-2",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        getColorClasses()
      )}
    >
      {isUpdating ? (
        <div className="flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
          Updating...
        </div>
      ) : (
        children
      )}
    </button>
  );
};

export function GuestRSVPSection({ onStatusUpdate, isUpdating = false }: GuestRSVPSectionProps) {
  return (
    <div className="max-w-5xl mx-auto px-6 mt-4 mb-6">
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-5">
        <div className="space-y-5">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold text-stone-800">Will you be joining us?</h2>
            <p className="text-sm text-stone-600">Let us know if you can celebrate with us</p>
          </div>

          <div className="space-y-3 max-w-md mx-auto">
            <RSVPButton 
              status="Attending" 
              onClick={() => onStatusUpdate('Attending')}
              isUpdating={isUpdating}
            >
              Yes, I&apos;ll be there
            </RSVPButton>

            <RSVPButton 
              status="Maybe" 
              onClick={() => onStatusUpdate('Maybe')}
              isUpdating={isUpdating}
            >
              I&apos;m not sure yet
            </RSVPButton>

            <RSVPButton 
              status="Declined" 
              onClick={() => onStatusUpdate('Declined')}
              isUpdating={isUpdating}
            >
              I can&apos;t make it
            </RSVPButton>
          </div>
        </div>
      </div>
    </div>
  );
}
