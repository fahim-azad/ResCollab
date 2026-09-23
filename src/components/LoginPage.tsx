import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import logo from '../assets/ResCollab-logo.png';
import './LoginPage.css';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || 'Login failed');
      }

      // Save token and redirect to profile
      localStorage.setItem('token', data.token);
      navigate('/profile');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', width: '100vw', minHeight: '100vh', overflow: 'hidden' }}>
      <div className="shape shape-1"></div>
      <div className="shape shape-2"></div>
      
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '4rem 6rem', position: 'relative', zIndex: 10 }}>
        <h1 style={{ fontSize: '3.5rem', lineHeight: '1.2', marginBottom: '1.5rem' }} className="text-gradient animate-slide-up">
          Unified Research Discovery & Collaboration
        </h1>
        <p style={{ fontSize: '1.25rem', marginBottom: '2.5rem', maxWidth: '600px', lineHeight: '1.6' }} className="animate-slide-up delay-100">
          ResCollab brings the entire research process into one ecosystem. Find research, connect with people, form teams, and manage your workspace—all from a single platform.
        </p>
        
        <div style={{ display: 'flex', gap: '2rem' }} className="animate-slide-up delay-200">
          <div className="neo-feature">
            <h3 style={{ color: 'var(--brand-navy)', fontSize: '1.8rem' }}>Discover</h3>
            <p style={{ fontSize: '0.95rem' }}>Papers & Datasets</p>
          </div>
          <div className="neo-feature">
            <h3 style={{ color: 'var(--brand-cyan)', fontSize: '1.8rem' }}>Connect</h3>
            <p style={{ fontSize: '0.95rem' }}>Global Researchers</p>
          </div>
          <div className="neo-feature">
            <h3 style={{ color: 'var(--brand-purple)', fontSize: '1.8rem' }}>Manage</h3>
            <p style={{ fontSize: '0.95rem' }}>Private Workspaces</p>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', zIndex: 10, padding: '2rem' }}>
        <div className="neo-container animate-fade-in" style={{ width: '100%', maxWidth: '480px' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }} className="animate-slide-up delay-100">
            <img
              src={logo}
              alt="ResCollab Logo"
              style={{ width: '220px', marginBottom: '1rem', filter: 'drop-shadow(4px 4px 10px rgba(202, 215, 230, 0.5))' }}
            />
            <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Welcome</h2>
            <p>Login to continue your research journey</p>
          </div>

          {error && (
            <div className="animate-slide-up" style={{ color: '#d32f2f', backgroundColor: '#fdecea', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', textAlign: 'center', fontSize: '0.9rem', fontWeight: 500 }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            <div className="animate-slide-up delay-200">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Email Address
              </label>
              <input
                type="email"
                className="neo-input"
                placeholder="researcher@university.edu"
                required
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
              />
            </div>

            <div className="animate-slide-up delay-300">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ fontWeight: 500, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  Password
                </label>
                <a href="#" style={{ fontSize: '0.85rem', color: 'var(--brand-cyan)', textDecoration: 'none', fontWeight: 500 }}>
                  Forgot Password?
                </a>
              </div>
              <input
                type="password"
                className="neo-input"
                placeholder="••••••••"
                required
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
              />
            </div>

            <div className="animate-slide-up delay-400" style={{ marginTop: '1rem' }}>
              <button type="submit" className="neo-button brand-button" disabled={loading}>
                {loading ? 'Signing In...' : 'Sign In'}
              </button>
            </div>
            
          </form>

          <div style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.9rem' }} className="animate-slide-up delay-400">
            <p>
              Don't have an account?{' '}
              <Link to="/register" style={{ color: 'var(--brand-navy)', fontWeight: 600, textDecoration: 'none' }}>
                Create Profile
              </Link>
            </p>
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
