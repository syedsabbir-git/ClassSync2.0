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

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        handleUser(session.user);
      } else {
        setCurrentUser(null);
        setUserRole(null);
        setUserData(null);
        Cookies.remove('userSession');
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event);
      
      if (session?.user) {
        await handleUser(session.user);
      } else {
        setCurrentUser(null);
        setUserRole(null);
        setUserData(null);
        Cookies.remove('userSession');
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleUser = async (user) => {
    try {
      // Get user data from public.users table
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (data) {
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
      } else {
        // User document doesn't exist, sign them out
        await supabase.auth.signOut();
        setCurrentUser(null);
        setUserRole(null);
        setUserData(null);
        Cookies.remove('userSession');
      }
    } catch (error) {
      console.error('Error in auth state change:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

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
