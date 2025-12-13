/// <reference types="vite/client" />

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  username?: string;
  emailVerified: boolean;
  trialExpiresAt: string | null;
  trialStatus: 'active' | 'expired' | 'converted' | null;
  subscriptionTier: 'free' | 'studio' | 'pro';
  creditsRemaining: number;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<{ requiresVerification: boolean; message?: string }>;
  startFreeTrial: (email: string) => Promise<{ requiresVerification: boolean; message: string; tempPassword?: string }>;
  verifyTrialEmail: (email: string, verificationCode: string) => Promise<{ verified: boolean; message: string }>;
  resendVerificationEmail: (email: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isTrialExpired: () => boolean;
  getDaysUntilTrialExpires: () => number | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Use absolute backend URL in production to avoid CloudFront routing issues
const API_BASE_URL = import.meta.env.DEV ? 'http://localhost:3000/api' : 'https://be.garmaxai.com/api';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing auth token on app load
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      validateTokenAndSetUser(token);
    } else {
      setIsLoading(false);
    }
  }, []);

  const validateTokenAndSetUser = async (token: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        // Token is invalid, remove it
        localStorage.removeItem('auth_token');
      }
    } catch (error) {
      console.error('Error validating token:', error);
      localStorage.removeItem('auth_token');
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Login failed');
      }

      const { token, user: userData } = await response.json();
      localStorage.setItem('auth_token', token);
      setUser(userData);
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/oauth/google`);
      if (!response.ok) {
        throw new Error('Failed to initiate Google login');
      }
      const { authUrl } = await response.json();
      window.location.href = authUrl;
    } catch (error) {
      console.error('Google login failed:', error);
      throw new Error('Failed to connect to Google. Please try again.');
    }
  };

  const register = async (email: string, password: string, name: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, username: name }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Registration failed');
      }

      const result = await response.json();
      
      if (result.requiresVerification) {
        // Don't set user yet, wait for email verification
        return { requiresVerification: true, message: result.message };
      } else {
        // If somehow verification isn't required, set user and token
        if (result.token) {
          localStorage.setItem('auth_token', result.token);
          setUser(result.user);
        }
        return { requiresVerification: false };
      }
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const startFreeTrial = async (email: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/start-free-trial`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to start free trial');
      }

      const result = await response.json();
      
      // Store temp password for login after verification
      if (result.tempPassword) {
        sessionStorage.setItem('trial_temp_password', result.tempPassword);
        sessionStorage.setItem('trial_email', email);
      }
      
      return result;
    } catch (error) {
      throw error;
    }
  };

  const verifyTrialEmail = async (email: string, verificationCode: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify-trial-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, verificationCode }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Email verification failed');
      }

      const result = await response.json();
      
      if (result.verified) {
        // Now try to login automatically with the temp password
        const tempPassword = sessionStorage.getItem('trial_temp_password');
        if (tempPassword) {
          try {
            await login(email, tempPassword);
            // Clean up temp data
            sessionStorage.removeItem('trial_temp_password');
            sessionStorage.removeItem('trial_email');
          } catch (loginError) {
            // If auto-login fails, user will need to login manually
            console.warn('Auto-login after verification failed:', loginError);
          }
        }
      }
      
      return result;
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const resendVerificationEmail = async (email: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/resend-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to resend verification email');
      }
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    // Remove all token variants for consistent cleanup
    localStorage.removeItem('auth_token');
    localStorage.removeItem('id_token');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('idToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
  };

  const refreshUser = async () => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      await validateTokenAndSetUser(token);
    }
  };

  const isTrialExpired = (): boolean => {
    if (!user?.trialExpiresAt) return false;
    return new Date() > new Date(user.trialExpiresAt);
  };

  const getDaysUntilTrialExpires = (): number | null => {
    if (!user?.trialExpiresAt) return null;
    const expirationDate = new Date(user.trialExpiresAt);
    const now = new Date();
    const diffTime = expirationDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    loginWithGoogle,
    register,
    startFreeTrial,
    verifyTrialEmail,
    resendVerificationEmail,
    logout,
    refreshUser,
    isTrialExpired,
    getDaysUntilTrialExpires,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}