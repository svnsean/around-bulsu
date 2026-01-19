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
import { supabase, subscribeToTable } from '../supabase';

// Import shared pathfinding utilities
import {
  findPath,
  getDistance,
  isPointInPolygon,
  isEdgeBlocked
} from '../lib/pathfinding';

MapboxGL.setAccessToken('pk.eyJ1Ijoic2VhbmFvbmciLCJhIjoiY205aHk0a2xsMGc4ZzJxcHprZ3k2OWVkcyJ9.ze3cQ-CzjL2Gtgp2VZTmaQ');

const CAMPUS_BOUNDS = {
  north: 14.8485,
  south: 14.8410,
  east: 120.8150,
  west: 120.8050
};

// getDistance is now imported from pathfinding.js

const EmergencyScreen = ({ navigation }) => {
  const [userLocation, setUserLocation] = useState(null);
  const [evacuationZones, setEvacuationZones] = useState([]);
  const [blockages, setBlockages] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [isOutsideCampus, setIsOutsideCampus] = useState(false);
  const [nearestZone, setNearestZone] = useState(null);
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
    const outside = lat > CAMPUS_BOUNDS.north || lat < CAMPUS_BOUNDS.south ||
                    lng > CAMPUS_BOUNDS.east || lng < CAMPUS_BOUNDS.west;
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

  // Check if an edge is blocked using the shared utility
  const checkEdgeBlocked = (edge) => {
    const activeBlockages = blockages.filter(b => b.active);
    const nodesMap = {};
    nodes.forEach(n => { nodesMap[n.id] = n; });
    return isEdgeBlocked(edge, activeBlockages, nodesMap);
  };

  const handleActivateEvacuation = () => {
    if (isOutsideCampus) {
      Alert.alert('Outside Campus', 'Evacuation guidance is only available when you are inside the BSU campus.');
      return;
    }

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
            const validEdges = edges.filter(e => !checkEdgeBlocked(e));
            
            // Launch AR Navigation
            navigation.navigate('ARNavigation', {
              destination: {
                name: nearestZone.name,
                latitude: nearestZone.centerLat,
                longitude: nearestZone.centerLng,
                isEvacuationZone: true
              },
              userLocation,
              nodes,
              edges: validEdges,
              isEmergency: true
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
        styleURL={MapboxGL.StyleURL.Street}
        logoEnabled={false}
      >
        <MapboxGL.Camera
          zoomLevel={17}
          centerCoordinate={userLocation || [120.8103, 14.8448]}
          animationDuration={1000}
        />

        <MapboxGL.UserLocation 
          visible={true}
          showsUserHeadingIndicator={true}
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

      {/* Outside Campus Warning */}
      {isOutsideCampus && (
        <View style={styles.warningBanner}>
          <Ionicons name="warning" size={20} color="#fff" />
          <Text style={styles.warningText}>You are outside the campus</Text>
        </View>
      )}

      {/* Activate Evacuation Button */}
      <TouchableOpacity style={styles.evacuateButton} onPress={handleActivateEvacuation}>
        <Ionicons name="alert-circle" size={24} color="#fff" />
        <Text style={styles.evacuateText}>Activate Evacuation</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = {
  container: { flex: 1 },
  map: { flex: 1 },
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
    top: 50,
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
  warningBanner: {
    position: 'absolute',
    top: 130,
    left: 16,
    right: 16,
    backgroundColor: '#f59e0b',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  warningText: {
    color: '#fff',
    fontWeight: '600'
  },
  evacuateButton: {
    position: 'absolute',
    bottom: 96,
    left: 16,
    right: 16,
    backgroundColor: '#ef4444',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    zIndex: 10,
    elevation: 10
  },
  evacuateText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600'
  }
};

export default EmergencyScreen;
