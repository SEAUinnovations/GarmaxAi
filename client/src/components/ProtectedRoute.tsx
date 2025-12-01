import React from 'react';
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
  const location = useLocation();

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const [, navigate] = useLocation();

  // Check authentication requirement
  if (requiresAuth && !isAuthenticated) {
    // Redirect to login with return url
    React.useEffect(() => {
      navigate('/login');
    }, [navigate]);
    return null;
  }

  // Check trial requirement
  if (requiresTrialActive && user) {
    // If trial is expired and user hasn't upgraded, redirect to pricing
    if (isTrialExpired() && user.subscriptionTier === 'free') {
      React.useEffect(() => {
        navigate('/pricing');
      }, [navigate]);
      return null;
    }
  }

  return <>{children}</>;
}

// Helper component for public routes (login, register) that should redirect if already authenticated
export function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // If already authenticated, redirect to dashboard or intended destination
  if (isAuthenticated) {
    React.useEffect(() => {
      navigate('/dashboard');
    }, [navigate]);
    return null;
  }

  return <>{children}</>;
}