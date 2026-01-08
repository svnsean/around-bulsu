import MapboxGL from '@rnmapbox/maps';
import * as Location from 'expo-location';
import { collection, onSnapshot } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../firebase';

MapboxGL.setAccessToken('pk.eyJ1Ijoic3Zuc2VhbiIsImEiOiJjbWh6MXViYmQwaWlvMnJxMW15MW41cWltIn0.Qz2opq51Zz3oj-MGPz7aow');

const NavigateScreen = () => {
  const [userLoc, setUserLoc] = useState(null);
  const [buildings, setBuildings] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [route, setRoute] = useState(null); 
  const [isNavigating, setIsNavigating] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Permission Denied", "Location permission is required for navigation");
        return;
      }
      
      let loc = await Location.getCurrentPositionAsync({});
      setUserLoc([loc.coords.longitude, loc.coords.latitude]);

      Location.watchPositionAsync({
        accuracy: Location.Accuracy.High,
        timeInterval: 2000,
        distanceInterval: 2
      }, (l) => setUserLoc([l.coords.longitude, l.coords.latitude]));
    })();

    const unsubBuildings = onSnapshot(collection(db, 'buildings'), (snap) => 
      setBuildings(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    const unsubNodes = onSnapshot(collection(db, 'nodes'), (snap) => 
      setNodes(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    const unsubEdges = onSnapshot(collection(db, 'edges'), (snap) => 
      setEdges(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );

    return () => { 
      unsubBuildings?.(); 
      unsubNodes?.(); 
      unsubEdges?.(); 
    };
  }, []);

  // Memoized pathfinding function
  const findShortestPath = useCallback(async (targetBuilding) => {
    if (!userLoc || loading) return;
    
    setLoading(true);
    console.log("🚀 Starting Graph Navigation...");

    try {
      // Validate data
      if (nodes.length === 0) {
        throw new Error("No nodes found. Add nodes in Admin site.");
      }
      if (edges.length === 0) {
        throw new Error("No edges found. Add connections in Admin site.");
      }

      // Create node lookup map for O(1) access
      const nodeMap = new Map(nodes.map(node => [node.id, node]));
      
      // Validate edges
      const validEdges = edges.filter(edge => 
        nodeMap.has(edge.from) && nodeMap.has(edge.to)
      );
      
      if (validEdges.length === 0) {
        throw new Error("No valid connections found. Check node IDs in edges.");
      }

      // Find nearest nodes
      const getNearestNode = (lng, lat) => {
        let closest = null;
        let minDist = Infinity;
        for (const node of nodes) {
          const dist = Math.hypot(node.lng - lng, node.lat - lat);
          if (dist < minDist) {
            minDist = dist;
            closest = node;
          }
        }
        return closest;
      };

      const startNode = getNearestNode(userLoc[0], userLoc[1]);
      const endNode = getNearestNode(targetBuilding.longitude, targetBuilding.latitude);

      if (!startNode || !endNode) {
        throw new Error("Could not find start/end nodes.");
      }

      // Build graph with adjacency list
      const graph = new Map();
      for (const node of nodes) {
        graph.set(node.id, { ...node, neighbors: [] });
      }

      for (const edge of validEdges) {
        const fromNode = graph.get(edge.from);
        const toNode = graph.get(edge.to);
        if (fromNode && toNode) {
          fromNode.neighbors.push({ node: edge.to, cost: edge.weight || 1 });
          toNode.neighbors.push({ node: edge.from, cost: edge.weight || 1 });
        }
      }

      // A* algorithm
      const openSet = new Set([startNode.id]);
      const cameFrom = new Map();
      const gScore = new Map();
      const fScore = new Map();
      
      // Initialize scores
      for (const node of nodes) {
        gScore.set(node.id, Infinity);
        fScore.set(node.id, Infinity);
      }
      gScore.set(startNode.id, 0);
      fScore.set(startNode.id, Math.hypot(
        startNode.lng - endNode.lng,
        startNode.lat - endNode.lat
      ));

      const getLowestFScore = () => {
        let lowest = Infinity;
        let lowestId = null;
        for (const id of openSet) {
          const score = fScore.get(id);
          if (score < lowest) {
            lowest = score;
            lowestId = id;
          }
        }
        return lowestId;
      };

      let loopCounter = 0;
      const maxLoops = nodes.length * 2; // Safety limit

      while (openSet.size > 0) {
        loopCounter++;
        if (loopCounter > maxLoops) {
          throw new Error("Path calculation exceeded maximum iterations. Check for graph connectivity.");
        }

        const currentId = getLowestFScore();
        if (!currentId) break;

        if (currentId === endNode.id) {
          // Reconstruct path
          const path = [];
          let current = currentId;
          while (current) {
            const node = graph.get(current);
            path.unshift([node.lng, node.lat]);
            current = cameFrom.get(current);
          }

          // Ensure path has at least 2 points
          if (path.length < 2) {
            path.push([path[0][0] + 0.00001, path[0][1] + 0.00001]);
          }

          const finalRoute = { 
            type: 'FeatureCollection', 
            features: [{ 
              type: 'Feature', 
              properties: {},
              geometry: { 
                type: 'LineString', 
                coordinates: path 
              } 
            }] 
          };

          setRoute(finalRoute);
          setIsNavigating(true);
          setLoading(false);
          return;
        }

        openSet.delete(currentId);

        const currentNode = graph.get(currentId);
        for (const neighbor of currentNode.neighbors) {
          const neighborNode = graph.get(neighbor.node);
          if (!neighborNode) continue;

          const tentativeG = gScore.get(currentId) + neighbor.cost;
          if (tentativeG < gScore.get(neighbor.node)) {
            cameFrom.set(neighbor.node, currentId);
            gScore.set(neighbor.node, tentativeG);
            const h = Math.hypot(
              neighborNode.lng - endNode.lng,
              neighborNode.lat - endNode.lat
            );
            fScore.set(neighbor.node, tentativeG + h);
            
            if (!openSet.has(neighbor.node)) {
              openSet.add(neighbor.node);
            }
          }
        }
      }

      throw new Error("No path found. Check if nodes are connected.");
    } catch (err) {
      console.error("❌ Pathfinding Error:", err.message);
      Alert.alert("Navigation Failed", err.message);
    } finally {
      setLoading(false);
    }
  }, [userLoc, nodes, edges, loading]);

  const edgesGeoJSON = React.useMemo(() => ({
    type: 'FeatureCollection',
    features: edges
      .filter(e => {
        const n1 = nodes.find(n => n.id === e.from);
        const n2 = nodes.find(n => n.id === e.to);
        return n1 && n2;
      })
      .map(e => {
        const n1 = nodes.find(n => n.id === e.from);
        const n2 = nodes.find(n => n.id === e.to);
        return {
          type: 'Feature', 
          geometry: { 
            type: 'LineString', 
            coordinates: [[n1.lng, n1.lat], [n2.lng, n2.lat]] 
          }
        };
      })
  }), [edges, nodes]);

  const nodesGeoJSON = React.useMemo(() => ({
    type: 'FeatureCollection',
    features: nodes.map(n => ({
      type: 'Feature', 
      geometry: { 
        type: 'Point', 
        coordinates: [n.lng, n.lat] 
      }
    }))
  }), [nodes]);

  // Updated route with user connection
  const routeWithUser = React.useMemo(() => {
    if (!route || !userLoc) return route;
    
    const routeCoords = route.features[0].geometry.coordinates;
    if (routeCoords.length === 0) return route;

    // Create new route with user location at start
    const updatedCoords = [userLoc, ...routeCoords];
    
    return {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: updatedCoords
        }
      }]
    };
  }, [route, userLoc]);

  return (
    <View style={styles.container}>
      <MapboxGL.MapView 
        style={styles.map} 
        styleURL={MapboxGL.StyleURL.Street} 
        logoEnabled={false}
        onPress={() => { if(!isNavigating) setSelectedBuilding(null); }}
      >
        <MapboxGL.Camera zoomLevel={18} centerCoordinate={userLoc || [120.8160, 14.8590]} />
        <MapboxGL.UserLocation visible={true} />

        {/* Graph Visuals */}
        <MapboxGL.ShapeSource id="edgesSource" shape={edgesGeoJSON}>
          <MapboxGL.LineLayer 
            id="edgesLayer" 
            style={{ 
              lineColor: '#333', 
              lineWidth: 2, 
              lineOpacity: 0.5 
            }} 
          />
        </MapboxGL.ShapeSource>
        
        <MapboxGL.ShapeSource id="nodesSource" shape={nodesGeoJSON}>
          <MapboxGL.CircleLayer 
            id="nodesLayer" 
            style={{ 
              circleRadius: 4, 
              circleColor: '#007bff' 
            }} 
          />
        </MapboxGL.ShapeSource>

        {/* Route Visualization - now connects to user location */}
        {route && (
          <MapboxGL.ShapeSource id="routeSource" shape={routeWithUser}>
            <MapboxGL.LineLayer 
              id="routeLayer" 
              style={{ 
                lineColor: '#007bff', 
                lineWidth: 6, 
                lineCap: 'round', 
                lineJoin: 'round' 
              }} 
            />
          </MapboxGL.ShapeSource>
        )}

        {buildings.map((b) => (
          <MapboxGL.PointAnnotation 
            key={b.id} 
            id={b.id} 
            coordinate={[b.longitude, b.latitude]}
            onSelected={() => setSelectedBuilding(b)}
          >
            <View style={styles.marker} />
          </MapboxGL.PointAnnotation>
        ))}
      </MapboxGL.MapView>

      {/* Controls */}
      {selectedBuilding && !isNavigating && (
        <View style={styles.infoCard}>
          <View>
            <Text style={styles.cardTitle}>{selectedBuilding.name}</Text>
            <Text style={styles.cardDesc}>Tap GO to calculate path</Text>
          </View>
          <TouchableOpacity 
            style={[styles.goBtn, { backgroundColor: loading ? '#ccc' : '#007BFF' }]} 
            onPress={() => findShortestPath(selectedBuilding)}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.goBtnText}>GO 🚶</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {isNavigating && selectedBuilding && (
        <View style={styles.navBox}>
          <Text style={styles.navText}>Navigate to: {selectedBuilding.name}</Text>
          <TouchableOpacity 
            onPress={() => { 
              setRoute(null); 
              setIsNavigating(false); 
              setSelectedBuilding(null); 
            }}
          >
            <Text style={styles.cancelBtn}>Stop</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  marker: { 
    width: 20, 
    height: 20, 
    borderRadius: 10, 
    backgroundColor: 'red', 
    borderWidth: 2, 
    borderColor: 'white' 
  },
  infoCard: {
    position: 'absolute', 
    bottom: 20, 
    left: 20, 
    right: 20,
    backgroundColor: 'white', 
    padding: 20, 
    borderRadius: 15,
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    elevation: 10, 
    shadowColor: '#000', 
    shadowOpacity: 0.2, 
    shadowOffset: {width:0, height:2}
  },
  cardTitle: { 
    fontWeight: 'bold', 
    fontSize: 18, 
    color: '#333' 
  },
  cardDesc: { 
    color: '#666', 
    fontSize: 12 
  },
  goBtn: { 
    paddingVertical: 10, 
    paddingHorizontal: 20, 
    borderRadius: 8 
  },
  goBtnText: { 
    color: 'white', 
    fontWeight: 'bold' 
  },
  navBox: { 
    position: 'absolute', 
    top: 50, 
    left: 20, 
    right: 20, 
    backgroundColor: 'white', 
    padding: 15, 
    borderRadius: 10, 
    elevation: 5, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  navText: { 
    fontWeight: 'bold', 
    fontSize: 16 
  },
  cancelBtn: { 
    color: 'red', 
    fontWeight: 'bold' 
  }
});

export default NavigateScreen;