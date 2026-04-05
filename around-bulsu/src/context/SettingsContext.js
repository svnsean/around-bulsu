// src/context/SettingsContext.js
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapboxGL from '@rnmapbox/maps';
import * as Haptics from 'expo-haptics';

const SETTINGS_KEY = '@around_bulsu/settings';

// Map style options
export const MAP_STYLES = [
  { key: 'street', label: 'Street', url: MapboxGL.StyleURL.Street },
  { key: 'light', label: 'Light', url: MapboxGL.StyleURL.Light },
  { key: 'dark', label: 'Dark', url: MapboxGL.StyleURL.Dark },
  { key: 'outdoors', label: 'Outdoors', url: 'mapbox://styles/mapbox/outdoors-v12' },
  { key: 'satellite', label: 'Satellite', url: MapboxGL.StyleURL.Satellite },
  { key: 'satelliteStreets', label: 'Satellite Streets', url: MapboxGL.StyleURL.SatelliteStreet },
];

// Theme color palettes
const LIGHT_COLORS = {
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceSecondary: '#F3F4F6',
  textPrimary: '#111111',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  border: '#F3F4F6',
  tabBar: '#FFFFFF',
  maroon: '#B22222',
  gold: '#FFD700',
  card: '#FFFFFF',
  skeleton: '#F3F4F6',
  icon: '#374151',
  statusBar: 'dark',
};

const DARK_COLORS = {
  bg: '#121212',
  surface: '#1E1E1E',
  surfaceSecondary: '#2A2A2A',
  textPrimary: '#F0F0F0',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  border: '#2A2A2A',
  tabBar: '#1A1A1A',
  maroon: '#B22222',
  gold: '#FFD700',
  card: '#1E1E1E',
  skeleton: '#2A2A2A',
  icon: '#D1D5DB',
  statusBar: 'light',
};

const DEFAULT_SETTINGS = {
  theme: 'light', // 'light' | 'dark'
  mapStyleKey: 'street',
  hapticsEnabled: true,
};

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  // Load settings from AsyncStorage on mount
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SETTINGS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          setSettings({ ...DEFAULT_SETTINGS, ...parsed });
        }
      } catch (e) {
        console.warn('Failed to load settings:', e);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // Persist settings whenever they change
  const updateSettings = useCallback(async (patch) => {
    setSettings((prev) => {
      let next = { ...prev, ...patch };
      // Auto-switch map style when theme changes
      if (patch.theme && patch.theme !== prev.theme) {
        next.mapStyleKey = patch.theme === 'dark' ? 'dark' : 'street';
      }
      AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  // Derived values
  const isDark = settings.theme === 'dark';
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;
  const mapStyle =
    MAP_STYLES.find((s) => s.key === settings.mapStyleKey)?.url ??
    MapboxGL.StyleURL.Street;

  // Haptics helper — respects settings
  const triggerHaptic = useCallback(
    (type = 'light') => {
      if (!settings.hapticsEnabled) return;
      switch (type) {
        case 'light':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case 'medium':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case 'heavy':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;
        case 'success':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
        case 'warning':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          break;
        case 'error':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          break;
        case 'selection':
          Haptics.selectionAsync();
          break;
        default:
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },
    [settings.hapticsEnabled]
  );

  const value = {
    settings,
    updateSettings,
    isDark,
    colors,
    mapStyle,
    triggerHaptic,
    loaded,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}

// Shorthand hook for theme colors
export function useThemeColors() {
  const { colors } = useSettings();
  return colors;
}
