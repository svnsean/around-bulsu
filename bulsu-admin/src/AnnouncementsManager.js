// AnnouncementsManager.js - Modern Tailwind UI with Supabase
import React, { useState, useEffect, useRef } from 'react';
import { supabase, subscribeToTable, uploadImage } from './supabase';
import { Megaphone, Plus, Trash2, Edit2, Image, Calendar, Eye, EyeOff, Upload } from 'lucide-react';
import { Button } from './components/ui/Button';
import { Input, Textarea } from './components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from './components/ui/Card';
import { Badge } from './components/ui/Badge';
import { Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter } from './components/ui/Modal';
import { useToast } from './components/ui/Toast';
import { cn } from './lib/utils';

const AnnouncementsManager = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [form, setForm] = useState({ title: '', body: '', image_url: '', active: true });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const { addToast } = useToast();

  useEffect(() => {
    const unsub = subscribeToTable('announcements', (data) => {
      setAnnouncements(data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    });
    return unsub;
  }, []);

  const openAddModal = () => {
    setEditingAnnouncement(null);
    setForm({ title: '', body: '', image_url: '', active: true });
    setShowModal(true);
  };

  const openEditModal = (announcement) => {
    setEditingAnnouncement(announcement);
    setForm({
      title: announcement.title || '',
      body: announcement.body || '',
      image_url: announcement.image_url || '',
      active: announcement.active !== false
    });
    setShowModal(true);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      addToast({ title: 'Error', description: 'Please select an image file', variant: 'error' });
      return;
    }

    setUploading(true);
    try {
      const url = await uploadImage('announcements', file);
      setForm({ ...form, image_url: url });
      addToast({ title: 'Uploaded', description: 'Image uploaded successfully', variant: 'success' });
    } catch (error) {
      addToast({ title: 'Error', description: 'Failed to upload image', variant: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      addToast({ title: 'Error', description: 'Title is required', variant: 'error' });
      return;
    }

    setLoading(true);
    try {
      if (editingAnnouncement) {
        await supabase.from('announcements').update({
          title: form.title.trim(),
          body: form.body.trim(),
          image_url: form.image_url || null,
          active: form.active
        }).eq('id', editingAnnouncement.id);
        addToast({ title: 'Updated', description: 'Announcement updated', variant: 'success' });
      } else {
        await supabase.from('announcements').insert([{
          title: form.title.trim(),
          body: form.body.trim(),
          image_url: form.image_url || null,
          active: form.active
        }]);
        addToast({ title: 'Created', description: 'Announcement created', variant: 'success' });
      }
      setShowModal(false);
    } catch (error) {
      addToast({ title: 'Error', description: 'Failed to save announcement', variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (announcement) => {
    try {
      await supabase.from('announcements').update({ active: !announcement.active }).eq('id', announcement.id);
      addToast({ 
        title: announcement.active ? 'Hidden' : 'Published', 
        description: `Announcement is now ${announcement.active ? 'hidden' : 'visible'}`,
        variant: 'info'
      });
    } catch (error) {
      addToast({ title: 'Error', description: 'Failed to update status', variant: 'error' });
    }
  };

  const handleDelete = async (announcementId) => {
    if (!window.confirm('Delete this announcement?')) return;
    try {
      await supabase.from('announcements').delete().eq('id', announcementId);
      addToast({ title: 'Deleted', description: 'Announcement removed', variant: 'success' });
    } catch (error) {
      addToast({ title: 'Error', description: 'Failed to delete', variant: 'error' });
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gold-100 rounded-xl flex items-center justify-center">
              <Megaphone className="w-6 h-6 text-gold-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
              <p className="text-gray-500">Manage campus news and updates</p>
            </div>
          </div>
          <Button onClick={openAddModal}>
            <Plus className="w-4 h-4" />
            New Announcement
          </Button>
        </div>

        {/* Announcements List */}
        <div className="space-y-4">
          {announcements.map(announcement => (
            <Card 
              key={announcement.id} 
              className={cn(
                "transition-all",
                !announcement.active && "opacity-60"
              )}
            >
              <CardContent className="p-0">
                <div className="flex">
                  {/* Image */}
                  {announcement.image_url ? (
                    <div className="w-48 h-36 flex-shrink-0">
                      <img
                        src={announcement.image_url}
                        alt=""
                        className="w-full h-full object-cover rounded-l-xl"
                      />
                    </div>
                  ) : (
                    <div className="w-48 h-36 flex-shrink-0 bg-gray-100 rounded-l-xl flex items-center justify-center">
                      <Image className="w-8 h-8 text-gray-300" />
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900">{announcement.title}</h3>
                          <Badge variant={announcement.active ? 'success' : 'secondary'}>
                            {announcement.active ? 'Active' : 'Hidden'}
                          </Badge>
                        </div>
                        <p className="text-gray-600 text-sm line-clamp-2 mb-2">
                          {announcement.body || 'No content'}
                        </p>
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Calendar className="w-3 h-3" />
                          {formatDate(announcement.created_at)}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 ml-4">
                        <button
                          onClick={() => handleToggleActive(announcement)}
                          className={cn(
                            "p-2 rounded-lg transition-colors",
                            announcement.active 
                              ? "text-green-600 hover:bg-green-50"
                              : "text-gray-400 hover:bg-gray-100"
                          )}
                          title={announcement.active ? 'Hide' : 'Show'}
                        >
                          {announcement.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => openEditModal(announcement)}
                          className="p-2 text-gray-400 hover:text-maroon-600 rounded-lg hover:bg-gray-100"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(announcement.id)}
                          className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {announcements.length === 0 && (
            <Card className="text-center py-12">
              <CardContent>
                <Megaphone className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Announcements Yet</h3>
                <p className="text-gray-500 mb-4">Create announcements to share important updates with users.</p>
                <Button onClick={openAddModal}>
                  <Plus className="w-4 h-4" />
                  Create First Announcement
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal open={showModal} onOpenChange={setShowModal}>
        <ModalHeader>
          <ModalTitle>{editingAnnouncement ? 'Edit Announcement' : 'New Announcement'}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Title *</label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g., Campus Event This Friday"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Content</label>
              <Textarea
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="Write your announcement here..."
                rows={4}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Image</label>
              {form.image_url ? (
                <div className="relative mb-2">
                  <img
                    src={form.image_url}
                    alt="Preview"
                    className="w-full h-40 object-cover rounded-lg"
                  />
                  <button
                    onClick={() => setForm({ ...form, image_url: '' })}
                    className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-maroon-400 hover:bg-maroon-50 transition-colors"
                >
                  {uploading ? (
                    <>
                      <div className="w-6 h-6 border-2 border-maroon-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm text-gray-500">Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-6 h-6 text-gray-400" />
                      <span className="text-sm text-gray-500">Click to upload image</span>
                    </>
                  )}
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="active"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                className="w-4 h-4 text-maroon-600 border-gray-300 rounded focus:ring-maroon-500"
              />
              <label htmlFor="active" className="text-sm text-gray-700">
                Publish immediately (visible to users)
              </label>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : editingAnnouncement ? 'Update' : 'Create'}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};

export default AnnouncementsManager;
