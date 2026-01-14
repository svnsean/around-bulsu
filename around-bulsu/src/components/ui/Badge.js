// Badge component for mobile app
import React from 'react';
import { View, Text } from 'react-native';

const variantStyles = {
  default: {
    container: 'bg-maroon-800',
    text: 'text-white',
  },
  secondary: {
    container: 'bg-gray-200',
    text: 'text-gray-700',
  },
  outline: {
    container: 'bg-transparent border border-gray-300',
    text: 'text-gray-700',
  },
  success: {
    container: 'bg-green-100',
    text: 'text-green-700',
  },
  warning: {
    container: 'bg-amber-100',
    text: 'text-amber-700',
  },
  destructive: {
    container: 'bg-red-100',
    text: 'text-red-700',
  },
  gold: {
    container: 'bg-gold-100',
    text: 'text-gold-700',
  },
};

export const Badge = ({ children, variant = 'default', className = '' }) => {
  const styles = variantStyles[variant] || variantStyles.default;

  return (
    <View className={`px-2.5 py-1 rounded-full ${styles.container} ${className}`}>
      <Text className={`text-xs font-medium ${styles.text}`}>
        {children}
      </Text>
    </View>
  );
};

export default Badge;
