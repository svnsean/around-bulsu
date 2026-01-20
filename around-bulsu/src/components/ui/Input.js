// Input component for mobile app
import React from 'react';
import { TextInput, View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';

export const Input = ({
  label,
  error,
  className = '',
  containerClassName = '',
  ...props
}) => {
  return (
    <View className={containerClassName}>
      {label && (
        <Text className="text-sm font-medium text-gray-700 mb-1.5">
          {label}
        </Text>
      )}
      <TextInput
        className={`w-full px-4 py-3 bg-white border rounded-xl text-gray-900 text-base ${
          error ? 'border-red-400' : 'border-gray-200'
        } ${className}`}
        placeholderTextColor="#9ca3af"
        {...props}
      />
      {error && (
        <Text className="text-sm text-red-500 mt-1">{error}</Text>
      )}
    </View>
  );
};

export const SearchInput = ({
  value,
  onChangeText,
  placeholder = 'Search...',
  className = '',
  ...props
}) => {
  return (
    <View className={`relative ${className}`}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 text-base"
        placeholderTextColor="#9ca3af"
        {...props}
      />
      <View className="absolute left-3 top-3.5">
        <Feather name="search" size={18} color="#9CA3AF" />
      </View>
    </View>
  );
};

export default Input;
