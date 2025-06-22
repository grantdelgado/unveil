// Performance monitoring from hooks
export {
  usePerformanceMonitor,
  useLazyComponentMonitor,
  useBundleMonitor,
  performanceUtils,
} from '@/hooks/performance/usePerformanceMonitor'

// Performance budgets
export {
  PERFORMANCE_BUDGETS,
  evaluatePerformance,
  evaluateBundleSize,
  evaluateWebVitals,
  PerformanceMonitor,
  performanceMonitor,
  withPerformanceMonitoring,
} from './performanceBudgets'

// Types
export type { PerformanceMetric, BudgetLevel } from './performanceBudgets' 