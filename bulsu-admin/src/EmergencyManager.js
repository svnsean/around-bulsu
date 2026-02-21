// EmergencyManager.js - Modern Tailwind UI with Supabase
import React, { useState, useEffect, useCallback, useRef } from 'react';
import MapGL, { Source, Layer, Marker } from 'react-map-gl';
import { supabase, subscribeToTable } from './supabase';
import { AlertTriangle, Shield, ShieldOff, Trash2, Bell, Plus, Eye, Navigation, Route, StopCircle, BellOff } from 'lucide-react';
import { Button } from './components/ui/Button';
import { Input, Textarea } from './components/ui/Input';
import { Badge } from './components/ui/Badge';
import { Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter } from './components/ui/Modal';
import { useToast } from './components/ui/Toast';
import { cn } from './lib/utils';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = 'pk.eyJ1Ijoic3Zuc2VhbiIsImEiOiJjbWh6MXViYmQwaWlvMnJxMW15MW41cWltIn0.Qz2opq51Zz3oj-MGPz7aow';

// A* Pathfinding Algorithm
const findPath = (nodes, edges, startId, endId, activeBlockages = []) => {
    if (!startId || !endId || nodes.length === 0) return null;

    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const adjacency = new Map();

    nodes.forEach(n => adjacency.set(n.id, []));

    // Check if an edge passes through any active blockage
    const isEdgeBlocked = (fromNode, toNode) => {
        if (activeBlockages.length === 0) return false;

        // Check multiple points along the edge (start, 1/4, middle, 3/4, end)
        const checkPoints = [0, 0.25, 0.5, 0.75, 1];

        return checkPoints.some(t => {
            const checkLng = fromNode.lng + t * (toNode.lng - fromNode.lng);
            const checkLat = fromNode.lat + t * (toNode.lat - fromNode.lat);

            return activeBlockages.some(blockage => {
                if (!blockage.points || blockage.points.length < 3) return false;
                return isPointInPolygon(checkLng, checkLat, blockage.points);
            });
        });
    };

    // Custom isPointInPolygon needed here for closure availability
    const isPointInPolygon = (x, y, polygon) => {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].lng, yi = polygon[i].lat;
            const xj = polygon[j].lng, yj = polygon[j].lat;
            const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    };

    // Filter edges that pass through active blockages
    const validEdges = edges.filter(edge => {
        const fromNode = nodeMap.get(edge.from_node);
        const toNode = nodeMap.get(edge.to_node);
        if (!fromNode || !toNode) return false;

        return !isEdgeBlocked(fromNode, toNode);
    });

    validEdges.forEach(edge => {
        const fromNode = nodeMap.get(edge.from_node);
        const toNode = nodeMap.get(edge.to_node);
        if (fromNode && toNode) {
            const weight = edge.weight || Math.sqrt(
                Math.pow(toNode.lng - fromNode.lng, 2) + Math.pow(toNode.lat - fromNode.lat, 2)
            ) * 111000;
            adjacency.get(edge.from_node)?.push({ nodeId: edge.to_node, weight });
            adjacency.get(edge.to_node)?.push({ nodeId: edge.from_node, weight });
        }
    });

    const heuristic = (a, b) => {
        const nodeA = nodeMap.get(a);
        const nodeB = nodeMap.get(b);
        if (!nodeA || !nodeB) return Infinity;
        return Math.sqrt(Math.pow(nodeB.lng - nodeA.lng, 2) + Math.pow(nodeB.lat - nodeA.lat, 2)) * 111000;
    };

    const openSet = new Set([startId]);
    const cameFrom = new Map();
    const gScore = new Map(nodes.map(n => [n.id, Infinity]));
    const fScore = new Map(nodes.map(n => [n.id, Infinity]));

    gScore.set(startId, 0);
    fScore.set(startId, heuristic(startId, endId));

    while (openSet.size > 0) {
        let current = null;
        let lowestF = Infinity;
        openSet.forEach(id => {
            if (fScore.get(id) < lowestF) {
                lowestF = fScore.get(id);
                current = id;
            }
        });

        if (current === endId) {
            const path = [current];
            while (cameFrom.has(current)) {
                current = cameFrom.get(current);
                path.unshift(current);
            }
            return path.map(id => nodeMap.get(id)).filter(Boolean);
        }

        openSet.delete(current);

        const neighbors = adjacency.get(current) || [];
        neighbors.forEach(({ nodeId, weight }) => {
            const tentativeG = gScore.get(current) + weight;
            if (tentativeG < gScore.get(nodeId)) {
                cameFrom.set(nodeId, current);
                gScore.set(nodeId, tentativeG);
                fScore.set(nodeId, tentativeG + heuristic(nodeId, endId));
                openSet.add(nodeId);
            }
        });
    }

    return null;
};

// Point in polygon check (Global)
const isPointInPolygon = (x, y, polygon) => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].lng, yi = polygon[i].lat;
        const xj = polygon[j].lng, yj = polygon[j].lat;
        const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
};

const EmergencyManager = () => {
    const mapRef = useRef(null);
    const [viewState, setViewState] = useState({
        longitude: 120.813778,
        latitude: 14.857830,
        zoom: 17
    });

    // Data
    const [nodes, setNodes] = useState([]);
    const [edges, setEdges] = useState([]);
    const [evacuationZones, setEvacuationZones] = useState([]);
    const [blockages, setBlockages] = useState([]);

    // Drawing state
    const [mode, setMode] = useState('view'); // 'view', 'add_zone', 'add_blockage'
    const [polygonPoints, setPolygonPoints] = useState([]);
    const [zoneName, setZoneName] = useState('');
    const [blockageName, setBlockageName] = useState('');

    // Test pathfinding
    const [testPath, setTestPath] = useState(null);
    const [pathStart, setPathStart] = useState(null);
    const [pathEnd, setPathEnd] = useState(null);
    const [selectingPath, setSelectingPath] = useState(null); // 'start' or 'end'

    // Notification modal
    const [showNotificationModal, setShowNotificationModal] = useState(false);
    const [notificationTitle, setNotificationTitle] = useState('');
    const [notificationMessage, setNotificationMessage] = useState('');
    const [alertType, setAlertType] = useState('emergency'); // emergency, fire, earthquake, flood, typhoon, drill
    const [sending, setSending] = useState(false);

    // Active emergency alerts
    const [activeAlerts, setActiveAlerts] = useState([]);
    const [stoppingAlert, setStoppingAlert] = useState(null);

    const { addToast } = useToast();

    useEffect(() => {
        const unsubNodes = subscribeToTable('nodes', setNodes);
        const unsubEdges = subscribeToTable('edges', setEdges);
        const unsubZones = subscribeToTable('evacuation_zones', setEvacuationZones);
        const unsubBlockages = subscribeToTable('blockages', setBlockages);
        
        // Subscribe to active emergency alerts from dedicated table
        const unsubAlerts = subscribeToTable('emergency_alerts', (data) => {
            setActiveAlerts(data.filter(a => a.active));
        }, { column: 'created_at', ascending: false });

        return () => { unsubNodes(); unsubEdges(); unsubZones(); unsubBlockages(); unsubAlerts(); };
    }, []);

    // Calculate path when start/end change
    useEffect(() => {
        if (pathStart && pathEnd && nodes.length > 0 && edges.length > 0) {
            const activeBlockagesList = blockages.filter(b => b.active);
            const path = findPath(nodes, edges, pathStart.id, pathEnd.id, activeBlockagesList);
            setTestPath(path);
            if (!path) {
                addToast({ title: 'No Path', description: 'No valid path found between selected nodes', variant: 'warning' });
            }
        } else {
            setTestPath(null);
        }
    }, [pathStart, pathEnd, nodes, edges, blockages, addToast]);

    const handleMapClick = useCallback((e) => {
        if (mode === 'add_zone' || mode === 'add_blockage') {
            setPolygonPoints(prev => [...prev, { lng: e.lngLat.lng, lat: e.lngLat.lat }]);
        }
    }, [mode]);

    const handleSaveZone = async () => {
        if (!zoneName.trim()) {
            addToast({ title: 'Error', description: 'Zone name is required', variant: 'error' });
            return;
        }
        if (polygonPoints.length < 3) {
            addToast({ title: 'Error', description: 'At least 3 points are required', variant: 'error' });
            return;
        }

        try {
            await supabase.from('evacuation_zones').insert([{
                name: zoneName.trim(),
                points: polygonPoints,
                color: '#22c55e'
            }]);
            addToast({ title: 'Success', description: 'Evacuation zone created', variant: 'success' });
            setZoneName('');
            setPolygonPoints([]);
            setMode('view');
        } catch (error) {
            addToast({ title: 'Error', description: 'Failed to create zone', variant: 'error' });
        }
    };

    const handleSaveBlockage = async () => {
        if (!blockageName.trim()) {
            addToast({ title: 'Error', description: 'Blockage name is required', variant: 'error' });
            return;
        }
        if (polygonPoints.length < 3) {
            addToast({ title: 'Error', description: 'At least 3 points are required', variant: 'error' });
            return;
        }

        try {
            await supabase.from('blockages').insert([{
                name: blockageName.trim(),
                points: polygonPoints,
                active: true
            }]);
            addToast({ title: 'Success', description: 'Blockage area created', variant: 'success' });
            setBlockageName('');
            setPolygonPoints([]);
            setMode('view');
        } catch (error) {
            addToast({ title: 'Error', description: 'Failed to create blockage', variant: 'error' });
        }
    };

    const handleNodeClick = useCallback((e, node) => {
        if (e.originalEvent) e.originalEvent.stopPropagation();

        if (selectingPath === 'start') {
            setPathStart(node);
            setSelectingPath('end');
            addToast({ title: 'Start Selected', description: 'Now click the destination node', variant: 'info' });
        } else if (selectingPath === 'end') {
            setPathEnd(node);
            setSelectingPath(null);
            addToast({ title: 'Destination Selected', description: 'Calculating path...', variant: 'info' });
        }
    }, [selectingPath, addToast]);

    const startTestPathfinding = () => {
        setTestPath(null);
        setPathStart(null);
        setPathEnd(null);
        setSelectingPath('start');
        addToast({ title: 'Test Pathfinding', description: 'Click a node to set start point', variant: 'info' });
    };

    const clearTestPath = () => {
        setTestPath(null);
        setPathStart(null);
        setPathEnd(null);
        setSelectingPath(null);
    };

    const handleToggleBlockage = async (blockage) => {
        try {
            await supabase.from('blockages').update({ active: !blockage.active }).eq('id', blockage.id);
            addToast({
                title: blockage.active ? 'Deactivated' : 'Activated',
                description: `${blockage.name} is now ${blockage.active ? 'inactive' : 'active'}`,
                variant: 'info'
            });
        } catch (error) {
            addToast({ title: 'Error', description: 'Failed to update blockage', variant: 'error' });
        }
    };

    const handleDeleteZone = async (zoneId) => {
        if (!window.confirm('Delete this evacuation zone?')) return;
        try {
            await supabase.from('evacuation_zones').delete().eq('id', zoneId);
            addToast({ title: 'Deleted', description: 'Zone deleted', variant: 'success' });
        } catch (error) {
            addToast({ title: 'Error', description: 'Failed to delete zone', variant: 'error' });
        }
    };

    const handleDeleteBlockage = async (blockageId) => {
        if (!window.confirm('Delete this blockage?')) return;
        try {
            await supabase.from('blockages').delete().eq('id', blockageId);
            addToast({ title: 'Deleted', description: 'Blockage deleted', variant: 'success' });
        } catch (error) {
            addToast({ title: 'Error', description: 'Failed to delete blockage', variant: 'error' });
        }
    };

    const sendNotification = async () => {
        if (!notificationTitle.trim()) {
            addToast({ title: 'Error', description: 'Title is required', variant: 'error' });
            return;
        }

        setSending(true);
        try {
            // Use RPC function to create emergency alert (bypasses schema cache issues)
            const { data, error: alertError } = await supabase.rpc('create_emergency_alert', {
                p_title: notificationTitle.trim(),
                p_message: notificationMessage.trim(),
                p_alert_type: alertType
            });

            if (alertError) {
                console.error('Error creating emergency alert:', alertError);
                // Fallback to direct insert if RPC fails
                const { error: insertError } = await supabase.from('emergency_alerts').insert([{
                    title: notificationTitle.trim(),
                    message: notificationMessage.trim(),
                    alert_type: alertType,
                    active: true
                }]);
                if (insertError) throw insertError;
            }

            // Also create a notification record for history (optional - don't fail if this fails)
            try {
                await supabase.from('notifications').insert([{
                    title: notificationTitle.trim(),
                    body: notificationMessage.trim(),
                    type: 'emergency',
                    sent_by: 'admin'
                }]);
            } catch (notifError) {
                console.log('Notification history insert (non-critical):', notifError?.message);
            }

            // Send FCM push notification to all registered devices
            try {
                await supabase.functions.invoke('send-alert', {
                    body: {
                        alertId: data || '',
                        title: notificationTitle.trim(),
                        message: notificationMessage.trim(),
                        severity: 'critical'
                    }
                });
            } catch (fcmError) {
                console.log('FCM push (non-critical):', fcmError?.message);
            }

            addToast({ title: '🚨 Alert Sent!', description: 'Emergency alert is now active on all mobile devices', variant: 'success' });
            setNotificationTitle('');
            setNotificationMessage('');
            setAlertType('emergency');
            setShowNotificationModal(false);
        } catch (error) {
            console.error('Error sending alert:', error);
            addToast({ title: 'Error', description: 'Failed to send notification: ' + error.message, variant: 'error' });
        } finally {
            setSending(false);
        }
    };

    const stopAlert = async (alertId) => {
        setStoppingAlert(alertId);
        try {
            // Try RPC function first
            const { error: rpcError } = await supabase.rpc('stop_emergency_alert', { p_alert_id: alertId });
            
            if (rpcError) {
                console.log('RPC failed, using direct update:', rpcError);
                // Fallback to direct update
                const { error } = await supabase
                    .from('emergency_alerts')
                    .update({ active: false })
                    .eq('id', alertId);
                if (error) throw error;
            }
            
            addToast({ title: '✅ Alert Stopped', description: 'Emergency alert has been deactivated', variant: 'success' });
        } catch (error) {
            console.error('Error stopping alert:', error);
            addToast({ title: 'Error', description: 'Failed to stop alert', variant: 'error' });
        } finally {
            setStoppingAlert(null);
        }
    };

    const stopAllAlerts = async () => {
        if (!window.confirm('Stop all active emergency alerts? This will dismiss the alert on all devices.')) return;
        
        try {
            // Stop all active alerts
            const { error } = await supabase
                .from('emergency_alerts')
                .update({ active: false })
                .eq('active', true);
            if (error) throw error;
            addToast({ title: '✅ All Alerts Stopped', description: 'All emergency alerts have been deactivated', variant: 'success' });
        } catch (error) {
            console.error('Error stopping alerts:', error);
            addToast({ title: 'Error', description: 'Failed to stop alerts', variant: 'error' });
        }
    };

    const cancelDrawing = () => {
        setMode('view');
        setPolygonPoints([]);
        setZoneName('');
        setBlockageName('');
    };

    // Modes for toolbar
    const modes = [
        { id: 'view', icon: Eye, label: 'View' },
        { id: 'add_zone', icon: Shield, label: 'Add Zone' },
        { id: 'add_blockage', icon: ShieldOff, label: 'Add Blockage' }
    ];

    // GeoJSON for nodes
    const nodesGeoJSON = {
        type: 'FeatureCollection',
        features: nodes.map(node => ({
            type: 'Feature',
            properties: { id: node.id },
            geometry: { type: 'Point', coordinates: [node.lng, node.lat] }
        }))
    };

    // GeoJSON for edges
    const edgesGeoJSON = {
        type: 'FeatureCollection',
        features: edges.map(edge => {
            const from = nodes.find(n => n.id === edge.from_node);
            const to = nodes.find(n => n.id === edge.to_node);
            if (!from || !to) return null;
            return {
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'LineString',
                    coordinates: [[from.lng, from.lat], [to.lng, to.lat]]
                }
            };
        }).filter(Boolean)
    };

    // GeoJSON for test path
    const pathGeoJSON = testPath && testPath.length >= 2 ? {
        type: 'Feature',
        geometry: {
            type: 'LineString',
            coordinates: testPath.map(n => [n.lng, n.lat])
        }
    } : null;

    // GeoJSON for zones
    const zonesGeoJSON = {
        type: 'FeatureCollection',
        features: evacuationZones
            .filter(z => z.points && z.points.length >= 3)
            .map(zone => ({
                type: 'Feature',
                properties: { name: zone.name },
                geometry: {
                    type: 'Polygon',
                    coordinates: [[...zone.points.map(p => [p.lng, p.lat]), [zone.points[0].lng, zone.points[0].lat]]]
                }
            }))
    };

    // GeoJSON for blockages
    const blockagesGeoJSON = {
        type: 'FeatureCollection',
        features: blockages
            .filter(b => b.points && b.points.length >= 3)
            .map(blockage => ({
                type: 'Feature',
                properties: { name: blockage.name, active: blockage.active },
                geometry: {
                    type: 'Polygon',
                    coordinates: [[...blockage.points.map(p => [p.lng, p.lat]), [blockage.points[0].lng, blockage.points[0].lat]]]
                }
            }))
    };

    // Drawing preview
    const drawingGeoJSON = polygonPoints.length > 0 ? {
        type: 'Feature',
        geometry: {
            type: polygonPoints.length >= 3 ? 'Polygon' : 'LineString',
            coordinates: polygonPoints.length >= 3
                ? [[...polygonPoints.map(p => [p.lng, p.lat]), [polygonPoints[0].lng, polygonPoints[0].lat]]]
                : polygonPoints.map(p => [p.lng, p.lat])
        }
    } : null;

    return (
        <div className="h-full flex flex-col bg-gray-50">
            {/* Active Alert Banner */}
            {activeAlerts.length > 0 && (
                <div className="bg-red-600 px-6 py-3 animate-pulse">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                                <Bell className="w-5 h-5 text-white animate-bounce" />
                            </div>
                            <div>
                                <p className="text-white font-semibold">
                                    {activeAlerts.length} Active Emergency Alert{activeAlerts.length > 1 ? 's' : ''}
                                </p>
                                <p className="text-red-100 text-sm">
                                    Users are receiving forced notifications
                                </p>
                            </div>
                        </div>
                        <Button
                            onClick={stopAllAlerts}
                            className="bg-white text-red-600 hover:bg-red-50"
                        >
                            <StopCircle className="w-4 h-4" />
                            Stop All Alerts
                        </Button>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center">
                            <AlertTriangle className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">Emergency Manager</h2>
                            <p className="text-sm text-gray-500">
                                {evacuationZones.length} zones · {blockages.length} blockages · {blockages.filter(b => b.active).length} active
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            onClick={testPath ? clearTestPath : startTestPathfinding}
                            className={testPath ? "border-orange-500 text-orange-600" : ""}
                        >
                            <Route className="w-4 h-4" />
                            {testPath ? 'Clear Path' : 'Test Pathfinding'}
                        </Button>
                        <Button
                            onClick={() => setShowNotificationModal(true)}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            <Bell className="w-4 h-4" />
                            Send Alert
                        </Button>
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="bg-white border-b border-gray-200 px-6 py-3">
                <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-gray-500">Mode:</span>
                    <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                        {modes.map(m => (
                            <button
                                key={m.id}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all",
                                    mode === m.id
                                        ? m.id === 'add_zone'
                                            ? "bg-green-600 text-white shadow-sm"
                                            : m.id === 'add_blockage'
                                                ? "bg-red-600 text-white shadow-sm"
                                                : "bg-white text-gray-900 shadow-sm"
                                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                                )}
                                onClick={() => {
                                    setMode(m.id);
                                    setPolygonPoints([]);
                                    setZoneName('');
                                    setBlockageName('');
                                }}
                            >
                                <m.icon className="w-4 h-4" />
                                {m.label}
                            </button>
                        ))}
                    </div>

                    {selectingPath && (
                        <Badge variant="warning" className="ml-4">
                            <Navigation className="w-3 h-3 mr-1" />
                            Click {selectingPath === 'start' ? 'start' : 'destination'} node
                        </Badge>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar */}
                <div className="w-72 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-4 space-y-6">
                        {/* Active Alerts Panel */}
                        {activeAlerts.length > 0 && (
                            <div className="border border-red-300 rounded-lg p-4 bg-red-50">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-semibold text-red-700 flex items-center gap-2">
                                        <Bell className="w-4 h-4 animate-pulse" />
                                        Active Alerts
                                    </h3>
                                    <Badge variant="destructive" className="animate-pulse">{activeAlerts.length}</Badge>
                                </div>
                                <div className="space-y-2">
                                    {activeAlerts.map(alert => {
                                        // Get alert type styling
                                        const getAlertTypeBadge = (type) => {
                                            const types = {
                                                emergency: { label: '🚨 Emergency', className: 'bg-red-100 text-red-700' },
                                                fire: { label: '🔥 Fire', className: 'bg-orange-100 text-orange-700' },
                                                earthquake: { label: '🌍 Earthquake', className: 'bg-amber-100 text-amber-700' },
                                                flood: { label: '🌊 Flood', className: 'bg-blue-100 text-blue-700' },
                                                typhoon: { label: '🌀 Typhoon', className: 'bg-purple-100 text-purple-700' },
                                                drill: { label: '🔔 Drill', className: 'bg-yellow-100 text-yellow-700' },
                                            };
                                            return types[type] || types.emergency;
                                        };
                                        const typeBadge = getAlertTypeBadge(alert.alert_type);
                                        
                                        return (
                                            <div key={alert.id} className="bg-white rounded-lg p-3 border border-red-200 shadow-sm">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <span className={cn("inline-block px-2 py-0.5 text-xs font-medium rounded mb-1", typeBadge.className)}>
                                                            {typeBadge.label}
                                                        </span>
                                                        <p className="font-medium text-gray-900 text-sm truncate">{alert.title}</p>
                                                        {alert.message && (
                                                            <p className="text-xs text-gray-500 truncate mt-0.5">{alert.message}</p>
                                                        )}
                                                        <p className="text-xs text-red-500 mt-1">
                                                            {new Date(alert.created_at).toLocaleTimeString()}
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={() => stopAlert(alert.id)}
                                                        disabled={stoppingAlert === alert.id}
                                                        className={cn(
                                                            "flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors",
                                                            stoppingAlert === alert.id
                                                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                                                : "bg-red-600 text-white hover:bg-red-700"
                                                        )}
                                                    >
                                                        <StopCircle className="w-3 h-3" />
                                                        {stoppingAlert === alert.id ? 'Stopping...' : 'Stop'}
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Drawing Panel */}
                        {(mode === 'add_zone' || mode === 'add_blockage') && (
                            <div className={cn(
                                "border rounded-lg p-4",
                                mode === 'add_zone' ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
                            )}>
                                <h4 className="font-medium text-gray-900 mb-2">
                                    {mode === 'add_zone' ? 'New Evacuation Zone' : 'New Blockage Area'}
                                </h4>
                                <Input
                                    value={mode === 'add_zone' ? zoneName : blockageName}
                                    onChange={(e) => mode === 'add_zone' ? setZoneName(e.target.value) : setBlockageName(e.target.value)}
                                    placeholder={mode === 'add_zone' ? 'Zone name' : 'Blockage name'}
                                    className="mb-2"
                                />
                                <p className={cn("text-xs mb-3", mode === 'add_zone' ? "text-green-700" : "text-red-700")}>
                                    {polygonPoints.length} points placed (min 3 required)
                                </p>
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        onClick={mode === 'add_zone' ? handleSaveZone : handleSaveBlockage}
                                        disabled={polygonPoints.length < 3}
                                        className={mode === 'add_zone' ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
                                    >
                                        Save
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={cancelDrawing}>
                                        Cancel
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Evacuation Zones */}
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-semibold text-gray-700">Evacuation Zones</h3>
                                <Badge variant="secondary">{evacuationZones.length}</Badge>
                            </div>
                            <div className="space-y-2">
                                {evacuationZones.map(zone => (
                                    <div key={zone.id} className="flex items-center justify-between p-2 bg-green-50 rounded-lg">
                                        <div className="flex items-center gap-2">
                                            <Shield className="w-4 h-4 text-green-600" />
                                            <span className="text-sm text-gray-700">{zone.name}</span>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteZone(zone.id)}
                                            className="p-1 text-gray-400 hover:text-red-500"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                                {evacuationZones.length === 0 && (
                                    <p className="text-xs text-gray-400 italic">No zones created</p>
                                )}
                            </div>
                        </div>

                        {/* Blockages */}
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-semibold text-gray-700">Blockages</h3>
                                <Badge variant="secondary">{blockages.length}</Badge>
                            </div>
                            <div className="space-y-2">
                                {blockages.map(blockage => (
                                    <div key={blockage.id} className={cn(
                                        "flex items-center justify-between p-2 rounded-lg",
                                        blockage.active ? "bg-red-50" : "bg-gray-50"
                                    )}>
                                        <div className="flex items-center gap-2">
                                            {blockage.active ? (
                                                <ShieldOff className="w-4 h-4 text-red-600" />
                                            ) : (
                                                <Shield className="w-4 h-4 text-gray-400" />
                                            )}
                                            <span className={cn("text-sm", blockage.active ? "text-gray-700" : "text-gray-400")}>
                                                {blockage.name}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => handleToggleBlockage(blockage)}
                                                className={cn(
                                                    "px-2 py-1 text-xs rounded",
                                                    blockage.active
                                                        ? "bg-red-100 text-red-700 hover:bg-red-200"
                                                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                                )}
                                            >
                                                {blockage.active ? 'Active' : 'Inactive'}
                                            </button>
                                            <button
                                                onClick={() => handleDeleteBlockage(blockage.id)}
                                                className="p-1 text-gray-400 hover:text-red-500"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {blockages.length === 0 && (
                                    <p className="text-xs text-gray-400 italic">No blockages created</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Map */}
                <div className="flex-1 relative">
                    {(mode === 'add_zone' || mode === 'add_blockage') && (
                        <div className={cn(
                            "absolute top-4 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded-full shadow-lg",
                            mode === 'add_zone' ? "bg-green-500 text-white" : "bg-red-500 text-white"
                        )}>
                            Click on the map to place points for {mode === 'add_zone' ? 'evacuation zone' : 'blockage area'}
                        </div>
                    )}

                    <MapGL
                        ref={mapRef}
                        {...viewState}
                        onMove={evt => setViewState(evt.viewState)}
                        style={{ width: '100%', height: '100%' }}
                        mapStyle="mapbox://styles/mapbox/streets-v12"
                        mapboxAccessToken={MAPBOX_TOKEN}
                        onClick={handleMapClick}
                        cursor={mode !== 'view' ? 'crosshair' : selectingPath ? 'pointer' : 'grab'}
                    >
                        {/* Edges (faint, for reference) */}
                        <Source id="edges" type="geojson" data={edgesGeoJSON}>
                            <Layer id="edges-line" type="line" paint={{ 'line-color': '#9ca3af', 'line-width': 1, 'line-opacity': 0.5 }} />
                        </Source>

                        {/* Evacuation Zones */}
                        <Source id="zones" type="geojson" data={zonesGeoJSON}>
                            <Layer id="zones-fill" type="fill" paint={{ 'fill-color': '#22c55e', 'fill-opacity': 0.3 }} />
                            <Layer id="zones-line" type="line" paint={{ 'line-color': '#16a34a', 'line-width': 2 }} />
                        </Source>

                        {/* Blockages */}
                        <Source id="blockages" type="geojson" data={blockagesGeoJSON}>
                            <Layer id="blockages-fill" type="fill" paint={{ 'fill-color': '#dc2626', 'fill-opacity': 0.3 }} />
                            <Layer id="blockages-line" type="line" paint={{ 'line-color': '#991b1b', 'line-width': 2, 'line-dasharray': [3, 2] }} />
                        </Source>

                        {/* Test Path */}
                        {pathGeoJSON && (
                            <Source id="test-path" type="geojson" data={pathGeoJSON}>
                                <Layer id="test-path-line" type="line" paint={{
                                    'line-color': '#f97316',
                                    'line-width': 4,
                                    'line-opacity': 0.8
                                }} />
                            </Source>
                        )}

                        {/* Drawing Preview */}
                        {drawingGeoJSON && (
                            <Source id="drawing" type="geojson" data={drawingGeoJSON}>
                                <Layer
                                    id="drawing-fill"
                                    type="fill"
                                    paint={{
                                        'fill-color': mode === 'add_zone' ? '#22c55e' : '#dc2626',
                                        'fill-opacity': 0.2
                                    }}
                                />
                                <Layer
                                    id="drawing-line"
                                    type="line"
                                    paint={{
                                        'line-color': mode === 'add_zone' ? '#16a34a' : '#991b1b',
                                        'line-width': 2,
                                        'line-dasharray': [2, 2]
                                    }}
                                />
                            </Source>
                        )}

                        {/* Nodes (clickable for pathfinding) */}
                        {nodes.map(node => (
                            <Marker
                                key={node.id}
                                longitude={node.lng}
                                latitude={node.lat}
                                onClick={(e) => handleNodeClick(e, node)}
                            >
                                <div className={cn(
                                    "w-3 h-3 rounded-full border-2 border-white shadow cursor-pointer transition-transform hover:scale-125",
                                    pathStart?.id === node.id ? "bg-green-500 w-4 h-4" :
                                        pathEnd?.id === node.id ? "bg-orange-500 w-4 h-4" :
                                            selectingPath ? "bg-blue-500" : "bg-blue-400"
                                )} />
                            </Marker>
                        ))}

                        {/* Drawing Points */}
                        {polygonPoints.map((point, i) => (
                            <Marker key={i} longitude={point.lng} latitude={point.lat}>
                                <div className={cn(
                                    "w-3 h-3 rounded-full border-2 border-white shadow",
                                    mode === 'add_zone' ? "bg-green-500" : "bg-red-500"
                                )} />
                            </Marker>
                        ))}
                    </MapGL>
                </div>
            </div>

            {/* Notification Modal */}
            <Modal open={showNotificationModal} onOpenChange={setShowNotificationModal}>
                <ModalHeader>
                    <ModalTitle>Send Emergency Alert</ModalTitle>
                </ModalHeader>
                <ModalBody>
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">Alert Type *</label>
                            <select
                                value={alertType}
                                onChange={(e) => setAlertType(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                            >
                                <option value="emergency">🚨 General Emergency</option>
                                <option value="fire">🔥 Fire</option>
                                <option value="earthquake">🌍 Earthquake</option>
                                <option value="flood">🌊 Flood</option>
                                <option value="typhoon">🌀 Typhoon</option>
                                <option value="drill">🔔 Drill</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">Alert Title *</label>
                            <Input
                                value={notificationTitle}
                                onChange={(e) => setNotificationTitle(e.target.value)}
                                placeholder="e.g., Emergency Evacuation Notice"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">Message</label>
                            <Textarea
                                value={notificationMessage}
                                onChange={(e) => setNotificationMessage(e.target.value)}
                                placeholder="Details about the emergency..."
                                rows={4}
                            />
                        </div>
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                            <p className="text-sm text-yellow-800">
                                <strong>⚠️ Warning:</strong> This will send a forced full-screen notification to ALL users 
                                currently using the app. The alert will require acknowledgment and will cause continuous 
                                phone vibration until dismissed.
                            </p>
                        </div>
                    </div>
                </ModalBody>
                <ModalFooter>
                    <Button variant="outline" onClick={() => setShowNotificationModal(false)}>Cancel</Button>
                    <Button onClick={sendNotification} disabled={sending} className="bg-red-600 hover:bg-red-700">
                        {sending ? 'Sending...' : 'Send Alert'}
                    </Button>
                </ModalFooter>
            </Modal>
        </div>
    );
};

export default EmergencyManager;
