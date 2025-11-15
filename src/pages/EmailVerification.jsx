import React, { useState, useEffect } from 'react';
import { Mail, CheckCircle, AlertCircle, Loader, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import authService from '../services/authService';

const EmailVerification = ({ onVerified }) => {
  const { currentUser, userData, unverifiedUser, refreshUserData } = useAuth();
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  // Get email from either currentUser or unverifiedUser
  const userEmail = currentUser?.email || userData?.email || unverifiedUser?.email;
  const userName = userData?.name || unverifiedUser?.name;

  useEffect(() => {
    // Only check verification status if user is logged in
    if (!currentUser) return;

    // Check verification status periodically
    const interval = setInterval(async () => {
      await checkVerificationStatus();
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [currentUser]);

  const checkVerificationStatus = async () => {
    if (!currentUser) {
      setError('Please log in to check verification status');
      return;
    }

    setChecking(true);
    const result = await authService.getCurrentUserData();
    setChecking(false);

    if (result.success && result.user?.email_verified) {
      // User is verified, refresh and proceed
      await refreshUserData();
      if (onVerified) {
        onVerified();
      }
    }
  };

  const handleResendEmail = async () => {
    if (!userEmail) {
      setError('No email address found');
      return;
    }

    setResending(true);
    setError('');
    setMessage('');

    const result = await authService.resendVerificationEmail(userEmail);
    
    setResending(false);

    if (result.success) {
      setMessage('Verification email sent! Please check your inbox.');
    } else {
      setError(result.error || 'Failed to send verification email');
    }

    // Clear messages after 5 seconds
    setTimeout(() => {
      setMessage('');
      setError('');
    }, 5000);
  };

  const handleSignOut = async () => {
    if (currentUser) {
      await authService.signOut();
    }
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl shadow-blue-100 border border-gray-200/50 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-8 text-white text-center">
            <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-10 h-10" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Verify Your Email</h1>
            <p className="text-blue-100">
              We've sent a verification link to
            </p>
            <p className="font-semibold mt-1">{userEmail}</p>
          </div>

          {/* Content */}
          <div className="p-8">
            {/* Success Message */}
            {message && (
              <div className="mb-6 p-4 bg-green-100 border border-green-200 text-green-700 rounded-xl">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm font-medium">{message}</span>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-100 border border-red-200 text-red-700 rounded-xl">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm font-medium">{error}</span>
                </div>
              </div>
            )}

            {/* Instructions */}
            <div className="space-y-4 mb-8">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-blue-600 text-sm font-bold">1</span>
                </div>
                <div>
                  <p className="text-gray-700">
                    Check your email inbox for a verification link from ClassSync
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-blue-600 text-sm font-bold">2</span>
                </div>
                <div>
                  <p className="text-gray-700">
                    Click the verification link in the email
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-blue-600 text-sm font-bold">3</span>
                </div>
                <div>
                  <p className="text-gray-700">
                    Return to this page - you'll be automatically redirected once verified
                  </p>
                </div>
              </div>
            </div>

            {/* Checking Status */}
            {checking && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex items-center justify-center space-x-2 text-blue-600">
                  <Loader className="w-5 h-5 animate-spin" />
                  <span className="text-sm font-medium">Checking verification status...</span>
                </div>
              </div>
            )}

            {/* Resend Button */}
            <button
              onClick={handleResendEmail}
              disabled={resending}
              className="w-full flex items-center justify-center space-x-2 px-6 py-3 rounded-xl text-white font-medium transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg shadow-blue-200 mb-4"
            >
              {resending ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Mail className="w-5 h-5" />
                  <span>Resend Verification Email</span>
                </>
              )}
            </button>

            {/* Check Status Button */}
            <button
              onClick={checkVerificationStatus}
              disabled={checking || !currentUser}
              className="w-full flex items-center justify-center space-x-2 px-6 py-3 rounded-xl border-2 border-gray-300 text-gray-700 font-medium transition-all hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed mb-4"
            >
              {checking ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  <span>Checking...</span>
                </>
              ) : !currentUser ? (
                <>
                  <CheckCircle className="w-5 h-5" />
                  <span>Please verify email then log in</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  <span>Check Verification Status</span>
                </>
              )}
            </button>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-500">or</span>
              </div>
            </div>

            {/* Sign Out / Back Button */}
            <button
              onClick={handleSignOut}
              className="w-full flex items-center justify-center space-x-2 px-6 py-3 rounded-xl text-gray-700 font-medium transition-all hover:bg-gray-100"
            >
              <span>{currentUser ? 'Sign Out' : 'Back to Login'}</span>
              <ArrowRight className="w-5 h-5" />
            </button>

            {/* Help Text */}
            <div className="mt-8 p-4 bg-gray-50 rounded-xl">
              <p className="text-sm text-gray-600 text-center">
                <strong>Didn't receive the email?</strong>
                <br />
                Check your spam folder or click "Resend Verification Email"
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailVerification;
