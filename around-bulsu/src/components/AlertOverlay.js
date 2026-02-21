// src/components/AlertOverlay.js - Emergency Alert Overlay (Simple layout)
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { useAlert } from '../context/AlertContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Alert type configurations — icon, color, label
const ALERT_CONFIGS = {
  emergency: { icon: 'alert-octagon', color: '#DC2626', label: 'General Emergency' },
  fire:      { icon: 'fire',          color: '#EA580C', label: 'Fire Alert' },
  earthquake:{ icon: 'earth',         color: '#D97706', label: 'Earthquake' },
  flood:     { icon: 'waves',         color: '#2563EB', label: 'Flood Alert' },
  typhoon:   { icon: 'weather-hurricane', color: '#7C3AED', label: 'Typhoon' },
  drill:     { icon: 'bullhorn',      color: '#EA580C', label: 'Drill' },
};

export default function AlertOverlay({ navigationRef }) {
  const { activeAlert, dismissAlert } = useAlert();

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const iconPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (activeAlert) {
      // Animate in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 50,
          useNativeDriver: true,
        }),
      ]).start();

      // Subtle icon pulse
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(iconPulse, { toValue: 1.1, duration: 600, useNativeDriver: true }),
          Animated.timing(iconPulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 0.9, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [activeAlert]);

  if (!activeAlert) return null;

  const alertType = activeAlert.alert_type || 'emergency';
  const config = ALERT_CONFIGS[alertType] || ALERT_CONFIGS.emergency;

  // Format time
  const alertDate = new Date(activeAlert.created_at);
  const formattedTime = alertDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const handleAcknowledge = () => {
    dismissAlert();
  };

  const handleEvacuate = () => {
    dismissAlert();
    if (navigationRef?.current) {
      navigationRef.current.navigate('Emergency', {
        screen: 'EmergencyMain',
        params: { triggerEvacuation: true },
      });
    }
  };

  return (
    <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
      <Animated.View style={[styles.cardWrapper, { transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.card}>

          {/* Header */}
          <View style={styles.header}>
            <Animated.View style={{ transform: [{ scale: iconPulse }] }}>
              <MaterialCommunityIcons name="alert-circle" size={28} color="#FFFFFF" />
            </Animated.View>
            <Text style={styles.headerText}>EMERGENCY ALERT</Text>
            <Animated.View style={{ transform: [{ scale: iconPulse }] }}>
              <MaterialCommunityIcons name="alert-circle" size={28} color="#FFFFFF" />
            </Animated.View>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Alert type badge */}
          <View style={styles.body}>
            <View style={[styles.typeBadge, { backgroundColor: config.color }]}>  
              <MaterialCommunityIcons name={config.icon} size={16} color="#FFFFFF" />
              <Text style={styles.typeBadgeText}>{config.label.toUpperCase()}</Text>
            </View>

            {/* Title */}
            <Text style={styles.title}>{activeAlert.title}</Text>

            {/* Message */}
            {activeAlert.message ? (
              <Text style={styles.message}>{activeAlert.message}</Text>
            ) : null}

            {/* Timestamp + source */}
            <View style={styles.metaRow}>
              <MaterialCommunityIcons name="clock-outline" size={14} color="rgba(255,255,255,0.5)" />
              <Text style={styles.metaText}>
                {formattedTime}  ·  BulSU Emergency Management
              </Text>
            </View>

            {/* Buttons */}
            <TouchableOpacity
              style={styles.acknowledgeButton}
              onPress={handleAcknowledge}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="volume-off" size={20} color="#FFFFFF" />
              <Text style={styles.acknowledgeButtonText}>ACKNOWLEDGE & STOP ALARM</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.evacuateButton}
              onPress={handleEvacuate}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="exit-run" size={20} color="#000000" />
              <Text style={styles.evacuateButtonText}>ACTIVATE EVACUATION MODE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  cardWrapper: {
    width: SCREEN_WIDTH * 0.9,
    maxWidth: 400,
  },
  card: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.4)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
    gap: 10,
  },
  headerText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 20,
  },
  body: {
    padding: 24,
    alignItems: 'center',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 20,
    gap: 6,
  },
  typeBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  acknowledgeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    backgroundColor: 'transparent',
    marginBottom: 10,
    gap: 8,
  },
  acknowledgeButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  evacuateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#FFD700',
    gap: 8,
  },
  evacuateButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: 0.5,
  },
});
