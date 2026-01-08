import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { Magnetometer } from 'expo-sensors';
import { collection, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { db } from '../firebase';

const { width, height } = Dimensions.get('window');

const ARScreen = () => {
  const [permission, requestPermission] = useCameraPermissions();
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [heading, setHeading] = useState(0);
  const [buildings, setBuildings] = useState([]);

  // 1. SETUP SENSORS
  useEffect(() => {
    (async () => {
      if (!permission?.granted) await requestPermission();
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      setHasLocationPermission(true);

      Location.watchPositionAsync({
        accuracy: Location.Accuracy.High,
        timeInterval: 1000,
        distanceInterval: 1
      }, (location) => setUserLocation(location.coords));

      Magnetometer.setUpdateInterval(100);
      Magnetometer.addListener((data) => {
        let angle = Math.atan2(data.y, data.x) * (180 / Math.PI);
        angle = angle - 90; 
        if (angle < 0) angle += 360;
        setHeading(angle);
      });
    })();

    const unsubscribe = onSnapshot(collection(db, 'buildings'), (snapshot) => {
      setBuildings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  // 2. BEARING MATH (Direction)
  const getBearing = (startLat, startLng, destLat, destLng) => {
    const startLatRad = (startLat * Math.PI) / 180;
    const startLngRad = (startLng * Math.PI) / 180;
    const destLatRad = (destLat * Math.PI) / 180;
    const destLngRad = (destLng * Math.PI) / 180;
    const y = Math.sin(destLngRad - startLngRad) * Math.cos(destLatRad);
    const x = Math.cos(startLatRad) * Math.sin(destLatRad) -
              Math.sin(startLatRad) * Math.cos(destLatRad) * Math.cos(destLngRad - startLngRad);
    return (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360;
  };

  // 3. DISTANCE MATH (Haversine Formula)
  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Returns distance in meters
  };

  if (!permission?.granted || !hasLocationPermission) {
    return <View style={styles.center}><Text>Waiting for Permissions...</Text></View>;
  }

  return (
    <View style={styles.container}>
      
      {/* LAYER 1: THE CAMERA (BACKGROUND) */}
      <CameraView style={StyleSheet.absoluteFill} facing="back" />

      {/* LAYER 2: THE AR OVERLAY (FOREGROUND) */}
      <View style={styles.overlayLayer} pointerEvents="none">
        
        {/* Debug Box */}
        <View style={styles.debugBox}>
          <Text style={styles.debugText}>Heading: {Math.round(heading)}°</Text>
        </View>

        {/* AR Labels */}
        {userLocation && buildings.map((building) => {
          if (!building.latitude || !building.longitude) return null;

          // Calculate Bearing
          const bearing = getBearing(
            userLocation.latitude, userLocation.longitude, 
            building.latitude, building.longitude
          );

          // Calculate Distance <--- ADDED THIS
          const distanceMeters = getDistance(
            userLocation.latitude, userLocation.longitude,
            building.latitude, building.longitude
          );

          const diff = Math.abs(heading - bearing);
          const isVisible = diff < 30 || diff > 330; 

          if (isVisible) {
            let offset = (heading - bearing);
            if (offset > 180) offset -= 360;
            if (offset < -180) offset += 360;
            
            // Adjust position based on angle
            const leftPosition = (width / 2) + (offset * 12); 

            return (
              <View key={building.id} style={[styles.arLabel, { left: leftPosition }]}>
                <Text style={styles.buildingName}>{building.name}</Text>
                
                {/* DISPLAY DISTANCE HERE */}
                <Text style={styles.distance}>
                   📍 {Math.round(distanceMeters)} meters away
                </Text>
              </View>
            );
          }
          return null;
        })}
      </View>

    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  // This makes the UI layer sit ON TOP of the camera
  overlayLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },

  debugBox: { 
    position: 'absolute', top: 50, left: 20, 
    backgroundColor: 'rgba(0,0,0,0.5)', padding: 10, borderRadius: 5 
  },
  debugText: { color: 'white' },
  
  arLabel: {
    position: 'absolute',
    top: height / 2 - 50, 
    backgroundColor: 'rgba(0, 123, 255, 0.9)', 
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    width: 150,
    transform: [{ translateX: -75 }],
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  buildingName: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  distance: { color: 'white', fontSize: 12 }
});

export default ARScreen;