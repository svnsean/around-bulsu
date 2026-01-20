// Card component for mobile app
import React from 'react';
import { View, Text } from 'react-native';

export const Card = ({ children, className = '', ...props }) => {
  return (
    <View
      className={`bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden ${className}`}
      {...props}
    >
      {children}
    </View>
  );
};

export const CardHeader = ({ children, className = '' }) => (
  <View className={`px-4 pt-4 pb-2 ${className}`}>
    {children}
  </View>
);

export const CardTitle = ({ children, className = '' }) => (
  <Text className={`text-lg font-bold text-gray-900 ${className}`}>
    {children}
  </Text>
);

export const CardDescription = ({ children, className = '' }) => (
  <Text className={`text-sm text-gray-500 mt-1 ${className}`}>
    {children}
  </Text>
);

export const CardContent = ({ children, className = '' }) => (
  <View className={`px-4 py-3 ${className}`}>
    {children}
  </View>
);

export const CardFooter = ({ children, className = '' }) => (
  <View className={`px-4 py-3 border-t border-gray-100 bg-gray-50 ${className}`}>
    {children}
  </View>
);

export default Card;
