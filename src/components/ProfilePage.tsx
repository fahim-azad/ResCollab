import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Search, Folder, User,
  Bell, Edit2, User as UserIcon, BookOpen, Settings as SettingsIcon,
  MapPin, Mail, Building, GraduationCap, Globe, Link as LinkIcon,
  Save, X, FileText, Award, UserPlus, UserCheck, Clock, Handshake, CheckCircle, Shield, ExternalLink
} from 'lucide-react';
import './ProfilePage.css';

interface ProfileData {
  id?: number;
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
  const { userId } = useParams<{ userId?: string }>();
  const navigate = useNavigate();

  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [collabProfile, setCollabProfile] = useState<any>(null);
  const [userPublications, setUserPublications] = useState<any[]>([]);
  const [activeProfileTab, setActiveProfileTab] = useState<'overview' | 'publications'>('overview');

  const fetchProfile = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      if (userId) {
        const myRes = await fetch('http://localhost:5000/api/profile', { headers: { 'Authorization': `Bearer ${token}` } });
        if (myRes.ok) {
          const myData = await myRes.json();
          if (myData.id.toString() === userId) {
            navigate('/profile', { replace: true });
            return;
          }
        }
      }

      const endpoint = userId ? `http://localhost:5000/api/profile/${userId}` : 'http://localhost:5000/api/profile';
      const res = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to fetch profile');

      const data = await res.json();
      setUser(data);
      
      if (!userId) {
        setEditData({
          bio: data.bio,
          university: data.university,
          department: data.department,
          country: data.country,
          skills: data.skills.join(', '),
          interests: data.interests.join(', ')
        } as any);
      } else {
        fetchNetworkStatus(data.id, token);
      }

      // Fetch collaboration profile
      try {
        const collabEndpoint = userId 
          ? `http://localhost:5000/api/collaborator/profile/${userId}` 
          : 'http://localhost:5000/api/collaborator/profile/me';
        const collabRes = await fetch(collabEndpoint, { headers: { 'Authorization': `Bearer ${token}` } });
        if (collabRes.ok) {
          const cData = await collabRes.json();
          setCollabProfile(cData);
        } else {
          setCollabProfile(null);
        }
      } catch {
        // Optional profile data
      }

      // Fetch publications
      try {
        const pubUrl = userId 
          ? `http://localhost:5000/api/publication?ownerId=${data.id}` 
          : 'http://localhost:5000/api/publication/my';
        const pubRes = await fetch(pubUrl, { headers: { 'Authorization': `Bearer ${token}` } });
        if (pubRes.ok) {
          const pubData = await pubRes.json();
          setUserPublications(pubData);
        }
      } catch {
        // Optional publication data
      }
    } catch (err: any) {
      console.error(err);
      if (!userId) {
        localStorage.removeItem('token');
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchNetworkStatus = async (targetId: number, token: string) => {
    try {
      const [connRes, followRes] = await Promise.all([
        fetch('http://localhost:5000/api/network/connections', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('http://localhost:5000/api/network/following', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      
      if (connRes.ok) {
        const conns = await connRes.json();
        const specificConn = conns.find((c: any) => c.requesterId === targetId || c.targetId === targetId);
        if (specificConn) {
          setConnectionStatus(specificConn.status);
        } else {
          setConnectionStatus(null);
        }
      }
      
      if (followRes.ok) {
        const follows = await followRes.json();
        const isF = follows.some((f: any) => f.followedId === targetId);
        setIsFollowing(isF);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleFollow = async () => {
    if (!user || !user.id) return;
    const token = localStorage.getItem('token');
    const method = isFollowing ? 'DELETE' : 'POST';
    await fetch(`http://localhost:5000/api/network/follow/${user.id}`, { method, headers: { 'Authorization': `Bearer ${token}` } });
    setIsFollowing(!isFollowing);
  };

  const handleConnect = async () => {
    if (!user || !user.id) return;
    const token = localStorage.getItem('token');
    if (connectionStatus) {
      await fetch(`http://localhost:5000/api/network/connect/${user.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      setConnectionStatus(null);
    } else {
      await fetch(`http://localhost:5000/api/network/connect/${user.id}`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
      setConnectionStatus('Pending');
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
            <button className="icon-button" onClick={() => navigate('/notifications')} title="Notifications"><Bell size={20} /></button>
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
                {!userId ? (
                  <button className="edit-pill" onClick={() => setIsEditing(true)}>
                    <Edit2 size={14} /> Edit Profile
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className={`neo-button ${isFollowing ? '' : 'brand-button'}`} onClick={handleFollow} style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {isFollowing ? <UserCheck size={14} /> : <UserPlus size={14} />} {isFollowing ? 'Following' : 'Follow'}
                    </button>
                    <button className="neo-button" onClick={handleConnect} style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {connectionStatus === 'Accepted' ? <UserCheck size={14} /> : connectionStatus === 'Pending' ? <Clock size={14} /> : <UserPlus size={14} />} 
                      {connectionStatus === 'Accepted' ? 'Connected' : connectionStatus === 'Pending' ? 'Pending' : 'Connect'}
                    </button>
                  </div>
                )}
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
              <div 
                className="stat-item" 
                style={{ cursor: 'pointer' }} 
                onClick={() => setActiveProfileTab('publications')}
                title="View Publications"
              >
                <div className="stat-number">{userPublications.length}</div>
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
            <button 
              className={`tab-button ${activeProfileTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveProfileTab('overview')}
            >
              <UserIcon size={16} /> Overview
            </button>
            <button 
              className={`tab-button ${activeProfileTab === 'publications' ? 'active' : ''}`}
              onClick={() => setActiveProfileTab('publications')}
            >
              <BookOpen size={16} /> Publications ({userPublications.length})
            </button>
            <button className="tab-button"><FileText size={16} /> Research</button>
            <button className="tab-button"><Folder size={16} /> Projects</button>
            <button className="tab-button"><Award size={16} /> Skills</button>
            <button className="tab-button"><SettingsIcon size={16} /> Settings</button>
          </div>

          {/* Grid Content */}
          {activeProfileTab === 'overview' ? (
            <div className="profile-grid">
            
            {/* Personal Information */}
            <div className="grid-card">
              <div className="card-header">
                <div className="card-title"><User size={20} /> Personal Information</div>
                {!userId && <button className="edit-pill" onClick={() => setIsEditing(true)}><Edit2 size={14} /> Edit</button>}
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

            {/* Researcher Collaboration Status & Profile */}
            <div className="grid-card" id="collab-profile-card">
              <div className="card-header">
                <div className="card-title">
                  <Handshake size={20} /> Researcher Collaboration Profile
                </div>
                {!userId ? (
                  <button 
                    id="btn-manage-collab-profile"
                    className="edit-pill" 
                    onClick={() => navigate('/collaborators?tab=my-profile')}
                  >
                    <Edit2 size={14} /> Edit Collab Profile
                  </button>
                ) : (
                  collabProfile?.visibility && (
                    <span className="visibility-badge" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: '#f1f5f9', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Shield size={12} /> {collabProfile.visibility}
                    </span>
                  )
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <span style={{
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '0.3rem', 
                    fontSize: '0.78rem', 
                    padding: '0.25rem 0.65rem', 
                    borderRadius: '20px',
                    background: collabProfile?.isOpenToCollaboration !== false ? '#dcfce7' : '#f1f5f9',
                    color: collabProfile?.isOpenToCollaboration !== false ? '#15803d' : '#64748b',
                    fontWeight: 600
                  }}>
                    {collabProfile?.isOpenToCollaboration !== false ? (
                      <>
                        <CheckCircle size={13} /> Open to Collaboration
                      </>
                    ) : (
                      'Not Currently Seeking'
                    )}
                  </span>
                  {collabProfile?.country && (
                    <span style={{ fontSize: '0.85rem', color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                      <MapPin size={13} /> {collabProfile.country}
                    </span>
                  )}
                </div>

                {collabProfile?.expertiseAreas && (
                  <div>
                    <span className="info-label" style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.8rem' }}>Expertise Areas:</span>
                    <div className="tags-container">
                      {collabProfile.expertiseAreas.split(',').map((tag: string, idx: number) => (
                        <span key={idx} className="tag-pill">{tag.trim()}</span>
                      ))}
                    </div>
                  </div>
                )}

                {collabProfile?.researchInterests && (
                  <div>
                    <span className="info-label" style={{ display: 'block', marginBottom: '0.2rem', fontSize: '0.8rem' }}>Research Topics:</span>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                      {collabProfile.researchInterests}
                    </p>
                  </div>
                )}

                {!collabProfile && !userId && (
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: 0 }}>
                    You haven't set up your collaborator discovery profile yet. Configure it to be discovered by researchers worldwide.
                  </p>
                )}
              </div>
            </div>

            {/* Research Interests */}
            <div className="grid-card">
              <div className="card-header">
                <div className="card-title"><BookOpen size={20} /> Research Interests</div>
                {!userId && <button className="edit-pill" onClick={() => setIsEditing(true)}><Edit2 size={14} /> Edit</button>}
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
                {!userId && <button className="edit-pill" onClick={() => setIsEditing(true)}><Edit2 size={14} /> Edit</button>}
              </div>
              <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {user.bio || 'Add a research summary to showcase your work.'}
              </p>
            </div>

            {/* Skills */}
            <div className="grid-card">
              <div className="card-header">
                <div className="card-title"><SettingsIcon size={20} /> Skills</div>
                {!userId && <button className="edit-pill" onClick={() => setIsEditing(true)}><Edit2 size={14} /> Edit</button>}
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
                {!userId && <button className="edit-pill"><Edit2 size={14} /> Edit</button>}
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
                {!userId && <button className="edit-pill"><Edit2 size={14} /> Edit</button>}
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
                {!userId && <button className="edit-pill"><Edit2 size={14} /> Edit</button>}
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
          ) : (
            <div className="profile-publications-view" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.75rem', marginTop: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.25rem 0' }}>Research Publications</h2>
                  <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>Peer-reviewed papers, conference proceedings, and academic contributions.</p>
                </div>
                {!userId && (
                  <button 
                    onClick={() => navigate('/publications')}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer' }}
                  >
                    <BookOpen size={15} /> Manage Publications
                  </button>
                )}
              </div>

              {userPublications.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
                  <BookOpen size={40} style={{ margin: '0 auto 0.75rem auto', display: 'block', opacity: 0.6 }} />
                  <p style={{ fontSize: '1rem', fontWeight: 600, color: '#475569', margin: '0 0 0.25rem 0' }}>No publications found</p>
                  <p style={{ fontSize: '0.88rem', margin: 0 }}>This researcher has not cataloged any publications yet.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {userPublications.map((pub: any) => (
                    <div key={pub.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.55rem', borderRadius: '6px', background: '#eff6ff', color: '#2563eb', border: '1px solid #dbeafe' }}>
                          {pub.publicationType}
                        </span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.55rem', borderRadius: '6px', background: '#f1f5f9', color: '#475569' }}>
                          {pub.publicationYear}
                        </span>
                      </div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.35rem 0' }}>{pub.title}</h3>
                      <p style={{ fontSize: '0.88rem', color: '#475569', margin: '0 0 0.35rem 0' }}>{pub.authors}</p>
                      {pub.journalOrConference && (
                        <p style={{ fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic', margin: '0 0 0.5rem 0' }}>{pub.journalOrConference}</p>
                      )}
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        {pub.doi && (
                          <a 
                            href={pub.doi.startsWith('http') ? pub.doi : `https://doi.org/${pub.doi}`} 
                            target="_blank" 
                            rel="noreferrer" 
                            style={{ fontSize: '0.8rem', color: '#2563eb', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                          >
                            DOI: {pub.doi} <ExternalLink size={12} />
                          </a>
                        )}
                        {pub.sourceLink && (
                          <a 
                            href={pub.sourceLink} 
                            target="_blank" 
                            rel="noreferrer" 
                            style={{ fontSize: '0.8rem', color: '#059669', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                          >
                            Paper Source <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
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
