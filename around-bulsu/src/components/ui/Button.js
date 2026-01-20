// Button component for mobile app
import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator } from 'react-native';

const variantStyles = {
  default: {
    container: 'bg-maroon-800 active:bg-maroon-900',
    text: 'text-white font-semibold',
  },
  secondary: {
    container: 'bg-gray-200 active:bg-gray-300',
    text: 'text-gray-800 font-semibold',
  },
  outline: {
    container: 'border-2 border-maroon-800 bg-transparent active:bg-maroon-50',
    text: 'text-maroon-800 font-semibold',
  },
  ghost: {
    container: 'bg-transparent active:bg-gray-100',
    text: 'text-gray-700 font-medium',
  },
  destructive: {
    container: 'bg-red-500 active:bg-red-600',
    text: 'text-white font-semibold',
  },
  gold: {
    container: 'bg-gold-400 active:bg-gold-500',
    text: 'text-maroon-900 font-semibold',
  },
};

const sizeStyles = {
  sm: {
    container: 'px-3 py-2 rounded-lg',
    text: 'text-sm',
  },
  md: {
    container: 'px-4 py-3 rounded-xl',
    text: 'text-base',
  },
  lg: {
    container: 'px-6 py-4 rounded-xl',
    text: 'text-lg',
  },
};

export const Button = ({
  children,
  variant = 'default',
  size = 'md',
  disabled = false,
  loading = false,
  className = '',
  textClassName = '',
  onPress,
  ...props
}) => {
  const vStyles = variantStyles[variant] || variantStyles.default;
  const sStyles = sizeStyles[size] || sizeStyles.md;

  return (
    <TouchableOpacity
      className={`flex-row items-center justify-center ${sStyles.container} ${vStyles.container} ${disabled ? 'opacity-50' : ''} ${className}`}
      disabled={disabled || loading}
      onPress={onPress}
      activeOpacity={0.8}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' || variant === 'ghost' ? '#800000' : '#fff'} />
      ) : (
        <Text className={`${sStyles.text} ${vStyles.text} ${textClassName}`}>
          {children}
        </Text>
      )}
    </TouchableOpacity>
  );
};

export default Button;
