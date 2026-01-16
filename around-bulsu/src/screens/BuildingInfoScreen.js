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

    const R = 6371e3; // Earth radius in meters
    const φ1 = userCoords[1] * Math.PI / 180;
    const φ2 = building.latitude * Math.PI / 180;
    const Δφ = (building.latitude - userCoords[1]) * Math.PI / 180;
    const Δλ = (building.longitude - userCoords[0]) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const meters = R * c;
    setDistance(Math.round(meters));
  };

  // Generate path preview with full A* and calculate bounds
  const generatePathPreview = () => {
    if (!userCoords || !nodes || !edges || nodes.length === 0) {
      return;
    }

    setLoading(true);

    try {
      // Build graph
      const graph = new Map();
      nodes.forEach(n => graph.set(n.id, { ...n, neighbors: [] }));
      
      const nodesMap = {};
      nodes.forEach(n => { nodesMap[n.id] = n; });
      
      const activeBlockages = (blockages || []).filter(b => b.active);
      
      edges.forEach(e => {
        if (graph.has(e.from) && graph.has(e.to)) {
          const fromNode = nodesMap[e.from];
          const toNode = nodesMap[e.to];
          if (fromNode && toNode) {
            const midLng = (fromNode.lng + toNode.lng) / 2;
            const midLat = (fromNode.lat + toNode.lat) / 2;
            const isBlocked = activeBlockages.some(blockage => {
              if (!blockage.points || blockage.points.length < 3) return false;
              return isPointInPolygon(midLng, midLat, blockage.points);
            });
            if (isBlocked) return;
          }
          graph.get(e.from).neighbors.push({ node: e.to, cost: e.weight || 1 });
          graph.get(e.to).neighbors.push({ node: e.from, cost: e.weight || 1 });
        }
      });

      // Find nearest nodes
      let startNode = null, endNode = null, minStart = Infinity, minEnd = Infinity;
      nodes.forEach(n => {
        const dUser = getDistanceMeters(userCoords[1], userCoords[0], n.lat, n.lng);
        const dDest = getDistanceMeters(building.latitude, building.longitude, n.lat, n.lng);
        if (dUser < minStart) { minStart = dUser; startNode = n; }
        if (dDest < minEnd) { minEnd = dDest; endNode = n; }
      });

      if (!startNode || !endNode) {
        setLoading(false);
        return;
      }

      // A* pathfinding
      const openSet = new Set([startNode.id]);
      const closedSet = new Set();
      const cameFrom = new Map();
      const gScore = new Map(), fScore = new Map();
      nodes.forEach(n => { gScore.set(n.id, Infinity); fScore.set(n.id, Infinity); });
      gScore.set(startNode.id, 0);
      fScore.set(startNode.id, getDistanceMeters(startNode.lat, startNode.lng, endNode.lat, endNode.lng));

      let pathCoordinates = [];

      while (openSet.size > 0) {
        let current = null, lowest = Infinity;
        for (const id of openSet) {
          if (fScore.get(id) < lowest) { lowest = fScore.get(id); current = id; }
        }
        
        if (current === endNode.id) {
          // Reconstruct path
          let c = current;
          while (c) {
            const node = graph.get(c);
            pathCoordinates.unshift([node.lng, node.lat]);
            c = cameFrom.get(c);
          }
          break;
        }
        
        openSet.delete(current);
        closedSet.add(current);
        
        const currentNode = graph.get(current);
        if (!currentNode) continue;
        
        for (const neighbor of currentNode.neighbors) {
          if (closedSet.has(neighbor.node)) continue;
          const tentativeG = gScore.get(current) + neighbor.cost;
          if (!openSet.has(neighbor.node)) openSet.add(neighbor.node);
          else if (tentativeG >= gScore.get(neighbor.node)) continue;
          cameFrom.set(neighbor.node, current);
          gScore.set(neighbor.node, tentativeG);
          const neighborNode = graph.get(neighbor.node);
          fScore.set(neighbor.node, tentativeG + getDistanceMeters(neighborNode.lat, neighborNode.lng, endNode.lat, endNode.lng));
        }
      }

      // Add user location and building as start/end
      if (pathCoordinates.length > 0) {
        pathCoordinates.unshift(userCoords);
        pathCoordinates.push([building.longitude, building.latitude]);
      } else {
        // Fallback: direct line if no path found
        pathCoordinates = [
          userCoords,
          [building.longitude, building.latitude]
        ];
      }

      const previewPath = {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: pathCoordinates
          }
        }]
      };

      setPathPreview(previewPath);

      // Calculate bounds for the entire path with padding
      let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
      pathCoordinates.forEach(([lng, lat]) => {
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
      });

      // Add padding to bounds (approximately 50 meters in degrees)
      const padding = 0.0005;
      setMapBounds({
        ne: [maxLng + padding, maxLat + padding],
        sw: [minLng - padding, minLat - padding]
      });

      // Store path nodes for AR
      const pathNodes = pathCoordinates.map(([lng, lat]) => ({ lat, lng }));
      setCalculatedPath(pathNodes);
    } catch (error) {
      console.error('Error generating path preview:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate full A* path for Unity AR
  const calculateFullPath = () => {
    if (!userCoords || !nodes || !edges || nodes.length === 0) {
      return [];
    }

    try {
      // Build graph
      const graph = new Map();
      nodes.forEach(n => graph.set(n.id, { ...n, neighbors: [] }));
      
      // Create nodesMap for blockage checking
      const nodesMap = {};
      nodes.forEach(n => { nodesMap[n.id] = n; });
      
      // Get active blockages
      const activeBlockages = (blockages || []).filter(b => b.active);
      
      edges.forEach(e => {
        if (graph.has(e.from) && graph.has(e.to)) {
          // Check if edge passes through blockage
          const fromNode = nodesMap[e.from];
          const toNode = nodesMap[e.to];
          if (fromNode && toNode) {
            const midLng = (fromNode.lng + toNode.lng) / 2;
            const midLat = (fromNode.lat + toNode.lat) / 2;
            const isBlocked = activeBlockages.some(blockage => {
              if (!blockage.points || blockage.points.length < 3) return false;
              return isPointInPolygon(midLng, midLat, blockage.points);
            });
            if (isBlocked) return;
          }
          
          graph.get(e.from).neighbors.push({ node: e.to, cost: e.weight || 1 });
          graph.get(e.to).neighbors.push({ node: e.from, cost: e.weight || 1 });
        }
      });

      // Find nearest nodes to start and end
      let startNode = null, endNode = null, minStart = Infinity, minEnd = Infinity;
      nodes.forEach(n => {
        const dUser = getDistanceMeters(userCoords[1], userCoords[0], n.lat, n.lng);
        const dDest = getDistanceMeters(building.latitude, building.longitude, n.lat, n.lng);
        if (dUser < minStart) { minStart = dUser; startNode = n; }
        if (dDest < minEnd) { minEnd = dDest; endNode = n; }
      });

      if (!startNode || !endNode) return [];

      // A* pathfinding
      const openSet = new Set([startNode.id]);
      const closedSet = new Set();
      const cameFrom = new Map();
      const gScore = new Map(), fScore = new Map();
      nodes.forEach(n => { gScore.set(n.id, Infinity); fScore.set(n.id, Infinity); });
      gScore.set(startNode.id, 0);
      fScore.set(startNode.id, getDistanceMeters(startNode.lat, startNode.lng, endNode.lat, endNode.lng));

      while (openSet.size > 0) {
        let current = null, lowest = Infinity;
        for (const id of openSet) {
          if (fScore.get(id) < lowest) { lowest = fScore.get(id); current = id; }
        }
        
        if (current === endNode.id) {
          // Reconstruct path
          const path = [];
          let c = current;
          while (c) {
            const node = graph.get(c);
            path.unshift({ lat: node.lat, lng: node.lng });
            c = cameFrom.get(c);
          }
          return path;
        }
        
        openSet.delete(current);
        closedSet.add(current);
        
        const currentNode = graph.get(current);
        if (!currentNode) continue;
        
        for (const neighbor of currentNode.neighbors) {
          if (closedSet.has(neighbor.node)) continue;
          
          const tentativeG = gScore.get(current) + neighbor.cost;
          if (!openSet.has(neighbor.node)) openSet.add(neighbor.node);
          else if (tentativeG >= gScore.get(neighbor.node)) continue;
          
          cameFrom.set(neighbor.node, current);
          gScore.set(neighbor.node, tentativeG);
          const neighborNode = graph.get(neighbor.node);
          fScore.set(neighbor.node, tentativeG + getDistanceMeters(neighborNode.lat, neighborNode.lng, endNode.lat, endNode.lng));
        }
      }
      
      return [];
    } catch (error) {
      console.error('Error calculating full path:', error);
      return [];
    }
  };

  // Helper: Point in polygon check
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

  // Helper: Calculate distance in meters
  const getDistanceMeters = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3;
    const p1 = lat1 * Math.PI / 180;
    const p2 = lat2 * Math.PI / 180;
    const dp = (lat2 - lat1) * Math.PI / 180;
    const dl = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dp/2) * Math.sin(dp/2) +
              Math.cos(p1) * Math.cos(p2) *
              Math.sin(dl/2) * Math.sin(dl/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Start AR Navigation
  const handleStartNavigation = () => {
    navigation.navigate('ARNavigation', {
      building,
      userCoords,
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
