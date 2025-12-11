import React from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "./components/ui/toaster";
import { TooltipProvider } from "./components/ui/tooltip";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute, PublicRoute } from "./components/ProtectedRoute";
import NotFound from "./pages/not-found";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Register from "./pages/Register";
import VirtualTryonStudio from "./pages/VirtualTryonStudio";
import Pricing from "./pages/Pricing";
import Account from "./pages/Account";
import AuthCallback from "./pages/AuthCallback";
import AuthLogout from "./pages/AuthLogout";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentCancel from "./pages/PaymentCancel";

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/" component={Home}/>
      <Route path="/pricing" component={Pricing}/>
      
      {/* Payment result routes */}
      <Route path="/payment/success" component={PaymentSuccess}/>
      <Route path="/payment/cancel" component={PaymentCancel}/>
      
      {/* OAuth callback routes */}
      <Route path="/auth/callback" component={AuthCallback}/>
      <Route path="/auth/logout" component={AuthLogout}/>
      
      {/* Auth routes - redirect if already logged in */}
      <Route path="/login">
        <PublicRoute>
          <Login />
        </PublicRoute>
      </Route>
      <Route path="/register">
        <PublicRoute>
          <Register />
        </PublicRoute>
      </Route>
      
      {/* Protected routes - require authentication */}
      <Route path="/dashboard">
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/virtual-tryon">
        <ProtectedRoute requiresTrialActive={true}>
          <VirtualTryonStudio />
        </ProtectedRoute>
      </Route>
      <Route path="/account">
        <ProtectedRoute>
          <Account />
        </ProtectedRoute>
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
