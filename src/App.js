// src/App.js - Updated with React Router for proper page refresh handling

import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LandingPage from './pages/LandingPage';
import CreateSection from './pages/CreateSection';
import EnrollSection from './pages/EnrollSection';
import Dashboard from './pages/Dashboard';
import EmailVerification from './pages/EmailVerification';
import InstallPWA from './components/InstallPWA';
import sectionService from './services/sectionService';
import oneSignalService from './services/oneSignalService';

// Protected Route Component
function ProtectedRoute({ children }) {
  const { currentUser, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }
  
  return currentUser ? children : <Navigate to="/" replace />;
}

// Main App Router Component
function AppRouter() {
  const { currentUser, userRole, userData, unverifiedUser, setUnverifiedUser, loading, refreshUserData } = useAuth();
  const [hasSection, setHasSection] = useState(false);
  const [checkingSection, setCheckingSection] = useState(true);

  // Initialize OneSignal when app loads
  useEffect(() => {
    // Temporarily disabled to debug infinite refresh
    // console.log('Initializing OneSignal...');
    // oneSignalService.initialize();
    // console.log('OneSignal initialized successfully');
  }, []); // Run once when app loads

  // Check if user has sections when authenticated
  useEffect(() => {
    const checkUserSections = async () => {
      if (currentUser && userData) {
        setCheckingSection(true);
        try {
          if (userRole === 'cr') {
            const result = await sectionService.getCRSections(userData.uid);
            setHasSection(result.success && result.sections.length > 0);
          } else if (userRole === 'student') {
            const result = await sectionService.getStudentSections(userData.uid);
            setHasSection(result.success && result.sections.length > 0);
          }
        } catch (error) {
          console.error('Error checking sections:', error);
        } finally {
          setCheckingSection(false);
        }
      } else {
        setCheckingSection(false);
        setHasSection(false);
      }
    };

    checkUserSections();
  }, [currentUser, userData, userRole]);

  const handleAuthSuccess = (userData) => {
    console.log('Authentication successful:', userData);
  };

  const handleSectionCreated = (sectionData) => {
    setHasSection(true);
  };

  const handleEnrollmentSuccess = (sectionData) => {
    setHasSection(true);
  };

  // Show loading only while checking authentication (not sections)
  if (loading || (currentUser && checkingSection)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <InstallPWA />
      
      <Routes>
        {/* Public Route - Landing Page */}
        <Route 
          path="/" 
          element={
            currentUser ? (
              userData?.email_verified === false ? (
                <Navigate to="/verify-email" replace />
              ) : userRole === 'cr' && !hasSection ? (
                <Navigate to="/create-section" replace />
              ) : userRole === 'student' && !hasSection ? (
                <Navigate to="/enroll-section" replace />
              ) : (
                <Navigate to="/dashboard" replace />
              )
            ) : (
              <LandingPage onAuthSuccess={handleAuthSuccess} />
            )
          } 
        />

        {/* Email Verification Route */}
        <Route 
          path="/verify-email" 
          element={
            unverifiedUser && !currentUser ? (
              <EmailVerification onVerified={() => {
                setUnverifiedUser(null);
                window.location.reload();
              }} />
            ) : currentUser && userData && !userData.email_verified ? (
              <EmailVerification onVerified={refreshUserData} />
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />

        {/* Create Section Route - CR only */}
        <Route 
          path="/create-section" 
          element={
            <ProtectedRoute>
              {userRole === 'cr' && !hasSection ? (
                <CreateSection onSectionCreated={handleSectionCreated} />
              ) : (
                <Navigate to="/dashboard" replace />
              )}
            </ProtectedRoute>
          } 
        />

        {/* Enroll Section Route - Student only */}
        <Route 
          path="/enroll-section" 
          element={
            <ProtectedRoute>
              {userRole === 'student' && !hasSection ? (
                <EnrollSection onEnrollmentSuccess={handleEnrollmentSuccess} />
              ) : (
                <Navigate to="/dashboard" replace />
              )}
            </ProtectedRoute>
          } 
        />

        {/* Dashboard Route - All authenticated users with sections */}
        <Route 
          path="/dashboard/*" 
          element={
            <ProtectedRoute>
              {(userRole === 'cr' || userRole === 'student') && hasSection ? (
                <Dashboard />
              ) : userRole === 'cr' && !hasSection ? (
                <Navigate to="/create-section" replace />
              ) : userRole === 'student' && !hasSection ? (
                <Navigate to="/enroll-section" replace />
              ) : (
                <Navigate to="/" replace />
              )}
            </ProtectedRoute>
          } 
        />

        {/* Catch all - redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

// Main App Component
function App() {
  return (
    <AuthProvider>
      <div className="App">
        <AppRouter />
      </div>
    </AuthProvider>
  );
}

export default App;
