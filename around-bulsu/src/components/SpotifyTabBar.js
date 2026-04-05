// src/components/SpotifyTabBar.js
// Spotify-style bottom tab bar: white, flat, maroon active tint, black inactive
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../context/SettingsContext';

const TAB_CONFIG = {
  Navigate: {
    icon: 'compass-outline',
    activeIcon: 'compass',
    label: 'Navigate',
  },
  Emergency: {
    icon: 'warning-outline',
    activeIcon: 'warning',
    label: 'Emergency',
  },
  Info: {
    icon: 'information-circle-outline',
    activeIcon: 'information-circle',
    label: 'Info',
  },
  Search: {
    icon: 'search-outline',
    activeIcon: 'search',
    label: 'Search',
  },
};

const SpotifyTabBar = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useSettings();

  const ACTIVE_COLOR_THEMED = '#B22222';
  const INACTIVE_COLOR_THEMED = colors.textPrimary;

  // Hide tab bar when on ARNavigation screen
  const activeRoute = state.routes[state.index];
  const focusedRouteName = getFocusedRouteNameFromRoute(activeRoute);
  if (focusedRouteName === 'ARNavigation') return null;

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8), backgroundColor: colors.tabBar }]}>
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const config = TAB_CONFIG[route.name] || {
          icon: 'ellipse-outline',
          activeIcon: 'ellipse',
          label: route.name,
        };
        const iconColor = isFocused ? ACTIVE_COLOR_THEMED : INACTIVE_COLOR_THEMED;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate({ name: route.name, merge: true });
          }
        };

        const onLongPress = () => {
          navigation.emit({ type: 'tabLongPress', target: route.key });
        };

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={config.label}
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.tab}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isFocused ? config.activeIcon : config.icon}
              size={28}
              color={iconColor}
            />
            <Text
              style={[
                styles.label,
                {
                  color: iconColor,
                  fontWeight: isFocused ? '600' : '400',
                  fontFamily: isFocused ? 'Inter_600SemiBold' : 'Inter_400Regular',
                },
              ]}
            >
              {config.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0,
    elevation: 0,
    shadowOpacity: 0,
    paddingTop: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  label: {
    fontSize: 12,
    marginTop: 3,
  },
});

export default SpotifyTabBar;
