import { useEffect, useRef, useState } from 'react'
import { logger } from '@/lib/logger'

interface PerformanceMetrics {
  componentName: string
  loadTime: number
  renderTime: number
  memoryUsage?: number
}

interface UsePerformanceMonitorOptions {
  componentName: string
  trackMemory?: boolean
  logToConsole?: boolean
  threshold?: number // Log warning if load time exceeds this (in ms)
}

/**
 * Hook to monitor component performance including load and render times
 */
export function usePerformanceMonitor({
  componentName,
  trackMemory = false,
  logToConsole = process.env.NODE_ENV === 'development',
  threshold = 1000, // 1 second default threshold
}: UsePerformanceMonitorOptions) {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null)
  const loadStartTime = useRef<number>(Date.now())
  const renderStartTime = useRef<number | null>(null)
  const isFirstRender = useRef(true)

  // Mark render start time
  if (isFirstRender.current) {
    renderStartTime.current = Date.now()
    isFirstRender.current = false
  }

  useEffect(() => {
    const loadTime = Date.now() - loadStartTime.current
    const renderTime = renderStartTime.current 
      ? Date.now() - renderStartTime.current 
      : 0

    let memoryUsage: number | undefined
    if (trackMemory && 'memory' in performance) {
      // @ts-ignore - performance.memory is not in standard types but exists in Chrome
      memoryUsage = performance.memory?.usedJSHeapSize
    }

    const performanceMetrics: PerformanceMetrics = {
      componentName,
      loadTime,
      renderTime,
      memoryUsage,
    }

    setMetrics(performanceMetrics)

    // Log performance metrics
    if (logToConsole) {
      const message = `Component: ${componentName} | Load: ${loadTime}ms | Render: ${renderTime}ms`
      
      if (loadTime > threshold) {
        logger.warn(`Slow component detected: ${message}`)
      } else {
        logger.debug(`Performance: ${message}`)
      }

      if (memoryUsage) {
        logger.debug(`Memory usage: ${Math.round(memoryUsage / 1024 / 1024)}MB`)
      }
    }

    // Send to analytics in production (placeholder for future implementation)
    if (process.env.NODE_ENV === 'production') {
      // Could send to analytics service like Google Analytics, DataDog, etc.
      // analytics.track('component_performance', performanceMetrics)
    }
  }, [componentName, trackMemory, logToConsole, threshold])

  return {
    metrics,
    isLoading: metrics === null,
    isSlowLoad: metrics ? metrics.loadTime > threshold : false,
  }
}

/**
 * Hook to track lazy component loading specifically
 */
export function useLazyComponentMonitor(componentName: string) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [loadError, setLoadError] = useState<Error | null>(null)
  const loadStartTime = useRef<number>(Date.now())

  useEffect(() => {
    // Component has loaded successfully
    const loadTime = Date.now() - loadStartTime.current
    setIsLoaded(true)
    
    logger.debug(`Lazy component loaded: ${componentName} in ${loadTime}ms`)
    
    // Track lazy loading performance
    if (loadTime > 2000) { // 2 second threshold for lazy components
      logger.warn(`Slow lazy component: ${componentName} took ${loadTime}ms to load`)
    }
  }, [componentName])

  const handleLoadError = (error: Error) => {
    setLoadError(error)
    logger.error(`Failed to load lazy component: ${componentName}`, error)
  }

  return {
    isLoaded,
    loadError,
    handleLoadError,
  }
}

/**
 * Hook to monitor bundle size impact
 */
export function useBundleMonitor() {
  const [bundleMetrics, setBundleMetrics] = useState<{
    initialBundleSize?: number
    chunksLoaded: number
    totalChunkSize: number
  }>({
    chunksLoaded: 0,
    totalChunkSize: 0,
  })

  useEffect(() => {
    // Monitor performance navigation timing
    if ('performance' in window && 'getEntriesByType' in performance) {
      const navigationEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
      
      if (navigationEntries.length > 0) {
        const nav = navigationEntries[0]
        const initialBundleSize = nav.transferSize || 0
        
        setBundleMetrics(prev => ({
          ...prev,
          initialBundleSize,
        }))
      }

      // Monitor resource loading (chunks)
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        
        entries.forEach((entry) => {
          if (entry.name.includes('chunk') || entry.name.includes('.js')) {
            const resourceEntry = entry as PerformanceResourceTiming
            setBundleMetrics(prev => ({
              ...prev,
              chunksLoaded: prev.chunksLoaded + 1,
              totalChunkSize: prev.totalChunkSize + (resourceEntry.transferSize || 0),
            }))
          }
        })
      })

      observer.observe({ entryTypes: ['resource'] })

      return () => observer.disconnect()
    }
  }, [])

  return bundleMetrics
}

/**
 * Performance monitoring utilities
 */
export const performanceUtils = {
  /**
   * Mark the start of a performance measurement
   */
  markStart: (name: string) => {
    if ('performance' in window && 'mark' in performance) {
      performance.mark(`${name}-start`)
    }
  },

  /**
   * Mark the end of a performance measurement and get the duration
   */
  markEnd: (name: string): number => {
    if ('performance' in window && 'mark' in performance && 'measure' in performance) {
      performance.mark(`${name}-end`)
      performance.measure(name, `${name}-start`, `${name}-end`)
      
      const measures = performance.getEntriesByName(name, 'measure')
      return measures.length > 0 ? measures[0].duration : 0
    }
    return 0
  },

  /**
   * Get Core Web Vitals metrics
   */
  getCoreWebVitals: () => {
    return new Promise<{
      fcp?: number // First Contentful Paint
      lcp?: number // Largest Contentful Paint
      fid?: number // First Input Delay
      cls?: number // Cumulative Layout Shift
    }>((resolve) => {
      const vitals: {
        fcp?: number
        lcp?: number
        fid?: number
        cls?: number
      } = {}

      // First Contentful Paint
      new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach((entry) => {
          if (entry.name === 'first-contentful-paint') {
            vitals.fcp = entry.startTime
          }
        })
      }).observe({ entryTypes: ['paint'] })

      // Largest Contentful Paint
      new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const lastEntry = entries[entries.length - 1]
        vitals.lcp = lastEntry.startTime
      }).observe({ entryTypes: ['largest-contentful-paint'] })

      // First Input Delay
      new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach((entry: PerformanceEntry & { processingStart?: number }) => {
          if (entry.processingStart) {
            vitals.fid = entry.processingStart - entry.startTime
          }
        })
      }).observe({ entryTypes: ['first-input'] })

      // Cumulative Layout Shift
      let clsScore = 0
      new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach((entry: PerformanceEntry & { hadRecentInput?: boolean; value?: number }) => {
          if (!entry.hadRecentInput && entry.value) {
            clsScore += entry.value
          }
        })
        vitals.cls = clsScore
      }).observe({ entryTypes: ['layout-shift'] })

      // Resolve after a short delay to collect metrics
      setTimeout(() => resolve(vitals), 2000)
    })
  },
} 