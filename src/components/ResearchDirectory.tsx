import React, { useEffect, useState, useMemo } from 'react';
import { 
  Users, FlaskConical, PlusCircle, Search, Building, MapPin, ExternalLink, 
  Eye, Edit3, Trash2, X, Check, AlertCircle, RefreshCw, BookOpen, 
  CheckCircle2, Globe, Mail, Tag, Calendar, UserPlus 
} from 'lucide-react';
import './ResearchDirectory.css';

const API = 'http://localhost:5000/api';

export interface DirectoryResearcher {
  userId: number;
  userName: string;
  institution: string | null;
  department: string | null;
  country: string | null;
  researchInterests: string | null;
  expertiseAreas: string | null;
  isOpenToCollaboration: boolean;
}

export interface ResearcherDetail {
  userId: number;
  userName: string;
  email: string;
  profile?: {
    bio: string | null;
    department: string | null;
    university: string | null;
    skills: string | null;
    interests: string | null;
  };
  collaboratorProfile?: {
    institution: string | null;
    country: string | null;
    researchInterests: string | null;
    expertiseAreas: string | null;
    isOpenToCollaboration: boolean;
  };
  laboratories: {
    laboratoryId: number;
    laboratoryName: string;
    role: string;
  }[];
}

export interface DirectoryLaboratory {
  id: number;
  name: string;
  description: string | null;
  researchFocus: string | null;
  institution: string | null;
  department: string | null;
  location: string | null;
  website: string | null;
  status: string;
  headName: string | null;
  memberCount: number;
}

export interface LaboratoryDetail {
  id: number;
  name: string;
  description: string | null;
  researchFocus: string | null;
  institution: string | null;
  department: string | null;
  location: string | null;
  website: string | null;
  visibility: string;
  status: string;
  createdAt: string;
  headName: string | null;
  members: {
    userId: number;
    userName: string | null;
    role: string;
    joinedAt: string;
  }[];
}

export const ResearchDirectory: React.FC = () => {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'researchers' | 'laboratories' | 'create-lab'>('researchers');

  // Researchers state
  const [researchers, setResearchers] = useState<DirectoryResearcher[]>([]);
  const [loadingResearchers, setLoadingResearchers] = useState<boolean>(true);
  const [researcherSearch, setResearcherSearch] = useState<string>('');
  const [researcherInstFilter, setResearcherInstFilter] = useState<string>('All');
  const [onlyOpenToCollab, setOnlyOpenToCollab] = useState<boolean>(false);
  const [selectedResearcher, setSelectedResearcher] = useState<ResearcherDetail | null>(null);

  // Laboratories state
  const [laboratories, setLaboratories] = useState<DirectoryLaboratory[]>([]);
  const [loadingLabs, setLoadingLabs] = useState<boolean>(true);
  const [labSearch, setLabSearch] = useState<string>('');
  const [labInstFilter, setLabInstFilter] = useState<string>('All');
  const [selectedLab, setSelectedLab] = useState<LaboratoryDetail | null>(null);

  // Modals state
  const [isEditLabModalOpen, setIsEditLabModalOpen] = useState<boolean>(false);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState<boolean>(false);
  const [labToDelete, setLabToDelete] = useState<DirectoryLaboratory | null>(null);

  // Laboratory Forms state
  const [labForm, setLabForm] = useState({
    name: '',
    description: '',
    researchFocus: '',
    institution: '',
    department: '',
    website: '',
    location: '',
    visibility: 'Public'
  });
  const [submittingLab, setSubmittingLab] = useState<boolean>(false);

  // Add Member form state
  const [newMemberUserId, setNewMemberUserId] = useState<string>('');
  const [newMemberRole, setNewMemberRole] = useState<string>('Researcher');
  const [submittingMember, setSubmittingMember] = useState<boolean>(false);

  // Alert State
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showAlert = (type: 'success' | 'error', message: string) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 4000);
  };

  // Helper: Fetch Researchers
  const fetchResearchers = async () => {
    setLoadingResearchers(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (researcherSearch) params.append('search', researcherSearch);
      if (researcherInstFilter !== 'All') params.append('institution', researcherInstFilter);

      const url = `${API}/directory/researchers${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setResearchers(data);
      } else {
        showAlert('error', 'Failed to load researcher directory.');
      }
    } catch {
      showAlert('error', 'Network error connecting to researcher directory service.');
    } finally {
      setLoadingResearchers(false);
    }
  };

  // Helper: Fetch Laboratories
  const fetchLaboratories = async () => {
    setLoadingLabs(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (labSearch) params.append('search', labSearch);
      if (labInstFilter !== 'All') params.append('institution', labInstFilter);

      const url = `${API}/directory/laboratories${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLaboratories(data);
      } else {
        showAlert('error', 'Failed to load laboratory directory.');
      }
    } catch {
      showAlert('error', 'Network error connecting to laboratory service.');
    } finally {
      setLoadingLabs(false);
    }
  };

  // Helper: Fetch Detailed Researcher Profile
  const fetchResearcherDetail = async (userId: number) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/directory/researchers/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedResearcher(data);
      } else {
        showAlert('error', 'Could not load researcher profile details.');
      }
    } catch {
      showAlert('error', 'Error fetching researcher details.');
    }
  };

  // Helper: Fetch Detailed Laboratory Profile with Team Members
  const fetchLabDetail = async (labId: number) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/directory/laboratories/${labId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedLab(data);
      } else {
        showAlert('error', 'Could not load laboratory details.');
      }
    } catch {
      showAlert('error', 'Error fetching laboratory details.');
    }
  };

  useEffect(() => {
    fetchResearchers();
    fetchLaboratories();
  }, []);

  // Distinct institutions list for filters
  const availableInstitutions = useMemo(() => {
    const fromResearchers = researchers.map(r => r.institution).filter(Boolean);
    const fromLabs = laboratories.map(l => l.institution).filter(Boolean);
    const combined = Array.from(new Set([...fromResearchers, ...fromLabs])) as string[];
    return combined.sort();
  }, [researchers, laboratories]);

  // Filtered Researchers
  const filteredResearchers = useMemo(() => {
    return researchers.filter(r => {
      const matchesSearch = researcherSearch.trim() === '' ||
        r.userName.toLowerCase().includes(researcherSearch.toLowerCase()) ||
        (r.department && r.department.toLowerCase().includes(researcherSearch.toLowerCase())) ||
        (r.researchInterests && r.researchInterests.toLowerCase().includes(researcherSearch.toLowerCase())) ||
        (r.expertiseAreas && r.expertiseAreas.toLowerCase().includes(researcherSearch.toLowerCase()));

      const matchesInst = researcherInstFilter === 'All' ||
        (r.institution && r.institution.toLowerCase() === researcherInstFilter.toLowerCase());

      const matchesCollab = !onlyOpenToCollab || r.isOpenToCollaboration;

      return matchesSearch && matchesInst && matchesCollab;
    });
  }, [researchers, researcherSearch, researcherInstFilter, onlyOpenToCollab]);

  // Filtered Laboratories
  const filteredLaboratories = useMemo(() => {
    return laboratories.filter(l => {
      const matchesSearch = labSearch.trim() === '' ||
        l.name.toLowerCase().includes(labSearch.toLowerCase()) ||
        (l.description && l.description.toLowerCase().includes(labSearch.toLowerCase())) ||
        (l.researchFocus && l.researchFocus.toLowerCase().includes(labSearch.toLowerCase())) ||
        (l.headName && l.headName.toLowerCase().includes(labSearch.toLowerCase()));

      const matchesInst = labInstFilter === 'All' ||
        (l.institution && l.institution.toLowerCase() === labInstFilter.toLowerCase());

      return matchesSearch && matchesInst;
    });
  }, [laboratories, labSearch, labInstFilter]);

  // Handle Create Laboratory
  const handleCreateLab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!labForm.name.trim()) {
      showAlert('error', 'Laboratory name is required.');
      return;
    }

    setSubmittingLab(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/directory/laboratories`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(labForm)
      });

      if (res.ok) {
        showAlert('success', `Laboratory "${labForm.name}" registered successfully!`);
        setLabForm({
          name: '',
          description: '',
          researchFocus: '',
          institution: '',
          department: '',
          website: '',
          location: '',
          visibility: 'Public'
        });
        await fetchLaboratories();
        setActiveTab('laboratories');
      } else {
        const err = await res.text();
        showAlert('error', err || 'Failed to register laboratory.');
      }
    } catch {
      showAlert('error', 'Network error registering laboratory.');
    } finally {
      setSubmittingLab(false);
    }
  };

  // Open Edit Laboratory Modal
  const openEditLab = (lab: DirectoryLaboratory | LaboratoryDetail) => {
    setLabForm({
      name: lab.name,
      description: lab.description || '',
      researchFocus: lab.researchFocus || '',
      institution: lab.institution || '',
      department: lab.department || '',
      website: lab.website || '',
      location: lab.location || '',
      visibility: 'visibility' in lab ? lab.visibility : 'Public'
    });
    setIsEditLabModalOpen(true);
  };

  // Handle Update Laboratory
  const handleUpdateLab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLab) return;
    if (!labForm.name.trim()) {
      showAlert('error', 'Laboratory name is required.');
      return;
    }

    setSubmittingLab(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/directory/laboratories/${selectedLab.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(labForm)
      });

      if (res.ok) {
        showAlert('success', 'Laboratory profile updated!');
        setIsEditLabModalOpen(false);
        await fetchLaboratories();
        await fetchLabDetail(selectedLab.id);
      } else {
        const err = await res.text();
        showAlert('error', err || 'Failed to update laboratory.');
      }
    } catch {
      showAlert('error', 'Network error updating laboratory.');
    } finally {
      setSubmittingLab(false);
    }
  };

  // Handle Delete / Deactivate Laboratory
  const executeDeleteLab = async () => {
    if (!labToDelete) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API}/directory/laboratories/${labToDelete.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        showAlert('success', 'Laboratory deactivated.');
        setLabToDelete(null);
        if (selectedLab && selectedLab.id === labToDelete.id) {
          setSelectedLab(null);
        }
        await fetchLaboratories();
      } else {
        showAlert('error', 'Failed to deactivate laboratory.');
      }
    } catch {
      showAlert('error', 'Network error deactivating laboratory.');
    }
  };

  // Handle Add Member to Laboratory
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLab) return;
    const uid = parseInt(newMemberUserId);
    if (!uid) {
      showAlert('error', 'Please enter a valid Researcher User ID.');
      return;
    }

    setSubmittingMember(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/directory/laboratories/${selectedLab.id}/members`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: uid,
          role: newMemberRole
        })
      });

      if (res.ok) {
        showAlert('success', 'Researcher added to laboratory team!');
        setNewMemberUserId('');
        setIsAddMemberModalOpen(false);
        await fetchLabDetail(selectedLab.id);
        await fetchLaboratories();
      } else {
        const err = await res.text();
        showAlert('error', err || 'Failed to add member to laboratory.');
      }
    } catch {
      showAlert('error', 'Network error adding member.');
    } finally {
      setSubmittingMember(false);
    }
  };

  // Handle Remove Member from Laboratory
  const handleRemoveMember = async (userId: number) => {
    if (!selectedLab) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API}/directory/laboratories/${selectedLab.id}/members/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        showAlert('success', 'Member removed from laboratory.');
        await fetchLabDetail(selectedLab.id);
        await fetchLaboratories();
      } else {
        showAlert('error', 'Failed to remove member.');
      }
    } catch {
      showAlert('error', 'Network error removing member.');
    }
  };

  return (
    <div className="dir-container">
      {/* Header */}
      <div className="dir-header">
        <div className="dir-header-text">
          <h1>Researcher & Laboratory Directory</h1>
          <p>
            Discover academic researchers, prospective project partners, and specialized scientific laboratories
            across participating universities and research institutions.
          </p>
        </div>

        <div className="dir-header-stats">
          <div className="dir-stat-pill">
            <Users size={18} color="var(--brand-cyan, #009acc)" />
            <span>Researchers: <span className="stat-number">{researchers.length}</span></span>
          </div>
          <div className="dir-stat-pill">
            <FlaskConical size={18} color="#16a34a" />
            <span>Laboratories: <span className="stat-number">{laboratories.length}</span></span>
          </div>
        </div>
      </div>

      {/* Global Alert Notification */}
      {alert && (
        <div className={`alert-banner ${alert.type}`}>
          {alert.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{alert.message}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="dir-tabs">
        <button
          id="tab-btn-researchers"
          className={`dir-tab-btn ${activeTab === 'researchers' ? 'active' : ''}`}
          onClick={() => setActiveTab('researchers')}
        >
          <Users size={18} />
          Researchers Directory
          <span className="dir-tab-badge">{filteredResearchers.length}</span>
        </button>

        <button
          id="tab-btn-laboratories"
          className={`dir-tab-btn ${activeTab === 'laboratories' ? 'active' : ''}`}
          onClick={() => setActiveTab('laboratories')}
        >
          <FlaskConical size={18} />
          Laboratories Directory
          <span className="dir-tab-badge">{filteredLaboratories.length}</span>
        </button>

        <button
          id="tab-btn-register-lab"
          className={`dir-tab-btn ${activeTab === 'create-lab' ? 'active' : ''}`}
          onClick={() => setActiveTab('create-lab')}
        >
          <PlusCircle size={18} />
          Register Laboratory
        </button>
      </div>

      {/* ─── TAB 1: RESEARCHERS DIRECTORY ─── */}
      {activeTab === 'researchers' && (
        <div>
          {/* Filters Bar */}
          <div className="dir-filter-bar">
            <div className="dir-search-box">
              <Search size={18} />
              <input
                id="input-researcher-search"
                type="text"
                placeholder="Search by researcher name, department, or research topics..."
                className="dir-search-input"
                value={researcherSearch}
                onChange={e => setResearcherSearch(e.target.value)}
              />
            </div>

            <select
              id="select-researcher-institution"
              className="dir-select-filter"
              value={researcherInstFilter}
              onChange={e => setResearcherInstFilter(e.target.value)}
            >
              <option value="All">All Institutions</option>
              {availableInstitutions.map(inst => (
                <option key={inst} value={inst}>{inst}</option>
              ))}
            </select>

            <label className="dir-filter-toggle" htmlFor="chk-researcher-collab">
              <input
                id="chk-researcher-collab"
                type="checkbox"
                checked={onlyOpenToCollab}
                onChange={e => setOnlyOpenToCollab(e.target.checked)}
              />
              <span>Open to Collaboration Only</span>
            </label>

            <button
              id="btn-refresh-researchers"
              className="dir-action-btn-secondary"
              onClick={() => fetchResearchers()}
            >
              <RefreshCw size={15} /> Refresh
            </button>
          </div>

          {/* Researchers Cards Grid */}
          {loadingResearchers ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
              <RefreshCw size={28} className="animate-spin" style={{ marginBottom: '0.8rem' }} />
              <p>Loading researchers from directory...</p>
            </div>
          ) : filteredResearchers.length === 0 ? (
            <div className="dir-empty-state">
              <Users size={48} />
              <h3>No researchers found</h3>
              <p>
                {researcherSearch || researcherInstFilter !== 'All' || onlyOpenToCollab
                  ? 'No researchers matched your search query or filters.'
                  : 'No researcher profiles have been published to the directory yet.'}
              </p>
            </div>
          ) : (
            <div className="dir-cards-grid">
              {filteredResearchers.map(r => {
                const initials = r.userName
                  .split(' ')
                  .map(w => w[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();

                const interestsArray = r.researchInterests
                  ? r.researchInterests.split(',').map(s => s.trim()).filter(Boolean)
                  : [];

                const expertiseArray = r.expertiseAreas
                  ? r.expertiseAreas.split(',').map(s => s.trim()).filter(Boolean)
                  : [];

                return (
                  <div key={r.userId} className="researcher-card" id={`researcher-card-${r.userId}`}>
                    <div>
                      <div className="researcher-header-row">
                        <div className="researcher-avatar">
                          {initials || 'R'}
                        </div>
                        <div className="researcher-meta-info">
                          <h3 className="researcher-name">{r.userName}</h3>
                          <div className="researcher-inst-dept">
                            <Building size={13} />
                            <span>{r.institution || 'Affiliation Pending'}</span>
                          </div>
                          {r.department && (
                            <div className="researcher-inst-dept" style={{ fontSize: '0.8rem' }}>
                              <span>{r.department}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Research Interests & Expertise Tags */}
                      <div className="researcher-tags-wrap">
                        {interestsArray.slice(0, 3).map((item, idx) => (
                          <span key={idx} className="researcher-tag interest">
                            {item}
                          </span>
                        ))}
                        {expertiseArray.slice(0, 2).map((item, idx) => (
                          <span key={idx} className="researcher-tag">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 0', borderTop: '1px solid #f1f5f9' }}>
                        {r.isOpenToCollaboration ? (
                          <span className="badge-open-collab">
                            <Check size={12} /> Open to Collab
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Standard Profile</span>
                        )}

                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          <MapPin size={12} style={{ display: 'inline', marginRight: '3px' }} />
                          {r.country || 'Global'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <button
                          id={`btn-view-researcher-${r.userId}`}
                          className="dir-action-btn-primary"
                          style={{ flex: 1, justifyContent: 'center', padding: '0.55rem' }}
                          onClick={() => fetchResearcherDetail(r.userId)}
                        >
                          <Eye size={15} /> View Profile & Labs
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: LABORATORIES DIRECTORY ─── */}
      {activeTab === 'laboratories' && (
        <div>
          {/* Filters Bar */}
          <div className="dir-filter-bar">
            <div className="dir-search-box">
              <Search size={18} />
              <input
                id="input-lab-search"
                type="text"
                placeholder="Search laboratories by name, research focus, or PI head..."
                className="dir-search-input"
                value={labSearch}
                onChange={e => setLabSearch(e.target.value)}
              />
            </div>

            <select
              id="select-lab-institution"
              className="dir-select-filter"
              value={labInstFilter}
              onChange={e => setLabInstFilter(e.target.value)}
            >
              <option value="All">All Institutions</option>
              {availableInstitutions.map(inst => (
                <option key={inst} value={inst}>{inst}</option>
              ))}
            </select>

            <button
              id="btn-refresh-labs"
              className="dir-action-btn-secondary"
              onClick={() => fetchLaboratories()}
            >
              <RefreshCw size={15} /> Refresh
            </button>

            <button
              id="btn-quick-register-lab"
              className="dir-action-btn-primary"
              onClick={() => setActiveTab('create-lab')}
            >
              <PlusCircle size={16} /> Register Lab
            </button>
          </div>

          {/* Laboratories Cards Grid */}
          {loadingLabs ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
              <RefreshCw size={28} className="animate-spin" style={{ marginBottom: '0.8rem' }} />
              <p>Loading laboratories from directory...</p>
            </div>
          ) : filteredLaboratories.length === 0 ? (
            <div className="dir-empty-state">
              <FlaskConical size={48} />
              <h3>No laboratories found</h3>
              <p>
                {labSearch || labInstFilter !== 'All'
                  ? 'No laboratories matched your search query or institution filter.'
                  : 'No research laboratories have been registered yet.'}
              </p>
              <button
                id="btn-empty-register-lab"
                className="dir-action-btn-primary"
                style={{ margin: '0 auto' }}
                onClick={() => setActiveTab('create-lab')}
              >
                <PlusCircle size={16} /> Register First Laboratory
              </button>
            </div>
          ) : (
            <div className="dir-cards-grid">
              {filteredLaboratories.map(lab => (
                <div key={lab.id} className="lab-card" id={`lab-card-${lab.id}`}>
                  <div>
                    <div className="lab-card-header">
                      <div className="lab-icon-box">
                        <FlaskConical size={24} />
                      </div>
                      <div className="lab-card-title-group">
                        <h3 className="lab-card-name">{lab.name}</h3>
                        <div className="lab-card-inst-tag">
                          <Building size={13} />
                          <span>{lab.institution || 'University Research Lab'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Principal Investigator (PI) */}
                    {lab.headName && (
                      <div className="lab-pi-badge">
                        <span>Lead PI:</span>
                        <strong>{lab.headName}</strong>
                      </div>
                    )}

                    {/* Research Focus */}
                    {lab.researchFocus && (
                      <div>
                        <span className="lab-focus-pill">
                          <Tag size={12} /> {lab.researchFocus}
                        </span>
                      </div>
                    )}

                    {/* Description */}
                    <p className="lab-desc-text">
                      {lab.description || 'Specialized research laboratory focused on scientific innovation, prototyping, and cross-departmental discovery.'}
                    </p>
                  </div>

                  <div>
                    <div className="lab-meta-footer">
                      <span className="lab-member-count">
                        <Users size={14} /> {lab.memberCount} {lab.memberCount === 1 ? 'Researcher' : 'Researchers'}
                      </span>

                      {lab.website && (
                        <a
                          href={lab.website.startsWith('http') ? lab.website : `https://${lab.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'var(--brand-cyan, #009acc)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'none' }}
                        >
                          <ExternalLink size={13} /> Official Lab Page
                        </a>
                      )}
                    </div>

                    <div className="lab-card-actions">
                      <button
                        id={`btn-view-lab-${lab.id}`}
                        className="dir-action-btn-primary"
                        style={{ flex: 1, justifyContent: 'center', padding: '0.55rem' }}
                        onClick={() => fetchLabDetail(lab.id)}
                      >
                        <Eye size={15} /> View Lab & Team
                      </button>

                      <button
                        id={`btn-delete-lab-${lab.id}`}
                        className="dir-action-btn-secondary"
                        style={{ padding: '0.55rem 0.8rem', color: '#ef4444' }}
                        title="Deactivate Laboratory"
                        onClick={() => setLabToDelete(lab)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 3: REGISTER LABORATORY ─── */}
      {activeTab === 'create-lab' && (
        <div className="dir-form-layout">
          <div className="dir-form-card">
            <h2>Register Research Laboratory</h2>
            <p className="form-subtitle">
              Add your research laboratory, center, or specialized facility to the directory.
            </p>

            <form onSubmit={handleCreateLab}>
              <div className="dir-form-field">
                <label htmlFor="input-lab-name">
                  <FlaskConical size={16} /> Laboratory / Facility Name *
                </label>
                <input
                  id="input-lab-name"
                  type="text"
                  required
                  placeholder="e.g. Distributed Intelligent Systems Laboratory (DISL)"
                  value={labForm.name}
                  onChange={e => setLabForm({ ...labForm, name: e.target.value })}
                />
              </div>

              <div className="dir-form-grid-2">
                <div className="dir-form-field">
                  <label htmlFor="input-lab-inst">
                    <Building size={16} /> Host Institution / University
                  </label>
                  <input
                    id="input-lab-inst"
                    type="text"
                    placeholder="e.g. Stanford University"
                    value={labForm.institution}
                    onChange={e => setLabForm({ ...labForm, institution: e.target.value })}
                  />
                </div>

                <div className="dir-form-field">
                  <label htmlFor="input-lab-dept">
                    <BookOpen size={16} /> Department / School
                  </label>
                  <input
                    id="input-lab-dept"
                    type="text"
                    placeholder="e.g. Department of Computer Science"
                    value={labForm.department}
                    onChange={e => setLabForm({ ...labForm, department: e.target.value })}
                  />
                </div>
              </div>

              <div className="dir-form-field">
                <label htmlFor="input-lab-focus">
                  <Tag size={16} /> Primary Research Focus & Specialization
                </label>
                <input
                  id="input-lab-focus"
                  type="text"
                  placeholder="e.g. Edge AI, Autonomous Drones, Swarm Robotics"
                  value={labForm.researchFocus}
                  onChange={e => setLabForm({ ...labForm, researchFocus: e.target.value })}
                />
              </div>

              <div className="dir-form-grid-2">
                <div className="dir-form-field">
                  <label htmlFor="input-lab-location">
                    <MapPin size={16} /> Campus Building / Room
                  </label>
                  <input
                    id="input-lab-location"
                    type="text"
                    placeholder="e.g. Gates Building, Room 412"
                    value={labForm.location}
                    onChange={e => setLabForm({ ...labForm, location: e.target.value })}
                  />
                </div>

                <div className="dir-form-field">
                  <label htmlFor="input-lab-website">
                    <ExternalLink size={16} /> Official Lab Website
                  </label>
                  <input
                    id="input-lab-website"
                    type="text"
                    placeholder="e.g. https://disl.stanford.edu"
                    value={labForm.website}
                    onChange={e => setLabForm({ ...labForm, website: e.target.value })}
                  />
                </div>
              </div>

              <div className="dir-form-field">
                <label htmlFor="select-lab-vis">
                  <Globe size={16} /> Directory Visibility
                </label>
                <select
                  id="select-lab-vis"
                  value={labForm.visibility}
                  onChange={e => setLabForm({ ...labForm, visibility: e.target.value })}
                >
                  <option value="Public">Public (Platform-wide Directory)</option>
                  <option value="Institution">Institution Only</option>
                  <option value="Private">Private</option>
                </select>
              </div>

              <div className="dir-form-field">
                <label htmlFor="input-lab-desc">
                  Laboratory Overview & Equipment Description
                </label>
                <textarea
                  id="input-lab-desc"
                  rows={4}
                  placeholder="Describe your research equipment, ongoing projects, grants, and collaboration interests..."
                  value={labForm.description}
                  onChange={e => setLabForm({ ...labForm, description: e.target.value })}
                />
              </div>

              <button
                id="btn-submit-lab"
                type="submit"
                className="dir-action-btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '0.85rem' }}
                disabled={submittingLab}
              >
                <Check size={18} />
                {submittingLab ? 'Registering Facility...' : 'Register Laboratory Profile'}
              </button>
            </form>
          </div>

          {/* Live Preview Panel */}
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.8rem' }}>
              Live Directory Card Preview
            </div>

            <div className="lab-card">
              <div>
                <div className="lab-card-header">
                  <div className="lab-icon-box">
                    <FlaskConical size={24} />
                  </div>
                  <div className="lab-card-title-group">
                    <h3 className="lab-card-name">
                      {labForm.name || 'Center for Advanced Research & Discovery'}
                    </h3>
                    <div className="lab-card-inst-tag">
                      <Building size={13} />
                      <span>{labForm.institution || 'University Research Lab'}</span>
                    </div>
                  </div>
                </div>

                <div className="lab-pi-badge">
                  <span>Lead PI:</span>
                  <strong>Your Account (Principal Investigator)</strong>
                </div>

                {labForm.researchFocus && (
                  <span className="lab-focus-pill">
                    <Tag size={12} /> {labForm.researchFocus}
                  </span>
                )}

                <p className="lab-desc-text">
                  {labForm.description || 'Facility description, equipment capabilities, and research goals will appear here.'}
                </p>
              </div>

              <div>
                <div className="lab-meta-footer">
                  <span className="lab-member-count">
                    <Users size={14} /> 1 Researcher (Creator)
                  </span>

                  {labForm.website && (
                    <span style={{ fontSize: '0.82rem', color: 'var(--brand-cyan, #009acc)' }}>
                      <ExternalLink size={12} style={{ display: 'inline', marginRight: '3px' }} />
                      Configured
                    </span>
                  )}
                </div>

                <button className="dir-action-btn-primary" style={{ width: '100%', justifyContent: 'center', opacity: 0.7 }} disabled>
                  <Eye size={15} /> View Lab & Team (Preview)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 1: RESEARCHER DETAIL & AFFILIATED LABS ─── */}
      {selectedResearcher && (
        <div className="dir-modal-overlay" onClick={() => setSelectedResearcher(null)}>
          <div className="dir-modal-content" onClick={e => e.stopPropagation()}>
            <div className="dir-modal-header">
              <h2>
                <Users size={20} color="var(--brand-cyan, #009acc)" />
                Researcher Directory Profile
              </h2>
              <button
                id="btn-close-researcher-modal"
                className="dir-modal-close"
                onClick={() => setSelectedResearcher(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="dir-modal-body">
              {/* Profile Card Top */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <div className="researcher-avatar" style={{ width: '64px', height: '64px', fontSize: '1.5rem' }}>
                  {selectedResearcher.userName
                    .split(' ')
                    .map(w => w[0])
                    .filter(Boolean)
                    .slice(0, 2)
                    .join('')
                    .toUpperCase() || 'R'}
                </div>

                <div>
                  <h2 style={{ fontSize: '1.5rem', color: 'var(--brand-navy, #0e3065)', marginBottom: '0.25rem' }}>
                    {selectedResearcher.userName}
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: '#64748b', fontSize: '0.9rem', flexWrap: 'wrap' }}>
                    <span>
                      <Building size={14} style={{ display: 'inline', marginRight: '4px' }} />
                      {selectedResearcher.collaboratorProfile?.institution || selectedResearcher.profile?.university || 'University Researcher'}
                    </span>
                    {selectedResearcher.profile?.department && (
                      <span>
                        <BookOpen size={14} style={{ display: 'inline', marginRight: '4px' }} />
                        {selectedResearcher.profile.department}
                      </span>
                    )}
                    <span>
                      <Mail size={14} style={{ display: 'inline', marginRight: '4px' }} />
                      {selectedResearcher.email}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bio */}
              <div style={{ background: '#f8fafc', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
                <h4 style={{ fontSize: '0.85rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                  Researcher Biography
                </h4>
                <p style={{ color: '#334155', lineHeight: 1.6, fontSize: '0.95rem' }}>
                  {selectedResearcher.profile?.bio || 'Dedicated researcher engaging in cutting-edge academic studies and interdisciplinary collaboration.'}
                </p>
              </div>

              {/* Skills & Research Focus */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--brand-navy, #0e3065)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Tag size={15} /> Skills & Research Topics
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {selectedResearcher.collaboratorProfile?.researchInterests?.split(',').map((item, idx) => (
                    <span key={idx} className="researcher-tag interest" style={{ fontSize: '0.82rem', padding: '0.3rem 0.75rem' }}>
                      {item.trim()}
                    </span>
                  ))}
                  {selectedResearcher.collaboratorProfile?.expertiseAreas?.split(',').map((item, idx) => (
                    <span key={idx} className="researcher-tag" style={{ fontSize: '0.82rem', padding: '0.3rem 0.75rem' }}>
                      {item.trim()}
                    </span>
                  ))}
                </div>
              </div>

              {/* Affiliated Laboratories */}
              <div>
                <h4 style={{ fontSize: '0.95rem', color: 'var(--brand-navy, #0e3065)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <FlaskConical size={16} /> Affiliated Laboratories ({selectedResearcher.laboratories.length})
                </h4>

                {selectedResearcher.laboratories.length === 0 ? (
                  <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1', color: '#64748b', fontSize: '0.88rem' }}>
                    This researcher has not affiliated with a public laboratory in the directory yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {selectedResearcher.laboratories.map(lab => (
                      <div key={lab.laboratoryId} className="lab-member-item">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <FlaskConical size={16} color="#15803d" />
                          <strong style={{ color: 'var(--brand-navy, #0e3065)' }}>{lab.laboratoryName}</strong>
                        </div>
                        <span className="lab-role-badge pi">{lab.role}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="dir-modal-footer">
              <a
                href={`/profile/${selectedResearcher.userId}`}
                className="dir-action-btn-secondary"
                style={{ textDecoration: 'none' }}
              >
                <Eye size={15} /> Academic Profile
              </a>
              <button
                id="btn-close-researcher-detail"
                className="dir-action-btn-primary"
                onClick={() => setSelectedResearcher(null)}
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: LABORATORY DETAIL & TEAM MEMBERS ─── */}
      {selectedLab && (
        <div className="dir-modal-overlay" onClick={() => setSelectedLab(null)}>
          <div className="dir-modal-content" onClick={e => e.stopPropagation()}>
            <div className="dir-modal-header">
              <h2>
                <FlaskConical size={20} color="#16a34a" />
                {selectedLab.name}
              </h2>
              <button
                id="btn-close-lab-modal"
                className="dir-modal-close"
                onClick={() => setSelectedLab(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="dir-modal-body">
              {/* Lab Overview Header */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '0.85rem', flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#64748b', fontSize: '0.9rem' }}>
                    <Building size={15} /> {selectedLab.institution || 'University Research Facility'}
                  </span>
                  {selectedLab.department && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#64748b', fontSize: '0.9rem' }}>
                      <BookOpen size={15} /> {selectedLab.department}
                    </span>
                  )}
                  {selectedLab.location && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#64748b', fontSize: '0.9rem' }}>
                      <MapPin size={15} /> {selectedLab.location}
                    </span>
                  )}
                  <span className="badge-open-collab">
                    <Check size={12} /> {selectedLab.status}
                  </span>
                </div>

                {selectedLab.headName && (
                  <div className="lab-pi-badge" style={{ marginBottom: '0.85rem' }}>
                    <span>Principal Investigator:</span>
                    <strong>{selectedLab.headName}</strong>
                  </div>
                )}

                {selectedLab.researchFocus && (
                  <div style={{ marginBottom: '0.85rem' }}>
                    <span className="lab-focus-pill" style={{ fontSize: '0.85rem', padding: '0.3rem 0.75rem' }}>
                      <Tag size={13} /> {selectedLab.researchFocus}
                    </span>
                  </div>
                )}

                <p style={{ color: '#475569', lineHeight: 1.6, fontSize: '0.95rem' }}>
                  {selectedLab.description || 'Specialized research laboratory with equipment and personnel focused on forward-looking scientific exploration.'}
                </p>

                {selectedLab.website && (
                  <div style={{ marginTop: '0.85rem' }}>
                    <a
                      href={selectedLab.website.startsWith('http') ? selectedLab.website : `https://${selectedLab.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--brand-cyan, #009acc)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', textDecoration: 'none', fontWeight: 600 }}
                    >
                      <ExternalLink size={15} /> Official Facility Page: {selectedLab.website}
                    </a>
                  </div>
                )}
              </div>

              {/* Team Members Section */}
              <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '2px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.8rem' }}>
                  <h3 style={{ fontSize: '1.15rem', color: 'var(--brand-navy, #0e3065)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Users size={18} /> Laboratory Personnel & Team ({selectedLab.members.length})
                  </h3>

                  <button
                    id="btn-open-add-member"
                    className="dir-action-btn-primary"
                    style={{ fontSize: '0.85rem', padding: '0.45rem 0.9rem' }}
                    onClick={() => setIsAddMemberModalOpen(true)}
                  >
                    <UserPlus size={15} /> Add Team Member
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {selectedLab.members.map(m => {
                    const roleClass = m.role.toLowerCase().includes('principal') ? 'pi' :
                      m.role.toLowerCase().includes('postdoc') ? 'postdoc' :
                      m.role.toLowerCase().includes('student') ? 'student' : 'researcher';

                    return (
                      <div key={m.userId} className="lab-member-item">
                        <div>
                          <strong style={{ color: 'var(--brand-navy, #0e3065)', fontSize: '0.95rem' }}>
                            {m.userName || `Researcher #${m.userId}`}
                          </strong>
                          <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                            <Calendar size={12} /> Joined: {new Date(m.joinedAt).toLocaleDateString()}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <span className={`lab-role-badge ${roleClass}`}>{m.role}</span>
                          <button
                            id={`btn-remove-member-${m.userId}`}
                            className="dir-action-btn-secondary"
                            style={{ padding: '0.3rem 0.6rem', color: '#ef4444' }}
                            title="Remove from laboratory"
                            onClick={() => handleRemoveMember(m.userId)}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="dir-modal-footer">
              <button
                id="btn-edit-lab"
                className="dir-action-btn-secondary"
                onClick={() => openEditLab(selectedLab)}
              >
                <Edit3 size={15} /> Edit Laboratory Profile
              </button>
              <button
                id="btn-close-lab-detail"
                className="dir-action-btn-primary"
                onClick={() => setSelectedLab(null)}
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: ADD TEAM MEMBER TO LABORATORY ─── */}
      {isAddMemberModalOpen && selectedLab && (
        <div className="dir-modal-overlay" onClick={() => setIsAddMemberModalOpen(false)}>
          <div className="dir-modal-content small" onClick={e => e.stopPropagation()}>
            <div className="dir-modal-header">
              <h2>
                <UserPlus size={18} /> Add Member to {selectedLab.name}
              </h2>
              <button className="dir-modal-close" onClick={() => setIsAddMemberModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddMember}>
              <div className="dir-modal-body">
                <div className="dir-form-field">
                  <label htmlFor="select-member-user">
                    Select Researcher or Enter User ID *
                  </label>
                  <select
                    id="select-member-user"
                    value={newMemberUserId}
                    onChange={e => setNewMemberUserId(e.target.value)}
                    required
                  >
                    <option value="">-- Select a Platform Researcher --</option>
                    {researchers.map(r => (
                      <option key={r.userId} value={r.userId.toString()}>
                        {r.userName} (ID: {r.userId}) - {r.institution || 'Researcher'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="dir-form-field">
                  <label htmlFor="select-member-role">Laboratory Role *</label>
                  <select
                    id="select-member-role"
                    value={newMemberRole}
                    onChange={e => setNewMemberRole(e.target.value)}
                  >
                    <option value="Principal Investigator">Principal Investigator</option>
                    <option value="Researcher">Senior Researcher / Scientist</option>
                    <option value="PostDoc">Postdoctoral Fellow</option>
                    <option value="Student">Graduate / Research Student</option>
                    <option value="Collaborator">Visiting Collaborator</option>
                  </select>
                </div>
              </div>

              <div className="dir-modal-footer">
                <button
                  type="button"
                  className="dir-action-btn-secondary"
                  onClick={() => setIsAddMemberModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  id="btn-confirm-add-member"
                  type="submit"
                  className="dir-action-btn-primary"
                  disabled={submittingMember}
                >
                  <Check size={16} /> {submittingMember ? 'Adding...' : 'Add to Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 4: EDIT LABORATORY ─── */}
      {isEditLabModalOpen && selectedLab && (
        <div className="dir-modal-overlay" onClick={() => setIsEditLabModalOpen(false)}>
          <div className="dir-modal-content small" onClick={e => e.stopPropagation()}>
            <div className="dir-modal-header">
              <h2>
                <Edit3 size={18} /> Edit Laboratory Profile
              </h2>
              <button className="dir-modal-close" onClick={() => setIsEditLabModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdateLab}>
              <div className="dir-modal-body">
                <div className="dir-form-field">
                  <label htmlFor="input-edit-lab-name">Laboratory Name *</label>
                  <input
                    id="input-edit-lab-name"
                    type="text"
                    required
                    value={labForm.name}
                    onChange={e => setLabForm({ ...labForm, name: e.target.value })}
                  />
                </div>

                <div className="dir-form-grid-2">
                  <div className="dir-form-field">
                    <label htmlFor="input-edit-lab-inst">Institution</label>
                    <input
                      id="input-edit-lab-inst"
                      type="text"
                      value={labForm.institution}
                      onChange={e => setLabForm({ ...labForm, institution: e.target.value })}
                    />
                  </div>

                  <div className="dir-form-field">
                    <label htmlFor="input-edit-lab-dept">Department</label>
                    <input
                      id="input-edit-lab-dept"
                      type="text"
                      value={labForm.department}
                      onChange={e => setLabForm({ ...labForm, department: e.target.value })}
                    />
                  </div>
                </div>

                <div className="dir-form-field">
                  <label htmlFor="input-edit-lab-focus">Research Focus</label>
                  <input
                    id="input-edit-lab-focus"
                    type="text"
                    value={labForm.researchFocus}
                    onChange={e => setLabForm({ ...labForm, researchFocus: e.target.value })}
                  />
                </div>

                <div className="dir-form-grid-2">
                  <div className="dir-form-field">
                    <label htmlFor="input-edit-lab-loc">Campus Location</label>
                    <input
                      id="input-edit-lab-loc"
                      type="text"
                      value={labForm.location}
                      onChange={e => setLabForm({ ...labForm, location: e.target.value })}
                    />
                  </div>

                  <div className="dir-form-field">
                    <label htmlFor="input-edit-lab-site">Website URL</label>
                    <input
                      id="input-edit-lab-site"
                      type="text"
                      value={labForm.website}
                      onChange={e => setLabForm({ ...labForm, website: e.target.value })}
                    />
                  </div>
                </div>

                <div className="dir-form-field">
                  <label htmlFor="input-edit-lab-desc">Description</label>
                  <textarea
                    id="input-edit-lab-desc"
                    rows={3}
                    value={labForm.description}
                    onChange={e => setLabForm({ ...labForm, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="dir-modal-footer">
                <button
                  type="button"
                  className="dir-action-btn-secondary"
                  onClick={() => setIsEditLabModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  id="btn-save-edit-lab"
                  type="submit"
                  className="dir-action-btn-primary"
                  disabled={submittingLab}
                >
                  <Check size={16} /> {submittingLab ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 5: DELETE LABORATORY CONFIRMATION ─── */}
      {labToDelete && (
        <div className="dir-modal-overlay" onClick={() => setLabToDelete(null)}>
          <div className="dir-modal-content small" onClick={e => e.stopPropagation()}>
            <div className="dir-modal-header">
              <h2>
                <AlertCircle size={20} color="#ef4444" />
                Confirm Laboratory Deactivation
              </h2>
              <button className="dir-modal-close" onClick={() => setLabToDelete(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="dir-modal-body">
              <p style={{ color: '#334155', fontSize: '0.98rem', lineHeight: 1.5 }}>
                Are you sure you want to deactivate <strong>{labToDelete.name}</strong>?
              </p>
              <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.6rem' }}>
                This laboratory will be set to Inactive status and hidden from the public research directory.
              </p>
            </div>

            <div className="dir-modal-footer">
              <button
                id="btn-cancel-delete-lab"
                className="dir-action-btn-secondary"
                onClick={() => setLabToDelete(null)}
              >
                Cancel
              </button>
              <button
                id="btn-confirm-delete-lab"
                className="dir-action-btn-primary"
                style={{ background: '#ef4444' }}
                onClick={executeDeleteLab}
              >
                Deactivate Laboratory
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResearchDirectory;
