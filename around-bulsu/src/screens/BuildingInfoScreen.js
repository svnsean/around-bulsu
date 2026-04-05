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
import { subscribeToTable } from '../supabase';
import { useSettings } from '../context/SettingsContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Mapbox is initialized in App.js

const BuildingInfoScreen = ({ route, navigation }) => {
  const { building, userLocation, nodes, edges, blockages = [] } = route.params;
  const { mapStyle, colors } = useSettings();
  // Detect if navigated from Info tab (InfoStack has no ARNavigation screen)
  const fromInfoTab = navigation.getState()?.routes?.[0]?.name === 'InfoMain';
  const userCoords = Array.isArray(userLocation)
    ? userLocation
    : userLocation
      ? [userLocation.longitude, userLocation.latitude]
      : null;
  const [liveBlockages, setLiveBlockages] = useState(blockages);
  const [distance, setDistance] = useState(null);
  const [pathPreview, setPathPreview] = useState(null);
  const [userConnectorLine, setUserConnectorLine] = useState(null);  // Dotted line from user to first node
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

  // Subscribe to live blockages from Supabase
  useEffect(() => {
    const unsub = subscribeToTable('blockages', (data) => {
      setLiveBlockages(data.filter(b => b.active));
    });
    return () => unsub();
  }, []);

  // Get building images (use actual images from Firebase or empty array)
  const buildingImages = building.images && building.images.length > 0 ? building.images : [];

  useEffect(() => {
    calculateDistance();
    generatePathPreview();
  }, [liveBlockages]);

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
      blockages: liveBlockages?.length || 0
    });

    try {
      // Use the shared pathfinding utility
      const result = findPath({
        startCoords: userCoords,
        endCoords: [building.longitude, building.latitude],
        nodes,
        edges,
        blockages: liveBlockages,
        includeEndpoints: true
      });

      if (result.error) {
        console.warn('Pathfinding warning:', result.error);
        console.log('[BuildingInfo] Start node found:', result.startNode?.id);
        console.log('[BuildingInfo] End node found:', result.endNode?.id);
        // Fallback to direct line if no path found
        const fallbackPath = [userCoords, [building.longitude, building.latitude]];
        setPathPreview(pathToGeoJSON(fallbackPath));
        setUserConnectorLine(null);  // No connector needed for fallback
        setMapBounds(getPathBounds(fallbackPath));
        setCalculatedPath(fallbackPath.map(([lng, lat]) => ({ lat, lng })));
      } else {
        console.log('[BuildingInfo] Path found with', result.path.length, 'points, distance:', result.distance, 'm');
        
        // Main path (solid line) - only graph nodes
        setPathPreview(pathToGeoJSON(result.path));
        
        // User connector line (dotted) - from user to first path node
        if (result.userStartPoint && result.path.length > 0) {
          const connectorPath = [result.userStartPoint, result.path[0]];
          setUserConnectorLine(pathToGeoJSON(connectorPath));
        } else {
          setUserConnectorLine(null);
        }
        
        // Include user position in bounds calculation
        const fullPath = result.userStartPoint 
          ? [result.userStartPoint, ...result.path]
          : result.path;
        setMapBounds(getPathBounds(fullPath));
        
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
      blockages: liveBlockages,
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 48, paddingBottom: 12, backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <TouchableOpacity 
          className="w-10 h-10 items-center justify-center"
          onPress={() => navigation.goBack()}
        >
          <Icon name="chevron-left" size={28} color="#B22222" />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 18, fontWeight: '600', color: colors.textPrimary, textAlign: 'center', marginHorizontal: 12 }} numberOfLines={1}>
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
          <Text style={{ fontSize: 24, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 }}>
            {building.name}
          </Text>
          
          {distance !== null && (
            <View className="flex-row items-center mb-4">
              <Icon name="map-pin" size={18} color="#B22222" style={{ marginRight: 6 }} />
              <Text className="text-base text-maroon-800 font-semibold">
                {distance} meters away
              </Text>
            </View>
          )}

          {building.description && (
            <Text style={{ fontSize: 16, color: colors.textSecondary, lineHeight: 24 }}>
              {building.description}
            </Text>
          )}
        </View>

        {/* Map Preview - Larger with full path bounds */}
        <View className="px-5 mb-5">
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 }}>
            {fromInfoTab ? 'Location' : 'Route Preview'}
          </Text>
          <Card className="h-72 overflow-hidden rounded-2xl">
            {loading ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }}>
                <ActivityIndicator size="large" color="#B22222" />
                <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 12 }}>Calculating route...</Text>
              </View>
            ) : (
              <MapboxGL.MapView
                style={{ flex: 1 }}
                styleURL={mapStyle}
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

                {/* User connector line (dotted) - from user to first path node */}
                {userConnectorLine && (
                  <MapboxGL.ShapeSource id="userConnector" shape={userConnectorLine}>
                    <MapboxGL.LineLayer
                      id="userConnectorLayer"
                      style={{
                        lineColor: '#B22222',
                        lineWidth: 4,
                        lineCap: 'round',
                        lineJoin: 'round',
                        lineDasharray: [2, 3],  // Dotted pattern
                        lineOpacity: 0.7,
                      }}
                    />
                  </MapboxGL.ShapeSource>
                )}

                {/* Path preview (solid) - actual path nodes */}
                {pathPreview && (
                  <MapboxGL.ShapeSource id="pathPreview" shape={pathPreview}>
                    <MapboxGL.LineLayer
                      id="pathPreviewLayer"
                      style={{
                        lineColor: '#B22222',
                        lineWidth: 5,
                        lineCap: 'round',
                        lineJoin: 'round',
                      }}
                    />
                  </MapboxGL.ShapeSource>
                )}

                {/* User location marker */}
                {userCoords && (
                  <MapboxGL.LocationPuck />
                )}

                {/* Building marker — location pin */}
                <MapboxGL.PointAnnotation
                  id="buildingMarker"
                  coordinate={[building.longitude, building.latitude]}
                >
                  <View className="items-center">
                    <View className="w-8 h-8 rounded-full bg-maroon-800 border-3 border-white shadow-lg items-center justify-center">
                      <Icon name="map-pin" size={14} color="#FFFFFF" />
                    </View>
                    <View className="w-0 h-0 border-l-4 border-r-4 border-t-8 border-l-transparent border-r-transparent border-t-maroon-800 -mt-0.5" />
                  </View>
                </MapboxGL.PointAnnotation>
              </MapboxGL.MapView>
            )}
          </Card>
        </View>

        {/* Rooms Section */}
        {building.rooms && building.rooms.length > 0 && (
          <View className="px-5 mb-4">
            <Text className="text-lg font-bold text-gray-800 mb-3">
              Rooms ({building.rooms.length})
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

        {/* Facilities Section */}
        {building.facilities && building.facilities.length > 0 && (
          <View className="px-5 mb-52">
            <Text className="text-lg font-bold text-gray-800 mb-3">
              Facilities ({building.facilities.length})
            </Text>
            <View className="flex-row flex-wrap mt-2">
              {building.facilities.map((facility, index) => (
                <View 
                  key={index} 
                  className="flex-row items-center bg-green-100 px-3 py-2 rounded-lg mr-2 mb-2"
                >
                  <Icon name="info" size={14} color="#059669" style={{ marginRight: 6 }} />
                  <Text className="text-sm text-green-800">{facility}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Bottom spacer when no facilities */}
        {(!building.facilities || building.facilities.length === 0) && building.rooms && building.rooms.length > 0 && (
          <View className="mb-48" />
        )}
      </ScrollView>

      {/* Start AR Navigation Button — pill style, hidden when from Info tab */}
      {!fromInfoTab && (
        <View style={{ position: 'absolute', bottom: 20, right: 16 }}>
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: launchingAR ? '#9CA3AF' : '#B22222',
              paddingHorizontal: 20,
              height: 48,
              borderRadius: 24,
              elevation: 10,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 4,
            }}
            onPress={handleStartNavigation}
            disabled={launchingAR}
          >
            {launchingAR ? (
              <>
                <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700', fontFamily: 'Inter_700Bold' }}>
                  Launching...
                </Text>
              </>
            ) : (
              <>
                <Icon name="navigate" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700', fontFamily: 'Inter_700Bold' }}>
                  Start AR
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

export default BuildingInfoScreen;
