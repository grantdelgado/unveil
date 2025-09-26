#!/usr/bin/env npx tsx

/**
 * RUM Report CLI Script
 * 
 * Fetches and displays real user monitoring (RUM) data from the database
 * Shows p75 performance metrics by route over the last 7 days
 * 
 * Usage:
 *   npx tsx scripts/rum-report.ts [--route=ROUTE] [--metric=METRIC]
 */

import { createClient } from '@supabase/supabase-js';
import { program } from 'commander';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function colorize(text: string, color: keyof typeof colors): string {
  return `${colors[color]}${text}${colors.reset}`;
}

interface RumData {
  route: string;
  metric: 'LCP' | 'INP' | 'CLS';
  p75: number;
  n: number;
  avg_value: number;
  min_value: number;
  max_value: number;
}

function getPerformanceRating(metric: 'LCP' | 'INP' | 'CLS', value: number): 'good' | 'needs-improvement' | 'poor' {
  const thresholds = {
    LCP: { good: 2500, poor: 4000 },
    INP: { good: 200, poor: 500 },
    CLS: { good: 0.1, poor: 0.25 },
  };
  
  const threshold = thresholds[metric];
  if (value <= threshold.good) return 'good';
  if (value <= threshold.poor) return 'needs-improvement';
  return 'poor';
}

function formatValue(metric: 'LCP' | 'INP' | 'CLS', value: number): string {
  if (metric === 'CLS') {
    return value.toFixed(3);
  }
  return `${Math.round(value)}ms`;
}

function getRatingColor(rating: 'good' | 'needs-improvement' | 'poor'): keyof typeof colors {
  switch (rating) {
    case 'good': return 'green';
    case 'needs-improvement': return 'yellow';
    case 'poor': return 'red';
  }
}

async function fetchRumData(
  supabase: ReturnType<typeof createClient>,
  routeFilter?: string,
  metricFilter?: string
): Promise<RumData[]> {
  let query = supabase.from('rum_p75_7d').select('*');

  if (routeFilter) {
    query = query.eq('route', routeFilter);
  }
  if (metricFilter && ['LCP', 'INP', 'CLS'].includes(metricFilter)) {
    query = query.eq('metric', metricFilter);
  }

  const { data, error } = await query.order('route').order('metric');

  if (error) {
    throw error;
  }

  return data || [];
}

async function generateRumReport(options: { route?: string; metric?: string }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error(colorize('❌ Missing Supabase environment variables', 'red'));
    console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log(colorize('📊 RUM Performance Report', 'bold'));
    console.log(colorize('========================', 'blue'));
    
    if (options.route || options.metric) {
      const filters = [];
      if (options.route) filters.push(`Route: ${options.route}`);
      if (options.metric) filters.push(`Metric: ${options.metric}`);
      console.log(colorize(`Filters: ${filters.join(', ')}`, 'cyan'));
    }
    
    console.log(colorize('Data period: Last 7 days', 'cyan'));
    console.log('');

    const data = await fetchRumData(supabase, options.route, options.metric);

    if (data.length === 0) {
      console.log(colorize('📋 No RUM data found', 'yellow'));
      console.log('RUM data will appear here once users start interacting with the application.');
      return;
    }

    // Group by route
    const routeGroups = data.reduce((acc, item) => {
      if (!acc[item.route]) {
        acc[item.route] = [];
      }
      acc[item.route].push(item);
      return acc;
    }, {} as Record<string, RumData[]>);

    // Display each route's metrics
    for (const [route, metrics] of Object.entries(routeGroups)) {
      console.log(colorize(`🔍 Route: ${route}`, 'bold'));
      console.log('─'.repeat(50));

      for (const item of metrics) {
        const rating = getPerformanceRating(item.metric, item.p75);
        const ratingColor = getRatingColor(rating);
        const statusSymbol = rating === 'good' ? '✅' : rating === 'needs-improvement' ? '⚠️' : '❌';

        console.log(`${statusSymbol} ${colorize(item.metric.padEnd(4), 'cyan')} ${formatValue(item.metric, item.p75).padStart(8)} (P75) ${colorize(rating, ratingColor)}`);
        console.log(`    Samples: ${item.n.toLocaleString()} | Avg: ${formatValue(item.metric, item.avg_value)} | Range: ${formatValue(item.metric, item.min_value)}-${formatValue(item.metric, item.max_value)}`);
        console.log('');
      }
    }

    // Summary
    console.log(colorize('📈 Summary', 'bold'));
    console.log('─'.repeat(30));
    
    const totalRoutes = Object.keys(routeGroups).length;
    const totalMetrics = data.length;
    const goodMetrics = data.filter(item => getPerformanceRating(item.metric, item.p75) === 'good').length;
    const poorMetrics = data.filter(item => getPerformanceRating(item.metric, item.p75) === 'poor').length;
    
    console.log(`Routes analyzed: ${totalRoutes}`);
    console.log(`Total metrics: ${totalMetrics}`);
    console.log(`${colorize('Good performance:', 'green')} ${goodMetrics}/${totalMetrics} (${Math.round(goodMetrics/totalMetrics*100)}%)`);
    
    if (poorMetrics > 0) {
      console.log(`${colorize('Poor performance:', 'red')} ${poorMetrics}/${totalMetrics} (${Math.round(poorMetrics/totalMetrics*100)}%)`);
    }

    // Performance thresholds reminder
    console.log('');
    console.log(colorize('🎯 Performance Thresholds', 'cyan'));
    console.log('─'.repeat(25));
    console.log('LCP: Good ≤2500ms, Poor >4000ms');
    console.log('INP: Good ≤200ms, Poor >500ms');
    console.log('CLS: Good ≤0.1, Poor >0.25');

  } catch (error) {
    console.error(colorize('❌ Error fetching RUM data:', 'red'), error);
    process.exit(1);
  }
}

// CLI setup
program
  .name('rum-report')
  .description('Generate RUM performance report from database')
  .option('-r, --route <route>', 'Filter by specific route (e.g., "/", "/login")')
  .option('-m, --metric <metric>', 'Filter by specific metric (LCP, INP, CLS)')
  .action(generateRumReport);

// Run if called directly
if (require.main === module) {
  program.parse();
}
