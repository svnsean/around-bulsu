// ARNavigationScreen.js - ViroReact 3D AR Navigation with HUD Fallback
// Features: 3D directional arrows, building markers, ground plane detection

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Animated,
  PanResponder,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { Magnetometer, Accelerometer } from 'expo-sensors';
import MapboxGL from '@rnmapbox/maps';
import { MaterialCommunityIcons, FontAwesome5, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

// Import shared pathfinding utilities
import {
  findPath,
  pathToGeoJSON,
  getDistance,
  getBearing,
  isPointInPolygon,
  isEdgeBlocked,
  detectTurn as detectTurnUtil,
  calculateETA as calculateETAUtil
} from '../lib/pathfinding';

// ViroReact imports - wrapped in try/catch to prevent crash if not available
// Note: We only import the essential components to avoid crashes from ViroAnimations/ViroMaterials (issue #412)
let ViroARScene, ViroARSceneNavigator, ViroText, ViroNode, ViroAmbientLight;
let viroAvailable = false;

try {
  const viro = require('@reactvision/react-viro');
  ViroARScene = viro.ViroARScene;
  ViroARSceneNavigator = viro.ViroARSceneNavigator;
  ViroText = viro.ViroText;
  ViroNode = viro.ViroNode;
  ViroAmbientLight = viro.ViroAmbientLight;
  viroAvailable = true;
  console.log('[ViroReact] Successfully loaded essential components');
} catch (e) {
  console.warn('ViroReact not available:', e.message);
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAP_MIN_HEIGHT = 220;
const MAP_MAX_HEIGHT = SCREEN_HEIGHT * 0.55;
const CAMERA_FOV = 70;

MapboxGL.setAccessToken('pk.eyJ1Ijoic3Zuc2VhbiIsImEiOiJjbWh6MXViYmQwaWlvMnJxMW15MW41cWltIn0.Qz2opq51Zz3oj-MGPz7aow');

// Note: ViroAnimations.registerAnimations and ViroMaterials.createMaterials
// are NOT called at startup due to crash issues on some devices (see issue #412).
// The AR scene uses simple ViroText elements without materials or animations.

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

// ========== Local Utility Functions (use imported getDistance, getBearing) ==========
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

// Convert GPS coordinates to AR world position (relative to user)
const gpsToARPosition = (targetLat, targetLon, userLat, userLon, heading) => {
  const distance = getDistance(userLat, userLon, targetLat, targetLon);
  const bearing = getBearing(userLat, userLon, targetLat, targetLon);
  
  // Convert bearing relative to user's heading
  const relativeBearing = (bearing - heading) * Math.PI / 180;
  
  // Scale distance for AR (cap at 50m for visibility)
  const scaledDistance = Math.min(distance, 50) / 10;
  
  // Calculate X, Z position (Y is up in AR)
  const x = Math.sin(relativeBearing) * scaledDistance;
  const z = -Math.cos(relativeBearing) * scaledDistance; // Negative Z is forward
  
  return { x, y: 0, z, realDistance: distance };
};

// isPointInPolygon, isEdgeBlocked, detectTurn, and calculateETA are imported from pathfinding.js

// ========== ViroReact AR Scene Component ==========
const ARNavigationScene = (props) => {
  const { arSceneNavigator } = props;
  const viroProps = arSceneNavigator.viroAppProps || {};
  
  // Use local state for AR scene to prevent re-render issues
  const [sceneReady, setSceneReady] = React.useState(false);
  const [arData, setArData] = React.useState({
    building: null,
    userLocation: null,
    heading: 0,
    currentDistance: null,
    nextWaypoint: null,
    relativeDirection: 0,
  });
  
  // Update AR data when props change (but don't trigger full re-render)
  React.useEffect(() => {
    if (viroProps.building && viroProps.userLocation) {
      setArData({
        building: viroProps.building,
        userLocation: viroProps.userLocation,
        heading: viroProps.heading || 0,
        currentDistance: viroProps.currentDistance,
        nextWaypoint: viroProps.nextWaypoint,
        relativeDirection: viroProps.relativeDirection || 0,
      });
      if (!sceneReady) setSceneReady(true);
    }
  }, [viroProps.building, viroProps.userLocation, viroProps.heading, viroProps.currentDistance, viroProps.nextWaypoint, viroProps.relativeDirection]);

  const { building, userLocation, heading, currentDistance, nextWaypoint, relativeDirection } = arData;

  const onInitialized = (state, reason) => {
    console.log('[ViroAR] Initialized:', state, reason);
  };

  if (!sceneReady || !userLocation || !building) {
    return (
      <ViroARScene onTrackingUpdated={onInitialized}>
        <ViroAmbientLight color="#ffffff" intensity={200} />
        <ViroText
          text="Initializing AR..."
          position={[0, 0, -3]}
          style={{ fontSize: 20, color: '#ffffff', textAlignVertical: 'center', textAlign: 'center' }}
        />
      </ViroARScene>
    );
  }

  // Calculate destination AR position
  const destARPos = gpsToARPosition(
    building.latitude, 
    building.longitude, 
    userLocation[1], 
    userLocation[0], 
    heading
  );

  // Calculate next waypoint AR position
  const waypointARPos = nextWaypoint ? gpsToARPosition(
    nextWaypoint.lat,
    nextWaypoint.lng,
    userLocation[1],
    userLocation[0],
    heading
  ) : null;

  // Calculate arrow rotation based on relative direction
  const arrowRotation = [0, -relativeDirection || 0, 0];

  return (
    <ViroARScene onTrackingUpdated={onInitialized}>
      {/* Lighting */}
      <ViroAmbientLight color="#ffffff" intensity={300} />

      {/* Direction indicator with distance - simple text-based approach */}
      <ViroNode position={[0, 0, -3]} rotation={arrowRotation}>
        {/* Direction arrow using text */}
        <ViroText
          text="▲"
          position={[0, 0.3, 0]}
          scale={[2, 2, 2]}
          style={{ 
            fontSize: 40, 
            color: '#00E5FF', 
            textAlignVertical: 'center', 
            textAlign: 'center',
          }}
        />
        
        {/* Distance label */}
        <ViroText
          text={`${currentDistance || '--'}m`}
          position={[0, -0.3, 0]}
          style={{ 
            fontSize: 24, 
            color: '#00E5FF', 
            textAlignVertical: 'center', 
            textAlign: 'center',
            fontWeight: 'bold',
          }}
        />
        
        {/* Destination name */}
        <ViroText
          text={building.name}
          position={[0, -0.6, 0]}
          style={{ 
            fontSize: 16, 
            color: '#ffffff', 
            textAlignVertical: 'center', 
            textAlign: 'center',
          }}
        />
      </ViroNode>

      {/* Destination Marker (when close enough to see) */}
      {destARPos.realDistance < 100 && (
        <ViroNode position={[destARPos.x, 1, destARPos.z]}>
          {/* Destination indicator */}
          <ViroText
            text="📍"
            position={[0, 0.5, 0]}
            scale={[2, 2, 2]}
            style={{ 
              fontSize: 30, 
              color: '#FF4444', 
              textAlignVertical: 'center', 
              textAlign: 'center',
            }}
          />
          
          {/* Building name label */}
          <ViroText
            text={building.name}
            position={[0, 0, 0]}
            style={{ 
              fontSize: 18, 
              color: '#ffffff', 
              textAlignVertical: 'center', 
              textAlign: 'center',
              fontWeight: 'bold',
            }}
          />
          <ViroText
            text={`${Math.round(destARPos.realDistance)}m away`}
            position={[0, -0.3, 0]}
            style={{ 
              fontSize: 14, 
              color: '#FF4444', 
              textAlignVertical: 'center', 
              textAlign: 'center',
            }}
          />
        </ViroNode>
      )}

      {/* Next Waypoint indicator */}
      {waypointARPos && waypointARPos.realDistance > 5 && waypointARPos.realDistance < 50 && (
        <ViroNode position={[waypointARPos.x, 0.5, waypointARPos.z]}>
          <ViroText
            text="●"
            style={{ 
              fontSize: 20, 
              color: '#FFD700', 
              textAlignVertical: 'center', 
              textAlign: 'center',
            }}
          />
        </ViroNode>
      )}
    </ViroARScene>
  );
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
  // Default to HUD mode for stability - 3D AR (ViroReact) can be enabled manually
  const [arMode, setArMode] = useState('hud');
  const [viroError, setViroError] = useState(false);
  
  const isMountedRef = useRef(true);
  const celebrationAnim = useRef(new Animated.Value(0)).current;
  const viroPropsRef = useRef({}); // Store Viro props in ref to avoid re-renders
  
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

  // Handle switching to 3D AR mode - with timeout fallback
  useEffect(() => {
    if (arMode === 'viro' && viroAvailable && !viroError) {
      console.log('[AR] Switching to ViroReact 3D AR mode');
      
      // Set a timeout to fall back to HUD if ViroReact doesn't render properly
      const timeout = setTimeout(() => {
        if (isMountedRef.current && arMode === 'viro') {
          console.log('[AR] ViroReact initialization timeout - falling back to HUD');
          setViroError(true);
          setArMode('hud');
        }
      }, 15000); // 15 second timeout
      
      return () => clearTimeout(timeout);
    }
  }, [arMode, viroError]);

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

  // detectTurn is imported as detectTurnUtil from pathfinding.js

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
          
          // Calculate ETA using shared utility
          setEta(calculateETAUtil(dist));
          
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
    
    // Use the shared pathfinding utility
    const result = findPath({
      startCoords: startLocation,
      endCoords: [building.longitude, building.latitude],
      nodes,
      edges,
      blockages,
      includeEndpoints: true
    });
    
    if (result.error) {
      console.warn('[PathCalc] Warning:', result.error);
      return;
    }
    
    console.log('[PathCalc] Path found with', result.path.length, 'points');
    
    // Convert path to GeoJSON and set state
    setNavigationPath(pathToGeoJSON(result.path));
    setPathNodes(result.pathNodes);
    
    if (result.pathNodes.length > 1) {
      setNextWaypoint(result.pathNodes[1]);
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
      const turnType = detectTurnUtil(pathNodes[i], pathNodes[i + 1], pathNodes[i + 2]);
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
  }, [pathNodes, detectTurnUtil]);

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
      {/* ViroReact 3D AR Mode - only if ViroReact is available and no error occurred */}
      {arMode === 'viro' && viroAvailable && !viroError && ViroARSceneNavigator && (
        <ViroARSceneNavigator
          autofocus={true}
          initialScene={{
            scene: ARNavigationScene,
          }}
          viroAppProps={{
            building,
            userLocation,
            heading,
            currentDistance,
            nextWaypoint,
            relativeDirection: getRelativeDirection(),
          }}
          style={StyleSheet.absoluteFillObject}
          numberOfTrackedImages={0}
        />
      )}

      {/* Fallback HUD Mode with Camera (also used if Viro is not available or errored) */}
      {(arMode === 'hud' || !viroAvailable || viroError) && (
        <>
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

      {/* Top Left: Compass HUD (HUD mode only) */}
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
        </>
      )}

      {/* ========== Shared UI Elements (both modes) ========== */}

      {/* Top Right: Stop Button */}
      <TouchableOpacity style={styles.stopButton} onPress={() => navigation.goBack()}>
        <MaterialCommunityIcons name="close" size={22} color="#FFFFFF" />
        <Text style={styles.stopButtonText}>Stop</Text>
      </TouchableOpacity>

      {/* AR Live Badge */}
      <View style={styles.arBadge}>
        <View style={[styles.arDot, arMode === 'viro' && viroAvailable && !viroError && styles.arDot3D]} />
        <Text style={styles.arBadgeText}>{arMode === 'viro' && viroAvailable && !viroError ? '3D AR' : 'AR HUD'}</Text>
      </View>

      {/* AR Mode Toggle Button - only show if ViroReact is available and hasn't errored */}
      {viroAvailable && !viroError && (
        <TouchableOpacity 
          style={styles.arModeToggle} 
          onPress={() => setArMode(arMode === 'viro' ? 'hud' : 'viro')}
        >
          <MaterialCommunityIcons 
            name={arMode === 'viro' ? 'cube-outline' : 'camera'} 
            size={20} 
            color="#FFFFFF" 
          />
          <Text style={styles.arModeToggleText}>
            {arMode === 'viro' ? 'Switch to HUD' : 'Switch to 3D'}
          </Text>
        </TouchableOpacity>
      )}

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
  arDot3D: {
    backgroundColor: '#00E5FF',
  },
  
  // AR Mode Toggle Button
  arModeToggle: {
    position: 'absolute',
    top: 100,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
  },
  arModeToggleText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 6,
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
