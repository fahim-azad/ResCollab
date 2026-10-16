import React, { useEffect, useState, useMemo } from 'react';
import {
  DollarSign, Search, Filter, Plus, Calendar, Building2,
  ExternalLink, Clock, FileText, CheckCircle2, AlertCircle,
  Edit3, Trash2, Eye, Shield, RefreshCw, Sparkles, Award,
  Check, X, Tag, ArrowRight, Bookmark, ArrowUpDown, Layers,
  Compass, Share2
} from 'lucide-react';
import FundingDetailsModal, { type FundingOpportunityDetail } from './FundingDetailsModal';
import './FundingOpportunities.css';

const API = 'http://localhost:5000/api';

const FUNDING_TYPES = ['Grant', 'Scholarship', 'Fellowship', 'Award', 'Contract', 'Other'];
const STATUSES = ['Open', 'Upcoming', 'Closed'];

const RESEARCH_AREAS = [
  'All',
  'Computer Science',
  'Artificial Intelligence',
  'Biomedical & Health',
  'Engineering',
  'STEM',
  'Data Science',
  'Environmental & Climate',
  'Ethics & Society'
];

export const FundingOpportunities: React.FC = () => {
  const token = localStorage.getItem('token') || '';
  const userStr = localStorage.getItem('user');
  const currentUser = userStr ? JSON.parse(userStr) : null;
  const currentUserId = currentUser?.id ?? -1;

  // Tabs: 'explore' | 'my' | 'add'
  const [activeTab, setActiveTab] = useState<'explore' | 'my' | 'add'>('explore');

  // Opportunities state
  const [opportunities, setOpportunities] = useState<FundingOpportunityDetail[]>([]);
  const [myOpportunities, setMyOpportunities] = useState<FundingOpportunityDetail[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filters for Explore tab
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [areaFilter, setAreaFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'deadline-asc' | 'deadline-desc' | 'newest' | 'title-asc'>('deadline-asc');

  // Saved/Bookmarked IDs (persisted locally)
  const [savedIds, setSavedIds] = useState<number[]>(() => {
    try {
      const stored = localStorage.getItem('saved_funding_ids');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Modal State
  const [selectedOpportunity, setSelectedOpportunity] = useState<FundingOpportunityDetail | null>(null);
  const [editingOpportunity, setEditingOpportunity] = useState<FundingOpportunityDetail | null>(null);

  // Form State for Add / Edit
  const initialFormState = {
    title: '',
    provider: '',
    description: '',
    eligibility: '',
    requirements: '',
    fundingAmount: '',
    fundingType: 'Grant',
    researchArea: '',
    applicationUrl: '',
    applicationInfo: '',
    deadline: '',
    status: 'Open'
  };
  const [form, setForm] = useState(initialFormState);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch Public Opportunities with query parameters
  const fetchOpportunities = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (typeFilter !== 'All') params.set('fundingType', typeFilter);
      if (statusFilter !== 'All') params.set('status', statusFilter);
      if (areaFilter !== 'All') params.set('researchArea', areaFilter);

      const res = await fetch(`${API}/funding?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        const data = await res.json();
        setOpportunities(data);
      }
    } catch (err) {
      console.error('Error fetching funding opportunities:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch My Opportunities (posted by user)
  const fetchMyOpportunities = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/funding/my`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        const data = await res.json();
        setMyOpportunities(data);
      }
    } catch (err) {
      console.error('Error fetching my opportunities:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'explore') {
      fetchOpportunities();
    } else if (activeTab === 'my') {
      fetchMyOpportunities();
    }
  }, [activeTab, typeFilter, statusFilter, areaFilter]);

  // Open Full Details View by fetching opportunity detail
  const handleOpenDetails = async (id: number) => {
    try {
      const res = await fetch(`${API}/funding/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        const detail = await res.json();
        setSelectedOpportunity(detail);
      } else {
        alert('Could not load funding opportunity details.');
      }
    } catch (err) {
      console.error('Error opening funding details:', err);
    }
  };

  // Toggle Bookmark
  const handleToggleBookmark = (id: number) => {
    setSavedIds(prev => {
      const exists = prev.includes(id);
      const next = exists ? prev.filter(x => x !== id) : [...prev, id];
      localStorage.setItem('saved_funding_ids', JSON.stringify(next));
      return next;
    });
  };

  // Handle Search Form Submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOpportunities();
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setTypeFilter('All');
    setStatusFilter('All');
    setAreaFilter('All');
    setTimeout(() => {
      fetchOpportunities();
    }, 0);
  };

  // Open Edit Form
  const handleStartEdit = (opp: FundingOpportunityDetail) => {
    setEditingOpportunity(opp);
    setForm({
      title: opp.title,
      provider: opp.provider,
      description: opp.description || '',
      eligibility: opp.eligibility || '',
      requirements: opp.requirements || '',
      fundingAmount: opp.fundingAmount || '',
      fundingType: opp.fundingType,
      researchArea: opp.researchArea || '',
      applicationUrl: opp.applicationUrl || '',
      applicationInfo: opp.applicationInfo || '',
      deadline: opp.deadline ? opp.deadline.split('T')[0] : '',
      status: opp.status
    });
    setFormError(null);
    setActiveTab('add');
  };

  // Handle Form Submit (Create or Update)
  const handleSubmitOpportunity = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!form.title.trim()) {
      setFormError('Opportunity title is required.');
      return;
    }
    if (!form.provider.trim()) {
      setFormError('Funding provider / institution is required.');
      return;
    }

    setSubmitting(true);
    try {
      const isEditing = editingOpportunity !== null;
      const url = isEditing
        ? `${API}/funding/${editingOpportunity.id}`
        : `${API}/funding`;
      const method = isEditing ? 'PUT' : 'POST';

      const payload = {
        title: form.title.trim(),
        provider: form.provider.trim(),
        description: form.description.trim() || null,
        eligibility: form.eligibility.trim() || null,
        requirements: form.requirements.trim() || null,
        fundingAmount: form.fundingAmount.trim() || null,
        fundingType: form.fundingType,
        researchArea: form.researchArea.trim() || null,
        applicationUrl: form.applicationUrl.trim() || null,
        applicationInfo: form.applicationInfo.trim() || null,
        deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
        status: form.status
      };

      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setFeedbackMsg({
          type: 'success',
          text: isEditing
            ? 'Funding opportunity updated successfully!'
            : 'Funding opportunity published successfully!'
        });
        setTimeout(() => setFeedbackMsg(null), 4000);
        setForm(initialFormState);
        setEditingOpportunity(null);
        setActiveTab('explore');
        fetchOpportunities();
      } else {
        const errorText = await res.text();
        setFormError(errorText || 'Failed to save funding opportunity. Please review your input.');
      }
    } catch {
      setFormError('Network error occurred. Please check your connection.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete
  const handleDeleteOpportunity = async (id: number) => {
    try {
      const res = await fetch(`${API}/funding/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        setFeedbackMsg({ type: 'success', text: 'Funding opportunity deleted.' });
        setTimeout(() => setFeedbackMsg(null), 3500);
        setOpportunities(prev => prev.filter(o => o.id !== id));
        setMyOpportunities(prev => prev.filter(o => o.id !== id));
      } else {
        const err = await res.text();
        alert(`Failed to delete: ${err}`);
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  // Handle Toggle Status (Open vs Closed)
  const handleToggleStatus = async (id: number, currentStatus: string) => {
    const nextStatus = currentStatus === 'Open' ? 'Closed' : 'Open';
    try {
      const res = await fetch(`${API}/funding/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(nextStatus)
      });
      if (res.ok) {
        setOpportunities(prev => prev.map(o => o.id === id ? { ...o, status: nextStatus } : o));
        setMyOpportunities(prev => prev.map(o => o.id === id ? { ...o, status: nextStatus } : o));
        if (selectedOpportunity && selectedOpportunity.id === id) {
          setSelectedOpportunity({ ...selectedOpportunity, status: nextStatus });
        }
      }
    } catch (err) {
      console.error('Status update error:', err);
    }
  };

  // Sorted Opportunities list for Explore
  const sortedOpportunities = useMemo(() => {
    return [...opportunities].sort((a, b) => {
      if (sortBy === 'deadline-asc') {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      }
      if (sortBy === 'deadline-desc') {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(b.deadline).getTime() - new Date(a.deadline).getTime();
      }
      if (sortBy === 'title-asc') {
        return a.title.localeCompare(b.title);
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [opportunities, sortBy]);

  // Overall Statistics for Dashboard
  const stats = useMemo(() => {
    const total = opportunities.length;
    const grants = opportunities.filter(o => o.fundingType === 'Grant').length;
    const fellowships = opportunities.filter(o => o.fundingType === 'Fellowship' || o.fundingType === 'Scholarship').length;
    const openCount = opportunities.filter(o => o.status === 'Open').length;
    return { total, grants, fellowships, openCount };
  }, [opportunities]);

  // Helper for deadline calculations
  const getDeadlineBadge = (deadlineStr?: string | null) => {
    if (!deadlineStr) return { text: 'Rolling Deadline', isUrgent: false, isPassed: false };
    const deadline = new Date(deadlineStr);
    const now = new Date();
    const diffDays = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { text: `Closed (${deadline.toLocaleDateString()})`, isUrgent: false, isPassed: true };
    if (diffDays === 0) return { text: 'Due Today', isUrgent: true, isPassed: false };
    if (diffDays <= 7) return { text: `${diffDays}d remaining`, isUrgent: true, isPassed: false };
    return { text: `${diffDays} days left`, isUrgent: false, isPassed: false };
  };

  const getFundingBadgeClass = (type: string) => {
    switch (type.toLowerCase()) {
      case 'grant': return 'badge-grant';
      case 'fellowship': return 'badge-fellowship';
      case 'scholarship': return 'badge-scholarship';
      case 'award': return 'badge-award';
      case 'contract': return 'badge-contract';
      default: return 'badge-other';
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status.toLowerCase()) {
      case 'open': return 'badge-status-open';
      case 'upcoming': return 'badge-status-upcoming';
      case 'closed': return 'badge-status-closed';
      default: return 'badge-status-generic';
    }
  };

  return (
    <div className="funding-container" id="funding-opportunities-page">
      {/* Top Header */}
      <div className="funding-header">
        <div className="funding-header-content">
          <div className="funding-header-badge">
            <DollarSign size={15} /> Research Grants & Funding
          </div>
          <h1>Funding Opportunity Discovery</h1>
          <p>
            Explore competitive research grants, doctoral fellowships, awards, and scholarships from international foundations, government agencies, and industry sponsors.
          </p>
        </div>
        <div className="funding-header-actions">
          <button
            id="btn-header-post-funding"
            className="funding-primary-btn"
            onClick={() => {
              setEditingOpportunity(null);
              setForm(initialFormState);
              setActiveTab('add');
            }}
          >
            <Plus size={16} /> Post Opportunity
          </button>
        </div>
      </div>

      {/* Global Alert Notification */}
      {feedbackMsg && (
        <div
          className={`funding-feedback-alert ${feedbackMsg.type}`}
          id="funding-global-feedback-alert"
        >
          {feedbackMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="funding-tabs" role="tablist">
        <button
          id="tab-explore-funding"
          role="tab"
          aria-selected={activeTab === 'explore'}
          className={`funding-tab-btn ${activeTab === 'explore' ? 'active' : ''}`}
          onClick={() => {
            setEditingOpportunity(null);
            setActiveTab('explore');
          }}
        >
          <Compass size={16} /> Browse Opportunities ({opportunities.length})
        </button>

        <button
          id="tab-my-funding"
          role="tab"
          aria-selected={activeTab === 'my'}
          className={`funding-tab-btn ${activeTab === 'my' ? 'active' : ''}`}
          onClick={() => {
            setEditingOpportunity(null);
            setActiveTab('my');
          }}
        >
          <Layers size={16} /> My Posted Grants ({myOpportunities.length})
        </button>

        <button
          id="tab-post-funding"
          role="tab"
          aria-selected={activeTab === 'add'}
          className={`funding-tab-btn ${activeTab === 'add' ? 'active' : ''}`}
          onClick={() => {
            if (!editingOpportunity) setForm(initialFormState);
            setActiveTab('add');
          }}
        >
          {editingOpportunity ? <Edit3 size={16} /> : <Plus size={16} />}
          {editingOpportunity ? 'Edit Opportunity' : 'Post New Opportunity'}
        </button>
      </div>

      {/* ─── TAB 1: EXPLORE OPPORTUNITIES ─── */}
      {activeTab === 'explore' && (
        <div className="funding-tab-pane" id="pane-explore-funding">
          {/* Stats Bar */}
          <div className="funding-stats-grid">
            <div className="funding-stat-card" id="stat-total-funding">
              <div className="stat-icon-wrapper emerald">
                <DollarSign size={20} />
              </div>
              <div className="stat-data">
                <span className="stat-number">{stats.total}</span>
                <span className="stat-label">Total Calls Listed</span>
              </div>
            </div>

            <div className="funding-stat-card" id="stat-active-grants">
              <div className="stat-icon-wrapper blue">
                <FileText size={20} />
              </div>
              <div className="stat-data">
                <span className="stat-number">{stats.grants}</span>
                <span className="stat-label">Research Grants</span>
              </div>
            </div>

            <div className="funding-stat-card" id="stat-fellowships">
              <div className="stat-icon-wrapper purple">
                <Award size={20} />
              </div>
              <div className="stat-data">
                <span className="stat-number">{stats.fellowships}</span>
                <span className="stat-label">Fellowships & Scholarships</span>
              </div>
            </div>

            <div className="funding-stat-card" id="stat-open-calls">
              <div className="stat-icon-wrapper indigo">
                <Sparkles size={20} />
              </div>
              <div className="stat-data">
                <span className="stat-number">{stats.openCount}</span>
                <span className="stat-label">Open for Submission</span>
              </div>
            </div>
          </div>

          {/* Search and Filter Toolbar */}
          <div className="funding-toolbar">
            <form className="funding-search-form" onSubmit={handleSearchSubmit}>
              <div className="funding-search-input-wrap">
                <Search size={16} className="search-icon" />
                <input
                  id="search-funding-input"
                  type="text"
                  placeholder="Search by grant title, funding agency, research domain, or keyword…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="clear-search-btn"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <button id="btn-submit-funding-search" type="submit" className="funding-search-btn">
                <Search size={15} /> Search
              </button>
            </form>

            <div className="funding-dropdowns-row">
              <div className="filter-group">
                <span className="filter-label">Type:</span>
                <select
                  id="filter-funding-type"
                  value={typeFilter}
                  onChange={e => setTypeFilter(e.target.value)}
                  className="funding-select-filter"
                >
                  <option value="All">All Types</option>
                  {FUNDING_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <span className="filter-label">Status:</span>
                <select
                  id="filter-funding-status"
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="funding-select-filter"
                >
                  <option value="All">All Statuses</option>
                  {STATUSES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <span className="filter-label"><ArrowUpDown size={13} /> Sort:</span>
                <select
                  id="filter-funding-sort"
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as any)}
                  className="funding-select-filter"
                >
                  <option value="deadline-asc">Deadline (Soonest First)</option>
                  <option value="deadline-desc">Deadline (Furthest First)</option>
                  <option value="newest">Newest Added</option>
                  <option value="title-asc">Title (A - Z)</option>
                </select>
              </div>

              {(searchQuery || typeFilter !== 'All' || statusFilter !== 'All' || areaFilter !== 'All') && (
                <button
                  type="button"
                  className="funding-reset-btn"
                  onClick={handleResetFilters}
                  title="Reset all filters"
                >
                  Reset Filters
                </button>
              )}
            </div>

            {/* Research Area Quick Filter Chips */}
            <div className="funding-area-chips">
              <span className="chips-label">Research Field:</span>
              <div className="chips-list">
                {RESEARCH_AREAS.map(area => (
                  <button
                    key={area}
                    type="button"
                    className={`area-chip ${areaFilter === area ? 'active' : ''}`}
                    onClick={() => setAreaFilter(area)}
                  >
                    {area}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Opportunities Cards Grid */}
          {loading ? (
            <div className="funding-loading-state">
              <RefreshCw size={26} className="spin-icon" />
              <p>Searching global funding opportunities…</p>
            </div>
          ) : sortedOpportunities.length === 0 ? (
            <div className="funding-empty-state" id="empty-funding-state">
              <DollarSign size={46} />
              <h3>No funding opportunities match your search</h3>
              <p>Try modifying your keyword, selecting a different funding type, or resetting filters.</p>
              <button className="funding-primary-btn" onClick={handleResetFilters} style={{ marginTop: '1rem' }}>
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="funding-cards-grid" id="funding-cards-grid">
              {sortedOpportunities.map(opp => {
                const deadlineMeta = getDeadlineBadge(opp.deadline);
                const isSaved = savedIds.includes(opp.id);
                return (
                  <div
                    key={opp.id}
                    className="funding-card"
                    id={`funding-card-${opp.id}`}
                  >
                    <div className="funding-card-top">
                      <div className="card-top-badges">
                        <span className={`funding-pill ${getFundingBadgeClass(opp.fundingType)}`}>
                          <Award size={12} /> {opp.fundingType}
                        </span>
                        <span className={`funding-status-pill ${getStatusBadgeClass(opp.status)}`}>
                          {opp.status}
                        </span>
                        <span className={`funding-deadline-pill ${deadlineMeta.isUrgent ? 'urgent' : ''} ${deadlineMeta.isPassed ? 'passed' : ''}`}>
                          <Clock size={11} /> {deadlineMeta.text}
                        </span>
                      </div>

                      <button
                        type="button"
                        className={`btn-bookmark-card ${isSaved ? 'saved' : ''}`}
                        title={isSaved ? 'Remove from saved' : 'Save opportunity'}
                        onClick={() => handleToggleBookmark(opp.id)}
                        aria-label="Bookmark opportunity"
                      >
                        <Bookmark size={16} fill={isSaved ? '#2563eb' : 'none'} />
                      </button>
                    </div>

                    <h3
                      className="funding-card-title clickable"
                      onClick={() => handleOpenDetails(opp.id)}
                      title="Click to view full eligibility and requirements"
                    >
                      {opp.title}
                    </h3>

                    <div className="funding-card-provider">
                      <Building2 size={14} className="card-inline-icon" />
                      <span>{opp.provider}</span>
                    </div>

                    {opp.fundingAmount && (
                      <div className="funding-card-amount">
                        <DollarSign size={14} className="amount-pill-icon" />
                        <span className="amount-text">{opp.fundingAmount}</span>
                      </div>
                    )}

                    {opp.researchArea && (
                      <div className="funding-card-area">
                        <Tag size={13} className="card-inline-icon" />
                        <span>{opp.researchArea}</span>
                      </div>
                    )}

                    {opp.description && (
                      <p className="funding-card-snippet">
                        {opp.description.length > 160 ? opp.description.slice(0, 160) + '…' : opp.description}
                      </p>
                    )}

                    {opp.eligibility && (
                      <div className="funding-card-eligibility-preview">
                        <strong>Target:</strong> {opp.eligibility.length > 90 ? opp.eligibility.slice(0, 90) + '…' : opp.eligibility}
                      </div>
                    )}

                    <div className="funding-card-footer">
                      <button
                        id={`btn-view-details-${opp.id}`}
                        type="button"
                        className="btn-view-details"
                        onClick={() => handleOpenDetails(opp.id)}
                      >
                        <Eye size={14} /> View Details
                      </button>

                      {opp.applicationUrl && (
                        <a
                          href={opp.applicationUrl.startsWith('http') ? opp.applicationUrl : `https://${opp.applicationUrl}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-card-apply"
                          title="Open official portal"
                        >
                          Apply <ArrowRight size={13} />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: MY POSTED GRANTS ─── */}
      {activeTab === 'my' && (
        <div className="funding-tab-pane" id="pane-my-funding">
          <div className="my-funding-header">
            <div>
              <h2>My Posted Funding Opportunities</h2>
              <p>Manage funding programs, fellowships, or travel grants published by your research group.</p>
            </div>
            <button
              className="funding-primary-btn"
              onClick={() => {
                setEditingOpportunity(null);
                setForm(initialFormState);
                setActiveTab('add');
              }}
            >
              <Plus size={16} /> Post New Opportunity
            </button>
          </div>

          {loading ? (
            <div className="funding-loading-state">
              <RefreshCw size={26} className="spin-icon" />
              <p>Loading your posted opportunities…</p>
            </div>
          ) : myOpportunities.length === 0 ? (
            <div className="funding-empty-state" id="empty-my-funding-state">
              <Layers size={46} />
              <h3>You haven't posted any funding calls yet</h3>
              <p>Publish grants, scholarships, or research awards to attract high-caliber students and collaborators.</p>
              <button
                className="funding-primary-btn"
                onClick={() => {
                  setEditingOpportunity(null);
                  setForm(initialFormState);
                  setActiveTab('add');
                }}
                style={{ marginTop: '1rem' }}
              >
                <Plus size={16} /> Create Opportunity
              </button>
            </div>
          ) : (
            <div className="funding-cards-grid" id="my-funding-grid">
              {myOpportunities.map(opp => (
                <div key={opp.id} className="funding-card my-opp-card" id={`my-opp-card-${opp.id}`}>
                  <div className="funding-card-top">
                    <div className="card-top-badges">
                      <span className={`funding-pill ${getFundingBadgeClass(opp.fundingType)}`}>
                        <Award size={12} /> {opp.fundingType}
                      </span>
                      <button
                        type="button"
                        className={`funding-status-pill interactive ${getStatusBadgeClass(opp.status)}`}
                        onClick={() => handleToggleStatus(opp.id, opp.status)}
                        title="Click to toggle status"
                      >
                        {opp.status}
                      </button>
                    </div>

                    <div className="card-quick-actions">
                      <button
                        type="button"
                        className="funding-icon-action-btn"
                        title="Edit Opportunity"
                        onClick={() => handleStartEdit(opp)}
                      >
                        <Edit3 size={15} />
                      </button>
                      <button
                        type="button"
                        className="funding-icon-action-btn delete"
                        title="Delete Opportunity"
                        onClick={() => {
                          if (window.confirm(`Delete funding opportunity "${opp.title}"?`)) {
                            handleDeleteOpportunity(opp.id);
                          }
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  <h3
                    className="funding-card-title clickable"
                    onClick={() => handleOpenDetails(opp.id)}
                  >
                    {opp.title}
                  </h3>

                  <div className="funding-card-provider">
                    <Building2 size={14} className="card-inline-icon" />
                    <span>{opp.provider}</span>
                  </div>

                  {opp.fundingAmount && (
                    <div className="funding-card-amount">
                      <DollarSign size={14} className="amount-pill-icon" />
                      <span className="amount-text">{opp.fundingAmount}</span>
                    </div>
                  )}

                  <div className="funding-card-footer">
                    <button
                      type="button"
                      className="btn-view-details"
                      onClick={() => handleOpenDetails(opp.id)}
                    >
                      <Eye size={14} /> Full Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 3: POST / EDIT OPPORTUNITY FORM ─── */}
      {activeTab === 'add' && (
        <div className="funding-tab-pane" id="pane-post-funding">
          <div className="funding-form-container">
            <div className="funding-form-header">
              <h2>{editingOpportunity ? 'Edit Funding Opportunity' : 'Post New Funding Opportunity'}</h2>
              <p>
                Publish comprehensive grant details, eligibility guidelines, and application links for research communities.
              </p>
            </div>

            {formError && (
              <div className="funding-form-error" id="funding-form-error-banner">
                <AlertCircle size={16} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitOpportunity} id="form-manage-funding">
              {/* Title */}
              <div className="form-group">
                <label htmlFor="funding-title">
                  Opportunity Title <span className="required">*</span>
                </label>
                <input
                  id="funding-title"
                  type="text"
                  placeholder="e.g. NSF Graduate Research Fellowship Program (GRFP)"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  required
                />
              </div>

              {/* Provider */}
              <div className="form-group">
                <label htmlFor="funding-provider">
                  Funding Organization / Provider <span className="required">*</span>
                </label>
                <input
                  id="funding-provider"
                  type="text"
                  placeholder="e.g. National Science Foundation, European Commission, Google Research"
                  value={form.provider}
                  onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}
                  required
                />
              </div>

              {/* Grid 2: Type & Status */}
              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="funding-type">Funding Type</label>
                  <select
                    id="funding-type"
                    value={form.fundingType}
                    onChange={e => setForm(f => ({ ...f, fundingType: e.target.value }))}
                  >
                    {FUNDING_TYPES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="funding-status">Program Status</label>
                  <select
                    id="funding-status"
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  >
                    {STATUSES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Grid 2: Amount & Deadline */}
              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="funding-amount">
                    Award Amount / Budget Range
                  </label>
                  <input
                    id="funding-amount"
                    type="text"
                    placeholder="e.g. Up to $50,000 or $37,000/yr + tuition"
                    value={form.fundingAmount}
                    onChange={e => setForm(f => ({ ...f, fundingAmount: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="funding-deadline">
                    Application Deadline
                  </label>
                  <input
                    id="funding-deadline"
                    type="date"
                    value={form.deadline}
                    onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                  />
                  <span className="field-hint">Leave blank if the opportunity has rolling admissions.</span>
                </div>
              </div>

              {/* Research Area */}
              <div className="form-group">
                <label htmlFor="funding-area">
                  Research Discipline / Field
                </label>
                <input
                  id="funding-area"
                  type="text"
                  placeholder="e.g. Artificial Intelligence, Biomedical & Health, Quantum Physics"
                  value={form.researchArea}
                  onChange={e => setForm(f => ({ ...f, researchArea: e.target.value }))}
                />
              </div>

              {/* Application Portal URL */}
              <div className="form-group">
                <label htmlFor="funding-url">
                  Application Portal / Website URL
                </label>
                <input
                  id="funding-url"
                  type="url"
                  placeholder="e.g. https://www.nsfgrfp.org or https://ec.europa.eu/funding"
                  value={form.applicationUrl}
                  onChange={e => setForm(f => ({ ...f, applicationUrl: e.target.value }))}
                />
              </div>

              {/* Description */}
              <div className="form-group">
                <label htmlFor="funding-description">
                  Overview & Scope Description
                </label>
                <textarea
                  id="funding-description"
                  rows={4}
                  placeholder="Detailed background about the funding opportunity, key thematic priorities, and award duration..."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>

              {/* Eligibility */}
              <div className="form-group">
                <label htmlFor="funding-eligibility">
                  Eligibility Criteria
                </label>
                <textarea
                  id="funding-eligibility"
                  rows={3}
                  placeholder="Specify eligible applicant tiers (e.g. PhD candidates, Postdoctoral scholars, Accredited Faculty, International applicants)..."
                  value={form.eligibility}
                  onChange={e => setForm(f => ({ ...f, eligibility: e.target.value }))}
                />
              </div>

              {/* Requirements */}
              <div className="form-group">
                <label htmlFor="funding-requirements">
                  Submission Materials & Requirements
                </label>
                <textarea
                  id="funding-requirements"
                  rows={3}
                  placeholder="List required dossier elements (e.g. Research Proposal (3 pages), Curriculum Vitae, Letters of Recommendation, Budget Justification)..."
                  value={form.requirements}
                  onChange={e => setForm(f => ({ ...f, requirements: e.target.value }))}
                />
              </div>

              {/* Application Instructions */}
              <div className="form-group">
                <label htmlFor="funding-info">
                  Application Instructions & Review Process
                </label>
                <textarea
                  id="funding-info"
                  rows={3}
                  placeholder="Provide guidance on portals, institutional endorsement requirements, selection committees, and review timelines..."
                  value={form.applicationInfo}
                  onChange={e => setForm(f => ({ ...f, applicationInfo: e.target.value }))}
                />
              </div>

              {/* Form Buttons */}
              <div className="funding-form-actions">
                <button
                  id="btn-submit-funding"
                  type="submit"
                  className="funding-primary-btn"
                  disabled={submitting}
                >
                  <Check size={16} />
                  {submitting ? 'Saving Opportunity…' : editingOpportunity ? 'Update Opportunity' : 'Publish Opportunity'}
                </button>

                <button
                  type="button"
                  className="funding-secondary-btn"
                  onClick={() => {
                    setEditingOpportunity(null);
                    setForm(initialFormState);
                    setActiveTab('explore');
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {selectedOpportunity && (
        <FundingDetailsModal
          opportunity={selectedOpportunity}
          isOwner={selectedOpportunity.postedById === currentUserId}
          onClose={() => setSelectedOpportunity(null)}
          onEdit={opp => handleStartEdit(opp)}
          onDelete={handleDeleteOpportunity}
          onStatusToggle={handleToggleStatus}
        />
      )}
    </div>
  );
};

export default FundingOpportunities;
