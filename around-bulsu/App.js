// App.js
import "./global.css";
import React, { useState, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItem } from '@react-navigation/drawer';
import { NavigationContainer, getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { Text, View, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Icon } from './src/components/ui';

// Initialize Mapbox at app startup
import { initializeMapbox } from './src/config/mapbox';
initializeMapbox();

// Import screens
import SplashScreen from './src/screens/SplashScreen';
import NavigateScreen from './src/screens/NavigateScreen';
import BuildingInfoScreen from './src/screens/BuildingInfoScreen';
import ARNavigationScreen from './src/screens/ARNavigationScreen';
import EmergencyScreen from './src/screens/EmergencyScreen';
import InfoScreen from './src/screens/InfoScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();
const Drawer = createDrawerNavigator();

// Helper function to determine if tab bar should be hidden
const getTabBarStyle = (route) => {
  const routeName = getFocusedRouteNameFromRoute(route) ?? '';
  // Hide tab bar when in AR Navigation screen
  if (routeName === 'ARNavigation') {
    return { display: 'none' };
  }
  return styles.tabBar;
};

// Settings Screen (NativeWind)
const SettingsScreen = () => (
  <View className="flex-1 bg-gray-50">
    <View className="bg-maroon-800 pt-12 pb-5 px-5">
      <Text className="text-3xl font-bold text-white">Settings</Text>
    </View>
    <View className="p-5">
      <View className="flex-row justify-between items-center py-4 border-b border-gray-200">
        <Text className="text-base text-gray-700">App Version</Text>
        <Text className="text-base text-gray-500">1.0.0</Text>
      </View>
      <View className="flex-row justify-between items-center py-4 border-b border-gray-200">
        <Text className="text-base text-gray-700">Notifications</Text>
        <Text className="text-base text-gray-500">Enabled</Text>
      </View>
      <View className="mt-6">
        <Text className="text-sm font-semibold text-maroon-800 mb-2 uppercase tracking-wider">
          About
        </Text>
        <Text className="text-sm text-gray-500 leading-6">
          ARound BulSU is a campus navigation app for Bulacan State University Main Campus. 
          Use augmented reality to find your way around campus buildings and facilities.
        </Text>
      </View>
      <View className="mt-6">
        <Text className="text-sm font-semibold text-maroon-800 mb-2 uppercase tracking-wider">
          Credits
        </Text>
        <Text className="text-sm text-gray-500 leading-6">
          Developed for BSU students and visitors.
        </Text>
      </View>
    </View>
  </View>
);

// Notifications Screen (NativeWind)
const NotificationsScreen = () => (
  <View className="flex-1 bg-gray-50">
    <View className="bg-maroon-800 pt-12 pb-5 px-5">
      <Text className="text-3xl font-bold text-white">Notifications</Text>
    </View>
    <View className="flex-1 items-center justify-center p-10">
      <View className="w-20 h-20 rounded-full bg-gray-100 items-center justify-center mb-4">
        <Icon name="bell" size={36} color="#9CA3AF" />
      </View>
      <Text className="text-lg font-semibold text-gray-700 mb-2">
        No notifications yet
      </Text>
      <Text className="text-sm text-gray-400 text-center leading-6">
        You'll receive alerts about emergencies and important campus updates here.
      </Text>
    </View>
  </View>
);

// Custom Drawer Content (NativeWind)
const CustomDrawerContent = (props) => (
  <DrawerContentScrollView {...props} className="flex-1">
    <View className="bg-maroon-800 px-8 pt-12 pb-8 items-center">
      <View className="w-16 h-16 rounded-2xl bg-white/20 items-center justify-center mb-3">
        <Icon name="compass" size={32} color="#FFFFFF" />
      </View>
      <Text className="text-xl font-bold text-white">ARound BulSU</Text>
      <Text className="text-sm text-white/80 mt-1">Campus Navigation</Text>
    </View>
    <View className="pt-3">
      <DrawerItem
        label="Notifications"
        icon={() => <Icon name="bell" size={22} color="#374151" />}
        onPress={() => props.navigation.navigate('Notifications')}
        labelStyle={styles.drawerLabel}
      />
      <DrawerItem
        label="Settings"
        icon={() => <Icon name="settings" size={22} color="#374151" />}
        onPress={() => props.navigation.navigate('Settings')}
        labelStyle={styles.drawerLabel}
      />
    </View>
  </DrawerContentScrollView>
);

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

// Main Tab Navigator
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.5)',
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      <Tab.Screen 
        name="Navigate" 
        component={NavigateStack}
        options={({ route }) => ({
          tabBarLabel: 'Navigate',
          tabBarStyle: getTabBarStyle(route),
          tabBarIcon: ({ focused }) => (
            <Icon name="compass" size={24} color={focused ? '#FFFFFF' : 'rgba(255,255,255,0.5)'} />
          ),
        })}
      />
      <Tab.Screen 
        name="Emergency" 
        component={EmergencyStack}
        options={({ route }) => ({
          tabBarLabel: 'Emergency',
          tabBarStyle: getTabBarStyle(route),
          tabBarIcon: ({ focused }) => (
            <Icon name="alert" size={24} color={focused ? '#FFFFFF' : 'rgba(255,255,255,0.5)'} />
          ),
        })}
      />
      <Tab.Screen 
        name="Info" 
        component={InfoScreen}
        options={{
          tabBarLabel: 'Info',
          tabBarIcon: ({ focused }) => (
            <Icon name="info" size={24} color={focused ? '#FFFFFF' : 'rgba(255,255,255,0.5)'} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// Main App Component
export default function App() {
  const [isReady, setIsReady] = useState(false);

  // Show splash screen until ready
  if (!isReady) {
    return <SplashScreen onReady={() => setIsReady(true)} />;
  }

  // Main app with drawer navigation wrapping tabs
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Drawer.Navigator
          drawerContent={(props) => <CustomDrawerContent {...props} />}
          screenOptions={{
            headerShown: false,
            drawerStyle: {
              backgroundColor: '#fff',
              width: 280,
            },
          }}
        >
          <Drawer.Screen name="Main" component={MainTabs} />
          <Drawer.Screen name="Notifications" component={NotificationsScreen} />
          <Drawer.Screen name="Settings" component={SettingsScreen} />
        </Drawer.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

// Keep StyleSheet for tab navigator (complex styles not fully supported by NativeWind)
const styles = StyleSheet.create({
  tabBar: { 
    backgroundColor: '#800000',
    borderTopWidth: 0,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    height: 70,
    paddingBottom: 8,
    paddingTop: 8,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 20,
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  drawerLabel: {
    fontSize: 16,
    color: '#333',
  },
});
