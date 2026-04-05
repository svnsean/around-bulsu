// src/services/notificationService.js
// Expo Notifications-based push token registration and notification handling
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase } from '../supabase';

// Store for the current Expo push token
let currentToken = null;

/**
 * Create the emergency_alerts notification channel for Android 8+
 * Must be called before requesting permissions on Android 13+
 */
export const createNotificationChannel = async () => {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync('emergency_alerts', {
      name: 'Emergency Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 200, 500, 200, 1000],
      lightColor: '#FF3B30',
      sound: 'default',
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
    });
    console.log('[Notifications] Android channel created: emergency_alerts');
  } catch (error) {
    console.warn('[Notifications] Could not create channel:', error.message);
  }
};

/**
 * Request notification permissions from the user
 * @returns {Promise<boolean>} Whether permission was granted
 */
export const requestNotificationPermission = async () => {
  try {
    if (!Device.isDevice) {
      console.warn('[Notifications] Must use a physical device for push notifications');
      return false;
    }
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.warn('[Notifications] Permission not granted');
      return false;
    }
    return true;
  } catch (error) {
    console.error('[Notifications] Error requesting permission:', error);
    return false;
  }
};

/**
 * Get the Expo push token and register it with Supabase
 * @returns {Promise<string|null>} The Expo push token or null if failed
 */
export const registerExpoPushToken = async () => {
  try {
    if (!Device.isDevice) {
      console.warn('[Notifications] Physical device required for push tokens');
      return null;
    }

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;

    if (!projectId) {
      console.error('[Notifications] EAS projectId not found in app config');
      return null;
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

    if (!token) {
      console.warn('[Notifications] Failed to get Expo push token');
      return null;
    }

    currentToken = token;
    console.log('[Notifications] Expo push token:', token.substring(0, 30) + '...');

    const deviceInfo = {
      brand: Device.brand || 'unknown',
      modelName: Device.modelName || 'unknown',
      osVersion: Device.osVersion || 'unknown',
      platform: Platform.OS,
    };

    const { error } = await supabase
      .from('user_fcm_tokens')
      .upsert(
        {
          token,
          device_info: deviceInfo,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'token' }
      );

    if (error) {
      console.error('[Notifications] Error saving token to Supabase:', error.message);
    } else {
      console.log('[Notifications] Token registered with Supabase successfully');
    }

    return token;
  } catch (error) {
    console.error('[Notifications] Error registering push token:', error.message);
    return null;
  }
};

// Keep old name as alias for backwards compat
export const registerFCMToken = registerExpoPushToken;

/**
 * Remove the current push token from Supabase (for logout/cleanup)
 */
export const unregisterFCMToken = async () => {
  try {
    if (currentToken) {
      await supabase
        .from('user_fcm_tokens')
        .delete()
        .eq('token', currentToken);
      currentToken = null;
      console.log('[Notifications] Token unregistered');
    }
  } catch (error) {
    console.error('[Notifications] Error unregistering token:', error);
  }
};

/**
 * Set up foreground notification handler — shows modal when notification arrives and app is open
 * @param {Function} onMessage - Callback when notification received in foreground
 * @returns {Function} Unsubscribe function
 */
export const setupForegroundHandler = (onMessage) => {
  const subscription = Notifications.addNotificationReceivedListener((notification) => {
    console.log('[Notifications] Received in foreground:', notification);
    const { title, body, data } = notification.request.content;
    const alert = {
      id: notification.request.identifier,
      title: title || 'Emergency Alert',
      message: body || '',
      severity: data?.severity || 'critical',
      sent_at: data?.sent_at || new Date().toISOString(),
    };
    onMessage?.(alert);
  });
  return () => subscription.remove();
};

/**
 * Set up response handler — called when user taps a notification (background or killed state)
 * @param {Function} onNotificationOpen - Callback when notification is tapped
 * @returns {Function} Unsubscribe function
 */
export const setupBackgroundHandler = (onNotificationOpen) => {
  // Handle tap on notification while app was backgrounded/killed
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    console.log('[Notifications] Notification tapped:', response);
    const { title, body, data } = response.notification.request.content;
    const alert = {
      id: response.notification.request.identifier,
      title: title || 'Emergency Alert',
      message: body || '',
      severity: data?.severity || 'critical',
      sent_at: data?.sent_at || new Date().toISOString(),
    };
    onNotificationOpen?.(alert);
  });

  // Handle case where app was opened from a killed-state notification tap
  const lastResponse = Notifications.getLastNotificationResponse();
  if (lastResponse) {
    console.log('[Notifications] App opened from killed state via notification');
    const { title, body, data } = lastResponse.notification.request.content;
    const alert = {
      id: lastResponse.notification.request.identifier,
      title: title || 'Emergency Alert',
      message: body || '',
      severity: data?.severity || 'critical',
      sent_at: data?.sent_at || new Date().toISOString(),
    };
    onNotificationOpen?.(alert);
  }

  return () => subscription.remove();
};

/**
 * Listen to push token refresh events and update Supabase
 * @returns {Function} Unsubscribe function
 */
export const setupTokenRefreshHandler = () => {
  const subscription = Notifications.addPushTokenListener(async (newTokenData) => {
    const newToken = newTokenData.data;
    console.log('[Notifications] Token refreshed:', newToken.substring(0, 30) + '...');

    if (currentToken && currentToken !== newToken) {
      await supabase.from('user_fcm_tokens').delete().eq('token', currentToken);
    }
    currentToken = newToken;
    await registerExpoPushToken();
  });
  return () => subscription.remove();
};

// No-op kept for backwards compat (expo-notifications handles background natively)
export const registerBackgroundMessageHandler = () => {};

/**
 * Initialize all notification setup
 * @param {Object} handlers - { onForegroundMessage, onNotificationOpen }
 * @returns {Function} Cleanup function
 */
export const initializeNotifications = async (handlers) => {
  try {
    const { onForegroundMessage, onNotificationOpen } = handlers;

    // Android: create channel first (required before requesting permissions on Android 13+)
    await createNotificationChannel();

    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      console.warn('[Notifications] Permission denied, skipping token registration');
      return () => {};
    }

    await registerExpoPushToken();

    const unsubForeground = setupForegroundHandler(onForegroundMessage);
    const unsubBackground = setupBackgroundHandler(onNotificationOpen);
    const unsubRefresh = setupTokenRefreshHandler();

    console.log('[Notifications] Fully initialized with expo-notifications');

    return () => {
      unsubForeground();
      unsubBackground();
      unsubRefresh();
    };
  } catch (error) {
    console.error('[Notifications] Error initializing:', error);
    return () => {};
  }
};

export default {
  createNotificationChannel,
  requestNotificationPermission,
  registerExpoPushToken,
  registerFCMToken,
  unregisterFCMToken,
  setupForegroundHandler,
  setupBackgroundHandler,
  registerBackgroundMessageHandler,
  setupTokenRefreshHandler,
  initializeNotifications,
};

