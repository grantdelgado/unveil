'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface MessageTemplate {
  id: string;
  name: string;
  icon: string;
  category: 'reminder' | 'welcome' | 'update' | 'logistics';
  content: string;
  description: string;
}

interface MessageTemplatesProps {
  onTemplateSelect: (template: MessageTemplate) => void;
  className?: string;
}

const messageTemplates: MessageTemplate[] = [
  {
    id: 'rsvp-reminder',
    name: 'RSVP Reminder',
    icon: '⏰',
    category: 'reminder',
    content: "Hi! We're getting excited for the big day and finalizing details. Could you please confirm your attendance when you get a chance? Thanks! 💕",
    description: 'Gentle reminder for pending RSVPs'
  },
  {
    id: 'welcome-attending',
    name: 'Welcome Message',
    icon: '🎉',
    category: 'welcome',
    content: "Thank you so much for confirming your attendance! We can't wait to celebrate with you. Stay tuned for more details coming soon! 💖",
    description: 'Thank attending guests'
  },
  {
    id: 'final-details',
    name: 'Final Details',
    icon: '📋',
    category: 'logistics',
    content: "The big day is almost here! Here are the final details you'll need: [Insert details here]. Looking forward to seeing you! ✨",
    description: 'Last-minute event details'
  },
  {
    id: 'day-before',
    name: 'Day Before Reminder',
    icon: '⭐',
    category: 'reminder',
    content: "Tomorrow's the day! We're so excited to celebrate with you. Don't forget: [Insert any last reminders]. See you soon! 🥳",
    description: 'Final day-before excitement'
  },
  {
    id: 'location-update',
    name: 'Location Update',
    icon: '📍',
    category: 'update',
    content: "Quick update on the venue location: [Insert updated details]. If you have any questions, please let us know! 🗺️",
    description: 'Venue or location changes'
  },
  {
    id: 'thank-you',
    name: 'Thank You',
    icon: '💕',
    category: 'update',
    content: "Thank you for being part of our special day! It means the world to us to have you there. With love and gratitude! 🙏",
    description: 'Post-event or general thanks'
  },
  {
    id: 'weather-update',
    name: 'Weather Alert',
    icon: '🌤️',
    category: 'update',
    content: "Just wanted to give you a heads up about the weather forecast: [Insert weather info]. Please dress accordingly! 🌈",
    description: 'Weather-related updates'
  },
  {
    id: 'parking-info',
    name: 'Parking Info',
    icon: '🚗',
    category: 'logistics',
    content: "Here's helpful parking information for the venue: [Insert parking details]. See you there! 🅿️",
    description: 'Parking and transportation'
  }
];

export function MessageTemplates({ onTemplateSelect, className }: MessageTemplatesProps) {
  const categories = ['reminder', 'welcome', 'update', 'logistics'] as const;
  
  const getCategoryLabel = (category: MessageTemplate['category']) => {
    switch (category) {
      case 'reminder': return 'Reminders';
      case 'welcome': return 'Welcome';
      case 'update': return 'Updates';
      case 'logistics': return 'Logistics';
    }
  };

  const getCategoryColor = (category: MessageTemplate['category']) => {
    switch (category) {
      case 'reminder': return 'bg-orange-50 border-orange-200 text-orange-800';
      case 'welcome': return 'bg-green-50 border-green-200 text-green-800';
      case 'update': return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'logistics': return 'bg-purple-50 border-purple-200 text-purple-800';
    }
  };

  return (
    <div className={cn('space-y-6', className)}>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">💬</span>
        <h3 className="text-lg font-medium text-gray-900">Message Templates</h3>
      </div>

      {categories.map(category => {
        const templates = messageTemplates.filter(t => t.category === category);
        if (templates.length === 0) return null;

        return (
          <div key={category} className="space-y-3">
            <h4 className={cn(
              'text-sm font-medium px-3 py-1 rounded-full inline-block border',
              getCategoryColor(category)
            )}>
              {getCategoryLabel(category)}
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {templates.map(template => (
                <button
                  key={template.id}
                  onClick={() => onTemplateSelect(template)}
                  className={cn(
                    'p-4 text-left border border-gray-200 rounded-lg transition-all duration-200',
                    'hover:border-[#FF6B6B] hover:shadow-sm active:scale-[0.98]',
                    'focus:outline-none focus:ring-2 focus:ring-[#FF6B6B] focus:ring-offset-1',
                    'min-h-[100px] flex flex-col justify-between'
                  )}
                >
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg" role="img" aria-hidden="true">
                        {template.icon}
                      </span>
                      <span className="font-medium text-gray-900 text-sm">
                        {template.name}
                      </span>
                    </div>
                    
                    <p className="text-xs text-gray-600 mb-3 line-clamp-2">
                      {template.description}
                    </p>
                  </div>
                  
                  <div className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1 line-clamp-2">
                    {template.content.length > 60 
                      ? `${template.content.substring(0, 60)}...` 
                      : template.content}
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}

      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="flex items-start gap-3">
          <span className="text-lg">💡</span>
          <div className="text-sm text-gray-600">
            <p className="font-medium mb-1">Pro Tip</p>
            <p>Tap any template to pre-fill your message, then customize it before sending. 
               Templates are especially helpful for common situations like RSVP reminders and event updates.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export type { MessageTemplate }; 