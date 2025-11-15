// src/services/notificationService.js - Supabase version with OneSignal integration
import { supabase } from '../config/supabase';
import oneSignalService from './oneSignalService';

class NotificationService {
  /**
   * Send push notification via OneSignal
   */
  async sendPushNotification({ sectionId, title, message, studentIds }) {
    try {
      console.log('Sending push notification via OneSignal...', {
        sectionId,
        title,
        recipients: studentIds?.length || 'all students'
      });

      // Get OneSignal App ID from environment
      const appId = process.env.REACT_APP_ONESIGNAL_APP_ID;
      const apiKey = process.env.REACT_APP_ONESIGNAL_API_KEY;

      if (!appId || !apiKey) {
        console.warn('OneSignal credentials not configured');
        return { success: false, error: 'Push notifications not configured' };
      }

      // Get player IDs for students
      const { data: subscriptions, error } = await supabase
        .from('onesignal_subscriptions')
        .select('player_id')
        .eq('section_id', sectionId)
        .in('user_id', studentIds);

      if (error) throw error;

      if (!subscriptions || subscriptions.length === 0) {
        console.log('No subscriptions found for students');
        return { success: true, message: 'No subscribers' };
      }

      const playerIds = subscriptions.map(s => s.player_id);

      // Send notification via OneSignal REST API
      const response = await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${apiKey}`
        },
        body: JSON.stringify({
          app_id: appId,
          include_player_ids: playerIds,
          headings: { en: title },
          contents: { en: message },
          data: {
            section_id: sectionId,
            type: 'section_notification'
          }
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.errors?.join(', ') || 'Failed to send notification');
      }

      console.log('Push notification sent successfully:', result);
      return { success: true, data: result };
    } catch (err) {
      console.error('Error sending push notification:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Create notifications for all students in a section
   */
  async createNotificationForSection({
    sectionId,
    crId,
    crName,
    title,
    message,
    type,
    relatedId,
    studentIds,
    notifyCR = true
  }) {
    try {
      console.log('Creating notifications for section:', sectionId);

      const notifications = [];

      // Helper function to truncate message
      const truncateMessage = (text, maxLength = 10) => {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength).trim() + '...';
      };

      const truncatedMessage = truncateMessage(message);

      // Create notifications for all students
      const studentNotifications = studentIds.map(studentId => ({
        section_id: sectionId,
        cr_id: crId,
        cr_name: crName,
        student_id: studentId,
        title: title,
        message: truncatedMessage,
        type: type,
        related_id: relatedId,
        is_read: false
      }));

      if (studentNotifications.length > 0) {
        const { error: studentError } = await supabase
          .from('notifications')
          .insert(studentNotifications);

        if (studentError) throw studentError;
        notifications.push(...studentNotifications);
      }

      // Also create notification for CR
      if (notifyCR) {
        const crNotification = {
          section_id: sectionId,
          cr_id: crId,
          cr_name: crName,
          student_id: crId,
          title: `✅ ${title} Created`,
          message: `${truncatedMessage} - Shared with ${studentIds.length} students`,
          type: `${type}_created`,
          related_id: relatedId,
          is_read: false
        };

        const { error: crError } = await supabase
          .from('notifications')
          .insert([crNotification]);

        if (crError) throw crError;
        notifications.push(crNotification);
      }

      console.log('Notifications created successfully:', notifications.length);

      // Send push notifications via OneSignal
      await this.sendPushNotification({
        sectionId,
        title,
        message,
        studentIds
      });

      return { success: true, notifications };

    } catch (error) {
      console.error('Error creating notifications:', error);
      return { success: false, error: this.getErrorMessage(error) };
    }
  }

  // Get notifications for a specific user
  async getNotificationsForUser(userId) {
    try {
      console.log('Loading notifications for user:', userId);

      const { data: notifications, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('student_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      console.log('Found notifications:', notifications?.length || 0);
      return { success: true, notifications: notifications || [] };

    } catch (error) {
      console.error('Error getting notifications:', error);
      return { success: false, error: this.getErrorMessage(error), notifications: [] };
    }
  }

  // Mark notification as read
  async markAsRead(notificationId) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return { success: false, error: this.getErrorMessage(error) };
    }
  }

  // Mark all notifications as read for a user
  async markAllAsRead(userId) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('student_id', userId)
        .eq('is_read', false);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      return { success: false, error: this.getErrorMessage(error) };
    }
  }

  // Real-time listener for notifications
  subscribeToUserNotifications(userId, callback) {
    try {
      const channel = supabase
        .channel('notifications-changes')
        .on('postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `student_id=eq.${userId}`
          },
          async (payload) => {
            console.log('Notification change detected:', payload);
            // Refetch all notifications
            const result = await this.getNotificationsForUser(userId);
            callback(result);
          }
        )
        .subscribe();

      // Initial load
      this.getNotificationsForUser(userId).then(callback);

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (error) {
      console.error('Error setting up notifications subscription:', error);
      return null;
    }
  }

  // Save OneSignal subscription
  async saveOneSignalSubscription(userId, sectionId, playerId, subscriptionId = null) {
    try {
      const { error } = await supabase
        .from('onesignal_subscriptions')
        .upsert([{
          user_id: userId,
          section_id: sectionId,
          player_id: playerId,
          subscription_id: subscriptionId
        }], {
          onConflict: 'user_id,section_id,player_id'
        });

      if (error) throw error;

      console.log('OneSignal subscription saved');
      return { success: true };
    } catch (error) {
      console.error('Error saving OneSignal subscription:', error);
      return { success: false, error: error.message };
    }
  }

  // Remove OneSignal subscription
  async removeOneSignalSubscription(userId, sectionId) {
    try {
      const { error } = await supabase
        .from('onesignal_subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('section_id', sectionId);

      if (error) throw error;

      console.log('OneSignal subscription removed');
      return { success: true };
    } catch (error) {
      console.error('Error removing OneSignal subscription:', error);
      return { success: false, error: error.message };
    }
  }

  // Helper method to format error messages
  getErrorMessage(error) {
    console.error('Supabase error details:', error);

    if (error.code) {
      switch (error.code) {
        case '42501':
        case 'PGRST301':
          return 'Permission denied. Please make sure you are logged in and have the right permissions.';
        case 'PGRST116':
          return 'The requested data was not found.';
        default:
          return error.message || 'An unexpected error occurred. Please try again.';
      }
    }

    return error.message || 'An unexpected error occurred. Please try again.';
  }
}

export default new NotificationService();
