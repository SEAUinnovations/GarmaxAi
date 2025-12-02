import React, { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiresAuth?: boolean;
  requiresTrialActive?: boolean;
}

export function ProtectedRoute({ 
  children, 
  requiresAuth = true, 
  requiresTrialActive = false 
}: ProtectedRouteProps) {
  const { isAuthenticated, user, isLoading, isTrialExpired } = useAuth();
  const [, navigate] = useLocation();

  // Handle navigation effects at the top level
  useEffect(() => {
    if (isLoading) return;

    // Check authentication requirement
    if (requiresAuth && !isAuthenticated) {
      navigate('/login');
      return;
    }

    // Check trial requirement
    if (requiresTrialActive && user && isTrialExpired() && user.subscriptionTier === 'free') {
      navigate('/pricing');
      return;
    }
  }, [isLoading, requiresAuth, isAuthenticated, requiresTrialActive, user, isTrialExpired, navigate]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Don't render children if authentication/trial checks fail
  if (requiresAuth && !isAuthenticated) {
    return null;
  }

  if (requiresTrialActive && user && isTrialExpired() && user.subscriptionTier === 'free') {
    return null;
  }

  return <>{children}</>;
}

// Helper component for public routes (login, register) that should redirect if already authenticated
export function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();

  // Handle navigation at the top level
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Don't render children if already authenticated (will redirect)
  if (isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}