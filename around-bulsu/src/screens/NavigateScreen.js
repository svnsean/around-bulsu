// src/screens/NavigateScreen.js
import MapboxGL from '@rnmapbox/maps';
import * as Location from 'expo-location';
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { View, Alert, ActivityIndicator, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { DrawerActions } from '@react-navigation/native';
import { supabase, subscribeToTable } from '../supabase';
import { Ionicons } from '@expo/vector-icons';
import { BSU_CENTER, CAMPUS_BOUNDS, isWithinCampus } from '../config/mapbox';
import { BULSU_COLORS } from '../components/ui/BuildingMarker';
import { useSettings } from '../context/SettingsContext';

// Mapbox is initialized in App.js via initializeMapbox()

// Zoom thresholds
const CLUSTER_MAX_ZOOM = 14; // Clusters won't form above this zoom
const LABEL_MIN_ZOOM = 15;   // Labels only show at this zoom and higher

// Building marker icon (512x512 PNG)
const buildingMarkerIcon = require('../../assets/images/building-marker.png');

const NavigateScreen = ({ navigation }) => {
  const { mapStyle, triggerHaptic, colors } = useSettings();
  const [userLocation, setUserLocation] = useState(null);
  const [buildings, setBuildings] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [blockages, setBlockages] = useState([]);
  const [isOutsideCampus, setIsOutsideCampus] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(17);
  const zoomRef = useRef(17);
  const mapRef = useRef(null);
  const cameraRef = useRef(null);

  // Memoized GeoJSON for clustering
  const buildingsGeoJSON = useMemo(() => ({
    type: 'FeatureCollection',
    features: buildings.map(b => ({
      type: 'Feature',
      id: b.id,
      properties: { 
        id: b.id, 
        name: b.name,
        cluster: false 
      },
      geometry: {
        type: 'Point',
        coordinates: [b.longitude, b.latitude]
      }
    }))
  }), [buildings]);

  // Location tracking
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required for navigation');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });
      
      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      };
      setUserLocation(coords);
      checkIfOutsideCampus(coords);

      // Watch position
      Location.watchPositionAsync({
        accuracy: Location.Accuracy.High,
        timeInterval: 2000,
        distanceInterval: 5
      }, (loc) => {
        const newCoords = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude
        };
        setUserLocation(newCoords);
        checkIfOutsideCampus(newCoords);
      });
    })();
  }, []);

  // Supabase listeners
  useEffect(() => {
    const unsubBuildings = subscribeToTable('buildings', (data) => {
      setBuildings(data);
      setIsLoading(false);
    });
    const unsubNodes = subscribeToTable('nodes', setNodes);
    const unsubEdges = subscribeToTable('edges', setEdges);
    const unsubBlockages = subscribeToTable('blockages', setBlockages);

    return () => {
      unsubBuildings();
      unsubNodes();
      unsubEdges();
      unsubBlockages();
    };
  }, []);

  // Check if user is outside BSU campus (rough boundary check)
  const checkIfOutsideCampus = (coords) => {
    if (!coords) return;
    setIsOutsideCampus(!isWithinCampus(coords.latitude, coords.longitude));
  };

  // Handle building pin click
  const handleBuildingPress = (building) => {
    const userCoords = userLocation
      ? [userLocation.longitude, userLocation.latitude]
      : null;
    navigation.navigate('BuildingInfo', { 
      building,
      userLocation: userCoords,
      nodes,
      edges,
      blockages
    });
  };

  const centerOnUser = () => {
    if (userLocation && cameraRef.current) {
      triggerHaptic('light');
      cameraRef.current.setCamera({
        centerCoordinate: [userLocation.longitude, userLocation.latitude],
        zoomLevel: 18,
        animationDuration: 500
      });
    }
  };

  const handleZoomIn = () => {
    triggerHaptic('light');
    if (cameraRef.current) {
      const newZoom = Math.min(zoomRef.current + 1, 20);
      zoomRef.current = newZoom;
      setCurrentZoom(newZoom);
      cameraRef.current.setCamera({
        zoomLevel: newZoom,
        animationDuration: 300
      });
    }
  };

  const handleZoomOut = () => {
    triggerHaptic('light');
    if (cameraRef.current) {
      const newZoom = Math.max(zoomRef.current - 1, 10);
      zoomRef.current = newZoom;
      setCurrentZoom(newZoom);
      cameraRef.current.setCamera({
        zoomLevel: newZoom,
        animationDuration: 300
      });
    }
  };

  // Handle zoom level changes for conditional rendering
  const handleRegionChange = useCallback((feature) => {
    if (feature?.properties?.zoomLevel) {
      zoomRef.current = feature.properties.zoomLevel;
      setCurrentZoom(feature.properties.zoomLevel);
    }
  }, []);

  // Handle cluster press - animate zoom to expand
  const handleClusterPress = useCallback(async (feature) => {
    if (!feature?.geometry?.coordinates || !cameraRef.current) return;
    
    const [lng, lat] = feature.geometry.coordinates;
    const pointCount = feature.properties?.point_count || 0;
    
    // Calculate zoom level based on cluster size using ref for fresh value
    const curZoom = zoomRef.current;
    let targetZoom = curZoom + 2;
    if (pointCount > 10) targetZoom = curZoom + 3;
    if (pointCount > 20) targetZoom = curZoom + 4;
    
    // Animate to cluster location with increased zoom
    cameraRef.current.setCamera({
      centerCoordinate: [lng, lat],
      zoomLevel: Math.min(targetZoom, 19),
      animationDuration: 500,
      animationMode: 'flyTo'
    });
  }, []);

  return (
    <View className="flex-1 bg-white">
      {/* Loading Overlay */}
      {isLoading && (
        <View className="absolute inset-0 bg-white/95 items-center justify-center z-50">
          <ActivityIndicator size="large" color="#B22222" />
          <Text className="mt-3 text-base text-maroon-800 font-semibold">
            Loading buildings...
          </Text>
        </View>
      )}

      {/* Menu Button — circle, right side, same size as re-center */}
      <TouchableOpacity
        style={[styles.menuButton, { backgroundColor: colors.card }]}
        onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
      >
        <Ionicons name="menu" size={24} color="#B22222" />
      </TouchableOpacity>

      <MapboxGL.MapView 
        ref={mapRef}
        style={{ flex: 1 }} 
        styleURL={mapStyle}
        logoEnabled={false}
        attributionEnabled={false}
        onDidFinishLoadingMap={() => {
          console.log('[Map] Finished loading map');
          setMapReady(true);
        }}
        onDidFailLoadingMap={(error) => {
          console.error('[Map] Failed to load map:', error);
        }}
        onRegionDidChange={handleRegionChange}
      >
        <MapboxGL.Camera 
          ref={cameraRef}
          zoomLevel={17} 
          centerCoordinate={userLocation ? [userLocation.longitude, userLocation.latitude] : BSU_CENTER}
          animationDuration={1000}
        />
        
        <MapboxGL.LocationPuck 
          puckBearingEnabled={true}
          puckBearing="heading"
        />

        {/* Register custom building marker image */}
        <MapboxGL.Images images={{ 'building-marker': buildingMarkerIcon }} />

        {/* Clustered Building Source with Native Mapbox Clustering */}
        {mapReady && buildings.length > 0 && (
          <MapboxGL.ShapeSource
            id="buildings-clustered-source"
            shape={buildingsGeoJSON}
            cluster={true}
            clusterRadius={50}
            clusterMaxZoomLevel={CLUSTER_MAX_ZOOM}
            onPress={(e) => {
              if (!e.features || e.features.length === 0) return;
              
              const feature = e.features[0];
              
              // Check if it's a cluster
              if (feature.properties?.cluster) {
                handleClusterPress(feature);
              } else {
                // Individual building marker
                const building = buildings.find(b => b.id === feature.properties.id);
                if (building) handleBuildingPress(building);
              }
            }}
          >
            {/* Cluster circles - BulSU maroon with white border */}
            <MapboxGL.CircleLayer
              id="clusters"
              filter={['has', 'point_count']}
              style={{
                circleColor: BULSU_COLORS.maroon,
                circleRadius: [
                  'step',
                  ['get', 'point_count'],
                  15,   // Base size for small clusters
                  5, 18,  // 5+ points = 18px
                  10, 22, // 10+ points = 22px
                  20, 26  // 20+ points = 26px
                ],
                circleStrokeWidth: 2.5,
                circleStrokeColor: '#FFFFFF',
              }}
            />
            
            {/* Cluster count text */}
            <MapboxGL.SymbolLayer
              id="cluster-count"
              filter={['has', 'point_count']}
              style={{
                textField: ['get', 'point_count_abbreviated'],
                textSize: 14,
                textColor: '#FFFFFF',
                textFont: ['DIN Pro Bold', 'Arial Unicode MS Bold'],
                textAllowOverlap: true,
                textIgnorePlacement: true,
              }}
            />

            {/* White circle background behind building markers */}
            <MapboxGL.CircleLayer
              id="unclustered-circle"
              filter={['!', ['has', 'point_count']]}
              style={{
                circleColor: '#FFFFFF',
                circleRadius: 22,
                circleStrokeWidth: 0,
                circlePitchAlignment: 'map',
              }}
            />

            {/* Unclustered building markers - icon and label combined in one layer */}
            <MapboxGL.SymbolLayer
              id="unclustered-buildings"
              filter={['!', ['has', 'point_count']]}
              style={{
                // Icon settings
                iconImage: 'building-marker',
                iconSize: 0.07,
                iconAllowOverlap: true,
                iconIgnorePlacement: true,
                // Text/label settings - combined in same layer to avoid collision issues
                textField: ['get', 'name'],
                textSize: 11,
                textFont: ['DIN Pro Bold', 'Arial Unicode MS Bold'],
                textColor: '#1F2937',
                textHaloColor: '#FFFFFF',
                textHaloWidth: 1,
                textHaloBlur: 0.3,
                textOffset: [0, 2.5],
                textAnchor: 'top',
                textMaxWidth: 10,
                textAllowOverlap: false,
                textOptional: true,
                // Use textOpacity with zoom step to show labels only at zoom >= LABEL_MIN_ZOOM
                textOpacity: ['step', ['zoom'], 0, LABEL_MIN_ZOOM, 1],
              }}
            />
          </MapboxGL.ShapeSource>
        )}
      </MapboxGL.MapView>

      {/* Outside Campus Warning — pill, centered */}
      {isOutsideCampus && (
        <View style={styles.warningPill}>
          <Ionicons name="warning" size={16} color="#fff" style={{ marginRight: 4 }} />
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12, fontFamily: 'Inter_700Bold' }}>
            Outside campus
          </Text>
        </View>
      )}

      {/* Zoom Buttons — vertical pill above re-center */}
      <View style={[styles.zoomPill, { backgroundColor: colors.card }]}>
        <TouchableOpacity style={styles.zoomBtn} onPress={handleZoomIn}>
          <Ionicons name="add" size={22} color="#B22222" />
        </TouchableOpacity>
        <View style={{ height: 1, backgroundColor: colors.border }} />
        <TouchableOpacity style={styles.zoomBtn} onPress={handleZoomOut}>
          <Ionicons name="remove" size={22} color="#B22222" />
        </TouchableOpacity>
      </View>

      {/* Center on User Button */}
      <TouchableOpacity style={[styles.centerButton, { backgroundColor: colors.card }]} onPress={centerOnUser}>
        <Ionicons name="locate" size={24} color="#B22222" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
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
  zoomPill: {
    position: 'absolute',
    bottom: 80,
    right: 16,
    borderRadius: 24,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  zoomBtn: {
    width: 48,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerButton: {
    position: 'absolute',
    bottom: 20,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
});

export default NavigateScreen;
