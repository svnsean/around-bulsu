// src/screens/EmergencyScreen.js - Emergency & Evacuation Screen with NativeWind
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  Animated,
  Platform,
} from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { DrawerActions } from '@react-navigation/native';
import { supabase, subscribeToTable } from '../supabase';
import { CAMPUS_BOUNDS, isWithinCampus } from '../config/mapbox';
import { useSettings } from '../context/SettingsContext';

// Import shared pathfinding utilities
import {
  findPath,
  getDistance,
  isPointInPolygon,
} from '../lib/pathfinding';

// Mapbox is initialized in App.js

// getDistance is now imported from pathfinding.js

const EmergencyScreen = ({ navigation, route }) => {
  const { mapStyle, triggerHaptic, colors } = useSettings();
  const [userLocation, setUserLocation] = useState(null);
  const [evacuationZones, setEvacuationZones] = useState([]);
  const [blockages, setBlockages] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [isOutsideCampus, setIsOutsideCampus] = useState(false);
  const [nearestZone, setNearestZone] = useState(null);
  const [autoTriggerEvacuation, setAutoTriggerEvacuation] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for emergency button
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // Location tracking
  useEffect(() => {
    let locationSubscription;

    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required');
        return;
      }

      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });
      
      const coords = [location.coords.longitude, location.coords.latitude];
      setUserLocation(coords);
      checkIfOutsideCampus(coords);

      locationSubscription = await Location.watchPositionAsync({
        accuracy: Location.Accuracy.High,
        timeInterval: 2000,
        distanceInterval: 5
      }, (loc) => {
        const newCoords = [loc.coords.longitude, loc.coords.latitude];
        setUserLocation(newCoords);
        checkIfOutsideCampus(newCoords);
      });
    })();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, []);

  // Supabase listeners
  useEffect(() => {
    const unsubZones = subscribeToTable('evacuation_zones', setEvacuationZones);
    const unsubBlockages = subscribeToTable('blockages', (data) => {
      setBlockages(data.filter(b => b.active));
    });
    const unsubNodes = subscribeToTable('nodes', setNodes);
    const unsubEdges = subscribeToTable('edges', setEdges);

    return () => {
      unsubZones();
      unsubBlockages();
      unsubNodes();
      unsubEdges();
    };
  }, []);

  // Check for auto-trigger evacuation from critical alert
  useEffect(() => {
    if (route?.params?.triggerEvacuation) {
      setAutoTriggerEvacuation(true);
      // Clear the param to prevent re-triggering
      navigation.setParams({ triggerEvacuation: false });
    }
  }, [route?.params?.triggerEvacuation, navigation]);

  // Auto-trigger evacuation when ready (location, zones, and nodes loaded)
  useEffect(() => {
    if (autoTriggerEvacuation && nearestZone && userLocation && nodes.length > 0) {
      setAutoTriggerEvacuation(false);
      // Slight delay to ensure UI is ready
      setTimeout(() => {
        startEvacuationNavigation();
      }, 500);
    }
  }, [autoTriggerEvacuation, nearestZone, userLocation, nodes]);

  // Start evacuation navigation directly (used by auto-trigger)
  const startEvacuationNavigation = () => {
    if (!nearestZone) {
      Alert.alert('No Evacuation Zones', 'No evacuation zones are currently defined.');
      return;
    }

    navigation.navigate('ARNavigation', {
      building: {
        name: nearestZone.name,
        latitude: nearestZone.centerLat,
        longitude: nearestZone.centerLng,
        isEvacuationZone: true
      },
      userLocation,
      nodes,
      edges,
      blockages: blockages.filter(b => b.active),
      isEmergency: true,
      skipIntro: true
    });
  };

  // Calculate nearest zone when location or zones change
  useEffect(() => {
    if (!userLocation || evacuationZones.length === 0) {
      setNearestZone(null);
      return;
    }

    let nearestZoneResult = null;
    let minDistance = Infinity;

    evacuationZones.forEach(zone => {
      if (!zone.points || zone.points.length === 0) return;
      const centerLng = zone.points.reduce((sum, p) => sum + p.lng, 0) / zone.points.length;
      const centerLat = zone.points.reduce((sum, p) => sum + p.lat, 0) / zone.points.length;
      const distance = getDistance(userLocation[1], userLocation[0], centerLat, centerLng);
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestZoneResult = { ...zone, distance, centerLng, centerLat };
      }
    });

    // Only update state if the nearest zone actually changed (by id or significant distance change)
    setNearestZone(prev => {
      if (!nearestZoneResult && !prev) return prev;
      if (!nearestZoneResult || !prev) return nearestZoneResult;
      // Compare by id and distance to avoid unnecessary re-renders
      if (prev.id === nearestZoneResult.id && Math.abs(prev.distance - nearestZoneResult.distance) < 1) {
        return prev; // No meaningful change, keep previous reference
      }
      return nearestZoneResult;
    });
  }, [userLocation, evacuationZones]);

  const checkIfOutsideCampus = (coords) => {
    if (!coords) return;
    const [lng, lat] = coords;
    // Use the polygon-based isWithinCampus function
    const outside = !isWithinCampus(lat, lng);
    setIsOutsideCampus(outside);
  };

  const findNearestZone = () => {
    if (!userLocation || evacuationZones.length === 0) return null;

    let nearestZone = null;
    let minDistance = Infinity;

    evacuationZones.forEach(zone => {
      if (!zone.points || zone.points.length === 0) return;
      const centerLng = zone.points.reduce((sum, p) => sum + p.lng, 0) / zone.points.length;
      const centerLat = zone.points.reduce((sum, p) => sum + p.lat, 0) / zone.points.length;
      const distance = getDistance(userLocation[1], userLocation[0], centerLat, centerLng);
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestZone = { ...zone, distance, centerLng, centerLat };
      }
    });

    return nearestZone;
  };

  const zonesToGeoJSON = () => ({
    type: 'FeatureCollection',
    features: evacuationZones
      .filter(zone => zone.points && zone.points.length >= 3)
      .map(zone => ({
        type: 'Feature',
        properties: { id: zone.id, name: zone.name },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            ...zone.points.map(p => [p.lng, p.lat]),
            [zone.points[0].lng, zone.points[0].lat]
          ]]
        }
      }))
  });

  const blockagesToGeoJSON = () => ({
    type: 'FeatureCollection',
    features: blockages
      .filter(b => b.active && b.points && b.points.length >= 3)
      .map(b => ({
        type: 'Feature',
        properties: { id: b.id, name: b.name },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            ...b.points.map(p => [p.lng, p.lat]),
            [b.points[0].lng, b.points[0].lat]
          ]]
        }
      }))
  });

  const handleActivateEvacuation = () => {
    if (!nearestZone) {
      Alert.alert('No Evacuation Zones', 'No evacuation zones are currently defined. Please contact campus security.');
      return;
    }

    Alert.alert(
      'Activate Evacuation',
      `Navigate to nearest safe zone: ${nearestZone.name}?\n\nDistance: ${Math.round(nearestZone.distance)}m`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Start Navigation',
          onPress: () => {
            // Launch AR Navigation for emergency evacuation
            navigation.navigate('ARNavigation', {
              building: {
                name: nearestZone.name,
                latitude: nearestZone.centerLat,
                longitude: nearestZone.centerLng,
                isEvacuationZone: true
              },
              userLocation,
              nodes,
              edges,
              blockages: blockages.filter(b => b.active),
              isEmergency: true,
              skipIntro: true  // Skip AR intro for emergency - need to navigate quickly
            });
          }
        }
      ]
    );
  };

  // Calculate evacuation path using the shared pathfinding utility
  const calculateEvacuationPath = () => {
    if (!userLocation || !nodes || nodes.length === 0 || !nearestZone) return [];
    
    try {
      const result = findPath({
        startCoords: userLocation,
        endCoords: [nearestZone.centerLng, nearestZone.centerLat],
        nodes,
        edges,
        blockages,
        includeEndpoints: false
      });
      
      if (result.error || result.path.length === 0) {
        return [];
      }
      
      // Convert path coordinates to {lat, lng} format
      return result.path.map(([lng, lat]) => ({ lat, lng }));
    } catch (error) {
      console.error('Error calculating evacuation path:', error);
      return [];
    }
  };

  return (
    <View className="flex-1 bg-gray-100">
      {/* Map */}
      <MapboxGL.MapView 
        style={{ flex: 1 }}
        styleURL={mapStyle}
        logoEnabled={false}
      >
        <MapboxGL.Camera
          zoomLevel={17}
          centerCoordinate={userLocation || [120.8103, 14.8448]}
          animationDuration={1000}
        />

        <MapboxGL.LocationPuck 
          puckBearingEnabled={true}
          puckBearing="heading"
        />

        {/* Evacuation Zones (Green) */}
        <MapboxGL.ShapeSource id="evacuation-zones" shape={zonesToGeoJSON()}>
          <MapboxGL.FillLayer
            id="zones-fill"
            style={{ fillColor: '#22c55e', fillOpacity: 0.25 }}
          />
          <MapboxGL.LineLayer
            id="zones-outline"
            style={{ lineColor: '#16a34a', lineWidth: 3 }}
          />
        </MapboxGL.ShapeSource>

        {/* Blockages (Red) */}
        <MapboxGL.ShapeSource id="blockages" shape={blockagesToGeoJSON()}>
          <MapboxGL.FillLayer
            id="blockages-fill"
            style={{ fillColor: '#dc2626', fillOpacity: 0.35 }}
          />
          <MapboxGL.LineLayer
            id="blockages-outline"
            style={{ lineColor: '#991b1b', lineWidth: 2, lineDasharray: [3, 3] }}
          />
        </MapboxGL.ShapeSource>

        {/* Zone Labels */}
        {evacuationZones.map(zone => {
          if (!zone.points || zone.points.length === 0) return null;
          const centerLng = zone.points.reduce((sum, p) => sum + p.lng, 0) / zone.points.length;
          const centerLat = zone.points.reduce((sum, p) => sum + p.lat, 0) / zone.points.length;
          return (
            <MapboxGL.PointAnnotation key={zone.id} id={zone.id} coordinate={[centerLng, centerLat]}>
              <View className="px-3 py-2 bg-white rounded-lg shadow-sm border border-green-200 flex-row items-center">
                <View className="w-2 h-2 rounded-full bg-green-500 mr-2" />
                <Text className="text-xs font-semibold text-gray-800">{zone.name}</Text>
              </View>
            </MapboxGL.PointAnnotation>
          );
        })}

        {/* Blockage Labels */}
        {blockages.filter(b => b.active).map(blockage => {
          if (!blockage.points || blockage.points.length === 0) return null;
          const centerLng = blockage.points.reduce((sum, p) => sum + p.lng, 0) / blockage.points.length;
          const centerLat = blockage.points.reduce((sum, p) => sum + p.lat, 0) / blockage.points.length;
          return (
            <MapboxGL.PointAnnotation key={blockage.id} id={blockage.id} coordinate={[centerLng, centerLat]}>
              <View className="px-3 py-2 bg-white rounded-lg shadow-sm border border-red-200 flex-row items-center">
                <View className="w-2 h-2 rounded-full bg-red-500 mr-2" />
                <Text className="text-xs font-semibold text-gray-800">{blockage.name}</Text>
              </View>
            </MapboxGL.PointAnnotation>
          );
        })}
      </MapboxGL.MapView>

      {/* Menu Button — circle, right side */}
      <TouchableOpacity
        style={[styles.menuButton, { backgroundColor: colors.card }]}
        onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
      >
        <Ionicons name="menu" size={24} color="#B22222" />
      </TouchableOpacity>

      {/* Legend - only show when inside campus */}
      {!isOutsideCampus && (
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#22c55e' }]} />
            <Text style={styles.legendText}>Safe Zones</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#ef4444' }]} />
            <Text style={styles.legendText}>Blocked Areas</Text>
          </View>
        </View>
      )}

      {/* Outside Campus Warning — pill, centered */}
      {isOutsideCampus && (
        <View style={styles.warningPill}>
          <Ionicons name="warning" size={16} color="#fff" style={{ marginRight: 4 }} />
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12, fontFamily: 'Inter_700Bold' }}>
            Outside campus
          </Text>
        </View>
      )}

      {/* Activate Evacuation Button — pill, right-aligned */}
      <TouchableOpacity style={styles.evacuateButton} onPress={handleActivateEvacuation}>
        <Ionicons name="alert-circle" size={20} color="#fff" />
        <Text style={styles.evacuateText}>Evacuate</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = {
  container: { flex: 1 },
  map: { flex: 1 },
  menuButton: {
    position: 'absolute',
    top: 52,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  warningPill: {
    position: 'absolute',
    top: 56,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B',
    paddingHorizontal: 14,
    height: 48,
    borderRadius: 24,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    zIndex: 10,
  },
  userMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  userMarkerInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3b82f6',
    borderWidth: 2,
    borderColor: '#fff'
  },
  legend: {
    position: 'absolute',
    top: 110,
    right: 16,
    backgroundColor: 'rgba(26, 26, 46, 0.9)',
    padding: 12,
    borderRadius: 8
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
    marginRight: 8
  },
  legendText: {
    color: '#fff',
    fontSize: 12
  },
  evacuateButton: {
    position: 'absolute',
    bottom: 20,
    right: 16,
    backgroundColor: '#ef4444',
    paddingHorizontal: 20,
    height: 48,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    zIndex: 10,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  evacuateText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  }
};

export default EmergencyScreen;
