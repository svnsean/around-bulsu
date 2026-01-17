// BuildingManager.js - Modern Tailwind UI with Supabase
import React, { useState, useEffect, useRef } from 'react';
import { supabase, subscribeToTable, uploadImage } from './supabase';
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
  const [editRoom, setEditRoom] = useState('');
  const [editFacility, setEditFacility] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);
  const { addToast } = useToast();

  useEffect(() => {
    const unsub = subscribeToTable('buildings', (data) => {
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

  const startEdit = (building) => {
    setEditingBuilding({ 
      id: building.id,
      name: building.name || '',
      description: building.description || '',
      rooms: building.rooms || [],
      facilities: building.facilities || [],
      images: building.images || []
    });
    setEditRoom('');
    setEditFacility('');
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
      const downloadURL = await uploadImage(`buildings/${editingBuilding.id}`, file);
      
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
    if (!editRoom.trim()) return;
    // Support comma-separated input
    const newRooms = editRoom.split(',').map(r => r.trim()).filter(r => r && !editingBuilding.rooms.includes(r));
    if (newRooms.length > 0) {
      setEditingBuilding({
        ...editingBuilding,
        rooms: [...editingBuilding.rooms, ...newRooms].sort((a, b) => a.localeCompare(b))
      });
    }
    setEditRoom('');
  };

  const handleAddEditFacility = () => {
    if (!editFacility.trim()) return;
    // Support comma-separated input
    const newFacilities = editFacility.split(',').map(f => f.trim()).filter(f => f && !editingBuilding.facilities.includes(f));
    if (newFacilities.length > 0) {
      setEditingBuilding({
        ...editingBuilding,
        facilities: [...editingBuilding.facilities, ...newFacilities].sort((a, b) => a.localeCompare(b))
      });
    }
    setEditFacility('');
  };

  const handleRemoveEditRoom = (index) => {
    const updatedRooms = [...editingBuilding.rooms];
    updatedRooms.splice(index, 1);
    setEditingBuilding({ ...editingBuilding, rooms: updatedRooms });
  };

  const handleRemoveEditFacility = (index) => {
    const updatedFacilities = [...editingBuilding.facilities];
    updatedFacilities.splice(index, 1);
    setEditingBuilding({ ...editingBuilding, facilities: updatedFacilities });
  };

  const handleSaveEdit = async () => {
    if (!editingBuilding.name.trim()) {
      addToast({ title: 'Error', description: 'Building name is required', variant: 'error' });
      return;
    }

    try {
      const { error } = await supabase
        .from('buildings')
        .update({
          name: editingBuilding.name.trim(),
          description: editingBuilding.description.trim(),
          rooms: editingBuilding.rooms.map(r => r.trim()).filter(r => r).sort((a, b) => a.localeCompare(b)),
          images: editingBuilding.images || []
        })
        .eq('id', editingBuilding.id);

      if (error) throw error;

      setEditingBuilding(null);
      setEditRoom('');
      addToast({ title: 'Success', description: 'Building updated successfully', variant: 'success' });
    } catch (error) {
      console.error('Error updating building:', error);
      addToast({ title: 'Error', description: 'Failed to update building', variant: 'error' });
    }
  };

  const handleDeleteBuilding = async (id) => {
    if (!window.confirm('Are you sure you want to delete this building?')) return;

    try {
      const { error } = await supabase.from('buildings').delete().eq('id', id);
      if (error) throw error;
      addToast({ title: 'Deleted', description: 'Building deleted successfully', variant: 'success' });
    } catch (error) {
      console.error('Error deleting building:', error);
      addToast({ title: 'Error', description: 'Failed to delete building', variant: 'error' });
    }
  };

  // Normalize string for search (lowercase, remove spaces/dashes)
  const normalizeForSearch = (str) => {
    return (str || '').toLowerCase().replace(/[-\\s]/g, '');
  };

  const filteredBuildings = buildings.filter(building => {
    if (!searchQuery.trim()) return true;
    const query = normalizeForSearch(searchQuery);
    if (normalizeForSearch(building.name).includes(query)) return true;
    if (building.rooms && Array.isArray(building.rooms)) {
      if (building.rooms.some(room => normalizeForSearch(room).includes(query))) return true;
    }
    if (building.facilities && Array.isArray(building.facilities)) {
      if (building.facilities.some(facility => normalizeForSearch(facility).includes(query))) return true;
    }
    return false;
  });

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
              <h2 className="text-xl font-semibold text-gray-900">Building Manager</h2>
              <p className="text-sm text-gray-500">
                {buildings.length} building{buildings.length !== 1 ? 's' : ''} registered
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search buildings or rooms..."
                className="pl-10 w-72"
              />
            </div>
            <Button onClick={handleAddBuilding}>
              <Plus className="w-4 h-4" />
              Add Building
            </Button>
          </div>
        </div>
      </div>

      {/* Building Grid */}
      <div className="flex-1 overflow-auto p-6">
        {filteredBuildings.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Building2 className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-lg font-medium">No buildings found</p>
            <p className="text-sm">Add a building using the Map Editor</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBuildings.map(building => (
              <Card key={building.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                {/* Building Image Preview */}
                {building.images && building.images.length > 0 ? (
                  <div className="h-32 bg-gray-100 overflow-hidden">
                    <img 
                      src={building.images[0]} 
                      alt={building.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="h-32 bg-gradient-to-br from-maroon-100 to-maroon-50 flex items-center justify-center">
                    <Building2 className="w-12 h-12 text-maroon-300" />
                  </div>
                )}
                
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 line-clamp-1">{building.name}</h3>
                    <div className="flex gap-1">
                      <button
                        onClick={() => startEdit(building)}
                        className="p-1.5 text-gray-400 hover:text-maroon-800 hover:bg-maroon-50 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteBuilding(building.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-500 line-clamp-2 mb-3">
                    {building.description || 'No description'}
                  </p>
                  
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <DoorOpen className="w-4 h-4" />
                    <span>{building.rooms?.length || 0} rooms</span>
                    {building.images && building.images.length > 0 && (
                      <>
                        <span className="text-gray-300">·</span>
                        <Image className="w-4 h-4" />
                        <span>{building.images.length} images</span>
                      </>
                    )}
                  </div>
                  
                  {building.rooms && building.rooms.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {building.rooms.slice(0, 3).map((room, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{room}</Badge>
                      ))}
                      {building.rooms.length > 3 && (
                        <Badge variant="outline" className="text-xs">+{building.rooms.length - 3}</Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Edit Building Modal */}
      <Modal open={!!editingBuilding} onOpenChange={(open) => !open && setEditingBuilding(null)}>
        <ModalHeader>
          <ModalTitle>Edit Building</ModalTitle>
        </ModalHeader>
        <ModalBody className="max-h-[70vh] overflow-y-auto">
          {editingBuilding && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Building Name *</label>
                <Input
                  value={editingBuilding.name}
                  onChange={(e) => setEditingBuilding({ ...editingBuilding, name: e.target.value })}
                  placeholder="Building name"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Description</label>
                <Textarea
                  value={editingBuilding.description}
                  onChange={(e) => setEditingBuilding({ ...editingBuilding, description: e.target.value })}
                  placeholder="Brief description..."
                  rows={3}
                />
              </div>

              {/* Rooms Section */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Rooms ({editingBuilding.rooms.length})
                </label>
                <div className="flex gap-2 mb-2">
                  <Input
                    value={editRoom}
                    onChange={(e) => setEditRoom(e.target.value)}
                    placeholder="Add rooms (comma-separated, e.g., 101, 102, 103)"
                    onKeyPress={(e) => e.key === 'Enter' && handleAddEditRoom()}
                    className="flex-1"
                  />
                  <Button onClick={handleAddEditRoom} variant="secondary">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {editingBuilding.rooms.map((room, index) => (
                    <Badge key={index} variant="secondary" className="pr-1">
                      {room}
                      <button
                        onClick={() => handleRemoveEditRoom(index)}
                        className="ml-1 p-0.5 hover:bg-gray-300 rounded-full"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Facilities Section */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Facilities ({editingBuilding.facilities?.length || 0})
                </label>
                <div className="flex gap-2 mb-2">
                  <Input
                    value={editFacility}
                    onChange={(e) => setEditFacility(e.target.value)}
                    placeholder="Add facilities (comma-separated, e.g., Library, Gym)"
                    onKeyPress={(e) => e.key === 'Enter' && handleAddEditFacility()}
                    className="flex-1"
                  />
                  <Button onClick={handleAddEditFacility} variant="secondary">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {editingBuilding.facilities?.map((facility, index) => (
                    <Badge key={index} variant="outline" className="pr-1 bg-green-50 text-green-700 border-green-200">
                      {facility}
                      <button
                        onClick={() => handleRemoveEditFacility(index)}
                        className="ml-1 p-0.5 hover:bg-green-200 rounded-full"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Images Section */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Building Images ({editingBuilding.images?.length || 0})
                </label>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {editingBuilding.images?.map((url, index) => (
                    <div key={index} className="relative group aspect-square">
                      <img
                        src={url}
                        alt={`Building ${index + 1}`}
                        className="w-full h-full object-cover rounded-lg"
                      />
                      <button
                        onClick={() => handleRemoveImage(index)}
                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="w-full"
                >
                  {uploadingImage ? (
                    <>Uploading...</>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Upload Image
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setEditingBuilding(null)}>Cancel</Button>
          <Button onClick={handleSaveEdit}>Save Changes</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};

export default BuildingManager;
