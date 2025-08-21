/**
 * Type shims for problematic third-party dependencies
 * These are only used when strict TypeScript checking is enabled without skipLibCheck
 */

// Solana wallet standard features (used by Supabase auth but not needed for our app)
declare module '@solana/wallet-standard-features' {
  export interface SolanaSignInInput {
    [key: string]: unknown;
  }
  
  export interface SolanaSignInOutput {
    [key: string]: unknown;
  }
}

// PostgreSQL protocol messages (used by @types/pg but not needed for our app)
declare module 'pg-protocol/dist/messages' {
  export interface NoticeMessage {
    [key: string]: unknown;
  }
}
