'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { Session, User } from '@supabase/supabase-js';
import { webViewLogger } from '@/lib/webview-logger';
import { isIOSWebView, getIOSVersion } from '@/lib/ios-webview-compat';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  userPhone: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * iOS-Compatible Auth Provider
 * Simplified version that works reliably in iOS 26.0 WebView
 */
export function AuthProviderIOS({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const initializeAuth = async () => {
      try {
        await webViewLogger.info('AuthProviderIOS: Starting initialization');
        
        // iOS 26.0 WebView timeout protection
        const authTimeout = new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error('Auth initialization timeout'));
          }, 5000);
        });

        // Try to get session with timeout
        const authPromise = (async () => {
          const { supabase } = await import('@/lib/supabase');
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (error) {
            await webViewLogger.error(`Auth error: ${error.message}`);
            throw error;
          }
          
          return session;
        })();

        const sessionResult = await Promise.race([authPromise, authTimeout]);
        clearTimeout(timeoutId);

        if (!isMounted) return;

        if (sessionResult) {
          await webViewLogger.info('Auth session found');
          setSession(sessionResult as Session);
          setUser((sessionResult as Session).user);
        } else {
          await webViewLogger.info('No auth session found');
          setSession(null);
          setUser(null);
        }

      } catch (error: any) {
        if (!isMounted) return;
        
        await webViewLogger.error(`Auth initialization failed: ${error.message}`);
        console.error('Auth initialization failed:', error);
        
        // Set to unauthenticated state on error
        setSession(null);
        setUser(null);
      } finally {
        if (isMounted) {
          setLoading(false);
          await webViewLogger.info('Auth initialization completed');
        }
      }
    };

    // iOS WebView-specific initialization
    if (isIOSWebView() || getIOSVersion() >= 26) {
      webViewLogger.info(`iOS ${getIOSVersion()} WebView detected - using simplified auth`);
      
      // Delay initialization slightly for iOS WebView stability
      setTimeout(() => {
        if (isMounted) {
          initializeAuth();
        }
      }, 500);
    } else {
      // Standard web initialization
      initializeAuth();
    }

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  const signOut = async () => {
    try {
      setLoading(true);
      await webViewLogger.info('Signing out user');
      
      const { supabase } = await import('@/lib/supabase');
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        await webViewLogger.error(`Sign out error: ${error.message}`);
        throw error;
      }
      
      setSession(null);
      setUser(null);
    } catch (error: any) {
      await webViewLogger.error(`Sign out failed: ${error.message}`);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const value: AuthContextType = {
    session,
    user,
    loading,
    isAuthenticated: !!session,
    userPhone: user?.phone || user?.user_metadata?.phone || null,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
