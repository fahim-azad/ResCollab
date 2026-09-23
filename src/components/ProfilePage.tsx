import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Home, Search, User, Folder, Bookmark, MessageSquare, Settings, LogOut, 
  Bell, Edit2, User as UserIcon, BookOpen, Settings as SettingsIcon,
  MapPin, Mail, Building, GraduationCap, Globe, Link as LinkIcon,
  Save, X, FileText, Award
} from 'lucide-react';
import logo from '../assets/ResCollab-logo.png';
import './ProfilePage.css';

interface ProfileData {
  name: string;
  role: string;
  bio: string;
  university: string;
  department: string;
  country: string;
  skills: string[];
  interests: string[];
  email: string;
}

const ProfilePage: React.FC = () => {
  const [user, setUser] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<ProfileData>>({});
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const fetchProfile = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      const res = await fetch('http://localhost:5000/api/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to fetch profile');

      const data = await res.json();
      setUser(data);
      setEditData({
        bio: data.bio,
        university: data.university,
        department: data.department,
        country: data.country,
        skills: data.skills.join(', '),
        interests: data.interests.join(', ')
      } as any);
    } catch (err: any) {
      console.error(err);
      localStorage.removeItem('token');
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [navigate]);

  const handleSave = async () => {
    setSaving(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('http://localhost:5000/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editData)
      });
      if (!res.ok) throw new Error('Failed to update profile');
      await fetchProfile(); // Reload data
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      alert('Error updating profile');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'var(--bg-color)' }}>
        <h2 style={{ color: 'var(--brand-navy)' }}>Loading Profile...</h2>
      </div>
    );
  }

  if (!user) return null;

  return (
    <>
        
        {/* Topbar */}
        <header className="topbar">
          <div className="search-bar">
            <Search size={18} color="var(--text-secondary)" />
            <input type="text" placeholder="Search for papers, researchers, datasets..." />
          </div>
          <div className="topbar-right">
            <button className="icon-button"><Bell size={20} /></button>
            <div className="mini-profile">
              <div className="mini-profile-initials">
                {user.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '?'}
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{user.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{user.role}</div>
              </div>
            </div>
          </div>
        </header>

        {/* Profile Content */}
        <div className="profile-content">
          
          {/* Header Card */}
          <div className="profile-header-card">
            <div className="header-avatar">
              {user.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '?'}
            </div>
            
            <div className="header-info">
              <div className="header-title-row">
                <h1 className="header-name">{user.name}</h1>
                <button className="edit-pill" onClick={() => setIsEditing(true)}>
                  <Edit2 size={14} /> Edit Profile
                </button>
              </div>
              
              <div className="header-role">{user.role} | {user.department || 'Add Department'}</div>
              
              <div className="header-meta-grid">
                <div className="header-meta-item"><Building size={16} /> {user.university || 'Add University'}</div>
                <div className="header-meta-item"><MapPin size={16} /> {user.country || 'Add Location'}</div>
                <div className="header-meta-item"><Mail size={16} /> {user.email}</div>
                <div className="header-meta-item"><LinkIcon size={16} /> <a href="#">https://orcid.org/0000-0000-0000</a></div>
              </div>
              
              <div className="header-bio">{user.bio || 'Add a bio to tell researchers about yourself.'}</div>
            </div>

            <div className="header-stats">
              <div className="stat-item">
                <div className="stat-number">12</div>
                <div className="stat-label">Publications</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">5</div>
                <div className="stat-label">Projects</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">28</div>
                <div className="stat-label">Connections</div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="profile-tabs">
            <button className="tab-button active"><UserIcon size={16} /> Overview</button>
            <button className="tab-button"><FileText size={16} /> Research</button>
            <button className="tab-button"><Folder size={16} /> Projects</button>
            <button className="tab-button"><BookOpen size={16} /> Publications</button>
            <button className="tab-button"><Award size={16} /> Skills</button>
            <button className="tab-button"><SettingsIcon size={16} /> Settings</button>
          </div>

          {/* Grid Content */}
          <div className="profile-grid">
            
            {/* Personal Information */}
            <div className="grid-card">
              <div className="card-header">
                <div className="card-title"><User size={20} /> Personal Information</div>
                <button className="edit-pill" onClick={() => setIsEditing(true)}><Edit2 size={14} /> Edit</button>
              </div>
              <div className="info-grid">
                <div className="info-field">
                  <span className="info-label">Full Name</span>
                  <span className="info-value">{user.name}</span>
                </div>
                <div className="info-field">
                  <span className="info-label">Current Position</span>
                  <span className="info-value">{user.role}</span>
                </div>
                <div className="info-field">
                  <span className="info-label">Email</span>
                  <span className="info-value">{user.email}</span>
                </div>
                <div className="info-field">
                  <span className="info-label">Department</span>
                  <span className="info-value">{user.department || 'Not specified'}</span>
                </div>
                <div className="info-field">
                  <span className="info-label">Phone</span>
                  <span className="info-value">+94 71 234 5678 (Demo)</span>
                </div>
                <div className="info-field">
                  <span className="info-label">Institution</span>
                  <span className="info-value">{user.university || 'Not specified'}</span>
                </div>
                <div className="info-field">
                  <span className="info-label">Location</span>
                  <span className="info-value">{user.country || 'Not specified'}</span>
                </div>
                <div className="info-field">
                  <span className="info-label">Website / LinkedIn</span>
                  <span className="info-value"><a href="#">https://linkedin.com/in/{user.name ? user.name.split(' ')[0].toLowerCase() : ''}</a></span>
                </div>
              </div>
            </div>

            {/* Research Interests */}
            <div className="grid-card">
              <div className="card-header">
                <div className="card-title"><BookOpen size={20} /> Research Interests</div>
                <button className="edit-pill" onClick={() => setIsEditing(true)}><Edit2 size={14} /> Edit</button>
              </div>
              <div className="tags-container">
                {user.interests && user.interests.length > 0 ? user.interests.map((interest, idx) => (
                  <span key={idx} className="tag-pill">{interest}</span>
                )) : <span className="info-label">No research interests added yet.</span>}
              </div>
            </div>

            {/* Research Summary */}
            <div className="grid-card">
              <div className="card-header">
                <div className="card-title"><FileText size={20} /> Research Summary</div>
                <button className="edit-pill" onClick={() => setIsEditing(true)}><Edit2 size={14} /> Edit</button>
              </div>
              <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {user.bio || 'Add a research summary to showcase your work.'}
              </p>
            </div>

            {/* Skills */}
            <div className="grid-card">
              <div className="card-header">
                <div className="card-title"><SettingsIcon size={20} /> Skills</div>
                <button className="edit-pill" onClick={() => setIsEditing(true)}><Edit2 size={14} /> Edit</button>
              </div>
              <div className="tags-container">
                {user.skills && user.skills.length > 0 ? user.skills.map((skill, idx) => (
                  <span key={idx} className="tag-pill">{skill}</span>
                )) : <span className="info-label">No skills added yet.</span>}
              </div>
            </div>

            {/* Education Timeline */}
            <div className="grid-card">
              <div className="card-header">
                <div className="card-title"><GraduationCap size={20} /> Education</div>
                <button className="edit-pill"><Edit2 size={14} /> Edit</button>
              </div>
              <div className="timeline">
                <div className="timeline-item">
                  <div className="timeline-title">Ph.D. in Computer Science (Ongoing)</div>
                  <div className="timeline-meta">University of Colombo | 2023 - Present</div>
                </div>
                <div className="timeline-item">
                  <div className="timeline-title">M.Sc. in Computer Science</div>
                  <div className="timeline-meta">University of Colombo | 2021 - 2023</div>
                </div>
                <div className="timeline-item">
                  <div className="timeline-title">B.Sc. in Software Engineering</div>
                  <div className="timeline-meta">University of Peradeniya | 2017 - 2021</div>
                </div>
              </div>
            </div>

            {/* Links & Identifiers */}
            <div className="grid-card">
              <div className="card-header">
                <div className="card-title"><LinkIcon size={20} /> Links & Identifiers</div>
                <button className="edit-pill"><Edit2 size={14} /> Edit</button>
              </div>
              <div className="link-list">
                <div className="link-item">
                  <div className="link-icon orcid">ID</div>
                  <div className="link-name">ORCID</div>
                  <a href="#" className="link-url">https://orcid.org/0000-0000-0000</a>
                </div>
                <div className="link-item">
                  <div className="link-icon scholar">G</div>
                  <div className="link-name">Google Scholar</div>
                  <a href="#" className="link-url">https://scholar.google.com/</a>
                </div>
                <div className="link-item">
                  <div className="link-icon researchgate">R</div>
                  <div className="link-name">ResearchGate</div>
                  <a href="#" className="link-url">https://researchgate.net/</a>
                </div>
              </div>
            </div>
            
            {/* Social Profiles */}
            <div className="grid-card">
              <div className="card-header">
                <div className="card-title"><Globe size={20} /> Social Profiles</div>
                <button className="edit-pill"><Edit2 size={14} /> Edit</button>
              </div>
              <div className="link-list">
                <div className="link-item">
                  <div className="link-icon linkedin">in</div>
                  <div className="link-name">LinkedIn</div>
                  <a href="#" className="link-url">https://linkedin.com/</a>
                </div>
                <div className="link-item">
                  <div className="link-icon github">git</div>
                  <div className="link-name">GitHub</div>
                  <a href="#" className="link-url">https://github.com/</a>
                </div>
                <div className="link-item">
                  <div className="link-icon website"><Globe size={18} /></div>
                  <div className="link-name">Personal Site</div>
                  <a href="#" className="link-url">https://mywebsite.com/</a>
                </div>
              </div>
            </div>

          </div>
        </div>

      {/* Edit Form Overlay */}
      {isEditing && (
        <div className="edit-form-overlay">
          <div className="edit-form-card animate-slide-up">
            <div className="card-header">
              <h2 className="card-title">Edit Profile Information</h2>
              <button onClick={() => setIsEditing(false)} className="icon-button" style={{ width: '35px', height: '35px' }}><X size={18} /></button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="info-label" style={{ display: 'block', marginBottom: '0.25rem' }}>Bio / Research Summary</label>
                <textarea 
                  className="neo-input" 
                  value={editData.bio} 
                  onChange={e => setEditData({...editData, bio: e.target.value})}
                  style={{ minHeight: '80px', resize: 'vertical' }}
                />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="info-label" style={{ display: 'block', marginBottom: '0.25rem' }}>University / Institution</label>
                  <input type="text" className="neo-input" value={editData.university} onChange={e => setEditData({...editData, university: e.target.value})} />
                </div>
                <div>
                  <label className="info-label" style={{ display: 'block', marginBottom: '0.25rem' }}>Department</label>
                  <input type="text" className="neo-input" value={editData.department} onChange={e => setEditData({...editData, department: e.target.value})} />
                </div>
              </div>
              
              <div>
                <label className="info-label" style={{ display: 'block', marginBottom: '0.25rem' }}>Location (Country)</label>
                <input type="text" className="neo-input" value={editData.country} onChange={e => setEditData({...editData, country: e.target.value})} />
              </div>
              
              <div>
                <label className="info-label" style={{ display: 'block', marginBottom: '0.25rem' }}>Research Interests (Comma separated)</label>
                <input type="text" className="neo-input" value={editData.interests as any} onChange={e => setEditData({...editData, interests: e.target.value as any})} placeholder="e.g. Machine Learning, NLP" />
              </div>

              <div>
                <label className="info-label" style={{ display: 'block', marginBottom: '0.25rem' }}>Skills (Comma separated)</label>
                <input type="text" className="neo-input" value={editData.skills as any} onChange={e => setEditData({...editData, skills: e.target.value as any})} placeholder="e.g. Python, PyTorch, SQL" />
              </div>

              <button onClick={handleSave} disabled={saving} className="neo-button brand-button" style={{ marginTop: '1rem', width: '100%', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                <Save size={18} />
                {saving ? 'Saving...' : 'Save Profile Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProfilePage;
