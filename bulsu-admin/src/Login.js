// Login.js - Inline styles for reliable rendering
import React, { useState } from 'react';
import { MapPin, Lock, User, Eye, EyeOff } from 'lucide-react';

// Hardcoded credentials
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'bulsuadmin123';

// Brand colors
const colors = {
  maroon: '#800000',
  maroonDark: '#5a0000',
  maroonDarker: '#3d0000',
  gold: '#ffd700',
  goldHover: '#f5c400',
  dark: '#0f0f1a',
  darkCard: '#1a1a2e',
  darkInput: '#16213e',
  green: '#22c55e',
  red: '#ef4444',
};

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
    
    setTimeout(() => {
      if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        localStorage.setItem('adminLoggedIn', 'true');
        onLogin();
      } else {
        setError('Invalid username or password');
      }
      setLoading(false);
    }, 500);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex' }}>
      {/* Left side - Branding */}
      <div style={{
        display: 'none',
        width: '50%',
        background: `linear-gradient(135deg, ${colors.maroon} 0%, ${colors.maroonDark} 50%, ${colors.maroonDarker} 100%)`,
        padding: 48,
        flexDirection: 'column',
        justifyContent: 'space-between',
      }} className="login-branding">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 48,
              height: 48,
              background: colors.gold,
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <MapPin size={28} color={colors.maroon} />
            </div>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', margin: 0 }}>ARound BulSU</h1>
              <p style={{ fontSize: 14, color: '#ffb3b3', margin: 0 }}>Admin Dashboard</p>
            </div>
          </div>
        </div>
        
        <div>
          <div style={{
            background: 'rgba(255,255,255,0.1)',
            backdropFilter: 'blur(8px)',
            borderRadius: 16,
            padding: 24,
            border: '1px solid rgba(255,255,255,0.1)',
            marginBottom: 24,
          }}>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: '#fff', marginBottom: 12 }}>Campus Navigation System</h2>
            <p style={{ color: '#ffb3b3', lineHeight: 1.6, margin: 0 }}>
              Manage buildings, navigation nodes, emergency zones, and announcements for the Bulacan State University AR navigation app.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 16, border: '1px solid rgba(255,255,255,0.1)' }}>
              <p style={{ fontSize: 28, fontWeight: 700, color: colors.gold, margin: 0 }}>AR</p>
              <p style={{ color: '#ffb3b3', fontSize: 14, margin: 0 }}>Navigation</p>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 16, border: '1px solid rgba(255,255,255,0.1)' }}>
              <p style={{ fontSize: 28, fontWeight: 700, color: colors.gold, margin: 0 }}>24/7</p>
              <p style={{ color: '#ffb3b3', fontSize: 14, margin: 0 }}>Availability</p>
            </div>
          </div>
        </div>
        
        <p style={{ color: '#ff8080', fontSize: 14 }}>© 2026 Bulacan State University</p>
      </div>
      
      {/* Right side - Login form */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        background: '#f9fafb',
      }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          {/* Form Card */}
          <div style={{
            background: '#fff',
            borderRadius: 16,
            boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
            padding: 32,
            border: '1px solid #e5e7eb',
          }}>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <h2 style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: 0 }}>Welcome back</h2>
              <p style={{ color: '#6b7280', marginTop: 8 }}>Sign in to access the admin panel</p>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#374151', marginBottom: 8 }}>Username</label>
                <div style={{ position: 'relative' }}>
                  <User size={20} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username"
                    required
                    style={{
                      width: '100%',
                      padding: '12px 12px 12px 44px',
                      borderRadius: 8,
                      border: '2px solid #e5e7eb',
                      fontSize: 14,
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      boxSizing: 'border-box',
                    }}
                    onFocus={(e) => e.target.style.borderColor = colors.maroon}
                    onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                  />
                </div>
              </div>
              
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#374151', marginBottom: 8 }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={20} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    required
                    style={{
                      width: '100%',
                      padding: '12px 44px 12px 44px',
                      borderRadius: 8,
                      border: '2px solid #e5e7eb',
                      fontSize: 14,
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      boxSizing: 'border-box',
                    }}
                    onFocus={(e) => e.target.style.borderColor = colors.maroon}
                    onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      color: '#9ca3af',
                    }}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
              
              {error && (
                <div style={{
                  background: '#fef2f2',
                  color: '#dc2626',
                  fontSize: 14,
                  padding: '12px 16px',
                  borderRadius: 8,
                  border: '1px solid #fecaca',
                  marginBottom: 20,
                }}>
                  {error}
                </div>
              )}
              
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '14px 24px',
                  background: colors.maroon,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
                onMouseOver={(e) => !loading && (e.target.style.background = colors.maroonDark)}
                onMouseOut={(e) => e.target.style.background = colors.maroon}
              >
                {loading ? (
                  <>
                    <div style={{
                      width: 20,
                      height: 20,
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: '#fff',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                    }} />
                    Signing in...
                  </>
                ) : 'Sign in'}
              </button>
            </form>
            
            {/* Demo credentials */}
            <div style={{
              marginTop: 24,
              paddingTop: 24,
              borderTop: '1px solid #e5e7eb',
            }}>
              <div style={{
                background: '#fffbeb',
                borderRadius: 8,
                padding: 16,
                border: '1px solid #fde68a',
              }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#92400e', margin: 0 }}>Demo Credentials</p>
                <p style={{ fontSize: 14, color: '#a16207', marginTop: 8, marginBottom: 0 }}>
                  Username: <code style={{ background: '#fef3c7', padding: '2px 6px', borderRadius: 4 }}>admin</code><br/>
                  Password: <code style={{ background: '#fef3c7', padding: '2px 6px', borderRadius: 4 }}>bulsuadmin123</code>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @media (min-width: 1024px) {
          .login-branding {
            display: flex !important;
          }
        }
      `}</style>
    </div>
  );
};

export default Login;
