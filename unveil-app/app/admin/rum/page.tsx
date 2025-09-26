'use client';

import { useEffect, useState } from 'react';
import { CardContainer } from '@/components/ui/CardContainer';
import { logger } from '@/lib/logger';

interface RumData {
  route: string;
  metric: 'LCP' | 'INP' | 'CLS';
  p75: number;
  n: number;
  avg_value: number;
  min_value: number;
  max_value: number;
}

const METRIC_INFO = {
  LCP: {
    name: 'Largest Contentful Paint',
    unit: 'ms',
    good: 2500,
    poor: 4000,
    description: 'Time when the largest content element is rendered',
  },
  INP: {
    name: 'Interaction to Next Paint',
    unit: 'ms', 
    good: 200,
    poor: 500,
    description: 'Responsiveness to user interactions',
  },
  CLS: {
    name: 'Cumulative Layout Shift',
    unit: '',
    good: 0.1,
    poor: 0.25,
    description: 'Visual stability during page load',
  },
} as const;

function getPerformanceRating(
  metric: keyof typeof METRIC_INFO,
  value: number
): 'good' | 'needs-improvement' | 'poor' {
  const thresholds = METRIC_INFO[metric];
  if (value <= thresholds.good) return 'good';
  if (value <= thresholds.poor) return 'needs-improvement';
  return 'poor';
}

function formatValue(metric: keyof typeof METRIC_INFO, value: number): string {
  const info = METRIC_INFO[metric];
  if (metric === 'CLS') {
    return value.toFixed(3);
  }
  return `${Math.round(value)}${info.unit}`;
}

function getRatingColor(rating: 'good' | 'needs-improvement' | 'poor'): string {
  switch (rating) {
    case 'good':
      return 'text-green-800';
    case 'needs-improvement':
      return 'text-yellow-800';
    case 'poor':
      return 'text-red-800';
  }
}

export default function RumPage() {
  const [data, setData] = useState<RumData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<string>('all');

  useEffect(() => {
    async function fetchRumData() {
      try {
        const response = await fetch('/api/rum');
        if (!response.ok) {
          throw new Error(`Failed to fetch RUM data: ${response.statusText}`);
        }

        const result = await response.json();
        setData(result.data || []);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMsg);
        logger.error('Failed to fetch RUM data', { error: err });
      } finally {
        setLoading(false);
      }
    }

    fetchRumData();
  }, []);

  const routes = Array.from(new Set(data.map((item) => item.route))).sort();
  const filteredData = selectedRoute === 'all' 
    ? data 
    : data.filter((item) => item.route === selectedRoute);

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">Real User Monitoring (RUM)</h1>
          <p className="text-gray-600">
            Performance metrics from real users over the last 7 days
          </p>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardContainer key={i} className="p-4">
              <div className="h-4 w-1/2 mb-2 bg-gray-200 rounded animate-pulse" />
              <div className="h-8 w-1/3 mb-1 bg-gray-200 rounded animate-pulse" />
              <div className="h-3 w-full bg-gray-200 rounded animate-pulse" />
            </CardContainer>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <CardContainer className="p-6 border-red-200 bg-red-50">
          <h1 className="text-xl font-semibold text-red-800 mb-2">
            Error Loading RUM Data
          </h1>
          <p className="text-red-600">{error}</p>
        </CardContainer>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">Real User Monitoring (RUM)</h1>
          <p className="text-gray-600">
            Performance metrics from real users over the last 7 days
          </p>
        </div>
        
        <CardContainer className="p-6 text-center">
          <h2 className="text-lg font-medium mb-2">No RUM Data Available</h2>
          <p className="text-gray-600">
            RUM data will appear here once users start interacting with the application.
          </p>
        </CardContainer>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Real User Monitoring (RUM)</h1>
        <p className="text-muted-foreground">
          Performance metrics from real users over the last 7 days
        </p>
      </div>

      {/* Route Filter */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Filter by Route:</label>
        <select
          value={selectedRoute}
          onChange={(e) => setSelectedRoute(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Routes ({routes.length})</option>
          {routes.map((route) => (
            <option key={route} value={route}>
              {route} ({data.filter(d => d.route === route).length} metrics)
            </option>
          ))}
        </select>
      </div>

      {/* Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredData.map((item, index) => {
          const info = METRIC_INFO[item.metric];
          const rating = getPerformanceRating(item.metric, item.p75);
          
          return (
            <CardContainer key={`${item.route}-${item.metric}-${index}`} className="p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-medium text-sm text-gray-600">
                    {item.route}
                  </h3>
                  <p className="font-semibold">{info.name}</p>
                </div>
                <span className={`${getRatingColor(rating)} text-xs font-medium px-2 py-1 rounded-full bg-gray-100`}>
                  {rating === 'needs-improvement' ? 'needs work' : rating}
                </span>
              </div>
              
              <div className="mb-3">
                <div className="text-2xl font-bold">
                  {formatValue(item.metric, item.p75)}
                </div>
                <div className="text-xs text-gray-600">
                  P75 from {item.n.toLocaleString()} samples
                </div>
              </div>
              
              <div className="text-xs text-gray-600 space-y-1">
                <div>{info.description}</div>
                <div className="flex justify-between">
                  <span>Avg: {formatValue(item.metric, item.avg_value)}</span>
                  <span>
                    {formatValue(item.metric, item.min_value)} - {formatValue(item.metric, item.max_value)}
                  </span>
                </div>
              </div>
            </CardContainer>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-medium mb-2">Performance Thresholds</h3>
        <div className="grid gap-2 md:grid-cols-3 text-sm">
          {Object.entries(METRIC_INFO).map(([key, info]) => (
            <div key={key}>
              <strong>{key}:</strong> Good ≤ {info.good}{info.unit}, 
              Poor &gt; {info.poor}{info.unit}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
