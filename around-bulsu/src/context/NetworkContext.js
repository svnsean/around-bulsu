// src/context/NetworkContext.js
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { Animated, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const NetworkContext = createContext({
  isConnected: true,
  isInternetReachable: true,
  connectionType: 'unknown',
  isSlowConnection: false,
});

export const useNetwork = () => useContext(NetworkContext);

export const NetworkProvider = ({ children }) => {
  const [networkState, setNetworkState] = useState({
    isConnected: true,
    isInternetReachable: true,
    connectionType: 'unknown',
    isSlowConnection: false,
  });
  const [showBanner, setShowBanner] = useState(false);
  const bannerOpacity = useRef(new Animated.Value(0)).current;
  const bannerTranslateY = useRef(new Animated.Value(-60)).current;

  useEffect(() => {
    // Subscribe to network state updates
    const unsubscribe = NetInfo.addEventListener(state => {
      const isSlowConnection = 
        state.type === 'cellular' && 
        (state.details?.cellularGeneration === '2g' || state.details?.cellularGeneration === '3g');
      
      const newState = {
        isConnected: state.isConnected ?? true,
        isInternetReachable: state.isInternetReachable ?? true,
        connectionType: state.type,
        isSlowConnection,
      };
      
      setNetworkState(newState);
      
      // Show banner if no connection or slow connection
      if (!newState.isConnected || !newState.isInternetReachable || newState.isSlowConnection) {
        setShowBanner(true);
        Animated.parallel([
          Animated.timing(bannerOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.spring(bannerTranslateY, {
            toValue: 0,
            friction: 8,
            useNativeDriver: true,
          }),
        ]).start();
      } else {
        // Hide banner with animation
        Animated.parallel([
          Animated.timing(bannerOpacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(bannerTranslateY, {
            toValue: -60,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => setShowBanner(false));
      }
    });

    return () => unsubscribe();
  }, []);

  const getBannerConfig = () => {
    if (!networkState.isConnected) {
      return {
        message: 'No internet connection',
        icon: 'cloud-offline',
        color: '#ef4444', // red
      };
    }
    if (!networkState.isInternetReachable) {
      return {
        message: 'Unable to reach server',
        icon: 'warning',
        color: '#f59e0b', // amber
      };
    }
    if (networkState.isSlowConnection) {
      return {
        message: 'Slow connection detected',
        icon: 'cellular',
        color: '#f59e0b', // amber
      };
    }
    return null;
  };

  const bannerConfig = getBannerConfig();

  return (
    <NetworkContext.Provider value={networkState}>
      {children}
      {showBanner && bannerConfig && (
        <Animated.View 
          style={[
            styles.banner,
            { 
              backgroundColor: bannerConfig.color,
              opacity: bannerOpacity,
              transform: [{ translateY: bannerTranslateY }],
            }
          ]}
        >
          <Ionicons name={bannerConfig.icon} size={18} color="#fff" />
          <Text style={styles.bannerText}>{bannerConfig.message}</Text>
        </Animated.View>
      )}
    </NetworkContext.Provider>
  );
};

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    zIndex: 9999,
    elevation: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  bannerText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default NetworkContext;
