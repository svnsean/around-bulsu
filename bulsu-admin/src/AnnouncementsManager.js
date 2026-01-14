// AnnouncementsManager.js - Announcements CRUD with Tailwind UI
import React, { useState, useEffect } from 'react';
import { db, storage } from './firebase';
import { collection, addDoc, onSnapshot, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Megaphone, Plus, Edit2, Trash2, X, Search, Image, Eye, EyeOff, Calendar } from 'lucide-react';
import { Button } from './components/ui/Button';
import { Input, Textarea } from './components/ui/Input';
import { Card, CardContent } from './components/ui/Card';
import { Badge } from './components/ui/Badge';
import { Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter } from './components/ui/Modal';
import { useToast } from './components/ui/Toast';
import { cn } from './lib/utils';

const AnnouncementsManager = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    body: '',
    imageUrl: '',
    active: true
  });
  const [imageFile, setImageFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const { addToast } = useToast();

  // Firestore listener
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'announcements'), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort by date, newest first
      data.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB - dateA;
      });
      setAnnouncements(data);
    });
    return () => unsub();
  }, []);

  // Filter announcements
  const filteredAnnouncements = announcements.filter(ann => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      ann.title?.toLowerCase().includes(query) ||
      ann.body?.toLowerCase().includes(query)
    );
  });

  // Open modal for add/edit
  const openModal = (announcement = null) => {
    if (announcement) {
      setEditingAnnouncement(announcement);
      setFormData({
        title: announcement.title || '',
        body: announcement.body || '',
        imageUrl: announcement.imageUrl || '',
        active: announcement.active !== false
      });
    } else {
      setEditingAnnouncement(null);
      setFormData({ title: '', body: '', imageUrl: '', active: true });
    }
    setImageFile(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingAnnouncement(null);
    setFormData({ title: '', body: '', imageUrl: '', active: true });
    setImageFile(null);
  };

  // Upload image
  const uploadImage = async (file) => {
    const filename = `announcements/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, filename);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  };

  // Save announcement
  const handleSave = async () => {
    if (!formData.title.trim()) {
      addToast({ title: 'Error', description: 'Title is required', variant: 'error' });
      return;
    }

    setUploading(true);
    try {
      let imageUrl = formData.imageUrl;
      
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }

      const data = {
        title: formData.title.trim(),
        body: formData.body.trim(),
        imageUrl,
        active: formData.active
      };

      if (editingAnnouncement) {
        await updateDoc(doc(db, 'announcements', editingAnnouncement.id), {
          ...data,
          updatedAt: new Date()
        });
        addToast({ title: 'Success', description: 'Announcement updated', variant: 'success' });
      } else {
        await addDoc(collection(db, 'announcements'), {
          ...data,
          createdAt: new Date()
        });
        addToast({ title: 'Success', description: 'Announcement created', variant: 'success' });
      }
      closeModal();
    } catch (error) {
      console.error('Error saving announcement:', error);
      addToast({ title: 'Error', description: 'Failed to save announcement', variant: 'error' });
    } finally {
      setUploading(false);
    }
  };

  // Toggle active status
  const toggleActive = async (announcement) => {
    try {
      await updateDoc(doc(db, 'announcements', announcement.id), {
        active: !announcement.active,
        updatedAt: new Date()
      });
      addToast({ 
        title: announcement.active ? 'Deactivated' : 'Activated', 
        description: `Announcement is now ${announcement.active ? 'hidden' : 'visible'}`,
        variant: 'success' 
      });
    } catch (error) {
      addToast({ title: 'Error', description: 'Failed to update status', variant: 'error' });
    }
  };

  // Delete announcement
  const handleDelete = async (id, title) => {
    if (window.confirm(`Delete "${title}"?`)) {
      try {
        await deleteDoc(doc(db, 'announcements', id));
        addToast({ title: 'Deleted', description: 'Announcement removed', variant: 'success' });
      } catch (error) {
        addToast({ title: 'Error', description: 'Failed to delete', variant: 'error' });
      }
    }
  };

  // Format date
  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate?.() || new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center">
              <Megaphone className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Announcements</h2>
              <p className="text-sm text-gray-500">{announcements.length} total · {announcements.filter(a => a.active !== false).length} active</p>
            </div>
          </div>
          <Button onClick={() => openModal()}>
            <Plus className="w-5 h-5" />
            Create Announcement
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
            placeholder="Search announcements..."
            className="pl-10"
          />
        </div>
      </div>

      {/* Announcements List */}
      <div className="flex-1 overflow-auto p-6">
        {filteredAnnouncements.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Megaphone className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">
              {searchQuery ? 'No announcements found' : 'No announcements yet'}
            </h3>
            <p className="text-gray-500 mt-1">
              {searchQuery ? 'Try a different search term' : 'Click "Create Announcement" to get started'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAnnouncements.map(announcement => (
              <Card key={announcement.id} className={cn(
                "transition-all",
                announcement.active === false && "opacity-60"
              )}>
                <CardContent className="p-5">
                  <div className="flex gap-4">
                    {/* Image */}
                    {announcement.imageUrl && (
                      <div className="w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                        <img 
                          src={announcement.imageUrl} 
                          alt="" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900">{announcement.title}</h3>
                            <Badge variant={announcement.active !== false ? 'success' : 'secondary'}>
                              {announcement.active !== false ? 'Active' : 'Hidden'}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                            <Calendar className="w-4 h-4" />
                            {formatDate(announcement.createdAt)}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => toggleActive(announcement)}
                            className={cn(
                              "p-2 rounded-lg transition-colors",
                              announcement.active !== false 
                                ? "text-green-600 hover:bg-green-50" 
                                : "text-gray-400 hover:bg-gray-100"
                            )}
                            title={announcement.active !== false ? 'Hide' : 'Show'}
                          >
                            {announcement.active !== false ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                          </button>
                          <button 
                            onClick={() => openModal(announcement)}
                            className="p-2 text-gray-400 hover:text-maroon-800 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(announcement.id, announcement.title)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      {announcement.body && (
                        <p className="text-sm text-gray-600 line-clamp-2">{announcement.body}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal open={showModal} onClose={closeModal} className="max-w-2xl">
        <ModalHeader onClose={closeModal}>
          <ModalTitle>{editingAnnouncement ? 'Edit Announcement' : 'Create Announcement'}</ModalTitle>
        </ModalHeader>
        <ModalBody className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Title *</label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              placeholder="Announcement title"
              autoFocus
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Content</label>
            <Textarea
              value={formData.body}
              onChange={(e) => setFormData({...formData, body: e.target.value})}
              placeholder="Announcement content..."
              rows={5}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Image (optional)</label>
            <div className="flex gap-3">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files[0])}
                className="flex-1 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-maroon-100 file:text-maroon-800 hover:file:bg-maroon-200 cursor-pointer"
              />
            </div>
            {(formData.imageUrl || imageFile) && (
              <div className="mt-2 relative w-32 h-32 rounded-lg overflow-hidden bg-gray-100">
                <img 
                  src={imageFile ? URL.createObjectURL(imageFile) : formData.imageUrl} 
                  alt="Preview" 
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => { setImageFile(null); setFormData({...formData, imageUrl: ''}); }}
                  className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="active"
              checked={formData.active}
              onChange={(e) => setFormData({...formData, active: e.target.checked})}
              className="w-4 h-4 text-maroon-800 border-gray-300 rounded focus:ring-maroon-800"
            />
            <label htmlFor="active" className="text-sm text-gray-700">Show announcement to users</label>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={closeModal} disabled={uploading}>Cancel</Button>
          <Button onClick={handleSave} disabled={uploading}>
            {uploading ? 'Uploading...' : (editingAnnouncement ? 'Save Changes' : 'Create')}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};

export default AnnouncementsManager;
