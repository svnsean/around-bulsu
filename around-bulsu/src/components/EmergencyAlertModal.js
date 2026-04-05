import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Animated,
  StyleSheet,
  Linking,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSettings } from '../context/SettingsContext';
import { supabase } from '../supabase';

const ALERT_TYPE_CONFIGS = {
  emergency: { icon: 'alert-octagon', label: 'Emergency' },
  fire: { icon: 'fire', label: 'Fire Alert' },
  earthquake: { icon: 'earth', label: 'Earthquake' },
  flood: { icon: 'waves', label: 'Flood Alert' },
  typhoon: { icon: 'weather-hurricane', label: 'Typhoon' },
  drill: { icon: 'bullhorn', label: 'Drill' },
  critical: { icon: 'alert', label: 'Critical Alert' },
};

const getAlertType = (alert) => {
  const rawType = alert?.alert_type || alert?.type || alert?.severity || 'emergency';
  return String(rawType).toLowerCase();
};

const formatTimestamp = (alert) => {
  const value = alert?.created_at || alert?.sent_at;
  if (!value) {
    return 'Just now';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Just now';
  }

  return date.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const EmergencyAlertModal = ({
  visible,
  alert,
  onDismiss,
  onEvacuate,
}) => {
  const { colors, triggerHaptic } = useSettings();
  const [primaryContact, setPrimaryContact] = useState(null);
  const [loadingContact, setLoadingContact] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.96)).current;

  const alertType = getAlertType(alert);
  const typeConfig = useMemo(
    () => ALERT_TYPE_CONFIGS[alertType] || ALERT_TYPE_CONFIGS.emergency,
    [alertType]
  );

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 70,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.96);
    }
  }, [visible, fadeAnim, scaleAnim]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    let active = true;
    const loadPrimaryContact = async () => {
      setLoadingContact(true);
      const { data } = await supabase
        .from('emergency_contacts')
        .select('id, name, phone, category, order')
        .order('order', { ascending: true })
        .limit(1);

      if (!active) {
        return;
      }

      setPrimaryContact(data?.[0] || null);
      setLoadingContact(false);
    };

    loadPrimaryContact();

    return () => {
      active = false;
    };
  }, [visible]);

  const handleCallContact = async () => {
    if (!primaryContact?.phone) {
      return;
    }

    triggerHaptic('selection');
    await Linking.openURL(`tel:${primaryContact.phone}`);
  };

  if (!visible || !alert) {
    return null;
  }

  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="none">
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.maroon,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={styles.headerRow}>
            <View style={[styles.iconWrap, { backgroundColor: colors.surfaceSecondary }]}> 
              <MaterialCommunityIcons name={typeConfig.icon} size={22} color={colors.maroon} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.kicker, { color: colors.maroon }]}>Emergency Alert</Text>
              <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>
                {alert.title || 'Campus Emergency Notice'}
              </Text>
            </View>
            <View style={[styles.typePill, { backgroundColor: colors.surfaceSecondary }]}> 
              <Text style={[styles.typePillText, { color: colors.textSecondary }]}>{typeConfig.label}</Text>
            </View>
          </View>

          {!!alert.message && (
            <Text style={[styles.message, { color: colors.textSecondary }]}>{alert.message}</Text>
          )}

          <View style={styles.metaRow}>
            <MaterialCommunityIcons name="clock-outline" size={14} color={colors.textMuted} />
            <Text style={[styles.metaText, { color: colors.textMuted }]}>BulSU Emergency • {formatTimestamp(alert)}</Text>
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.maroon }]}
            onPress={onEvacuate}
            activeOpacity={0.9}
          >
            <MaterialCommunityIcons name="run-fast" size={18} color={colors.surface} />
            <Text style={[styles.primaryButtonText, { color: colors.surface }]}>Evacuate now</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.border }]}
            onPress={onDismiss}
            activeOpacity={0.9}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.textPrimary }]}>Acknowledge</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.callRow}
            onPress={handleCallContact}
            disabled={!primaryContact?.phone || loadingContact}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="phone-outline"
              size={16}
              color={primaryContact?.phone ? colors.maroon : colors.textMuted}
            />
            <Text
              style={[
                styles.callText,
                { color: primaryContact?.phone ? colors.maroon : colors.textMuted },
              ]}
            >
              {primaryContact?.phone
                ? `Call contact${primaryContact?.name ? ` (${primaryContact.name})` : ''}`
                : loadingContact
                  ? 'Loading contact...'
                  : 'No contact available'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
    fontFamily: 'Inter_700Bold',
  },
  typePill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  typePillText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: 'Inter_400Regular',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  primaryButton: {
    borderRadius: 12,
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  secondaryButton: {
    borderRadius: 12,
    minHeight: 44,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
  },
  callRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 28,
  },
  callText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
});

export default EmergencyAlertModal;