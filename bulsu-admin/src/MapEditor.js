// MapEditor.js - Modern Tailwind UI with Pins, Nodes & View Controls
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Map, { Source, Layer, Marker } from 'react-map-gl';
import { db } from './firebase';
import { collection, addDoc, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { Map as MapIcon, MapPin, Plus, Trash2, Link2, Eye, Navigation, Search, X, Check, ChevronDown, Building2, Edit2 } from 'lucide-react';
import { Button } from './components/ui/Button';
import { Input, Textarea } from './components/ui/Input';
import { Badge } from './components/ui/Badge';
import { Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter } from './components/ui/Modal';
import { useToast } from './components/ui/Toast';
import { cn } from './lib/utils';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = 'pk.eyJ1Ijoic3Zuc2VhbiIsImEiOiJjbWh6MXViYmQwaWlvMnJxMW15MW41cWltIn0.Qz2opq51Zz3oj-MGPz7aow';

const MapEditor = ({ onEditBuilding, initialMode, onModeApplied }) => {
  const mapRef = useRef(null);
  const [viewState, setViewState] = useState({
    longitude: 120.813778, 
    latitude: 14.857830, 
    zoom: 17
  });
  
  // Data
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [evacuationZones, setEvacuationZones] = useState([]);
  const [blockages, setBlockages] = useState([]);
  
  // UI State
  const [mode, setMode] = useState('view');
  const [selectedNode, setSelectedNode] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  
  // Add Building Modal
  const [showAddBuildingModal, setShowAddBuildingModal] = useState(false);
  const [buildingName, setBuildingName] = useState('');
  const [buildingDesc, setBuildingDesc] = useState('');
  const [pendingBuildingLocation, setPendingBuildingLocation] = useState(null);
  
  // View Controls
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [viewLayers, setViewLayers] = useState({
    buildings: true,
    nodes: true,
    edges: true,
    evacuationZones: true,
    blockages: true
  });

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

  const filteredBuildings = buildings.filter(building => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    if (building.name?.toLowerCase().includes(query)) return true;
    if (building.rooms && Array.isArray(building.rooms)) {
      return building.rooms.some(room => room.toLowerCase().includes(query));
    }
    return false;
  });

  const handleMapClick = useCallback(async (event) => {
    const { lng, lat } = event.lngLat;

    if (mode === 'add_node') {
      try {
        await addDoc(collection(db, 'nodes'), { lng, lat });
        addToast({ title: 'Success', description: 'Node added successfully', variant: 'success' });
      } catch (error) {
        addToast({ title: 'Error', description: 'Error adding node', variant: 'error' });
      }
    }

    if (mode === 'add_building') {
      setPendingBuildingLocation({ lng, lat });
      setShowAddBuildingModal(true);
    }
  }, [mode, addToast]);

  const handleSaveBuilding = async () => {
    if (!buildingName.trim()) {
      addToast({ title: 'Error', description: 'Building name is required', variant: 'error' });
      return;
    }
    
    if (!pendingBuildingLocation) {
      addToast({ title: 'Error', description: 'Please click on the map to place the building', variant: 'error' });
      return;
    }
    
    try {
      await addDoc(collection(db, 'buildings'), { 
        name: buildingName.trim(), 
        description: buildingDesc.trim(),
        longitude: pendingBuildingLocation.lng, 
        latitude: pendingBuildingLocation.lat,
        rooms: []
      });
      closeAddBuildingModal();
      addToast({ title: 'Success', description: 'Building pin added successfully', variant: 'success' });
    } catch (error) {
      console.error('Error adding building:', error);
      addToast({ title: 'Error', description: 'Error adding building', variant: 'error' });
    }
  };

  const handleNodeClick = useCallback(async (e, node) => {
    if (e.originalEvent) e.originalEvent.stopPropagation();

    if (mode === 'delete') {
      if(window.confirm("Delete this node and all connected edges?")) {
        try {
          const nodeEdges = edges.filter(edge => 
            edge.from === node.id || edge.to === node.id
          );
          
          for (const edge of nodeEdges) {
            await deleteDoc(doc(db, 'edges', edge.id));
          }
          
          await deleteDoc(doc(db, 'nodes', node.id));
          addToast({ title: 'Deleted', description: 'Node deleted', variant: 'success' });
        } catch (error) {
          addToast({ title: 'Error', description: 'Error deleting node', variant: 'error' });
        }
      }
      return;
    }

    if (mode === 'connect_node') {
      if (!selectedNode) {
        setSelectedNode(node);
        addToast({ title: 'Node Selected', description: 'Click another node to connect', variant: 'info' });
      } else {
        if (selectedNode.id === node.id) {
          setSelectedNode(null);
          addToast({ title: 'Cleared', description: 'Selection cleared', variant: 'info' });
          return;
        }

        const existingEdge = edges.find(edge => 
          (edge.from === selectedNode.id && edge.to === node.id) ||
          (edge.from === node.id && edge.to === selectedNode.id)
        );
        
        if (existingEdge) {
          addToast({ title: 'Error', description: 'Edge already exists between these nodes', variant: 'error' });
          return;
        }

        try {
          const weight = Math.hypot(node.lng - selectedNode.lng, node.lat - selectedNode.lat);
          
          await addDoc(collection(db, 'edges'), {
            from: selectedNode.id,
            to: node.id,
            weight: weight
          });

          addToast({ title: 'Success', description: 'Edge created successfully', variant: 'success' });
          setSelectedNode(node);
        } catch (error) {
          addToast({ title: 'Error', description: 'Error creating edge', variant: 'error' });
        }
      }
    }
  }, [mode, selectedNode, edges, addToast]);

  const handleBuildingClick = useCallback((e, building) => {
    if (e) e.stopPropagation();
    
    if (mode === 'delete') {
      if(window.confirm(`Delete building pin "${building.name}"?`)) {
        deleteBuilding(building.id);
      }
    } else {
      setSelectedBuilding(building);
    }
  }, [mode]);

  const deleteBuilding = async (id) => {
    try {
      await deleteDoc(doc(db, 'buildings', id));
      setSelectedBuilding(null);
      addToast({ title: 'Deleted', description: 'Building pin deleted', variant: 'success' });
    } catch (error) {
      addToast({ title: 'Error', description: 'Error deleting building', variant: 'error' });
    }
  };

  const closeAddBuildingModal = () => {
    setShowAddBuildingModal(false);
    setMode('view');
    setBuildingName('');
    setBuildingDesc('');
    setPendingBuildingLocation(null);
  };

  const toggleViewLayer = (layer) => {
    setViewLayers(prev => ({ ...prev, [layer]: !prev[layer] }));
  };

  // Handle search result selection - zoom to building and show info with smooth animation
  const handleSearchSelect = (building) => {
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [building.longitude, building.latitude],
        zoom: 19,
        duration: 1500,
        essential: true
      });
    }
    setSelectedBuilding(building);
    setSearchQuery('');
    setShowSearchDropdown(false);
  };

  // Set initial mode when component mounts (for add_building from Buildings tab)
  useEffect(() => {
    if (initialMode) {
      setMode(initialMode);
      // Clear the initial mode flag so it doesn't persist
      if (onModeApplied) onModeApplied();
    }
  }, [initialMode, onModeApplied]);

  // GeoJSON Data
  const edgesGeoJSON = {
    type: 'FeatureCollection',
    features: edges
      .filter(edge => {
        const n1 = nodes.find(n => n.id === edge.from);
        const n2 = nodes.find(n => n.id === edge.to);
        return n1 && n2;
      })
      .map(edge => {
        const n1 = nodes.find(n => n.id === edge.from);
        const n2 = nodes.find(n => n.id === edge.to);
        return {
          type: 'Feature',
          geometry: { 
            type: 'LineString', 
            coordinates: [[n1.lng, n1.lat], [n2.lng, n2.lat]] 
          }
        };
      })
  };

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

  const blockagesGeoJSON = {
    type: 'FeatureCollection',
    features: blockages
      .filter(b => b.points && b.points.length >= 3 && b.active)
      .map(blockage => ({
        type: 'Feature',
        properties: { name: blockage.name },
        geometry: {
          type: 'Polygon',
          coordinates: [[...blockage.points.map(p => [p.lng, p.lat]), [blockage.points[0].lng, blockage.points[0].lat]]]
        }
      }))
  };

  const modes = [
    { id: 'view', icon: Eye, label: 'View' },
    { id: 'add_node', icon: Plus, label: 'Add Node' },
    { id: 'connect_node', icon: Link2, label: 'Connect' },
    { id: 'delete', icon: Trash2, label: 'Delete' }
  ];

  const viewLayerOptions = [
    { id: 'buildings', label: 'Building Pins', color: 'bg-maroon-800' },
    { id: 'nodes', label: 'Navigation Nodes', color: 'bg-blue-500' },
    { id: 'edges', label: 'Path Edges', color: 'bg-maroon-800' },
    { id: 'evacuationZones', label: 'Evacuation Zones', color: 'bg-green-500' },
    { id: 'blockages', label: 'Blockages', color: 'bg-red-600' }
  ];

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-maroon-800 rounded-xl flex items-center justify-center">
              <MapIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Map Editor</h2>
              <p className="text-sm text-gray-500">
                {nodes.length} nodes · {edges.length} edges · {buildings.length} buildings
              </p>
            </div>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearchDropdown(e.target.value.trim().length > 0);
              }}
              onFocus={() => {
                if (searchQuery.trim().length > 0) setShowSearchDropdown(true);
              }}
              placeholder="Search buildings or rooms..."
              className="pl-10 w-72"
            />
            {searchQuery && (
              <button 
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 bg-gray-300 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-400 z-10"
                onClick={() => {
                  setSearchQuery('');
                  setShowSearchDropdown(false);
                }}
              >
                <X className="w-3 h-3" />
              </button>
            )}
            
            {/* Search Dropdown */}
            {showSearchDropdown && searchQuery.trim() && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowSearchDropdown(false)}
                />
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden max-h-80 overflow-y-auto">
                  {filteredBuildings.length > 0 ? (
                    <>
                      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          {filteredBuildings.length} Result{filteredBuildings.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="py-1">
                        {filteredBuildings.map(building => (
                          <button
                            key={building.id}
                            className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                            onClick={() => handleSearchSelect(building)}
                          >
                            <div className="w-8 h-8 bg-maroon-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                              <Building2 className="w-4 h-4 text-maroon-800" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{building.name}</p>
                              {building.rooms && building.rooms.length > 0 && (
                                <p className="text-xs text-gray-500 truncate mt-0.5">
                                  {building.rooms.slice(0, 3).join(', ')}
                                  {building.rooms.length > 3 && ` +${building.rooms.length - 3} more`}
                                </p>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="px-4 py-6 text-center">
                      <Search className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No buildings or rooms found</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-500">Mode:</span>
            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
              {modes.map(m => (
                <button
                  key={m.id}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all",
                    mode === m.id
                      ? m.id === 'delete' 
                        ? "bg-red-100 text-red-600"
                        : "bg-white text-maroon-800 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  )}
                  onClick={() => {
                    setMode(m.id);
                    setSelectedNode(null);
                  }}
                >
                  <m.icon className="w-4 h-4" />
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant={mode === 'add_building' ? 'default' : 'outline'}
              onClick={() => setMode(mode === 'add_building' ? 'view' : 'add_building')}
            >
              <MapPin className="w-4 h-4" />
              Add Building
            </Button>

            {/* View Dropdown */}
            <div className="relative">
              <Button
                variant="outline"
                onClick={() => setShowViewMenu(!showViewMenu)}
              >
                <Eye className="w-4 h-4" />
                View
                <ChevronDown className="w-4 h-4" />
              </Button>
              
              {showViewMenu && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowViewMenu(false)}
                  />
                  <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Show on Map
                      </span>
                    </div>
                    <div className="py-2">
                      {viewLayerOptions.map(item => (
                        <label 
                          key={item.id} 
                          className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={viewLayers[item.id]}
                            onChange={() => toggleViewLayer(item.id)}
                            className="sr-only"
                          />
                          <div className={cn(
                            "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                            viewLayers[item.id] 
                              ? `${item.color} border-transparent` 
                              : "bg-white border-gray-300"
                          )}>
                            {viewLayers[item.id] && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <span className="flex-1 text-sm text-gray-700">{item.label}</span>
                          <span className={cn("w-2.5 h-2.5 rounded-full", item.color)} />
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Instructions */}
      {mode !== 'view' && (
        <div className={cn(
          "flex items-center justify-center gap-2 py-3 text-sm font-medium border-b",
          mode === 'delete' 
            ? "bg-red-50 border-red-200 text-red-700"
            : mode === 'add_building'
              ? "bg-amber-50 border-amber-200 text-amber-700"
              : "bg-blue-50 border-blue-200 text-blue-700"
        )}>
          {mode === 'add_node' && (
            <><Navigation className="w-4 h-4" /> Click on the map to add a navigation node</>
          )}
          {mode === 'add_building' && (
            <><MapPin className="w-4 h-4" /> Click on the map to place a building pin</>
          )}
          {mode === 'connect_node' && !selectedNode && (
            <><Link2 className="w-4 h-4" /> Click on a node to start connecting</>
          )}
          {mode === 'connect_node' && selectedNode && (
            <><Link2 className="w-4 h-4" /> Now click another node to create connection (or same node to deselect)</>
          )}
          {mode === 'delete' && (
            <><Trash2 className="w-4 h-4" /> Click on nodes or building pins to delete them</>
          )}
        </div>
      )}

      {/* Map */}
      <div className="flex-1 relative">
        <Map
          ref={mapRef}
          {...viewState}
          onMove={evt => setViewState(evt.viewState)}
          style={{ width: '100%', height: '100%' }}
          mapStyle="mapbox://styles/mapbox/streets-v12"
          mapboxAccessToken={MAPBOX_TOKEN}
          onClick={handleMapClick}
          cursor={
            mode === 'add_node' || mode === 'add_building' ? 'crosshair' : 
            mode === 'connect_node' || mode === 'delete' ? 'pointer' :
            'grab'
          }
        >
          {/* Evacuation Zones */}
          {viewLayers.evacuationZones && (
            <Source id="zones" type="geojson" data={zonesGeoJSON}>
              <Layer id="zones-fill" type="fill" paint={{ 'fill-color': '#22c55e', 'fill-opacity': 0.2 }} />
              <Layer id="zones-line" type="line" paint={{ 'line-color': '#16a34a', 'line-width': 2 }} />
            </Source>
          )}

          {/* Blockages */}
          {viewLayers.blockages && (
            <Source id="blockages" type="geojson" data={blockagesGeoJSON}>
              <Layer id="blockages-fill" type="fill" paint={{ 'fill-color': '#dc2626', 'fill-opacity': 0.3 }} />
              <Layer id="blockages-line" type="line" paint={{ 'line-color': '#991b1b', 'line-width': 2, 'line-dasharray': [3, 2] }} />
            </Source>
          )}

          {/* Edges */}
          {viewLayers.edges && (
            <Source id="edges" type="geojson" data={edgesGeoJSON}>
              <Layer id="edges-layer" type="line" paint={{ 'line-color': '#800000', 'line-width': 3, 'line-opacity': 0.7 }} />
            </Source>
          )}

          {/* Nodes */}
          {viewLayers.nodes && nodes.map(node => (
            <Marker 
              key={node.id} 
              longitude={node.lng} 
              latitude={node.lat}
              anchor="center"
            >
              <div 
                onClick={(e) => handleNodeClick({ originalEvent: e }, node)}
                className={cn(
                  "rounded-full border-[3px] border-white cursor-pointer shadow-lg transition-all",
                  selectedNode?.id === node.id 
                    ? "w-5 h-5 bg-emerald-500" 
                    : "w-3.5 h-3.5 bg-blue-500"
                )}
              />
            </Marker>
          ))}

          {/* Building Pins */}
          {viewLayers.buildings && filteredBuildings.map(b => (
            <Marker 
              key={b.id} 
              longitude={b.longitude} 
              latitude={b.latitude} 
              anchor="bottom"
            >
              <div 
                onClick={(e) => handleBuildingClick(e, b)}
                className="flex flex-col items-center cursor-pointer group"
              >
                <div className="w-8 h-8 bg-maroon-800 rounded-lg flex items-center justify-center shadow-lg border-2 border-white group-hover:scale-110 transition-transform">
                  <Building2 className="w-4 h-4 text-white" />
                </div>
                <div className="mt-1 px-2 py-1 bg-white rounded text-xs font-semibold text-gray-700 shadow-md whitespace-nowrap max-w-[120px] overflow-hidden text-ellipsis">
                  {b.name}
                </div>
              </div>
            </Marker>
          ))}

          {/* Pending Building Location */}
          {pendingBuildingLocation && (
            <Marker 
              longitude={pendingBuildingLocation.lng} 
              latitude={pendingBuildingLocation.lat}
              anchor="bottom"
            >
              <div className="flex flex-col items-center opacity-70">
                <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center shadow-lg border-2 border-white">
                  <Building2 className="w-4 h-4 text-white" />
                </div>
                <div className="mt-1 px-2 py-1 bg-white rounded text-xs font-semibold text-gray-700 shadow-md">
                  New Building
                </div>
              </div>
            </Marker>
          )}
        </Map>

        {/* Building Info Panel */}
        {selectedBuilding && (
          <div className="absolute top-4 right-4 w-80 bg-white rounded-xl shadow-xl overflow-hidden z-10">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h4 className="font-bold text-maroon-800">{selectedBuilding.name}</h4>
              <button 
                onClick={() => setSelectedBuilding(null)}
                className="w-7 h-7 bg-gray-100 rounded-md flex items-center justify-center text-gray-500 hover:bg-gray-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {selectedBuilding.description && (
              <p className="px-4 py-3 text-sm text-gray-600 border-b border-gray-100">
                {selectedBuilding.description}
              </p>
            )}
            
            {selectedBuilding.rooms && selectedBuilding.rooms.length > 0 && (
              <div className="px-4 py-3">
                <strong className="text-sm text-gray-700">Rooms ({selectedBuilding.rooms.length}):</strong>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {selectedBuilding.rooms.map((room, idx) => (
                    <Badge key={idx} variant="secondary">{room}</Badge>
                  ))}
                </div>
              </div>
            )}
            
            <div className="px-4 pb-4 flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  if (onEditBuilding) {
                    onEditBuilding(selectedBuilding.id);
                    setSelectedBuilding(null);
                  }
                }}
              >
                <Edit2 className="w-4 h-4" /> Edit Details
              </Button>
              {mode === 'delete' && (
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => {
                    if (window.confirm(`Delete "${selectedBuilding.name}"?`)) {
                      deleteBuilding(selectedBuilding.id);
                    }
                  }}
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Building Modal */}
      <Modal open={showAddBuildingModal} onClose={closeAddBuildingModal}>
        <ModalHeader onClose={closeAddBuildingModal}>
          <ModalTitle>Add Building Pin</ModalTitle>
        </ModalHeader>
        <ModalBody className="space-y-4">
          {pendingBuildingLocation ? (
            <div className="flex items-center gap-3 px-4 py-3 bg-green-50 rounded-lg text-green-700">
              <Check className="w-5 h-5" />
              <span className="text-sm font-medium">Location selected on map</span>
            </div>
          ) : (
            <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 rounded-lg text-amber-700">
              <MapPin className="w-5 h-5" />
              <span className="text-sm font-medium">Click on the map to select location</span>
            </div>
          )}
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Building Name *</label>
            <Input
              value={buildingName}
              onChange={(e) => setBuildingName(e.target.value)}
              placeholder="e.g., Main Building"
              autoFocus
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Description</label>
            <Textarea
              value={buildingDesc}
              onChange={(e) => setBuildingDesc(e.target.value)}
              placeholder="Brief description of the building..."
              rows={3}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={closeAddBuildingModal}>Cancel</Button>
          <Button 
            onClick={handleSaveBuilding}
            disabled={!pendingBuildingLocation || !buildingName.trim()}
          >
            Save Building
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};

export default MapEditor;
