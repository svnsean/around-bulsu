// src/context/AlertContext.js - Global emergency alert context with FORCED vibration
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Vibration, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { supabase } from '../supabase';

const AlertContext = createContext({
  activeAlert: null,
  dismissAlert: () => {},
});

export const useAlert = () => useContext(AlertContext);

export const AlertProvider = ({ children }) => {
  const [activeAlert, setActiveAlert] = useState(null);
  const [dismissedAlertIds, setDismissedAlertIds] = useState([]);
  const vibrationRef = useRef(null);

  // ============================================
  // AGGRESSIVE FORCED VIBRATION - VERY IMPORTANT
  // ============================================
  const startForcedVibration = useCallback(() => {
    console.log('[AlertContext] STARTING FORCED VIBRATION');
    
    // Clear any existing vibration first
    if (vibrationRef.current) {
      clearInterval(vibrationRef.current);
      vibrationRef.current = null;
    }
    Vibration.cancel();

    // Immediate strong vibration burst
    if (Platform.OS === 'android') {
      // Android: Pattern = [wait, vibrate, wait, vibrate, ...]
      // This is a strong emergency pattern - long vibrations!
      const emergencyPattern = [
        0,     // Start immediately
        1000,  // Vibrate 1 second
        200,   // Pause 200ms  
        1000,  // Vibrate 1 second
        200,   // Pause 200ms
        1500,  // Vibrate 1.5 seconds
        500,   // Pause 500ms
        1000,  // Vibrate 1 second
        200,   // Pause 200ms
        1000,  // Vibrate 1 second
      ];
      
      // true = REPEAT the pattern
      Vibration.vibrate(emergencyPattern, true);
      console.log('[AlertContext] Android vibration started with pattern, repeat=true');
    } else {
      // iOS - use haptics
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    // Keep re-triggering vibration every 1 second to ensure it doesn't stop
    vibrationRef.current = setInterval(() => {
      console.log('[AlertContext] Re-triggering vibration...');
      
      if (Platform.OS === 'android') {
        // Re-trigger the vibration pattern
        Vibration.vibrate([0, 800, 200, 800, 200, 1200], true);
      } else {
        // iOS haptics burst
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 200);
        setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error), 400);
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 600);
      }
    }, 1000); // Re-trigger every second!
  }, []);

  // Stop vibration completely
  const stopVibration = useCallback(() => {
    console.log('[AlertContext] STOPPING VIBRATION');
    
    // Cancel React Native vibration
    Vibration.cancel();
    
    // Clear our interval
    if (vibrationRef.current) {
      clearInterval(vibrationRef.current);
      vibrationRef.current = null;
    }
  }, []);

  // Dismiss the current alert (user pressed "Got it")
  const dismissAlert = useCallback(() => {
    if (activeAlert) {
      console.log('[AlertContext] Alert dismissed by user:', activeAlert.id);
      setDismissedAlertIds(prev => [...prev, activeAlert.id]);
      setActiveAlert(null);
      stopVibration();
    }
  }, [activeAlert, stopVibration]);

  // Subscribe to emergency_alerts table
  useEffect(() => {
    const fetchActiveAlert = async () => {
      try {
        console.log('[AlertContext] Checking for active alerts...');
        
        // Try RPC first, fallback to direct query
        let data, error;
        const rpcResult = await supabase.rpc('get_active_alerts');
        
        if (rpcResult.error) {
          console.log('[AlertContext] RPC unavailable, using direct query');
          const queryResult = await supabase
            .from('emergency_alerts')
            .select('*')
            .eq('active', true)
            .order('created_at', { ascending: false })
            .limit(1);
          data = queryResult.data;
          error = queryResult.error;
        } else {
          data = rpcResult.data;
          error = rpcResult.error;
        }

        if (!error && data && data.length > 0) {
          const alert = data[0];
          if (!dismissedAlertIds.includes(alert.id)) {
            console.log('[AlertContext] ACTIVE ALERT FOUND:', alert.title);
            setActiveAlert(alert);
            // START VIBRATION IMMEDIATELY
            startForcedVibration();
          }
        } else {
          console.log('[AlertContext] No active alerts found');
        }
      } catch (err) {
        console.error('[AlertContext] Error fetching alerts:', err);
      }
    };

    fetchActiveAlert();

    // Subscribe to realtime changes on emergency_alerts table
    const channel = supabase
      .channel('emergency_alerts_realtime')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'emergency_alerts'
        },
        (payload) => {
          console.log('[AlertContext] REALTIME EVENT:', payload.eventType);
          
          if (payload.eventType === 'INSERT' && payload.new.active) {
            // NEW ALERT!
            if (!dismissedAlertIds.includes(payload.new.id)) {
              console.log('[AlertContext] NEW EMERGENCY ALERT!');
              console.log('[AlertContext] Title:', payload.new.title);
              console.log('[AlertContext] Type:', payload.new.alert_type);
              
              setActiveAlert(payload.new);
              
              // START FORCED VIBRATION IMMEDIATELY!
              startForcedVibration();
            }
          } else if (payload.eventType === 'UPDATE') {
            if (payload.new.active === false) {
              // Admin stopped the alert
              console.log('[AlertContext] Alert stopped by admin');
              setActiveAlert(current => {
                if (current?.id === payload.new.id) {
                  stopVibration();
                  return null;
                }
                return current;
              });
              // Remove from dismissed so it can be sent again later
              setDismissedAlertIds(prev => prev.filter(id => id !== payload.new.id));
            } else if (payload.new.active && !dismissedAlertIds.includes(payload.new.id)) {
              // Alert became active
              setActiveAlert(payload.new);
              startForcedVibration();
            }
          } else if (payload.eventType === 'DELETE') {
            // Alert was deleted
            setActiveAlert(current => {
              if (current?.id === payload.old.id) {
                stopVibration();
                return null;
              }
              return current;
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('[AlertContext] Realtime subscription status:', status);
      });

    // Cleanup on unmount
    return () => {
      console.log('[AlertContext] Cleaning up...');
      supabase.removeChannel(channel);
      stopVibration();
    };
  }, [dismissedAlertIds, startForcedVibration, stopVibration]);

  // Safety: ensure vibration stops when alert is cleared
  useEffect(() => {
    if (!activeAlert) {
      stopVibration();
    }
  }, [activeAlert, stopVibration]);

  return (
    <AlertContext.Provider value={{ activeAlert, dismissAlert }}>
      {children}
    </AlertContext.Provider>
  );
};
