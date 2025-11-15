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
      
      // Get user data from public.users table
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

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
      // Make sure to set loading to false even on error
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

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event);
      
      if (!mounted) return;

      if (event === 'INITIAL_SESSION') {
        // This fires first on page load
        if (session?.user) {
          console.log('Initial session found, loading user data...');
          await handleUser(session.user);
        } else {
          console.log('No initial session');
          setLoading(false);
        }
      } else if (event === 'SIGNED_IN') {
        await handleUser(session.user);
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setUserRole(null);
        setUserData(null);
        setUnverifiedUser(null);
        Cookies.remove('userSession');
        setLoading(false);
      } else if (event === 'TOKEN_REFRESHED') {
        // Session refreshed, user data should still be valid
        console.log('Token refreshed');
      }
    });

    return () => {
      mounted = false;
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
