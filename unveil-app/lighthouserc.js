module.exports = {
  ci: {
    collect: {
      // Target critical routes for performance monitoring
      url: [
        'http://localhost:3000/login',
        'http://localhost:3000/select-event',
      ],
      // Mobile-first performance testing with 3G throttling
      settings: {
        chromeFlags: '--no-sandbox --disable-dev-shm-usage --disable-gpu',
        preset: 'mobile', // Mobile-first testing
        // Consistent mobile emulation
        emulatedFormFactor: 'mobile',
        throttling: {
          rttMs: 150,        // 3G network RTT
          throughputKbps: 1600, // 3G throughput  
          cpuSlowdownMultiplier: 4, // Mobile CPU simulation
        },
        // Focus on Core Web Vitals and performance
        onlyCategories: ['performance'],
        // Consistent viewport
        screenEmulation: {
          mobile: true,
          width: 375,
          height: 667,
          deviceScaleFactor: 2,
        },
      },
      numberOfRuns: 3, // Multiple runs for statistical significance
      startServerCommand: 'npm run start',
      startServerReadyPattern: 'Ready on',
      startServerReadyTimeout: 15000,
    },
    assert: {
      assertions: {
        // Core Web Vitals targets aligned with our estimates
        'categories:performance': ['error', { minScore: 0.75 }],
        
        // Specific performance targets
        'first-contentful-paint': ['error', { maxNumericValue: 1800 }], // 1.8s
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }], // 2.5s 
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }], // Good CLS
        'total-blocking-time': ['error', { maxNumericValue: 200 }], // 200ms
        'speed-index': ['warn', { maxNumericValue: 2500 }], // 2.5s
        
        // Bundle size targets based on our optimizations
        'resource-summary:script:size': ['warn', { maxNumericValue: 320000 }], // 320KB
        'resource-summary:total:size': ['warn', { maxNumericValue: 1000000 }], // 1MB total
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
    server: {
      port: 9009,
      storage: './.lighthouseci',
    },
  },
};
