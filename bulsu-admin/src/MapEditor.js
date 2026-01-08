// MapEditor.js
import React, { useState, useEffect } from 'react';
import Map, { Source, Layer, Marker } from 'react-map-gl';
import { db } from './firebase';
import { collection, addDoc, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = 'pk.eyJ1Ijoic3Zuc2VhbiIsImEiOiJjbWh6MXViYmQwaWlvMnJxMW15MW41cWltIn0.Qz2opq51Zz3oj-MGPz7aow';

const MapEditor = () => {
  const [viewState, setViewState] = useState({
    longitude: 120.8160, latitude: 14.8590, zoom: 17
  });
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [mode, setMode] = useState('view');
  const [selectedNode, setSelectedNode] = useState(null);
  const [message, setMessage] = useState('');
  const [buildingName, setBuildingName] = useState('');
  const [buildingDesc, setBuildingDesc] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredBuildings, setFilteredBuildings] = useState([]);
  const [selectedBuilding, setSelectedBuilding] = useState(null);

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
    return () => { 
      unsubNodes?.(); 
      unsubEdges?.(); 
      unsubBuildings?.(); 
    };
  }, []);

  // Real-time search functionality
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredBuildings(buildings);
      return;
    }
    
    const query = searchQuery.toLowerCase();
    const results = buildings.filter(building => {
      // Search by building name
      if (building.name.toLowerCase().includes(query)) return true;
      
      // Search by room
      if (building.rooms && Array.isArray(building.rooms)) {
        return building.rooms.some(room => 
          room.toLowerCase().includes(query)
        );
      }
      return false;
    });
    
    setFilteredBuildings(results);
  }, [searchQuery, buildings]);

  const handleMapClick = async (event) => {
    const { lng, lat } = event.lngLat;

    if (mode === 'add_node') {
      try {
        await addDoc(collection(db, 'nodes'), { lng, lat });
        setMessage('Node added successfully');
      } catch (error) {
        setMessage('Error adding node');
      }
    }

    if (mode === 'add_building') {
      if (!buildingName.trim()) {
        setMessage('Building name is required');
        return;
      }
      
      try {
        await addDoc(collection(db, 'buildings'), { 
          name: buildingName.trim(), 
          description: buildingDesc,
          longitude: lng, 
          latitude: lat 
        });
        setBuildingName('');
        setBuildingDesc('');
        setMode('view');
        setMessage('Building added successfully');
      } catch (error) {
        setMessage('Error adding building');
      }
    }
  };

  const handleNodeClick = async (e, node) => {
    e.originalEvent.stopPropagation();

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
          setMessage('Node deleted');
        } catch (error) {
          setMessage('Error deleting node');
        }
      }
      return;
    }

    if (mode === 'connect_node') {
      if (!selectedNode) {
        setSelectedNode(node);
        setMessage('Selected start node');
      } else {
        if (selectedNode.id === node.id) {
          setMessage('Cannot connect to self');
          return;
        }

        const existingEdge = edges.find(edge => 
          (edge.from === selectedNode.id && edge.to === node.id) ||
          (edge.from === node.id && edge.to === selectedNode.id)
        );
        
        if (existingEdge) {
          setMessage('Edge already exists');
          return;
        }

        try {
          const weight = Math.hypot(node.lng - selectedNode.lng, node.lat - selectedNode.lat);
          
          await addDoc(collection(db, 'edges'), {
            from: selectedNode.id,
            to: node.id,
            weight: weight
          });

          setMessage('Edge created');
          setSelectedNode(node);
        } catch (error) {
          setMessage('Error creating edge');
        }
      }
    }
  };

  const handleBuildingClick = (building) => {
    if (mode === 'delete') {
      if(window.confirm(`Delete building "${building.name}"?`)) {
        deleteBuilding(building.id);
      }
    } else {
      setSelectedBuilding(building);
    }
  };

  const deleteBuilding = async (id) => {
    try {
      await deleteDoc(doc(db, 'buildings', id));
      setMessage('Building deleted successfully');
    } catch (error) {
      setMessage('Error deleting building');
    }
  };

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

  const nodesGeoJSON = {
    type: 'FeatureCollection',
    features: nodes.map(n => ({
      type: 'Feature', 
      geometry: { type: 'Point', coordinates: [n.lng, n.lat] }, 
      properties: { id: n.id }
    }))
  };

  return (
    <div className="map-editor">
      <div className="control-panel">
        <h3>Map Controls</h3>
        
        <div className="control-group">
          <h4>Search</h4>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search buildings/rooms..."
          />
        </div>
        
        <div className="control-group">
          <h4>Mode</h4>
          <div className="mode-buttons">
            <button 
              className={mode === 'view' ? 'active' : ''}
              onClick={() => setMode('view')}
            >
              View
            </button>
            <button 
              className={mode === 'add_node' ? 'active' : ''}
              onClick={() => setMode('add_node')}
            >
              Add Node
            </button>
            <button 
              className={mode === 'connect_node' ? 'active' : ''}
              onClick={() => setMode('connect_node')}
            >
              Connect Nodes
            </button>
            <button 
              className={mode === 'delete' ? 'active' : ''}
              onClick={() => setMode('delete')}
            >
              Delete
            </button>
          </div>
        </div>

        <div className="control-group">
          <h4>Add Building</h4>
          <input
            type="text"
            value={buildingName}
            onChange={(e) => setBuildingName(e.target.value)}
            placeholder="Building Name"
          />
          <textarea
            value={buildingDesc}
            onChange={(e) => setBuildingDesc(e.target.value)}
            placeholder="Description"
          />
          <button 
            className={mode === 'add_building' ? 'active' : ''}
            onClick={() => setMode('add_building')}
          >
            Place Building
          </button>
        </div>

        <div className="stats">
          <p>Nodes: {nodes.length}</p>
          <p>Edges: {edges.length}</p>
          <p>Buildings: {buildings.length}</p>
        </div>

        {message && <div className="message">{message}</div>}
      </div>

      <div className="map-container">
        {selectedBuilding && (
          <div className="building-info-panel">
            <h4>{selectedBuilding.name}</h4>
            <p>{selectedBuilding.description}</p>
            <div className="rooms-section">
              <strong>Rooms:</strong>
              <div className="room-list">
                {selectedBuilding.rooms?.map((room, idx) => (
                  <span key={idx} className="room-tag">{room}</span>
                ))}
              </div>
            </div>
            <button onClick={() => setSelectedBuilding(null)}>Close</button>
          </div>
        )}

        <Map
          {...viewState}
          onMove={evt => setViewState(evt.viewState)}
          style={{ width: '100%', height: '100%' }}
          mapStyle="mapbox://styles/mapbox/streets-v11"
          mapboxAccessToken={MAPBOX_TOKEN}
          onClick={handleMapClick}
          cursor={
            mode === 'add_node' || mode === 'add_building' ? 'crosshair' : 
            mode === 'connect_node' ? (selectedNode ? 'pointer' : 'default') : 
            'pointer'
          }
        >
          <Source id="edges-data" type="geojson" data={edgesGeoJSON}>
            <Layer 
              id="edges-layer" 
              type="line" 
              paint={{ 'line-color': '#333', 'line-width': 3, 'line-opacity': 0.7 }} 
            />
          </Source>

          <Source id="nodes-data" type="geojson" data={nodesGeoJSON}>
            <Layer 
              id="nodes-layer" 
              type="circle" 
              paint={{ 
                'circle-radius': [
                  'case',
                  ['==', ['get', 'id'], selectedNode?.id || ''], 10,
                  6
                ],
                'circle-color': [
                   'case', 
                   ['==', ['get', 'id'], selectedNode?.id || ''], '#28a745',
                   '#007bff'
                ],
                'circle-stroke-width': 2,
                'circle-stroke-color': '#fff'
              }} 
            />
          </Source>

          {nodes.map(node => (
            <Marker 
              key={node.id} 
              longitude={node.lng} 
              latitude={node.lat}
              anchor="center"
              onClick={(e) => handleNodeClick(e, node)}
            >
              <div style={{width: 20, height: 20, cursor: 'pointer'}} />
            </Marker>
          ))}

          {buildings.map(b => (
            <Marker 
              key={b.id} 
              longitude={b.longitude} 
              latitude={b.latitude} 
              anchor="bottom"
              onClick={() => handleBuildingClick(b)}
            >
              <div style={{display: 'flex', alignItems: 'flex-start', transform: 'translateX(-50%)'}}>
                {/* Google Maps-style pin */}
                <div style={{
                  width: 0,
                  height: 0,
                  borderLeft: '10px solid transparent',
                  borderRight: '10px solid transparent',
                  borderBottom: '20px solid #800000',
                  position: 'relative',
                  marginBottom: '5px'
                }}>
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '6px',
                    height: '6px',
                    backgroundColor: 'white',
                    borderRadius: '50%'
                  }}></div>
                </div>
                
                {/* Building name label */}
                <div style={{
                  background: 'white',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  marginLeft: '10px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  whiteSpace: 'nowrap'
                }}>
                  {b.name}
                </div>
              </div>
            </Marker>
          ))}
        </Map>
      </div>
    </div>
  );
};

export default MapEditor;