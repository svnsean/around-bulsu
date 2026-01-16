// AdminPanel.js - Modern Tailwind UI with Supabase
import React, { useState } from 'react';
import { Map, Building2, AlertTriangle, Info, LogOut, MapPin, ChevronRight } from 'lucide-react';
import MapEditor from './MapEditor';
import BuildingManager from './BuildingManager';
import EmergencyManager from './EmergencyManager';
import InfoManager from './InfoManager';
import { Button } from './components/ui/Button';
import { cn } from './lib/utils';

const navItems = [
  { id: 'map', label: 'Map Editor', description: 'Manage campus map', icon: Map },
  { id: 'buildings', label: 'Buildings', description: 'Building info & rooms', icon: Building2 },
  { id: 'emergency', label: 'Emergency', description: 'Zones & blockages', icon: AlertTriangle },
  { id: 'info', label: 'Info', description: 'Contacts & announcements', icon: Info },
];

const AdminPanel = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState('map');
  const [editBuildingId, setEditBuildingId] = useState(null);
  const [mapEditorMode, setMapEditorMode] = useState(null);

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      onLogout();
    }
  };

  const handleEditBuilding = (buildingId) => {
    setEditBuildingId(buildingId);
    setActiveTab('buildings');
  };

  const handleSwitchToMapEditor = () => {
    setMapEditorMode('add_building');
    setActiveTab('map');
  };

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
        {/* Content area - removed duplicate header */}
        <div className="flex-1 overflow-auto">
          {activeTab === 'map' && <MapEditor onEditBuilding={handleEditBuilding} initialMode={mapEditorMode} onModeApplied={() => setMapEditorMode(null)} />}
          {activeTab === 'buildings' && <BuildingManager editBuildingId={editBuildingId} onBuildingEdited={() => setEditBuildingId(null)} onSwitchToMapEditor={handleSwitchToMapEditor} />}
          {activeTab === 'emergency' && <EmergencyManager />}
          {activeTab === 'info' && <InfoManager />}
        </div>
      </main>
    </div>
  );
};

export default AdminPanel;
