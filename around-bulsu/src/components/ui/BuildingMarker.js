// src/components/ui/BuildingMarker.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// BulSU Brand Colors
export const BULSU_COLORS = {
  maroon: '#B22222',
  gold: '#FFD700',
  maroonDark: '#4d0000',
  goldDark: '#DAA520',
};

/**
 * Custom Google Maps-style "Place" marker for buildings
 * - Circular white background with school icon
 * - Floating label with subtle shadow
 * 
 * @param {Object} props
 * @param {string} props.name - Building name to display
 * @param {boolean} props.showLabel - Whether to show the label (for zoom-based conditional rendering)
 * @param {boolean} props.isSelected - Whether this marker is selected
 */
const BuildingMarker = ({ name, showLabel = true, isSelected = false }) => {
  return (
    <View style={styles.container}>
      {/* Pin Circle */}
      <View style={[
        styles.pinCircle,
        isSelected && styles.pinCircleSelected
      ]}>
        <MaterialCommunityIcons 
          name="school" 
          size={20} 
          color={isSelected ? BULSU_COLORS.gold : BULSU_COLORS.maroon} 
        />
      </View>
      
      {/* Pin Pointer */}
      <View style={[
        styles.pinPointer,
        isSelected && styles.pinPointerSelected
      ]} />
      
      {/* Floating Label */}
      {showLabel && (
        <View style={styles.labelContainer}>
          <Text style={styles.labelText} numberOfLines={2}>
            {name}
          </Text>
        </View>
      )}
    </View>
  );
};

/**
 * Cluster marker for grouped buildings
 * Uses BulSU gold/maroon color scheme
 * 
 * @param {Object} props
 * @param {number} props.count - Number of buildings in cluster
 * @param {function} props.onPress - Callback when cluster is pressed
 */
export const ClusterMarker = ({ count }) => {
  return (
    <View style={styles.clusterContainer}>
      <View style={styles.clusterCircle}>
        <Text style={styles.clusterText}>{count}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: 100,
  },
  
  // Google Maps "Place" style pin - circular white background
  pinCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: BULSU_COLORS.maroon,
    // Shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  
  pinCircleSelected: {
    backgroundColor: BULSU_COLORS.maroon,
    borderColor: BULSU_COLORS.gold,
    transform: [{ scale: 1.1 }],
  },
  
  // Small triangle pointer below the circle
  pinPointer: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: BULSU_COLORS.maroon,
    marginTop: -2,
  },
  
  pinPointerSelected: {
    borderTopColor: BULSU_COLORS.gold,
  },
  
  // Floating label with white background and shadow
  labelContainer: {
    marginTop: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    // Shadow for readability against map tiles
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
    maxWidth: 90,
  },
  
  labelText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
  },
  
  // Cluster styles - BulSU gold/maroon scheme
  clusterContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  clusterCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: BULSU_COLORS.maroon,
    borderWidth: 4,
    borderColor: BULSU_COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 8,
  },
  
  clusterText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default BuildingMarker;
