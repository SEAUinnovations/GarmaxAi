import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

/**
 * AuthCallback - Handles OAuth callback from Cognito/Google
 * Extracts authorization code and exchanges it for tokens
 */
export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Parse URL parameters
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        const state = params.get("state");
        const errorParam = params.get("error");
        const errorDescription = params.get("error_description");

        // Handle OAuth errors
        if (errorParam) {
          throw new Error(errorDescription || errorParam);
        }

        if (!code) {
          throw new Error("No authorization code received");
        }

        // Exchange authorization code for tokens via your backend
        const response = await fetch("/api/auth/callback", {
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

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to authenticate");
        }

        const data = await response.json();

        // Update auth context with user data
        if (data.user && data.accessToken) {
          // Store tokens
          localStorage.setItem("auth_token", data.accessToken);
          if (data.idToken) {
            localStorage.setItem("idToken", data.idToken);
          }
          if (data.refreshToken) {
            localStorage.setItem("refreshToken", data.refreshToken);
          }

          // Set user directly (OAuth login doesn't need email/password)
          // The backend has already validated the user via OAuth
          window.location.href = state || "/dashboard";
        } else {
          throw new Error("Invalid response from server");
        }

        // Redirect to dashboard or original destination
        const returnTo = state || "/dashboard";
        setLocation(returnTo);
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
  }, [login, setLocation]);

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
