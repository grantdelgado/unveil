'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { FieldLabel } from '@/components/ui/Typography';
import { cn } from '@/lib/utils';
import { 
  getMessageTemplates, 
  createMessageTemplate, 
  useMessageTemplate,
  interpolateTemplate 
} from '@/lib/services/messageAnalytics';
import type { MessageTemplate, CreateMessageTemplateData } from '@/lib/types/messaging';

type MessageType = 'announcement' | 'reminder' | 'thank_you';

interface TemplateSelectorProps {
  eventId: string;
  messageType: MessageType;
  onTemplateSelect: (content: string) => void;
  onTemplateSave?: (templateData: CreateMessageTemplateData) => void;
  currentContent?: string;
  className?: string;
}

/**
 * Template selector and management component for message composition
 */
export function TemplateSelector({
  eventId,
  messageType,
  onTemplateSelect,
  onTemplateSave,
  currentContent = '',
  className
}: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  
  // Create template form state
  const [newTemplateTitle, setNewTemplateTitle] = useState('');
  const [newTemplateCategory, setNewTemplateCategory] = useState<'greeting' | 'reminder' | 'update' | 'thank_you' | 'custom'>('custom');

  // Get default template variables
  const defaultVariables = {
    guest_name: '[Guest Name]',
    event_title: '[Event Title]',
    event_date: '[Event Date]',
    host_name: '[Host Name]'
  };

  // Filter templates by message type and category
  const relevantTemplates = useMemo(() => {
    return templates.filter(template => {
      // Show templates that match message type or are generic
      if (template.message_type === messageType) return true;
      if (template.category === 'custom') return true;
      
      // Map message types to categories
      const categoryMap = {
        'reminder': 'reminder',
        'thank_you': 'thank_you',
        'announcement': 'update'
      };
      
      return template.category === categoryMap[messageType];
    });
  }, [templates, messageType]);

  const getMessageTypeEmoji = (type: string) => {
    switch (type) {
      case 'reminder': return '📧';
      case 'thank_you': return '🎉';
      case 'announcement': return '📢';
      default: return '💬';
    }
  };

  const getCategoryEmoji = (category: string) => {
    switch (category) {
      case 'greeting': return '👋';
      case 'reminder': return '⏰';
      case 'update': return '📢';
      case 'thank_you': return '🎉';
      default: return '📝';
    }
  };

  const fetchTemplates = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await getMessageTemplates(eventId);
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to fetch templates');
      }
      
      setTemplates(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch templates');
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateSelect = async (template: MessageTemplate) => {
    try {
      // Interpolate template with default variables
      const interpolatedContent = interpolateTemplate(template.content, defaultVariables);
      
      onTemplateSelect(interpolatedContent);
      
      // TODO: Increment usage count - need to create a proper API endpoint for this
      // For now, just update local usage count optimistically
      setTemplates(prev => 
        prev.map(t => 
          t.id === template.id 
            ? { ...t, usage_count: t.usage_count + 1 }
            : t
        )
      );
    } catch (err) {
      console.error('Error using template:', err);
    }
  };

  const handleCreateTemplate = async () => {
    if (!newTemplateTitle.trim() || !currentContent.trim()) return;
    
    setCreateLoading(true);
    
    try {
      const templateData: CreateMessageTemplateData = {
        eventId,
        title: newTemplateTitle.trim(),
        content: currentContent.trim(),
        messageType,
        category: newTemplateCategory
      };
      
      const result = await createMessageTemplate(templateData);
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to create template');
      }
      
      // Add new template to list
      if (result.data) {
        setTemplates(prev => [result.data!, ...prev]);
      }
      
      // Reset form
      setNewTemplateTitle('');
      setNewTemplateCategory('custom');
      setShowCreateForm(false);
      
      onTemplateSave?.(templateData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create template');
    } finally {
      setCreateLoading(false);
    }
  };

  // Load templates on mount
  useEffect(() => {
    fetchTemplates();
  }, [eventId]);

  if (loading && templates.length === 0) {
    return (
      <div className={cn('flex items-center justify-center py-4', className)}>
        <LoadingSpinner size="sm" />
        <span className="ml-2 text-sm text-gray-600">Loading templates...</span>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <FieldLabel className="text-gray-700 font-medium">
          📝 Message Templates
        </FieldLabel>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCreateForm(!showCreateForm)}
          disabled={!currentContent.trim()}
        >
          {showCreateForm ? 'Cancel' : 'Save as Template'}
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="text-sm text-red-800">
            <span className="font-medium">❌ Error:</span> {error}
          </div>
        </div>
      )}

      {/* Create Template Form */}
      {showCreateForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-medium text-blue-900">💾 Save Current Message as Template</h4>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-blue-800 mb-1">
                Template Title
              </label>
              <input
                type="text"
                value={newTemplateTitle}
                onChange={(e) => setNewTemplateTitle(e.target.value)}
                placeholder="e.g., Welcome Message"
                className="w-full px-3 py-2 text-sm border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                maxLength={100}
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-blue-800 mb-1">
                Category
              </label>
              <select
                value={newTemplateCategory}
                onChange={(e) => setNewTemplateCategory(e.target.value as any)}
                className="w-full px-3 py-2 text-sm border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="custom">📝 Custom</option>
                <option value="greeting">👋 Greeting</option>
                <option value="reminder">⏰ Reminder</option>
                <option value="update">📢 Update</option>
                <option value="thank_you">🎉 Thank You</option>
              </select>
            </div>
          </div>
          
          <div className="text-xs text-blue-700 bg-blue-100 rounded px-2 py-1">
            💡 Tip: Use variables like {`{{guest_name}}`}, {`{{event_title}}`} for personalization
          </div>
          
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleCreateTemplate}
              disabled={!newTemplateTitle.trim() || createLoading}
            >
              {createLoading ? (
                <>
                  <LoadingSpinner size="sm" />
                  Saving...
                </>
              ) : (
                'Save Template'
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateForm(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Templates List */}
      {relevantTemplates.length > 0 ? (
        <div className="space-y-2">
          <div className="text-xs text-gray-500 mb-2">
            {relevantTemplates.length} template{relevantTemplates.length !== 1 ? 's' : ''} for {messageType} messages
          </div>
          
          {relevantTemplates.map((template) => (
            <div
              key={template.id}
              className="bg-gray-50 border border-gray-200 rounded-lg p-3 hover:bg-gray-100 transition-colors cursor-pointer"
              onClick={() => handleTemplateSelect(template)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  {/* Template Header */}
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-sm">{getCategoryEmoji(template.category)}</span>
                    <span className="text-sm font-medium text-gray-900">{template.title}</span>
                    <span className="text-xs text-gray-500">
                      Used {template.usage_count} time{template.usage_count !== 1 ? 's' : ''}
                    </span>
                  </div>
                  
                  {/* Template Preview */}
                  <div className="text-xs text-gray-600 mb-2">
                    {template.content.length > 120 
                      ? `${template.content.substring(0, 120)}...`
                      : template.content
                    }
                  </div>
                  
                  {/* Variables Display */}
                  {template.variables.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {template.variables.map((variable) => (
                        <span
                          key={variable}
                          className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded"
                        >
                          {`{{${variable}}}`}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-3 text-xs"
                >
                  Use Template
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <div className="text-2xl mb-2">📝</div>
          <div className="text-sm text-gray-600 mb-1">
            No templates yet for {messageType} messages
          </div>
          <div className="text-xs text-gray-500">
            Write a message and save it as a template to reuse later
          </div>
        </div>
      )}

      {/* Template Variables Help */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
        <h5 className="text-xs font-medium text-gray-700 mb-2">📋 Available Variables:</h5>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div><code className="bg-gray-200 px-1 rounded">{`{{guest_name}}`}</code> - Guest's name</div>
          <div><code className="bg-gray-200 px-1 rounded">{`{{event_title}}`}</code> - Event title</div>
          <div><code className="bg-gray-200 px-1 rounded">{`{{event_date}}`}</code> - Event date</div>
          <div><code className="bg-gray-200 px-1 rounded">{`{{host_name}}`}</code> - Your name</div>
        </div>
      </div>
    </div>
  );
}
