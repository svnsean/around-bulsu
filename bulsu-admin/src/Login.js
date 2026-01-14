// Login.js - Modern Tailwind UI
import React, { useState } from 'react';
import { MapPin, Lock, User, Eye, EyeOff } from 'lucide-react';
import { Button } from './components/ui/Button';
import { Input } from './components/ui/Input';

// Hardcoded credentials (like router admin)
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'bulsuadmin123';

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    // Simple hardcoded check
    setTimeout(() => {
      if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        localStorage.setItem('admin_logged_in', 'true');
        onLogin();
      } else {
        setError('Invalid username or password');
      }
      setLoading(false);
    }, 500);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-maroon-800 via-maroon-900 to-maroon-950 p-12 flex-col justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gold-400 rounded-xl flex items-center justify-center">
              <MapPin className="w-7 h-7 text-maroon-900" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">ARound BulSU</h1>
              <p className="text-maroon-200 text-sm">Admin Dashboard</p>
            </div>
          </div>
        </div>
        
        <div className="space-y-6">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <h2 className="text-xl font-semibold text-white mb-3">Campus Navigation System</h2>
            <p className="text-maroon-200 leading-relaxed">
              Manage buildings, navigation nodes, emergency zones, and announcements for the Bulacan State University AR navigation app.
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <p className="text-3xl font-bold text-gold-400">AR</p>
              <p className="text-maroon-200 text-sm">Navigation</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <p className="text-3xl font-bold text-gold-400">24/7</p>
              <p className="text-maroon-200 text-sm">Availability</p>
            </div>
          </div>
        </div>
        
        <div>
          <p className="text-maroon-300 text-sm">© 2026 Bulacan State University</p>
        </div>
      </div>
      
      {/* Right side - Login form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 bg-maroon-800 rounded-xl flex items-center justify-center">
              <MapPin className="w-7 h-7 text-gold-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">ARound BulSU</h1>
              <p className="text-gray-500 text-sm">Admin Dashboard</p>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
              <p className="text-gray-500 mt-2">Sign in to access the admin panel</p>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Username</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username"
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="pl-10 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              
              {error && (
                <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
                  {error}
                </div>
              )}
              
              <Button 
                type="submit" 
                className="w-full h-12 text-base"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Signing in...
                  </span>
                ) : 'Sign in'}
              </Button>
            </form>
            
            <div className="mt-6 pt-6 border-t border-gray-100">
              <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                <p className="text-sm text-amber-800 font-medium">Demo Credentials</p>
                <p className="text-sm text-amber-700 mt-1">
                  Username: <code className="bg-amber-100 px-1.5 py-0.5 rounded">admin</code><br/>
                  Password: <code className="bg-amber-100 px-1.5 py-0.5 rounded">bulsuadmin123</code>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;