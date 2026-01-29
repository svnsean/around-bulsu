// src/components/ui/Skeleton.js - Animated skeleton loader
import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export const Skeleton = ({ width, height, borderRadius = 8, style }) => {
  const shimmerTranslate = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    const shimmerAnimation = Animated.loop(
      Animated.timing(shimmerTranslate, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      })
    );
    shimmerAnimation.start();
    return () => shimmerAnimation.stop();
  }, []);

  const translateX = shimmerTranslate.interpolate({
    inputRange: [-1, 1],
    outputRange: [-200, 200],
  });

  return (
    <View
      style={[
        styles.skeleton,
        { width, height, borderRadius },
        style,
      ]}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ translateX }] },
        ]}
      >
        <LinearGradient
          colors={['transparent', 'rgba(255, 255, 255, 0.4)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
};

// Building list skeleton
export const BuildingListSkeleton = ({ count = 3 }) => (
  <View style={styles.listContainer}>
    {Array.from({ length: count }).map((_, index) => (
      <View key={index} style={styles.buildingItem}>
        <Skeleton width={44} height={44} borderRadius={12} />
        <View style={styles.buildingContent}>
          <Skeleton width="70%" height={16} style={{ marginBottom: 8 }} />
          <Skeleton width="50%" height={12} />
        </View>
        <Skeleton width={32} height={32} borderRadius={16} />
      </View>
    ))}
  </View>
);

// Contact list skeleton
export const ContactListSkeleton = ({ count = 4 }) => (
  <View style={styles.listContainer}>
    {Array.from({ length: count }).map((_, index) => (
      <View key={index} style={styles.contactItem}>
        <View style={styles.contactContent}>
          <Skeleton width="60%" height={16} style={{ marginBottom: 6 }} />
          <Skeleton width="40%" height={14} />
        </View>
        <Skeleton width={44} height={44} borderRadius={22} />
      </View>
    ))}
  </View>
);

// Card skeleton
export const CardSkeleton = ({ hasImage = true }) => (
  <View style={styles.cardContainer}>
    {hasImage && <Skeleton width="100%" height={150} borderRadius={16} style={{ marginBottom: 12 }} />}
    <Skeleton width="80%" height={20} style={{ marginBottom: 8 }} />
    <Skeleton width="60%" height={14} style={{ marginBottom: 6 }} />
    <Skeleton width="90%" height={14} />
  </View>
);

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  listContainer: {
    padding: 16,
  },
  buildingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    marginBottom: 12,
  },
  buildingContent: {
    flex: 1,
    marginLeft: 12,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  contactContent: {
    flex: 1,
  },
  cardContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
});
