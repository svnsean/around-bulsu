// AdminPanel.js
import React, { useState } from 'react';
import MapEditor from './MapEditor';
import BuildingManager from './BuildingManager';
import './AdminPanel.css';

const AdminPanel = ({ setIsAuthenticated }) => {
  const [activeTab, setActiveTab] = useState('map');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    setIsAuthenticated(false);
  };

  return (
    <div className="admin-panel">
      <div className="sidebar">
        <header className="admin-header">
          <h1>ARound BulSU Admin</h1>
        </header>

        <nav className="admin-nav">
          <button 
            className={activeTab === 'map' ? 'active' : ''}
            onClick={() => setActiveTab('map')}
          >
            Map Editor
          </button>
          <button 
            className={activeTab === 'buildings' ? 'active' : ''}
            onClick={() => setActiveTab('buildings')}
          >
            Buildings
          </button>
        </nav>

        <div className="sidebar-footer">
          <button 
            className="logout-btn"
            onClick={() => setShowLogoutConfirm(true)}
          >
            Logout
          </button>
        </div>
      </div>

      <main className="admin-main">
        {activeTab === 'map' && <MapEditor />}
        {activeTab === 'buildings' && <BuildingManager />}
      </main>

      {showLogoutConfirm && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Confirm Logout</h3>
            <p>Are you sure you want to logout?</p>
            <div className="modal-actions">
              <button 
                className="btn-cancel"
                onClick={() => setShowLogoutConfirm(false)}
              >
                Cancel
              </button>
              <button 
                className="btn-logout"
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;