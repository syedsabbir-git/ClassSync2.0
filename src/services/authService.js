// src/services/authService.js - Supabase version with email verification
import { supabase } from '../config/supabase';
import Cookies from 'js-cookie';

class AuthService {
  // Sign up new user with email verification
  async signUp({ email, password, name, userType, studentId = null }) {
    try {
      // Validate required fields
      if (!email || !password || !name || !userType) {
        throw new Error('Email, password, name, and user type are required');
      }

      if (!['student', 'cr'].includes(userType)) {
        throw new Error('User type must be either "student" or "cr"');
      }

      // Sign up user with Supabase Auth (auto-sends verification email)
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            name: name,
            role: userType,
          },
          emailRedirectTo: `${window.location.origin}/verify-email`
        }
      });

      if (signUpError) throw signUpError;

      if (!authData.user) {
        throw new Error('User creation failed');
      }

      // Create user profile in public.users table
      const { error: profileError } = await supabase
        .from('users')
        .insert([
          {
            id: authData.user.id,
            email: email,
            name: name,
            role: userType,
            phone: '',
            student_id: userType === 'student' && studentId ? studentId : '',
            email_verified: false
          }
        ]);

      if (profileError) {
        console.error('Error creating user profile:', profileError);
        // Note: Auth user is already created, so we log but don't fail
      }

      // Set cookie for session management
      Cookies.set('userSession', authData.user.id, { expires: 7 });

      const userData = {
        uid: authData.user.id,
        email: email,
        name: name,
        role: userType,
        phone: '',
        studentId: userType === 'student' && studentId ? studentId : '',
        email_verified: false
      };

      return { 
        success: true, 
        user: userData,
        needsEmailVerification: true,
        message: 'Account created! Please check your email to verify your account.'
      };
    } catch (error) {
      console.error('Error in signUp:', error);
      return { success: false, error: error.message };
    }
  }

  // Sign in existing user
  async signIn({ email, password }) {
    try {
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
      });

      // Handle "Email not confirmed" error - return info for verification page
      if (signInError) {
        if (signInError.message && signInError.message.includes('Email not confirmed')) {
          // User exists but email not verified - get user info for verification page
          const { data: userData } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

          return {
            success: false,
            error: 'Please verify your email before signing in. Check your inbox for the verification link.',
            needsEmailVerification: true,
            userEmail: email,
            userName: userData?.name || ''
          };
        }
        throw signInError;
      }

      if (!authData.user) {
        throw new Error('Login failed');
      }

      // Get user data from public.users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (userError || !userData) {
        throw new Error('User data not found. Please contact support.');
      }

      // Check email verification from auth
      const isEmailVerified = !!authData.user.email_confirmed_at;

      // Update email_verified status in database if needed
      if (isEmailVerified && !userData.email_verified) {
        await supabase
          .from('users')
          .update({ email_verified: true })
          .eq('id', authData.user.id);
        userData.email_verified = true;
      }

      // Set cookie for session management
      Cookies.set('userSession', authData.user.id, { expires: 7 });

      return { 
        success: true, 
        user: {
          uid: userData.id,
          email: userData.email,
          name: userData.name,
          role: userData.role,
          phone: userData.phone,
          studentId: userData.student_id,
          email_verified: isEmailVerified
        }
      };
    } catch (error) {
      console.error('Error in signIn:', error);
      return { success: false, error: this.getErrorMessage(error.message) };
    }
  }

  // Update user profile
  async updateProfile({ name, phone = '', studentId = '' }) {
    try {
      console.log('Updating user profile:', { name, phone, studentId });
      
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('No authenticated user found');
      }

      // Validate required fields
      if (!name || name.trim() === '') {
        throw new Error('Name is required');
      }

      // Update user profile in public.users table
      const updateData = {
        name: name.trim(),
        phone: phone ? phone.trim() : '',
        updated_at: new Date().toISOString()
      };

      // Only add student_id if it's provided and not empty
      if (studentId && studentId.trim()) {
        updateData.student_id = studentId.trim();
      }

      const { error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', user.id);

      if (updateError) throw updateError;

      // Also update auth metadata
      const { error: metaError } = await supabase.auth.updateUser({
        data: { name: name.trim() }
      });

      if (metaError) {
        console.error('Error updating auth metadata:', metaError);
        // Don't fail the whole operation
      }
      
      console.log('Profile updated successfully');
      return { success: true, message: 'Profile updated successfully' };
      
    } catch (error) {
      console.error('Profile update error:', error);
      return { success: false, error: error.message };
    }
  }

  // Change password
  async changePassword(currentPassword, newPassword) {
    try {
      console.log('Changing user password');
      
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('No authenticated user found');
      }

      if (!currentPassword || !newPassword) {
        throw new Error('Current password and new password are required');
      }

      // Supabase requires re-authentication by signing in again with current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword
      });

      if (signInError) {
        throw new Error('Current password is incorrect');
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) throw updateError;
      
      console.log('Password changed successfully');
      return { success: true, message: 'Password changed successfully' };
      
    } catch (error) {
      console.error('Change password error:', error);
      return { success: false, error: error.message };
    }
  }

  // Sign out user
  async signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      Cookies.remove('userSession');
      return { success: true };
    } catch (error) {
      console.error('Error in signOut:', error);
      return { success: false, error: error.message };
    }
  }

  // Reset password
  async resetPassword(email) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });
      
      if (error) throw error;
      
      return { success: true };
    } catch (error) {
      console.error('Error in resetPassword:', error);
      return { success: false, error: error.message };
    }
  }

  // Resend verification email
  async resendVerificationEmail(email) {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/verify-email`
        }
      });

      if (error) throw error;

      return { success: true, message: 'Verification email sent! Please check your inbox.' };
    } catch (error) {
      console.error('Error resending verification email:', error);
      return { success: false, error: error.message };
    }
  }

  // Get current user data
  async getCurrentUserData() {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        return { success: false, error: 'No user logged in' };
      }

      const { data: userData, error: dataError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (dataError || !userData) {
        return { success: false, error: 'User data not found' };
      }

      return { 
        success: true, 
        user: {
          uid: userData.id,
          email: userData.email,
          name: userData.name,
          role: userData.role,
          phone: userData.phone,
          studentId: userData.student_id,
          email_verified: userData.email_verified || !!user.email_confirmed_at
        }
      };
    } catch (error) {
      console.error('Error in getCurrentUserData:', error);
      return { success: false, error: error.message };
    }
  }

  // Helper method to format error messages
  getErrorMessage(errorMessage) {
    // Supabase error messages
    if (errorMessage.includes('Invalid login credentials')) {
      return 'Invalid email or password.';
    }
    if (errorMessage.includes('Email not confirmed')) {
      return 'Please verify your email before signing in.';
    }
    if (errorMessage.includes('User already registered')) {
      return 'An account with this email already exists.';
    }
    if (errorMessage.includes('Password should be at least')) {
      return 'Password should be at least 6 characters long.';
    }
    if (errorMessage.includes('Invalid email')) {
      return 'Please enter a valid email address.';
    }
    if (errorMessage.includes('rate limit')) {
      return 'Too many attempts. Please try again later.';
    }
    return errorMessage || 'An error occurred. Please try again.';
  }
}

export default new AuthService();
