// Re-export the static Providers to avoid import churn
// This eliminates dynamic imports that caused CSR bailouts
export { Providers as LeanRootProvider } from '@/app/Providers';