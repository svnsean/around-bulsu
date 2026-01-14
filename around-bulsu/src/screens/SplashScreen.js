// src/screens/SplashScreen.js
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Animated,
  Dimensions,
  StyleSheet,
} from 'react-native';
import * as Location from 'expo-location';
import { useCameraPermissions } from 'expo-camera';
import { Feather } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const SplashScreen = ({ onReady }) => {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate logo entrance
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // Start progress bar animation
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 2000,
      useNativeDriver: false,
    }).start();

    // Request permissions and initialize
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Request Camera Permission
      if (!cameraPermission?.granted) {
        await requestCameraPermission();
      }

      // Request Location Permission
      await Location.requestForegroundPermissionsAsync();
      
      // Wait minimum time for splash screen
      await new Promise(resolve => setTimeout(resolve, 2500));

      // Ready to navigate
      onReady();
    } catch (error) {
      console.error('Initialization error:', error);
      // Still navigate even if permissions denied (handle later)
      setTimeout(onReady, 2500);
    }
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View className="flex-1 items-center justify-center bg-maroon-800">
      {/* Background Decorative Elements */}
      <View 
        className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-white/5" 
      />
      <View 
        className="absolute -bottom-36 -right-36 w-96 h-96 rounded-full bg-white/5" 
      />

      {/* Logo Container */}
      <Animated.View
        style={[
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
        ]}
        className="items-center mb-16"
      >
        {/* Logo Circle */}
        <View 
          className="w-28 h-28 rounded-full bg-white items-center justify-center mb-6"
          style={styles.logoShadow}
        >
          <Feather name="navigation" size={48} color="#800000" />
        </View>

        {/* App Name */}
        <Text className="text-4xl font-bold text-white mb-2 tracking-wide">
          ARound BulSU
        </Text>
        <Text className="text-sm text-white/80 tracking-widest uppercase">
          Campus Navigation with AR
        </Text>
      </Animated.View>

      {/* Loading Progress */}
      <View 
        className="absolute bottom-32 items-center"
        style={{ width: width * 0.7 }}
      >
        <View className="w-full h-1 bg-white/20 rounded-full overflow-hidden mb-3">
          <Animated.View
            className="h-full bg-white rounded-full"
            style={{ width: progressWidth }}
          />
        </View>
        <Text className="text-white/70 text-sm tracking-wide">
          Initializing...
        </Text>
      </View>

      {/* Footer */}
      <View className="absolute bottom-10 items-center">
        <Text className="text-white/60 text-sm mb-1">
          Bulacan State University
        </Text>
        <Text className="text-white/40 text-xs">
          Version 1.0.0
        </Text>
      </View>
    </View>
  );
};

// Minimal styles for shadow (NativeWind shadow limited on Android)
const styles = StyleSheet.create({
  logoShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
});

export default SplashScreen;
