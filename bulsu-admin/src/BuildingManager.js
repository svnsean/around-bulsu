// BuildingManager.js - Modern Tailwind UI Version
import React, { useState, useEffect, useRef } from 'react';
import { db, storage } from './firebase';
import { collection, addDoc, onSnapshot, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Search, Plus, Edit2, Trash2, X, Building2, DoorOpen, Upload, Image } from 'lucide-react';
import { Button } from './components/ui/Button';
import { Input, Textarea } from './components/ui/Input';
import { Card, CardContent } from './components/ui/Card';
import { Badge } from './components/ui/Badge';
import { Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter } from './components/ui/Modal';
import { useToast } from './components/ui/Toast';
import { cn } from './lib/utils';

const BuildingManager = ({ editBuildingId, onBuildingEdited, onSwitchToMapEditor }) => {
  const [buildings, setBuildings] = useState([]);
  const [editingBuilding, setEditingBuilding] = useState(null);
  const [newRoom, setNewRoom] = useState('');
  const [editRoom, setEditRoom] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);
  const { addToast } = useToast();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'buildings'), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort alphabetically by name
      data.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setBuildings(data);
    });
    return () => unsub();
  }, []);

  // Auto-open edit modal when editBuildingId is passed
  useEffect(() => {
    if (editBuildingId && buildings.length > 0) {
      const building = buildings.find(b => b.id === editBuildingId);
      if (building) {
        startEdit(building);
        if (onBuildingEdited) onBuildingEdited();
      }
    }
  }, [editBuildingId, buildings]);

  // Handle Add Building - redirect to Map Editor
  const handleAddBuilding = () => {
    if (onSwitchToMapEditor) {
      onSwitchToMapEditor();
      addToast({ 
        title: 'Map Editor', 
        description: 'Click on the map to place your building pin', 
        variant: 'info' 
      });
    }
  };

  const handleAddRoom = () => {
    // This is now only for the edit modal
  };

  const startEdit = (building) => {
    setEditingBuilding({ 
      id: building.id,
      name: building.name || '',
      description: building.description || '',
      rooms: building.rooms || [],
      images: building.images || []
    });
    setEditRoom('');
  };

  // Image upload handler
  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !editingBuilding) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      addToast({ title: 'Error', description: 'Please select an image file', variant: 'error' });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      addToast({ title: 'Error', description: 'Image must be smaller than 5MB', variant: 'error' });
      return;
    }

    setUploadingImage(true);
    try {
      // Create a unique filename
      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storageRef = ref(storage, `buildings/${editingBuilding.id}/${timestamp}_${sanitizedName}`);
      
      // Upload with metadata
      const metadata = { contentType: file.type };
      const uploadResult = await uploadBytes(storageRef, file, metadata);
      console.log('Upload successful:', uploadResult);
      
      const downloadURL = await getDownloadURL(storageRef);
      console.log('Download URL:', downloadURL);
      
      setEditingBuilding({
        ...editingBuilding,
        images: [...(editingBuilding.images || []), downloadURL]
      });
      
      addToast({ title: 'Success', description: 'Image uploaded successfully', variant: 'success' });
    } catch (error) {
      console.error('Error uploading image:', error);
      addToast({ title: 'Error', description: 'Failed to upload image', variant: 'error' });
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (index) => {
    const updatedImages = [...(editingBuilding.images || [])];
    updatedImages.splice(index, 1);
    setEditingBuilding({ ...editingBuilding, images: updatedImages });
  };

  const handleAddEditRoom = () => {
    if (editRoom.trim() && !editingBuilding.rooms.includes(editRoom.trim())) {
      setEditingBuilding({
        ...editingBuilding,
        rooms: [...editingBuilding.rooms, editRoom.trim()]
      });
      setEditRoom('');
    }
  };

  const handleRemoveEditRoom = (index) => {
    const updatedRooms = [...editingBuilding.rooms];
    updatedRooms.splice(index, 1);
    setEditingBuilding({ ...editingBuilding, rooms: updatedRooms });
  };

  const handleSaveEdit = async () => {
    if (!editingBuilding.name.trim()) {
      addToast({ title: 'Error', description: 'Building name is required', variant: 'error' });
      return;
    }

    try {
      await updateDoc(doc(db, 'buildings', editingBuilding.id), {
        name: editingBuilding.name.trim(),
        description: editingBuilding.description.trim(),
        rooms: editingBuilding.rooms.map(r => r.trim()).filter(r => r),
        images: editingBuilding.images || [],
        updatedAt: new Date()
      });
      setEditingBuilding(null);
      setEditRoom('');
      addToast({ title: 'Success', description: 'Building updated successfully', variant: 'success' });
    } catch (error) {
      console.error('Error updating building:', error);
      addToast({ title: 'Error', description: 'Failed to update building', variant: 'error' });
    }
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`Delete "${name}"? This will also remove all associated markers.`)) {
      try {
        await deleteDoc(doc(db, 'buildings', id));
        addToast({ title: 'Deleted', description: 'Building removed successfully', variant: 'success' });
      } catch (error) {
        console.error('Error deleting building:', error);
        addToast({ title: 'Error', description: 'Failed to delete building', variant: 'error' });
      }
    }
  };

  // Enhanced search with room matching
  const getSearchResults = () => {
    if (!searchQuery.trim()) return buildings;
    
    const query = searchQuery.toLowerCase();
    return buildings.filter(building => {
      if (building.name?.toLowerCase().includes(query)) return true;
      if (building.rooms && Array.isArray(building.rooms)) {
        return building.rooms.some(room => room.toLowerCase().includes(query));
      }
      return false;
    });
  };

  const filteredBuildings = getSearchResults();

  const getMatchingRooms = (building) => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return building.rooms?.filter(room => room.toLowerCase().includes(query)) || [];
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-maroon-800 rounded-xl flex items-center justify-center">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Buildings & Rooms</h2>
              <p className="text-sm text-gray-500">{buildings.length} buildings total</p>
            </div>
          </div>
          <Button onClick={handleAddBuilding}>
            <Plus className="w-5 h-5" />
            Add Building
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-6 py-4 bg-white border-b border-gray-100">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search buildings or rooms..."
            className="pl-10 pr-10"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        {searchQuery && (
          <p className="text-sm text-gray-500 mt-2">
            {filteredBuildings.length} result{filteredBuildings.length !== 1 ? 's' : ''} found
          </p>
        )}
      </div>

      {/* Buildings Grid */}
      <div className="flex-1 overflow-auto p-6">
        {filteredBuildings.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Building2 className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">
              {searchQuery ? 'No results found' : 'No buildings yet'}
            </h3>
            <p className="text-gray-500 mt-1">
              {searchQuery ? 'Try a different search term' : 'Click "Add Building" to get started'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBuildings.map(building => {
              const matchingRooms = getMatchingRooms(building);
              const isNameMatch = searchQuery && building.name?.toLowerCase().includes(searchQuery.toLowerCase());
              
              return (
                <Card key={building.id} className="hover:shadow-lg transition-shadow overflow-hidden">
                  {/* Building Image Preview */}
                  {building.images && building.images.length > 0 && (
                    <div className="h-32 w-full">
                      <img 
                        src={building.images[0]} 
                        alt={building.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-maroon-100 rounded-lg flex items-center justify-center">
                          {building.images && building.images.length > 0 ? (
                            <Image className="w-5 h-5 text-maroon-800" />
                          ) : (
                            <Building2 className="w-5 h-5 text-maroon-800" />
                          )}
                        </div>
                        <h3 className={cn(
                          "font-semibold text-gray-900",
                          isNameMatch && "bg-yellow-100 px-1"
                        )}>
                          {building.name}
                        </h3>
                      </div>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => startEdit(building)}
                          className="p-2 text-gray-400 hover:text-maroon-800 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Edit building"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(building.id, building.name)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete building"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    {building.description && (
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{building.description}</p>
                    )}
                    
                    {building.rooms && building.rooms.length > 0 && (
                      <div className="pt-3 border-t border-gray-100">
                        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                          <DoorOpen className="w-4 h-4" />
                          <span>{building.rooms.length} room{building.rooms.length !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {building.rooms.slice(0, 6).map((room, idx) => (
                            <Badge 
                              key={idx} 
                              variant={matchingRooms.includes(room) ? 'gold' : 'secondary'}
                              className="text-xs"
                            >
                              {room}
                            </Badge>
                          ))}
                          {building.rooms.length > 6 && (
                            <Badge variant="outline" className="text-xs">
                              +{building.rooms.length - 6} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Building Modal */}
      <Modal open={!!editingBuilding} onClose={() => setEditingBuilding(null)}>
        <ModalHeader onClose={() => setEditingBuilding(null)}>
          <ModalTitle>Edit Building</ModalTitle>
        </ModalHeader>
        {editingBuilding && (
          <>
            <ModalBody className="space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Building Name *</label>
                <Input
                  value={editingBuilding.name}
                  onChange={(e) => setEditingBuilding({...editingBuilding, name: e.target.value})}
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Description</label>
                <Textarea
                  value={editingBuilding.description}
                  onChange={(e) => setEditingBuilding({...editingBuilding, description: e.target.value})}
                  rows={3}
                />
              </div>

              {/* Image Upload Section */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Building Image</label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <Button 
                    variant="secondary" 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                  >
                    {uploadingImage ? (
                      <>
                        <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Upload Image
                      </>
                    )}
                  </Button>
                  <span className="text-xs text-gray-500">Max 5MB, JPG/PNG</span>
                </div>
                
                {/* Image Preview */}
                {editingBuilding.images?.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    {editingBuilding.images.map((url, index) => (
                      <div key={index} className="relative group">
                        <img 
                          src={url} 
                          alt={`Building ${index + 1}`}
                          className="w-full h-20 object-cover rounded-lg border border-gray-200"
                        />
                        <button
                          onClick={() => handleRemoveImage(index)}
                          className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Rooms</label>
                <div className="flex gap-2">
                  <Input
                    value={editRoom}
                    onChange={(e) => setEditRoom(e.target.value)}
                    placeholder="Add a room"
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddEditRoom())}
                    className="flex-1"
                  />
                  <Button variant="secondary" onClick={handleAddEditRoom}>
                    <Plus className="w-4 h-4" />
                    Add
                  </Button>
                </div>
                {editingBuilding.rooms?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {editingBuilding.rooms.map((room, index) => (
                      <Badge key={index} variant="secondary" className="pr-1 gap-1">
                        {room}
                        <button 
                          onClick={() => handleRemoveEditRoom(index)}
                          className="ml-1 p-0.5 hover:bg-gray-300 rounded"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="outline" onClick={() => setEditingBuilding(null)}>Cancel</Button>
              <Button onClick={handleSaveEdit}>Save Changes</Button>
            </ModalFooter>
          </>
        )}
      </Modal>
    </div>
  );
};

export default BuildingManager;
