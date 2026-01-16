// InfoManager.js - Combined Contacts & Announcements with Tailwind UI
import React, { useState, useEffect, useRef } from 'react';
import { supabase, subscribeToTable, uploadImage } from './supabase';
import { Phone, Megaphone, Plus, Trash2, Edit2, Upload, Image, Calendar, Eye, EyeOff, Users, Building, Shield, Heart, X, Info } from 'lucide-react';
import { Button } from './components/ui/Button';
import { Input, Textarea } from './components/ui/Input';
import { Card, CardContent } from './components/ui/Card';
import { Badge } from './components/ui/Badge';
import { Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter } from './components/ui/Modal';
import { useToast } from './components/ui/Toast';
import { cn } from './lib/utils';

const CATEGORIES = [
  { value: 'emergency', label: 'Emergency Services', icon: Shield, color: 'bg-red-100 text-red-700' },
  { value: 'medical', label: 'Medical', icon: Heart, color: 'bg-pink-100 text-pink-700' },
  { value: 'security', label: 'Campus Security', icon: Users, color: 'bg-blue-100 text-blue-700' },
  { value: 'admin', label: 'Administration', icon: Building, color: 'bg-purple-100 text-purple-700' },
];

const InfoManager = () => {
  const [activeSection, setActiveSection] = useState('announcements'); // 'announcements' or 'contacts'
  
  // Contacts state
  const [contacts, setContacts] = useState([]);
  const [showContactModal, setShowContactModal] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [contactForm, setContactForm] = useState({ name: '', phone: '', category: 'emergency', order: 0 });
  
  // Announcements state
  const [announcements, setAnnouncements] = useState([]);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [announcementForm, setAnnouncementForm] = useState({ title: '', body: '', image_url: '', active: true });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    const unsubContacts = subscribeToTable('emergency_contacts', (data) => {
      setContacts(data.sort((a, b) => (a.order || 0) - (b.order || 0)));
    });
    const unsubAnnouncements = subscribeToTable('announcements', (data) => {
      setAnnouncements(data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    });
    return () => { unsubContacts(); unsubAnnouncements(); };
  }, []);

  // Contact handlers
  const openAddContact = () => {
    setEditingContact(null);
    setContactForm({ name: '', phone: '', category: 'emergency', order: contacts.length });
    setShowContactModal(true);
  };

  const openEditContact = (contact) => {
    setEditingContact(contact);
    setContactForm({
      name: contact.name || '',
      phone: contact.phone || '',
      category: contact.category || 'emergency',
      order: contact.order || 0
    });
    setShowContactModal(true);
  };

  const handleSaveContact = async () => {
    if (!contactForm.name.trim() || !contactForm.phone.trim()) {
      addToast({ title: 'Error', description: 'Name and phone are required', variant: 'error' });
      return;
    }
    setLoading(true);
    try {
      if (editingContact) {
        await supabase.from('emergency_contacts').update(contactForm).eq('id', editingContact.id);
        addToast({ title: 'Updated', description: 'Contact updated', variant: 'success' });
      } else {
        await supabase.from('emergency_contacts').insert([contactForm]);
        addToast({ title: 'Added', description: 'Contact added', variant: 'success' });
      }
      setShowContactModal(false);
    } catch (error) {
      addToast({ title: 'Error', description: 'Failed to save contact', variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteContact = async (id) => {
    if (!window.confirm('Delete this contact?')) return;
    try {
      await supabase.from('emergency_contacts').delete().eq('id', id);
      addToast({ title: 'Deleted', description: 'Contact removed', variant: 'success' });
    } catch (error) {
      addToast({ title: 'Error', description: 'Failed to delete', variant: 'error' });
    }
  };

  // Announcement handlers
  const openAddAnnouncement = () => {
    setEditingAnnouncement(null);
    setAnnouncementForm({ title: '', body: '', image_url: '', active: true });
    setShowAnnouncementModal(true);
  };

  const openEditAnnouncement = (announcement) => {
    setEditingAnnouncement(announcement);
    setAnnouncementForm({
      title: announcement.title || '',
      body: announcement.body || '',
      image_url: announcement.image_url || '',
      active: announcement.active !== false
    });
    setShowAnnouncementModal(true);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      addToast({ title: 'Error', description: 'Please select an image', variant: 'error' });
      return;
    }
    setUploading(true);
    try {
      const url = await uploadImage(file, 'announcements');
      setAnnouncementForm({ ...announcementForm, image_url: url });
      addToast({ title: 'Uploaded', description: 'Image uploaded', variant: 'success' });
    } catch (error) {
      addToast({ title: 'Error', description: 'Upload failed', variant: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const handleSaveAnnouncement = async () => {
    if (!announcementForm.title.trim()) {
      addToast({ title: 'Error', description: 'Title is required', variant: 'error' });
      return;
    }
    setLoading(true);
    try {
      if (editingAnnouncement) {
        await supabase.from('announcements').update(announcementForm).eq('id', editingAnnouncement.id);
        addToast({ title: 'Updated', description: 'Announcement updated', variant: 'success' });
      } else {
        await supabase.from('announcements').insert([announcementForm]);
        addToast({ title: 'Created', description: 'Announcement created', variant: 'success' });
      }
      setShowAnnouncementModal(false);
    } catch (error) {
      addToast({ title: 'Error', description: 'Failed to save', variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAnnouncement = async (announcement) => {
    try {
      await supabase.from('announcements').update({ active: !announcement.active }).eq('id', announcement.id);
      addToast({ title: announcement.active ? 'Hidden' : 'Published', description: `Announcement is now ${announcement.active ? 'hidden' : 'visible'}`, variant: 'info' });
    } catch (error) {
      addToast({ title: 'Error', description: 'Failed to update', variant: 'error' });
    }
  };

  const handleDeleteAnnouncement = async (id) => {
    if (!window.confirm('Delete this announcement?')) return;
    try {
      await supabase.from('announcements').delete().eq('id', id);
      addToast({ title: 'Deleted', description: 'Announcement removed', variant: 'success' });
    } catch (error) {
      addToast({ title: 'Error', description: 'Failed to delete', variant: 'error' });
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getCategoryInfo = (category) => CATEGORIES.find(c => c.value === category) || CATEGORIES[0];

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-maroon-800 rounded-xl flex items-center justify-center">
              <Info className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Info Manager</h2>
              <p className="text-sm text-gray-500">
                {contacts.length} contacts · {announcements.length} announcements
              </p>
            </div>
          </div>
          
          {/* Section Toggle */}
          <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveSection('announcements')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
                activeSection === 'announcements' ? "bg-white text-maroon-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Megaphone className="w-4 h-4" />
              Announcements
            </button>
            <button
              onClick={() => setActiveSection('contacts')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
                activeSection === 'contacts' ? "bg-white text-maroon-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Phone className="w-4 h-4" />
              Contacts
            </button>
          </div>

          <Button onClick={activeSection === 'contacts' ? openAddContact : openAddAnnouncement}>
            <Plus className="w-4 h-4" />
            Add {activeSection === 'contacts' ? 'Contact' : 'Announcement'}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeSection === 'contacts' ? (
          /* Contacts - Clean List Design */
          <div className="space-y-6">
            {CATEGORIES.map(category => {
              const categoryContacts = contacts.filter(c => c.category === category.value);
              const Icon = category.icon;
              if (categoryContacts.length === 0) return null;
              return (
                <div key={category.value}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", category.color.split(' ')[0])}>
                      <Icon className={cn("w-4 h-4", category.color.split(' ')[1])} />
                    </div>
                    <h3 className="font-semibold text-gray-900">{category.label}</h3>
                    <Badge variant="secondary" className="text-xs">{categoryContacts.length}</Badge>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                    {categoryContacts.map(contact => (
                      <div key={contact.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                            <Phone className="w-4 h-4 text-gray-500" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{contact.name}</p>
                            <p className="text-maroon-600 font-medium text-sm">{contact.phone}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => openEditContact(contact)}
                            className="text-gray-400 hover:text-maroon-600"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleDeleteContact(contact.id)}
                            className="text-gray-400 hover:text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {contacts.length === 0 && (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Phone className="w-8 h-8 text-gray-300" />
                </div>
                <p className="text-gray-500 mb-4">No emergency contacts added yet</p>
                <Button onClick={openAddContact}>
                  <Plus className="w-4 h-4" />
                  Add First Contact
                </Button>
              </div>
            )}
          </div>
        ) : (
          /* Announcements List */
          <div className="space-y-4">
            {announcements.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <Megaphone className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No announcements yet</p>
                </CardContent>
              </Card>
            ) : (
              announcements.map(announcement => (
                <Card key={announcement.id} className={cn("overflow-hidden", !announcement.active && "opacity-60")}>
                  <CardContent className="p-0">
                    <div className="flex">
                      {announcement.image_url ? (
                        <div className="w-40 h-28 flex-shrink-0">
                          <img src={announcement.image_url} alt="" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-40 h-28 flex-shrink-0 bg-gray-100 flex items-center justify-center">
                          <Image className="w-8 h-8 text-gray-300" />
                        </div>
                      )}
                      <div className="flex-1 p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-gray-900">{announcement.title}</h3>
                              <Badge variant={announcement.active ? 'success' : 'secondary'}>
                                {announcement.active ? 'Active' : 'Hidden'}
                              </Badge>
                            </div>
                            <p className="text-gray-600 text-sm line-clamp-2">{announcement.body || 'No content'}</p>
                            <div className="flex items-center gap-1 text-xs text-gray-400 mt-2">
                              <Calendar className="w-3 h-3" />
                              {formatDate(announcement.created_at)}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <button onClick={() => handleToggleAnnouncement(announcement)} className={cn("p-1.5 rounded", announcement.active ? "text-green-600" : "text-gray-400")}>
                              {announcement.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                            </button>
                            <button onClick={() => openEditAnnouncement(announcement)} className="p-1.5 text-gray-400 hover:text-maroon-600 rounded">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDeleteAnnouncement(announcement.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>

      {/* Contact Modal */}
      <Modal open={showContactModal} onOpenChange={setShowContactModal}>
        <ModalHeader>
          <ModalTitle>{editingContact ? 'Edit Contact' : 'Add Contact'}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Name *</label>
              <Input value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} placeholder="Contact name" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Phone *</label>
              <Input value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} placeholder="Phone number" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Category</label>
              <select value={contactForm.category} onChange={(e) => setContactForm({ ...contactForm, category: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                {CATEGORIES.map(cat => <option key={cat.value} value={cat.value}>{cat.label}</option>)}
              </select>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowContactModal(false)}>Cancel</Button>
          <Button onClick={handleSaveContact} disabled={loading}>{loading ? 'Saving...' : 'Save'}</Button>
        </ModalFooter>
      </Modal>

      {/* Announcement Modal */}
      <Modal open={showAnnouncementModal} onOpenChange={setShowAnnouncementModal}>
        <ModalHeader>
          <ModalTitle>{editingAnnouncement ? 'Edit Announcement' : 'New Announcement'}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Title *</label>
              <Input value={announcementForm.title} onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })} placeholder="Announcement title" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Content</label>
              <Textarea value={announcementForm.body} onChange={(e) => setAnnouncementForm({ ...announcementForm, body: e.target.value })} placeholder="Announcement content..." rows={4} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Image</label>
              {announcementForm.image_url ? (
                <div className="relative mb-2">
                  <img src={announcementForm.image_url} alt="" className="w-full h-32 object-cover rounded-lg" />
                  <button onClick={() => setAnnouncementForm({ ...announcementForm, image_url: '' })} className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="w-full h-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center gap-2 hover:border-maroon-400">
                  {uploading ? 'Uploading...' : <><Upload className="w-5 h-5 text-gray-400" /><span className="text-gray-500">Upload image</span></>}
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={announcementForm.active} onChange={(e) => setAnnouncementForm({ ...announcementForm, active: e.target.checked })} className="w-4 h-4" />
              <span className="text-sm text-gray-700">Publish immediately</span>
            </label>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowAnnouncementModal(false)}>Cancel</Button>
          <Button onClick={handleSaveAnnouncement} disabled={loading}>{loading ? 'Saving...' : 'Save'}</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};

export default InfoManager;
