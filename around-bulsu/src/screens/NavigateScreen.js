// src/screens/NavigateScreen.js
import MapboxGL from '@rnmapbox/maps';
import * as Location from 'expo-location';
import React, { useEffect, useState, useRef } from 'react';
import { View, Alert, ActivityIndicator, Text, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import { DrawerActions } from '@react-navigation/native';
import { supabase, subscribeToTable } from '../supabase';
import SearchBottomSheet from '../components/SearchBottomSheet';
import { Ionicons } from '@expo/vector-icons';
import { BSU_CENTER, CAMPUS_BOUNDS, isWithinCampus } from '../config/mapbox';

// Mapbox is initialized in App.js via initializeMapbox()

const NavigateScreen = ({ navigation }) => {
  const [userLocation, setUserLocation] = useState(null);
  const [buildings, setBuildings] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [blockages, setBlockages] = useState([]);
  const [isOutsideCampus, setIsOutsideCampus] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const bottomSheetRef = useRef(null);
  const mapRef = useRef(null);
  const cameraRef = useRef(null);

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
    setSelectedBuilding(building);
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

  // Handle search result selection
  const handleSearchSelect = (building) => {
    bottomSheetRef.current?.close();
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
      cameraRef.current.setCamera({
        centerCoordinate: [userLocation.longitude, userLocation.latitude],
        zoomLevel: 18,
        animationDuration: 500
      });
    }
  };

  return (
    <View className="flex-1 bg-white">
      {/* Loading Overlay */}
      {isLoading && (
        <View className="absolute inset-0 bg-white/95 items-center justify-center z-50">
          <ActivityIndicator size="large" color="#800000" />
          <Text className="mt-3 text-base text-maroon-800 font-semibold">
            Loading buildings...
          </Text>
        </View>
      )}

      {/* Menu Button */}
      <TouchableOpacity
        className="absolute top-12 left-4 w-11 h-11 rounded-xl bg-white items-center justify-center shadow-lg z-10"
        style={styles.menuShadow}
        onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
      >
        <Ionicons name="menu" size={28} color="#800000" />
      </TouchableOpacity>

      <MapboxGL.MapView 
        ref={mapRef}
        style={{ flex: 1 }} 
        styleURL={MapboxGL.StyleURL.Street}
        logoEnabled={false}
        attributionEnabled={false}
        onDidFinishLoadingMap={() => {
          console.log('[Map] Finished loading map');
          setMapReady(true);
        }}
        onDidFailLoadingMap={(error) => {
          console.error('[Map] Failed to load map:', error);
        }}
      >
        <MapboxGL.Camera 
          ref={cameraRef}
          zoomLevel={17} 
          centerCoordinate={userLocation ? [userLocation.longitude, userLocation.latitude] : BSU_CENTER}
          animationDuration={1000}
        />
        
        <MapboxGL.UserLocation 
          visible={true}
          showsUserHeadingIndicator={true}
        />

        {/* Building Markers - Matching Admin MapEditor style */}
        {mapReady && buildings.length > 0 && (
          <MapboxGL.ShapeSource
            id="buildings-source"
            shape={{
              type: 'FeatureCollection',
              features: buildings.map(b => ({
                type: 'Feature',
                id: b.id,
                properties: { id: b.id, name: b.name },
                geometry: {
                  type: 'Point',
                  coordinates: [b.longitude, b.latitude]
                }
              }))
            }}
            onPress={(e) => {
              if (e.features && e.features.length > 0) {
                const feature = e.features[0];
                const building = buildings.find(b => b.id === feature.properties.id);
                if (building) handleBuildingPress(building);
              }
            }}
          >
            {/* Shadow layer */}
            <MapboxGL.CircleLayer
              id="buildings-shadow"
              style={{
                circleRadius: 10,
                circleColor: 'rgba(0, 0, 0, 0.15)',
                circleTranslate: [1, 2],
                circleBlur: 0.4,
              }}
            />
            {/* Main circle - maroon like admin */}
            <MapboxGL.CircleLayer
              id="buildings-circle"
              style={{
                circleRadius: 12,
                circleColor: '#800000',
                circleStrokeWidth: 2,
                circleStrokeColor: '#FFFFFF',
              }}
            />
            {/* Building icon */}
            <MapboxGL.SymbolLayer
              id="buildings-icon"
              style={{
                iconImage: 'building-15',
                iconSize: 0.7,
                iconColor: '#FFFFFF',
                iconAllowOverlap: true,
              }}
            />
            {/* Building name label */}
            <MapboxGL.SymbolLayer
              id="buildings-label"
              style={{
                textField: ['get', 'name'],
                textSize: 11,
                textFont: ['DIN Pro Medium', 'Arial Unicode MS Regular'],
                textColor: '#374151',
                textHaloColor: '#FFFFFF',
                textHaloWidth: 1.5,
                textOffset: [0, 1.6],
                textAnchor: 'top',
                textMaxWidth: 10,
                textAllowOverlap: false,
                textOptional: true,
              }}
            />
          </MapboxGL.ShapeSource>
        )}
      </MapboxGL.MapView>

      {/* Outside Campus Warning */}
      {isOutsideCampus && (
        <View className="absolute top-12 left-16 right-4 bg-amber-500 p-3 rounded-lg items-center shadow-lg flex-row justify-center">
          <Ionicons name="warning" size={20} color="#fff" style={{ marginRight: 6 }} />
          <Text className="text-white font-bold text-sm">
            You are outside the campus
          </Text>
        </View>
      )}

      {/* Center on User Button */}
      <TouchableOpacity style={styles.centerButton} onPress={centerOnUser}>
        <Ionicons name="locate" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Search Bottom Sheet */}
      <SearchBottomSheet
        ref={bottomSheetRef}
        buildings={buildings}
        onSelectBuilding={handleSearchSelect}
      />
    </View>
  );
};

// Keep minimal styles for shadow (NativeWind shadow classes limited on Android)
const styles = StyleSheet.create({
  menuShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },

  centerButton: {
    position: 'absolute',
    bottom: 200,
    right: 16,
    backgroundColor: '#3b82f6',
    padding: 12,
    borderRadius: 12,
    elevation: 5
  },
  warningBanner: {
    position: 'absolute',
    top: 100,
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
  }
});

export default NavigateScreen;
