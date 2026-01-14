// src/screens/NavigateScreen.js
import MapboxGL from '@rnmapbox/maps';
import * as Location from 'expo-location';
import { collection, onSnapshot } from 'firebase/firestore';
import React, { useEffect, useState, useRef } from 'react';
import { View, Alert, ActivityIndicator, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { DrawerActions } from '@react-navigation/native';
import { db } from '../firebase';
import SearchBottomSheet from '../components/SearchBottomSheet';
import { Icon } from '../components/ui';

MapboxGL.setAccessToken('pk.eyJ1Ijoic3Zuc2VhbiIsImEiOiJjbWh6MXViYmQwaWlvMnJxMW15MW41cWltIn0.Qz2opq51Zz3oj-MGPz7aow');

const BSU_CENTER = [120.813778, 14.857830]; // From admin site

const NavigateScreen = ({ navigation }) => {
  const [userLocation, setUserLocation] = useState(null);
  const [buildings, setBuildings] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [blockages, setBlockages] = useState([]);
  const [isOutsideCampus, setIsOutsideCampus] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const bottomSheetRef = useRef(null);

  // Location tracking
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Permission Denied", "Location permission is required for navigation");
        return;
      }
      
      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });
      
      const coords = [location.coords.longitude, location.coords.latitude];
      setUserLocation(coords);
      checkIfOutsideCampus(coords);

      // Watch position
      Location.watchPositionAsync({
        accuracy: Location.Accuracy.High,
        timeInterval: 2000,
        distanceInterval: 5
      }, (loc) => {
        const newCoords = [loc.coords.longitude, loc.coords.latitude];
        setUserLocation(newCoords);
        checkIfOutsideCampus(newCoords);
      });
    })();
  }, []);

  // Firebase listeners
  useEffect(() => {
    const unsubBuildings = onSnapshot(collection(db, 'buildings'), (snap) => {
      setBuildings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setIsLoading(false);
    });
    const unsubNodes = onSnapshot(collection(db, 'nodes'), (snap) => 
      setNodes(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    const unsubEdges = onSnapshot(collection(db, 'edges'), (snap) => 
      setEdges(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    const unsubBlockages = onSnapshot(collection(db, 'blockages'), (snap) => 
      setBlockages(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );

    return () => { 
      unsubBuildings?.(); 
      unsubNodes?.(); 
      unsubEdges?.();
      unsubBlockages?.();
    };
  }, []);

  // Check if user is outside BSU campus (rough boundary check)
  const checkIfOutsideCampus = (coords) => {
    if (!coords) return;
    
    const [lng, lat] = coords;
    // BSU rough boundaries (adjust as needed)
    const bounds = {
      north: 14.860,
      south: 14.855,
      east: 120.816,
      west: 120.811
    };

    const outside = lat > bounds.north || lat < bounds.south || 
                    lng > bounds.east || lng < bounds.west;
    
    setIsOutsideCampus(outside);
  };

  // Handle building pin click
  const handleBuildingPress = (building) => {
    navigation.navigate('BuildingInfo', { 
      building,
      userLocation,
      nodes,
      edges,
      blockages
    });
  };

  // Handle search result selection
  const handleSearchSelect = (building) => {
    bottomSheetRef.current?.close();
    navigation.navigate('BuildingInfo', { 
      building,
      userLocation,
      nodes,
      edges,
      blockages
    });
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
        <Icon name="menu" size={22} color="#800000" />
      </TouchableOpacity>

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

        {/* Building Markers */}
        {buildings.map((building) => (
          <MapboxGL.PointAnnotation 
            key={building.id} 
            id={building.id} 
            coordinate={[building.longitude, building.latitude]}
            onSelected={() => handleBuildingPress(building)}
          >
            <View className="w-8 h-8 items-center justify-center">
              <View 
                className="w-5 h-5 rounded-full bg-maroon-800 border-2 border-white"
                style={styles.markerShadow}
              />
            </View>
          </MapboxGL.PointAnnotation>
        ))}
      </MapboxGL.MapView>

      {/* Outside Campus Warning */}
      {isOutsideCampus && (
        <View className="absolute top-12 left-16 right-4 bg-amber-500 p-3 rounded-lg items-center shadow-lg flex-row justify-center">
          <Icon name="alert" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text className="text-white font-bold text-sm">
            You are outside BSU Campus
          </Text>
        </View>
      )}

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
  markerShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
});

export default NavigateScreen;
