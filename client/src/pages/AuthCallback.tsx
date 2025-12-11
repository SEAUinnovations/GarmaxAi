import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

// Use relative URL in production, localhost for development
const API_BASE_URL = import.meta.env.DEV ? 'http://localhost:3000/api' : '/api';

/**
 * AuthCallback - Handles OAuth callback from Cognito/Google
 * Extracts authorization code and exchanges it for tokens
 */
export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const hasProcessed = useRef(false);

  useEffect(() => {
    const handleCallback = async () => {
      // Prevent duplicate exchanges (React StrictMode runs effects twice)
      if (hasProcessed.current) {
        console.log('[AuthCallback] Already processed, skipping duplicate call');
        return;
      }
      
      console.log('[AuthCallback] Starting OAuth callback processing');
      hasProcessed.current = true;
      
      try {
        // Parse URL parameters
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        const state = params.get("state");
        const errorParam = params.get("error");
        const errorDescription = params.get("error_description");

        console.log('[AuthCallback] Parsed params:', { 
          hasCode: !!code, 
          codePreview: code?.substring(0, 10) + '...',
          state, 
          errorParam 
        });

        // Handle OAuth errors
        if (errorParam) {
          throw new Error(errorDescription || errorParam);
        }

        if (!code) {
          throw new Error("No authorization code received");
        }

        console.log('[AuthCallback] Exchanging authorization code...');
        const exchangeStartTime = Date.now();

        // Exchange authorization code for tokens via your backend
        const response = await fetch(`${API_BASE_URL}/auth/oauth/callback`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            code,
            state,
            redirectUri: window.location.origin + "/auth/callback",
          }),
          credentials: "include",
        });

        const exchangeDuration = Date.now() - exchangeStartTime;
        console.log(`[AuthCallback] Token exchange took ${exchangeDuration}ms, status: ${response.status}`);

        if (!response.ok) {
          const errorData = await response.json();
          console.error('[AuthCallback] Token exchange failed:', errorData);
          throw new Error(errorData.message || "Failed to authenticate");
        }

        const data = await response.json();

        // Validate we have all required data
        if (!data.user || !data.idToken) {
          throw new Error("Invalid response from server");
        }

        console.log('[AuthCallback] Authentication successful, user:', data.user.email);

        // Store tokens in localStorage
        // Use id_token as the primary auth token because it contains user claims (email, name, etc.)
        // Access tokens only contain 'sub' and are meant for API authorization
        localStorage.setItem("auth_token", data.idToken);
        if (data.accessToken) {
          localStorage.setItem("accessToken", data.accessToken);
        }
        if (data.refreshToken) {
          localStorage.setItem("refreshToken", data.refreshToken);
        }

        console.log('[AuthCallback] Redirecting to dashboard');
        
        // Redirect to dashboard
        const returnTo = state || "/dashboard";
        window.location.href = returnTo;
      } catch (err) {
        console.error("OAuth callback error:", err);
        setError(err instanceof Error ? err.message : "Authentication failed");
        
        // Redirect to login after 3 seconds on error
        setTimeout(() => {
          setLocation("/login");
        }, 3000);
      }
    };

    handleCallback();
  }, []); // Empty dependency array - only run once

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-md p-6">
          <div className="text-destructive text-6xl">⚠️</div>
          <h1 className="text-2xl font-bold text-foreground">Authentication Error</h1>
          <p className="text-muted-foreground">{error}</p>
          <p className="text-sm text-muted-foreground">
            Redirecting to login page...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
        <h1 className="text-2xl font-bold text-foreground">Completing Sign In</h1>
        <p className="text-muted-foreground">Please wait while we verify your credentials...</p>
      </div>
    </div>
  );
}
