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
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Icon } from '../components/ui';

const BSU_CENTER = [120.813778, 14.857830];

MapboxGL.setAccessToken('pk.eyJ1Ijoic3Zuc2VhbiIsImEiOiJjbWh6MXViYmQwaWlvMnJxMW15MW41cWltIn0.Qz2opq51Zz3oj-MGPz7aow');

const CAMPUS_BOUNDS = {
  north: 14.860,
  south: 14.855,
  east: 120.816,
  west: 120.811
};

// Helper function moved outside component to prevent recreation
const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Point in polygon check - moved outside component
const isPointInPolygon = (x, y, polygon) => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat;
    const xj = polygon[j].lng, yj = polygon[j].lat;
    const intersect = ((yi > y) !== (yj > y)) &&
                      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

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

  // Firebase listeners
  useEffect(() => {
    const unsubZones = onSnapshot(collection(db, 'evacuationZones'), (snap) => {
      setEvacuationZones(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubBlockages = onSnapshot(collection(db, 'blockages'), (snap) => {
      setBlockages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubNodes = onSnapshot(collection(db, 'nodes'), (snap) => {
      setNodes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubEdges = onSnapshot(collection(db, 'edges'), (snap) => {
      setEdges(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

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

  const isEdgeBlocked = (edge) => {
    const activeBlockages = blockages.filter(b => b.active);
    if (activeBlockages.length === 0) return false;

    const fromNode = nodes.find(n => n.id === edge.from);
    const toNode = nodes.find(n => n.id === edge.to);
    if (!fromNode || !toNode) return false;

    const midLng = (fromNode.lng + toNode.lng) / 2;
    const midLat = (fromNode.lat + toNode.lat) / 2;

    return activeBlockages.some(blockage => {
      if (!blockage.points || blockage.points.length < 3) return false;
      return isPointInPolygon(midLng, midLat, blockage.points);
    });
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
            const validEdges = edges.filter(e => !isEdgeBlocked(e));
            
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

  // Calculate evacuation path using A*
  const calculateEvacuationPath = (validEdges) => {
    if (!userLocation || !nodes || nodes.length === 0 || !nearestZone) return [];
    
    try {
      const graph = new Map();
      nodes.forEach(n => graph.set(n.id, { ...n, neighbors: [] }));
      validEdges.forEach(e => {
        if (graph.has(e.from) && graph.has(e.to)) {
          graph.get(e.from).neighbors.push({ node: e.to, cost: e.weight || 1 });
          graph.get(e.to).neighbors.push({ node: e.from, cost: e.weight || 1 });
        }
      });

      // Find nearest nodes
      let startNode = null, endNode = null, minStart = Infinity, minEnd = Infinity;
      const getD = (lat1, lon1, lat2, lon2) => {
        const R = 6371e3;
        const p1 = lat1 * Math.PI / 180, p2 = lat2 * Math.PI / 180;
        const dp = (lat2 - lat1) * Math.PI / 180, dl = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dp/2)**2 + Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      };
      
      nodes.forEach(n => {
        const dUser = getD(userLocation[1], userLocation[0], n.lat, n.lng);
        const dDest = getD(nearestZone.centerLat, nearestZone.centerLng, n.lat, n.lng);
        if (dUser < minStart) { minStart = dUser; startNode = n; }
        if (dDest < minEnd) { minEnd = dDest; endNode = n; }
      });

      if (!startNode || !endNode) return [];

      // A* pathfinding
      const openSet = new Set([startNode.id]);
      const closedSet = new Set();
      const cameFrom = new Map();
      const gScore = new Map(), fScore = new Map();
      nodes.forEach(n => { gScore.set(n.id, Infinity); fScore.set(n.id, Infinity); });
      gScore.set(startNode.id, 0);
      fScore.set(startNode.id, getD(startNode.lat, startNode.lng, endNode.lat, endNode.lng));

      while (openSet.size > 0) {
        let current = null, lowest = Infinity;
        for (const id of openSet) {
          if (fScore.get(id) < lowest) { lowest = fScore.get(id); current = id; }
        }
        
        if (current === endNode.id) {
          const path = [];
          let c = current;
          while (c) {
            const node = graph.get(c);
            path.unshift({ lat: node.lat, lng: node.lng });
            c = cameFrom.get(c);
          }
          return path;
        }
        
        openSet.delete(current);
        closedSet.add(current);
        
        const currentNode = graph.get(current);
        if (!currentNode) continue;
        
        for (const neighbor of currentNode.neighbors) {
          if (closedSet.has(neighbor.node)) continue;
          const tentativeG = gScore.get(current) + neighbor.cost;
          if (!openSet.has(neighbor.node)) openSet.add(neighbor.node);
          else if (tentativeG >= gScore.get(neighbor.node)) continue;
          cameFrom.set(neighbor.node, current);
          gScore.set(neighbor.node, tentativeG);
          const neighborNode = graph.get(neighbor.node);
          fScore.set(neighbor.node, tentativeG + getD(neighborNode.lat, neighborNode.lng, endNode.lat, endNode.lng));
        }
      }
      return [];
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
          centerCoordinate={userLocation || BSU_CENTER}
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

      {/* Header Bar */}
      <View className="absolute top-0 left-0 right-0 pt-12 pb-4 px-5 bg-maroon-800">
        <Text className="text-xl font-bold text-white text-center">Emergency</Text>
      </View>

      {/* Outside Campus Warning */}
      {isOutsideCampus && (
        <View className="absolute top-24 left-4 right-4 bg-amber-50 p-4 rounded-2xl border border-amber-200 flex-row items-center shadow-sm">
          <View className="w-10 h-10 rounded-full bg-amber-100 items-center justify-center mr-3">
            <Icon name="alert" size={20} color="#D97706" />
          </View>
          <View className="flex-1">
            <Text className="text-amber-900 font-bold text-sm">Outside Campus</Text>
            <Text className="text-amber-700 text-xs mt-0.5">Evacuation guidance unavailable</Text>
          </View>
        </View>
      )}

      {/* Status Panel - Only show when inside campus */}
      {!isOutsideCampus && (
      <View className="absolute top-24 right-4 bg-white p-4 rounded-2xl shadow-lg min-w-[160px]">
        {/* Legend */}
        <View className="flex-row items-center mb-3">
          <View className="flex-row items-center flex-1">
            <View className="w-3 h-3 rounded-full bg-green-500 mr-2" />
            <Text className="text-xs text-gray-600">Safe Zone</Text>
          </View>
          <View className="bg-green-100 px-2 py-0.5 rounded-full">
            <Text className="text-xs font-bold text-green-700">{evacuationZones.length}</Text>
          </View>
        </View>
        <View className="flex-row items-center mb-3">
          <View className="flex-row items-center flex-1">
            <View className="w-3 h-3 rounded-full bg-red-500 mr-2" />
            <Text className="text-xs text-gray-600">Blockage</Text>
          </View>
          <View className="bg-red-100 px-2 py-0.5 rounded-full">
            <Text className="text-xs font-bold text-red-700">{blockages.filter(b => b.active).length}</Text>
          </View>
        </View>

        {/* Nearest Zone Info */}
        {nearestZone && (
          <View className="pt-3 border-t border-gray-100">
            <Text className="text-xs text-gray-500 uppercase tracking-wider mb-1">Nearest Safe Zone</Text>
            <Text className="text-sm font-bold text-gray-900">{nearestZone.name}</Text>
            <View className="flex-row items-center mt-1">
              <Icon name="navigate" size={12} color="#16a34a" style={{ marginRight: 4 }} />
              <Text className="text-xs font-semibold text-green-600">{Math.round(nearestZone.distance)}m away</Text>
            </View>
          </View>
        )}
      </View>
      )}

      {/* Bottom Action Panel - positioned above floating tab bar */}
      <View className="absolute bottom-28 left-4 right-4">
        <Animated.View 
          style={{ transform: [{ scale: pulseAnim }] }}
          className="bg-white rounded-2xl shadow-xl overflow-hidden"
        >
          <TouchableOpacity
            className={`flex-row items-center justify-center py-5 px-6 ${
              isOutsideCampus ? 'bg-gray-300' : 'bg-red-600 active:bg-red-700'
            }`}
            onPress={handleActivateEvacuation}
            disabled={isOutsideCampus}
            activeOpacity={0.9}
          >
            <View className={`w-10 h-10 rounded-full items-center justify-center mr-4 ${
              isOutsideCampus ? 'bg-gray-400' : 'bg-white/20'
            }`}>
              <Icon name="alert-circle" size={24} color="#FFFFFF" />
            </View>
            <View className="flex-1">
              <Text className="text-white text-lg font-bold">
                {isOutsideCampus ? 'Unavailable' : 'Activate Evacuation'}
              </Text>
              {!isOutsideCampus && nearestZone && (
                <Text className="text-white/80 text-sm">
                  Navigate to {nearestZone.name}
                </Text>
              )}
            </View>
            {!isOutsideCampus && (
              <Icon name="chevron-right" size={24} color="rgba(255,255,255,0.8)" />
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
};

export default EmergencyScreen;
