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
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { Magnetometer, Accelerometer } from 'expo-sensors';
import MapboxGL from '@rnmapbox/maps';
import { MaterialCommunityIcons, FontAwesome5, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { MAPBOX_ACCESS_TOKEN } from '../config/mapbox';
import { useSettings } from '../context/SettingsContext';

// Import shared pathfinding utilities
import {
  findPath,
  pathToGeoJSON,
  getDistance,
  getBearing,
  isPointInPolygon,
  isEdgeBlocked,
  detectTurn as detectTurnUtil,
  calculateETA as calculateETAUtil,
  getDistanceFromPath,
  trimPathBehindUser
} from '../lib/pathfinding';

// Import filter utilities
import { GPSKalmanFilter, CompassFilter, PitchFilter } from '../lib/filters';

// Import supabase for realtime blockage subscription
import { subscribeToTable } from '../supabase';

// Mapbox is initialized in App.js

// ViroReact imports - wrapped in try/catch to prevent crash if not available
let ViroARScene, ViroARSceneNavigator, ViroText, ViroNode, ViroAmbientLight, Viro3DObject, ViroMaterials, ViroAnimations, ViroBox, ViroFlexView, ViroARPlane, ViroARPlaneSelector, ViroQuad, ViroPolyline, ViroARTrackingTargets, ViroARImageMarker;
let viroAvailable = false;

try {
  const viro = require('@reactvision/react-viro');
  ViroARScene = viro.ViroARScene;
  ViroARSceneNavigator = viro.ViroARSceneNavigator;
  ViroText = viro.ViroText;
  ViroNode = viro.ViroNode;
  ViroAmbientLight = viro.ViroAmbientLight;
  Viro3DObject = viro.Viro3DObject;
  ViroMaterials = viro.ViroMaterials;
  ViroAnimations = viro.ViroAnimations;
  ViroBox = viro.ViroBox;
  ViroFlexView = viro.ViroFlexView;
  ViroARPlane = viro.ViroARPlane;
  ViroARPlaneSelector = viro.ViroARPlaneSelector;
  ViroQuad = viro.ViroQuad;
  ViroPolyline = viro.ViroPolyline;
  ViroARTrackingTargets = viro.ViroARTrackingTargets;
  ViroARImageMarker = viro.ViroARImageMarker;
  viroAvailable = true;
  console.log('[ViroReact] Successfully loaded AR components');
  
  // Register materials for 3D objects
  ViroMaterials.createMaterials({
    chevronBlue: {
      diffuseColor: '#4285F4',
      lightingModel: 'Constant',
    },
    chevronWhite: {
      diffuseColor: '#FFFFFF',
      lightingModel: 'Constant',
    },
    chevronGlow: {
      diffuseColor: '#00E5FF',
      lightingModel: 'Constant',
      bloomThreshold: 0.2,
    },
    destinationRed: {
      diffuseColor: '#FF4444',
      lightingModel: 'Blinn',
    },
    turnArrowGold: {
      diffuseColor: '#FFD700',
      lightingModel: 'Constant',
    },
    buildingCardBg: {
      diffuseColor: 'rgba(0,0,0,0.75)',
      lightingModel: 'Constant',
    },
  });
  
  // Register animations for AR elements
  ViroAnimations.registerAnimations({
    // Chevron pulse animation
    chevronFadeIn: {
      properties: { opacity: 1, scaleX: 1.0, scaleY: 1.0, scaleZ: 1.0 },
      duration: 300,
      easing: 'EaseOut',
    },
    chevronFadeOut: {
      properties: { opacity: 0, scaleX: 1.1, scaleY: 1.1, scaleZ: 1.1 },
      duration: 400,
      easing: 'EaseIn',
    },
    chevronPulse: [
      ['chevronFadeIn', 'chevronFadeOut'],
    ],
    // Destination pin bounce
    pinBounceUp: {
      properties: { positionY: 0.15 },
      duration: 500,
      easing: 'EaseOut',
    },
    pinBounceDown: {
      properties: { positionY: 0 },
      duration: 500,
      easing: 'EaseIn',
    },
    pinBounce: [
      ['pinBounceUp', 'pinBounceDown'],
    ],
    // Turn arrow pulse
    turnPulse: {
      properties: { scaleX: 1.2, scaleY: 1.2, scaleZ: 1.2 },
      duration: 400,
      easing: 'EaseInEaseOut',
    },
    turnPulseBack: {
      properties: { scaleX: 1.0, scaleY: 1.0, scaleZ: 1.0 },
      duration: 400,
      easing: 'EaseInEaseOut',
    },
    turnArrowPulse: [
      ['turnPulse', 'turnPulseBack'],
    ],
  });
  
} catch (e) {
  console.warn('ViroReact not available:', e.message);
}

// 3D Model asset paths (check if files exist)
let AR_ASSETS = {
  chevron: null,
  destinationPin: null,
  pathDot: null,
  turnArrow: null,
};

// Try to load 3D assets (will fail gracefully if not present)
try {
  AR_ASSETS.chevron = require('../../assets/3d/arrow_chevron.glb');
  console.log('[AR Assets] Loaded chevron:', AR_ASSETS.chevron);
} catch (e) { console.log('[AR Assets] chevron not found:', e.message); }
try {
  AR_ASSETS.destinationPin = require('../../assets/3d/destination_pin.glb');
  console.log('[AR Assets] Loaded destination pin:', AR_ASSETS.destinationPin);
} catch (e) { console.log('[AR Assets] destination_pin not found:', e.message); }
try {
  AR_ASSETS.pathDot = require('../../assets/3d/path_dot.glb');
  console.log('[AR Assets] Loaded path dot:', AR_ASSETS.pathDot);
} catch (e) { console.log('[AR Assets] path_dot not found:', e.message); }
try {
  AR_ASSETS.turnArrow = require('../../assets/3d/turn_arrow.glb');
  console.log('[AR Assets] Loaded turn arrow:', AR_ASSETS.turnArrow);
} catch (e) { console.log('[AR Assets] turn_arrow not found:', e.message); }

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAP_FIXED_HEIGHT = SCREEN_HEIGHT * 0.40;
const MAP_MIN_HEIGHT = SCREEN_HEIGHT * 0.40;
const MAP_HALF_HEIGHT = SCREEN_HEIGHT * 0.45;
const MAP_MAX_HEIGHT = SCREEN_HEIGHT * 0.90;
const CAMERA_FOV = 70;

// Session-level flag to track if user dismissed the AR guide (resets on app restart)
let hasUserDismissedGuideThisSession = false;

// Pitch thresholds for auto map toggle (phone tilt)
const PITCH_EXPAND_THRESHOLD = -45; // Phone tilted down - expand map
const PITCH_COLLAPSE_THRESHOLD = -20; // Phone upright - collapse map
const PITCH_DEBOUNCE_MS = 300; // Debounce pitch changes

// Pre-rotate distance for turns (walking pace = ~1.2m/s, so 12m = ~10 seconds warning)
const PRE_ROTATE_DISTANCE_M = 12;

// Re-routing thresholds (aggressive for walking)
const OFF_PATH_THRESHOLD_METERS = 12; // Trigger reroute if user is 12m+ from path
const REROUTE_DEBOUNCE_MS = 3000;     // Wait 3 seconds between reroutes
const PATH_CLEAR_THRESHOLD_METERS = 8; // Clear path segment when user is within 8m

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

// Filter classes are now imported from '../lib/filters.js'
// GPSKalmanFilter, CompassFilter, PitchFilter

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

// Convert GPS coordinates to AR world position (relative to user, real-world meters)
const gpsToUserRelativeAR = (targetLat, targetLon, userLat, userLon, heading) => {
  const distance = getDistance(userLat, userLon, targetLat, targetLon);
  const bearing = getBearing(userLat, userLon, targetLat, targetLon);

  // Convert bearing relative to user's current heading
  const relativeBearing = (bearing - heading) * Math.PI / 180;

  // Real-world meters, cap at 80m for rendering range
  const cappedDistance = Math.min(distance, 80);
  const x = Math.sin(relativeBearing) * cappedDistance;
  const z = -Math.cos(relativeBearing) * cappedDistance; // Negative Z is forward

  return { x, y: 0, z, realDistance: distance };
};

// Path visualization removed - using 3D waypoint arrows only

// ========== Enhanced ViroReact AR Scene Component (Google Maps Live View Style) ==========
const ARNavigationScene = (props) => {
  const { arSceneNavigator } = props;
  const viroProps = arSceneNavigator.viroAppProps || {};
  
  const [sceneReady, setSceneReady] = React.useState(false);
  const [trackingState, setTrackingState] = React.useState('TRACKING_UNAVAILABLE');
  const [trackingReason, setTrackingReason] = React.useState(null); // INSUFFICIENT_FEATURES, EXCESSIVE_MOTION, INSUFFICIENT_LIGHT, etc.
  const [surfaceFound, setSurfaceFound] = React.useState(false);
  const [groundY, setGroundY] = React.useState(-1.0); // Default ground level
  const [buildingTargetRegistered, setBuildingTargetRegistered] = React.useState(false);
  const [buildingRecognized, setBuildingRecognized] = React.useState(false);
  const buildingTargetKeyRef = React.useRef(null);
  const targetRegistrationAttempted = React.useRef(false);

  const [arData, setArData] = React.useState({
    building: null,
    userLocation: null,
    heading: 0,
    currentDistance: null,
    nextWaypoint: null,
    relativeDirection: 0,
    pathNodes: [],
    nextTurn: null,
    isEmergency: false,
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
      setArData({
        building: viroProps.building,
        userLocation: viroProps.userLocation,
        heading: viroProps.heading || 0,
        currentDistance: viroProps.currentDistance || 0,
        nextWaypoint: viroProps.nextWaypoint,
        relativeDirection: viroProps.relativeDirection || 0,
        pathNodes: viroProps.pathNodes || [],
        nextTurn: viroProps.nextTurn,
        isEmergency: viroProps.isEmergency || false,
      });

      if (!sceneReady) setSceneReady(true);

      // Register building image as AR tracking target (once only — ref guard prevents re-entry)
      if (
        !targetRegistrationAttempted.current &&
        ViroARTrackingTargets &&
        viroProps.building?.images?.length > 0 &&
        viroProps.building?.id
      ) {
        targetRegistrationAttempted.current = true;
        const targetKey = 'building_' + viroProps.building.id;
        try {
          ViroARTrackingTargets.createTargets({
            [targetKey]: {
              source: { uri: viroProps.building.images[0] },
              orientation: 'Up',
              physicalWidth: 10, // estimated facade width in meters
            },
          });
          buildingTargetKeyRef.current = targetKey;
          setBuildingTargetRegistered(true);
          console.log('[ViroAR] Registered building image target:', targetKey, viroProps.building.images[0]);
        } catch (e) {
          console.warn('[ViroAR] Failed to register building image target:', e);
          targetRegistrationAttempted.current = false; // allow retry on failure
        }
      }
    }
  }, [viroProps]);

  const { building, userLocation, heading, currentDistance, nextWaypoint, relativeDirection, pathNodes, nextTurn, isEmergency } = arData;

  const onInitialized = (state, reason) => {
    console.log('[ViroAR] Tracking state:', state, reason);
    setTrackingState(state);
    setTrackingReason(reason || null);
  };

  // Track AR camera transform for ground level estimation
  const cameraTransformRef = React.useRef(null);
  const onCameraTransformUpdate = (transform) => {
    cameraTransformRef.current = transform.cameraTransform;
    // Estimate ground level from camera height when no plane detected yet
    if (!surfaceFound && transform.cameraTransform?.position) {
      setGroundY(transform.cameraTransform.position[1] - 1.5);
    }
  };

  // Handle anchor found (surface detected)
  const onAnchorFound = (anchor) => {
    console.log('[ViroAR] Surface detected:', anchor);
    if (anchor.type === 'plane' && anchor.alignment === 'horizontal') {
      setSurfaceFound(true);
      setTrackingState('TRACKING_NORMAL');  // Surface found = we're tracking
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

  // Loading state - wait for data silently
  if (!sceneReady || !userLocation || !building) {
    return (
      <ViroARScene onTrackingUpdated={onInitialized} onAnchorFound={onAnchorFound} anchorDetectionTypes={['PlanesHorizontal']}>
        <ViroAmbientLight color="#ffffff" intensity={300} />
      </ViroARScene>
    );
  }

  // Crash-proof: validate critical data
  if (!userLocation || !userLocation[0] || !userLocation[1]) {
    console.warn('[ViroAR] Invalid userLocation:', userLocation);
    return null;
  }

  // Per-node direction arrows - placed at each path node, pointing to the next node
  // Shows next 2 arrows ahead of user (progressive reveal)
  // Arrows are hidden when user is very close to avoid clutter
  const renderNodeArrows = () => {
    // Validate requirements
    if (!AR_ASSETS.chevron || !pathNodes || pathNodes.length < 1 || !userLocation) {
      return null;
    }
    
    // Find user's closest node index to determine which arrows to show
    let closestIdx = 0;
    let minDist = Infinity;
    for (let i = 0; i < pathNodes.length; i++) {
      const d = getDistance(userLocation[1], userLocation[0], pathNodes[i].lat, pathNodes[i].lng);
      if (d < minDist) {
        minDist = d;
        closestIdx = i;
      }
    }
    
    // Show 4 arrows ahead of user (progressive reveal)
    const arrowCount = 4;
    const startIdx = Math.min(closestIdx + 1, pathNodes.length - 1);
    const endIdx = Math.min(startIdx + arrowCount, pathNodes.length);
    
    // Emergency mode uses larger arrows for visibility (2x base scale)
    const baseScale = isEmergency ? 0.7 : 0.5;
    
    const arrows = [];
    
    for (let i = startIdx; i < endIdx; i++) {
      const node = pathNodes[i];
      const isLastNode = (i === pathNodes.length - 1);
      
      // Calculate position for this node in AR space (relative to user)
      const nodeARPos = gpsToUserRelativeAR(node.lat, node.lng, userLocation[1], userLocation[0], heading);
      
      // Skip if too far away (more than 50m real distance from user)
      if (nodeARPos.realDistance > 50) continue;
      
      // Hide arrow when user is very close (less than 3m) to avoid clutter
      if (nodeARPos.realDistance < 3) continue;
      
      // Calculate bearing to the NEXT node (or destination if this is the last node)
      let targetLat, targetLng;
      if (!isLastNode) {
        // Point to next node
        targetLat = pathNodes[i + 1].lat;
        targetLng = pathNodes[i + 1].lng;
      } else {
        // Last node - point to destination
        targetLat = building.latitude;
        targetLng = building.longitude;
      }
      
      // Calculate arrow rotation to point toward target
      const bearingToTarget = getBearing(node.lat, node.lng, targetLat, targetLng);
      // Arrow Y-rotation: relative to user's current heading
      const arrowYRotation = bearingToTarget - heading;
      
      // Position arrow floating just above ground level at the node location
      const arrowPosition = [nodeARPos.x, groundY + 0.3, nodeARPos.z];
      // Rotation: flat forward, Y rotation for bearing
      const arrowRotation = [0, arrowYRotation, 0];
      const arrowScale = [baseScale, baseScale, baseScale];
      
      // Opacity based on distance (closer = more visible)
      const opacity = Math.max(0.4, 1 - (nodeARPos.realDistance / 50));
      
      // Skip last node — renderDestinationPin handles the building pin separately
      if (isLastNode) continue;
      
      arrows.push(
        <ViroNode key={`node-arrow-${i}`} position={arrowPosition}>
          <Viro3DObject
            source={AR_ASSETS.chevron}
            type="GLB"
            rotation={arrowRotation}
            scale={arrowScale}
            materials={isEmergency ? ['destinationRed'] : ['chevronBlue']}
            opacity={opacity}
          />
          {/* Show distance to this node */}
          <ViroText
            text={`${Math.round(nodeARPos.realDistance)}m`}
            position={[0, 0.8, 0]}
            style={{ fontSize: 12, color: isEmergency ? '#FF6B6B' : '#00E5FF', textAlign: 'center' }}
          />
        </ViroNode>
      );
    }
    
    return arrows;
  };

  // Render destination pin at exact GPS location - 3D only, crash-proof
  const renderDestinationPin = () => {
    // Crash-proofing: validate building and asset
    if (!building || !AR_ASSETS.destinationPin) {
      console.warn('[AR] Destination pin: building or asset missing');
      return null;
    }
    
    // Calculate position relative to user
    const destARPos = gpsToUserRelativeAR(building.latitude, building.longitude, userLocation[1], userLocation[0], heading);
    
    // Only show when within range
    if (destARPos.realDistance >= 100) return null;
    
    // Position at exact GPS location (elevated above ground)
    const pinPosition = [destARPos.x, groundY + 3, destARPos.z];
    
    // Label: show "Safe Zone: name" for evacuation zones, otherwise building name
    const pinLabel = building.isEvacuationZone ? `Safe Zone: ${building.name}` : building.name;
    
    return (
      <ViroNode position={pinPosition}>
        <Viro3DObject
          source={AR_ASSETS.destinationPin}
          type="GLB"
          scale={[1.0, 1.0, 1.0]}
          materials={['destinationRed']}
          onLoadStart={() => console.log('[AR] Destination pin loading...')}
          onLoadEnd={() => console.log('[AR] Destination pin loaded!')}
          onError={(event) => console.log('[AR] Destination pin error:', event.nativeEvent)}
        />
        <ViroText
          text={pinLabel}
          position={[0, 1.5, 0]}
          style={{ fontSize: 18, color: '#FFFFFF', textAlign: 'center' }}
        />
        <ViroText
          text={`${Math.round(destARPos.realDistance)}m`}
          position={[0, 1.0, 0]}
          style={{ fontSize: 14, color: '#FF6B6B', textAlign: 'center' }}
        />
      </ViroNode>
    );
  };

  // Render turn indicator at actual GPS turn location - 3D only, crash-proof
  const renderTurnIndicator = () => {
    // Crash-proofing: validate turn, asset, and turn node
    if (!nextTurn || nextTurn.distance >= 50 || !AR_ASSETS.turnArrow || !nextTurn.node) {
      return null;
    }

    // Convert turn node GPS to user-relative AR position
    const turnARPos = gpsToUserRelativeAR(
      nextTurn.node.lat, nextTurn.node.lng,
      userLocation[1], userLocation[0],
      heading
    );

    // Skip if too far or too close (user is already at the turn)
    if (turnARPos.realDistance > 50 || turnARPos.realDistance < 2) return null;

    const isLeft = nextTurn.type.includes('left');

    // Position at actual GPS-converted location, above ground
    const turnPosition = [turnARPos.x, groundY + 1.0, turnARPos.z];

    // Rotation: point the turn arrow based on bearing from user to turn node
    const bearingToTurn = getBearing(userLocation[1], userLocation[0], nextTurn.node.lat, nextTurn.node.lng);
    const baseYRotation = bearingToTurn - heading;
    const turnYRotation = isLeft ? baseYRotation + 90 : baseYRotation - 90;
    const turnRotation = [0, turnYRotation, 0];

    return (
      <ViroNode position={turnPosition}>
        <Viro3DObject
          source={AR_ASSETS.turnArrow}
          type="GLB"
          rotation={turnRotation}
          scale={[1.0, 1.0, 1.0]}
          materials={['turnArrowGold']}
          animation={{
            name: 'turnArrowPulse',
            run: true,
            loop: true,
          }}
        />
        <ViroText
          text={`${isLeft ? 'Turn Left' : 'Turn Right'} in ${nextTurn.distance}m`}
          position={[0, 1.2, 0]}
          style={{ fontSize: 14, color: '#FFD700', textAlign: 'center' }}
        />
      </ViroNode>
    );
  };

  return (
    <ViroARScene
      onTrackingUpdated={onInitialized}
      onAnchorFound={onAnchorFound}
      onAnchorUpdated={onAnchorUpdated}
      anchorDetectionTypes={['PlanesHorizontal']}
      onCameraTransformUpdate={onCameraTransformUpdate}
    >
      {/* Lighting */}
      <ViroAmbientLight color="#ffffff" intensity={500} />

      {/* ===== NODE ARROWS (placed at each path node, pointing to next) ===== */}
      {renderNodeArrows()}

      {/* ===== DESTINATION PIN ===== */}
      {renderDestinationPin()}

      {/* ===== TURN INDICATOR ===== */}
      {renderTurnIndicator()}

      {/* ===== BUILDING IMAGE MARKER CARD ===== */}
      {buildingTargetRegistered && ViroARImageMarker && buildingTargetKeyRef.current && (
        <ViroARImageMarker
          target={buildingTargetKeyRef.current}
          onAnchorFound={() => {
            console.log('[ViroAR] Building image recognized!');
            setBuildingRecognized(true);
          }}
          onAnchorRemoved={() => {
            console.log('[ViroAR] Building image lost');
            setBuildingRecognized(false);
          }}
        >
          <ViroNode position={[0, 0.6, 0]} transformBehaviors={['billboard']}>
            {/* Building name */}
            <ViroText
              text={building?.name || 'Building'}
              style={{
                fontFamily: 'Inter_500Medium',
                fontSize: 24,
                color: '#FFFFFF',
                fontWeight: 'bold',
                textAlign: 'center',
              }}
              width={3.0}
              height={0.5}
              position={[0, 0.45, 0]}
              outerStroke={{ type: 'Outline', width: 2, color: '#000000' }}
            />
            {/* Description */}
            {building?.description ? (
              <ViroText
                text={building.description.length > 60 ? building.description.substring(0, 60) + '...' : building.description}
                style={{
                  fontFamily: 'Inter_400Regular',
                  fontSize: 14,
                  color: '#CCCCCC',
                  textAlign: 'center',
                }}
                width={3.0}
                height={0.4}
                position={[0, 0.05, 0]}
                outerStroke={{ type: 'Outline', width: 1, color: '#000000' }}
              />
            ) : null}
            {/* Rooms count */}
            {building?.rooms && building.rooms.length > 0 ? (
              <ViroText
                text={`${building.rooms.length} room${building.rooms.length !== 1 ? 's' : ''}`}
                style={{
                  fontFamily: 'Inter_400Regular',
                  fontSize: 16,
                  color: '#00E5FF',
                  textAlign: 'center',
                }}
                width={3.0}
                height={0.35}
                position={[0, -0.3, 0]}
                outerStroke={{ type: 'Outline', width: 1, color: '#000000' }}
              />
            ) : null}
          </ViroNode>
        </ViroARImageMarker>
      )}

      {/* ===== TRACKING STATUS OVERLAY (with specific guidance) ===== */}
      {trackingState !== 'TRACKING_NORMAL' && (() => {
        // Determine guidance based on tracking state and reason
        let message = '';
        let subMessage = '';
        let color = '#FFD700'; // Default warning yellow
        
        if (trackingState === 'TRACKING_UNAVAILABLE') {
          message = 'Initializing AR...';
          subMessage = 'Point camera at the ground';
          color = '#FF9800';
        } else if (trackingState === 'TRACKING_LIMITED') {
          switch (trackingReason) {
            case 'INSUFFICIENT_FEATURES':
              message = 'Not enough visual detail';
              subMessage = 'Point at textured surfaces';
              break;
            case 'EXCESSIVE_MOTION':
              message = 'Moving too fast';
              subMessage = 'Slow down and hold steady';
              break;
            case 'INSUFFICIENT_LIGHT':
              message = 'Too dark';
              subMessage = 'Move to a brighter area';
              break;
            case 'RELOCALIZING':
              message = 'Relocating...';
              subMessage = 'Look around slowly';
              break;
            default:
              message = 'Limited tracking';
              subMessage = 'Move phone slowly';
          }
        }
        
        return (
          <ViroNode position={[0, 1.8, -2.5]}>
            <ViroText
              text={message}
              style={{ fontSize: 16, color: color, textAlign: 'center', fontWeight: 'bold' }}
              position={[0, 0.2, 0]}
            />
            <ViroText
              text={subMessage}
              style={{ fontSize: 12, color: '#FFFFFF', textAlign: 'center' }}
              position={[0, -0.1, 0]}
            />
          </ViroNode>
        );
      })()}
    </ViroARScene>
  );
};

// ========== Main Component ==========
const ARNavigationScreen = ({ route, navigation }) => {
  const { mapStyle, colors } = useSettings();
  // Support both 'building' and 'destination' param names (for emergency evacuation)
  const { building: buildingParam, destination, userLocation: initialLocation, nodes, edges, blockages = [], isEmergency = false } = route.params;
  const building = buildingParam || destination;
  
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
  const [heading, setHeading] = useState(0); // AR heading (from magnetometer)
  const [mapHeading, setMapHeading] = useState(0); // Map heading (bearing to next waypoint)
  const [pitch, setPitch] = useState(0);
  const [navigationPath, setNavigationPath] = useState(null);
  const [userConnectorLine, setUserConnectorLine] = useState(null);  // Dotted line from user to first node
  const [pathNodes, setPathNodes] = useState([]);
  const [currentDistance, setCurrentDistance] = useState(null);
  const [nextWaypoint, setNextWaypoint] = useState(null);
  const [nextTurn, setNextTurn] = useState(null);
  const [hasArrived, setHasArrived] = useState(false);
  const [mapHeight] = useState(new Animated.Value(MAP_MIN_HEIGHT));
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [mapSnapState, setMapSnapState] = useState('collapsed'); // 'collapsed' | 'half' | 'full'
  const [destPosition, setDestPosition] = useState(null);
  const [eta, setEta] = useState(null);
  // Always use 3D AR mode
  const [viroError, setViroError] = useState(false);
  // Re-routing state
  const [isRerouting, setIsRerouting] = useState(false);
  const [clearedPathIndex, setClearedPathIndex] = useState(0);
  const [fullPathNodes, setFullPathNodes] = useState([]); // Store full path for reference
  const [fullPathGeoJSON, setFullPathGeoJSON] = useState(null); // Store full original path GeoJSON for gray trail
  // Recalculate spin animation
  const recalcSpinValue = useRef(new Animated.Value(0)).current;
  // Live blockages from realtime subscription (for mid-navigation updates)
  const [liveBlockages, setLiveBlockages] = useState(blockages);
  // Error state for surfacing GPS/AR errors to user
  const [locationError, setLocationError] = useState(null);
  // Path error state for when no path can be found
  const [pathError, setPathError] = useState(null);
  // Reroute toast message
  const [rerouteMessage, setRerouteMessage] = useState(null);
  // AR Navigation Guide screen state
  const [showARGuide, setShowARGuide] = useState(!hasUserDismissedGuideThisSession);
  const [doNotShowAgain, setDoNotShowAgain] = useState(false);
  
  const isMountedRef = useRef(true);
  const celebrationAnim = useRef(new Animated.Value(0)).current;
  const viroPropsRef = useRef({}); // Store Viro props in ref to avoid re-renders
  
  const gpsFilterRef = useRef(new GPSKalmanFilter());
  const compassFilterRef = useRef(new CompassFilter(0.08));
  const stableHeadingRef = useRef(0);
  const HEADING_DEADBAND_DEG = 2.5;
  const latestAccelRef = useRef({ x: 0, y: 0, z: -1 }); // Latest accelerometer for tilt-compensated heading
  
  // Map heading smoothing (lerp toward target bearing)
  const targetMapHeadingRef = useRef(0);
  const mapHeadingAnimRef = useRef(new Animated.Value(0)).current;
  
  // Pitch-based map toggle refs
  const lastPitchTriggerRef = useRef(0);
  const pitchHoldTimerRef = useRef(null);
  
  // Emergency pulsing animation
  const emergencyPulseAnim = useRef(new Animated.Value(1)).current;
  
  // Snap user location to nearest point on path (for map display - Google Live View style)
  const getSnappedLocation = useCallback(() => {
    if (!userLocation || !pathNodes || pathNodes.length < 2) return userLocation;
    
    let minDist = Infinity;
    let snappedPoint = userLocation;
    
    // Check each segment of the path
    for (let i = 0; i < pathNodes.length - 1; i++) {
      const p1 = { lng: pathNodes[i].lng, lat: pathNodes[i].lat };
      const p2 = { lng: pathNodes[i + 1].lng, lat: pathNodes[i + 1].lat };
      
      // Project point onto line segment
      const userLng = userLocation[0];
      const userLat = userLocation[1];
      
      // Vector from p1 to p2
      const dx = p2.lng - p1.lng;
      const dy = p2.lat - p1.lat;
      const lenSq = dx * dx + dy * dy;
      
      if (lenSq === 0) continue; // p1 and p2 are the same point
      
      // Parameter t for projection onto line (clamped to [0,1] for segment)
      let t = ((userLng - p1.lng) * dx + (userLat - p1.lat) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
      
      // Projected point
      const projLng = p1.lng + t * dx;
      const projLat = p1.lat + t * dy;
      
      // Distance from user to projected point
      const dist = getDistance(userLat, userLng, projLat, projLng);
      
      if (dist < minDist) {
        minDist = dist;
        snappedPoint = [projLng, projLat];
      }
    }
    
    // Only snap if within 20m of path, otherwise use raw location
    return minDist < 20 ? snappedPoint : userLocation;
  }, [userLocation, pathNodes]);
  const pitchFilterRef = useRef(new PitchFilter(0.15));
  const lastHapticRef = useRef(0);
  const lastRerouteRef = useRef(0); // Debounce rerouting
  
  // Refs for async subscriptions - allows cleanup even when assigned after mount
  const locationSubRef = useRef(null);
  const magnetometerSubRef = useRef(null);
  const accelerometerSubRef = useRef(null);
  const rerouteTimeoutRef = useRef(null);
  
  useEffect(() => {
    isMountedRef.current = true;
    return () => { 
      isMountedRef.current = false;
      gpsFilterRef.current.reset();
      compassFilterRef.current.reset();
      pitchFilterRef.current.reset();
    };
  }, []);

  // Handle 3D AR mode initialization
  useEffect(() => {
    if (viroAvailable && !viroError) {
      console.log('[AR] Initializing ViroReact 3D AR mode');
    }
  }, [viroError]);

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
    const startTracking = async () => {
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
          setLocationError('Unable to get your location. Please check GPS permissions and try again.');
        }
      }
      
      locationSubRef.current = await Location.watchPositionAsync(
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
          if (!locationReady) setLocationReady(true);
          
          const dist = getDistance(filtered.lat, filtered.lng, building.latitude, building.longitude);
          setCurrentDistance(Math.round(dist));
          
          // Calculate ETA using shared utility
          setEta(calculateETAUtil(dist));
          
          if (dist < 15) handleArrived();
          
          // Check if user is off path and trigger reroute
          checkAndReroute(newLoc);
          
          // Progressive path clearing (Waze-style)
          updatePathClearing(newLoc);
          
          updateNextWaypoint(newLoc);
        }
      );
      
      // Start accelerometer first so tilt data is available for heading computation
      Accelerometer.setUpdateInterval(100);
      accelerometerSubRef.current = Accelerometer.addListener((data) => {
        if (!isMountedRef.current) return;
        // Store latest accel for tilt-compensated heading
        latestAccelRef.current = data;
        // Compute pitch for map toggle
        const rawPitch = Math.atan2(-data.x, Math.sqrt(data.y ** 2 + data.z ** 2)) * (180 / Math.PI);
        const smoothedPitch = pitchFilterRef.current.filter(rawPitch);
        setPitch(smoothedPitch);
      });

      // Tilt-compensated magnetometer heading
      // Same approach as Android's SensorManager.getRotationMatrix() + getOrientation()
      Magnetometer.setUpdateInterval(120);
      magnetometerSubRef.current = Magnetometer.addListener((magData) => {
        if (!isMountedRef.current) return;
        const accel = latestAccelRef.current;

        // Gravity vector (from accelerometer)
        const ax = accel.x, ay = accel.y, az = accel.z;
        // Magnetic field vector
        const mx = magData.x, my = magData.y, mz = magData.z;

        // Cross product: H = A × M (east direction)
        const hx = ay * mz - az * my;
        const hy = az * mx - ax * mz;
        const hz = ax * my - ay * mx;
        const normH = Math.sqrt(hx * hx + hy * hy + hz * hz);

        // Skip if magnetic field is too weak or perpendicular to gravity
        if (normH < 0.1) return;

        // Normalize H (east vector)
        const invH = 1.0 / normH;
        const ex = hx * invH, ey = hy * invH, ez = hz * invH;

        // Normalize A (down/gravity vector)
        const normA = Math.sqrt(ax * ax + ay * ay + az * az);
        if (normA < 0.1) return;
        const invA = 1.0 / normA;
        const dx = ax * invA, dy = ay * invA, dz = az * invA;

        // Cross product: M' = H × A (north direction in device frame)
        const nx = ey * dz - ez * dy;
        const ny = ez * dx - ex * dz;
        // const nz = ex * dy - ey * dx; // unused

        // Azimuth = atan2(east_y, north_y) — corrected for expo-sensors axis convention
        // expo-sensors magnetometer axes differ from Android SensorManager, offset by 180°
        let rawAngle = Math.atan2(ex, nx) * (180 / Math.PI);
        rawAngle = (rawAngle + 180 + 360) % 360;

        const smoothedHeading = compassFilterRef.current.filter(rawAngle);
        const diff = Math.abs(compassFilterRef.current.angularDifference(stableHeadingRef.current, smoothedHeading));
        if (diff >= HEADING_DEADBAND_DEG) {
          stableHeadingRef.current = smoothedHeading;
          setHeading(smoothedHeading);
        }
      });
    };
    
    startTracking();
    calculatePath();
    
    return () => {
      // Clean up sensor subscriptions (refs ensure cleanup works even if assigned async)
      locationSubRef.current?.remove();
      magnetometerSubRef.current?.remove();
      accelerometerSubRef.current?.remove();
      // Clean up any pending reroute timeout
      if (rerouteTimeoutRef.current) {
        clearTimeout(rerouteTimeoutRef.current);
        rerouteTimeoutRef.current = null;
      }
      // Clean up pitch toggle timer
      if (pitchHoldTimerRef.current) {
        clearTimeout(pitchHoldTimerRef.current);
        pitchHoldTimerRef.current = null;
      }
    };
  }, []);

  // ========== MAP HEADING CALCULATION (Google Maps style - bearing to next waypoint) ==========
  // Pre-rotates before turns for smoother navigation experience
  useEffect(() => {
    if (!userLocation || !pathNodes || pathNodes.length < 2) return;
    
    // Find current position on path and next waypoint
    let targetBearing = 0;
    
    if (nextWaypoint) {
      // Calculate bearing from user to next waypoint
      targetBearing = getBearing(userLocation[1], userLocation[0], nextWaypoint.lat, nextWaypoint.lng);
      
      // Pre-rotate: if we're close to a turn, blend toward the direction AFTER the turn
      if (nextTurn && nextTurn.distance < PRE_ROTATE_DISTANCE_M && nextTurn.node) {
        // Find the waypoint after the turn node
        const turnNodeIndex = pathNodes.findIndex(n => 
          n.lat === nextTurn.node.lat && n.lng === nextTurn.node.lng
        );
        if (turnNodeIndex >= 0 && turnNodeIndex < pathNodes.length - 1) {
          const afterTurnNode = pathNodes[turnNodeIndex + 1];
          const postTurnBearing = getBearing(
            nextTurn.node.lat, nextTurn.node.lng,
            afterTurnNode.lat, afterTurnNode.lng
          );
          
          // Blend: closer to turn = more weight to post-turn bearing
          const blendFactor = 1 - (nextTurn.distance / PRE_ROTATE_DISTANCE_M);
          targetBearing = lerpAngle(targetBearing, postTurnBearing, blendFactor * 0.7);
        }
      }
    } else if (building) {
      // Fallback: bearing to destination
      targetBearing = getBearing(userLocation[1], userLocation[0], building.latitude, building.longitude);
    }
    
    targetMapHeadingRef.current = targetBearing;
    
    // Smooth animated lerp to target bearing
    Animated.timing(mapHeadingAnimRef, {
      toValue: targetBearing,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    
    // Update state for MapboxGL.Camera (which needs a number, not Animated.Value)
    setMapHeading(prev => {
      // Smooth lerp manually for the state value
      const diff = angularDifference(prev, targetBearing);
      if (Math.abs(diff) < 1) return targetBearing; // Close enough, snap
      return prev + diff * 0.15; // Smooth step
    });
  }, [userLocation, nextWaypoint, nextTurn, pathNodes, building]);

  // Helper: angular difference (shortest path around 360°)
  const angularDifference = (from, to) => {
    let diff = to - from;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    return diff;
  };

  // Helper: lerp between two angles (handles wrap-around)
  const lerpAngle = (from, to, t) => {
    const diff = angularDifference(from, to);
    return (from + diff * t + 360) % 360;
  };

  // ========== PITCH-BASED MAP TOGGLE (phone tilt) ==========
  // Phone facing down = expand map, phone upright = collapse to show AR
  useEffect(() => {
    const now = Date.now();
    
    // Debounce pitch changes
    if (now - lastPitchTriggerRef.current < PITCH_DEBOUNCE_MS) return;
    
    // Clear any pending timer
    if (pitchHoldTimerRef.current) {
      clearTimeout(pitchHoldTimerRef.current);
    }
    
    // Phone tilted down (looking at ground/map)
    if (pitch < PITCH_EXPAND_THRESHOLD && mapSnapState !== 'full') {
      pitchHoldTimerRef.current = setTimeout(() => {
        lastPitchTriggerRef.current = Date.now();
        setMapSnapState('full');
        setIsMapExpanded(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Animated.spring(mapHeight, { 
          toValue: MAP_MAX_HEIGHT, 
          tension: 80,
          friction: 12,
          useNativeDriver: false 
        }).start();
      }, PITCH_DEBOUNCE_MS);
    }
    // Phone upright (looking at AR/camera)
    else if (pitch > PITCH_COLLAPSE_THRESHOLD && mapSnapState !== 'collapsed') {
      pitchHoldTimerRef.current = setTimeout(() => {
        lastPitchTriggerRef.current = Date.now();
        setMapSnapState('collapsed');
        setIsMapExpanded(false);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Animated.spring(mapHeight, { 
          toValue: MAP_MIN_HEIGHT, 
          tension: 80,
          friction: 12,
          useNativeDriver: false 
        }).start();
      }, PITCH_DEBOUNCE_MS);
    }
    
    return () => {
      if (pitchHoldTimerRef.current) {
        clearTimeout(pitchHoldTimerRef.current);
      }
    };
  }, [pitch, mapSnapState]);

  // ========== EMERGENCY BADGE PULSING ANIMATION ==========
  useEffect(() => {
    if (!isEmergency) return;
    
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(emergencyPulseAnim, {
          toValue: 0.7,
          duration: 500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(emergencyPulseAnim, {
          toValue: 1,
          duration: 500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    
    pulseAnimation.start();
    return () => pulseAnimation.stop();
  }, [isEmergency]);

  // ========== REALTIME BLOCKAGE SUBSCRIPTION ==========
  // Subscribe to active blockages during navigation - triggers reroute if path becomes blocked
  useEffect(() => {
    const unsubscribe = subscribeToTable('blockages', (allBlockages) => {
      // Filter to only active blockages (column is "active", not "is_active")
      const activeFromLive = allBlockages.filter(b => b.active);
      // Merge with initial blockages by ID to prevent race condition on mount
      // (subscription may fire before initial calculatePath uses the route-param blockages)
      setLiveBlockages(prev => {
        const liveIds = new Set(activeFromLive.map(b => b.id));
        // Keep any initial blockages not yet seen in live data
        const fromInitial = (blockages || []).filter(b => b.active && !liveIds.has(b.id));
        const merged = [...activeFromLive, ...fromInitial];
        console.log('[Blockage] Live:', activeFromLive.length, 'Initial merge:', fromInitial.length, 'Total:', merged.length);
        return merged;
      });
    });
    
    return unsubscribe;
  }, []);

  // Check if current path intersects any new blockage and trigger reroute if needed
  useEffect(() => {
    if (!fullPathNodes || fullPathNodes.length < 2 || !liveBlockages || liveBlockages.length === 0) return;
    if (!nodes || nodes.length === 0) return;
    
    // Build nodes map for isEdgeBlocked check
    const nodesMap = {};
    for (const node of nodes) {
      nodesMap[node.id] = node;
    }
    
    // Check if any segment of current path is now blocked
    let pathIsBlocked = false;
    for (let i = 0; i < fullPathNodes.length - 1; i++) {
      const fromNode = fullPathNodes[i];
      const toNode = fullPathNodes[i + 1];
      
      // Create a synthetic edge object for the check
      // Note: fullPathNodes have lat/lng directly, so we check point-in-polygon for each segment
      const checkPoints = [0, 0.25, 0.5, 0.75, 1];
      const segmentBlocked = checkPoints.some(t => {
        const checkLng = fromNode.lng + t * (toNode.lng - fromNode.lng);
        const checkLat = fromNode.lat + t * (toNode.lat - fromNode.lat);
        return liveBlockages.some(blockage => {
          if (!blockage.points || blockage.points.length < 3) return false;
          return isPointInPolygon(checkLng, checkLat, blockage.points);
        });
      });
      
      if (segmentBlocked) {
        pathIsBlocked = true;
        console.log('[Blockage] Path segment', i, 'is now blocked - triggering reroute');
        break;
      }
    }
    
    // Trigger reroute if path is blocked and we have user location
    if (pathIsBlocked && userLocation && !isRerouting) {
      console.log('[Blockage] Path blocked by new blockage - rerouting...');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setRerouteMessage('Path blocked ahead \u2014 rerouting...');
      setTimeout(() => setRerouteMessage(null), 3000);
      triggerReroute(userLocation);
    }
  }, [liveBlockages, fullPathNodes, nodes, userLocation, isRerouting, triggerReroute]);

  // Recalculate path whenever liveBlockages changes (covers both new blockages AND cleared blockages)
  const hasInitialPathRef = useRef(false);
  useEffect(() => {
    // Skip the very first render (initial calculatePath is called from the mount useEffect)
    if (!hasInitialPathRef.current) {
      if (fullPathNodes.length > 0) hasInitialPathRef.current = true;
      return;
    }
    if (!userLocation) return;
    console.log('[Blockage] liveBlockages changed, recalculating path...');
    calculatePath(userLocation);
  }, [liveBlockages]);

  const calculatePath = useCallback((startLocationOverride = null) => {
    // Validate all required data
    if (!nodes || !edges || nodes.length === 0 || !building) {
      console.log('[PathCalc] Missing required data:', { nodes: !!nodes, edges: !!edges, nodesLen: nodes?.length, building: !!building });
      return;
    }
    
    // Use override location (for rerouting) or initial location
    let startLocation = startLocationOverride || initialLocation;
    if (!startLocation) {
      console.log('[PathCalc] No start location provided');
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
    
    // Use the shared pathfinding utility (use liveBlockages for realtime updates)
    const result = findPath({
      startCoords: startLocation,
      endCoords: [building.longitude, building.latitude],
      nodes,
      edges,
      blockages: liveBlockages,
      includeEndpoints: true
    });
    
    if (result.error) {
      console.warn('[PathCalc] Warning:', result.error);
      setPathError(result.error);
      return;
    }
    
    // Clear any previous path error on success
    setPathError(null);
    console.log('[PathCalc] Path found with', result.path.length, 'points');
    
    // Convert path to GeoJSON and set state (solid line - graph nodes only)
    setNavigationPath(pathToGeoJSON(result.path));
    // Store full original path GeoJSON for gray walked trail (never trimmed)
    setFullPathGeoJSON(pathToGeoJSON(result.path));
    
    // User connector line (dotted) - dynamically updated from current position to first path node
    if (result.userStartPoint && result.path.length > 0) {
      const connectorPath = [result.userStartPoint, result.path[0]];
      setUserConnectorLine(pathToGeoJSON(connectorPath));
    } else {
      setUserConnectorLine(null);
    }
    
    setPathNodes(result.pathNodes);
    setFullPathNodes(result.pathNodes); // Store full path for reference
    setClearedPathIndex(0); // Reset cleared index on new path
    
    if (result.pathNodes.length > 1) {
      setNextWaypoint(result.pathNodes[1]);
    } else if (result.pathNodes.length === 1) {
      setNextWaypoint(result.pathNodes[0]);
    }
  }, [nodes, edges, initialLocation, building, liveBlockages]);

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

  // Check if user is off path and trigger reroute
  const checkAndReroute = useCallback((currentLoc) => {
    if (!currentLoc || fullPathNodes.length < 2 || isRerouting) return;
    
    const now = Date.now();
    // Debounce rerouting
    if (now - lastRerouteRef.current < REROUTE_DEBOUNCE_MS) return;
    
    const { distance: distanceFromPath } = getDistanceFromPath(
      currentLoc[1], // lat
      currentLoc[0], // lng
      fullPathNodes
    );
    
    console.log('[Reroute] Distance from path:', distanceFromPath.toFixed(1), 'm');
    
    if (distanceFromPath > OFF_PATH_THRESHOLD_METERS) {
      console.log('[Reroute] User is off path, triggering reroute...');
      lastRerouteRef.current = now;
      triggerReroute(currentLoc);
    }
  }, [fullPathNodes, isRerouting, triggerReroute]);

  // Trigger a reroute from current location
  const triggerReroute = useCallback((fromLocation) => {
    if (isRerouting) return;
    
    setIsRerouting(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    
    // Spin animation for recalculate button
    recalcSpinValue.setValue(0);
    Animated.loop(
      Animated.timing(recalcSpinValue, {
        toValue: 1,
        duration: 800,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
    
    // Small delay to show the loading UI (stored in ref for cleanup)
    rerouteTimeoutRef.current = setTimeout(() => {
      if (!isMountedRef.current) return;
      calculatePath(fromLocation);
      setIsRerouting(false);
      recalcSpinValue.stopAnimation();
      recalcSpinValue.setValue(0);
      rerouteTimeoutRef.current = null;
    }, 500);
  }, [calculatePath, isRerouting]);

  // Manual recalculate handler
  const handleManualRecalculate = useCallback(() => {
    if (!userLocation || isRerouting) return;
    
    console.log('[Reroute] Manual recalculate requested');
    lastRerouteRef.current = Date.now();
    triggerReroute(userLocation);
  }, [userLocation, triggerReroute, isRerouting]);

  // Retry getting location after error
  const handleRetryLocation = useCallback(async () => {
    setLocationError(null);
    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const loc = [position.coords.longitude, position.coords.latitude];
      setUserLocation(loc);
      setLocationReady(true);
      calculatePath(loc);
    } catch (err) {
      console.error('[GPS] Retry failed:', err);
      setLocationError('Still unable to get location. Please ensure GPS is enabled.');
    }
  }, [calculatePath]);

  // Progressive path clearing (Waze-style - remove path behind user)
  const updatePathClearing = useCallback((currentLoc) => {
    if (!currentLoc || fullPathNodes.length < 2) return;
    
    const { trimmedNodes, newClearedIndex } = trimPathBehindUser(
      fullPathNodes,
      currentLoc[1], // lat
      currentLoc[0], // lng
      clearedPathIndex,
      PATH_CLEAR_THRESHOLD_METERS
    );
    
    // Always update user connector line (dotted) from current position to first remaining node
    if (trimmedNodes.length > 0) {
      const connectorPath = [currentLoc, [trimmedNodes[0].lng, trimmedNodes[0].lat]];
      setUserConnectorLine(pathToGeoJSON(connectorPath));
    }
    
    // Only update path if we've cleared more of it
    if (newClearedIndex > clearedPathIndex) {
      console.log('[PathClear] Cleared to index:', newClearedIndex, 'Remaining nodes:', trimmedNodes.length);
      setClearedPathIndex(newClearedIndex);
      
      // Update the visible path (only show remaining path ahead)
      if (trimmedNodes.length >= 2) {
        const trimmedPath = trimmedNodes.map(n => [n.lng, n.lat]);
        setNavigationPath(pathToGeoJSON(trimmedPath));
        setPathNodes(trimmedNodes);
      }
    }
  }, [fullPathNodes, clearedPathIndex]);

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

  // Loading Screen - waiting for permissions
  if (!permission) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <Text className="text-white text-lg">Initializing AR...</Text>
      </View>
    );
  }
  
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
  
  // Permission Screen
  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center p-10">
        <LinearGradient colors={['#B22222', '#4d0000']} style={StyleSheet.absoluteFill} />
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

  // AR Navigation Guide Screen
  if (showARGuide) {
    const handleDismissGuide = () => {
      if (doNotShowAgain) {
        hasUserDismissedGuideThisSession = true;
      }
      setShowARGuide(false);
    };

    return (
      <View style={[styles.guideContainer, { backgroundColor: colors.bg }]}>
        <SafeAreaView style={styles.guideSafeArea}>
          <View style={styles.guideHeader}>
            <View style={[styles.guideHeaderIconWrap, { backgroundColor: colors.surfaceSecondary }]}>
              <MaterialCommunityIcons name="navigation-variant" size={28} color={colors.maroon} />
            </View>
            <Text style={[styles.guideTitle, { color: colors.textPrimary }]}>AR Navigation Guide</Text>
            <Text style={[styles.guideSubtitle, { color: colors.textSecondary }]}>Quick reminders before you start</Text>
          </View>

          <View style={styles.guideContent}>
            <View style={[styles.guideCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.guideCardHeader}>
                <MaterialCommunityIcons name="compass-outline" size={20} color={colors.maroon} />
                <Text style={[styles.guideCardTitle, { color: colors.textPrimary }]}>How to Navigate</Text>
              </View>
              <Text style={[styles.guideCardText, { color: colors.textSecondary }]}>Point your phone forward and follow the path arrows on screen.</Text>
            </View>

            <View style={[styles.guideCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.guideCardHeader}>
                <MaterialCommunityIcons name="shield-check-outline" size={20} color={colors.maroon} />
                <Text style={[styles.guideCardTitle, { color: colors.textPrimary }]}>Safety First</Text>
              </View>
              <View style={styles.guideBulletList}>
                <View style={styles.guideBulletItem}>
                  <MaterialCommunityIcons name="eye-outline" size={16} color={colors.maroon} />
                  <Text style={[styles.guideBulletText, { color: colors.textSecondary }]}>Keep your eyes on the path ahead.</Text>
                </View>
                <View style={styles.guideBulletItem}>
                  <MaterialCommunityIcons name="car" size={16} color={colors.maroon} />
                  <Text style={[styles.guideBulletText, { color: colors.textSecondary }]}>Stop and check crosswalks before crossing.</Text>
                </View>
                <View style={styles.guideBulletItem}>
                  <MaterialCommunityIcons name="account-group-outline" size={16} color={colors.maroon} />
                  <Text style={[styles.guideBulletText, { color: colors.textSecondary }]}>Stay aware of people around you.</Text>
                </View>
              </View>
            </View>

            <View style={[styles.guideInfoRow, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <MaterialCommunityIcons name="information-outline" size={16} color={colors.maroon} />
              <Text style={[styles.guideInfoText, { color: colors.textSecondary }]}>GPS may be less accurate indoors or near tall structures.</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.guideCheckboxRow}
            onPress={() => setDoNotShowAgain(!doNotShowAgain)}
          >
            <View
              style={[
                styles.guideCheckbox,
                {
                  borderColor: doNotShowAgain ? colors.maroon : colors.textMuted,
                  backgroundColor: doNotShowAgain ? colors.maroon : 'transparent',
                },
              ]}
            >
              {doNotShowAgain && <MaterialCommunityIcons name="check" size={12} color={colors.surface} />}
            </View>
            <Text style={[styles.guideCheckboxLabel, { color: colors.textSecondary }]}>Don’t show this again for this session</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.guidePrimaryButton, { backgroundColor: colors.maroon }]}
            onPress={handleDismissGuide}
            activeOpacity={0.9}
          >
            <Text style={[styles.guidePrimaryButtonText, { color: colors.surface }]}>Start AR</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  // Arrived Screen
  if (hasArrived) {
    return (
      <View className="flex-1 items-center justify-center">
        <LinearGradient colors={['#B22222', '#4d0000', '#1a0000']} style={StyleSheet.absoluteFill} />
        <Animated.View 
          className="items-center p-10"
          style={{ transform: [{ scale: celebrationAnim }], opacity: celebrationAnim }}
        >
          <View className="w-24 h-24 rounded-full bg-white/20 items-center justify-center mb-6">
            <FontAwesome5 name="flag-checkered" size={48} color="#FFD700" />
          </View>
          <Text className="text-4xl font-bold text-white mb-3">You’ve Arrived!</Text>
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

  // Path Error Screen — full-screen overlay when no path found
  if (pathError) {
    return (
      <View className="flex-1 items-center justify-center">
        <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={StyleSheet.absoluteFill} />
        <View className="items-center p-10">
          <View className="w-24 h-24 rounded-full bg-red-500/20 items-center justify-center mb-6">
            <MaterialCommunityIcons name="map-marker-off" size={48} color="#FF6B6B" />
          </View>
          <Text className="text-3xl font-bold text-white mb-3 text-center">No Path Found</Text>
          <Text className="text-base text-white/80 mb-2 text-center px-4">{pathError}</Text>
          <Text className="text-sm text-white/60 mb-10 text-center px-8">All routes may be blocked. Try again or go back.</Text>
          <View className="flex-row" style={{ gap: 12 }}>
            <TouchableOpacity 
              className="rounded-2xl overflow-hidden"
              style={styles.elevatedButton}
              onPress={() => {
                setPathError(null);
                calculatePath(userLocation);
              }}
            >
              <LinearGradient colors={['#4285F4', '#2962FF']} style={styles.finishButtonGradient}>
                <MaterialCommunityIcons name="reload" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text className="text-white text-lg font-bold">Retry</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity 
              className="rounded-2xl overflow-hidden"
              style={styles.elevatedButton}
              onPress={() => navigation.goBack()}
            >
              <LinearGradient colors={['#666', '#444']} style={styles.finishButtonGradient}>
                <Text className="text-white text-lg font-bold">Go Back</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ViroReact 3D AR Mode - unmount when map is fully expanded to save GPU */}
      {viroAvailable && !viroError && ViroARSceneNavigator && mapSnapState !== 'full' && (
        <View style={styles.arContainer}>
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
            pathNodes,
            nextTurn,
            isEmergency,
          }}
          style={StyleSheet.absoluteFillObject}
          numberOfTrackedImages={building?.images?.length > 0 ? 1 : 0}
        />
        </View>
      )}

      {/* Fallback Camera Mode (only if ViroReact is not available or errored) - hidden when map is fully expanded */}
      {(!viroAvailable || viroError) && (
        <View style={[
          styles.arContainer,
          mapSnapState === 'full' && { opacity: 0, pointerEvents: 'none' }
        ]}>
          <CameraView style={StyleSheet.absoluteFillObject} facing="back" />
        </View>
      )}

      {/* ===== GOOGLE MAPS LIVE VIEW STYLE UI OVERLAY ===== */}
      {/* In ViroReact mode: Show minimal HUD only (no duplicate AR elements) */}
      {/* In fallback mode: Show full 2D overlay */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
        
        {/* ===== LOCATION ERROR BANNER ===== */}
        {locationError && (
          <View style={styles.errorBanner}>
            <MaterialCommunityIcons name="alert-circle" size={20} color="#FFFFFF" />
            <Text style={styles.errorBannerText}>{locationError}</Text>
            <TouchableOpacity style={styles.errorRetryButton} onPress={handleRetryLocation}>
              <Text style={styles.errorRetryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* ===== REROUTE TOAST BANNER ===== */}
        {rerouteMessage && (
          <View style={styles.rerouteToast}>
            <MaterialCommunityIcons name="alert-decagram" size={20} color="#FFD700" />
            <Text style={styles.rerouteToastText}>{rerouteMessage}</Text>
          </View>
        )}
        
        {/* Animated Chevron Arrows - ONLY in fallback mode (ViroReact renders its own) */}
        {(!viroAvailable || viroError) && (
          <View style={styles.chevronOverlay}>
            <AnimatedChevrons 
              direction={getRelativeDirection()} 
              isVisible={!hasArrived && currentDistance > 10}
            />
          </View>
        )}

        {/* Street/Building Name Label - ONLY in fallback mode */}
        {(!viroAvailable || viroError) && building && (
          <View style={styles.streetLabel}>
            <Text style={styles.streetLabelText}>{building.name}</Text>
          </View>
        )}

        {/* Distance Badge at top right - ONLY in fallback mode */}
        {(!viroAvailable || viroError) && (
          <View style={styles.distancePillTopRight}>
            <Text style={styles.distancePillText}>{currentDistance || '--'}m</Text>
          </View>
        )}

        {/* Turn Instruction Banner - ONLY in fallback mode */}
        {(!viroAvailable || viroError) && nextTurn && nextTurn.distance < 60 && (
          <View style={styles.turnBannerOverlay}>
            <MaterialCommunityIcons 
              name={nextTurn.type === 'left' ? 'arrow-left-top-bold' : 
                    nextTurn.type === 'right' ? 'arrow-right-top-bold' :
                    nextTurn.type === 'slight-left' ? 'arrow-top-left' :
                    nextTurn.type === 'slight-right' ? 'arrow-top-right' : 'arrow-up-bold'} 
              size={36} 
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
        
        {/* Distance pill (compact, top-right) - ViroReact mode only */}
        {viroAvailable && !viroError && (
          <View style={styles.distancePillTopRight}>
            <Text style={styles.distancePillText}>{currentDistance || '--'}m</Text>
          </View>
        )}
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

      {/* ========== Shared UI Elements (both modes) ========== */}

      {/* Top Left: Emergency Badge (only when in emergency mode) */}
      {isEmergency && (
        <Animated.View style={[styles.emergencyBadge, { opacity: emergencyPulseAnim }]}>
          <MaterialCommunityIcons name="alert-circle" size={18} color="#FFFFFF" />
          <Text style={styles.emergencyBadgeText}>EMERGENCY</Text>
        </Animated.View>
      )}

      {/* Top Right: Stop Button — circle */}
      <TouchableOpacity style={styles.stopButton} onPress={() => navigation.goBack()}>
        <MaterialCommunityIcons name="close" size={22} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Recalculate Button — circle with reload icon, animated spin */}
      <TouchableOpacity 
        style={[styles.recalculateButton, isRerouting && styles.recalculateButtonDisabled]} 
        onPress={handleManualRecalculate}
        disabled={isRerouting}
      >
        <Animated.View style={isRerouting ? { transform: [{ rotate: recalcSpinValue ? recalcSpinValue.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) : '0deg' }] } : {}}>
          <MaterialCommunityIcons name="reload" size={22} color="#FFFFFF" />
        </Animated.View>
      </TouchableOpacity>

      {/* Fixed Map — animated height based on pitch */}
      <Animated.View style={[styles.mapContainer, { height: mapHeight }]}>
        {userLocation ? (
          <MapboxGL.MapView 
            style={styles.map} 
            styleURL={mapStyle}
            logoEnabled={false} 
            compassEnabled={false}
            attributionEnabled={false}
            scaleBarEnabled={false}
            onDidFinishLoadingMap={() => console.log('[Mapbox] AR Map loaded successfully')}
            onMapLoadingError={(e) => console.error('[Mapbox] AR Map loading error:', e)}
          >
            <MapboxGL.Camera 
              zoomLevel={18} 
              centerCoordinate={getSnappedLocation() || userLocation} 
              heading={heading}
              pitch={60} 
              animationDuration={600} 
              animationMode="flyTo"
            />
            {/* Full original path (gray, faded) - shows walked trail RENDER FIRST (bottom layer) */}
            {fullPathGeoJSON && (
              <MapboxGL.ShapeSource id="fullPath" shape={fullPathGeoJSON}>
                <MapboxGL.LineLayer 
                  id="fullPathLayer" 
                  style={{ 
                    lineColor: '#888888', 
                    lineWidth: 4, 
                    lineCap: 'round', 
                    lineJoin: 'round',
                    lineOpacity: 0.4,
                  }} 
                />
              </MapboxGL.ShapeSource>
            )}
            {/* User connector line (dotted) - from user to first path node - RENDER SECOND */}
            {userConnectorLine && (
              <MapboxGL.ShapeSource id="userConnector" shape={userConnectorLine}>
                <MapboxGL.LineLayer 
                  id="userConnectorLayer" 
                  style={{ 
                    lineColor: '#00E5FF', 
                    lineWidth: 4, 
                    lineCap: 'round', 
                    lineJoin: 'round',
                    lineDasharray: [2, 3],  // Dotted pattern
                    lineOpacity: 0.7,
                  }} 
                />
              </MapboxGL.ShapeSource>
            )}
            {/* Navigation path (solid, cyan) - remaining path ahead - RENDER THIRD */}
            {navigationPath && (
              <MapboxGL.ShapeSource id="navPath" shape={navigationPath}>
                <MapboxGL.LineLayer 
                  id="navPathLayer" 
                  style={{ 
                    lineColor: '#00E5FF', 
                    lineWidth: 6, 
                    lineCap: 'round', 
                    lineJoin: 'round' 
                  }} 
                />
              </MapboxGL.ShapeSource>
            )}
            {/* User location marker (3D puck) - RENDER AFTER PATHS (on top) */}
            <MapboxGL.LocationPuck 
              puckBearingEnabled={true}
              puckBearing="heading"
              pulsing={{ isEnabled: true }}
            />
            {/* Destination marker - RENDER LAST (topmost layer) */}
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
  
  // AR Container (for hide/show when map is fully expanded)
  arContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  
  // Emergency Badge (top left, pulsing)
  emergencyBadge: {
    position: 'absolute',
    top: 50,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(220, 53, 69, 0.9)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  emergencyBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 6,
    letterSpacing: 1,
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
    top: SCREEN_HEIGHT * 0.40,
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
  
  // Stop Button — circle
  stopButton: {
    position: 'absolute',
    bottom: SCREEN_HEIGHT * 0.40 + 16,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(220, 53, 69, 0.9)',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  
  // Recalculate Button — circle, same size as stop
  recalculateButton: {
    position: 'absolute',
    bottom: SCREEN_HEIGHT * 0.40 + 16,
    right: 76,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 122, 255, 0.9)',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  recalculateButtonDisabled: {
    backgroundColor: 'rgba(100, 100, 100, 0.7)',
  },
  
  // Rerouting Banner
  reroutingBanner: {
    position: 'absolute',
    top: 150,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  reroutingText: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  
  // Simple User Location Dot (for map)
  userDotOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userDotInner: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#3B82F6',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
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
  
  // Map Container — fixed 40% height
  mapContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: MAP_FIXED_HEIGHT,
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
  map: {
    flex: 1,
    minHeight: 150,
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
  guideContainer: {
    flex: 1,
  },
  guideSafeArea: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  guideHeader: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 18,
  },
  guideHeaderIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  guideTitle: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    marginBottom: 4,
  },
  guideSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  guideContent: {
    flex: 1,
    justifyContent: 'center',
    gap: 10,
  },
  guideCard: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  guideCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  guideCardTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  guideCardText: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: 'Inter_400Regular',
  },
  guideBulletList: {
    gap: 8,
  },
  guideBulletItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  guideBulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
  },
  guideInfoRow: {
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  guideInfoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Inter_400Regular',
  },
  guideCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  guideCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  guideCheckboxLabel: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  guidePrimaryButton: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    elevation: 3,
  },
  guidePrimaryButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  guideButtonGradient: {
    paddingHorizontal: 40,
    paddingVertical: 16,
    alignItems: 'center',
  },
  elevatedButton: { 
    elevation: 5 
  },
  
  // Distance pill — top-right
  distancePillTopRight: {
    position: 'absolute',
    top: 50,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  distancePillText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  
  // ===== ERROR BANNER STYLES =====
  errorBanner: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(220, 53, 69, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    zIndex: 50,
  },
  errorBannerText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    marginLeft: 10,
  },
  errorRetryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 10,
  },
  errorRetryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  
  // ===== REROUTE TOAST STYLES =====
  rerouteToast: {
    position: 'absolute',
    top: 90,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.5)',
    zIndex: 50,
  },
  rerouteToastText: {
    flex: 1,
    color: '#FFD700',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 10,
  },
});

export default ARNavigationScreen;
