import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

/**
 * AuthLogout - Handles OAuth logout callback
 */
export default function AuthLogout() {
  const [, setLocation] = useLocation();
  const { logout } = useAuth();

  useEffect(() => {
    const handleLogout = async () => {
      try {
        // Clear local auth state
        await logout();

        // Clear any stored tokens
        localStorage.removeItem("accessToken");
        localStorage.removeItem("idToken");
        localStorage.removeItem("refreshToken");

        // Redirect to home page
        setTimeout(() => {
          setLocation("/");
        }, 1000);
      } catch (err) {
        console.error("Logout error:", err);
        // Still redirect even on error
        setLocation("/");
      }
    };

    handleLogout();
  }, [logout, setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
        <h1 className="text-2xl font-bold text-foreground">Signing Out</h1>
        <p className="text-muted-foreground">You're being logged out...</p>
      </div>
    </div>
  );
}
