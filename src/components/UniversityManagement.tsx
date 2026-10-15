import React, { useEffect, useState, useMemo } from 'react';
import { 
  Building, GraduationCap, Search, PlusCircle, MapPin, ExternalLink, 
  Edit3, Trash2, X, Check, AlertCircle, Globe, RefreshCw, Eye, 
  BookOpen, Users, CheckCircle2 
} from 'lucide-react';
import './UniversityManagement.css';

const API = 'http://localhost:5000/api';

export interface DepartmentData {
  id: number;
  universityId: number;
  name: string;
  description: string | null;
  headOfDepartment: string | null;
  website: string | null;
  visibility: string; // 'Public' | 'Private'
  createdAt?: string;
  updatedAt?: string;
}

export interface UniversityData {
  id: number;
  name: string;
  country: string | null;
  city: string | null;
  website: string | null;
  description: string | null;
  logoUrl: string | null;
  status: string; // 'Active' | 'Inactive'
  createdAt?: string;
  departments?: DepartmentData[];
}

export const UniversityManagement: React.FC = () => {
  // Navigation & View Tab
  const [activeTab, setActiveTab] = useState<'directory' | 'create' | 'affiliation'>('directory');

  // Universities state
  const [universities, setUniversities] = useState<UniversityData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [countryFilter, setCountryFilter] = useState<string>('');

  // Modals state
  const [selectedUniversity, setSelectedUniversity] = useState<UniversityData | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isAddDeptModalOpen, setIsAddDeptModalOpen] = useState<boolean>(false);
  const [isEditDeptModalOpen, setIsEditDeptModalOpen] = useState<boolean>(false);
  const [selectedDept, setSelectedDept] = useState<DepartmentData | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'university' | 'department';
    id: number;
    name: string;
    universityId?: number;
  } | null>(null);

  // Forms state
  const [uniForm, setUniForm] = useState({
    name: '',
    country: '',
    city: '',
    website: '',
    description: '',
    logoUrl: ''
  });
  const [submittingUni, setSubmittingUni] = useState<boolean>(false);

  const [deptForm, setDeptForm] = useState({
    name: '',
    description: '',
    headOfDepartment: '',
    website: '',
    visibility: 'Public'
  });
  const [submittingDept, setSubmittingDept] = useState<boolean>(false);

  // User Affiliation state
  const [userAffiliation, setUserAffiliation] = useState({
    university: '',
    department: ''
  });
  const [affiliationUniChoice, setAffiliationUniChoice] = useState<string>('');
  const [affiliationDeptChoice, setAffiliationDeptChoice] = useState<string>('');
  const [customUniInput, setCustomUniInput] = useState<string>('');
  const [customDeptInput, setCustomDeptInput] = useState<string>('');
  const [isCustomAffiliation, setIsCustomAffiliation] = useState<boolean>(false);
  const [savingAffiliation, setSavingAffiliation] = useState<boolean>(false);

  // Alerts
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showAlert = (type: 'success' | 'error', message: string) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 4000);
  };

  // Helper: fetch all universities
  const fetchUniversities = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      let url = `${API}/university`;
      const params = new URLSearchParams();
      if (countryFilter) params.append('country', countryFilter);
      if (searchTerm) params.append('search', searchTerm);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setUniversities(data);
      } else {
        showAlert('error', 'Failed to fetch universities.');
      }
    } catch {
      showAlert('error', 'Network error connecting to university service.');
    } finally {
      setLoading(false);
    }
  };

  // Helper: fetch university details with departments
  const fetchUniversityDetails = async (id: number) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/university/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedUniversity(data);
      }
    } catch {
      showAlert('error', 'Failed to load university details.');
    }
  };

  // Helper: fetch user's current profile for affiliation
  const fetchUserProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUserAffiliation({
          university: data.university || '',
          department: data.department || ''
        });
        setAffiliationUniChoice(data.university || '');
        setAffiliationDeptChoice(data.department || '');
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchUniversities();
    fetchUserProfile();
  }, [countryFilter]);

  // Distinct countries list from loaded universities
  const availableCountries = useMemo(() => {
    const defaultCountries = ['United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'Japan', 'Bangladesh', 'Sri Lanka', 'India'];
    const loaded = universities.map(u => u.country).filter((c): c is string => Boolean(c));
    return Array.from(new Set([...defaultCountries, ...loaded])).sort();
  }, [universities]);

  // Departments for chosen affiliation university
  const chosenUniDepartments = useMemo(() => {
    const matched = universities.find(u => u.name.toLowerCase() === affiliationUniChoice.toLowerCase());
    return matched?.departments || [];
  }, [universities, affiliationUniChoice]);

  // Search filter
  const filteredUniversities = useMemo(() => {
    return universities.filter(u => {
      const matchesSearch = searchTerm.trim() === '' || 
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.city && u.city.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (u.country && u.country.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesSearch;
    });
  }, [universities, searchTerm]);

  // Handle Create University
  const handleCreateUniversity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uniForm.name.trim()) {
      showAlert('error', 'University name is required.');
      return;
    }

    setSubmittingUni(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/university`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(uniForm)
      });

      if (res.ok) {
        showAlert('success', 'University registered successfully!');
        setUniForm({ name: '', country: '', city: '', website: '', description: '', logoUrl: '' });
        await fetchUniversities();
        setActiveTab('directory');
      } else {
        const errText = await res.text();
        showAlert('error', errText || 'Failed to register university.');
      }
    } catch {
      showAlert('error', 'Network error registering university.');
    } finally {
      setSubmittingUni(false);
    }
  };

  // Open Edit University Modal
  const openEditUniversity = (uni: UniversityData) => {
    setSelectedUniversity(uni);
    setUniForm({
      name: uni.name,
      country: uni.country || '',
      city: uni.city || '',
      website: uni.website || '',
      description: uni.description || '',
      logoUrl: uni.logoUrl || ''
    });
    setIsEditModalOpen(true);
  };

  // Handle Update University
  const handleUpdateUniversity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUniversity) return;
    if (!uniForm.name.trim()) {
      showAlert('error', 'University name is required.');
      return;
    }

    setSubmittingUni(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/university/${selectedUniversity.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(uniForm)
      });

      if (res.ok) {
        showAlert('success', 'University details updated!');
        setIsEditModalOpen(false);
        await fetchUniversities();
        if (selectedUniversity) {
          await fetchUniversityDetails(selectedUniversity.id);
        }
      } else {
        const err = await res.text();
        showAlert('error', err || 'Failed to update university.');
      }
    } catch {
      showAlert('error', 'Network error updating university.');
    } finally {
      setSubmittingUni(false);
    }
  };

  // Handle Delete Confirmation
  const executeDelete = async () => {
    if (!deleteTarget) return;
    const token = localStorage.getItem('token');

    try {
      if (deleteTarget.type === 'university') {
        const res = await fetch(`${API}/university/${deleteTarget.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          showAlert('success', 'University deactivated.');
          setIsDetailModalOpen(false);
          await fetchUniversities();
        } else {
          showAlert('error', 'Failed to deactivate university.');
        }
      } else if (deleteTarget.type === 'department' && deleteTarget.universityId) {
        const res = await fetch(`${API}/university/${deleteTarget.universityId}/departments/${deleteTarget.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          showAlert('success', 'Department deleted.');
          await fetchUniversityDetails(deleteTarget.universityId);
          await fetchUniversities();
        } else {
          showAlert('error', 'Failed to delete department.');
        }
      }
    } catch {
      showAlert('error', 'Network error executing deletion.');
    } finally {
      setDeleteTarget(null);
    }
  };

  // Handle Add Department
  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUniversity) return;
    if (!deptForm.name.trim()) {
      showAlert('error', 'Department name is required.');
      return;
    }

    setSubmittingDept(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/university/${selectedUniversity.id}/departments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(deptForm)
      });

      if (res.ok) {
        showAlert('success', 'Department added successfully!');
        setDeptForm({ name: '', description: '', headOfDepartment: '', website: '', visibility: 'Public' });
        setIsAddDeptModalOpen(false);
        await fetchUniversityDetails(selectedUniversity.id);
        await fetchUniversities();
      } else {
        const err = await res.text();
        showAlert('error', err || 'Failed to add department.');
      }
    } catch {
      showAlert('error', 'Network error adding department.');
    } finally {
      setSubmittingDept(false);
    }
  };

  // Open Edit Department Modal
  const openEditDept = (dept: DepartmentData) => {
    setSelectedDept(dept);
    setDeptForm({
      name: dept.name,
      description: dept.description || '',
      headOfDepartment: dept.headOfDepartment || '',
      website: dept.website || '',
      visibility: dept.visibility || 'Public'
    });
    setIsEditDeptModalOpen(true);
  };

  // Handle Update Department
  const handleUpdateDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUniversity || !selectedDept) return;
    if (!deptForm.name.trim()) {
      showAlert('error', 'Department name is required.');
      return;
    }

    setSubmittingDept(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/university/${selectedUniversity.id}/departments/${selectedDept.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(deptForm)
      });

      if (res.ok) {
        showAlert('success', 'Department updated successfully!');
        setIsEditDeptModalOpen(false);
        await fetchUniversityDetails(selectedUniversity.id);
        await fetchUniversities();
      } else {
        const err = await res.text();
        showAlert('error', err || 'Failed to update department.');
      }
    } catch {
      showAlert('error', 'Network error updating department.');
    } finally {
      setSubmittingDept(false);
    }
  };

  // Handle Save User Affiliation
  const handleSaveAffiliation = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalUni = isCustomAffiliation ? customUniInput.trim() : affiliationUniChoice.trim();
    const finalDept = isCustomAffiliation ? customDeptInput.trim() : affiliationDeptChoice.trim();

    if (!finalUni) {
      showAlert('error', 'Please specify a university or institution.');
      return;
    }

    setSavingAffiliation(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/profile`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          university: finalUni,
          department: finalDept
        })
      });

      if (res.ok) {
        setUserAffiliation({
          university: finalUni,
          department: finalDept
        });
        showAlert('success', 'Institutional affiliation updated in your profile!');
      } else {
        showAlert('error', 'Failed to update affiliation.');
      }
    } catch {
      showAlert('error', 'Network error updating profile affiliation.');
    } finally {
      setSavingAffiliation(false);
    }
  };

  // Set as My University directly from card
  const handleSetQuickAffiliation = async (uni: UniversityData) => {
    setAffiliationUniChoice(uni.name);
    setIsCustomAffiliation(false);
    setActiveTab('affiliation');
    showAlert('success', `Selected "${uni.name}". Choose your department and confirm affiliation.`);
  };

  return (
    <div className="uni-container">
      {/* Header */}
      <div className="uni-header">
        <div className="uni-header-text">
          <h1>University & Institution Management</h1>
          <p>
            Explore accredited academic institutions, browse academic departments, and manage
            your institutional affiliation across the research network.
          </p>
        </div>
        <div className="uni-header-stats">
          <div className="uni-stat-pill">
            <Building size={18} color="var(--brand-cyan, #009acc)" />
            <span>Total Institutions: <span className="stat-number">{universities.length}</span></span>
          </div>
          {userAffiliation.university && (
            <div className="uni-stat-pill">
              <GraduationCap size={18} color="#16a34a" />
              <span>Affiliated: <strong>{userAffiliation.university}</strong></span>
            </div>
          )}
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
      <div className="uni-tabs">
        <button
          id="tab-btn-directory"
          className={`uni-tab-btn ${activeTab === 'directory' ? 'active' : ''}`}
          onClick={() => setActiveTab('directory')}
        >
          <Building size={18} />
          Directory & Institutions
          <span className="uni-tab-badge">{filteredUniversities.length}</span>
        </button>

        <button
          id="tab-btn-create"
          className={`uni-tab-btn ${activeTab === 'create' ? 'active' : ''}`}
          onClick={() => {
            setUniForm({ name: '', country: '', city: '', website: '', description: '', logoUrl: '' });
            setActiveTab('create');
          }}
        >
          <PlusCircle size={18} />
          Register Institution
        </button>

        <button
          id="tab-btn-affiliation"
          className={`uni-tab-btn ${activeTab === 'affiliation' ? 'active' : ''}`}
          onClick={() => setActiveTab('affiliation')}
        >
          <GraduationCap size={18} />
          My Affiliation
        </button>
      </div>

      {/* ─── TAB 1: DIRECTORY ─── */}
      {activeTab === 'directory' && (
        <div>
          {/* Filters Bar */}
          <div className="uni-filter-bar">
            <div className="uni-search-box">
              <Search size={18} />
              <input
                id="input-university-search"
                type="text"
                placeholder="Search by university name, city, or country..."
                className="uni-search-input"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            <select
              id="select-university-country"
              className="uni-select-filter"
              value={countryFilter}
              onChange={e => setCountryFilter(e.target.value)}
            >
              <option value="">All Countries</option>
              {availableCountries.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <button
              id="btn-refresh-universities"
              className="uni-action-btn-secondary"
              onClick={() => fetchUniversities()}
            >
              <RefreshCw size={15} /> Refresh
            </button>

            <button
              id="btn-quick-add-uni"
              className="uni-action-btn-primary"
              onClick={() => setActiveTab('create')}
            >
              <PlusCircle size={16} /> Register New
            </button>
          </div>

          {/* Cards Grid */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
              <RefreshCw size={28} className="animate-spin" style={{ marginBottom: '0.8rem' }} />
              <p>Loading universities from directory...</p>
            </div>
          ) : filteredUniversities.length === 0 ? (
            <div className="uni-empty-state">
              <Building size={48} />
              <h3>No universities found</h3>
              <p>
                {searchTerm || countryFilter
                  ? "We couldn't find any institutions matching your search criteria."
                  : "No universities have been registered on the platform yet."}
              </p>
              <button
                id="btn-empty-register-uni"
                className="uni-action-btn-primary"
                style={{ margin: '0 auto' }}
                onClick={() => setActiveTab('create')}
              >
                <PlusCircle size={16} /> Register First University
              </button>
            </div>
          ) : (
            <div className="uni-cards-grid">
              {filteredUniversities.map(uni => {
                const initials = uni.name
                  .split(' ')
                  .map(w => w[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();

                const isCurrentAffiliation =
                  userAffiliation.university.toLowerCase() === uni.name.toLowerCase();

                return (
                  <div key={uni.id} className="uni-card" id={`uni-card-${uni.id}`}>
                    <div>
                      <div className="uni-card-header">
                        <div className="uni-avatar-box">
                          {uni.logoUrl ? (
                            <img src={uni.logoUrl} alt={uni.name} onError={e => { (e.target as HTMLElement).style.display = 'none'; }} />
                          ) : (
                            <span>{initials || 'U'}</span>
                          )}
                        </div>
                        <div className="uni-card-title-group">
                          <h3 className="uni-card-name" title={uni.name}>
                            {uni.name}
                          </h3>
                          <div className="uni-card-location">
                            <MapPin size={13} color="#64748b" />
                            <span>
                              {uni.city ? `${uni.city}, ` : ''}{uni.country || 'International'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <p className="uni-card-description">
                        {uni.description || 'Dedicated academic and scientific research institution fostering cross-disciplinary collaboration.'}
                      </p>
                    </div>

                    <div>
                      <div className="uni-card-meta">
                        <span className="uni-badge-active">
                          <Check size={12} /> {uni.status || 'Active'}
                        </span>

                        {uni.website && (
                          <a
                            href={uni.website.startsWith('http') ? uni.website : `https://${uni.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="uni-card-location"
                            style={{ color: 'var(--brand-cyan, #009acc)', textDecoration: 'none' }}
                          >
                            <ExternalLink size={13} /> Official Website
                          </a>
                        )}
                      </div>

                      <div className="uni-card-actions">
                        <button
                          id={`btn-view-university-${uni.id}`}
                          className="uni-card-btn-view"
                          onClick={() => {
                            fetchUniversityDetails(uni.id);
                            setIsDetailModalOpen(true);
                          }}
                        >
                          <Eye size={15} /> View Departments
                        </button>

                        <button
                          id={`btn-affiliate-university-${uni.id}`}
                          className={`uni-card-icon-btn ${isCurrentAffiliation ? 'active' : ''}`}
                          title={isCurrentAffiliation ? 'Your Current Affiliation' : 'Set as My University'}
                          style={{
                            color: isCurrentAffiliation ? '#16a34a' : '#64748b',
                            background: isCurrentAffiliation ? '#dcfce7' : undefined
                          }}
                          onClick={() => handleSetQuickAffiliation(uni)}
                        >
                          <GraduationCap size={16} />
                        </button>

                        <button
                          id={`btn-edit-university-${uni.id}`}
                          className="uni-card-icon-btn"
                          title="Edit University Profile"
                          onClick={() => openEditUniversity(uni)}
                        >
                          <Edit3 size={15} />
                        </button>

                        <button
                          id={`btn-delete-university-${uni.id}`}
                          className="uni-card-icon-btn danger"
                          title="Deactivate University"
                          onClick={() => setDeleteTarget({
                            type: 'university',
                            id: uni.id,
                            name: uni.name
                          })}
                        >
                          <Trash2 size={15} />
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

      {/* ─── TAB 2: REGISTER UNIVERSITY ─── */}
      {activeTab === 'create' && (
        <div className="uni-form-layout">
          <div className="uni-form-card">
            <h2>Register Academic Institution</h2>
            <p className="form-subtitle">
              Add a new university, research institute, or laboratory to the ResCollab directory.
            </p>

            <form onSubmit={handleCreateUniversity}>
              <div className="form-field">
                <label htmlFor="input-create-uni-name">
                  <Building size={16} /> University / Institution Name *
                </label>
                <input
                  id="input-create-uni-name"
                  type="text"
                  required
                  placeholder="e.g. Massachusetts Institute of Technology"
                  value={uniForm.name}
                  onChange={e => setUniForm({ ...uniForm, name: e.target.value })}
                />
              </div>

              <div className="form-grid-2">
                <div className="form-field">
                  <label htmlFor="input-create-uni-country">
                    <Globe size={16} /> Country
                  </label>
                  <input
                    id="input-create-uni-country"
                    type="text"
                    placeholder="e.g. United States"
                    value={uniForm.country}
                    onChange={e => setUniForm({ ...uniForm, country: e.target.value })}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="input-create-uni-city">
                    <MapPin size={16} /> City
                  </label>
                  <input
                    id="input-create-uni-city"
                    type="text"
                    placeholder="e.g. Cambridge, MA"
                    value={uniForm.city}
                    onChange={e => setUniForm({ ...uniForm, city: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-field">
                  <label htmlFor="input-create-uni-website">
                    <ExternalLink size={16} /> Official Website URL
                  </label>
                  <input
                    id="input-create-uni-website"
                    type="text"
                    placeholder="e.g. https://web.mit.edu"
                    value={uniForm.website}
                    onChange={e => setUniForm({ ...uniForm, website: e.target.value })}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="input-create-uni-logo">
                    Logo / Crest URL (optional)
                  </label>
                  <input
                    id="input-create-uni-logo"
                    type="text"
                    placeholder="e.g. https://.../logo.png"
                    value={uniForm.logoUrl}
                    onChange={e => setUniForm({ ...uniForm, logoUrl: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="input-create-uni-description">
                  <BookOpen size={16} /> Institutional Overview & Description
                </label>
                <textarea
                  id="input-create-uni-description"
                  rows={4}
                  placeholder="Provide a concise description of the university's research strengths, focus areas, and laboratories..."
                  value={uniForm.description}
                  onChange={e => setUniForm({ ...uniForm, description: e.target.value })}
                />
              </div>

              <button
                id="btn-submit-university"
                type="submit"
                className="uni-action-btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '0.85rem' }}
                disabled={submittingUni}
              >
                <Check size={18} />
                {submittingUni ? 'Registering Institution...' : 'Complete University Registration'}
              </button>
            </form>
          </div>

          {/* Live Preview Panel */}
          <div className="uni-preview-panel">
            <div className="uni-preview-title">
              <Eye size={15} /> Live Card Preview
            </div>

            <div className="uni-card">
              <div>
                <div className="uni-card-header">
                  <div className="uni-avatar-box">
                    {uniForm.logoUrl ? (
                      <img src={uniForm.logoUrl} alt="Preview" onError={e => { (e.target as HTMLElement).style.display = 'none'; }} />
                    ) : (
                      <span>
                        {(uniForm.name || 'Uni')
                          .split(' ')
                          .map(w => w[0])
                          .filter(Boolean)
                          .slice(0, 2)
                          .join('')
                          .toUpperCase() || 'U'}
                      </span>
                    )}
                  </div>
                  <div className="uni-card-title-group">
                    <h3 className="uni-card-name">
                      {uniForm.name || 'University of Academic Excellence'}
                    </h3>
                    <div className="uni-card-location">
                      <MapPin size={13} color="#64748b" />
                      <span>
                        {uniForm.city ? `${uniForm.city}, ` : ''}{uniForm.country || 'Global'}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="uni-card-description">
                  {uniForm.description || 'Institutional research overview will appear here once entered.'}
                </p>
              </div>

              <div>
                <div className="uni-card-meta">
                  <span className="uni-badge-active">
                    <Check size={12} /> Active Institution
                  </span>
                  {uniForm.website && (
                    <span style={{ fontSize: '0.82rem', color: 'var(--brand-cyan, #009acc)' }}>
                      <ExternalLink size={12} style={{ display: 'inline', marginRight: '3px' }} />
                      Link Configured
                    </span>
                  )}
                </div>

                <div className="uni-card-actions">
                  <button className="uni-card-btn-view" disabled style={{ opacity: 0.7 }}>
                    <Eye size={15} /> View Departments (Preview)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 3: MY AFFILIATION ─── */}
      {activeTab === 'affiliation' && (
        <div className="affiliation-card">
          <div className="affiliation-current-status">
            <div className="aff-status-info">
              <h3>Current Institutional Affiliation</h3>
              <p>
                Institution: <strong>{userAffiliation.university || 'Not yet configured'}</strong>
                {userAffiliation.department ? ` • Department: ${userAffiliation.department}` : ''}
              </p>
            </div>
            <div className="aff-badge-tag">
              <CheckCircle2 size={16} /> Verified Profile Link
            </div>
          </div>

          <form onSubmit={handleSaveAffiliation}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
              <h2 style={{ fontSize: '1.35rem', color: 'var(--brand-navy, #0e3065)' }}>
                Update Your Institution Affiliation
              </h2>
              <button
                type="button"
                className="uni-action-btn-secondary"
                style={{ fontSize: '0.82rem', padding: '0.4rem 0.8rem' }}
                onClick={() => setIsCustomAffiliation(!isCustomAffiliation)}
              >
                {isCustomAffiliation ? 'Choose from Registered Institutions' : 'Custom Entry (Not in list)'}
              </button>
            </div>

            {!isCustomAffiliation ? (
              <>
                <div className="form-field">
                  <label htmlFor="select-my-university">
                    <Building size={16} /> Select Platform University *
                  </label>
                  <select
                    id="select-my-university"
                    value={affiliationUniChoice}
                    onChange={e => {
                      setAffiliationUniChoice(e.target.value);
                      setAffiliationDeptChoice('');
                    }}
                  >
                    <option value="">-- Select an Institution --</option>
                    {universities.map(u => (
                      <option key={u.id} value={u.name}>
                        {u.name} ({u.country || 'International'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="select-my-department">
                    <BookOpen size={16} /> Department / Faculty
                  </label>
                  {chosenUniDepartments.length > 0 ? (
                    <select
                      id="select-my-department"
                      value={affiliationDeptChoice}
                      onChange={e => setAffiliationDeptChoice(e.target.value)}
                    >
                      <option value="">-- Select Department --</option>
                      {chosenUniDepartments.map(d => (
                        <option key={d.id} value={d.name}>{d.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id="select-my-department"
                      type="text"
                      placeholder="e.g. Department of Computer Science"
                      value={affiliationDeptChoice}
                      onChange={e => setAffiliationDeptChoice(e.target.value)}
                    />
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="form-field">
                  <label htmlFor="input-custom-uni">
                    <Building size={16} /> University / Institution Name *
                  </label>
                  <input
                    id="input-custom-uni"
                    type="text"
                    required
                    placeholder="e.g. Oxford University"
                    value={customUniInput}
                    onChange={e => setCustomUniInput(e.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="input-custom-dept">
                    <BookOpen size={16} /> Department / Faculty
                  </label>
                  <input
                    id="input-custom-dept"
                    type="text"
                    placeholder="e.g. Department of Engineering Science"
                    value={customDeptInput}
                    onChange={e => setCustomDeptInput(e.target.value)}
                  />
                </div>
              </>
            )}

            <button
              id="btn-save-affiliation"
              type="submit"
              className="uni-action-btn-primary"
              style={{ marginTop: '1rem', width: '100%', justifyContent: 'center', padding: '0.85rem' }}
              disabled={savingAffiliation}
            >
              <Check size={18} />
              {savingAffiliation ? 'Saving Affiliation...' : 'Save Affiliation to My Researcher Profile'}
            </button>
          </form>
        </div>
      )}

      {/* ─── MODAL 1: UNIVERSITY DETAILS & DEPARTMENTS ─── */}
      {isDetailModalOpen && selectedUniversity && (
        <div className="uni-modal-overlay" onClick={() => setIsDetailModalOpen(false)}>
          <div className="uni-modal-content" onClick={e => e.stopPropagation()}>
            <div className="uni-modal-header">
              <h2>
                <Building size={20} color="var(--brand-cyan, #009acc)" />
                {selectedUniversity.name}
              </h2>
              <button
                id="btn-close-detail-modal"
                className="uni-modal-close"
                onClick={() => setIsDetailModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="uni-modal-body">
              {/* Institution Overview */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  <div className="uni-card-location">
                    <MapPin size={16} />
                    <span>
                      {selectedUniversity.city ? `${selectedUniversity.city}, ` : ''}
                      {selectedUniversity.country || 'International'}
                    </span>
                  </div>

                  {selectedUniversity.website && (
                    <a
                      href={selectedUniversity.website.startsWith('http') ? selectedUniversity.website : `https://${selectedUniversity.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--brand-cyan, #009acc)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', textDecoration: 'none' }}
                    >
                      <ExternalLink size={15} /> {selectedUniversity.website}
                    </a>
                  )}

                  <span className="uni-badge-active">
                    <Check size={12} /> {selectedUniversity.status || 'Active'}
                  </span>
                </div>

                <p style={{ color: '#475569', lineHeight: 1.6, fontSize: '0.95rem' }}>
                  {selectedUniversity.description || 'Dedicated academic institution focused on scientific inquiry and multi-institutional collaboration.'}
                </p>
              </div>

              {/* Department Management Section */}
              <div className="dept-section-header">
                <h3>
                  <BookOpen size={18} />
                  Academic Departments & Faculties ({selectedUniversity.departments?.length || 0})
                </h3>
                <button
                  id="btn-add-department"
                  className="uni-action-btn-primary"
                  style={{ fontSize: '0.85rem', padding: '0.45rem 0.9rem' }}
                  onClick={() => {
                    setDeptForm({ name: '', description: '', headOfDepartment: '', website: '', visibility: 'Public' });
                    setIsAddDeptModalOpen(true);
                  }}
                >
                  <PlusCircle size={15} /> Add Department
                </button>
              </div>

              {(!selectedUniversity.departments || selectedUniversity.departments.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem', background: '#f8fafc', borderRadius: '14px', border: '1px dashed #cbd5e1' }}>
                  <BookOpen size={36} color="#94a3b8" style={{ marginBottom: '0.5rem' }} />
                  <p style={{ fontWeight: 600, color: '#475569', marginBottom: '0.3rem' }}>No departments listed yet</p>
                  <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                    Add academic departments (e.g. Computer Science, Biomedical Engineering) to structure this institution.
                  </p>
                </div>
              ) : (
                <div className="dept-list">
                  {selectedUniversity.departments.map(dept => (
                    <div key={dept.id} className="dept-card" id={`dept-card-${dept.id}`}>
                      <div className="dept-card-top">
                        <div className="dept-card-name">{dept.name}</div>
                        <span className={`dept-visibility-badge ${dept.visibility?.toLowerCase() === 'private' ? 'private' : 'public'}`}>
                          {dept.visibility || 'Public'}
                        </span>
                      </div>

                      <div className="dept-meta-row">
                        {dept.headOfDepartment && (
                          <span>
                            <Users size={14} /> Head: {dept.headOfDepartment}
                          </span>
                        )}
                        {dept.website && (
                          <a
                            href={dept.website.startsWith('http') ? dept.website : `https://${dept.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'var(--brand-cyan, #009acc)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'none' }}
                          >
                            <ExternalLink size={13} /> Department Portal
                          </a>
                        )}
                      </div>

                      {dept.description && (
                        <p className="dept-desc">{dept.description}</p>
                      )}

                      <div className="dept-actions">
                        <button
                          id={`btn-edit-dept-${dept.id}`}
                          className="dept-btn-action"
                          onClick={() => openEditDept(dept)}
                        >
                          <Edit3 size={13} /> Edit
                        </button>
                        <button
                          id={`btn-delete-dept-${dept.id}`}
                          className="dept-btn-action danger"
                          onClick={() => setDeleteTarget({
                            type: 'department',
                            id: dept.id,
                            name: dept.name,
                            universityId: selectedUniversity.id
                          })}
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="uni-modal-footer">
              <button
                id="btn-modal-affiliate"
                className="uni-action-btn-secondary"
                onClick={() => {
                  setIsDetailModalOpen(false);
                  handleSetQuickAffiliation(selectedUniversity);
                }}
              >
                <GraduationCap size={16} /> Set as My Affiliation
              </button>
              <button
                id="btn-close-detail"
                className="uni-action-btn-primary"
                onClick={() => setIsDetailModalOpen(false)}
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: EDIT UNIVERSITY ─── */}
      {isEditModalOpen && selectedUniversity && (
        <div className="uni-modal-overlay" onClick={() => setIsEditModalOpen(false)}>
          <div className="uni-modal-content small" onClick={e => e.stopPropagation()}>
            <div className="uni-modal-header">
              <h2>
                <Edit3 size={18} /> Edit University Profile
              </h2>
              <button className="uni-modal-close" onClick={() => setIsEditModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdateUniversity}>
              <div className="uni-modal-body">
                <div className="form-field">
                  <label htmlFor="input-edit-uni-name">University Name *</label>
                  <input
                    id="input-edit-uni-name"
                    type="text"
                    required
                    value={uniForm.name}
                    onChange={e => setUniForm({ ...uniForm, name: e.target.value })}
                  />
                </div>

                <div className="form-grid-2">
                  <div className="form-field">
                    <label htmlFor="input-edit-uni-country">Country</label>
                    <input
                      id="input-edit-uni-country"
                      type="text"
                      value={uniForm.country}
                      onChange={e => setUniForm({ ...uniForm, country: e.target.value })}
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="input-edit-uni-city">City</label>
                    <input
                      id="input-edit-uni-city"
                      type="text"
                      value={uniForm.city}
                      onChange={e => setUniForm({ ...uniForm, city: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-field">
                  <label htmlFor="input-edit-uni-website">Website URL</label>
                  <input
                    id="input-edit-uni-website"
                    type="text"
                    value={uniForm.website}
                    onChange={e => setUniForm({ ...uniForm, website: e.target.value })}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="input-edit-uni-logo">Logo / Crest URL</label>
                  <input
                    id="input-edit-uni-logo"
                    type="text"
                    value={uniForm.logoUrl}
                    onChange={e => setUniForm({ ...uniForm, logoUrl: e.target.value })}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="input-edit-uni-desc">Description</label>
                  <textarea
                    id="input-edit-uni-desc"
                    rows={3}
                    value={uniForm.description}
                    onChange={e => setUniForm({ ...uniForm, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="uni-modal-footer">
                <button
                  type="button"
                  className="uni-action-btn-secondary"
                  onClick={() => setIsEditModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  id="btn-save-edit-university"
                  type="submit"
                  className="uni-action-btn-primary"
                  disabled={submittingUni}
                >
                  <Check size={16} /> {submittingUni ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: ADD DEPARTMENT ─── */}
      {isAddDeptModalOpen && selectedUniversity && (
        <div className="uni-modal-overlay" onClick={() => setIsAddDeptModalOpen(false)}>
          <div className="uni-modal-content small" onClick={e => e.stopPropagation()}>
            <div className="uni-modal-header">
              <h2>
                <PlusCircle size={18} /> Add Department
              </h2>
              <button className="uni-modal-close" onClick={() => setIsAddDeptModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddDepartment}>
              <div className="uni-modal-body">
                <div className="form-field">
                  <label htmlFor="input-dept-name">Department / Faculty Name *</label>
                  <input
                    id="input-dept-name"
                    type="text"
                    required
                    placeholder="e.g. Department of Computer Science"
                    value={deptForm.name}
                    onChange={e => setDeptForm({ ...deptForm, name: e.target.value })}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="input-dept-head">Head of Department / Dean</label>
                  <input
                    id="input-dept-head"
                    type="text"
                    placeholder="e.g. Prof. Alan Turing"
                    value={deptForm.headOfDepartment}
                    onChange={e => setDeptForm({ ...deptForm, headOfDepartment: e.target.value })}
                  />
                </div>

                <div className="form-grid-2">
                  <div className="form-field">
                    <label htmlFor="input-dept-visibility">Visibility</label>
                    <select
                      id="input-dept-visibility"
                      value={deptForm.visibility}
                      onChange={e => setDeptForm({ ...deptForm, visibility: e.target.value })}
                    >
                      <option value="Public">Public (Visible to All)</option>
                      <option value="Private">Private</option>
                    </select>
                  </div>

                  <div className="form-field">
                    <label htmlFor="input-dept-website">Department Website</label>
                    <input
                      id="input-dept-website"
                      type="text"
                      placeholder="e.g. cs.university.edu"
                      value={deptForm.website}
                      onChange={e => setDeptForm({ ...deptForm, website: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-field">
                  <label htmlFor="input-dept-desc">Description / Focus Areas</label>
                  <textarea
                    id="input-dept-desc"
                    rows={3}
                    placeholder="Describe laboratory infrastructure, focus areas, and research groups..."
                    value={deptForm.description}
                    onChange={e => setDeptForm({ ...deptForm, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="uni-modal-footer">
                <button
                  type="button"
                  className="uni-action-btn-secondary"
                  onClick={() => setIsAddDeptModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  id="btn-submit-dept"
                  type="submit"
                  className="uni-action-btn-primary"
                  disabled={submittingDept}
                >
                  <Check size={16} /> {submittingDept ? 'Adding...' : 'Add Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 4: EDIT DEPARTMENT ─── */}
      {isEditDeptModalOpen && selectedDept && selectedUniversity && (
        <div className="uni-modal-overlay" onClick={() => setIsEditDeptModalOpen(false)}>
          <div className="uni-modal-content small" onClick={e => e.stopPropagation()}>
            <div className="uni-modal-header">
              <h2>
                <Edit3 size={18} /> Edit Department
              </h2>
              <button className="uni-modal-close" onClick={() => setIsEditDeptModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdateDept}>
              <div className="uni-modal-body">
                <div className="form-field">
                  <label htmlFor="input-edit-dept-name">Department Name *</label>
                  <input
                    id="input-edit-dept-name"
                    type="text"
                    required
                    value={deptForm.name}
                    onChange={e => setDeptForm({ ...deptForm, name: e.target.value })}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="input-edit-dept-head">Head of Department / Dean</label>
                  <input
                    id="input-edit-dept-head"
                    type="text"
                    value={deptForm.headOfDepartment}
                    onChange={e => setDeptForm({ ...deptForm, headOfDepartment: e.target.value })}
                  />
                </div>

                <div className="form-grid-2">
                  <div className="form-field">
                    <label htmlFor="input-edit-dept-visibility">Visibility</label>
                    <select
                      id="input-edit-dept-visibility"
                      value={deptForm.visibility}
                      onChange={e => setDeptForm({ ...deptForm, visibility: e.target.value })}
                    >
                      <option value="Public">Public (Visible to All)</option>
                      <option value="Private">Private</option>
                    </select>
                  </div>

                  <div className="form-field">
                    <label htmlFor="input-edit-dept-website">Department Website</label>
                    <input
                      id="input-edit-dept-website"
                      type="text"
                      value={deptForm.website}
                      onChange={e => setDeptForm({ ...deptForm, website: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-field">
                  <label htmlFor="input-edit-dept-desc">Description</label>
                  <textarea
                    id="input-edit-dept-desc"
                    rows={3}
                    value={deptForm.description}
                    onChange={e => setDeptForm({ ...deptForm, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="uni-modal-footer">
                <button
                  type="button"
                  className="uni-action-btn-secondary"
                  onClick={() => setIsEditDeptModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  id="btn-save-edit-dept"
                  type="submit"
                  className="uni-action-btn-primary"
                  disabled={submittingDept}
                >
                  <Check size={16} /> {submittingDept ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 5: DELETE CONFIRMATION ─── */}
      {deleteTarget && (
        <div className="uni-modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="uni-modal-content small" onClick={e => e.stopPropagation()}>
            <div className="uni-modal-header">
              <h2>
                <AlertCircle size={20} color="#ef4444" />
                Confirm {deleteTarget.type === 'university' ? 'Deactivation' : 'Deletion'}
              </h2>
              <button className="uni-modal-close" onClick={() => setDeleteTarget(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="uni-modal-body">
              <p style={{ color: '#334155', fontSize: '0.98rem', lineHeight: 1.5 }}>
                Are you sure you want to {deleteTarget.type === 'university' ? 'deactivate' : 'delete'} <strong>{deleteTarget.name}</strong>?
              </p>
              {deleteTarget.type === 'university' ? (
                <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.6rem' }}>
                  This institution will be set to Inactive status and hidden from platform searches.
                </p>
              ) : (
                <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.6rem' }}>
                  This will permanently remove this department from this institution.
                </p>
              )}
            </div>

            <div className="uni-modal-footer">
              <button
                id="btn-cancel-delete"
                className="uni-action-btn-secondary"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                id="btn-confirm-delete"
                className="uni-action-btn-primary"
                style={{ background: '#ef4444' }}
                onClick={executeDelete}
              >
                Confirm {deleteTarget.type === 'university' ? 'Deactivate' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UniversityManagement;
