// src/components/ui/AnimatedButton.js - Button with haptic feedback and press animation
import React, { useRef } from 'react';
import { TouchableOpacity, Animated, StyleSheet, Text } from 'react-native';
import * as Haptics from 'expo-haptics';

export const AnimatedButton = ({ 
  onPress, 
  children, 
  style, 
  textStyle,
  variant = 'primary', // 'primary' | 'secondary' | 'outline' | 'ghost'
  size = 'md', // 'sm' | 'md' | 'lg'
  disabled = false,
  hapticFeedback = true,
  ...props 
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      friction: 8,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = () => {
    if (hapticFeedback) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress?.();
  };

  const getVariantStyle = () => {
    switch (variant) {
      case 'secondary':
        return styles.secondary;
      case 'outline':
        return styles.outline;
      case 'ghost':
        return styles.ghost;
      default:
        return styles.primary;
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'outline':
      case 'ghost':
        return styles.textOutline;
      default:
        return styles.textPrimary;
    }
  };

  const getSizeStyle = () => {
    switch (size) {
      case 'sm':
        return styles.sizeSm;
      case 'lg':
        return styles.sizeLg;
      default:
        return styles.sizeMd;
    }
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        activeOpacity={0.9}
        style={[
          styles.base,
          getVariantStyle(),
          getSizeStyle(),
          disabled && styles.disabled,
          style,
        ]}
        {...props}
      >
        {typeof children === 'string' ? (
          <Text style={[getTextStyle(), textStyle]}>{children}</Text>
        ) : (
          children
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  primary: {
    backgroundColor: '#800000',
  },
  secondary: {
    backgroundColor: '#F3F4F6',
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#800000',
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  disabled: {
    opacity: 0.5,
  },
  sizeSm: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  sizeMd: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  sizeLg: {
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  textPrimary: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  textOutline: {
    color: '#800000',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default AnimatedButton;
