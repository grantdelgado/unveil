'use client';

import React, { useState } from 'react';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { MessageAnalytics } from '@/services/messaging/analytics';

export interface ExportButtonProps {
  analytics: MessageAnalytics | null;
  eventName?: string;
  disabled?: boolean;
  className?: string;
}

// Simple CSV conversion utility (avoiding external dependencies)
function convertToCSV(data: Record<string, unknown>[], headers: string[]): string {
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Escape commas and quotes in values
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value || '';
      }).join(',')
    )
  ];
  return csvContent.join('\n');
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export function ExportButton({
  analytics,
  eventName = 'Event',
  disabled = false,
  className = ''
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportType, setExportType] = useState<'summary' | 'messages' | null>(null);

  const exportSummaryData = () => {
    if (!analytics) return;

    const { deliveryStats, engagementMetrics } = analytics;
    
    // Get first engagement metrics (since it's an array)
    const firstEngagement = engagementMetrics.length > 0 ? engagementMetrics[0] : null;
    
    // Create summary data
    const summaryData = [
      {
        'Metric': 'Total Messages Sent',
        'Value': deliveryStats.totalSent,
        'Percentage': '100%'
      },
      {
        'Metric': 'Messages Delivered',
        'Value': deliveryStats.totalDelivered,
        'Percentage': `${deliveryStats.deliveryRate.toFixed(1)}%`
      },
      {
        'Metric': 'Messages Read',
        'Value': deliveryStats.totalRead,
        'Percentage': `${deliveryStats.readRate.toFixed(1)}%`
      },
      {
        'Metric': 'Responses Received',
        'Value': deliveryStats.totalResponses,
        'Percentage': `${deliveryStats.responseRate.toFixed(1)}%`
      },
      {
        'Metric': 'Failure Rate',
        'Value': deliveryStats.totalFailed,
        'Percentage': `${deliveryStats.failureRate.toFixed(1)}%`
      },
      {
        'Metric': 'Read Ratio (Read/Delivered)',
        'Value': `${deliveryStats.readRatio.toFixed(1)}%`,
        'Percentage': ''
      },
      {
        'Metric': 'Average Time to Read (minutes)',
        'Value': firstEngagement?.averageTimeToRead ? firstEngagement.averageTimeToRead.toFixed(1) : 'N/A',
        'Percentage': ''
      }
    ];

    const csv = convertToCSV(summaryData, ['Metric', 'Value', 'Percentage']);
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${eventName.replace(/[^a-zA-Z0-9]/g, '_')}_analytics_summary_${timestamp}.csv`;
    
    downloadCSV(csv, filename);
  };

  const exportMessagesData = () => {
    if (!analytics?.topPerformingMessages) return;

    const messagesData = analytics.topPerformingMessages.map((message, index) => ({
      'Rank': index + 1,
      'Message ID': message.messageId,
      'Content': message.content.replace(/\n/g, ' ').substring(0, 100) + (message.content.length > 100 ? '...' : ''),
      'Sent At': new Date(message.sentAt).toLocaleString(),
      'Delivery Rate': `${message.deliveryRate.toFixed(1)}%`,
      'Read Rate': `${message.readRate.toFixed(1)}%`,
      'Response Rate': `${message.responseRate.toFixed(1)}%`,
      'Engagement Rate': `${message.engagementRate.toFixed(1)}%`,
      'Engagement Score': `${message.engagementScore.toFixed(1)}%`
    }));

    const csv = convertToCSV(messagesData, [
      'Rank', 'Message ID', 'Content', 'Sent At', 'Delivery Rate', 
      'Read Rate', 'Response Rate', 'Engagement Rate', 'Engagement Score'
    ]);
    
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${eventName.replace(/[^a-zA-Z0-9]/g, '_')}_top_messages_${timestamp}.csv`;
    
    downloadCSV(csv, filename);
  };

  const handleExport = async (type: 'summary' | 'messages') => {
    if (!analytics || isExporting) return;
    
    setIsExporting(true);
    setExportType(type);
    
    try {
      // Add a small delay to show loading state
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (type === 'summary') {
        exportSummaryData();
      } else {
        exportMessagesData();
      }
    } catch (error) {
      console.error('Export failed:', error);
      // You could add toast notification here
    } finally {
      setIsExporting(false);
      setExportType(null);
    }
  };

  if (!analytics || disabled) {
    return (
      <div className={`opacity-50 ${className}`}>
        <button
          disabled
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-400 bg-gray-100 rounded-lg cursor-not-allowed"
        >
          <FileSpreadsheet className="w-4 h-4" />
          Export Data
        </button>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleExport('summary')}
          disabled={isExporting}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isExporting && exportType === 'summary' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          Export Summary
        </button>
        
        {analytics.topPerformingMessages && analytics.topPerformingMessages.length > 0 && (
          <button
            onClick={() => handleExport('messages')}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting && exportType === 'messages' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4" />
            )}
            Export Messages
          </button>
        )}
      </div>
      
      {/* Export info tooltip */}
      <div className="mt-2 text-xs text-gray-500">
        Export analytics data as CSV files for spreadsheet analysis
      </div>
    </div>
  );
}

export default ExportButton; 