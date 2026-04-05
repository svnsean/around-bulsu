// src/screens/SplashScreen.js
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Animated,
  Dimensions,
  StyleSheet,
  Image,
} from 'react-native';
import * as Location from 'expo-location';
import { useCameraPermissions } from 'expo-camera';

const splashIcon = require('../../assets/images/splash-icon.png');

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
    // Safety timeout - always proceed after 5 seconds no matter what
    const safetyTimeout = setTimeout(() => {
      console.log('Safety timeout triggered - proceeding to app');
      onReady();
    }, 5000);
    
    try {
      // Request Camera Permission (with timeout protection)
      if (!cameraPermission?.granted) {
        try {
          await Promise.race([
            requestCameraPermission(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Camera permission timeout')), 3000))
          ]);
        } catch (e) {
          console.log('Camera permission skipped:', e.message);
        }
      }

      // Request Location Permission (with timeout protection)
      try {
        await Promise.race([
          Location.requestForegroundPermissionsAsync(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Location permission timeout')), 3000))
        ]);
      } catch (e) {
        console.log('Location permission skipped:', e.message);
      }
      
      // Wait minimum time for splash screen
      await new Promise(resolve => setTimeout(resolve, 2500));

      clearTimeout(safetyTimeout);
      // Ready to navigate
      onReady();
    } catch (error) {
      console.error('Initialization error:', error);
      clearTimeout(safetyTimeout);
      // Still navigate even if permissions denied
      onReady();
    }
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View className="flex-1 items-center justify-center bg-maroon-800">
      {/* Logo Container */}
      <Animated.View
        style={[
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
        ]}
        className="items-center mb-16"
      >
        <Image
          source={splashIcon}
          style={{ width: 120, height: 120, marginBottom: 24, borderRadius: 28, overflow: 'hidden' }}
          resizeMode="cover"
        />

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
        <View className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
          <Animated.View
            className="h-full bg-white rounded-full"
            style={{ width: progressWidth }}
          />
        </View>
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
