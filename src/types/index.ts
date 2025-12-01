import { Request } from "express";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    email: string;
    emailVerified: boolean;
    trialExpiresAt: Date | null;
    trialStatus: 'active' | 'expired' | 'converted' | null;
    subscriptionTier: 'free' | 'studio' | 'pro';
    creditsRemaining: number;
  };
  userId?: string; // For JWT middleware
}

export interface User {
  id: string;
  username: string;
  email: string;
  emailVerified: boolean;
  trialExpiresAt: Date | null;
  trialStatus: 'active' | 'expired' | 'converted' | null;
  subscriptionTier: 'free' | 'studio' | 'pro';
  credits: number;
  creditsRemaining: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TempUser {
  id: string;
  email: string;
  verificationCode: string;
  verificationExpiry: Date;
  trialExpiresAt: Date;
  createdAt: Date;
}
