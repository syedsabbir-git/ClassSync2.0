import React, { useState } from 'react';
import { Key, BookOpen, ArrowRight, Loader, CheckCircle, LogOut } from 'lucide-react';
import sectionService from '../services/sectionService';
import oneSignalService from '../services/oneSignalService';
import notificationService from '../services/notificationService';
import { useAuth } from '../contexts/AuthContext';
import authService from '../services/authService';

const EnrollSection = ({ onEnrollmentSuccess }) => {
  const [sectionKey, setSectionKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [enrolledSection, setEnrolledSection] = useState(null);

  const { userData } = useAuth();

  const handleInputChange = (e) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    setSectionKey(value);
    setError('');
  };

  const handleLogout = async () => {
    await authService.signOut();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!sectionKey.trim()) {
      setError('Please enter a section key');
      return;
    }

    if (sectionKey.length !== 8) {
      setError('Section key must be 8 characters long');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // First enroll the student
      const result = await sectionService.enrollInSection({
        studentId: userData.uid,
        studentName: userData.name,
        sectionKey: sectionKey
      });

      if (result.success) {
        setEnrolledSection(result.sectionData);
        
        // Request OneSignal permission and subscribe to section
        const subscriptionResult = await oneSignalService.requestPermissionAndSubscribe(
          userData.uid,
          result.sectionData.id
        );

        // Save subscription if successful
        if (subscriptionResult.success && subscriptionResult.playerId) {
          await notificationService.saveOneSignalSubscription(
            userData.uid,
            result.sectionData.id,
            subscriptionResult.playerId
          );
          console.log('OneSignal subscription saved successfully');
        } else {
          console.log('OneSignal permission denied or failed:', subscriptionResult.error);
          // Don't fail enrollment if notification permission is denied
        }
        
        // Auto-redirect to dashboard after 3 seconds
        setTimeout(() => {
          onEnrollmentSuccess && onEnrollmentSuccess(result.sectionData);
        }, 3000);
      } else {
        setError(result.error);
      }
    } catch (error) {
      console.error('Enrollment error:', error);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (enrolledSection) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Successfully Enrolled!</h1>
          <p className="text-gray-600 mb-6">You have been enrolled in the section.</p>
          
          <div className="bg-blue-50 p-4 rounded-xl mb-6 text-left">
            <p className="text-sm text-gray-700"><strong>Department:</strong> {enrolledSection.departmentName}</p>
            <p className="text-sm text-gray-700"><strong>Batch:</strong> {enrolledSection.batchNumber}</p>
            <p className="text-sm text-gray-700"><strong>Class Rep:</strong> {enrolledSection.crName}</p>
            <p className="text-sm text-gray-700"><strong>Section Key:</strong> {enrolledSection.sectionKey}</p>
          </div>

          <p className="text-sm text-gray-500 mb-4">Redirecting to dashboard in 3 seconds...</p>
          
          <button
            onClick={() => onEnrollmentSuccess && onEnrollmentSuccess(enrolledSection)}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-xl font-medium hover:from-blue-600 hover:to-purple-700 transition-all"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">ClassSync</h1>
              <span className="text-sm text-gray-500">Student</span>
            </div>
            <button 
              onClick={handleLogout}
              className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-700"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Key className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Join a Section</h1>
            <p className="text-gray-600">Enter the section key provided by your Class Representative</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-100 border border-red-200 text-red-700 rounded-xl">
              <p className="text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Section Key
              </label>
              <input
                type="text"
                value={sectionKey}
                onChange={handleInputChange}
                className="block w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center text-2xl font-mono tracking-wider"
                placeholder="XXXXXXXX"
                maxLength={8}
                required
              />
              <p className="mt-1 text-sm text-gray-500">8-character key (letters and numbers)</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center space-x-2 px-6 py-3 rounded-xl text-white font-medium transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg"
            >
              {loading ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  <span>Enrolling...</span>
                </>
              ) : (
                <>
                  <span>Join Section</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 p-4 bg-blue-50 rounded-xl">
            <p className="text-sm text-blue-700">
              <strong>Need help?</strong> Ask your Class Representative for the section key. 
              It's an 8-character code that looks like "ABC12345".
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnrollSection;