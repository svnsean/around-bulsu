// EmergencyManager.js - Evacuation Zones, Blockages & Path Testing with Tailwind UI
import React, { useState, useEffect, useCallback } from 'react';
import Map, { Source, Layer, Marker } from 'react-map-gl';
import { db } from './firebase';
import { collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { AlertTriangle, Shield, Plus, Trash2, X, Save, RotateCcw, Bell, Navigation, Play, User, MapPin, Route, Eye, EyeOff } from 'lucide-react';
import { Button } from './components/ui/Button';
import { Input, Textarea } from './components/ui/Input';
import { Badge } from './components/ui/Badge';
import { Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter } from './components/ui/Modal';
import { useToast } from './components/ui/Toast';
import { cn } from './lib/utils';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = 'pk.eyJ1Ijoic3Zuc2VhbiIsImEiOiJjbWh6MXViYmQwaWlvMnJxMW15MW41cWltIn0.Qz2opq51Zz3oj-MGPz7aow';

const EmergencyManager = () => {
  const [viewState, setViewState] = useState({
    longitude: 120.813778,
    latitude: 14.857830,
    zoom: 17
  });

  // Data state
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [evacuationZones, setEvacuationZones] = useState([]);
  const [blockages, setBlockages] = useState([]);
  
  // UI state
  const [mode, setMode] = useState('view'); // view, draw_zone, draw_blockage, test_path
  const [drawingPoints, setDrawingPoints] = useState([]);
  const [drawingName, setDrawingName] = useState('');
  
  // Notification state
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationBody, setNotificationBody] = useState('');

  // Path Testing State
  const [testUserLocation, setTestUserLocation] = useState(null);
  const [testDestination, setTestDestination] = useState(null);
  const [testPath, setTestPath] = useState([]);
  const [pathTestMode, setPathTestMode] = useState('user'); // user, destination
  const [pathStats, setPathStats] = useState(null);

  const { addToast } = useToast();

  // Firestore listeners
  useEffect(() => {
    const unsubNodes = onSnapshot(collection(db, 'nodes'), (snap) =>
      setNodes(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    const unsubEdges = onSnapshot(collection(db, 'edges'), (snap) =>
      setEdges(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    const unsubBuildings = onSnapshot(collection(db, 'buildings'), (snap) =>
      setBuildings(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    const unsubZones = onSnapshot(collection(db, 'evacuationZones'), (snap) =>
      setEvacuationZones(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    const unsubBlockages = onSnapshot(collection(db, 'blockages'), (snap) =>
      setBlockages(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => {
      unsubNodes();
      unsubEdges();
      unsubBuildings();
      unsubZones();
      unsubBlockages();
    };
  }, []);

  // Re-run pathfinding when blockages change
  useEffect(() => {
    if (testUserLocation && testDestination && mode === 'test_path') {
      runPathfinding();
    }
  }, [blockages]);

  // A* Pathfinding Algorithm
  const findPath = useCallback((startLng, startLat, endLng, endLat) => {
    if (nodes.length === 0 || edges.length === 0) {
      return { path: [], distance: 0, blocked: false };
    }

    // Find nearest nodes to start and end
    const findNearestNode = (lng, lat) => {
      let minDist = Infinity;
      let nearest = null;
      for (const node of nodes) {
        const dist = Math.hypot(node.lng - lng, node.lat - lat);
        if (dist < minDist) {
          minDist = dist;
          nearest = node;
        }
      }
      return nearest;
    };

    const startNode = findNearestNode(startLng, startLat);
    const endNode = findNearestNode(endLng, endLat);

    if (!startNode || !endNode) {
      return { path: [], distance: 0, blocked: false };
    }

    // Check if edge passes through active blockage
    const isEdgeBlocked = (edge) => {
      const n1 = nodes.find(n => n.id === edge.from);
      const n2 = nodes.find(n => n.id === edge.to);
      if (!n1 || !n2) return false;

      const activeBlockages = blockages.filter(b => b.active && b.points?.length >= 3);
      
      for (const blockage of activeBlockages) {
        if (isLineInPolygon(n1.lng, n1.lat, n2.lng, n2.lat, blockage.points)) {
          return true;
        }
      }
      return false;
    };

    // Simple point-in-polygon check
    const isPointInPolygon = (x, y, polygon) => {
      let inside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].lng, yi = polygon[i].lat;
        const xj = polygon[j].lng, yj = polygon[j].lat;
        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
          inside = !inside;
        }
      }
      return inside;
    };

    // Check if line segment passes through polygon
    const isLineInPolygon = (x1, y1, x2, y2, polygon) => {
      if (isPointInPolygon(x1, y1, polygon) || isPointInPolygon(x2, y2, polygon)) {
        return true;
      }
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      if (isPointInPolygon(midX, midY, polygon)) {
        return true;
      }
      return false;
    };

    // Build adjacency list with valid edges only
    const adjacency = {};
    let blockedEdgesCount = 0;
    
    for (const node of nodes) {
      adjacency[node.id] = [];
    }
    
    for (const edge of edges) {
      if (isEdgeBlocked(edge)) {
        blockedEdgesCount++;
        continue;
      }
      const n1 = nodes.find(n => n.id === edge.from);
      const n2 = nodes.find(n => n.id === edge.to);
      if (n1 && n2) {
        const weight = edge.weight || Math.hypot(n2.lng - n1.lng, n2.lat - n1.lat);
        adjacency[edge.from].push({ node: edge.to, weight });
        adjacency[edge.to].push({ node: edge.from, weight });
      }
    }

    // A* algorithm with proper closed set and iteration limit
    const heuristic = (nodeId) => {
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return Infinity;
      return Math.hypot(endNode.lng - node.lng, endNode.lat - node.lat);
    };

    const openSet = new Set([startNode.id]);
    const closedSet = new Set();
    const cameFrom = {};
    const gScore = { [startNode.id]: 0 };
    const fScore = { [startNode.id]: heuristic(startNode.id) };
    
    const MAX_ITERATIONS = 10000;
    let iterations = 0;

    while (openSet.size > 0 && iterations < MAX_ITERATIONS) {
      iterations++;
      
      let current = null;
      let lowestF = Infinity;
      for (const nodeId of openSet) {
        const f = fScore[nodeId] ?? Infinity;
        if (f < lowestF) {
          lowestF = f;
          current = nodeId;
        }
      }

      if (!current) break;

      if (current === endNode.id) {
        const path = [];
        let curr = current;
        let pathIterations = 0;
        while (curr && pathIterations < MAX_ITERATIONS) {
          pathIterations++;
          const node = nodes.find(n => n.id === curr);
          if (node) path.unshift([node.lng, node.lat]);
          curr = cameFrom[curr];
        }
        path.unshift([startLng, startLat]);
        path.push([endLng, endLat]);
        
        return { 
          path, 
          distance: gScore[endNode.id],
          blockedEdges: blockedEdgesCount,
          nodesVisited: closedSet.size + 1,
          iterations
        };
      }

      openSet.delete(current);
      closedSet.add(current);

      for (const neighbor of adjacency[current] || []) {
        if (closedSet.has(neighbor.node)) continue;
        
        const tentativeG = (gScore[current] ?? Infinity) + neighbor.weight;
        
        if (tentativeG < (gScore[neighbor.node] ?? Infinity)) {
          cameFrom[neighbor.node] = current;
          gScore[neighbor.node] = tentativeG;
          fScore[neighbor.node] = tentativeG + heuristic(neighbor.node);
          openSet.add(neighbor.node);
        }
      }
    }

    if (iterations >= MAX_ITERATIONS) {
      console.warn('A* pathfinding hit iteration limit');
    }

    return { path: [], distance: 0, blocked: true, blockedEdges: blockedEdgesCount, iterations };
  }, [nodes, edges, blockages]);

  // Run pathfinding
  const runPathfinding = useCallback(() => {
    if (!testUserLocation || !testDestination) {
      addToast({ title: 'Error', description: 'Set both user location and destination first', variant: 'error' });
      return;
    }

    const result = findPath(
      testUserLocation.lng, 
      testUserLocation.lat,
      testDestination.lng,
      testDestination.lat
    );

    if (result.blocked || result.path.length === 0) {
      setTestPath([]);
      setPathStats({
        status: 'blocked',
        blockedEdges: result.blockedEdges || 0
      });
      addToast({ title: 'No Path', description: 'Route is blocked!', variant: 'error' });
    } else {
      setTestPath(result.path);
      setPathStats({
        status: 'found',
        distance: (result.distance * 111000).toFixed(1),
        blockedEdges: result.blockedEdges || 0,
        nodesVisited: result.nodesVisited || 0
      });
      addToast({ title: 'Path Found', description: `Distance: ~${(result.distance * 111000).toFixed(0)}m`, variant: 'success' });
    }
  }, [testUserLocation, testDestination, findPath, addToast]);

  // Handle map click
  const handleMapClick = useCallback((event) => {
    const { lng, lat } = event.lngLat;

    if (mode === 'draw_zone' || mode === 'draw_blockage') {
      setDrawingPoints(prev => [...prev, { lng, lat }]);
    } else if (mode === 'test_path') {
      if (pathTestMode === 'user') {
        setTestUserLocation({ lng, lat });
        addToast({ title: 'User Set', description: 'Now click to set destination', variant: 'info' });
        setPathTestMode('destination');
      } else {
        setTestDestination({ lng, lat });
        addToast({ title: 'Destination Set', description: 'Click "Run Pathfinding" to test', variant: 'info' });
      }
    }
  }, [mode, pathTestMode, addToast]);

  // Save drawn polygon
  const savePolygon = async () => {
    if (drawingPoints.length < 3) {
      addToast({ title: 'Error', description: 'Need at least 3 points', variant: 'error' });
      return;
    }
    if (!drawingName.trim()) {
      addToast({ title: 'Error', description: 'Please enter a name', variant: 'error' });
      return;
    }

    try {
      if (mode === 'draw_zone') {
        await addDoc(collection(db, 'evacuationZones'), {
          name: drawingName.trim(),
          points: drawingPoints,
          color: '#22c55e',
          createdAt: new Date()
        });
        addToast({ title: 'Success', description: 'Evacuation zone created', variant: 'success' });
      } else if (mode === 'draw_blockage') {
        await addDoc(collection(db, 'blockages'), {
          name: drawingName.trim(),
          points: drawingPoints,
          active: true,
          createdAt: new Date()
        });
        addToast({ title: 'Success', description: 'Blockage area created', variant: 'success' });
      }
      resetDrawing();
    } catch (error) {
      console.error('Error saving polygon:', error);
      addToast({ title: 'Error', description: 'Error saving polygon', variant: 'error' });
    }
  };

  // Reset drawing state
  const resetDrawing = () => {
    setDrawingPoints([]);
    setDrawingName('');
    setMode('view');
  };

  // Reset path test
  const resetPathTest = () => {
    setTestUserLocation(null);
    setTestDestination(null);
    setTestPath([]);
    setPathStats(null);
    setPathTestMode('user');
  };

  // Delete zone or blockage
  const deleteItem = async (type, id) => {
    if (!window.confirm(`Delete this ${type}?`)) return;
    
    try {
      const collectionName = type === 'zone' ? 'evacuationZones' : 'blockages';
      await deleteDoc(doc(db, collectionName, id));
      addToast({ title: 'Deleted', description: `${type === 'zone' ? 'Zone' : 'Blockage'} removed`, variant: 'success' });
    } catch (error) {
      addToast({ title: 'Error', description: 'Error deleting item', variant: 'error' });
    }
  };

  // Toggle blockage active status
  const toggleBlockageActive = async (blockage) => {
    try {
      await updateDoc(doc(db, 'blockages', blockage.id), {
        active: !blockage.active
      });
      addToast({ 
        title: blockage.active ? 'Deactivated' : 'Activated', 
        description: `Blockage is now ${blockage.active ? 'inactive' : 'active'}`,
        variant: 'success' 
      });
    } catch (error) {
      addToast({ title: 'Error', description: 'Error updating blockage', variant: 'error' });
    }
  };

  // Send emergency notification
  const sendNotification = async () => {
    if (!notificationTitle.trim() || !notificationBody.trim()) {
      addToast({ title: 'Error', description: 'Please fill in title and message', variant: 'error' });
      return;
    }

    try {
      await addDoc(collection(db, 'notifications'), {
        title: notificationTitle.trim(),
        body: notificationBody.trim(),
        type: 'emergency',
        timestamp: new Date(),
        sentBy: 'admin'
      });
      
      addToast({ title: 'Saved', description: 'Alert saved (FCM requires Cloud Functions)', variant: 'success' });
      setShowNotificationModal(false);
      setNotificationTitle('');
      setNotificationBody('');
    } catch (error) {
      addToast({ title: 'Error', description: 'Error sending notification', variant: 'error' });
    }
  };

  // Convert points to GeoJSON polygon
  const pointsToGeoJSON = (points, properties = {}) => {
    if (points.length < 3) return null;
    const coordinates = [...points.map(p => [p.lng, p.lat]), [points[0].lng, points[0].lat]];
    return {
      type: 'Feature',
      properties,
      geometry: { type: 'Polygon', coordinates: [coordinates] }
    };
  };

  // GeoJSON data
  const zonesGeoJSON = {
    type: 'FeatureCollection',
    features: evacuationZones
      .map(zone => pointsToGeoJSON(zone.points || [], { id: zone.id, name: zone.name }))
      .filter(Boolean)
  };

  const blockagesGeoJSON = {
    type: 'FeatureCollection',
    features: blockages
      .filter(b => b.active)
      .map(b => pointsToGeoJSON(b.points || [], { id: b.id, name: b.name }))
      .filter(Boolean)
  };

  const drawingGeoJSON = drawingPoints.length >= 3 ? {
    type: 'FeatureCollection',
    features: [pointsToGeoJSON(drawingPoints, { preview: true })]
  } : null;

  const pathGeoJSON = testPath.length > 0 ? {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: testPath }
  } : null;

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Emergency Management</h2>
              <p className="text-sm text-gray-500">
                {evacuationZones.length} zones · {blockages.length} blockages · {nodes.length} nodes
              </p>
            </div>
          </div>
          <Button onClick={() => setShowNotificationModal(true)} className="bg-violet-600 hover:bg-violet-700">
            <Bell className="w-4 h-4" />
            Send Alert
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant={mode === 'draw_zone' ? 'default' : 'outline'}
            className={cn(mode === 'draw_zone' && 'bg-green-600 hover:bg-green-700')}
            onClick={() => {
              resetPathTest();
              setMode(mode === 'draw_zone' ? 'view' : 'draw_zone');
            }}
          >
            <Shield className="w-4 h-4" />
            Draw Zone
          </Button>
          <Button
            variant={mode === 'draw_blockage' ? 'default' : 'outline'}
            className={cn(mode === 'draw_blockage' && 'bg-red-600 hover:bg-red-700')}
            onClick={() => {
              resetPathTest();
              setMode(mode === 'draw_blockage' ? 'view' : 'draw_blockage');
            }}
          >
            <AlertTriangle className="w-4 h-4" />
            Draw Blockage
          </Button>
          
          <div className="w-px h-6 bg-gray-300 mx-2" />
          
          <Button
            variant={mode === 'test_path' ? 'default' : 'outline'}
            className={cn(mode === 'test_path' && 'bg-blue-600 hover:bg-blue-700')}
            onClick={() => {
              resetDrawing();
              if (mode === 'test_path') {
                resetPathTest();
                setMode('view');
              } else {
                setMode('test_path');
                setPathTestMode('user');
              }
            }}
          >
            <Route className="w-4 h-4" />
            Test Pathfinding
          </Button>
        </div>
      </div>

      {/* Drawing Panel */}
      {(mode === 'draw_zone' || mode === 'draw_blockage') && (
        <div className={cn(
          "flex items-center gap-4 px-6 py-3 border-b",
          mode === 'draw_zone' 
            ? "bg-green-50 border-green-200" 
            : "bg-red-50 border-red-200"
        )}>
          <div className="flex flex-col">
            <span className={cn(
              "font-semibold",
              mode === 'draw_zone' ? "text-green-700" : "text-red-700"
            )}>
              {mode === 'draw_zone' ? '🛡️ Drawing Evacuation Zone' : '⚠️ Drawing Blockage Area'}
            </span>
            <span className="text-sm text-gray-500">
              Click on map to add points ({drawingPoints.length} points)
            </span>
          </div>
          
          <Input
            type="text"
            placeholder={mode === 'draw_zone' ? 'Zone name...' : 'Blockage name...'}
            value={drawingName}
            onChange={(e) => setDrawingName(e.target.value)}
            className="w-48"
          />
          
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={resetDrawing}>
              <X className="w-4 h-4" /> Cancel
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setDrawingPoints(prev => prev.slice(0, -1))}
              disabled={drawingPoints.length === 0}
            >
              <RotateCcw className="w-4 h-4" /> Undo
            </Button>
            <Button 
              className={cn(
                mode === 'draw_zone' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
              )}
              onClick={savePolygon}
              disabled={drawingPoints.length < 3}
            >
              <Save className="w-4 h-4" /> Save
            </Button>
          </div>
        </div>
      )}

      {/* Path Testing Panel */}
      {mode === 'test_path' && (
        <div className="flex items-center gap-5 px-6 py-3 bg-blue-50 border-b border-blue-200 flex-wrap">
          <div className="flex items-center gap-3">
            <Route className="w-5 h-5 text-blue-600" />
            <div>
              <span className="font-semibold text-blue-800">Pathfinding Tester</span>
              <span className="text-xs text-gray-500 block">Test A* routing with blockage avoidance</span>
            </div>
          </div>
          
          <div className="flex gap-3">
            <div className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm",
              testUserLocation ? "bg-green-50 border-green-300" : "bg-gray-100 border-gray-200",
              pathTestMode === 'user' && "border-blue-500"
            )}>
              <User className={cn("w-4 h-4", testUserLocation ? "text-green-600" : "text-gray-400")} />
              <span className={testUserLocation ? "text-green-700" : "text-gray-500"}>
                {testUserLocation ? `User: ${testUserLocation.lng.toFixed(5)}, ${testUserLocation.lat.toFixed(5)}` : 'Click map to set user'}
              </span>
            </div>
            <div className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm",
              testDestination ? "bg-blue-50 border-blue-300" : "bg-gray-100 border-gray-200",
              pathTestMode === 'destination' && "border-blue-500"
            )}>
              <MapPin className={cn("w-4 h-4", testDestination ? "text-blue-600" : "text-gray-400")} />
              <span className={testDestination ? "text-blue-700" : "text-gray-500"}>
                {testDestination ? `Dest: ${testDestination.lng.toFixed(5)}, ${testDestination.lat.toFixed(5)}` : 'Click map to set destination'}
              </span>
            </div>
          </div>

          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={resetPathTest}>
              <RotateCcw className="w-4 h-4" /> Reset
            </Button>
            <Button 
              className="bg-blue-600 hover:bg-blue-700"
              onClick={runPathfinding}
              disabled={!testUserLocation || !testDestination}
            >
              <Play className="w-4 h-4" /> Run Pathfinding
            </Button>
          </div>

          {pathStats && (
            <div className={cn(
              "flex flex-col gap-0.5 px-4 py-2 rounded-lg border",
              pathStats.status === 'found' 
                ? "bg-green-50 border-green-300" 
                : "bg-red-50 border-red-300"
            )}>
              {pathStats.status === 'found' ? (
                <>
                  <span className="text-green-700 font-semibold">✓ Path Found</span>
                  <span className="text-green-600 text-xs">
                    ~{pathStats.distance}m · {pathStats.blockedEdges} blocked edges avoided
                  </span>
                </>
              ) : (
                <>
                  <span className="text-red-700 font-semibold">✗ No Path Found</span>
                  <span className="text-red-600 text-xs">
                    Route is blocked ({pathStats.blockedEdges} edges blocked)
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Map */}
        <div className="flex-1 relative">
          <Map
            {...viewState}
            onMove={evt => setViewState(evt.viewState)}
            onClick={handleMapClick}
            style={{ width: '100%', height: '100%' }}
            mapStyle="mapbox://styles/mapbox/streets-v12"
            mapboxAccessToken={MAPBOX_TOKEN}
            cursor={mode !== 'view' ? 'crosshair' : 'grab'}
          >
            {/* Evacuation Zones */}
            <Source id="zones" type="geojson" data={zonesGeoJSON}>
              <Layer id="zones-fill" type="fill" paint={{ 'fill-color': '#22c55e', 'fill-opacity': 0.25 }} />
              <Layer id="zones-outline" type="line" paint={{ 'line-color': '#16a34a', 'line-width': 2 }} />
            </Source>

            {/* Blockages */}
            <Source id="blockages" type="geojson" data={blockagesGeoJSON}>
              <Layer id="blockages-fill" type="fill" paint={{ 'fill-color': '#dc2626', 'fill-opacity': 0.35 }} />
              <Layer id="blockages-outline" type="line" paint={{ 'line-color': '#991b1b', 'line-width': 2, 'line-dasharray': [3, 2] }} />
            </Source>

            {/* Drawing Preview */}
            {drawingGeoJSON && (
              <Source id="drawing" type="geojson" data={drawingGeoJSON}>
                <Layer id="drawing-fill" type="fill" paint={{ 
                  'fill-color': mode === 'draw_zone' ? '#22c55e' : '#dc2626', 
                  'fill-opacity': 0.2 
                }} />
                <Layer id="drawing-outline" type="line" paint={{ 
                  'line-color': mode === 'draw_zone' ? '#16a34a' : '#991b1b', 
                  'line-width': 2, 
                  'line-dasharray': [4, 4] 
                }} />
              </Source>
            )}

            {/* Test Path Line */}
            {pathGeoJSON && (
              <Source id="test-path" type="geojson" data={pathGeoJSON}>
                <Layer id="test-path-line" type="line" paint={{ 
                  'line-color': '#3b82f6', 
                  'line-width': 4,
                  'line-opacity': 0.8
                }} />
              </Source>
            )}

            {/* Drawing Points */}
            {drawingPoints.map((point, idx) => (
              <Marker key={idx} longitude={point.lng} latitude={point.lat}>
                <div className={cn(
                  "w-3 h-3 rounded-full border-2 border-white shadow-md",
                  mode === 'draw_zone' ? "bg-green-500" : "bg-red-500"
                )} />
              </Marker>
            ))}

            {/* Test User Location */}
            {testUserLocation && (
              <Marker longitude={testUserLocation.lng} latitude={testUserLocation.lat}>
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center border-[3px] border-white shadow-lg">
                  <User className="w-4 h-4 text-white" />
                </div>
              </Marker>
            )}

            {/* Test Destination */}
            {testDestination && (
              <Marker longitude={testDestination.lng} latitude={testDestination.lat} anchor="bottom">
                <div className="w-9 h-9 bg-red-500 rounded-full rounded-bl-none transform rotate-[-45deg] flex items-center justify-center border-[3px] border-white shadow-lg">
                  <MapPin className="w-5 h-5 text-white transform rotate-45" />
                </div>
              </Marker>
            )}

            {/* Zone Labels */}
            {evacuationZones.map(zone => {
              if (!zone.points || zone.points.length === 0) return null;
              const centerLng = zone.points.reduce((sum, p) => sum + p.lng, 0) / zone.points.length;
              const centerLat = zone.points.reduce((sum, p) => sum + p.lat, 0) / zone.points.length;
              return (
                <Marker key={zone.id} longitude={centerLng} latitude={centerLat}>
                  <div className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded whitespace-nowrap">
                    🛡️ {zone.name}
                  </div>
                </Marker>
              );
            })}

            {/* Blockage Labels */}
            {blockages.filter(b => b.active).map(blockage => {
              if (!blockage.points || blockage.points.length === 0) return null;
              const centerLng = blockage.points.reduce((sum, p) => sum + p.lng, 0) / blockage.points.length;
              const centerLat = blockage.points.reduce((sum, p) => sum + p.lat, 0) / blockage.points.length;
              return (
                <Marker key={blockage.id} longitude={centerLng} latitude={centerLat}>
                  <div className="px-2 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded whitespace-nowrap">
                    ⚠️ {blockage.name}
                  </div>
                </Marker>
              );
            })}
          </Map>
        </div>

        {/* Sidebar */}
        <div className="w-80 bg-white border-l border-gray-200 overflow-auto">
          {/* Evacuation Zones List */}
          <div className="border-b border-gray-200">
            <h3 className="flex items-center gap-2 px-4 py-3 text-sm font-semibold text-gray-700 bg-gray-50">
              <Shield className="w-4 h-4 text-green-500" />
              Evacuation Zones ({evacuationZones.length})
            </h3>
            <div className="p-2 space-y-2">
              {evacuationZones.map(zone => (
                <div key={zone.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <span className="text-sm font-medium text-gray-700">🛡️ {zone.name}</span>
                  <button 
                    onClick={() => deleteItem('zone', zone.id)}
                    className="w-7 h-7 flex items-center justify-center bg-red-100 text-red-600 rounded-md hover:bg-red-200 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {evacuationZones.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-5">No evacuation zones</p>
              )}
            </div>
          </div>

          {/* Blockages List */}
          <div>
            <h3 className="flex items-center gap-2 px-4 py-3 text-sm font-semibold text-gray-700 bg-gray-50">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Blockages ({blockages.length})
            </h3>
            <div className="p-2 space-y-2">
              {blockages.map(blockage => (
                <div 
                  key={blockage.id} 
                  className={cn(
                    "p-3 bg-gray-50 rounded-lg border border-gray-200",
                    !blockage.active && "opacity-60"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-gray-700">⚠️ {blockage.name}</span>
                      <Badge variant={blockage.active ? 'destructive' : 'secondary'} className="w-fit text-xs">
                        {blockage.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleBlockageActive(blockage)}
                        className={cn(
                          "px-2 py-1 text-xs font-medium rounded transition-colors",
                          blockage.active 
                            ? "bg-red-100 text-red-600 hover:bg-red-200" 
                            : "bg-green-100 text-green-600 hover:bg-green-200"
                        )}
                      >
                        {blockage.active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button 
                        onClick={() => deleteItem('blockage', blockage.id)}
                        className="w-7 h-7 flex items-center justify-center bg-red-100 text-red-600 rounded-md hover:bg-red-200 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {blockages.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-5">No blockages</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Notification Modal */}
      <Modal open={showNotificationModal} onClose={() => setShowNotificationModal(false)}>
        <ModalHeader onClose={() => setShowNotificationModal(false)}>
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-violet-600" />
            <ModalTitle>Send Emergency Alert</ModalTitle>
          </div>
        </ModalHeader>
        <ModalBody className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Alert Title</label>
            <Input
              value={notificationTitle}
              onChange={(e) => setNotificationTitle(e.target.value)}
              placeholder="e.g., Emergency Evacuation"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Message</label>
            <Textarea
              value={notificationBody}
              onChange={(e) => setNotificationBody(e.target.value)}
              placeholder="Enter the emergency message..."
              rows={4}
            />
          </div>
          <div className="text-sm text-amber-700 bg-amber-50 px-4 py-3 rounded-lg">
            ⚠️ Push notifications require Firebase Cloud Functions setup.
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowNotificationModal(false)}>
            Cancel
          </Button>
          <Button onClick={sendNotification} className="bg-violet-600 hover:bg-violet-700">
            <Bell className="w-4 h-4" /> Send Alert
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};

export default EmergencyManager;
