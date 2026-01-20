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
<<<<<<< HEAD
<<<<<<< HEAD
  Easing,
=======
>>>>>>> ae1c7e32feebd8fc664b00a4e0e447c5eca6d6f4
=======
  Easing,
>>>>>>> 0846c07 (AR feature done)
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { Magnetometer, Accelerometer } from 'expo-sensors';
import MapboxGL from '@rnmapbox/maps';
import { MaterialCommunityIcons, FontAwesome5, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
<<<<<<< HEAD
<<<<<<< HEAD
import { MAPBOX_ACCESS_TOKEN } from '../config/mapbox';
=======
>>>>>>> ae1c7e32feebd8fc664b00a4e0e447c5eca6d6f4
=======
import { MAPBOX_ACCESS_TOKEN } from '../config/mapbox';
>>>>>>> 0846c07 (AR feature done)

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

<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 0846c07 (AR feature done)
// Mapbox is initialized in App.js

// ViroReact imports - wrapped in try/catch to prevent crash if not available
let ViroARScene, ViroARSceneNavigator, ViroText, ViroNode, ViroAmbientLight, Viro3DObject, ViroMaterials, ViroAnimations, ViroBox, ViroFlexView, ViroARPlane, ViroARPlaneSelector, ViroQuad, ViroPolyline;
<<<<<<< HEAD
=======
// ViroReact imports - wrapped in try/catch to prevent crash if not available
// Note: We only import the essential components to avoid crashes from ViroAnimations/ViroMaterials (issue #412)
let ViroARScene, ViroARSceneNavigator, ViroText, ViroNode, ViroAmbientLight;
>>>>>>> ae1c7e32feebd8fc664b00a4e0e447c5eca6d6f4
=======
>>>>>>> 0846c07 (AR feature done)
let viroAvailable = false;

try {
  const viro = require('@reactvision/react-viro');
  ViroARScene = viro.ViroARScene;
  ViroARSceneNavigator = viro.ViroARSceneNavigator;
  ViroText = viro.ViroText;
  ViroNode = viro.ViroNode;
  ViroAmbientLight = viro.ViroAmbientLight;
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 0846c07 (AR feature done)
  Viro3DObject = viro.Viro3DObject;
  ViroMaterials = viro.ViroMaterials;
  ViroAnimations = viro.ViroAnimations;
  ViroBox = viro.ViroBox;
  ViroFlexView = viro.ViroFlexView;
  ViroARPlane = viro.ViroARPlane;
  ViroARPlaneSelector = viro.ViroARPlaneSelector;
  ViroQuad = viro.ViroQuad;
  ViroPolyline = viro.ViroPolyline;
  viroAvailable = true;
  console.log('[ViroReact] Successfully loaded AR components');
<<<<<<< HEAD
=======
  viroAvailable = true;
  console.log('[ViroReact] Successfully loaded essential components');
>>>>>>> ae1c7e32feebd8fc664b00a4e0e447c5eca6d6f4
=======
>>>>>>> 0846c07 (AR feature done)
} catch (e) {
  console.warn('ViroReact not available:', e.message);
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAP_MIN_HEIGHT = 220;
const MAP_MAX_HEIGHT = SCREEN_HEIGHT * 0.55;
const CAMERA_FOV = 70;

<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 0846c07 (AR feature done)
// ========== Google Maps Live View Style Animated Chevrons Component ==========
const AnimatedChevrons = ({ direction = 0, isVisible = true }) => {
  const chevron1Opacity = useRef(new Animated.Value(0)).current;
  const chevron2Opacity = useRef(new Animated.Value(0)).current;
  const chevron3Opacity = useRef(new Animated.Value(0)).current;
  const chevron4Opacity = useRef(new Animated.Value(0)).current;
  
  const chevron1Translate = useRef(new Animated.Value(0)).current;
  const chevron2Translate = useRef(new Animated.Value(0)).current;
  const chevron3Translate = useRef(new Animated.Value(0)).current;
  const chevron4Translate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isVisible) return;
    
    const animateChevron = (opacityAnim, translateAnim, delay) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(opacityAnim, {
              toValue: 1,
              duration: 400,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(translateAnim, {
              toValue: -20,
              duration: 400,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(opacityAnim, {
              toValue: 0,
              duration: 400,
              easing: Easing.in(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(translateAnim, {
              toValue: -40,
              duration: 400,
              easing: Easing.in(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(translateAnim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const anim1 = animateChevron(chevron1Opacity, chevron1Translate, 0);
    const anim2 = animateChevron(chevron2Opacity, chevron2Translate, 150);
    const anim3 = animateChevron(chevron3Opacity, chevron3Translate, 300);
    const anim4 = animateChevron(chevron4Opacity, chevron4Translate, 450);
    
    anim1.start();
    anim2.start();
    anim3.start();
    anim4.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
      anim4.stop();
    };
  }, [isVisible]);

  if (!isVisible) return null;

  const renderChevron = (opacity, translate, index) => (
    <Animated.View
      key={index}
      style={{
        position: 'absolute',
        bottom: 60 + (index * 50),
        opacity,
        transform: [{ translateY: translate }],
      }}
    >
      <View style={styles.chevronArrow}>
        <View style={[styles.chevronLine, styles.chevronLineLeft]} />
        <View style={[styles.chevronLine, styles.chevronLineRight]} />
      </View>
    </Animated.View>
  );

  return (
    <View style={[styles.chevronsContainer, { transform: [{ rotate: `${direction}deg` }] }]}>
      {renderChevron(chevron1Opacity, chevron1Translate, 0)}
      {renderChevron(chevron2Opacity, chevron2Translate, 1)}
      {renderChevron(chevron3Opacity, chevron3Translate, 2)}
      {renderChevron(chevron4Opacity, chevron4Translate, 3)}
    </View>
  );
};
<<<<<<< HEAD
=======
MapboxGL.setAccessToken('pk.eyJ1Ijoic3Zuc2VhbiIsImEiOiJjbWh6MXViYmQwaWlvMnJxMW15MW41cWltIn0.Qz2opq51Zz3oj-MGPz7aow');

// Note: ViroAnimations.registerAnimations and ViroMaterials.createMaterials
// are NOT called at startup due to crash issues on some devices (see issue #412).
// The AR scene uses simple ViroText elements without materials or animations.
>>>>>>> ae1c7e32feebd8fc664b00a4e0e447c5eca6d6f4
=======
>>>>>>> 0846c07 (AR feature done)

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

<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 0846c07 (AR feature done)
// Generate ground path dots between user and destination
const generatePathDots = (pathNodes, userLat, userLon, heading, maxDots = 8) => {
  if (!pathNodes || pathNodes.length < 2) return [];
  
  const dots = [];
  const totalPathLength = pathNodes.reduce((sum, node, i) => {
    if (i === 0) return 0;
    return sum + getDistance(pathNodes[i-1].lat, pathNodes[i-1].lng, node.lat, node.lng);
  }, 0);
  
  // Create evenly spaced dots along the path
  const spacing = Math.min(totalPathLength / maxDots, 10); // Max 10m spacing
  let accumulatedDist = 0;
  
  for (let i = 1; i < pathNodes.length && dots.length < maxDots; i++) {
    const segmentDist = getDistance(
      pathNodes[i-1].lat, pathNodes[i-1].lng,
      pathNodes[i].lat, pathNodes[i].lng
    );
    
    while (accumulatedDist + spacing <= accumulatedDist + segmentDist && dots.length < maxDots) {
      const t = (accumulatedDist + spacing - accumulatedDist) / segmentDist;
      const dotLat = pathNodes[i-1].lat + t * (pathNodes[i].lat - pathNodes[i-1].lat);
      const dotLng = pathNodes[i-1].lng + t * (pathNodes[i].lng - pathNodes[i-1].lng);
      
      const arPos = gpsToARPosition(dotLat, dotLng, userLat, userLon, heading);
      if (arPos.realDistance < 30) { // Only show dots within 30m
        dots.push({
          position: [arPos.x, -0.5, arPos.z], // Ground level
          distance: arPos.realDistance,
          scale: Math.max(0.3, 1 - arPos.realDistance / 30), // Fade with distance
        });
      }
      accumulatedDist += spacing;
    }
    accumulatedDist += segmentDist - (accumulatedDist % spacing);
  }
  
  return dots;
};

// ========== Enhanced ViroReact AR Scene Component (Google Maps Live View Style) ==========
<<<<<<< HEAD
=======
// isPointInPolygon, isEdgeBlocked, detectTurn, and calculateETA are imported from pathfinding.js

// ========== ViroReact AR Scene Component ==========
>>>>>>> ae1c7e32feebd8fc664b00a4e0e447c5eca6d6f4
=======
>>>>>>> 0846c07 (AR feature done)
const ARNavigationScene = (props) => {
  const { arSceneNavigator } = props;
  const viroProps = arSceneNavigator.viroAppProps || {};
  
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 0846c07 (AR feature done)
  const [sceneReady, setSceneReady] = React.useState(false);
  const [trackingState, setTrackingState] = React.useState('TRACKING_UNAVAILABLE');
  const [surfaceFound, setSurfaceFound] = React.useState(false);
  const [groundY, setGroundY] = React.useState(-1.0); // Default ground level
<<<<<<< HEAD
=======
  // Use local state for AR scene to prevent re-render issues
  const [sceneReady, setSceneReady] = React.useState(false);
>>>>>>> ae1c7e32feebd8fc664b00a4e0e447c5eca6d6f4
=======
>>>>>>> 0846c07 (AR feature done)
  const [arData, setArData] = React.useState({
    building: null,
    userLocation: null,
    heading: 0,
    currentDistance: null,
    nextWaypoint: null,
    relativeDirection: 0,
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 0846c07 (AR feature done)
    pathNodes: [],
    nextTurn: null,
  });
  
  // Update whenever viroProps change
  React.useEffect(() => {
    console.log('[ViroAR] Received props:', {
      hasBuilding: !!viroProps.building,
      hasUserLocation: !!viroProps.userLocation,
      userLocation: viroProps.userLocation,
      heading: viroProps.heading,
      currentDistance: viroProps.currentDistance,
    });
    
    if (viroProps.building) {
<<<<<<< HEAD
=======
  });
  
  // Update AR data when props change (but don't trigger full re-render)
  React.useEffect(() => {
    if (viroProps.building && viroProps.userLocation) {
>>>>>>> ae1c7e32feebd8fc664b00a4e0e447c5eca6d6f4
=======
>>>>>>> 0846c07 (AR feature done)
      setArData({
        building: viroProps.building,
        userLocation: viroProps.userLocation,
        heading: viroProps.heading || 0,
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 0846c07 (AR feature done)
        currentDistance: viroProps.currentDistance || 0,
        nextWaypoint: viroProps.nextWaypoint,
        relativeDirection: viroProps.relativeDirection || 0,
        pathNodes: viroProps.pathNodes || [],
        nextTurn: viroProps.nextTurn,
      });
      if (!sceneReady) setSceneReady(true);
    }
  }, [viroProps]);

  const { building, userLocation, heading, currentDistance, nextWaypoint, relativeDirection, pathNodes, nextTurn } = arData;

  const onInitialized = (state, reason) => {
    console.log('[ViroAR] Tracking state:', state, reason);
    setTrackingState(state);
  };

  // Handle anchor found (surface detected)
  const onAnchorFound = (anchor) => {
    console.log('[ViroAR] Surface detected:', anchor);
    if (anchor.type === 'plane' && anchor.alignment === 'horizontal') {
      setSurfaceFound(true);
      // Use the detected plane's Y position as ground level
      if (anchor.position) {
        setGroundY(anchor.position[1]);
      }
    }
  };

  const onAnchorUpdated = (anchor) => {
    if (anchor.type === 'plane' && anchor.alignment === 'horizontal' && anchor.position) {
      setGroundY(anchor.position[1]);
    }
  };

  // Loading state - Scanning for surfaces
  if (!sceneReady || !userLocation || !building) {
    return (
      <ViroARScene onTrackingUpdated={onInitialized} onAnchorFound={onAnchorFound}>
        <ViroAmbientLight color="#ffffff" intensity={300} />
        <ViroNode position={[0, 0, -2]}>
          <ViroText
            text="📱 Point camera at the ground"
            position={[0, 0.3, 0]}
            style={{ fontSize: 20, color: '#FFFFFF', textAlign: 'center' }}
          />
          <ViroText
            text="Scanning for surfaces..."
            position={[0, 0, 0]}
            style={{ fontSize: 16, color: '#00E5FF', textAlign: 'center' }}
          />
        </ViroNode>
<<<<<<< HEAD
=======
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
>>>>>>> ae1c7e32feebd8fc664b00a4e0e447c5eca6d6f4
=======
>>>>>>> 0846c07 (AR feature done)
      </ViroARScene>
    );
  }

<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 0846c07 (AR feature done)
  // Calculate positions
  const destARPos = gpsToARPosition(building.latitude, building.longitude, userLocation[1], userLocation[0], heading);
  const waypointARPos = nextWaypoint ? gpsToARPosition(nextWaypoint.lat, nextWaypoint.lng, userLocation[1], userLocation[0], heading) : null;
  
  // Generate ground path dots
  const pathDots = generatePathDots(pathNodes, userLocation[1], userLocation[0], heading);
  
  // Calculate arrow rotation based on direction
  const arrowRotation = [0, -(relativeDirection || 0), 0];
  
  // Determine turn indicator
  const getTurnIcon = (turnType) => {
    switch(turnType) {
      case 'left': return '⬅';
      case 'right': return '➡';
      case 'slight-left': return '↖';
      case 'slight-right': return '↗';
      default: return '⬆';
    }
  };

  // Generate chevron positions on the ground
  const generateGroundChevrons = () => {
    const chevrons = [];
    const count = 5;
    const spacing = 0.8;
    const direction = (relativeDirection || 0) * Math.PI / 180;
    
    for (let i = 0; i < count; i++) {
      const distance = 1.5 + (i * spacing);
      const x = Math.sin(direction) * distance;
      const z = -Math.cos(direction) * distance;
      const opacity = 1 - (i * 0.15);
      const scale = 1 - (i * 0.1);
      
      chevrons.push({
        position: [x, groundY + 0.01, z], // Slightly above ground
        opacity,
        scale,
        index: i,
      });
    }
    return chevrons;
  };

  const groundChevrons = generateGroundChevrons();

  return (
    <ViroARScene 
      onTrackingUpdated={onInitialized}
      onAnchorFound={onAnchorFound}
      onAnchorUpdated={onAnchorUpdated}
    >
      {/* Lighting */}
      <ViroAmbientLight color="#ffffff" intensity={500} />

      {/* ===== SURFACE SCANNING INDICATOR ===== */}
      {!surfaceFound && trackingState !== 'TRACKING_NORMAL' && (
        <ViroNode position={[0, 0, -2]}>
          <ViroText
            text="🔍 Scanning ground surface..."
            style={{ fontSize: 18, color: '#FFD700', textAlign: 'center' }}
          />
          <ViroText
            text="Move phone slowly"
            position={[0, -0.3, 0]}
            style={{ fontSize: 14, color: '#FFFFFF', textAlign: 'center' }}
          />
        </ViroNode>
      )}

      {/* ===== GROUND-ANCHORED CHEVRON ARROWS (Like Google Maps) ===== */}
      {groundChevrons.map((chevron, index) => (
        <ViroNode key={`chevron-${index}`} position={chevron.position}>
          {/* Main chevron arrow on ground */}
          <ViroText
            text="▲"
            rotation={[-90, -(relativeDirection || 0), 0]}
            scale={[chevron.scale * 1.5, chevron.scale * 1.5, chevron.scale * 1.5]}
            style={{ 
              fontSize: 80, 
              color: `rgba(255, 255, 255, ${chevron.opacity})`,
              textAlign: 'center',
            }}
          />
          {/* Glow effect */}
          <ViroText
            text="▲"
            position={[0, -0.01, 0]}
            rotation={[-90, -(relativeDirection || 0), 0]}
            scale={[chevron.scale * 1.6, chevron.scale * 1.6, chevron.scale * 1.6]}
            style={{ 
              fontSize: 80, 
              color: `rgba(66, 133, 244, ${chevron.opacity * 0.5})`,
              textAlign: 'center',
            }}
          />
        </ViroNode>
      ))}

      {/* ===== PATH DOTS ON GROUND ===== */}
      {pathDots.map((dot, index) => (
        <ViroNode key={`dot-${index}`} position={[dot.position[0], groundY + 0.02, dot.position[2]]}>
          <ViroText
            text="●"
            rotation={[-90, 0, 0]}
            scale={[dot.scale, dot.scale, dot.scale]}
            style={{ 
              fontSize: 40, 
              color: index === 0 ? '#00E5FF' : '#4FC3F7', 
              textAlign: 'center',
            }}
          />
        </ViroNode>
      ))}

      {/* ===== BUILDING NAME LABEL (Floating) ===== */}
      <ViroNode position={[0, 1.2, -3]}>
        <ViroText
          text={building.name}
          style={{ 
            fontSize: 26, 
            color: '#FFFFFF', 
            textAlign: 'center',
            fontWeight: 'bold',
          }}
        />
      </ViroNode>

      {/* ===== DISTANCE INDICATOR ===== */}
      <ViroNode position={[0, groundY + 0.5, -2]}>
        <ViroText
          text={`${currentDistance || '--'}m`}
          style={{ 
            fontSize: 32, 
            color: '#FFFFFF', 
<<<<<<< HEAD
=======
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
>>>>>>> ae1c7e32feebd8fc664b00a4e0e447c5eca6d6f4
=======
>>>>>>> 0846c07 (AR feature done)
            textAlign: 'center',
            fontWeight: 'bold',
          }}
        />
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 0846c07 (AR feature done)
      </ViroNode>

      {/* ===== TURN INDICATOR (Large, visible) ===== */}
      {nextTurn && nextTurn.distance < 50 && (
        <ViroNode position={[nextTurn.type.includes('left') ? -0.8 : 0.8, groundY + 1, -1.5]}>
          <ViroText
            text={getTurnIcon(nextTurn.type)}
            scale={[2, 2, 2]}
            style={{ 
              fontSize: 60, 
              color: '#FFD700', 
              textAlign: 'center',
            }}
          />
          <ViroText
            text={`In ${nextTurn.distance}m`}
            position={[0, -0.4, 0]}
            style={{ 
              fontSize: 16, 
              color: '#FFD700', 
              textAlign: 'center',
            }}
          />
        </ViroNode>
      )}

      {/* ===== DESTINATION PIN (When visible) ===== */}
      {destARPos.realDistance < 100 && Math.abs(relativeDirection) < 70 && (
        <ViroNode position={[destARPos.x * 0.3, groundY + 2, destARPos.z * 0.3]}>
          <ViroText
            text="📍"
            scale={[2, 2, 2]}
            style={{ 
              fontSize: 50, 
              textAlign: 'center',
            }}
          />
          <ViroText
            text={building.name}
            position={[0, -0.5, 0]}
            style={{ 
              fontSize: 18, 
              color: '#FFFFFF', 
              textAlign: 'center',
            }}
          />
          <ViroText
            text={`${Math.round(destARPos.realDistance)}m`}
            position={[0, -0.8, 0]}
            style={{ 
              fontSize: 14, 
              color: '#FF6B6B', 
              textAlign: 'center',
            }}
          />
        </ViroNode>
      )}

      {/* ===== TRACKING STATUS ===== */}
      {trackingState === 'TRACKING_LIMITED' && (
        <ViroText
          text="⚠ Limited tracking - Move slowly"
          position={[0, 2, -3]}
          style={{ 
            fontSize: 14, 
            color: '#FFD700', 
            textAlign: 'center',
          }}
        />
<<<<<<< HEAD
=======
        
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
>>>>>>> ae1c7e32feebd8fc664b00a4e0e447c5eca6d6f4
=======
>>>>>>> 0846c07 (AR feature done)
      )}
    </ViroARScene>
  );
};

// ========== Main Component ==========
const ARNavigationScreen = ({ route, navigation }) => {
  const { building, userLocation: initialLocation, nodes, edges, blockages = [] } = route.params;
  
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 0846c07 (AR feature done)
  // Normalize initialLocation to [lng, lat] array format
  const normalizeLocation = (loc) => {
    if (!loc) {
      console.log('[normalizeLocation] Location is null/undefined');
      return null;
    }
    if (Array.isArray(loc) && loc.length === 2) {
      console.log('[normalizeLocation] Already array format:', loc);
      return loc;
    }
    if (loc.longitude !== undefined && loc.latitude !== undefined) {
      console.log('[normalizeLocation] Converting object to array:', [loc.longitude, loc.latitude]);
      return [loc.longitude, loc.latitude];
    }
    if (loc.coords && loc.coords.longitude !== undefined) {
      console.log('[normalizeLocation] Converting coords object:', [loc.coords.longitude, loc.coords.latitude]);
      return [loc.coords.longitude, loc.coords.latitude];
    }
    console.log('[normalizeLocation] Unknown format:', loc);
    return null;
  };
  
  // Log initial params for debugging
  console.log('[ARNavScreen] Route params:', {
    hasBuilding: !!building,
    initialLocation,
    nodesCount: nodes?.length,
    edgesCount: edges?.length,
  });
  
  const [permission, requestPermission] = useCameraPermissions();
  const [userLocation, setUserLocation] = useState(() => normalizeLocation(initialLocation));
  const [locationReady, setLocationReady] = useState(!!normalizeLocation(initialLocation));
<<<<<<< HEAD
=======
  const [permission, requestPermission] = useCameraPermissions();
  const [userLocation, setUserLocation] = useState(initialLocation);
>>>>>>> ae1c7e32feebd8fc664b00a4e0e447c5eca6d6f4
=======
>>>>>>> 0846c07 (AR feature done)
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
<<<<<<< HEAD
<<<<<<< HEAD
  // Always use 3D AR mode
=======
  // Default to HUD mode for stability - 3D AR (ViroReact) can be enabled manually
  const [arMode, setArMode] = useState('hud');
>>>>>>> ae1c7e32feebd8fc664b00a4e0e447c5eca6d6f4
=======
  // Always use 3D AR mode
>>>>>>> 0846c07 (AR feature done)
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

<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 0846c07 (AR feature done)
  // Handle 3D AR mode initialization
  useEffect(() => {
    if (viroAvailable && !viroError) {
      console.log('[AR] Initializing ViroReact 3D AR mode');
    }
  }, [viroError]);
<<<<<<< HEAD
=======
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
>>>>>>> ae1c7e32feebd8fc664b00a4e0e447c5eca6d6f4
=======
>>>>>>> 0846c07 (AR feature done)

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
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 0846c07 (AR feature done)
      console.log('[GPS] Starting location tracking...');
      
      // Get initial position first if we don't have one
      if (!userLocation) {
        try {
          const initialPos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          console.log('[GPS] Got initial position:', initialPos.coords);
          const initialLoc = [initialPos.coords.longitude, initialPos.coords.latitude];
          setUserLocation(initialLoc);
          setLocationReady(true);
        } catch (err) {
          console.error('[GPS] Error getting initial position:', err);
        }
      }
      
<<<<<<< HEAD
=======
>>>>>>> ae1c7e32feebd8fc664b00a4e0e447c5eca6d6f4
=======
>>>>>>> 0846c07 (AR feature done)
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
<<<<<<< HEAD
<<<<<<< HEAD
          if (!locationReady) setLocationReady(true);
=======
>>>>>>> ae1c7e32feebd8fc664b00a4e0e447c5eca6d6f4
=======
          if (!locationReady) setLocationReady(true);
>>>>>>> 0846c07 (AR feature done)
          
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

<<<<<<< HEAD
<<<<<<< HEAD
  // Loading Screen - waiting for permissions
=======
  // Loading Screen
>>>>>>> ae1c7e32feebd8fc664b00a4e0e447c5eca6d6f4
=======
  // Loading Screen - waiting for permissions
>>>>>>> 0846c07 (AR feature done)
  if (!permission) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <Text className="text-white text-lg">Initializing AR...</Text>
      </View>
    );
  }
  
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 0846c07 (AR feature done)
  // Loading Screen - waiting for location
  if (!locationReady || !userLocation) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <MaterialCommunityIcons name="crosshairs-gps" size={50} color="#00E5FF" />
        <Text className="text-white text-lg mt-4">Getting your location...</Text>
        <Text className="text-white/60 text-sm mt-2">Please wait while GPS initializes</Text>
      </View>
    );
  }
  
<<<<<<< HEAD
=======
>>>>>>> ae1c7e32feebd8fc664b00a4e0e447c5eca6d6f4
=======
>>>>>>> 0846c07 (AR feature done)
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
<<<<<<< HEAD
<<<<<<< HEAD
      {/* ViroReact 3D AR Mode */}
      {viroAvailable && !viroError && ViroARSceneNavigator && (
=======
      {/* ViroReact 3D AR Mode - only if ViroReact is available and no error occurred */}
      {arMode === 'viro' && viroAvailable && !viroError && ViroARSceneNavigator && (
>>>>>>> ae1c7e32feebd8fc664b00a4e0e447c5eca6d6f4
=======
      {/* ViroReact 3D AR Mode */}
      {viroAvailable && !viroError && ViroARSceneNavigator && (
>>>>>>> 0846c07 (AR feature done)
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
<<<<<<< HEAD
<<<<<<< HEAD
            pathNodes,
            nextTurn,
=======
>>>>>>> ae1c7e32feebd8fc664b00a4e0e447c5eca6d6f4
=======
            pathNodes,
            nextTurn,
>>>>>>> 0846c07 (AR feature done)
          }}
          style={StyleSheet.absoluteFillObject}
          numberOfTrackedImages={0}
        />
      )}

<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 0846c07 (AR feature done)
      {/* Fallback Camera Mode (only if ViroReact is not available or errored) */}
      {(!viroAvailable || viroError) && (
        <CameraView style={StyleSheet.absoluteFillObject} facing="back" />
      )}

      {/* ===== GOOGLE MAPS LIVE VIEW STYLE UI OVERLAY (Both modes) ===== */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
        {/* Animated Chevron Arrows */}
        <View style={styles.chevronOverlay}>
          <AnimatedChevrons 
            direction={getRelativeDirection()} 
            isVisible={!hasArrived && currentDistance > 10}
          />
        </View>

        {/* Street/Building Name Label */}
        {building && (
          <View style={styles.streetLabel}>
            <Text style={styles.streetLabelText}>{building.name}</Text>
          </View>
        )}

        {/* Distance Badge at bottom center */}
        <View style={styles.bottomInfoContainer}>
          <View style={styles.distanceBadgeLarge}>
            <Text style={styles.distanceValueLarge}>{currentDistance || '--'}m</Text>
          </View>
          
          {/* ETA Badge */}
          {eta && (
            <View style={styles.etaBadgeSmall}>
              <MaterialCommunityIcons name="walk" size={16} color="#FFFFFF" />
              <Text style={styles.etaTextSmall}>{eta}</Text>
            </View>
          )}
        </View>

        {/* Turn Instruction Banner */}
        {nextTurn && nextTurn.distance < 60 && (
          <View style={styles.turnBannerOverlay}>
<<<<<<< HEAD
=======
      {/* Fallback HUD Mode with Camera (also used if Viro is not available or errored) */}
      {(arMode === 'hud' || !viroAvailable || viroError) && (
        <>
          <CameraView style={StyleSheet.absoluteFillObject} facing="back" />

      {/* 2. The HUD Overlay */}
      <SafeAreaView style={styles.hudOverlay} pointerEvents="box-none">
        
        {/* Top: Turn Instruction Banner */}
        {nextTurn && nextTurn.distance < 60 && (
          <View style={styles.turnBanner}>
>>>>>>> ae1c7e32feebd8fc664b00a4e0e447c5eca6d6f4
=======
>>>>>>> 0846c07 (AR feature done)
            <MaterialCommunityIcons 
              name={nextTurn.type === 'left' ? 'arrow-left-top-bold' : 
                    nextTurn.type === 'right' ? 'arrow-right-top-bold' :
                    nextTurn.type === 'slight-left' ? 'arrow-top-left' :
                    nextTurn.type === 'slight-right' ? 'arrow-top-right' : 'arrow-up-bold'} 
<<<<<<< HEAD
<<<<<<< HEAD
              size={36} 
=======
              size={44} 
>>>>>>> ae1c7e32feebd8fc664b00a4e0e447c5eca6d6f4
=======
              size={36} 
>>>>>>> 0846c07 (AR feature done)
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
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 0846c07 (AR feature done)
      </View>

      {/* Ground Path Dots (fallback mode only) */}
      {(!viroAvailable || viroError) && (
        <View style={styles.pathDotsContainer}>
          {pathNodes.slice(0, 6).map((node, index) => {
            if (!userLocation) return null;
            const dist = getDistance(userLocation[1], userLocation[0], node.lat, node.lng);
            if (dist > 25 || dist < 2) return null;
            
            const bearing = getBearing(userLocation[1], userLocation[0], node.lat, node.lng);
            let relAngle = bearing - heading;
            if (relAngle > 180) relAngle -= 360;
            if (relAngle < -180) relAngle += 360;
            
            if (Math.abs(relAngle) > 60) return null;
            
            const horizontalOffset = (relAngle / 60) * (SCREEN_WIDTH / 2);
            const verticalOffset = 200 + (dist * 8);
            const dotSize = Math.max(8, 20 - dist * 0.5);
            const opacity = Math.max(0.3, 1 - dist / 30);
            
            return (
              <View 
                key={`dot-${index}`}
                style={[
                  styles.pathDot,
                  {
                    left: SCREEN_WIDTH / 2 + horizontalOffset - dotSize / 2,
                    bottom: verticalOffset,
                    width: dotSize,
                    height: dotSize,
                    borderRadius: dotSize / 2,
                    opacity,
                    backgroundColor: index === 0 ? '#00E5FF' : '#4FC3F7',
                  }
                ]}
              />
            );
          })}
        </View>
      )}

      {/* Top Left: Compass HUD */}
<<<<<<< HEAD
=======

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
>>>>>>> ae1c7e32feebd8fc664b00a4e0e447c5eca6d6f4
=======
>>>>>>> 0846c07 (AR feature done)
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
<<<<<<< HEAD
<<<<<<< HEAD
=======
        </>
      )}
>>>>>>> ae1c7e32feebd8fc664b00a4e0e447c5eca6d6f4
=======
>>>>>>> 0846c07 (AR feature done)

      {/* ========== Shared UI Elements (both modes) ========== */}

      {/* Top Right: Stop Button */}
      <TouchableOpacity style={styles.stopButton} onPress={() => navigation.goBack()}>
        <MaterialCommunityIcons name="close" size={22} color="#FFFFFF" />
        <Text style={styles.stopButtonText}>Stop</Text>
      </TouchableOpacity>

      {/* AR Live Badge */}
      <View style={styles.arBadge}>
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 0846c07 (AR feature done)
        <View style={[styles.arDot, viroAvailable && !viroError && styles.arDot3D]} />
        <Text style={styles.arBadgeText}>{viroAvailable && !viroError ? '3D AR' : 'AR'}</Text>
      </View>

<<<<<<< HEAD
=======
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

>>>>>>> ae1c7e32feebd8fc664b00a4e0e447c5eca6d6f4
=======
>>>>>>> 0846c07 (AR feature done)
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
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 0846c07 (AR feature done)
        {userLocation ? (
          <MapboxGL.MapView 
            style={styles.map} 
            styleURL="mapbox://styles/mapbox/streets-v12"
            logoEnabled={false} 
            compassEnabled={false}
            attributionEnabled={false}
            scaleBarEnabled={false}
            onDidFinishLoadingMap={() => console.log('[Mapbox] AR Map loaded successfully')}
            onMapLoadingError={(e) => console.error('[Mapbox] AR Map loading error:', e)}
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
        ) : (
          <View style={[styles.map, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e' }]}>
            <MaterialCommunityIcons name="map-marker-question" size={30} color="#666" />
            <Text style={{ color: '#666', marginTop: 8 }}>Waiting for location...</Text>
          </View>
        )}
<<<<<<< HEAD
=======
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
>>>>>>> ae1c7e32feebd8fc664b00a4e0e447c5eca6d6f4
=======
>>>>>>> 0846c07 (AR feature done)
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
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 0846c07 (AR feature done)
  turnBannerOverlay: {
    position: 'absolute',
    top: 120,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(66, 133, 244, 0.6)',
  },
<<<<<<< HEAD
=======
>>>>>>> ae1c7e32feebd8fc664b00a4e0e447c5eca6d6f4
=======
>>>>>>> 0846c07 (AR feature done)
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
  
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 0846c07 (AR feature done)
  // Path Dots Container (Ground-level AR visualization)
  pathDotsContainer: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'none',
  },
  pathDot: {
    position: 'absolute',
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 5,
  },
  
  // ===== GOOGLE MAPS LIVE VIEW STYLE CHEVRONS =====
  chevronOverlay: {
    position: 'absolute',
    bottom: 280,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    height: 300,
    pointerEvents: 'none',
  },
  chevronsContainer: {
    width: 120,
    height: 280,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  chevronArrow: {
    width: 80,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronLine: {
    position: 'absolute',
    width: 40,
    height: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    shadowColor: '#4285F4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 10,
  },
  chevronLineLeft: {
    transform: [{ rotate: '-45deg' }, { translateX: -14 }],
  },
  chevronLineRight: {
    transform: [{ rotate: '45deg' }, { translateX: 14 }],
  },
  
  // Street/Building Label (Like Google Maps Live View)
  streetLabel: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.35,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  streetLabelText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 8,
    letterSpacing: 1,
  },
  
  // Bottom Info Container
  bottomInfoContainer: {
    position: 'absolute',
    bottom: 240,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  distanceBadgeLarge: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  distanceValueLarge: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  etaBadgeSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(66, 133, 244, 0.9)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 10,
  },
  etaTextSmall: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  
  // Arrow Container (Bottom Center) - OLD, keeping for reference
<<<<<<< HEAD
=======
  // Arrow Container (Bottom Center)
>>>>>>> ae1c7e32feebd8fc664b00a4e0e447c5eca6d6f4
=======
>>>>>>> 0846c07 (AR feature done)
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
<<<<<<< HEAD
<<<<<<< HEAD
    minHeight: 150,
=======
>>>>>>> ae1c7e32feebd8fc664b00a4e0e447c5eca6d6f4
=======
    minHeight: 150,
>>>>>>> 0846c07 (AR feature done)
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
