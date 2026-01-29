// src/components/ui/AnimatedCard.js - Card with entrance animation and press feedback
import React, { useEffect, useRef } from 'react';
import { Animated, TouchableOpacity, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';

export const AnimatedCard = ({ 
  children, 
  onPress, 
  style,
  delay = 0,
  animateOnMount = true,
  hapticFeedback = true,
}) => {
  const translateY = useRef(new Animated.Value(animateOnMount ? 20 : 0)).current;
  const opacity = useRef(new Animated.Value(animateOnMount ? 0 : 1)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (animateOnMount) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 400,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 400,
          delay,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, []);

  const handlePressIn = () => {
    if (onPress) {
      Animated.spring(scale, {
        toValue: 0.98,
        friction: 8,
        useNativeDriver: true,
      }).start();
    }
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 5,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = () => {
    if (hapticFeedback) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress?.();
  };

  const animatedStyle = {
    transform: [{ translateY }, { scale }],
    opacity,
  };

  if (onPress) {
    return (
      <Animated.View style={animatedStyle}>
        <TouchableOpacity
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.95}
          style={[styles.card, style]}
        >
          {children}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.card, style, animatedStyle]}>
      {children}
    </Animated.View>
  );
};

// Animated list item for FlatList
export const AnimatedListItem = ({ children, index, onPress, style }) => {
  return (
    <AnimatedCard
      onPress={onPress}
      delay={index * 50}
      style={style}
    >
      {children}
    </AnimatedCard>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
});

export default AnimatedCard;
