// ContactsManager.js - Emergency Contacts CRUD with Tailwind UI
import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, addDoc, onSnapshot, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { Phone, Plus, Edit2, Trash2, X, Search, Users } from 'lucide-react';
import { Button } from './components/ui/Button';
import { Input } from './components/ui/Input';
import { Card, CardContent } from './components/ui/Card';
import { Badge } from './components/ui/Badge';
import { Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter } from './components/ui/Modal';
import { useToast } from './components/ui/Toast';
import { cn } from './lib/utils';

const CATEGORIES = [
  'Campus Security',
  'Medical/Health',
  'Fire & Rescue',
  'Police',
  'Disaster Response',
  'Administration',
  'Other'
];

const categoryColors = {
  'Campus Security': 'bg-blue-100 text-blue-700 border-blue-200',
  'Medical/Health': 'bg-red-100 text-red-700 border-red-200',
  'Fire & Rescue': 'bg-orange-100 text-orange-700 border-orange-200',
  'Police': 'bg-indigo-100 text-indigo-700 border-indigo-200',
  'Disaster Response': 'bg-amber-100 text-amber-700 border-amber-200',
  'Administration': 'bg-purple-100 text-purple-700 border-purple-200',
  'Other': 'bg-gray-100 text-gray-700 border-gray-200',
};

const ContactsManager = () => {
  const [contacts, setContacts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    category: 'Campus Security',
    order: 0
  });
  const { addToast } = useToast();

  // Firestore listener
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'emergencyContacts'), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name));
      setContacts(data);
    });
    return () => unsub();
  }, []);

  // Filter contacts
  const filteredContacts = contacts.filter(contact => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      contact.name?.toLowerCase().includes(query) ||
      contact.phone?.includes(query) ||
      contact.category?.toLowerCase().includes(query)
    );
  });

  // Group contacts by category
  const groupedContacts = filteredContacts.reduce((acc, contact) => {
    const category = contact.category || 'Other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(contact);
    return acc;
  }, {});

  // Open modal for add/edit
  const openModal = (contact = null) => {
    if (contact) {
      setEditingContact(contact);
      setFormData({
        name: contact.name || '',
        phone: contact.phone || '',
        category: contact.category || 'Campus Security',
        order: contact.order || 0
      });
    } else {
      setEditingContact(null);
      setFormData({
        name: '',
        phone: '',
        category: 'Campus Security',
        order: contacts.length
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingContact(null);
    setFormData({ name: '', phone: '', category: 'Campus Security', order: 0 });
  };

  // Save contact
  const handleSave = async () => {
    if (!formData.name.trim() || !formData.phone.trim()) {
      addToast({ title: 'Error', description: 'Name and phone are required', variant: 'error' });
      return;
    }

    try {
      if (editingContact) {
        await updateDoc(doc(db, 'emergencyContacts', editingContact.id), {
          ...formData,
          updatedAt: new Date()
        });
        addToast({ title: 'Success', description: 'Contact updated successfully', variant: 'success' });
      } else {
        await addDoc(collection(db, 'emergencyContacts'), {
          ...formData,
          createdAt: new Date()
        });
        addToast({ title: 'Success', description: 'Contact added successfully', variant: 'success' });
      }
      closeModal();
    } catch (error) {
      console.error('Error saving contact:', error);
      addToast({ title: 'Error', description: 'Failed to save contact', variant: 'error' });
    }
  };

  // Delete contact
  const handleDelete = async (id, name) => {
    if (window.confirm(`Delete "${name}"?`)) {
      try {
        await deleteDoc(doc(db, 'emergencyContacts', id));
        addToast({ title: 'Deleted', description: 'Contact removed successfully', variant: 'success' });
      } catch (error) {
        console.error('Error deleting contact:', error);
        addToast({ title: 'Error', description: 'Failed to delete contact', variant: 'error' });
      }
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center">
              <Phone className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Emergency Contacts</h2>
              <p className="text-sm text-gray-500">{contacts.length} contacts total</p>
            </div>
          </div>
          <Button onClick={() => openModal()}>
            <Plus className="w-5 h-5" />
            Add Contact
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
            placeholder="Search contacts..."
            className="pl-10"
          />
        </div>
      </div>

      {/* Contacts List */}
      <div className="flex-1 overflow-auto p-6">
        {Object.keys(groupedContacts).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Users className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">
              {searchQuery ? 'No contacts found' : 'No contacts yet'}
            </h3>
            <p className="text-gray-500 mt-1">
              {searchQuery ? 'Try a different search term' : 'Click "Add Contact" to get started'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {CATEGORIES.filter(cat => groupedContacts[cat]?.length > 0).map(category => (
              <div key={category}>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{category}</h3>
                  <Badge variant="secondary" className="text-xs">{groupedContacts[category].length}</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {groupedContacts[category].map(contact => (
                    <Card key={contact.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-10 h-10 rounded-lg flex items-center justify-center border",
                              categoryColors[category] || categoryColors['Other']
                            )}>
                              <Phone className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className="font-medium text-gray-900">{contact.name}</h4>
                              <a 
                                href={`tel:${contact.phone}`}
                                className="text-sm text-maroon-800 hover:underline font-mono"
                              >
                                {contact.phone}
                              </a>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => openModal(contact)}
                              className="p-2 text-gray-400 hover:text-maroon-800 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDelete(contact.id, contact.name)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal open={showModal} onClose={closeModal}>
        <ModalHeader onClose={closeModal}>
          <ModalTitle>{editingContact ? 'Edit Contact' : 'Add New Contact'}</ModalTitle>
        </ModalHeader>
        <ModalBody className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Contact Name *</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="e.g., Campus Security Office"
              autoFocus
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Phone Number *</label>
            <Input
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              placeholder="e.g., 0917-123-4567"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Category</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({...formData, category: e.target.value})}
              className="flex h-10 w-full rounded-lg border-2 border-gray-200 bg-white px-3 py-2 text-sm transition-colors focus:outline-none focus:border-maroon-800 focus:ring-2 focus:ring-maroon-800/20"
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={closeModal}>Cancel</Button>
          <Button onClick={handleSave}>
            {editingContact ? 'Save Changes' : 'Add Contact'}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};

export default ContactsManager;
