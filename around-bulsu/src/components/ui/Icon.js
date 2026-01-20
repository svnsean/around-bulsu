// Icon component using Feather icons for clean, consistent UI
import React from 'react';
import { View } from 'react-native';
import { Feather, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';

// Icon mapping for semantic names
const ICON_MAP = {
  // Navigation
  'compass': { icon: 'navigation', family: 'Feather' },
  'navigate': { icon: 'navigation-2', family: 'Feather' },
  'map': { icon: 'map', family: 'Feather' },
  'map-pin': { icon: 'map-pin', family: 'Feather' },
  'location': { icon: 'map-pin', family: 'Feather' },
  'route': { icon: 'navigation', family: 'Feather' },
  
  // Arrows / Directions
  'arrow-up': { icon: 'arrow-up', family: 'Feather' },
  'arrow-down': { icon: 'arrow-down', family: 'Feather' },
  'arrow-left': { icon: 'arrow-left', family: 'Feather' },
  'arrow-right': { icon: 'arrow-right', family: 'Feather' },
  'chevron-up': { icon: 'chevron-up', family: 'Feather' },
  'chevron-down': { icon: 'chevron-down', family: 'Feather' },
  'chevron-left': { icon: 'chevron-left', family: 'Feather' },
  'chevron-right': { icon: 'chevron-right', family: 'Feather' },
  'corner-up-left': { icon: 'corner-up-left', family: 'Feather' },
  'corner-up-right': { icon: 'corner-up-right', family: 'Feather' },
  
  // Actions
  'search': { icon: 'search', family: 'Feather' },
  'menu': { icon: 'menu', family: 'Feather' },
  'close': { icon: 'x', family: 'Feather' },
  'x': { icon: 'x', family: 'Feather' },
  'check': { icon: 'check', family: 'Feather' },
  'plus': { icon: 'plus', family: 'Feather' },
  'minus': { icon: 'minus', family: 'Feather' },
  'edit': { icon: 'edit-2', family: 'Feather' },
  'trash': { icon: 'trash-2', family: 'Feather' },
  'settings': { icon: 'settings', family: 'Feather' },
  'refresh': { icon: 'refresh-cw', family: 'Feather' },
  
  // Communication
  'phone': { icon: 'phone', family: 'Feather' },
  'phone-call': { icon: 'phone-call', family: 'Feather' },
  'bell': { icon: 'bell', family: 'Feather' },
  'message': { icon: 'message-circle', family: 'Feather' },
  'mail': { icon: 'mail', family: 'Feather' },
  
  // Emergency
  'alert': { icon: 'alert-triangle', family: 'Feather' },
  'alert-circle': { icon: 'alert-circle', family: 'Feather' },
  'shield': { icon: 'shield', family: 'Feather' },
  'shield-check': { icon: 'shield', family: 'Feather' },
  'siren': { icon: 'alarm-light-outline', family: 'MaterialCommunityIcons' },
  
  // Buildings & Places
  'building': { icon: 'office-building-outline', family: 'MaterialCommunityIcons' },
  'home': { icon: 'home', family: 'Feather' },
  'door': { icon: 'door-open', family: 'MaterialCommunityIcons' },
  'room': { icon: 'door-open', family: 'MaterialCommunityIcons' },
  
  // Info & Status
  'info': { icon: 'info', family: 'Feather' },
  'help': { icon: 'help-circle', family: 'Feather' },
  'user': { icon: 'user', family: 'Feather' },
  'users': { icon: 'users', family: 'Feather' },
  'clock': { icon: 'clock', family: 'Feather' },
  'calendar': { icon: 'calendar', family: 'Feather' },
  'megaphone': { icon: 'bullhorn-outline', family: 'MaterialCommunityIcons' },
  
  // Media
  'camera': { icon: 'camera', family: 'Feather' },
  'image': { icon: 'image', family: 'Feather' },
  'eye': { icon: 'eye', family: 'Feather' },
  'eye-off': { icon: 'eye-off', family: 'Feather' },
  
  // Misc
  'target': { icon: 'target', family: 'Feather' },
  'crosshair': { icon: 'crosshair', family: 'Feather' },
  'flag': { icon: 'flag', family: 'Feather' },
  'bookmark': { icon: 'bookmark', family: 'Feather' },
  'star': { icon: 'star', family: 'Feather' },
  'layers': { icon: 'layers', family: 'Feather' },
  'grid': { icon: 'grid', family: 'Feather' },
  'list': { icon: 'list', family: 'Feather' },
};

export const Icon = ({ 
  name, 
  size = 24, 
  color = '#000000', 
  style,
  ...props 
}) => {
  const mapping = ICON_MAP[name];
  
  if (!mapping) {
    // Fallback to Feather with direct name
    return <Feather name={name} size={size} color={color} style={style} {...props} />;
  }
  
  const { icon, family } = mapping;
  
  switch (family) {
    case 'MaterialCommunityIcons':
      return <MaterialCommunityIcons name={icon} size={size} color={color} style={style} {...props} />;
    case 'Ionicons':
      return <Ionicons name={icon} size={size} color={color} style={style} {...props} />;
    case 'Feather':
    default:
      return <Feather name={icon} size={size} color={color} style={style} {...props} />;
  }
};

// Convenience wrapper with background circle
export const IconCircle = ({
  name,
  size = 24,
  color = '#800000',
  bgColor = '#FEE2E2',
  circleSize,
  style,
  ...props
}) => {
  const actualCircleSize = circleSize || size * 1.8;
  
  return (
    <View 
      style={[
        {
          width: actualCircleSize,
          height: actualCircleSize,
          borderRadius: actualCircleSize / 2,
          backgroundColor: bgColor,
          justifyContent: 'center',
          alignItems: 'center',
        },
        style
      ]}
    >
      <Icon name={name} size={size} color={color} {...props} />
    </View>
  );
};

export default Icon;
