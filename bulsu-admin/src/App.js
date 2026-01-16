// App.js
import React, { useState, useEffect } from 'react';
import 'mapbox-gl/dist/mapbox-gl.css';
import Login from './Login';
import AdminPanel from './AdminPanel';
import { ToastProvider } from './components/ui/Toast';
import './App.css';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const loggedIn = localStorage.getItem('adminLoggedIn');
    if (loggedIn === 'true') {
      setIsLoggedIn(true);
    }
  }, []);

  const handleLogin = () => {
    localStorage.setItem('adminLoggedIn', 'true');
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('adminLoggedIn');
    setIsLoggedIn(false);
  };

  if (!isLoggedIn) {
    return (
      <ToastProvider>
        <Login onLogin={handleLogin} />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <AdminPanel onLogout={handleLogout} />
    </ToastProvider>
  );
}

export default App;