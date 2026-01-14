// App.js
import React, { useState } from 'react';
import Login from './Login';
import AdminPanel from './AdminPanel';
import { ToastProvider } from './components/ui/Toast';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(
    localStorage.getItem('admin_logged_in') === 'true'
  );

  const handleLogin = () => {
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_logged_in');
    setIsLoggedIn(false);
  };

  return (
    <ToastProvider>
      <div className="app min-h-screen bg-gray-50">
        {isLoggedIn ? (
          <AdminPanel onLogout={handleLogout} />
        ) : (
          <Login onLogin={handleLogin} />
        )}
      </div>
    </ToastProvider>
  );
}

export default App;