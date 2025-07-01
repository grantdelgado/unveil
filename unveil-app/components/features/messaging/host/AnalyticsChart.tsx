'use client';

import React from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

export interface ChartDataPoint {
  [key: string]: string | number;
}

export interface AnalyticsChartProps {
  data: ChartDataPoint[];
  chartType?: 'line' | 'bar';
  xKey: string;
  yKey: string;
  label: string;
  color?: string;
  tooltipFormatter?: (value: number | string, name: string) => [string, string];
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  className?: string;
}

export function AnalyticsChart({
  data,
  chartType = 'line',
  xKey,
  yKey,
  label,
  color = '#8b5cf6',
  tooltipFormatter,
  height = 300,
  showGrid = true,
  showLegend = false,
  className = '',
}: AnalyticsChartProps) {
  // Default tooltip formatter
  const defaultTooltipFormatter = (value: number | string, name: string) => {
    if (name === yKey) {
      // Format based on the type of value
      if (typeof value === 'number') {
        if (value > 0 && value < 1) {
          // Percentage
          return [`${(value * 100).toFixed(1)}%`, label];
        } else if (value >= 0 && value <= 100 && name.toLowerCase().includes('rate')) {
          // Already a percentage
          return [`${value.toFixed(1)}%`, label];
        } else if (name.toLowerCase().includes('time')) {
          // Time value in minutes
          return [`${value.toFixed(1)}m`, label];
        } else {
          // Regular number
          return [value.toLocaleString(), label];
        }
      }
      return [String(value), label];
    }
    return [String(value), name];
  };

  const formatXAxisLabel = (value: string) => {
    // Try to format as date if it looks like a date
    if (value.includes('-') && value.length >= 8) {
      try {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString(undefined, { 
            month: 'short', 
            day: 'numeric' 
          });
        }
      } catch {
        // If date parsing fails, return as-is
      }
    }
    return value;
  };

  const formatYAxisLabel = (value: number) => {
    if (value >= 0 && value <= 100 && (yKey.toLowerCase().includes('rate') || yKey.toLowerCase().includes('ratio'))) {
      return `${value}%`;
    } else if (yKey.toLowerCase().includes('time')) {
      return `${value}m`;
    }
    return value.toLocaleString();
  };

  if (!data || data.length === 0) {
    return (
      <div className={`flex items-center justify-center h-${height / 4} bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 ${className}`}>
        <div className="text-center">
          <svg
            className="w-12 h-12 text-gray-400 mx-auto mb-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <p className="text-sm text-gray-600 font-medium">No Data Available</p>
          <p className="text-xs text-gray-500 mt-1">Chart will appear when data is available</p>
        </div>
      </div>
    );
  }

  const commonProps = {
    data,
    margin: { top: 5, right: 30, left: 20, bottom: 5 },
  };

  return (
    <div className={`w-full ${className}`} style={{ height: `${height}px` }}>
      <ResponsiveContainer width="100%" height="100%">
        {chartType === 'line' ? (
          <LineChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
            <XAxis 
              dataKey={xKey} 
              tick={{ fontSize: 12 }}
              tickFormatter={formatXAxisLabel}
              stroke="#666"
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              tickFormatter={formatYAxisLabel}
              stroke="#666"
            />
            <Tooltip 
              formatter={tooltipFormatter || defaultTooltipFormatter}
              labelFormatter={(label) => formatXAxisLabel(String(label))}
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              }}
            />
            {showLegend && <Legend />}
            <Line
              type="monotone"
              dataKey={yKey}
              stroke={color}
              strokeWidth={2}
              dot={{ fill: color, strokeWidth: 0, r: 4 }}
              activeDot={{ r: 6, stroke: color, strokeWidth: 2, fill: 'white' }}
            />
          </LineChart>
        ) : (
          <BarChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
            <XAxis 
              dataKey={xKey} 
              tick={{ fontSize: 12 }}
              tickFormatter={formatXAxisLabel}
              stroke="#666"
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              tickFormatter={formatYAxisLabel}
              stroke="#666"
            />
            <Tooltip 
              formatter={tooltipFormatter || defaultTooltipFormatter}
              labelFormatter={(label) => formatXAxisLabel(String(label))}
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              }}
            />
            {showLegend && <Legend />}
            <Bar 
              dataKey={yKey} 
              fill={color}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

export default AnalyticsChart; 