// ARNavigationScreen.js - Professional HUD-style AR Navigation
// Sensor-fusion AR with clean, professional heads-up display

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Animated,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { Magnetometer, Accelerometer } from 'expo-sensors';
import MapboxGL from '@rnmapbox/maps';
import { MaterialCommunityIcons, FontAwesome5, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAP_MIN_HEIGHT = 220;
const MAP_MAX_HEIGHT = SCREEN_HEIGHT * 0.55;
const CAMERA_FOV = 70;

MapboxGL.setAccessToken('pk.eyJ1Ijoic3Zuc2VhbiIsImEiOiJjbWh6MXViYmQwaWlvMnJxMW15MW41cWltIn0.Qz2opq51Zz3oj-MGPz7aow');

// ========== GPS Kalman Filter Class ==========
class GPSKalmanFilter {
  constructor() {
    this.lat = null;
    this.lng = null;
    this.velocityLat = 0;
    this.velocityLng = 0;
    this.accuracy = 10;
    this.lastTimestamp = null;
    this.processNoise = 3;
    this.minAccuracy = 100;
  }
  
  filter(lat, lng, accuracy, timestamp) {
    if (this.lat === null) {
      this.lat = lat;
      this.lng = lng;
      this.accuracy = accuracy || 10;
      this.lastTimestamp = timestamp || Date.now();
      return { lat: this.lat, lng: this.lng };
    }
    
    const now = timestamp || Date.now();
    const dt = Math.max(0.1, (now - this.lastTimestamp) / 1000);
    this.lastTimestamp = now;
    
    const predictedLat = this.lat + this.velocityLat * dt;
    const predictedLng = this.lng + this.velocityLng * dt;
    const predictedAccuracy = this.accuracy + this.processNoise * dt;
    const measurementAccuracy = Math.min(accuracy || 10, this.minAccuracy);
    const kalmanGain = predictedAccuracy / (predictedAccuracy + measurementAccuracy);
    
    this.lat = predictedLat + kalmanGain * (lat - predictedLat);
    this.lng = predictedLng + kalmanGain * (lng - predictedLng);
    this.velocityLat = (this.lat - predictedLat) / dt * 0.5 + this.velocityLat * 0.5;
    this.velocityLng = (this.lng - predictedLng) / dt * 0.5 + this.velocityLng * 0.5;
    this.accuracy = (1 - kalmanGain) * predictedAccuracy;
    
    return { lat: this.lat, lng: this.lng };
  }
  
  reset() {
    this.lat = null;
    this.lng = null;
    this.velocityLat = 0;
    this.velocityLng = 0;
  }
}

// ========== Compass Low-Pass Filter ==========
class CompassFilter {
  constructor(alpha = 0.15) {
    this.alpha = alpha;
    this.heading = null;
    this.history = [];
    this.historySize = 10;
  }
  
  normalize(angle) {
    while (angle < 0) angle += 360;
    while (angle >= 360) angle -= 360;
    return angle;
  }
  
  angularDifference(from, to) {
    let diff = to - from;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    return diff;
  }
  
  filter(rawHeading) {
    rawHeading = this.normalize(rawHeading);
    
    if (this.heading === null) {
      this.heading = rawHeading;
      this.history = [rawHeading];
      return this.heading;
    }
    
    this.history.push(rawHeading);
    if (this.history.length > this.historySize) {
      this.history.shift();
    }
    
    const sortedHistory = [...this.history].sort((a, b) => a - b);
    const medianHeading = sortedHistory[Math.floor(sortedHistory.length / 2)];
    const diff = this.angularDifference(this.heading, medianHeading);
    this.heading = this.normalize(this.heading + this.alpha * diff);
    
    return this.heading;
  }
  
  reset() {
    this.heading = null;
    this.history = [];
  }
}

// ========== Accelerometer Pitch Filter ==========
class PitchFilter {
  constructor(alpha = 0.2) {
    this.alpha = alpha;
    this.pitch = 0;
  }
  
  filter(rawPitch) {
    this.pitch = this.pitch + this.alpha * (rawPitch - this.pitch);
    return this.pitch;
  }
  
  reset() {
    this.pitch = 0;
  }
}

// ========== Utility Functions ==========
const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3;
  const p1 = lat1 * Math.PI / 180;
  const p2 = lat2 * Math.PI / 180;
  const dp = (lat2 - lat1) * Math.PI / 180;
  const dl = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const getBearing = (lat1, lon1, lat2, lon2) => {
  const p1 = lat1 * Math.PI / 180;
  const p2 = lat2 * Math.PI / 180;
  const dl = (lon2 - lon1) * Math.PI / 180;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
};

const gpsToScreenPosition = (targetLat, targetLon, userLat, userLon, heading, distance, pitch = 0) => {
  const bearing = getBearing(userLat, userLon, targetLat, targetLon);
  let relativeAngle = bearing - heading;
  if (relativeAngle > 180) relativeAngle -= 360;
  if (relativeAngle < -180) relativeAngle += 360;
  
  // Visible if within camera FOV (e.g., 70 degrees)
  const isVisible = Math.abs(relativeAngle) < CAMERA_FOV;
  
  // Check if user is facing the destination (within 30 degrees)
  const isFacing = Math.abs(relativeAngle) < 30;
  
  return { isVisible, isFacing, relativeAngle, distance };
};

// ========== Blockage Check Helpers ==========
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

const isEdgeBlocked = (edge, activeBlockages, nodesMap) => {
  if (!nodesMap || activeBlockages.length === 0) return false;
  
  const fromNode = nodesMap[edge.from];
  const toNode = nodesMap[edge.to];
  if (!fromNode || !toNode) return false;
  
  // Check if edge midpoint is inside any blockage
  const midLng = (fromNode.lng + toNode.lng) / 2;
  const midLat = (fromNode.lat + toNode.lat) / 2;
  
  return activeBlockages.some(blockage => {
    if (!blockage.points || blockage.points.length < 3) return false;
    return isPointInPolygon(midLng, midLat, blockage.points);
  });
};

// ========== Main Component ==========
const ARNavigationScreen = ({ route, navigation }) => {
  const { building, userLocation: initialLocation, nodes, edges, blockages = [] } = route.params;
  
  const [permission, requestPermission] = useCameraPermissions();
  const [userLocation, setUserLocation] = useState(initialLocation);
  const [heading, setHeading] = useState(0);
  const [pitch, setPitch] = useState(0);
  const [navigationPath, setNavigationPath] = useState(null);
  const [pathNodes, setPathNodes] = useState([]);
  const [currentDistance, setCurrentDistance] = useState(null);
  const [nextWaypoint, setNextWaypoint] = useState(null);
  const [nextTurn, setNextTurn] = useState(null);
  const [hasArrived, setHasArrived] = useState(false);
  const [mapHeight] = useState(new Animated.Value(MAP_MIN_HEIGHT));
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [destPosition, setDestPosition] = useState(null);
  const [eta, setEta] = useState(null);
  
  const isMountedRef = useRef(true);
  const celebrationAnim = useRef(new Animated.Value(0)).current;
  
  const gpsFilterRef = useRef(new GPSKalmanFilter());
  const compassFilterRef = useRef(new CompassFilter(0.12));
  const pitchFilterRef = useRef(new PitchFilter(0.15));
  const lastHapticRef = useRef(0);
  
  useEffect(() => {
    isMountedRef.current = true;
    return () => { 
      isMountedRef.current = false;
      gpsFilterRef.current.reset();
      compassFilterRef.current.reset();
      pitchFilterRef.current.reset();
    };
  }, []);

  useEffect(() => {
    if (!userLocation || !building) return;
    
    const userLat = userLocation[1];
    const userLon = userLocation[0];
    
    const destDist = getDistance(userLat, userLon, building.latitude, building.longitude);
    const destPos = gpsToScreenPosition(
      building.latitude, building.longitude,
      userLat, userLon, heading, destDist, pitch
    );
    setDestPosition(destPos);
  }, [userLocation, heading, pitch, building]);

  const detectTurn = useCallback((prevNode, currentNode, nextNode) => {
    if (!prevNode || !currentNode || !nextNode) return null;
    const b1 = getBearing(prevNode.lat, prevNode.lng, currentNode.lat, currentNode.lng);
    const b2 = getBearing(currentNode.lat, currentNode.lng, nextNode.lat, nextNode.lng);
    let turn = b2 - b1;
    if (turn > 180) turn -= 360;
    if (turn < -180) turn += 360;
    if (turn > 45) return 'right';
    if (turn < -45) return 'left';
    if (turn > 20) return 'slight-right';
    if (turn < -20) return 'slight-left';
    return 'straight';
  }, []);

  useEffect(() => {
    let locSub, magSub, accelSub;
    
    const startTracking = async () => {
      locSub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 2, timeInterval: 1000 },
        (loc) => {
          if (!isMountedRef.current) return;
          
          const filtered = gpsFilterRef.current.filter(
            loc.coords.latitude,
            loc.coords.longitude,
            loc.coords.accuracy,
            loc.timestamp
          );
          
          const newLoc = [filtered.lng, filtered.lat];
          setUserLocation(newLoc);
          
          const dist = getDistance(filtered.lat, filtered.lng, building.latitude, building.longitude);
          setCurrentDistance(Math.round(dist));
          
          // Calculate ETA based on average walking speed (1.4 m/s or ~5 km/h)
          const walkingSpeed = 1.4;
          const etaSeconds = Math.round(dist / walkingSpeed);
          const etaMinutes = Math.floor(etaSeconds / 60);
          const etaSecondsRemainder = etaSeconds % 60;
          setEta(etaMinutes > 0 ? `${etaMinutes}m ${etaSecondsRemainder}s` : `${etaSeconds}s`);
          
          if (dist < 15) handleArrived();
          updateNextWaypoint(newLoc);
        }
      );
      
      Magnetometer.setUpdateInterval(100);
      magSub = Magnetometer.addListener((data) => {
        if (!isMountedRef.current) return;
        let rawAngle = Math.atan2(data.y, data.x) * (180 / Math.PI);
        rawAngle = (rawAngle + 360) % 360;
        const smoothedHeading = compassFilterRef.current.filter(rawAngle);
        setHeading(smoothedHeading);
      });
      
      Accelerometer.setUpdateInterval(150);
      accelSub = Accelerometer.addListener((data) => {
        if (!isMountedRef.current) return;
        const rawPitch = Math.atan2(-data.x, Math.sqrt(data.y ** 2 + data.z ** 2)) * (180 / Math.PI);
        const smoothedPitch = pitchFilterRef.current.filter(rawPitch);
        setPitch(smoothedPitch);
      });
    };
    
    startTracking();
    calculatePath();
    
    return () => {
      locSub?.remove();
      magSub?.remove();
      accelSub?.remove();
    };
  }, []);

  const calculatePath = useCallback(() => {
    // Validate all required data
    if (!nodes || !edges || nodes.length === 0 || !building) {
      console.log('[PathCalc] Missing required data:', { nodes: !!nodes, edges: !!edges, nodesLen: nodes?.length, building: !!building });
      return;
    }
    
    // Normalize initialLocation to array format [lng, lat]
    let startLocation = initialLocation;
    if (!startLocation) {
      console.log('[PathCalc] No initial location provided');
      return;
    }
    
    // Handle object format { longitude, latitude }
    if (!Array.isArray(startLocation) && startLocation.longitude !== undefined) {
      startLocation = [startLocation.longitude, startLocation.latitude];
    }
    
    if (!Array.isArray(startLocation) || startLocation.length !== 2) {
      console.log('[PathCalc] Invalid location format:', startLocation);
      return;
    }
    
    console.log('[PathCalc] Calculating path with', nodes.length, 'nodes and', edges.length, 'edges');
    console.log('[PathCalc] From:', startLocation, 'To:', [building.longitude, building.latitude]);
    
    // Create nodes map for edge blocking check
    const nodesMap = {};
    nodes.forEach(n => { nodesMap[n.id] = n; });
    
    // Get active blockages
    const activeBlockages = (blockages || []).filter(b => b.active);
    
    const graph = new Map();
    nodes.forEach(n => graph.set(n.id, { ...n, neighbors: [] }));
    edges.forEach(e => {
      if (graph.has(e.from) && graph.has(e.to)) {
        // Skip edges that pass through active blockages
        if (isEdgeBlocked(e, activeBlockages, nodesMap)) return;
        
        graph.get(e.from).neighbors.push({ node: e.to, cost: e.weight || 1 });
        graph.get(e.to).neighbors.push({ node: e.from, cost: e.weight || 1 });
      }
    });
    
    let startNode = null, endNode = null, minStart = Infinity, minEnd = Infinity;
    nodes.forEach(n => {
      const dUser = getDistance(startLocation[1], startLocation[0], n.lat, n.lng);
      const dDest = getDistance(building.latitude, building.longitude, n.lat, n.lng);
      if (dUser < minStart) { minStart = dUser; startNode = n; }
      if (dDest < minEnd) { minEnd = dDest; endNode = n; }
    });
    
    if (!startNode || !endNode) {
      console.log('[PathCalc] Could not find start/end nodes');
      return;
    }
    
    console.log('[PathCalc] Start node:', startNode.id, 'End node:', endNode.id);
    
    const openSet = new Set([startNode.id]);
    const closedSet = new Set();
    const cameFrom = new Map();
    const gScore = new Map(), fScore = new Map();
    nodes.forEach(n => { gScore.set(n.id, Infinity); fScore.set(n.id, Infinity); });
    gScore.set(startNode.id, 0);
    fScore.set(startNode.id, Math.hypot(startNode.lng - endNode.lng, startNode.lat - endNode.lat));
    
    const MAX_ITERATIONS = 10000;
    let iterations = 0;
    
    while (openSet.size > 0 && iterations < MAX_ITERATIONS) {
      iterations++;
      let currId = null, lowestF = Infinity;
      for (const id of openSet) { 
        if (fScore.get(id) < lowestF) { lowestF = fScore.get(id); currId = id; } 
      }
      
      if (currId === endNode.id) {
        const path = [], pathNodesList = [];
        let curr = currId;
        while (curr) { 
          const n = graph.get(curr); 
          path.unshift([n.lng, n.lat]); 
          pathNodesList.unshift(n); 
          curr = cameFrom.get(curr); 
        }
        path.push([building.longitude, building.latitude]);
        
        console.log('[PathCalc] Path found with', path.length, 'points');
        
        setNavigationPath({ 
          type: 'FeatureCollection', 
          features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: path } }] 
        });
        setPathNodes(pathNodesList);
        if (pathNodesList.length > 1) setNextWaypoint(pathNodesList[1]);
        return;
      }
      
      openSet.delete(currId);
      closedSet.add(currId);
      const currNode = graph.get(currId);
      
      for (const nb of currNode.neighbors) {
        if (closedSet.has(nb.node)) continue;
        const nbNode = graph.get(nb.node);
        if (!nbNode) continue;
        const tentG = gScore.get(currId) + nb.cost;
        if (tentG < gScore.get(nb.node)) {
          cameFrom.set(nb.node, currId);
          gScore.set(nb.node, tentG);
          fScore.set(nb.node, tentG + Math.hypot(nbNode.lng - endNode.lng, nbNode.lat - endNode.lat));
          if (!openSet.has(nb.node)) openSet.add(nb.node);
        }
      }
    }
  }, [nodes, edges, initialLocation, building, blockages]);

  const updateNextWaypoint = useCallback((loc) => {
    if (pathNodes.length < 2) return;
    
    let closestIdx = 0, minDist = Infinity;
    for (let i = 0; i < pathNodes.length; i++) {
      const d = getDistance(loc[1], loc[0], pathNodes[i].lat, pathNodes[i].lng);
      if (d < minDist) { minDist = d; closestIdx = i; }
    }
    
    const nextIdx = Math.min(closestIdx + 1, pathNodes.length - 1);
    if (pathNodes[nextIdx]) setNextWaypoint(pathNodes[nextIdx]);
    
    for (let i = closestIdx; i < pathNodes.length - 2; i++) {
      const turnType = detectTurn(pathNodes[i], pathNodes[i + 1], pathNodes[i + 2]);
      if (turnType && turnType !== 'straight') {
        const td = getDistance(loc[1], loc[0], pathNodes[i + 1].lat, pathNodes[i + 1].lng);
        setNextTurn({ type: turnType, distance: Math.round(td), node: pathNodes[i + 1] });
        
        // Trigger haptic feedback when approaching turn (within 30m, every 5 seconds max)
        const now = Date.now();
        if (td < 30 && now - lastHapticRef.current > 5000) {
          lastHapticRef.current = now;
          Haptics.notificationAsync(
            td < 15 ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success
          );
        }
        
        return;
      }
    }
    setNextTurn(null);
  }, [pathNodes, detectTurn]);

  const handleArrived = () => {
    setHasArrived(true);
    // Celebration haptic
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.spring(celebrationAnim, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }).start();
  };

  const getRelativeDirection = () => {
    if (!userLocation || !building) return 0;
    const targetLat = nextWaypoint?.lat ?? building.latitude;
    const targetLon = nextWaypoint?.lng ?? building.longitude;
    const bearing = getBearing(userLocation[1], userLocation[0], targetLat, targetLon);
    let rel = bearing - heading;
    if (rel > 180) rel -= 360;
    if (rel < -180) rel += 360;
    return rel;
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (_, gs) => {
      const newH = isMapExpanded ? MAP_MAX_HEIGHT - gs.dy : MAP_MIN_HEIGHT - gs.dy;
      if (newH >= MAP_MIN_HEIGHT && newH <= MAP_MAX_HEIGHT) mapHeight.setValue(newH);
    },
    onPanResponderRelease: (_, gs) => {
      if (gs.dy < -50) { 
        setIsMapExpanded(true); 
        Animated.spring(mapHeight, { toValue: MAP_MAX_HEIGHT, useNativeDriver: false }).start(); 
      } else if (gs.dy > 50) { 
        setIsMapExpanded(false); 
        Animated.spring(mapHeight, { toValue: MAP_MIN_HEIGHT, useNativeDriver: false }).start(); 
      } else {
        Animated.spring(mapHeight, { toValue: isMapExpanded ? MAP_MAX_HEIGHT : MAP_MIN_HEIGHT, useNativeDriver: false }).start();
      }
    },
  });

  // Loading Screen
  if (!permission) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <Text className="text-white text-lg">Initializing AR...</Text>
      </View>
    );
  }
  
  // Permission Screen
  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center p-10">
        <LinearGradient colors={['#800000', '#4d0000']} style={StyleSheet.absoluteFill} />
        <Text className="text-6xl mb-5">📷</Text>
        <Text className="text-2xl font-bold text-white mb-3 text-center">
          Camera Access Required
        </Text>
        <Text className="text-base text-white/85 text-center mb-8 leading-6">
          AR Navigation needs camera access to overlay directions on your real-world view.
        </Text>
        <TouchableOpacity 
          className="rounded-2xl overflow-hidden"
          style={styles.elevatedButton}
          onPress={requestPermission}
        >
          <LinearGradient colors={['#fff', '#f0f0f0']} style={styles.permissionButtonGradient}>
            <Text className="text-maroon-800 text-lg font-bold">Grant Permission</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity className="mt-5 p-3" onPress={() => navigation.goBack()}>
          <Text className="text-white/70 text-base">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Arrived Screen
  if (hasArrived) {
    return (
      <View className="flex-1 items-center justify-center">
        <LinearGradient colors={['#800000', '#4d0000', '#1a0000']} style={StyleSheet.absoluteFill} />
        <Animated.View 
          className="items-center p-10"
          style={{ transform: [{ scale: celebrationAnim }], opacity: celebrationAnim }}
        >
          <View className="w-24 h-24 rounded-full bg-white/20 items-center justify-center mb-6">
            <FontAwesome5 name="flag-checkered" size={48} color="#FFD700" />
          </View>
          <Text className="text-4xl font-bold text-white mb-3">You've Arrived!</Text>
          <Text className="text-xl text-white/90 mb-10">{building.name}</Text>
          <TouchableOpacity 
            className="rounded-2xl overflow-hidden"
            style={styles.elevatedButton}
            onPress={() => navigation.reset({
              index: 0,
              routes: [{ name: 'NavigateMain' }],
            })}
          >
            <LinearGradient colors={['#ffd700', '#ffb300']} style={styles.finishButtonGradient}>
              <Text className="text-black text-xl font-bold">Finish Navigation</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 1. The Camera Feed */}
      <CameraView style={StyleSheet.absoluteFillObject} facing="back" />

      {/* 2. The HUD Overlay */}
      <SafeAreaView style={styles.hudOverlay} pointerEvents="box-none">
        
        {/* Top: Turn Instruction Banner */}
        {nextTurn && nextTurn.distance < 60 && (
          <View style={styles.turnBanner}>
            <MaterialCommunityIcons 
              name={nextTurn.type === 'left' ? 'arrow-left-top-bold' : 
                    nextTurn.type === 'right' ? 'arrow-right-top-bold' :
                    nextTurn.type === 'slight-left' ? 'arrow-top-left' :
                    nextTurn.type === 'slight-right' ? 'arrow-top-right' : 'arrow-up-bold'} 
              size={44} 
              color="#FFFFFF" 
            />
            <View style={styles.turnTextContainer}>
              <Text style={styles.turnText}>
                {nextTurn.type === 'left' ? 'Turn Left' : 
                 nextTurn.type === 'right' ? 'Turn Right' :
                 nextTurn.type === 'slight-left' ? 'Slight Left' :
                 nextTurn.type === 'slight-right' ? 'Slight Right' : 'Continue'}
              </Text>
              <Text style={styles.turnDistanceText}>in {nextTurn.distance}m</Text>
            </View>
          </View>
        )}

        {/* Floating Destination Label (Only if looking at it) */}
        {destPosition?.isFacing && currentDistance > 15 && (
          <View style={styles.destinationTag}>
            <FontAwesome5 name="map-marker-alt" size={18} color="#FF4444" />
            <Text style={styles.destinationText}>{building.name}</Text>
            <Text style={styles.destinationDistance}>{currentDistance}m</Text>
          </View>
        )}

        {/* Spacer to push arrow to bottom */}
        <View style={styles.spacer} />

        {/* Bottom Center: The Directional Arrow */}
        <View style={styles.arrowContainer}>
          <View style={styles.arrowShadow}>
            <View style={{ transform: [{ rotate: `${getRelativeDirection()}deg` }] }}>
              <MaterialCommunityIcons 
                name="navigation" 
                size={120} 
                color="#00E5FF" 
                style={styles.arrowIcon}
              />
            </View>
          </View>
          <View style={styles.distanceBadge}>
            <Text style={styles.distanceValue}>{currentDistance || '--'}</Text>
            <Text style={styles.distanceUnit}>m away</Text>
          </View>
        </View>

        {/* ETA Badge */}
        {eta && (
          <View style={styles.etaBadge}>
            <MaterialCommunityIcons name="walk" size={18} color="#00E5FF" />
            <Text style={styles.etaText}>ETA: {eta}</Text>
          </View>
        )}

      </SafeAreaView>

      {/* Top Left: Compass HUD */}
      <View style={styles.topLeftHUD}>
        <View style={styles.compassPanel}>
          <Text style={styles.compassDirection}>
            {heading < 45 || heading >= 315 ? 'N' : 
             heading < 135 ? 'E' : 
             heading < 225 ? 'S' : 'W'}
          </Text>
          <Text style={styles.compassDegrees}>{Math.round(heading)}°</Text>
        </View>
      </View>

      {/* Top Right: Stop Button */}
      <TouchableOpacity style={styles.stopButton} onPress={() => navigation.goBack()}>
        <MaterialCommunityIcons name="close" size={22} color="#FFFFFF" />
        <Text style={styles.stopButtonText}>Stop</Text>
      </TouchableOpacity>

      {/* AR Live Badge */}
      <View style={styles.arBadge}>
        <View style={styles.arDot} />
        <Text style={styles.arBadgeText}>AR LIVE</Text>
      </View>

      {/* Pull-up Map */}
      <Animated.View 
        style={[styles.mapContainer, { height: mapHeight }]} 
        {...panResponder.panHandlers}
      >
        <View style={styles.mapHandle}>
          <View style={styles.mapHandleBar} />
          <Text style={styles.mapHandleText}>
            {isMapExpanded ? 'Drag down to minimize' : 'Drag up for map'}
          </Text>
        </View>
        <MapboxGL.MapView 
          style={styles.map} 
          styleURL={MapboxGL.StyleURL.Street} 
          logoEnabled={false} 
          compassEnabled={false}
        >
          <MapboxGL.Camera 
            zoomLevel={18} 
            centerCoordinate={userLocation} 
            heading={heading} 
            pitch={45} 
            animationDuration={500} 
            animationMode="flyTo"
          />
          <MapboxGL.UserLocation visible={true} />
          {navigationPath && (
            <MapboxGL.ShapeSource id="navPath" shape={navigationPath}>
              <MapboxGL.LineLayer 
                id="navPathLayer" 
                style={{ 
                  lineColor: '#00E5FF', 
                  lineWidth: 5, 
                  lineCap: 'round', 
                  lineJoin: 'round' 
                }} 
              />
            </MapboxGL.ShapeSource>
          )}
          <MapboxGL.PointAnnotation id="destination" coordinate={[building.longitude, building.latitude]}>
            <View style={styles.mapDestinationMarker}>
              <FontAwesome5 name="flag-checkered" size={16} color="#FFFFFF" />
            </View>
          </MapboxGL.PointAnnotation>
        </MapboxGL.MapView>
      </Animated.View>
    </View>
  );
};

// ========== Professional HUD Styles ==========
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  
  // HUD Overlay
  hudOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 100,
  },
  
  // Turn Banner (Top)
  turnBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    marginTop: 20,
  },
  turnTextContainer: {
    marginLeft: 16,
  },
  turnText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  turnDistanceText: {
    color: '#00E5FF',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 2,
  },
  
  // Destination Tag (Floating)
  destinationTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.4)',
  },
  destinationText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  destinationDistance: {
    color: '#FF4444',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  
  // Spacer
  spacer: {
    flex: 1,
  },
  
  // Arrow Container (Bottom Center)
  arrowContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  arrowShadow: {
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 10,
  },
  arrowIcon: {
    textShadowColor: 'rgba(0, 229, 255, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
  },
  distanceValue: {
    color: '#00E5FF',
    fontSize: 28,
    fontWeight: 'bold',
  },
  distanceUnit: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    marginLeft: 6,
  },
  
  // ETA Badge
  etaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 180,
  },
  etaText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  
  // Top Left HUD (Compass)
  topLeftHUD: {
    position: 'absolute',
    top: 50,
    left: 16,
  },
  compassPanel: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
  },
  compassDirection: {
    color: '#00E5FF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  compassDegrees: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
  },
  
  // Stop Button
  stopButton: {
    position: 'absolute',
    top: 50,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(220, 53, 69, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  stopButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  
  // AR Badge
  arBadge: {
    position: 'absolute',
    top: 100,
    left: '50%',
    marginLeft: -40,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  arDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00FF00',
    marginRight: 6,
  },
  arBadgeText: {
    color: '#00FF00',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  
  // Map Container
  mapContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  mapHandle: {
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#F8F9FA',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  mapHandleBar: {
    width: 40,
    height: 4,
    backgroundColor: '#CED4DA',
    borderRadius: 2,
  },
  mapHandleText: {
    color: '#6C757D',
    fontSize: 11,
    marginTop: 4,
  },
  map: {
    flex: 1,
  },
  mapDestinationMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#00E5FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  
  // Permission & Loading screens
  permissionButtonGradient: { 
    paddingHorizontal: 40, 
    paddingVertical: 16 
  },
  finishButtonGradient: { 
    paddingHorizontal: 40, 
    paddingVertical: 18 
  },
  elevatedButton: { 
    elevation: 5 
  },
});

export default ARNavigationScreen;
