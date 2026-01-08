// BuildingManager.js
import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, addDoc, onSnapshot, updateDoc, deleteDoc, doc } from 'firebase/firestore';

const BuildingManager = () => {
  const [buildings, setBuildings] = useState([]);
  const [editingBuilding, setEditingBuilding] = useState(null);
  const [newBuilding, setNewBuilding] = useState({
    name: '',
    description: '',
    rooms: []
  });
  const [newRoom, setNewRoom] = useState('');
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'buildings'), (snap) => 
      setBuildings(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => unsub();
  }, []);

  const handleAddBuilding = async () => {
    if (!newBuilding.name.trim()) {
      setMessage('Building name is required');
      return;
    }

    try {
      await addDoc(collection(db, 'buildings'), {
        ...newBuilding,
        rooms: newBuilding.rooms.map(r => r.trim()).filter(r => r)
      });
      setNewBuilding({ name: '', description: '', rooms: [] });
      setMessage('Building added successfully');
    } catch (error) {
      setMessage('Error adding building');
    }
  };

  const handleAddRoom = () => {
    if (newRoom.trim() && !newBuilding.rooms.includes(newRoom.trim())) {
      setNewBuilding({
        ...newBuilding,
        rooms: [...newBuilding.rooms, newRoom.trim()]
      });
      setNewRoom('');
    }
  };

  const handleRemoveRoom = (index) => {
    const updatedRooms = [...newBuilding.rooms];
    updatedRooms.splice(index, 1);
    setNewBuilding({ ...newBuilding, rooms: updatedRooms });
  };

  const startEdit = (building) => {
    setEditingBuilding({ 
      id: building.id,
      name: building.name || '',
      description: building.description || '',
      rooms: building.rooms || []
    });
  };

  const handleSaveEdit = async () => {
    if (!editingBuilding.name.trim()) {
      setMessage('Building name is required');
      return;
    }

    try {
      await updateDoc(doc(db, 'buildings', editingBuilding.id), {
        name: editingBuilding.name.trim(),
        description: editingBuilding.description,
        rooms: editingBuilding.rooms.map(r => r.trim()).filter(r => r)
      });
      setEditingBuilding(null);
      setMessage('Building updated successfully');
    } catch (error) {
      setMessage('Error updating building');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this building?')) {
      try {
        await deleteDoc(doc(db, 'buildings', id));
        setMessage('Building deleted successfully');
      } catch (error) {
        setMessage('Error deleting building');
      }
    }
  };

  // Real-time search functionality
  const filteredBuildings = buildings.filter(building => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    if (building.name.toLowerCase().includes(query)) return true;
    
    if (building.rooms && Array.isArray(building.rooms)) {
      return building.rooms.some(room => 
        room.toLowerCase().includes(query)
      );
    }
    return false;
  });

  return (
    <div className="building-manager">
      <div className="manager-content">
        <div className="manager-panel">
          <h3>Building Manager</h3>
          
          <div className="search-section">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search buildings/rooms..."
            />
          </div>
          
          <div className="form-section">
            <h4>Add New Building</h4>
            <div className="form-group">
              <label>Name *</label>
              <input
                type="text"
                value={newBuilding.name}
                onChange={(e) => setNewBuilding({...newBuilding, name: e.target.value})}
                placeholder="Building Name"
              />
            </div>
            
            <div className="form-group">
              <label>Description</label>
              <textarea
                value={newBuilding.description}
                onChange={(e) => setNewBuilding({...newBuilding, description: e.target.value})}
                placeholder="Building Description"
              />
            </div>
            
            <div className="form-group">
              <label>Rooms</label>
              <div style={{display: 'flex', gap: '10px', marginBottom: '10px'}}>
                <input
                  type="text"
                  value={newRoom}
                  onChange={(e) => setNewRoom(e.target.value)}
                  placeholder="Room Name"
                  onKeyPress={(e) => e.key === 'Enter' && handleAddRoom()}
                />
                <button type="button" onClick={handleAddRoom}>Add</button>
              </div>
              <div className="room-list">
                {newBuilding.rooms.map((room, index) => (
                  <div key={index} className="room-item">
                    {room}
                    <button onClick={() => handleRemoveRoom(index)}>X</button>
                  </div>
                ))}
              </div>
            </div>
            
            <button onClick={handleAddBuilding}>Add Building</button>
          </div>

          <div className="buildings-list">
            <h4>Existing Buildings</h4>
            {filteredBuildings.map(building => (
              <div key={building.id} className="building-card">
                <h5>{building.name}</h5>
                <p>{building.description}</p>
                <div className="rooms-section">
                  <strong>Rooms:</strong>
                  <div className="room-list">
                    {building.rooms?.map((room, idx) => (
                      <span key={idx} className="room-tag">{room}</span>
                    ))}
                  </div>
                </div>
                <div className="building-actions">
                  <button onClick={() => startEdit(building)}>Edit</button>
                  <button onClick={() => handleDelete(building.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {editingBuilding && (
          <div className="edit-panel">
            <h4>Edit Building</h4>
            <div className="form-group">
              <label>Name *</label>
              <input
                type="text"
                value={editingBuilding.name}
                onChange={(e) => setEditingBuilding({...editingBuilding, name: e.target.value})}
              />
            </div>
            
            <div className="form-group">
              <label>Description</label>
              <textarea
                value={editingBuilding.description}
                onChange={(e) => setEditingBuilding({...editingBuilding, description: e.target.value})}
              />
            </div>
            
            <div className="form-group">
              <label>Rooms</label>
              <div style={{display: 'flex', gap: '10px', marginBottom: '10px'}}>
                <input
                  type="text"
                  value={newRoom}
                  onChange={(e) => setNewRoom(e.target.value)}
                  placeholder="Add Room"
                />
                <button type="button" onClick={() => {
                  if (newRoom.trim() && !editingBuilding.rooms.includes(newRoom.trim())) {
                    setEditingBuilding({
                      ...editingBuilding,
                      rooms: [...editingBuilding.rooms, newRoom.trim()]
                    });
                    setNewRoom('');
                  }
                }}>Add</button>
              </div>
              <div className="room-list">
                {editingBuilding.rooms?.map((room, index) => (
                  <div key={index} className="room-item">
                    {room}
                    <button onClick={() => {
                      const updatedRooms = [...editingBuilding.rooms];
                      updatedRooms.splice(index, 1);
                      setEditingBuilding({...editingBuilding, rooms: updatedRooms});
                    }}>X</button>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="edit-actions">
              <button onClick={() => setEditingBuilding(null)}>Cancel</button>
              <button onClick={handleSaveEdit}>Save Changes</button>
            </div>
          </div>
        )}
      </div>

      {message && <div className="message">{message}</div>}
    </div>
  );
};

export default BuildingManager;