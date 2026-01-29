// ContactsManager.js - Modern Tailwind UI with Supabase
import React, { useState, useEffect } from 'react';
import { supabase, subscribeToTable } from './supabase';
import { Phone, Plus, Trash2, Edit2, Users, Building, Shield, Heart } from 'lucide-react';
import { Button } from './components/ui/Button';
import { Input, Textarea } from './components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from './components/ui/Card';
import { Badge } from './components/ui/Badge';
import { Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter } from './components/ui/Modal';
import { useToast } from './components/ui/Toast';

const CATEGORIES = [
  { value: 'emergency', label: 'Emergency Services', icon: Shield, color: 'bg-red-100 text-red-700' },
  { value: 'medical', label: 'Medical', icon: Heart, color: 'bg-pink-100 text-pink-700' },
  { value: 'security', label: 'Campus Security', icon: Users, color: 'bg-blue-100 text-blue-700' },
  { value: 'admin', label: 'Administration', icon: Building, color: 'bg-purple-100 text-purple-700' },
  { value: 'other', label: 'Other', icon: Phone, color: 'bg-gray-100 text-gray-700' },
];

const ContactsManager = () => {
  const [contacts, setContacts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', category: 'emergency', order: 0 });
  const [loading, setLoading] = useState(false);

  const { addToast } = useToast();

  useEffect(() => {
    const unsub = subscribeToTable('emergency_contacts', (data) => {
      setContacts(data.sort((a, b) => (a.order || 0) - (b.order || 0)));
    });
    return unsub;
  }, []);

  const openAddModal = () => {
    setEditingContact(null);
    setForm({ name: '', phone: '', category: 'emergency', order: contacts.length });
    setShowModal(true);
  };

  const openEditModal = (contact) => {
    setEditingContact(contact);
    setForm({
      name: contact.name || '',
      phone: contact.phone || '',
      category: contact.category || 'emergency',
      order: contact.order || 0
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      addToast({ title: 'Error', description: 'Name and phone are required', variant: 'error' });
      return;
    }

    setLoading(true);
    try {
      if (editingContact) {
        await supabase.from('emergency_contacts').update({
          name: form.name.trim(),
          phone: form.phone.trim(),
          category: form.category,
          order: form.order
        }).eq('id', editingContact.id);
        addToast({ title: 'Updated', description: 'Contact updated successfully', variant: 'success' });
      } else {
        await supabase.from('emergency_contacts').insert([{
          name: form.name.trim(),
          phone: form.phone.trim(),
          category: form.category,
          order: form.order
        }]);
        addToast({ title: 'Added', description: 'Contact added successfully', variant: 'success' });
      }
      setShowModal(false);
    } catch (error) {
      addToast({ title: 'Error', description: 'Failed to save contact', variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (contactId) => {
    if (!window.confirm('Delete this contact?')) return;
    try {
      await supabase.from('emergency_contacts').delete().eq('id', contactId);
      addToast({ title: 'Deleted', description: 'Contact removed', variant: 'success' });
    } catch (error) {
      addToast({ title: 'Error', description: 'Failed to delete contact', variant: 'error' });
    }
  };

  const getCategoryInfo = (category) => {
    return CATEGORIES.find(c => c.value === category) || CATEGORIES.find(c => c.value === 'other');
  };

  // Group contacts by category, putting uncategorized ones in "Other"
  const getContactCategory = (contact) => {
    const knownCategories = ['emergency', 'medical', 'security', 'admin'];
    if (!contact.category || !knownCategories.includes(contact.category)) {
      return 'other';
    }
    return contact.category;
  };

  const groupedContacts = CATEGORIES.map(cat => ({
    ...cat,
    contacts: contacts.filter(c => getContactCategory(c) === cat.value)
  })).filter(cat => cat.contacts.length > 0);

  return (
    <div className="h-full overflow-y-auto bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-maroon-100 rounded-xl flex items-center justify-center">
              <Phone className="w-6 h-6 text-maroon-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Emergency Contacts</h1>
              <p className="text-gray-500">Manage campus emergency contact numbers</p>
            </div>
          </div>
          <Button onClick={openAddModal}>
            <Plus className="w-4 h-4" />
            Add Contact
          </Button>
        </div>

        {/* Category Cards */}
        <div className="grid gap-6">
          {CATEGORIES.map(category => {
            const categoryContacts = contacts.filter(c => getContactCategory(c) === category.value);
            const Icon = category.icon;
            
            return (
              <Card key={category.value}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${category.color.split(' ')[0]}`}>
                      <Icon className={`w-5 h-5 ${category.color.split(' ')[1]}`} />
                    </div>
                    <CardTitle>{category.label}</CardTitle>
                    <Badge variant="secondary">{categoryContacts.length}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {categoryContacts.length === 0 ? (
                    <p className="text-gray-400 text-sm py-4 text-center">No contacts in this category</p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {categoryContacts.map(contact => (
                        <div 
                          key={contact.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center border border-gray-200">
                              <Phone className="w-4 h-4 text-gray-500" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{contact.name}</p>
                              <p className="text-sm text-maroon-600 font-mono">{contact.phone}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEditModal(contact)}
                              className="p-2 text-gray-400 hover:text-maroon-600 rounded-lg hover:bg-white"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(contact.id)}
                              className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-white"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {contacts.length === 0 && (
          <Card className="text-center py-12">
            <CardContent>
              <Phone className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Contacts Yet</h3>
              <p className="text-gray-500 mb-4">Add emergency contacts that will be shown to mobile app users.</p>
              <Button onClick={openAddModal}>
                <Plus className="w-4 h-4" />
                Add First Contact
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal open={showModal} onOpenChange={setShowModal}>
        <ModalHeader>
          <ModalTitle>{editingContact ? 'Edit Contact' : 'Add New Contact'}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Contact Name *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Campus Security Office"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Phone Number *</label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="e.g., (044) 123-4567"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Display Order</label>
              <Input
                type="number"
                value={form.order}
                onChange={(e) => setForm({ ...form, order: parseInt(e.target.value) || 0 })}
                placeholder="0"
              />
              <p className="text-xs text-gray-500 mt-1">Lower numbers appear first</p>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : editingContact ? 'Update' : 'Add Contact'}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};

export default ContactsManager;
