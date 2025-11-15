import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../config/supabase';
import Cookies from 'js-cookie';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [userData, setUserData] = useState(null);
  const [unverifiedUser, setUnverifiedUser] = useState(null); // For users who need email verification
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const handleUser = async (user) => {
    console.log('handleUser called for user:', user.id);
    
    try {
      console.log('Fetching user data from database...');
      
      // Add a race condition with timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Query timeout')), 5000);
      });
      
      const queryPromise = supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      
      let data, error;
      
      try {
        const result = await Promise.race([queryPromise, timeoutPromise]);
        data = result.data;
        error = result.error;
      } catch (timeoutError) {
        console.error('Query timed out, this may be a localhost issue');
        console.log('IMPORTANT: If on localhost, try accessing via your network IP instead (e.g., http://192.168.0.110:3000)');
        
        // Set loading to false after timeout
        setLoading(false);
        setError('Database connection timeout. Please try refreshing or use network IP address.');
        return;
      }

      console.log('User data query result:', { data, error });

      if (error) {
        console.error('Error fetching user data:', error);
        
        // If it's a row level security error, the user might not have access
        if (error.code === 'PGRST116' || error.message.includes('JSON object requested')) {
          console.log('User not found in database, signing out...');
          await supabase.auth.signOut();
        }
        
        setCurrentUser(null);
        setUserRole(null);
        setUserData(null);
        Cookies.remove('userSession');
        setLoading(false);
        return;
      }

      if (data) {
        console.log('User data loaded successfully:', data.email);
        
        // Check email verification status from both auth and database
        const isEmailVerified = !!user.email_confirmed_at;
        
        // Update database if email was verified but database doesn't reflect it
        if (isEmailVerified && !data.email_verified) {
          await supabase
            .from('users')
            .update({ email_verified: true })
            .eq('id', user.id);
          data.email_verified = true;
        }

        setCurrentUser(user);
        setUserRole(data.role);
        setUserData({
          uid: data.id,
          email: data.email,
          name: data.name,
          role: data.role,
          phone: data.phone,
          studentId: data.student_id,
          email_verified: isEmailVerified
        });

        // Set cookie for session management
        Cookies.set('userSession', user.id, { expires: 7 });
        
        console.log('User state updated successfully');
      } else {
        console.log('No user data found, signing out...');
        // User document doesn't exist, sign them out
        await supabase.auth.signOut();
        setCurrentUser(null);
        setUserRole(null);
        setUserData(null);
        Cookies.remove('userSession');
      }
    } catch (error) {
      console.error('Error in handleUser:', error);
      setError(error.message);
      setCurrentUser(null);
      setUserRole(null);
      setUserData(null);
    } finally {
      console.log('Setting loading to false');
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    let sessionHandled = false;
    let initialLoadComplete = false;
    let isPageLoad = true; // Track if this is the initial page load

    // Listen for auth changes (includes INITIAL_SESSION event on mount)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event);
      
      if (!mounted) return;

      // On page load, only handle INITIAL_SESSION (ignore SIGNED_IN that comes first)
      if (event === 'INITIAL_SESSION') {
        initialLoadComplete = true;
        isPageLoad = false; // Page load is complete
        
        if (session?.user) {
          console.log('Initial session found, loading user data...');
          sessionHandled = true;
          await handleUser(session.user);
        } else {
          console.log('No session');
          setLoading(false);
        }
      } else if (event === 'SIGNED_IN') {
        // Only handle SIGNED_IN after initial load is complete (actual login)
        if (initialLoadComplete && !sessionHandled && session?.user) {
          sessionHandled = true;
          console.log('User signed in, loading user data...');
          await handleUser(session.user);
        } else if (isPageLoad && !initialLoadComplete) {
          // Ignore SIGNED_IN only during initial page load before INITIAL_SESSION
          console.log('Ignoring SIGNED_IN during initial load, waiting for INITIAL_SESSION...');
        } else if (!isPageLoad && !sessionHandled && session?.user) {
          // Handle SIGNED_IN after logout (not during page load)
          sessionHandled = true;
          console.log('User signed in after logout, loading user data...');
          await handleUser(session.user);
        } else if (sessionHandled) {
          console.log('Session already handled, skipping...');
        }
      } else if (event === 'SIGNED_OUT') {
        console.log('User signed out, resetting auth state...');
        sessionHandled = false;
        initialLoadComplete = false;
        // Don't reset isPageLoad - we know we're not on initial page load anymore
        setCurrentUser(null);
        setUserRole(null);
        setUserData(null);
        setUnverifiedUser(null);
        Cookies.remove('userSession');
        setLoading(false);
      } else if (event === 'TOKEN_REFRESHED') {
        console.log('Token refreshed');
      }
    });

    // Safety timeout - only if session hasn't been handled after 15 seconds
    const safetyTimeout = setTimeout(() => {
      if (!sessionHandled && mounted && loading) {
        console.warn('Auth initialization timeout - no session event received');
        setLoading(false);
      }
    }, 15000);

    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

  // Refresh user data
  const refreshUserData = async () => {
    if (currentUser) {
      try {
        // Get fresh auth session to check email verification
        const { data: { session } } = await supabase.auth.getSession();
        
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', currentUser.id)
          .single();

        if (error) throw error;

        if (data) {
          const isEmailVerified = session?.user?.email_confirmed_at ? true : false;
          
          // Update database if email was verified
          if (isEmailVerified && !data.email_verified) {
            await supabase
              .from('users')
              .update({ email_verified: true })
              .eq('id', currentUser.id);
            data.email_verified = true;
          }
          
          setUserData({
            uid: data.id,
            email: data.email,
            name: data.name,
            role: data.role,
            phone: data.phone,
            studentId: data.student_id,
            email_verified: isEmailVerified
          });
          setUserRole(data.role);
        }
      } catch (error) {
        console.error('Error refreshing user data:', error);
      }
    }
  };

  const value = {
    currentUser,
    userRole,
    userData,
    unverifiedUser,
    setUnverifiedUser,
    loading,
    error,
    refreshUserData
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
