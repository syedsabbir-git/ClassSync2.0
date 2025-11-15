// src/services/oneSignalService.js - OneSignal Push Notification Service
// Replaces Firebase Cloud Messaging (FCM)

import OneSignal from 'react-onesignal';

class OneSignalService {
  constructor() {
    this.appId = process.env.REACT_APP_ONESIGNAL_APP_ID || 'YOUR_ONESIGNAL_APP_ID';
    this.initialized = false;
    this.playerId = null;
  }

  /**
   * Initialize OneSignal SDK
   * Call this once when the app starts
   */
  async initialize() {
    try {
      // If already initialized, just return success
      if (this.initialized) {
        console.log('OneSignal already initialized (skipping duplicate init)');
        return { success: true };
      }

      // Initialize OneSignal with react-onesignal package
      await OneSignal.init({
        appId: this.appId,
        allowLocalhostAsSecureOrigin: true, // For development
      });

      console.log('OneSignal initialized successfully');
      this.initialized = true;

      return { success: true };
    } catch (error) {
      // Ignore duplicate initialization errors
      if (error.message && (error.message.includes('already initialized') || error.message.includes('initialized once'))) {
        console.log('OneSignal was already initialized, continuing...');
        this.initialized = true;
        return { success: true };
      }
      console.error('Error initializing OneSignal:', error);
      // Don't fail - just log the error
      this.initialized = true; // Mark as initialized anyway to prevent retries
      return { success: false, error: error.message };
    }
  }

  /**
   * Request notification permission and subscribe user
   * @param {string} userId - User's unique ID from Supabase
   * @param {string} sectionId - Section ID (optional, for tagging)
   * @returns {Promise<{success: boolean, playerId?: string, error?: string}>}
   */
  async requestPermissionAndSubscribe(userId, sectionId = null) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // Check if push notifications are supported
      const isPushSupported = await OneSignal.isPushNotificationsSupported();
      if (!isPushSupported) {
        return { success: false, error: 'Push notifications not supported on this browser' };
      }

      // Check current permission status
      const permission = await OneSignal.getNotificationPermission();
      
      if (permission === 'denied') {
        return { success: false, error: 'Notification permission was denied. Please enable it in browser settings.' };
      }

      // Request permission and subscribe
      await OneSignal.showNativePrompt();

      // Wait a bit for user to grant permission
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check if now subscribed
      const isSubscribed = await OneSignal.isPushNotificationsEnabled();
      
      if (!isSubscribed) {
        return { success: false, error: 'User did not grant notification permission' };
      }

      // Get player ID
      this.playerId = await OneSignal.getUserId();

      // Set external user ID (your app's user ID)
      await OneSignal.setExternalUserId(userId);

      // Add tags for filtering
      const tags = {
        user_id: userId,
        user_type: 'authenticated'
      };

      if (sectionId) {
        tags.section_id = sectionId;
      }

      await OneSignal.sendTags(tags);

      console.log('OneSignal subscription successful:', this.playerId);

      return { success: true, playerId: this.playerId };
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if user is subscribed to push notifications
   */
  async isSubscribed() {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      return await OneSignal.isPushNotificationsEnabled();
    } catch (error) {
      console.error('Error checking subscription status:', error);
      return false;
    }
  }

  /**
   * Get current player ID
   */
  async getPlayerId() {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (this.playerId) {
        return this.playerId;
      }

      const isSubscribed = await this.isSubscribed();
      if (isSubscribed) {
        this.playerId = await OneSignal.getUserId();
        return this.playerId;
      }

      return null;
    } catch (error) {
      console.error('Error getting player ID:', error);
      return null;
    }
  }

  /**
   * Update user tags (for targeting notifications)
   * @param {Object} tags - Key-value pairs of tags
   */
  async updateTags(tags) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      await OneSignal.sendTags(tags);
      console.log('Tags updated:', tags);
      return { success: true };
    } catch (error) {
      console.error('Error updating tags:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Remove specific tags
   * @param {string[]} tagKeys - Array of tag keys to remove
   */
  async removeTags(tagKeys) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      await OneSignal.deleteTags(tagKeys);
      console.log('Tags removed:', tagKeys);
      return { success: true };
    } catch (error) {
      console.error('Error removing tags:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe() {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      await OneSignal.setSubscription(false);
      this.playerId = null;
      console.log('Unsubscribed from push notifications');
      return { success: true };
    } catch (error) {
      console.error('Error unsubscribing:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Set up notification click handler
   * @param {Function} callback - Function to call when notification is clicked
   */
  async setNotificationClickHandler(callback) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      OneSignal.on('notificationDisplay', (event) => {
        console.log('OneSignal notification displayed:', event);
      });

      OneSignal.on('notificationDismiss', (event) => {
        console.log('OneSignal notification dismissed:', event);
      });

      // Handle notification clicks
      OneSignal.on('notificationClick', (event) => {
        console.log('OneSignal notification clicked:', event);
        if (callback) {
          callback(event);
        }
      });

      return { success: true };
    } catch (error) {
      console.error('Error setting up notification handler:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if push notifications are supported
   */
  async isPushSupported() {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      return await OneSignal.isPushNotificationsSupported();
    } catch (error) {
      console.error('Error checking push support:', error);
      return false;
    }
  }

  /**
   * Get notification permission status
   * @returns {Promise<'default'|'granted'|'denied'>}
   */
  async getPermissionStatus() {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      return await OneSignal.getNotificationPermission();
    } catch (error) {
      console.error('Error getting permission status:', error);
      return 'default';
    }
  }

  /**
   * Set external user ID (for targeting by user)
   * @param {string} userId - User's unique ID from your database
   */
  async setExternalUserId(userId) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      await OneSignal.setExternalUserId(userId);
      console.log('External user ID set:', userId);
      return { success: true };
    } catch (error) {
      console.error('Error setting external user ID:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Remove external user ID
   */
  async removeExternalUserId() {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      await OneSignal.removeExternalUserId();
      console.log('External user ID removed');
      return { success: true };
    } catch (error) {
      console.error('Error removing external user ID:', error);
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
export default new OneSignalService();
