// src/screens/BuildingInfoScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import { Card, Icon } from '../components/ui';
import { findPath, pathToGeoJSON, getPathBounds, getDistance } from '../lib/pathfinding';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

MapboxGL.setAccessToken('pk.eyJ1Ijoic3Zuc2VhbiIsImEiOiJjbWh6MXViYmQwaWlvMnJxMW15MW41cWltIn0.Qz2opq51Zz3oj-MGPz7aow');

const BuildingInfoScreen = ({ route, navigation }) => {
  const { building, userLocation, nodes, edges, blockages = [] } = route.params;
  const userCoords = Array.isArray(userLocation)
    ? userLocation
    : userLocation
      ? [userLocation.longitude, userLocation.latitude]
      : null;
  const [distance, setDistance] = useState(null);
  const [pathPreview, setPathPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [launchingAR, setLaunchingAR] = useState(false);
  const [calculatedPath, setCalculatedPath] = useState([]);
  const [mapBounds, setMapBounds] = useState(null);
  const cameraRef = React.useRef(null);
  const scrollViewRef = React.useRef(null);

  // Scroll to top on mount
  useEffect(() => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
  }, []);

  // Get building images (use actual images from Firebase or empty array)
  const buildingImages = building.images && building.images.length > 0 ? building.images : [];

  useEffect(() => {
    calculateDistance();
    generatePathPreview();
  }, []);

  // Calculate distance from user to building
  const calculateDistance = () => {
    if (!userCoords) return;
    const meters = getDistance(userCoords[1], userCoords[0], building.latitude, building.longitude);
    setDistance(Math.round(meters));
  };

  // Generate path preview using the shared pathfinding utility
  const generatePathPreview = () => {
    if (!userCoords || !nodes || !edges || nodes.length === 0) {
      console.log('[BuildingInfo] Cannot generate path preview - missing data:', {
        hasUserCoords: !!userCoords,
        nodesCount: nodes?.length || 0,
        edgesCount: edges?.length || 0
      });
      return;
    }

    setLoading(true);
    
    console.log('[BuildingInfo] Generating path preview:', {
      from: userCoords,
      to: [building.longitude, building.latitude],
      nodes: nodes.length,
      edges: edges.length,
      blockages: blockages?.length || 0
    });

    try {
      // Use the shared pathfinding utility
      const result = findPath({
        startCoords: userCoords,
        endCoords: [building.longitude, building.latitude],
        nodes,
        edges,
        blockages,
        includeEndpoints: true
      });

      if (result.error) {
        console.warn('Pathfinding warning:', result.error);
        console.log('[BuildingInfo] Start node found:', result.startNode?.id);
        console.log('[BuildingInfo] End node found:', result.endNode?.id);
        // Fallback to direct line if no path found
        const fallbackPath = [userCoords, [building.longitude, building.latitude]];
        setPathPreview(pathToGeoJSON(fallbackPath));
        setMapBounds(getPathBounds(fallbackPath));
        setCalculatedPath(fallbackPath.map(([lng, lat]) => ({ lat, lng })));
      } else {
        console.log('[BuildingInfo] Path found with', result.path.length, 'points, distance:', result.distance, 'm');
        setPathPreview(pathToGeoJSON(result.path));
        setMapBounds(getPathBounds(result.path));
        // Store path nodes for AR navigation
        setCalculatedPath(result.path.map(([lng, lat]) => ({ lat, lng })));
        // Update distance with actual path distance
        if (result.distance > 0) {
          setDistance(result.distance);
        }
      }
    } catch (error) {
      console.error('Error generating path preview:', error);
    } finally {
      setLoading(false);
    }
  };

  // Start AR Navigation
  const handleStartNavigation = () => {
    navigation.navigate('ARNavigation', {
      building,
      userLocation: userCoords,
      nodes,
      edges,
      blockages,
    });
  };

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-12 pb-3 bg-white border-b border-gray-100">
        <TouchableOpacity 
          className="w-10 h-10 items-center justify-center"
          onPress={() => navigation.goBack()}
        >
          <Icon name="chevron-left" size={28} color="#800000" />
        </TouchableOpacity>
        <Text className="flex-1 text-lg font-semibold text-gray-800 text-center mx-3" numberOfLines={1}>
          {building.name}
        </Text>
        <View className="w-10" />
      </View>

      <ScrollView ref={scrollViewRef} className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Image Gallery - only show if building has images */}
        {buildingImages.length > 0 && (
          <ScrollView 
            horizontal 
            pagingEnabled 
            showsHorizontalScrollIndicator={false}
            style={{ height: 220 }}
          >
            {buildingImages.map((uri, index) => (
              <Image
                key={index}
                source={{ uri }}
                style={{ width: SCREEN_WIDTH, height: 220 }}
                resizeMode="cover"
              />
            ))}
          </ScrollView>
        )}

        {/* Building Info */}
        <View className="p-5">
          <Text className="text-2xl font-bold text-gray-800 mb-3">
            {building.name}
          </Text>
          
          {distance !== null && (
            <View className="flex-row items-center mb-4">
              <Icon name="map-pin" size={18} color="#800000" style={{ marginRight: 6 }} />
              <Text className="text-base text-maroon-800 font-semibold">
                {distance} meters away
              </Text>
            </View>
          )}

          {building.description && (
            <Text className="text-base text-gray-600 leading-6">
              {building.description}
            </Text>
          )}
        </View>

        {/* Map Preview - Larger with full path bounds */}
        <View className="px-5 mb-5">
          <Text className="text-lg font-bold text-gray-800 mb-3">
            Route Preview
          </Text>
          <Card className="h-72 overflow-hidden rounded-2xl">
            {loading ? (
              <View className="flex-1 items-center justify-center bg-gray-50">
                <ActivityIndicator size="large" color="#800000" />
                <Text className="text-gray-500 text-sm mt-3">Calculating route...</Text>
              </View>
            ) : (
              <MapboxGL.MapView
                style={{ flex: 1 }}
                styleURL={MapboxGL.StyleURL.Street}
                logoEnabled={false}
                scrollEnabled={false}
                pitchEnabled={false}
                rotateEnabled={false}
              >
                <MapboxGL.Camera
                  ref={cameraRef}
                  bounds={mapBounds ? {
                    ne: mapBounds.ne,
                    sw: mapBounds.sw,
                    paddingTop: 40,
                    paddingBottom: 40,
                    paddingLeft: 40,
                    paddingRight: 40,
                  } : undefined}
                  centerCoordinate={!mapBounds ? (userCoords || [building.longitude, building.latitude]) : undefined}
                  zoomLevel={!mapBounds ? 16 : undefined}
                  animationDuration={500}
                />

                {/* Path preview */}
                {pathPreview && (
                  <MapboxGL.ShapeSource id="pathPreview" shape={pathPreview}>
                    <MapboxGL.LineLayer
                      id="pathPreviewLayer"
                      style={{
                        lineColor: '#800000',
                        lineWidth: 5,
                        lineCap: 'round',
                        lineJoin: 'round',
                      }}
                    />
                  </MapboxGL.ShapeSource>
                )}

                {/* User location marker */}
                {userCoords && (
                  <MapboxGL.PointAnnotation
                    id="userMarker"
                    coordinate={userCoords}
                  >
                    <View className="w-5 h-5 rounded-full bg-blue-500 border-3 border-white shadow-lg items-center justify-center">
                      <View className="w-2 h-2 rounded-full bg-white" />
                    </View>
                  </MapboxGL.PointAnnotation>
                )}

                {/* Building marker */}
                <MapboxGL.PointAnnotation
                  id="buildingMarker"
                  coordinate={[building.longitude, building.latitude]}
                >
                  <View className="items-center">
                    <View className="w-8 h-8 rounded-full bg-maroon-800 border-3 border-white shadow-lg items-center justify-center">
                      <Icon name="flag" size={14} color="#FFFFFF" />
                    </View>
                    <View className="w-0 h-0 border-l-4 border-r-4 border-t-8 border-l-transparent border-r-transparent border-t-maroon-800 -mt-0.5" />
                  </View>
                </MapboxGL.PointAnnotation>
              </MapboxGL.MapView>
            )}
          </Card>
          {distance && !loading && (
            <View className="flex-row items-center justify-center mt-3 bg-gray-100 py-2 px-4 rounded-full self-center">
              <Icon name="navigate" size={14} color="#800000" style={{ marginRight: 6 }} />
              <Text className="text-sm text-gray-700">
                <Text className="font-bold text-maroon-800">{distance}m</Text> walking distance
              </Text>
            </View>
          )}
        </View>

        {/* Facilities & Rooms */}
        {building.rooms && building.rooms.length > 0 && (
          <View className="px-5 mb-52">
            <Text className="text-lg font-bold text-gray-800 mb-3">
              Facilities & Rooms ({building.rooms.length})
            </Text>
            <View className="flex-row flex-wrap mt-2">
              {building.rooms.map((room, index) => (
                <View 
                  key={index} 
                  className="flex-row items-center bg-gray-100 px-3 py-2 rounded-lg mr-2 mb-2"
                >
                  <Icon name="door" size={14} color="#6B7280" style={{ marginRight: 6 }} />
                  <Text className="text-sm text-gray-800">{room}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom Navigation Button - positioned above floating tab bar */}
      <View className="absolute bottom-24 left-0 right-0 p-5 bg-white border-t border-gray-100 shadow-lg">
        <TouchableOpacity
          className={`flex-row items-center justify-center py-4 rounded-xl ${launchingAR ? 'bg-gray-400' : 'bg-maroon-800 active:bg-maroon-900'}`}
          onPress={handleStartNavigation}
          disabled={launchingAR}
        >
          {launchingAR ? (
            <>
              <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text className="text-white text-lg font-bold">
                Launching AR...
              </Text>
            </>
          ) : (
            <>
              <Icon name="navigate" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text className="text-white text-lg font-bold">
                Start AR Navigation
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default BuildingInfoScreen;
