import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import logo from '../assets/ResCollab-logo.png';
import './RegisterPage.css';

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    role: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Frontend validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    
    setLoading(true);

    try {
      const payload = {
        fullName: formData.fullName,
        email: formData.email,
        role: formData.role,
        password: formData.password
      };

      const res = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || 'Registration failed');
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
      
      {/* Decorative background elements */}
      <div className="shape shape-1"></div>
      <div className="shape shape-2"></div>
      
      {/* Left side info panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '4rem 6rem', position: 'relative', zIndex: 10 }}>
        <h1 style={{ fontSize: '3.5rem', lineHeight: '1.2', marginBottom: '1.5rem' }} className="text-gradient animate-slide-up">
          Why Join ResCollab?
        </h1>
        <p style={{ fontSize: '1.25rem', marginBottom: '2.5rem', maxWidth: '600px', lineHeight: '1.6' }} className="animate-slide-up delay-100">
          Unlock the future of academic research. Join a global network of students, researchers, and faculty driving innovation forward.
        </p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} className="animate-slide-up delay-200">
          <div className="neo-feature">
            <h3 style={{ color: 'var(--brand-navy)', fontSize: '1.5rem', marginBottom: '0.5rem' }}>Unified Profile</h3>
            <p style={{ fontSize: '0.95rem' }}>Showcase your publications, projects, and skills in one beautiful portfolio.</p>
          </div>
          <div className="neo-feature">
            <h3 style={{ color: 'var(--brand-cyan)', fontSize: '1.5rem', marginBottom: '0.5rem' }}>Find Resources</h3>
            <p style={{ fontSize: '0.95rem' }}>Search across millions of datasets, source codes, and papers effortlessly.</p>
          </div>
          <div className="neo-feature">
            <h3 style={{ color: 'var(--brand-purple)', fontSize: '1.5rem', marginBottom: '0.5rem' }}>Team Workspaces</h3>
            <p style={{ fontSize: '0.95rem' }}>Collaborate securely in private project boards designed for academic workflows.</p>
          </div>
        </div>
      </div>

      {/* Right side form */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', zIndex: 10, padding: '2rem' }}>
        <div className="neo-container animate-fade-in" style={{ width: '100%', maxWidth: '480px' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '2rem' }} className="animate-slide-up delay-100">
            <img
              src={logo}
              alt="ResCollab Logo"
              style={{ width: '200px', marginBottom: '1rem', filter: 'drop-shadow(4px 4px 10px rgba(202, 215, 230, 0.5))' }}
            />
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Create Profile</h2>
            <p>Join the ResCollab network</p>
          </div>

          {error && (
            <div className="animate-slide-up" style={{ color: '#d32f2f', backgroundColor: '#fdecea', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', textAlign: 'center', fontSize: '0.9rem', fontWeight: 500 }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            <div className="animate-slide-up delay-200">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Full Name</label>
              <input
                type="text"
                className="neo-input"
                placeholder="Dr. Jane Doe"
                required
                value={formData.fullName}
                onChange={(e) => setFormData({...formData, fullName: e.target.value})}
              />
            </div>

            <div className="animate-slide-up delay-200">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Email Address</label>
              <input
                type="email"
                className="neo-input"
                placeholder="jane.doe@university.edu"
                required
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
              />
            </div>

            <div className="animate-slide-up delay-300">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Your Role</label>
              <select 
                className="neo-input" 
                required
                value={formData.role}
                onChange={(e) => setFormData({...formData, role: e.target.value})}
              >
                <option value="" disabled>Select your role...</option>
                <option value="student">Research Student</option>
                <option value="researcher">Researcher</option>
                <option value="faculty">Faculty / Supervisor</option>
              </select>
            </div>

            <div className="animate-slide-up delay-300">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Password</label>
              <input
                type="password"
                className="neo-input"
                placeholder="••••••••"
                required
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
              />
            </div>
            
            <div className="animate-slide-up delay-300">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Confirm Password</label>
              <input
                type="password"
                className="neo-input"
                placeholder="••••••••"
                required
                value={formData.confirmPassword}
                onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
              />
            </div>

            <div className="animate-slide-up delay-400" style={{ marginTop: '0.5rem' }}>
              <button type="submit" className="neo-button brand-button" disabled={loading}>
                {loading ? 'Creating Account...' : 'Sign Up'}
              </button>
            </div>
            
          </form>

          <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.9rem' }} className="animate-slide-up delay-400">
            <p>
              Already have an account?{' '}
              <Link to="/login" style={{ color: 'var(--brand-navy)', fontWeight: 600, textDecoration: 'none' }}>
                Sign In
              </Link>
            </p>
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
