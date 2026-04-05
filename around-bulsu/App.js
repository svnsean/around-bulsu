// App.js
import "./global.css";
import React, { useState, useEffect, useRef } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItem } from '@react-navigation/drawer';
import { NavigationContainer, getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { Text, View, StyleSheet, Image, Switch, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Feather, MaterialCommunityIcons, Ionicons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Icon } from './src/components/ui';
import { NetworkProvider } from './src/context/NetworkContext';
import { ToastProvider } from './src/components/ui/Toast';
import { AlertProvider, useAlert } from './src/context/AlertContext';
import { SettingsProvider, useSettings, useThemeColors, MAP_STYLES } from './src/context/SettingsContext';
import EmergencyAlertModal from './src/components/EmergencyAlertModal';
import SpotifyTabBar from './src/components/SpotifyTabBar';
import { supabase, subscribeToTable } from './src/supabase';
import * as Notifications from 'expo-notifications';

// Initialize Mapbox at app startup
import { initializeMapbox } from './src/config/mapbox';
initializeMapbox();

// Configure how notifications are presented when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Import screens
import SplashScreen from './src/screens/SplashScreen';
import NavigateScreen from './src/screens/NavigateScreen';
import BuildingInfoScreen from './src/screens/BuildingInfoScreen';
import ARNavigationScreen from './src/screens/ARNavigationScreen';
import EmergencyScreen from './src/screens/EmergencyScreen';
import InfoScreen from './src/screens/InfoScreen';
import SearchScreen from './src/screens/SearchScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();
const Drawer = createDrawerNavigator();

// Apply Inter as global default font for all Text components
Text.defaultProps = Text.defaultProps ?? {};
Text.defaultProps.style = { fontFamily: 'Inter_400Regular' };



// Settings Screen
const SettingsScreen = () => {
  const insets = useSafeAreaInsets();
  const { settings, updateSettings, isDark, colors, triggerHaptic } = useSettings();

  const handleClearRecents = () => {
    Alert.alert('Clear Recent Searches', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem('@around_bulsu/recent_searches');
          triggerHaptic('success');
        },
      },
    ]);
  };

  const handleClearFavorites = () => {
    Alert.alert('Clear Favorites', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem('@around_bulsu/favorites');
          triggerHaptic('success');
        },
      },
    ]);
  };

  const SectionHeader = ({ title }) => (
    <Text style={{ fontSize: 13, fontWeight: '600', fontFamily: 'Inter_600SemiBold', color: colors.textPrimary, marginBottom: 8, marginTop: 24, textTransform: 'uppercase', letterSpacing: 1 }}>{title}</Text>
  );

  const RowSwitch = ({ label, value, onValueChange }) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <Text style={{ fontSize: 16, color: colors.textPrimary, fontFamily: 'Inter_400Regular' }}>{label}</Text>
      <Switch
        value={value}
        onValueChange={(v) => { triggerHaptic('selection'); onValueChange(v); }}
        trackColor={{ false: '#D1D5DB', true: '#B22222' }}
        thumbColor="#FFFFFF"
      />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingTop: insets.top + 12, paddingBottom: 16, paddingHorizontal: 20, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Text style={{ fontSize: 32, fontWeight: '700', fontFamily: 'Inter_700Bold', color: colors.textPrimary }}>Settings</Text>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Appearance */}
        <SectionHeader title="Appearance" />
        <RowSwitch
          label="Dark Mode"
          value={isDark}
          onValueChange={(v) => updateSettings({ theme: v ? 'dark' : 'light' })}
        />

        {/* Map Theme */}
        <SectionHeader title="Map Theme" />
        {MAP_STYLES.map((s) => (
          <TouchableOpacity
            key={s.key}
            onPress={() => { triggerHaptic('selection'); updateSettings({ mapStyleKey: s.key }); }}
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}
          >
            <Text style={{ fontSize: 16, color: colors.textPrimary, fontFamily: 'Inter_400Regular' }}>{s.label}</Text>
            {settings.mapStyleKey === s.key && <Icon name="check" size={20} color={colors.textPrimary} />}
          </TouchableOpacity>
        ))}

        {/* Feedback */}
        <SectionHeader title="Feedback" />
        <RowSwitch
          label="Haptics"
          value={settings.hapticsEnabled}
          onValueChange={(v) => updateSettings({ hapticsEnabled: v })}
        />

        {/* Data */}
        <SectionHeader title="Data" />
        <TouchableOpacity onPress={handleClearRecents} style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text style={{ fontSize: 16, color: '#DC2626', fontFamily: 'Inter_400Regular' }}>Clear Recent Searches</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleClearFavorites} style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text style={{ fontSize: 16, color: '#DC2626', fontFamily: 'Inter_400Regular' }}>Clear Favorites</Text>
        </TouchableOpacity>

        {/* About */}
        <SectionHeader title="About" />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text style={{ fontSize: 16, color: colors.textPrimary, fontFamily: 'Inter_400Regular' }}>App Version</Text>
          <Text style={{ fontSize: 16, color: colors.textSecondary, fontFamily: 'Inter_400Regular' }}>1.0.0</Text>
        </View>
        <View style={{ paddingVertical: 14 }}>
          <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 22, fontFamily: 'Inter_400Regular' }}>
            ARound BulSU is a campus navigation app for Bulacan State University Main Campus.
            Use augmented reality to find your way around campus buildings and facilities.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

// Notifications Screen
const NotificationsScreen = () => {
  const insets = useSafeAreaInsets();
  const { colors } = useSettings();
  const [notifications, setNotifications] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchNotifications = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      setNotifications(data || []);
      setLoading(false);
    };
    fetchNotifications();
    const unsub = subscribeToTable('notifications', '*', () => fetchNotifications());
    return () => unsub?.();
  }, []);

  const formatTime = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingTop: insets.top + 12, paddingBottom: 16, paddingHorizontal: 20, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Text style={{ fontSize: 32, fontWeight: '700', fontFamily: 'Inter_700Bold', color: colors.textPrimary }}>Notifications</Text>
      </View>
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.textMuted, fontFamily: 'Inter_400Regular' }}>Loading...</Text>
        </View>
      ) : notifications.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.surfaceSecondary, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Icon name="bell" size={36} color={colors.textMuted} />
          </View>
          <Text style={{ fontSize: 18, fontWeight: '600', fontFamily: 'Inter_600SemiBold', color: colors.textSecondary, marginBottom: 8 }}>
            No notifications yet
          </Text>
          <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 22, fontFamily: 'Inter_400Regular' }}>
            You'll receive alerts about emergencies and important campus updates here.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingVertical: 8 }}>
          {notifications.map((notif) => (
            <View key={notif.id} style={{ marginHorizontal: 16, marginVertical: 6, backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderLeftWidth: 4, borderLeftColor: notif.type === 'emergency' ? '#FF3B30' : colors.primary }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', fontFamily: 'Inter_600SemiBold', color: colors.textPrimary, flex: 1, marginRight: 8 }}>{notif.title}</Text>
                <Text style={{ fontSize: 12, color: colors.textMuted, fontFamily: 'Inter_400Regular' }}>{formatTime(notif.created_at)}</Text>
              </View>
              {notif.body ? (
                <Text style={{ fontSize: 14, color: colors.textSecondary, fontFamily: 'Inter_400Regular', lineHeight: 20 }}>{notif.body}</Text>
              ) : null}
              <View style={{ marginTop: 6, alignSelf: 'flex-start', backgroundColor: notif.type === 'emergency' ? '#FF3B3020' : colors.surfaceSecondary, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_500Medium', color: notif.type === 'emergency' ? '#FF3B30' : colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{notif.type || 'alert'}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

// Custom Drawer Content
const DrawerSplashIcon = require('./assets/images/splash-icon.png');
const CustomDrawerContent = (props) => {
  const { colors } = useSettings();
  return (
  <DrawerContentScrollView {...props} style={{ backgroundColor: colors.surface }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 40, paddingBottom: 24 }}>
      <Image source={DrawerSplashIcon} style={{ width: 48, height: 48, marginRight: 12, borderRadius: 12, overflow: 'hidden' }} resizeMode="cover" />
      <Text style={{ fontSize: 20, fontWeight: '700', color: '#B22222', fontFamily: 'Inter_700Bold' }}>ARound BulSU</Text>
    </View>
    <View style={{ paddingTop: 12 }}>
      <DrawerItem
        label="Notifications"
        icon={() => <Icon name="bell" size={22} color={colors.icon} />}
        onPress={() => props.navigation.navigate('Notifications')}
        labelStyle={[styles.drawerLabel, { color: colors.textPrimary }]}
      />
      <DrawerItem
        label="Settings"
        icon={() => <Icon name="settings" size={22} color={colors.icon} />}
        onPress={() => props.navigation.navigate('Settings')}
        labelStyle={[styles.drawerLabel, { color: colors.textPrimary }]}
      />
    </View>
  </DrawerContentScrollView>
  );
};

// StatusBar wrapper that reads theme
const StatusBarWrapper = () => {
  const { isDark } = useSettings();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
};

// Navigate Stack (includes Navigate, BuildingInfo, ARNavigation)
function NavigateStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="NavigateMain" component={NavigateScreen} />
      <Stack.Screen name="BuildingInfo" component={BuildingInfoScreen} />
      <Stack.Screen name="ARNavigation" component={ARNavigationScreen} />
    </Stack.Navigator>
  );
}

// Emergency Stack (to allow AR navigation from Emergency tab)
function EmergencyStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="EmergencyMain" component={EmergencyScreen} />
      <Stack.Screen name="ARNavigation" component={ARNavigationScreen} />
    </Stack.Navigator>
  );
}

// Info Stack (to allow BuildingInfo navigation from Info tab)
function InfoStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="InfoMain" component={InfoScreen} />
      <Stack.Screen name="BuildingInfo" component={BuildingInfoScreen} />
    </Stack.Navigator>
  );
}

// Search Stack
function SearchStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SearchMain" component={SearchScreen} />
      <Stack.Screen name="BuildingInfo" component={BuildingInfoScreen} />
      <Stack.Screen name="ARNavigation" component={ARNavigationScreen} />
    </Stack.Navigator>
  );
}

// Main Tab Navigator
function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <SpotifyTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Navigate" component={NavigateStack} />
      <Tab.Screen name="Emergency" component={EmergencyStack} />
      <Tab.Screen name="Info" component={InfoStack} />
      <Tab.Screen name="Search" component={SearchStack} />
    </Tab.Navigator>
  );
}

const EmergencyAlertHost = ({ navigationRef, pushAlert, clearPushAlert }) => {
  const { activeAlert, dismissAlert } = useAlert();
  const visibleAlert = activeAlert || pushAlert;

  const clearCurrentAlert = () => {
    if (activeAlert) {
      dismissAlert();
    }
    if (pushAlert) {
      clearPushAlert();
    }
  };

  const handleEvacuate = () => {
    clearCurrentAlert();

    if (navigationRef.current) {
      navigationRef.current.navigate('Emergency', {
        screen: 'EmergencyMain',
        params: { triggerEvacuation: true },
      });
    }
  };

  return (
    <EmergencyAlertModal
      visible={Boolean(visibleAlert)}
      alert={visibleAlert}
      onDismiss={clearCurrentAlert}
      onEvacuate={handleEvacuate}
    />
  );
};

// Main App Component
export default function App() {
  const [fontsLoaded] = useFonts({
    ...Feather.font,
    ...MaterialCommunityIcons.font,
    ...Ionicons.font,
    ...FontAwesome5.font,
    ...MaterialIcons.font,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [isReady, setIsReady] = useState(false);
  const [criticalAlert, setCriticalAlert] = useState(null);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const navigationRef = useRef(null);

  // Emergency data for evacuation
  const [evacuationData, setEvacuationData] = useState({
    nodes: [],
    edges: [],
    blockages: [],
    evacuationZones: [],
  });

  // Load evacuation data from Supabase
  useEffect(() => {
    const unsubNodes = subscribeToTable('nodes', (data) => {
      setEvacuationData(prev => ({ ...prev, nodes: data }));
    });
    const unsubEdges = subscribeToTable('edges', (data) => {
      setEvacuationData(prev => ({ ...prev, edges: data }));
    });
    const unsubBlockages = subscribeToTable('blockages', (data) => {
      setEvacuationData(prev => ({ ...prev, blockages: data }));
    });
    const unsubZones = subscribeToTable('evacuation_zones', (data) => {
      setEvacuationData(prev => ({ ...prev, evacuationZones: data }));
    });

    return () => {
      unsubNodes();
      unsubEdges();
      unsubBlockages();
      unsubZones();
    };
  }, []);

  // Initialize push notifications (delayed to prevent blocking app load)
  useEffect(() => {
    let cleanup = () => {};
    let isMounted = true;

    const timeoutId = setTimeout(async () => {
      if (!isMounted) return;
      
      try {
        const { initializeNotifications } = await import('./src/services/notificationService');
        
        if (!isMounted) return;
        
        cleanup = await initializeNotifications({
          onForegroundMessage: (alert) => {
            console.log('[App] Foreground notification received:', alert);
            setCriticalAlert(alert);
            setShowAlertModal(true);
          },
          onNotificationOpen: (alert) => {
            console.log('[App] Notification tapped, opening alert:', alert);
            setCriticalAlert(alert);
            setShowAlertModal(true);
          },
        }) || (() => {});
      } catch (error) {
        console.log('[App] Push notification setup skipped:', error.message);
      }
    }, 3000);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      cleanup();
    };
  }, []);

  const handleDismissAlert = () => {
    setShowAlertModal(false);
    setCriticalAlert(null);
  };

  // Show splash screen until ready AND fonts loaded
  if (!isReady || !fontsLoaded) {
    return <SplashScreen onReady={() => setIsReady(true)} />;
  }

  // Main app with drawer navigation wrapping tabs
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <NetworkProvider>
          <ToastProvider>
            <AlertProvider>
              <StatusBarWrapper />
              <NavigationContainer ref={navigationRef}>
                <Drawer.Navigator
                  drawerContent={(props) => <CustomDrawerContent {...props} />}
                  screenOptions={{
                    headerShown: false,
                    drawerPosition: 'right',
                    drawerStyle: {
                      width: 280,
                    },
                  }}
                >
                <Drawer.Screen name="Main" component={MainTabs} />
                <Drawer.Screen name="Notifications" component={NotificationsScreen} />
                <Drawer.Screen name="Settings" component={SettingsScreen} />
              </Drawer.Navigator>
            </NavigationContainer>
              <EmergencyAlertHost
                navigationRef={navigationRef}
                pushAlert={showAlertModal ? criticalAlert : null}
                clearPushAlert={handleDismissAlert}
              />
          </AlertProvider>
        </ToastProvider>
      </NetworkProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  drawerLabel: {
    fontSize: 16,
    color: '#333',
    fontFamily: 'Inter_400Regular',
  },
});
