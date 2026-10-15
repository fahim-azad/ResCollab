import React, { useEffect, useState, useMemo } from 'react';
import { 
  Compass, Search, FolderOpen, Lightbulb, FlaskConical, Globe, Building, 
  Users, CheckCircle2, AlertCircle, Eye, Trash2, PlusCircle, X, Check, 
  Tag, Clock, Lock, Shield, DollarSign, RefreshCw, ExternalLink 
} from 'lucide-react';
import './ProjectDiscovery.css';

const API = 'http://localhost:5000/api';

export interface DiscoveredItem {
  id: number;
  itemType: 'OpenProject' | 'ResearchIdea';
  itemId: number;
  visibility: string;
  laboratoryId: number | null;
  laboratoryName: string | null;
  item: {
    id: number;
    title: string;
    description: string | null;
    department?: string | null;
    researchArea?: string | null;
    requiredSkills: string | null;
    maxStudents?: number;
    requiredTeamSize?: number;
    isFunded?: boolean;
    expectedOutcome?: string | null;
    status: string;
    createdAt: string;
    supervisorName?: string | null;
    creatorName?: string | null;
  };
}

export interface MyListingItem {
  id: number;
  itemType: 'OpenProject' | 'ResearchIdea';
  itemId: number;
  visibility: string;
  laboratoryId: number | null;
  laboratoryName: string | null;
  title: string;
  description: string | null;
  department?: string | null;
  researchArea?: string | null;
  status: string;
  createdAt: string;
}

export interface UnlistedOption {
  itemType: 'OpenProject' | 'ResearchIdea';
  itemId: number;
  title: string;
  department?: string | null;
  researchArea?: string | null;
}

export interface DirectoryLab {
  id: number;
  name: string;
  institution: string | null;
}

export const ProjectDiscovery: React.FC = () => {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'discover' | 'visibility' | 'publish'>('discover');

  // Discovery state
  const [discoveredListings, setDiscoveredListings] = useState<DiscoveredItem[]>([]);
  const [loadingDiscovery, setLoadingDiscovery] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'All' | 'OpenProject' | 'ResearchIdea'>('All');
  const [researchAreaFilter, setResearchAreaFilter] = useState<string>('');
  const [labFilter, setLabFilter] = useState<string>('All');
  const [selectedDiscoveredItem, setSelectedDiscoveredItem] = useState<DiscoveredItem | null>(null);

  // My Listings & Visibility state
  const [myListings, setMyListings] = useState<MyListingItem[]>([]);
  const [loadingMyListings, setLoadingMyListings] = useState<boolean>(false);
  const [unlistedItems, setUnlistedItems] = useState<{ projects: UnlistedOption[]; ideas: UnlistedOption[] }>({
    projects: [],
    ideas: []
  });
  const [laboratories, setLaboratories] = useState<DirectoryLab[]>([]);
  const [listingToDelete, setListingToDelete] = useState<MyListingItem | null>(null);

  // Publish form state
  const [selectedUnlistedKey, setSelectedUnlistedKey] = useState<string>('');
  const [publishVisibility, setPublishVisibility] = useState<string>('Public');
  const [publishLabId, setPublishLabId] = useState<string>('');
  const [submittingPublish, setSubmittingPublish] = useState<boolean>(false);

  // Alerts
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showAlert = (type: 'success' | 'error', message: string) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 4000);
  };

  // Helper: Fetch public discovery listings
  const fetchDiscoveredListings = async () => {
    setLoadingDiscovery(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (typeFilter !== 'All') params.append('itemType', typeFilter);
      if (searchTerm.trim()) params.append('search', searchTerm.trim());
      if (researchAreaFilter.trim()) params.append('researchArea', researchAreaFilter.trim());
      if (labFilter !== 'All') params.append('laboratoryId', labFilter);

      const url = `${API}/projectdiscovery${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDiscoveredListings(data);
      } else {
        showAlert('error', 'Failed to load project discovery feed.');
      }
    } catch {
      showAlert('error', 'Network error connecting to project discovery service.');
    } finally {
      setLoadingDiscovery(false);
    }
  };

  // Helper: Fetch user's managed listings
  const fetchMyListings = async () => {
    setLoadingMyListings(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/projectdiscovery/my-listings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMyListings(data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingMyListings(false);
    }
  };

  // Helper: Fetch unlisted items eligible for publishing
  const fetchUnlistedItems = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/projectdiscovery/unlisted-items`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUnlistedItems(data);
      }
    } catch {
      // ignore
    }
  };

  // Helper: Fetch laboratories for affiliation selector
  const fetchLaboratories = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/directory/laboratories`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLaboratories(data);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchDiscoveredListings();
    fetchLaboratories();
  }, [typeFilter, labFilter]);

  useEffect(() => {
    if (activeTab === 'visibility' || activeTab === 'publish') {
      fetchMyListings();
      fetchUnlistedItems();
    }
  }, [activeTab]);

  // Handle Search Form Submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDiscoveredListings();
  };

  // Handle Update Listing Visibility directly
  const handleUpdateListingVisibility = async (listingId: number, newVisibility: string, labId?: number | null) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API}/projectdiscovery/listing/${listingId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          visibility: newVisibility,
          laboratoryId: labId !== undefined ? labId : null
        })
      });

      if (res.ok) {
        showAlert('success', `Directory visibility updated to ${newVisibility}!`);
        setMyListings(prev => prev.map(l => l.id === listingId ? { ...l, visibility: newVisibility } : l));
        fetchDiscoveredListings();
      } else {
        showAlert('error', 'Failed to update visibility listing.');
      }
    } catch {
      showAlert('error', 'Network error updating listing visibility.');
    }
  };

  // Handle Update Listing Laboratory
  const handleUpdateListingLab = async (listingId: number, currentVis: string, newLabIdStr: string) => {
    const labId = newLabIdStr === '' ? null : parseInt(newLabIdStr);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API}/projectdiscovery/listing/${listingId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          visibility: currentVis,
          laboratoryId: labId
        })
      });

      if (res.ok) {
        const matchedLab = laboratories.find(l => l.id === labId);
        showAlert('success', 'Affiliated laboratory updated!');
        setMyListings(prev => prev.map(l => l.id === listingId ? { ...l, laboratoryId: labId, laboratoryName: matchedLab?.name || null } : l));
        fetchDiscoveredListings();
      } else {
        showAlert('error', 'Failed to update laboratory affiliation.');
      }
    } catch {
      showAlert('error', 'Network error updating laboratory affiliation.');
    }
  };

  // Handle Remove Listing from Directory
  const executeDeleteListing = async () => {
    if (!listingToDelete) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API}/projectdiscovery/listing/${listingToDelete.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        showAlert('success', 'Project listing removed from directory.');
        setMyListings(prev => prev.filter(l => l.id !== listingToDelete.id));
        setListingToDelete(null);
        fetchDiscoveredListings();
      } else {
        showAlert('error', 'Failed to remove listing from directory.');
      }
    } catch {
      showAlert('error', 'Network error removing listing.');
    }
  };

  // Handle Publish New Listing to Directory
  const handlePublishSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnlistedKey) {
      showAlert('error', 'Please choose a project or research idea to publish.');
      return;
    }

    const [itemType, itemIdStr] = selectedUnlistedKey.split(':');
    const itemId = parseInt(itemIdStr);
    const labId = publishLabId ? parseInt(publishLabId) : null;

    setSubmittingPublish(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/projectdiscovery/listing`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          itemType,
          itemId,
          visibility: publishVisibility,
          laboratoryId: labId
        })
      });

      if (res.ok) {
        showAlert('success', 'Project published to research directory with chosen visibility!');
        setSelectedUnlistedKey('');
        setPublishVisibility('Public');
        setPublishLabId('');
        await fetchMyListings();
        await fetchUnlistedItems();
        setActiveTab('visibility');
      } else {
        const err = await res.text();
        showAlert('error', err || 'Failed to publish listing.');
      }
    } catch {
      showAlert('error', 'Network error publishing listing.');
    } finally {
      setSubmittingPublish(false);
    }
  };

  // Filtered Discovered Listings
  const filteredDiscoveredListings = useMemo(() => {
    return discoveredListings.filter(entry => {
      const title = entry.item?.title || '';
      const desc = entry.item?.description || '';
      const area = entry.item?.researchArea || entry.item?.department || '';

      const matchesSearch = searchTerm.trim() === '' ||
        title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        desc.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesArea = researchAreaFilter.trim() === '' ||
        area.toLowerCase().includes(researchAreaFilter.toLowerCase());

      return matchesSearch && matchesArea;
    });
  }, [discoveredListings, searchTerm, researchAreaFilter]);

  // Combined Unlisted items
  const combinedUnlisted = useMemo(() => {
    return [
      ...unlistedItems.projects.map(p => ({ ...p, label: `[Open Project] ${p.title}` })),
      ...unlistedItems.ideas.map(i => ({ ...i, label: `[Research Idea] ${i.title}` }))
    ];
  }, [unlistedItems]);

  return (
    <div className="disco-container">
      {/* Header */}
      <div className="disco-header">
        <div className="disco-header-text">
          <h1>Project Visibility & Discovery</h1>
          <p>
            Explore open projects and research opportunities listed across accredited institutions,
            or manage your project visibility controls and directory publishing preferences.
          </p>
        </div>

        <div className="disco-header-stats">
          <div className="disco-stat-pill">
            <Compass size={18} color="var(--brand-cyan, #009acc)" />
            <span>Opportunities: <span className="stat-number">{discoveredListings.length}</span></span>
          </div>
          <div className="disco-stat-pill">
            <Shield size={18} color="#7c3aed" />
            <span>My Listings: <span className="stat-number">{myListings.length}</span></span>
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
      <div className="disco-tabs">
        <button
          id="tab-btn-discover"
          className={`disco-tab-btn ${activeTab === 'discover' ? 'active' : ''}`}
          onClick={() => setActiveTab('discover')}
        >
          <Compass size={18} />
          Discover Opportunities
          <span className="disco-tab-badge">{filteredDiscoveredListings.length}</span>
        </button>

        <button
          id="tab-btn-visibility"
          className={`disco-tab-btn ${activeTab === 'visibility' ? 'active' : ''}`}
          onClick={() => setActiveTab('visibility')}
        >
          <Shield size={18} />
          My Project Visibility & Listings
          <span className="disco-tab-badge">{myListings.length}</span>
        </button>

        <button
          id="tab-btn-publish"
          className={`disco-tab-btn ${activeTab === 'publish' ? 'active' : ''}`}
          onClick={() => setActiveTab('publish')}
        >
          <PlusCircle size={18} />
          Publish to Directory
        </button>
      </div>

      {/* ─── TAB 1: DISCOVER OPPORTUNITIES ─── */}
      {activeTab === 'discover' && (
        <div>
          {/* Discovery Filters Bar */}
          <form onSubmit={handleSearchSubmit} className="disco-filter-bar">
            <div className="disco-search-box">
              <Search size={18} />
              <input
                id="input-discovery-search"
                type="text"
                placeholder="Search projects and ideas by title or description..."
                className="disco-search-input"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Type Filter Chips */}
            <div className="disco-type-chips">
              <button
                type="button"
                id="chip-type-all"
                className={`disco-chip ${typeFilter === 'All' ? 'active' : ''}`}
                onClick={() => setTypeFilter('All')}
              >
                All
              </button>
              <button
                type="button"
                id="chip-type-project"
                className={`disco-chip project ${typeFilter === 'OpenProject' ? 'active project' : ''}`}
                onClick={() => setTypeFilter('OpenProject')}
              >
                <FolderOpen size={13} /> Projects
              </button>
              <button
                type="button"
                id="chip-type-idea"
                className={`disco-chip idea ${typeFilter === 'ResearchIdea' ? 'active idea' : ''}`}
                onClick={() => setTypeFilter('ResearchIdea')}
              >
                <Lightbulb size={13} /> Ideas
              </button>
            </div>

            {/* Research Area Filter Input */}
            <input
              id="input-discovery-area"
              type="text"
              placeholder="Filter by research area..."
              className="disco-select-filter"
              style={{ minWidth: '180px' }}
              value={researchAreaFilter}
              onChange={e => setResearchAreaFilter(e.target.value)}
            />

            {/* Laboratory Filter Dropdown */}
            <select
              id="select-discovery-lab"
              className="disco-select-filter"
              value={labFilter}
              onChange={e => setLabFilter(e.target.value)}
            >
              <option value="All">All Laboratories</option>
              {laboratories.map(lab => (
                <option key={lab.id} value={lab.id.toString()}>
                  {lab.name} ({lab.institution || 'Lab'})
                </option>
              ))}
            </select>

            <button
              id="btn-refresh-discovery"
              type="button"
              className="disco-action-btn-secondary"
              onClick={() => fetchDiscoveredListings()}
            >
              <RefreshCw size={15} /> Refresh
            </button>
          </form>

          {/* Discovery Cards Grid */}
          {loadingDiscovery ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
              <RefreshCw size={28} className="animate-spin" style={{ marginBottom: '0.8rem' }} />
              <p>Discovering published research opportunities...</p>
            </div>
          ) : filteredDiscoveredListings.length === 0 ? (
            <div className="disco-empty-state">
              <Compass size={48} />
              <h3>No research opportunities found</h3>
              <p>
                {searchTerm || researchAreaFilter || labFilter !== 'All' || typeFilter !== 'All'
                  ? 'No projects or research ideas match your active filter criteria.'
                  : 'No public projects or ideas have been published to the directory yet.'}
              </p>
              <button
                id="btn-empty-publish"
                className="disco-action-btn-primary"
                style={{ margin: '0 auto' }}
                onClick={() => setActiveTab('publish')}
              >
                <PlusCircle size={16} /> Publish Your Project to Directory
              </button>
            </div>
          ) : (
            <div className="disco-grid">
              {filteredDiscoveredListings.map(entry => {
                const isProject = entry.itemType === 'OpenProject';
                const skillsArray = entry.item.requiredSkills
                  ? entry.item.requiredSkills.split(',').map(s => s.trim()).filter(Boolean)
                  : [];

                return (
                  <div
                    key={entry.id}
                    className={`disco-card ${isProject ? 'project-type' : 'idea-type'}`}
                    id={`disco-card-${entry.id}`}
                  >
                    <div>
                      {/* Top Badges Row */}
                      <div className="disco-card-top-badges">
                        <span className={`disco-type-badge ${isProject ? 'project' : 'idea'}`}>
                          {isProject ? <FolderOpen size={12} /> : <Lightbulb size={12} />}
                          {isProject ? 'Open Project' : 'Research Idea'}
                        </span>

                        {entry.laboratoryName && (
                          <span className="disco-lab-tag" title={entry.laboratoryName}>
                            <FlaskConical size={12} /> {entry.laboratoryName}
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h3 className="disco-card-title">{entry.item.title}</h3>

                      {/* Creator / Supervisor & Dept */}
                      <div className="disco-card-creator">
                        <Users size={13} />
                        <span>
                          {entry.item.supervisorName || entry.item.creatorName || 'Faculty Researcher'}
                        </span>
                        {(entry.item.department || entry.item.researchArea) && (
                          <span>• {entry.item.department || entry.item.researchArea}</span>
                        )}
                      </div>

                      {/* Skills Tags */}
                      {skillsArray.length > 0 && (
                        <div className="disco-skills-wrap">
                          {skillsArray.slice(0, 3).map((skill, idx) => (
                            <span key={idx} className="disco-skill-tag">
                              {skill}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Description */}
                      <p className="disco-card-desc">
                        {entry.item.description || 'Interdisciplinary research initiative published for public researcher collaboration.'}
                      </p>
                    </div>

                    <div>
                      {/* Meta Footer */}
                      <div className="disco-card-footer">
                        {isProject ? (
                          <span>
                            {entry.item.isFunded ? (
                              <strong style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <DollarSign size={13} /> Funded Research
                              </strong>
                            ) : (
                              <span>Academic Project</span>
                            )}
                          </span>
                        ) : (
                          <span>
                            Team Size: <strong>{entry.item.requiredTeamSize || 2} members</strong>
                          </span>
                        )}

                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={12} />
                          {new Date(entry.item.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <div style={{ marginTop: '0.85rem' }}>
                        <button
                          id={`btn-view-project-${entry.id}`}
                          className="disco-action-btn-primary"
                          style={{ width: '100%', justifyContent: 'center', padding: '0.55rem' }}
                          onClick={() => setSelectedDiscoveredItem(entry)}
                        >
                          <Eye size={15} /> Inspect Opportunity Details
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

      {/* ─── TAB 2: MY PROJECT VISIBILITY & LISTINGS ─── */}
      {activeTab === 'visibility' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.4rem', color: 'var(--brand-navy, #0e3065)', marginBottom: '0.2rem' }}>
                Manage Project Visibility Controls
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.95rem' }}>
                Control which of your open research projects and ideas are publicly discoverable, restricted to your university, or private.
              </p>
            </div>

            <button
              id="btn-publish-new-shortcut"
              className="disco-action-btn-primary"
              onClick={() => setActiveTab('publish')}
            >
              <PlusCircle size={16} /> Publish New Listing
            </button>
          </div>

          {loadingMyListings ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
              <RefreshCw size={28} className="animate-spin" style={{ marginBottom: '0.8rem' }} />
              <p>Loading your managed directory listings...</p>
            </div>
          ) : myListings.length === 0 ? (
            <div className="disco-empty-state">
              <Shield size={48} />
              <h3>No directory listings configured</h3>
              <p>
                You have not published any projects or research ideas to the directory yet.
              </p>
              <button
                id="btn-first-publish"
                className="disco-action-btn-primary"
                style={{ margin: '0 auto' }}
                onClick={() => setActiveTab('publish')}
              >
                <PlusCircle size={16} /> Publish Your First Project
              </button>
            </div>
          ) : (
            <div className="vis-mgmt-list">
              {myListings.map(listing => {
                const isProject = listing.itemType === 'OpenProject';
                const visLower = listing.visibility.toLowerCase();

                return (
                  <div key={listing.id} className="vis-mgmt-card" id={`vis-mgmt-card-${listing.id}`}>
                    <div className="vis-mgmt-info">
                      <div className="vis-mgmt-title-row">
                        <span className={`disco-type-badge ${isProject ? 'project' : 'idea'}`}>
                          {isProject ? <FolderOpen size={11} /> : <Lightbulb size={11} />}
                          {isProject ? 'Open Project' : 'Research Idea'}
                        </span>

                        <span className={`vis-status-badge ${visLower}`}>
                          {visLower === 'public' ? <Globe size={13} /> :
                            visLower === 'institution' ? <Building size={13} /> :
                            visLower === 'connections' ? <Users size={13} /> : <Lock size={13} />}
                          {listing.visibility}
                        </span>

                        {listing.laboratoryName && (
                          <span className="disco-lab-tag">
                            <FlaskConical size={12} /> {listing.laboratoryName}
                          </span>
                        )}
                      </div>

                      <h3 className="vis-mgmt-title">{listing.title}</h3>
                      <p style={{ color: '#475569', fontSize: '0.88rem', margin: '0.3rem 0', lineHeight: 1.4 }}>
                        {listing.description || 'No description provided.'}
                      </p>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                        Listed: {new Date(listing.createdAt).toLocaleDateString()} • Scope: {listing.department || listing.researchArea || 'General'}
                      </div>
                    </div>

                    {/* Visibility & Laboratory Quick Controls */}
                    <div className="vis-mgmt-controls">
                      {/* Visibility Selector */}
                      <select
                        id={`select-listing-vis-${listing.id}`}
                        className="disco-select-filter"
                        style={{ fontWeight: 600 }}
                        value={listing.visibility}
                        onChange={e => handleUpdateListingVisibility(listing.id, e.target.value, listing.laboratoryId)}
                      >
                        <option value="Public">🌐 Public (All)</option>
                        <option value="Institution">🏛️ Institution Only</option>
                        <option value="Connections">👥 Connections Only</option>
                        <option value="Private">🔒 Private</option>
                      </select>

                      {/* Laboratory Selector */}
                      <select
                        id={`select-listing-lab-${listing.id}`}
                        className="disco-select-filter"
                        value={listing.laboratoryId || ''}
                        onChange={e => handleUpdateListingLab(listing.id, listing.visibility, e.target.value)}
                      >
                        <option value="">No Lab Affiliation</option>
                        {laboratories.map(lab => (
                          <option key={lab.id} value={lab.id.toString()}>
                            Lab: {lab.name}
                          </option>
                        ))}
                      </select>

                      {/* Remove Listing */}
                      <button
                        id={`btn-delete-listing-${listing.id}`}
                        className="disco-action-btn-secondary"
                        style={{ padding: '0.65rem 0.85rem', color: '#ef4444' }}
                        title="Remove from directory"
                        onClick={() => setListingToDelete(listing)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 3: PUBLISH TO DIRECTORY ─── */}
      {activeTab === 'publish' && (
        <div style={{ maxWidth: '850px', margin: '0 auto' }}>
          <div className="dir-form-card">
            <h2>Publish Project / Idea to Directory</h2>
            <p className="form-subtitle">
              Make your research initiative discoverable to peer researchers and prospective students across institutions.
            </p>

            <form onSubmit={handlePublishSubmit}>
              {/* Select Unlisted Item */}
              <div className="dir-form-field">
                <label htmlFor="select-unlisted-item">
                  <FolderOpen size={16} /> Select Project or Research Idea to Publish *
                </label>
                <select
                  id="select-unlisted-item"
                  value={selectedUnlistedKey}
                  onChange={e => setSelectedUnlistedKey(e.target.value)}
                  required
                >
                  <option value="">-- Choose from your active projects or ideas --</option>
                  {combinedUnlisted.length === 0 ? (
                    <option value="" disabled>No unlisted projects or ideas available.</option>
                  ) : (
                    combinedUnlisted.map(item => (
                      <option key={`${item.itemType}:${item.itemId}`} value={`${item.itemType}:${item.itemId}`}>
                        {item.label}
                      </option>
                    ))
                  )}
                </select>
                {combinedUnlisted.length === 0 && (
                  <span style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.3rem' }}>
                    All of your current projects and ideas are already published. Create new projects in Project Marketplace or ideas in Idea Marketplace to list more.
                  </span>
                )}
              </div>

              {/* Visibility Options Radio Cards */}
              <div className="dir-form-field">
                <label>Directory Visibility Tier *</label>
                <div className="vis-option-grid">
                  <div
                    id="vis-opt-public"
                    className={`vis-opt-box ${publishVisibility === 'Public' ? 'selected public' : ''}`}
                    onClick={() => setPublishVisibility('Public')}
                  >
                    <div className="vis-opt-title">
                      <Globe size={15} color="#059669" /> Public Visibility
                    </div>
                    <div className="vis-opt-desc">
                      Discoverable platform-wide across all universities, search, and student matching.
                    </div>
                  </div>

                  <div
                    id="vis-opt-institution"
                    className={`vis-opt-box ${publishVisibility === 'Institution' ? 'selected institution' : ''}`}
                    onClick={() => setPublishVisibility('Institution')}
                  >
                    <div className="vis-opt-title">
                      <Building size={15} color="#2563eb" /> Institution Only
                    </div>
                    <div className="vis-opt-desc">
                      Restricted to researchers and faculty within your affiliated university.
                    </div>
                  </div>

                  <div
                    id="vis-opt-connections"
                    className={`vis-opt-box ${publishVisibility === 'Connections' ? 'selected connections' : ''}`}
                    onClick={() => setPublishVisibility('Connections')}
                  >
                    <div className="vis-opt-title">
                      <Users size={15} color="#7c3aed" /> Connections Only
                    </div>
                    <div className="vis-opt-desc">
                      Visible exclusively to accepted peers in your professional research network.
                    </div>
                  </div>

                  <div
                    id="vis-opt-private"
                    className={`vis-opt-box ${publishVisibility === 'Private' ? 'selected private' : ''}`}
                    onClick={() => setPublishVisibility('Private')}
                  >
                    <div className="vis-opt-title">
                      <Lock size={15} color="#d97706" /> Private Draft
                    </div>
                    <div className="vis-opt-desc">
                      Hidden from public listings. Visible only to you and workspace team members.
                    </div>
                  </div>
                </div>
              </div>

              {/* Laboratory Affiliation Option */}
              <div className="dir-form-field">
                <label htmlFor="select-publish-lab">
                  <FlaskConical size={16} /> Associate with Laboratory (Optional)
                </label>
                <select
                  id="select-publish-lab"
                  value={publishLabId}
                  onChange={e => setPublishLabId(e.target.value)}
                >
                  <option value="">-- No Laboratory Affiliation --</option>
                  {laboratories.map(lab => (
                    <option key={lab.id} value={lab.id.toString()}>
                      {lab.name} ({lab.institution || 'Lab'})
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Linking a laboratory prominently tags the project with the laboratory's credentials and equipment focus.
                </span>
              </div>

              <button
                id="btn-submit-listing"
                type="submit"
                className="disco-action-btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '0.85rem', marginTop: '1rem' }}
                disabled={submittingPublish || !selectedUnlistedKey}
              >
                <Check size={18} />
                {submittingPublish ? 'Publishing Listing...' : 'Publish to Research Directory'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 1: INSPECT DISCOVERED PROJECT / IDEA DETAILS ─── */}
      {selectedDiscoveredItem && (
        <div className="disco-modal-overlay" onClick={() => setSelectedDiscoveredItem(null)}>
          <div className="disco-modal-content" onClick={e => e.stopPropagation()}>
            <div className="disco-modal-header">
              <h2>
                {selectedDiscoveredItem.itemType === 'OpenProject' ? (
                  <FolderOpen size={20} color="#2563eb" />
                ) : (
                  <Lightbulb size={20} color="#7c3aed" />
                )}
                {selectedDiscoveredItem.itemType === 'OpenProject' ? 'Open Research Project' : 'Collaborative Research Idea'}
              </h2>
              <button
                id="btn-close-project-modal"
                className="disco-modal-close"
                onClick={() => setSelectedDiscoveredItem(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="disco-modal-body">
              {/* Top Banner */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                <span className={`disco-type-badge ${selectedDiscoveredItem.itemType === 'OpenProject' ? 'project' : 'idea'}`}>
                  {selectedDiscoveredItem.itemType === 'OpenProject' ? 'Project' : 'Research Idea'}
                </span>

                {selectedDiscoveredItem.laboratoryName && (
                  <span className="disco-lab-tag" style={{ fontSize: '0.85rem', padding: '0.3rem 0.75rem' }}>
                    <FlaskConical size={14} /> Affiliated Lab: {selectedDiscoveredItem.laboratoryName}
                  </span>
                )}

                <span className="vis-status-badge public">
                  <Globe size={13} /> {selectedDiscoveredItem.visibility} Listing
                </span>
              </div>

              <h2 style={{ fontSize: '1.45rem', color: 'var(--brand-navy, #0e3065)', marginBottom: '0.5rem' }}>
                {selectedDiscoveredItem.item.title}
              </h2>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <span>
                  <Users size={14} style={{ display: 'inline', marginRight: '4px' }} />
                  Lead: <strong>{selectedDiscoveredItem.item.supervisorName || selectedDiscoveredItem.item.creatorName || 'Researcher'}</strong>
                </span>

                {(selectedDiscoveredItem.item.department || selectedDiscoveredItem.item.researchArea) && (
                  <span>
                    <Building size={14} style={{ display: 'inline', marginRight: '4px' }} />
                    {selectedDiscoveredItem.item.department || selectedDiscoveredItem.item.researchArea}
                  </span>
                )}

                <span>
                  <Clock size={14} style={{ display: 'inline', marginRight: '4px' }} />
                  Listed: {new Date(selectedDiscoveredItem.item.createdAt).toLocaleDateString()}
                </span>
              </div>

              {/* Scope & Description */}
              <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '14px', border: '1px solid #e2e8f0', marginBottom: '1.5rem', lineHeight: 1.6, color: '#334155' }}>
                <h4 style={{ fontSize: '0.85rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  Project Overview & Objectives
                </h4>
                {selectedDiscoveredItem.item.description || 'Comprehensive scientific inquiry and collaborative development initiative.'}
              </div>

              {/* Skills and Requirements */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--brand-navy, #0e3065)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Tag size={15} /> Required Skills & Methodologies
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {selectedDiscoveredItem.item.requiredSkills ? (
                    selectedDiscoveredItem.item.requiredSkills.split(',').map((skill, idx) => (
                      <span key={idx} className="disco-skill-tag" style={{ fontSize: '0.82rem', padding: '0.25rem 0.65rem' }}>
                        {skill.trim()}
                      </span>
                    ))
                  ) : (
                    <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Open to general research backgrounds</span>
                  )}
                </div>
              </div>

              {/* Funding or Team Capacity Info */}
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                {selectedDiscoveredItem.itemType === 'OpenProject' && (
                  <div style={{ background: '#ffffff', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.88rem' }}>
                    Max Student Positions: <strong>{selectedDiscoveredItem.item.maxStudents || 1}</strong>
                  </div>
                )}
                {selectedDiscoveredItem.itemType === 'ResearchIdea' && (
                  <div style={{ background: '#ffffff', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.88rem' }}>
                    Team Capacity Needed: <strong>{selectedDiscoveredItem.item.requiredTeamSize || 2} researchers</strong>
                  </div>
                )}
              </div>
            </div>

            <div className="disco-modal-footer">
              <a
                href={selectedDiscoveredItem.itemType === 'OpenProject' ? '/projects' : '/ideas'}
                className="disco-action-btn-secondary"
                style={{ textDecoration: 'none' }}
              >
                <ExternalLink size={15} /> Go to Marketplace
              </a>
              <button
                id="btn-close-project-detail"
                className="disco-action-btn-primary"
                onClick={() => setSelectedDiscoveredItem(null)}
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: DELETE LISTING CONFIRMATION ─── */}
      {listingToDelete && (
        <div className="disco-modal-overlay" onClick={() => setListingToDelete(null)}>
          <div className="disco-modal-content small" onClick={e => e.stopPropagation()}>
            <div className="disco-modal-header">
              <h2>
                <AlertCircle size={20} color="#ef4444" />
                Remove from Directory
              </h2>
              <button className="disco-modal-close" onClick={() => setListingToDelete(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="disco-modal-body">
              <p style={{ color: '#334155', fontSize: '0.98rem', lineHeight: 1.5 }}>
                Are you sure you want to remove <strong>{listingToDelete.title}</strong> from the public research directory?
              </p>
              <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.6rem' }}>
                Your project or idea will remain in your private workspace and marketplace, but will no longer be discoverable in the directory.
              </p>
            </div>

            <div className="disco-modal-footer">
              <button
                id="btn-cancel-delete-listing"
                className="disco-action-btn-secondary"
                onClick={() => setListingToDelete(null)}
              >
                Cancel
              </button>
              <button
                id="btn-confirm-delete-listing"
                className="disco-action-btn-primary"
                style={{ background: '#ef4444' }}
                onClick={executeDeleteListing}
              >
                Remove from Directory
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDiscovery;
