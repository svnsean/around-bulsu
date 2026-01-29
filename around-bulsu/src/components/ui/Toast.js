// src/components/ui/Toast.js - Animated toast notifications
import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { View, Text, Animated, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const ToastContext = createContext({
  showToast: () => {},
});

export const useToast = () => useContext(ToastContext);

const TOAST_DURATION = 3000;

const toastConfig = {
  success: {
    icon: 'checkmark-circle',
    backgroundColor: '#10B981',
    iconColor: '#fff',
  },
  error: {
    icon: 'close-circle',
    backgroundColor: '#EF4444',
    iconColor: '#fff',
  },
  warning: {
    icon: 'warning',
    backgroundColor: '#F59E0B',
    iconColor: '#fff',
  },
  info: {
    icon: 'information-circle',
    backgroundColor: '#3B82F6',
    iconColor: '#fff',
  },
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  
  const showToast = useCallback(({ message, type = 'info', duration = TOAST_DURATION }) => {
    const id = Date.now();
    
    // Haptic feedback based on toast type
    if (type === 'success') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (type === 'error') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else if (type === 'warning') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    setToasts(prev => [...prev, { id, message, type }]);
    
    // Auto-dismiss
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
    
    return id;
  }, []);
  
  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      <View style={styles.container} pointerEvents="box-none">
        {toasts.map((toast, index) => (
          <Toast 
            key={toast.id} 
            toast={toast} 
            index={index}
            onDismiss={() => dismissToast(toast.id)} 
          />
        ))}
      </View>
    </ToastContext.Provider>
  );
};

const Toast = ({ toast, index, onDismiss }) => {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  
  const config = toastConfig[toast.type] || toastConfig.info;
  
  React.useEffect(() => {
    // Slide in animation
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);
  
  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onDismiss());
  };

  return (
    <Animated.View
      style={[
        styles.toast,
        { 
          backgroundColor: config.backgroundColor,
          transform: [{ translateY }, { scale }],
          opacity,
          marginTop: index * 8,
        },
      ]}
    >
      <Ionicons name={config.icon} size={20} color={config.iconColor} />
      <Text style={styles.message} numberOfLines={2}>{toast.message}</Text>
      <TouchableOpacity onPress={handleDismiss} style={styles.dismissButton}>
        <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    zIndex: 9999,
    elevation: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  message: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 10,
    marginRight: 8,
  },
  dismissButton: {
    padding: 4,
  },
});

export default ToastContext;
