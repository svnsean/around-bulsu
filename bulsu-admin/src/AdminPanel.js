// AdminPanel.js - Modern Tailwind UI
import React, { useState } from 'react';
import MapEditor from './MapEditor';
import BuildingManager from './BuildingManager';
import EmergencyManager from './EmergencyManager';
import ContactsManager from './ContactsManager';
import AnnouncementsManager from './AnnouncementsManager';
import { 
  Map, Building2, AlertTriangle, Phone, Megaphone, LogOut, MapPin,
  ChevronRight
} from 'lucide-react';
import { cn } from './lib/utils';
import { Button } from './components/ui/Button';
import './AdminPanel.css';

const navItems = [
  { id: 'map', label: 'Map Editor', icon: Map, description: 'Manage navigation nodes' },
  { id: 'buildings', label: 'Buildings', icon: Building2, description: 'Building information' },
  { id: 'emergency', label: 'Emergency', icon: AlertTriangle, description: 'Zones & blockages' },
  { id: 'contacts', label: 'Contacts', icon: Phone, description: 'Emergency contacts' },
  { id: 'announcements', label: 'Announcements', icon: Megaphone, description: 'Campus updates' },
];

const AdminPanel = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState('map');
  const [editBuildingId, setEditBuildingId] = useState(null);

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      onLogout();
    }
  };

  const handleEditBuilding = (buildingId) => {
    setEditBuildingId(buildingId);
    setActiveTab('buildings');
  };

  // Handle switching to Map Editor (for adding buildings)
  const [mapEditorMode, setMapEditorMode] = useState(null);
  
  const handleSwitchToMapEditor = () => {
    setMapEditorMode('add_building');
    setActiveTab('map');
  };

  const activeItem = navItems.find(item => item.id === activeTab);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-72 bg-gradient-to-b from-maroon-800 via-maroon-900 to-maroon-950 flex flex-col shadow-2xl">
        {/* Logo */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gold-400 rounded-xl flex items-center justify-center shadow-lg">
              <MapPin className="w-6 h-6 text-maroon-900" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">ARound BulSU</h1>
              <p className="text-xs text-maroon-200">Admin Dashboard</p>
            </div>
          </div>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left group',
                  isActive 
                    ? 'bg-white/15 text-white shadow-lg' 
                    : 'text-maroon-100 hover:bg-white/10 hover:text-white'
                )}
              >
                <div className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
                  isActive ? 'bg-gold-400 text-maroon-900' : 'bg-white/10 text-maroon-200 group-hover:bg-white/15'
                )}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn('font-medium', isActive && 'text-white')}>{item.label}</p>
                  <p className="text-xs text-maroon-300 truncate">{item.description}</p>
                </div>
                {isActive && <ChevronRight className="w-5 h-5 text-gold-400" />}
              </button>
            );
          })}
        </nav>
        
        {/* Footer */}
        <div className="p-4 border-t border-white/10">
          <div className="bg-white/5 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gold-400 flex items-center justify-center text-maroon-900 font-bold">
                A
              </div>
              <div>
                <p className="text-sm font-medium text-white">Administrator</p>
                <p className="text-xs text-maroon-300">Full access</p>
              </div>
            </div>
          </div>
          <Button 
            variant="ghost"
            onClick={handleLogout}
            className="w-full text-white/80 hover:text-white hover:bg-white/10"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {/* Top header */}
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between shadow-sm">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{activeItem?.label}</h2>
            <p className="text-sm text-gray-500">{activeItem?.description}</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            System Online
          </div>
        </header>
        
        {/* Content area */}
        <div className="flex-1 overflow-auto">
          {activeTab === 'map' && <MapEditor onEditBuilding={handleEditBuilding} initialMode={mapEditorMode} onModeApplied={() => setMapEditorMode(null)} />}
          {activeTab === 'buildings' && <BuildingManager editBuildingId={editBuildingId} onBuildingEdited={() => setEditBuildingId(null)} onSwitchToMapEditor={handleSwitchToMapEditor} />}
          {activeTab === 'emergency' && <EmergencyManager />}
          {activeTab === 'contacts' && <ContactsManager />}
          {activeTab === 'announcements' && <AnnouncementsManager />}
        </div>
      </main>
    </div>
  );
};

export default AdminPanel;