import { logger } from '@/lib/logger';

// Performance budget thresholds (in milliseconds)
export const PERFORMANCE_BUDGETS = {
  // Page load times
  PAGE_LOAD: {
    FAST: 1000,
    ACCEPTABLE: 2500,
    SLOW: 5000,
  },
  // Component render times
  COMPONENT_RENDER: {
    FAST: 100,
    ACCEPTABLE: 300,
    SLOW: 1000,
  },
  // API response times
  API_RESPONSE: {
    FAST: 200,
    ACCEPTABLE: 1000,
    SLOW: 3000,
  },
  // Image load times
  IMAGE_LOAD: {
    FAST: 500,
    ACCEPTABLE: 2000,
    SLOW: 5000,
  },
  // Bundle sizes (in bytes)
  BUNDLE_SIZE: {
    INITIAL_JS: 200 * 1024, // 200KB
    CHUNK_SIZE: 100 * 1024, // 100KB
    TOTAL_JS: 1024 * 1024, // 1MB
    CSS: 50 * 1024, // 50KB
    IMAGES: 500 * 1024, // 500KB per image
  },
  // Core Web Vitals
  WEB_VITALS: {
    // First Contentful Paint
    FCP: {
      GOOD: 1800,
      NEEDS_IMPROVEMENT: 3000,
    },
    // Largest Contentful Paint
    LCP: {
      GOOD: 2500,
      NEEDS_IMPROVEMENT: 4000,
    },
    // First Input Delay
    FID: {
      GOOD: 100,
      NEEDS_IMPROVEMENT: 300,
    },
    // Cumulative Layout Shift
    CLS: {
      GOOD: 0.1,
      NEEDS_IMPROVEMENT: 0.25,
    },
  },
} as const;

export type PerformanceMetric =
  | 'pageLoad'
  | 'componentRender'
  | 'apiResponse'
  | 'imageLoad';
export type BudgetLevel = 'fast' | 'acceptable' | 'slow';

/**
 * Evaluate performance against budget thresholds
 */
export function evaluatePerformance(
  metric: PerformanceMetric,
  value: number,
  context?: string,
): {
  level: BudgetLevel;
  withinBudget: boolean;
  message: string;
} {
  const budgets = {
    pageLoad: PERFORMANCE_BUDGETS.PAGE_LOAD,
    componentRender: PERFORMANCE_BUDGETS.COMPONENT_RENDER,
    apiResponse: PERFORMANCE_BUDGETS.API_RESPONSE,
    imageLoad: PERFORMANCE_BUDGETS.IMAGE_LOAD,
  };

  const budget = budgets[metric];
  let level: BudgetLevel;
  let withinBudget: boolean;

  if (value <= budget.FAST) {
    level = 'fast';
    withinBudget = true;
  } else if (value <= budget.ACCEPTABLE) {
    level = 'acceptable';
    withinBudget = true;
  } else {
    level = 'slow';
    withinBudget = false;
  }

  const message = `${metric} ${context ? `(${context}) ` : ''}took ${value}ms - ${level} performance`;

  // Log performance results
  if (withinBudget) {
    if (level === 'fast') {
      logger.debug(`⚡ ${message}`);
    } else {
      logger.debug(`✅ ${message}`);
    }
  } else {
    logger.warn(`🐌 ${message} - exceeds budget of ${budget.ACCEPTABLE}ms`);
  }

  return { level, withinBudget, message };
}

/**
 * Monitor bundle size against budgets
 */
export function evaluateBundleSize(
  bundleType: keyof typeof PERFORMANCE_BUDGETS.BUNDLE_SIZE,
  size: number,
  context?: string,
): {
  withinBudget: boolean;
  percentage: number;
  message: string;
} {
  const budget = PERFORMANCE_BUDGETS.BUNDLE_SIZE[bundleType];
  const percentage = (size / budget) * 100;
  const withinBudget = size <= budget;

  const sizeInKB = Math.round(size / 1024);
  const budgetInKB = Math.round(budget / 1024);

  const message = `${bundleType} ${context ? `(${context}) ` : ''}is ${sizeInKB}KB (${percentage.toFixed(1)}% of ${budgetInKB}KB budget)`;

  if (withinBudget) {
    logger.debug(`📦 ${message}`);
  } else {
    logger.warn(`📈 ${message} - exceeds budget!`);
  }

  return { withinBudget, percentage, message };
}

/**
 * Evaluate Core Web Vitals against thresholds
 */
export function evaluateWebVitals(vitals: {
  fcp?: number;
  lcp?: number;
  fid?: number;
  cls?: number;
}): {
  scores: Record<string, 'good' | 'needs-improvement' | 'poor' | 'unknown'>;
  overallScore: 'good' | 'needs-improvement' | 'poor';
  recommendations: string[];
} {
  const scores: Record<
    string,
    'good' | 'needs-improvement' | 'poor' | 'unknown'
  > = {};
  const recommendations: string[] = [];

  // First Contentful Paint
  if (vitals.fcp !== undefined) {
    if (vitals.fcp <= PERFORMANCE_BUDGETS.WEB_VITALS.FCP.GOOD) {
      scores.fcp = 'good';
    } else if (
      vitals.fcp <= PERFORMANCE_BUDGETS.WEB_VITALS.FCP.NEEDS_IMPROVEMENT
    ) {
      scores.fcp = 'needs-improvement';
      recommendations.push(
        'Optimize First Contentful Paint: Consider reducing server response times and optimizing critical resources',
      );
    } else {
      scores.fcp = 'poor';
      recommendations.push(
        'Critical: First Contentful Paint is too slow. Prioritize above-the-fold content and eliminate render-blocking resources',
      );
    }
  } else {
    scores.fcp = 'unknown';
  }

  // Largest Contentful Paint
  if (vitals.lcp !== undefined) {
    if (vitals.lcp <= PERFORMANCE_BUDGETS.WEB_VITALS.LCP.GOOD) {
      scores.lcp = 'good';
    } else if (
      vitals.lcp <= PERFORMANCE_BUDGETS.WEB_VITALS.LCP.NEEDS_IMPROVEMENT
    ) {
      scores.lcp = 'needs-improvement';
      recommendations.push(
        'Optimize Largest Contentful Paint: Optimize largest element loading, consider lazy loading for non-critical images',
      );
    } else {
      scores.lcp = 'poor';
      recommendations.push(
        'Critical: Largest Contentful Paint is too slow. Optimize image loading and consider using a CDN',
      );
    }
  } else {
    scores.lcp = 'unknown';
  }

  // First Input Delay
  if (vitals.fid !== undefined) {
    if (vitals.fid <= PERFORMANCE_BUDGETS.WEB_VITALS.FID.GOOD) {
      scores.fid = 'good';
    } else if (
      vitals.fid <= PERFORMANCE_BUDGETS.WEB_VITALS.FID.NEEDS_IMPROVEMENT
    ) {
      scores.fid = 'needs-improvement';
      recommendations.push(
        'Optimize First Input Delay: Reduce main thread blocking time and optimize JavaScript execution',
      );
    } else {
      scores.fid = 'poor';
      recommendations.push(
        'Critical: First Input Delay is too high. Minimize main thread work and split large JavaScript tasks',
      );
    }
  } else {
    scores.fid = 'unknown';
  }

  // Cumulative Layout Shift
  if (vitals.cls !== undefined) {
    if (vitals.cls <= PERFORMANCE_BUDGETS.WEB_VITALS.CLS.GOOD) {
      scores.cls = 'good';
    } else if (
      vitals.cls <= PERFORMANCE_BUDGETS.WEB_VITALS.CLS.NEEDS_IMPROVEMENT
    ) {
      scores.cls = 'needs-improvement';
      recommendations.push(
        'Optimize Cumulative Layout Shift: Ensure images and ads have dimensions, avoid inserting content above existing content',
      );
    } else {
      scores.cls = 'poor';
      recommendations.push(
        'Critical: Cumulative Layout Shift is too high. Set explicit dimensions for all media and avoid layout shifts',
      );
    }
  } else {
    scores.cls = 'unknown';
  }

  // Calculate overall score
  const knownScores = Object.values(scores).filter(
    (score) => score !== 'unknown',
  );
  const goodScores = knownScores.filter((score) => score === 'good').length;
  const poorScores = knownScores.filter((score) => score === 'poor').length;

  let overallScore: 'good' | 'needs-improvement' | 'poor';
  if (poorScores > 0) {
    overallScore = 'poor';
  } else if (goodScores === knownScores.length) {
    overallScore = 'good';
  } else {
    overallScore = 'needs-improvement';
  }

  // Log results
  logger.debug('🔍 Core Web Vitals Assessment:', {
    scores,
    overallScore,
    vitals,
  });

  if (recommendations.length > 0) {
    logger.warn('📋 Performance Recommendations:', recommendations);
  }

  return { scores, overallScore, recommendations };
}

/**
 * Performance monitoring middleware for key user flows
 */
export class PerformanceMonitor {
  private timers: Map<string, number> = new Map();
  private metrics: Map<string, number[]> = new Map();

  start(operationId: string): void {
    this.timers.set(operationId, Date.now());
  }

  end(operationId: string, context?: string): number | null {
    const startTime = this.timers.get(operationId);
    if (!startTime) {
      logger.warn(`Performance timer not found for operation: ${operationId}`);
      return null;
    }

    const duration = Date.now() - startTime;
    this.timers.delete(operationId);

    // Store metric for trend analysis
    const existingMetrics = this.metrics.get(operationId) || [];
    existingMetrics.push(duration);
    // Keep only last 10 measurements
    if (existingMetrics.length > 10) {
      existingMetrics.shift();
    }
    this.metrics.set(operationId, existingMetrics);

    // Evaluate against budget based on operation type
    let metric: PerformanceMetric;
    if (operationId.includes('page') || operationId.includes('route')) {
      metric = 'pageLoad';
    } else if (operationId.includes('api') || operationId.includes('fetch')) {
      metric = 'apiResponse';
    } else if (operationId.includes('image')) {
      metric = 'imageLoad';
    } else {
      metric = 'componentRender';
    }

    evaluatePerformance(metric, duration, context || operationId);

    return duration;
  }

  getMetrics(operationId: string): {
    average: number;
    latest: number;
    min: number;
    max: number;
    count: number;
  } | null {
    const metrics = this.metrics.get(operationId);
    if (!metrics || metrics.length === 0) {
      return null;
    }

    const average = metrics.reduce((sum, val) => sum + val, 0) / metrics.length;
    const latest = metrics[metrics.length - 1];
    const min = Math.min(...metrics);
    const max = Math.max(...metrics);

    return { average, latest, min, max, count: metrics.length };
  }

  clearMetrics(operationId?: string): void {
    if (operationId) {
      this.metrics.delete(operationId);
      this.timers.delete(operationId);
    } else {
      this.metrics.clear();
      this.timers.clear();
    }
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Higher-order function for automatic performance monitoring
 */
export function withPerformanceMonitoring<
  T extends (...args: unknown[]) => unknown,
>(fn: T, operationId: string, context?: string): T {
  return async function (this: unknown, ...args: unknown[]) {
    performanceMonitor.start(operationId);

    try {
      const result = await fn.apply(this, args);
      return result;
    } finally {
      performanceMonitor.end(operationId, context);
    }
  } as T;
}
