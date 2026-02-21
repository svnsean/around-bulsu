// src/services/notificationService.js
// FCM Token Registration and Notification Handling for Emergency Alerts
import { Platform, PermissionsAndroid, NativeModules } from 'react-native';
import { supabase } from '../supabase';

// Store for the current FCM token
let currentToken = null;

// Lazy-loaded messaging module
let messagingModule = null;

// Track if channel was created
let channelCreated = false;

/**
 * Get the messaging instance, loading it lazily
 */
const getMessaging = async () => {
  if (messagingModule) return messagingModule;
  
  try {
    const mod = await import('@react-native-firebase/messaging');
    messagingModule = mod.default;
    return messagingModule;
  } catch (error) {
    console.warn('Firebase messaging not available:', error.message);
    return null;
  }
};

/**
 * Create the notification channel for Android 8+
 * This MUST be called before notifications can be displayed
 */
export const createNotificationChannel = async () => {
  if (Platform.OS !== 'android' || channelCreated) return;
  
  try {
    // Try using notifee for channel creation (more reliable)
    try {
      const notifee = await import('@notifee/react-native');
      await notifee.default.createChannel({
        id: 'emergency_alerts',
        name: 'Emergency Alerts',
        importance: 4, // HIGH
        vibration: true,
        sound: 'default',
      });
      channelCreated = true;
      console.log('Notification channel created with notifee');
      return;
    } catch (notifeeError) {
      console.log('Notifee not available, trying native module...');
    }

    // Fallback: Use React Native Firebase's native channel creation
    // The channel is already defined in AndroidManifest, but we need to ensure it exists
    const messaging = await getMessaging();
    if (messaging) {
      // React Native Firebase automatically creates the default channel
      // But we log to confirm setup
      console.log('Using default FCM channel: emergency_alerts');
      channelCreated = true;
    }
  } catch (error) {
    console.warn('Could not create notification channel:', error.message);
  }
};

/**
 * Request notification permissions from the user
 * @returns {Promise<boolean>} Whether permission was granted
 */
export const requestNotificationPermission = async () => {
  try {
    const messaging = await getMessaging();
    
    if (Platform.OS === 'android') {
      // Android 13+ requires explicit permission
      if (Platform.Version >= 33) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
      return true; // Android < 13 doesn't need explicit permission
    } else if (messaging) {
      // iOS permission request
      const authStatus = await messaging().requestPermission();
      return (
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL
      );
    }
    return false;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return false;
  }
};

/**
 * Get the FCM token and register it with Supabase
 * @returns {Promise<string|null>} The FCM token or null if failed
 */
export const registerFCMToken = async () => {
  try {
    const messaging = await getMessaging();
    if (!messaging) {
      console.warn('Messaging not available, skipping token registration');
      return null;
    }
    
    // Check if messaging is supported
    const isSupported = await messaging().isDeviceRegisteredForRemoteMessages;
    
    // Register for remote messages if not already
    if (!isSupported) {
      await messaging().registerDeviceForRemoteMessages();
    }

    // Get the FCM token
    const token = await messaging().getToken();
    
    if (!token) {
      console.warn('Failed to get FCM token');
      return null;
    }

    currentToken = token;
    console.log('FCM Token obtained:', token.substring(0, 20) + '...');

    // Get device info for debugging
    let deviceInfo = { platform: Platform.OS };
    try {
      const DeviceModule = await import('expo-device');
      const Device = DeviceModule.default || DeviceModule;
      deviceInfo = {
        brand: Device.brand || 'unknown',
        modelName: Device.modelName || 'unknown',
        osVersion: Device.osVersion || 'unknown',
        platform: Platform.OS,
      };
    } catch (e) {
      console.warn('Could not get device info:', e.message);
    }

    console.log('Attempting to save FCM token to Supabase...');

    // Upsert token to Supabase (update if exists, insert if new)
    const { data, error } = await supabase
      .from('user_fcm_tokens')
      .upsert(
        {
          token,
          device_info: JSON.stringify(deviceInfo),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'token' }
      )
      .select();

    if (error) {
      console.error('Error saving FCM token to Supabase:', error.message, error.code);
    } else {
      console.log('FCM token registered with Supabase successfully! Data:', data);
    }

    return token;
  } catch (error) {
    console.error('Error registering FCM token:', error.message);
    return null;
  }
};

/**
 * Remove the current FCM token from Supabase (for logout/cleanup)
 */
export const unregisterFCMToken = async () => {
  try {
    if (currentToken) {
      await supabase
        .from('user_fcm_tokens')
        .delete()
        .eq('token', currentToken);
      
      currentToken = null;
      console.log('FCM token unregistered');
    }
  } catch (error) {
    console.error('Error unregistering FCM token:', error);
  }
};

/**
 * Set up foreground message handler
 * @param {Function} onMessage - Callback when message received in foreground
 * @returns {Function} Unsubscribe function
 */
export const setupForegroundHandler = async (onMessage) => {
  const messaging = await getMessaging();
  if (!messaging) return () => {};
  
  return messaging().onMessage(async (remoteMessage) => {
    console.log('FCM message received in foreground:', remoteMessage);
    
    // Extract alert data
    const alert = {
      id: remoteMessage.messageId,
      title: remoteMessage.notification?.title || remoteMessage.data?.title || 'Emergency Alert',
      message: remoteMessage.notification?.body || remoteMessage.data?.message || '',
      severity: remoteMessage.data?.severity || 'critical',
      sent_at: remoteMessage.data?.sent_at || new Date().toISOString(),
    };

    onMessage?.(alert);
  });
};

/**
 * Set up the background message handler (MUST be called early, outside component lifecycle)
 * This handles messages when app is in background or killed
 */
export const registerBackgroundMessageHandler = async () => {
  try {
    const messaging = await getMessaging();
    if (!messaging) return;
    
    // This handler runs when app is in background or killed
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      console.log('FCM Background Message received:', remoteMessage);
      
      // For data-only messages, you can process here
      // The notification will be shown automatically by FCM if it has a notification payload
      // For data-only messages, you would need to use local notifications
      
      return Promise.resolve();
    });
    
    console.log('Background message handler registered');
  } catch (error) {
    console.warn('Could not register background handler:', error.message);
  }
};

/**
 * Set up background/quit state message handler
 * This is called when app is opened from a notification
 * @param {Function} onNotificationOpen - Callback when notification opens the app
 */
export const setupBackgroundHandler = async (onNotificationOpen) => {
  const messaging = await getMessaging();
  if (!messaging) return;
  
  // When app is in background and notification is tapped
  messaging().onNotificationOpenedApp((remoteMessage) => {
    console.log('Notification opened app from background:', remoteMessage);
    
    const alert = {
      id: remoteMessage.messageId,
      title: remoteMessage.notification?.title || remoteMessage.data?.title || 'Emergency Alert',
      message: remoteMessage.notification?.body || remoteMessage.data?.message || '',
      severity: remoteMessage.data?.severity || 'critical',
      sent_at: remoteMessage.data?.sent_at || new Date().toISOString(),
    };

    onNotificationOpen?.(alert);
  });

  // Check if app was opened from a notification when it was quit
  try {
    const remoteMessage = await messaging().getInitialNotification();
    if (remoteMessage) {
      console.log('Notification opened app from quit state:', remoteMessage);
      
      const alert = {
        id: remoteMessage.messageId,
        title: remoteMessage.notification?.title || remoteMessage.data?.title || 'Emergency Alert',
        message: remoteMessage.notification?.body || remoteMessage.data?.message || '',
        severity: remoteMessage.data?.severity || 'critical',
        sent_at: remoteMessage.data?.sent_at || new Date().toISOString(),
      };

      onNotificationOpen?.(alert);
    }
  } catch (e) {
    console.warn('Error checking initial notification:', e.message);
  }
};

/**
 * Listen to token refresh events
 * @returns {Function} Unsubscribe function
 */
export const setupTokenRefreshHandler = async () => {
  const messaging = await getMessaging();
  if (!messaging) return () => {};
  
  return messaging().onTokenRefresh(async (newToken) => {
    console.log('FCM token refreshed:', newToken.substring(0, 20) + '...');
    
    // Remove old token and register new one
    if (currentToken && currentToken !== newToken) {
      await supabase
        .from('user_fcm_tokens')
        .delete()
        .eq('token', currentToken);
    }

    currentToken = newToken;
    await registerFCMToken();
  });
};

/**
 * Initialize all notification handlers
 * @param {Object} handlers - Object with onForegroundMessage and onNotificationOpen callbacks
 * @returns {Function} Cleanup function to unsubscribe all handlers
 */
export const initializeNotifications = async (handlers) => {
  try {
    const { onForegroundMessage, onNotificationOpen } = handlers;

    // Check if messaging is available
    const messaging = await getMessaging();
    if (!messaging) {
      console.warn('FCM not available, skipping notification setup');
      return () => {};
    }

    // Create notification channel FIRST (required for Android 8+)
    await createNotificationChannel();

    // Request permission
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      console.warn('Notification permission not granted');
      return () => {};
    }

    // Register token
    await registerFCMToken();

    // Set up handlers
    const unsubForeground = await setupForegroundHandler(onForegroundMessage);
    await setupBackgroundHandler(onNotificationOpen);
    const unsubTokenRefresh = await setupTokenRefreshHandler();

    console.log('FCM notifications fully initialized');

    // Return cleanup function
    return () => {
      if (unsubForeground) unsubForeground();
      if (unsubTokenRefresh) unsubTokenRefresh();
    };
  } catch (error) {
    console.error('Error initializing notifications:', error);
    return () => {};
  }
};

export default {
  createNotificationChannel,
  requestNotificationPermission,
  registerFCMToken,
  unregisterFCMToken,
  setupForegroundHandler,
  setupBackgroundHandler,
  registerBackgroundMessageHandler,
  setupTokenRefreshHandler,
  initializeNotifications,
};
