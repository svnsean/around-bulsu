// src/components/ui/PullToRefresh.js - Animated pull-to-refresh component
import React, { useRef, useState } from 'react';
import { Animated, View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

export const PullToRefresh = ({ 
  children, 
  onRefresh, 
  refreshing = false,
  style,
  contentContainerStyle,
  ...props 
}) => {
  const [isRefreshing, setIsRefreshing] = useState(refreshing);
  const spinValue = useRef(new Animated.Value(0)).current;

  const handleRefresh = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsRefreshing(true);
    
    // Start spin animation
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      })
    ).start();

    try {
      await onRefresh?.();
    } finally {
      setIsRefreshing(false);
      spinValue.setValue(0);
    }
  };

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <ScrollView
      style={style}
      contentContainerStyle={contentContainerStyle}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          colors={['#800000']}
          tintColor="#800000"
          progressBackgroundColor="#fff"
        />
      }
      {...props}
    >
      {children}
    </ScrollView>
  );
};

// Custom refresh indicator
export const RefreshIndicator = ({ refreshing }) => {
  const spinValue = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (refreshing) {
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        })
      ).start();
    } else {
      spinValue.setValue(0);
    }
  }, [refreshing]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (!refreshing) return null;

  return (
    <View style={styles.indicatorContainer}>
      <Animated.View style={{ transform: [{ rotate: spin }] }}>
        <Ionicons name="refresh" size={24} color="#800000" />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  indicatorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
});

export default PullToRefresh;
