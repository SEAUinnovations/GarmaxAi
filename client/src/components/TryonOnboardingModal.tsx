import React, { useState, useEffect } from 'react';
import { X, Mail, Shield, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface TryonOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type ModalStep = 'email' | 'verification' | 'success';

export function TryonOnboardingModal({ isOpen, onClose, onSuccess }: TryonOnboardingModalProps) {
  const { startFreeTrial, verifyTrialEmail, resendVerificationEmail } = useAuth();
  const [step, setStep] = useState<ModalStep>('email');
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [canResend, setCanResend] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  // Reset modal state when opening/closing
  useEffect(() => {
    if (isOpen) {
      setStep('email');
      setEmail('');
      setVerificationCode('');
      setError('');
      setCanResend(false);
      setResendCountdown(0);
    }
  }, [isOpen]);

  // Resend countdown timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCountdown > 0) {
      timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
    } else if (step === 'verification' && resendCountdown === 0) {
      setCanResend(true);
    }
    return () => clearTimeout(timer);
  }, [resendCountdown, step]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      await startFreeTrial(email.trim());
      setStep('verification');
      setResendCountdown(60); // 60 second cooldown for resend
      setCanResend(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start trial');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      await verifyTrialEmail(email, verificationCode.trim());
      setStep('success');
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid verification code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!canResend) return;

    setIsLoading(true);
    setError('');

    try {
      await resendVerificationEmail(email);
      setResendCountdown(60);
      setCanResend(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend verification');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              {step === 'email' && <Mail className="w-4 h-4 text-blue-600" />}
              {step === 'verification' && <Shield className="w-4 h-4 text-blue-600" />}
              {step === 'success' && <CheckCircle className="w-4 h-4 text-green-600" />}
            </div>
            <h2 className="text-xl font-semibold">
              {step === 'email' && 'Start Your Free Trial'}
              {step === 'verification' && 'Verify Your Email'}
              {step === 'success' && 'Welcome to GarmaxAi!'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isLoading}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Email Step */}
          {step === 'email' && (
            <>
              <p className="text-gray-600 mb-6">
                Enter your email address to start your 3-day free trial. No credit card required.
              </p>
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="your@email.com"
                    required
                    disabled={isLoading}
                  />
                </div>
                {error && (
                  <div className="flex items-center space-x-2 text-red-600 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    <span>{error}</span>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={isLoading || !email.trim()}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? 'Starting Trial...' : 'Start Free Trial'}
                </button>
              </form>
              <div className="mt-4 text-xs text-gray-500">
                By starting your trial, you agree to our Terms of Service and Privacy Policy.
              </div>
            </>
          )}

          {/* Verification Step */}
          {step === 'verification' && (
            <>
              <p className="text-gray-600 mb-6">
                We've sent a verification code to <strong>{email}</strong>. 
                Please enter the 6-character code below.
              </p>
              <form onSubmit={handleVerificationSubmit} className="space-y-4">
                <div>
                  <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2">
                    Verification Code
                  </label>
                  <input
                    type="text"
                    id="code"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.toUpperCase())}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl font-mono tracking-widest"
                    placeholder="ABC123"
                    maxLength={6}
                    required
                    disabled={isLoading}
                  />
                </div>
                {error && (
                  <div className="flex items-center space-x-2 text-red-600 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    <span>{error}</span>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={isLoading || verificationCode.length !== 6}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? 'Verifying...' : 'Verify Email'}
                </button>
              </form>
              
              {/* Resend Link */}
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={!canResend || isLoading}
                  className="text-sm text-blue-600 hover:text-blue-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  {canResend ? (
                    'Resend verification code'
                  ) : (
                    `Resend in ${resendCountdown}s`
                  )}
                </button>
              </div>
              
              {/* Change Email */}
              <div className="mt-2 text-center">
                <button
                  type="button"
                  onClick={() => setStep('email')}
                  className="text-sm text-gray-600 hover:text-gray-700"
                  disabled={isLoading}
                >
                  Use a different email address
                </button>
              </div>
            </>
          )}

          {/* Success Step */}
          {step === 'success' && (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-gray-600 mb-2">
                Your account has been verified successfully!
              </p>
              <p className="text-sm text-gray-500">
                Welcome to GarmaxAi. You'll be redirected to your dashboard shortly.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}