// src/components/CriticalAlertModal.js
// Full-screen critical alert for emergency notifications
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Animated,
  Vibration,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const CriticalAlertModal = ({ visible, alert, onDismiss, onEvacuate }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Start vibration pattern (long vibrations for emergency)
      const vibrationPattern = Platform.OS === 'android'
        ? [0, 500, 200, 500, 200, 500, 200, 500] // Android: [pause, vibrate, pause, vibrate, ...]
        : [500, 500, 500, 500]; // iOS: durations only

      Vibration.vibrate(vibrationPattern, true); // Repeat until cancelled

      // Fade in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Pulse animation for icon
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();

      return () => {
        pulse.stop();
        Vibration.cancel();
      };
    } else {
      fadeAnim.setValue(0);
      Vibration.cancel();
    }
  }, [visible]);

  const handleEvacuate = () => {
    Vibration.cancel();
    onEvacuate?.();
  };

  const handleDismiss = () => {
    Vibration.cancel();
    onDismiss?.();
  };

  if (!visible || !alert) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      <Animated.View
        style={{
          flex: 1,
          backgroundColor: 'rgba(139, 0, 0, 0.95)', // Dark red background
          justifyContent: 'center',
          alignItems: 'center',
          opacity: fadeAnim,
        }}
      >
        {/* Emergency Icon with Pulse */}
        <Animated.View
          style={{
            transform: [{ scale: pulseAnim }],
            marginBottom: 24,
          }}
        >
          <View
            style={{
              width: 120,
              height: 120,
              borderRadius: 60,
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Ionicons name="warning" size={70} color="#FFFFFF" />
          </View>
        </Animated.View>

        {/* EMERGENCY Badge */}
        <View
          style={{
            backgroundColor: '#FFFFFF',
            paddingHorizontal: 24,
            paddingVertical: 8,
            borderRadius: 20,
            marginBottom: 16,
          }}
        >
          <Text
            style={{
              color: '#8B0000',
              fontSize: 14,
              fontWeight: '800',
              letterSpacing: 3,
            }}
          >
            EMERGENCY ALERT
          </Text>
        </View>

        {/* Alert Title */}
        <Text
          style={{
            color: '#FFFFFF',
            fontSize: 28,
            fontWeight: 'bold',
            textAlign: 'center',
            marginHorizontal: 32,
            marginBottom: 16,
          }}
        >
          {alert.title || 'Emergency Alert'}
        </Text>

        {/* Alert Message */}
        <Text
          style={{
            color: 'rgba(255, 255, 255, 0.9)',
            fontSize: 16,
            textAlign: 'center',
            marginHorizontal: 40,
            lineHeight: 24,
            marginBottom: 48,
          }}
        >
          {alert.message || 'An emergency has been declared. Please follow evacuation procedures.'}
        </Text>

        {/* Action Buttons */}
        <View style={{ width: '100%', paddingHorizontal: 32, gap: 16 }}>
          {/* Primary Action - Go to Evacuation */}
          <TouchableOpacity
            onPress={handleEvacuate}
            style={{
              backgroundColor: '#FFFFFF',
              paddingVertical: 18,
              borderRadius: 16,
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
            }}
          >
            <Ionicons name="navigate" size={24} color="#8B0000" style={{ marginRight: 10 }} />
            <Text
              style={{
                color: '#8B0000',
                fontSize: 18,
                fontWeight: 'bold',
              }}
            >
              Go to Evacuation
            </Text>
          </TouchableOpacity>

          {/* Secondary Action - Dismiss */}
          <TouchableOpacity
            onPress={handleDismiss}
            style={{
              backgroundColor: 'transparent',
              paddingVertical: 14,
              borderRadius: 16,
              borderWidth: 2,
              borderColor: 'rgba(255, 255, 255, 0.5)',
            }}
          >
            <Text
              style={{
                color: 'rgba(255, 255, 255, 0.8)',
                fontSize: 16,
                fontWeight: '600',
                textAlign: 'center',
              }}
            >
              Dismiss
            </Text>
          </TouchableOpacity>
        </View>

        {/* Timestamp */}
        <Text
          style={{
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: 12,
            marginTop: 32,
          }}
        >
          {alert.sent_at
            ? `Sent: ${new Date(alert.sent_at).toLocaleString()}`
            : `Received: ${new Date().toLocaleTimeString()}`}
        </Text>
      </Animated.View>
    </Modal>
  );
};

export default CriticalAlertModal;
