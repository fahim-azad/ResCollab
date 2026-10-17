import React, { useEffect, useState, useMemo } from 'react';
import {
  DollarSign, Search, Filter, Plus, Calendar, Building2,
  ExternalLink, Clock, FileText, CheckCircle2, AlertCircle,
  Edit3, Trash2, Eye, Shield, RefreshCw, Sparkles, Award,
  Check, X, Tag, ArrowRight, Bookmark, ArrowUpDown, Layers,
  Compass, Share2, LayoutGrid, CheckSquare, UserCheck, AlertTriangle,
  Download, ChevronRight
} from 'lucide-react';
import FundingDetailsModal, { 
  type FundingOpportunityDetail,
  parseRequirements,
  evaluateEligibility 
} from './FundingDetailsModal';
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

const ELIGIBILITY_TIERS = [
  { value: 'All', label: 'All Eligibility Tiers' },
  { value: 'Student', label: 'Students & PhD Candidates' },
  { value: 'Postdoc', label: 'Postdoctoral Scholars' },
  { value: 'Faculty', label: 'Faculty & Early Career' },
  { value: 'Principal Investigator', label: 'Senior PIs & Lab Heads' },
  { value: 'Industry', label: 'Industry & Startups' }
];

const DEADLINE_WINDOWS = [
  { value: 'All', label: 'All Deadlines' },
  { value: 'urgent30', label: 'Closing Soon (≤ 30 Days)' },
  { value: 'urgent60', label: 'Next 60 Days' },
  { value: 'urgent90', label: 'Next 90 Days' },
  { value: 'rolling', label: 'Rolling Admissions / Open' }
];

export const FundingOpportunities: React.FC = () => {
  const token = localStorage.getItem('token') || '';
  const userStr = localStorage.getItem('user');
  const currentUser = userStr ? JSON.parse(userStr) : null;
  const currentUserId = currentUser?.id ?? -1;
  const currentUserRole = currentUser?.role || currentUser?.userType || '';

  // Tabs: 'explore' | 'my' | 'add'
  const [activeTab, setActiveTab] = useState<'explore' | 'my' | 'add'>('explore');

  // View Mode: 'grid' | 'timeline'
  const [viewMode, setViewMode] = useState<'grid' | 'timeline'>('grid');

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
  const [eligibilityFilter, setEligibilityFilter] = useState<string>('All');
  const [deadlineFilter, setDeadlineFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'deadline-asc' | 'deadline-desc' | 'newest' | 'title-asc'>('deadline-asc');

  // State to trigger re-reading checklist progress from localStorage
  const [checklistRefreshKey, setChecklistRefreshKey] = useState<number>(0);

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
  const fetchOpportunities = async (overrides?: {
    search?: string;
    fundingType?: string;
    status?: string;
    researchArea?: string;
    eligibility?: string;
    deadline?: string;
  }) => {
    setLoading(true);
    try {
      const qSearch = overrides?.search !== undefined ? overrides.search : searchQuery;
      const qType = overrides?.fundingType !== undefined ? overrides.fundingType : typeFilter;
      const qStatus = overrides?.status !== undefined ? overrides.status : statusFilter;
      const qArea = overrides?.researchArea !== undefined ? overrides.researchArea : areaFilter;
      const qElig = overrides?.eligibility !== undefined ? overrides.eligibility : eligibilityFilter;
      const qDeadline = overrides?.deadline !== undefined ? overrides.deadline : deadlineFilter;

      const params = new URLSearchParams();
      if (qSearch.trim()) params.set('search', qSearch.trim());
      if (qType !== 'All') params.set('fundingType', qType);
      if (qStatus !== 'All') params.set('status', qStatus);
      if (qArea !== 'All') params.set('researchArea', qArea);
      if (qElig !== 'All') params.set('eligibility', qElig);
      if (qDeadline === 'urgent30') params.set('deadlineDays', '30');
      else if (qDeadline === 'urgent60') params.set('deadlineDays', '60');
      else if (qDeadline === 'urgent90') params.set('deadlineDays', '90');
      else if (qDeadline === 'rolling') params.set('isRolling', 'true');

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
  }, [activeTab, typeFilter, statusFilter, areaFilter, eligibilityFilter, deadlineFilter]);

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

  // Clear Search
  const handleClearSearch = () => {
    setSearchQuery('');
    fetchOpportunities({ search: '' });
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setTypeFilter('All');
    setStatusFilter('All');
    setAreaFilter('All');
    setEligibilityFilter('All');
    setDeadlineFilter('All');
    fetchOpportunities({
      search: '',
      fundingType: 'All',
      status: 'All',
      researchArea: 'All',
      eligibility: 'All',
      deadline: 'All'
    });
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

  // Helper for reading checklist progress from localStorage
  const getCheckedRequirementsCount = (oppId: number): number => {
    try {
      const stored = localStorage.getItem(`funding_reqs_checklist_${oppId}`);
      return stored ? JSON.parse(stored).length : 0;
    } catch {
      return 0;
    }
  };

  // Google Calendar link generator
  const getGoogleCalendarUrl = (opp: FundingOpportunityDetail) => {
    if (!opp.deadline) return '';
    const d = new Date(opp.deadline);
    const dateStr = d.toISOString().replace(/-|:|\.\d\d\d/g, '').slice(0, 15) + 'Z';
    const title = `Grant Deadline: ${opp.title}`;
    const details = `${opp.provider}\nAmount: ${opp.fundingAmount || 'N/A'}\nApply: ${opp.applicationUrl || ''}`;
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${dateStr}/${dateStr}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(opp.applicationUrl || '')}`;
  };

  // Download .ics for an opportunity
  const handleDownloadIcs = (opp: FundingOpportunityDetail) => {
    if (!opp.deadline) return;
    const d = new Date(opp.deadline);
    const dateStr = d.toISOString().replace(/-|:|\.\d\d\d/g, '').slice(0, 15) + 'Z';
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//ResCollab//Funding Deadlines//EN',
      'BEGIN:VEVENT',
      `UID:rescollab-funding-${opp.id}@rescollab.org`,
      `DTSTAMP:${dateStr}`,
      `DTSTART:${dateStr}`,
      `DTEND:${dateStr}`,
      `SUMMARY:Deadline: ${opp.title}`,
      `DESCRIPTION:${opp.provider} - Funding Deadline\\nAmount: ${opp.fundingAmount || 'N/A'}\\nDetails: ${opp.applicationUrl || ''}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Funding_Deadline_${opp.id}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Format date for timeline view
  const formatTimelineDate = (deadlineStr?: string | null) => {
    if (!deadlineStr) return { month: 'ROLL', day: '∞', full: 'Rolling / Open' };
    const d = new Date(deadlineStr);
    const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    const day = d.getDate().toString().padStart(2, '0');
    const full = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return { month, day, full };
  };

  // Chronologically partitioned timeline groups
  const timelineGroups = useMemo(() => {
    const urgent30: FundingOpportunityDetail[] = [];
    const next60: FundingOpportunityDetail[] = [];
    const later: FundingOpportunityDetail[] = [];
    const rolling: FundingOpportunityDetail[] = [];
    const past: FundingOpportunityDetail[] = [];

    const now = new Date().getTime();

    sortedOpportunities.forEach(opp => {
      if (!opp.deadline) {
        rolling.push(opp);
        return;
      }
      const d = new Date(opp.deadline).getTime();
      const diffDays = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) {
        past.push(opp);
      } else if (diffDays <= 30) {
        urgent30.push(opp);
      } else if (diffDays <= 60) {
        next60.push(opp);
      } else {
        later.push(opp);
      }
    });

    return [
      { id: 'urgent30', title: 'Closing Soon (Due within 30 Days)', count: urgent30.length, items: urgent30, urgency: 'urgent', icon: Clock },
      { id: 'next60', title: 'Upcoming Deadlines (31 – 60 Days)', count: next60.length, items: next60, urgency: 'upcoming', icon: Calendar },
      { id: 'later', title: 'Future Windows (60+ Days Ahead)', count: later.length, items: later, urgency: 'future', icon: Calendar },
      { id: 'rolling', title: 'Continuous & Rolling Submissions', count: rolling.length, items: rolling, urgency: 'rolling', icon: Sparkles },
      { id: 'past', title: 'Past Deadlines / Archived Calls', count: past.length, items: past, urgency: 'past', icon: AlertCircle }
    ].filter(g => g.count > 0);
  }, [sortedOpportunities]);

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
                    onClick={handleClearSearch}
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
                <span className="filter-label"><UserCheck size={13} /> Eligibility:</span>
                <select
                  id="filter-funding-eligibility"
                  value={eligibilityFilter}
                  onChange={e => setEligibilityFilter(e.target.value)}
                  className="funding-select-filter"
                >
                  {ELIGIBILITY_TIERS.map(tier => (
                    <option key={tier.value} value={tier.value}>{tier.label}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <span className="filter-label"><Clock size={13} /> Deadline:</span>
                <select
                  id="filter-funding-deadline"
                  value={deadlineFilter}
                  onChange={e => setDeadlineFilter(e.target.value)}
                  className="funding-select-filter"
                >
                  {DEADLINE_WINDOWS.map(win => (
                    <option key={win.value} value={win.value}>{win.label}</option>
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

              {(searchQuery || typeFilter !== 'All' || statusFilter !== 'All' || areaFilter !== 'All' || eligibilityFilter !== 'All' || deadlineFilter !== 'All') && (
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

            {/* Active Filters Summary Pills */}
            {(searchQuery || typeFilter !== 'All' || statusFilter !== 'All' || areaFilter !== 'All' || eligibilityFilter !== 'All' || deadlineFilter !== 'All') && (
              <div className="funding-active-filters-bar" id="funding-active-filters-bar">
                <span className="active-filters-title">Active Filters:</span>
                <div className="active-filter-tags">
                  {searchQuery && (
                    <span className="filter-pill-tag">
                      Keyword: "{searchQuery}"
                      <button type="button" onClick={handleClearSearch} aria-label="Remove search filter">
                        <X size={12} />
                      </button>
                    </span>
                  )}
                  {typeFilter !== 'All' && (
                    <span className="filter-pill-tag">
                      Type: {typeFilter}
                      <button type="button" onClick={() => setTypeFilter('All')} aria-label="Remove type filter">
                        <X size={12} />
                      </button>
                    </span>
                  )}
                  {statusFilter !== 'All' && (
                    <span className="filter-pill-tag">
                      Status: {statusFilter}
                      <button type="button" onClick={() => setStatusFilter('All')} aria-label="Remove status filter">
                        <X size={12} />
                      </button>
                    </span>
                  )}
                  {areaFilter !== 'All' && (
                    <span className="filter-pill-tag">
                      Field: {areaFilter}
                      <button type="button" onClick={() => setAreaFilter('All')} aria-label="Remove area filter">
                        <X size={12} />
                      </button>
                    </span>
                  )}
                  {eligibilityFilter !== 'All' && (
                    <span className="filter-pill-tag">
                      Eligibility: {ELIGIBILITY_TIERS.find(e => e.value === eligibilityFilter)?.label || eligibilityFilter}
                      <button type="button" onClick={() => setEligibilityFilter('All')} aria-label="Remove eligibility filter">
                        <X size={12} />
                      </button>
                    </span>
                  )}
                  {deadlineFilter !== 'All' && (
                    <span className="filter-pill-tag">
                      Deadline: {DEADLINE_WINDOWS.find(d => d.value === deadlineFilter)?.label || deadlineFilter}
                      <button type="button" onClick={() => setDeadlineFilter('All')} aria-label="Remove deadline filter">
                        <X size={12} />
                      </button>
                    </span>
                  )}
                  <button
                    type="button"
                    className="btn-clear-all-filters"
                    onClick={handleResetFilters}
                  >
                    Clear All
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* View Mode Switcher Header */}
          <div className="funding-view-controls">
            <span className="results-count-text">
              Showing <strong>{sortedOpportunities.length}</strong> opportunities
            </span>
            <div className="funding-view-toggle">
              <button
                type="button"
                className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                id="btn-view-mode-grid"
                title="Cards Grid View"
              >
                <LayoutGrid size={15} /> Grid View
              </button>
              <button
                type="button"
                className={`view-toggle-btn ${viewMode === 'timeline' ? 'active' : ''}`}
                onClick={() => setViewMode('timeline')}
                id="btn-view-mode-timeline"
                title="Deadline Timeline & Calendar View"
              >
                <Calendar size={15} /> Deadline Timeline
              </button>
            </div>
          </div>

          {/* Opportunities Main Content View */}
          {loading ? (
            <div className="funding-loading-state">
              <RefreshCw size={26} className="spin-icon" />
              <p>Searching global funding opportunities…</p>
            </div>
          ) : sortedOpportunities.length === 0 ? (
            <div className="funding-empty-state" id="empty-funding-state">
              <DollarSign size={46} />
              <h3>No funding opportunities match your filters</h3>
              <p>Try modifying your criteria, broadening the eligibility tier, or clearing deadline windows.</p>
              <button className="funding-primary-btn" onClick={handleResetFilters} style={{ marginTop: '1rem' }}>
                Clear Filters
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="funding-cards-grid" id="funding-cards-grid">
              {sortedOpportunities.map(opp => {
                const deadlineMeta = getDeadlineBadge(opp.deadline);
                const isSaved = savedIds.includes(opp.id);
                const eligibilityEval = evaluateEligibility(currentUserRole, opp.eligibility);
                const reqList = parseRequirements(opp.requirements);
                const checkedCount = getCheckedRequirementsCount(opp.id);

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

                    {/* Eligibility Compatibility Badge */}
                    {opp.eligibility && (
                      <div className={`funding-card-eligibility-badge ${eligibilityEval.type}`}>
                        {eligibilityEval.match === true ? (
                          <Shield size={12} className="badge-icon" />
                        ) : eligibilityEval.match === false ? (
                          <AlertTriangle size={12} className="badge-icon" />
                        ) : (
                          <UserCheck size={12} className="badge-icon" />
                        )}
                        <span>{eligibilityEval.text}</span>
                      </div>
                    )}

                    {/* Requirements Progress Badge */}
                    {reqList.length > 0 && (
                      <div className="funding-card-reqs-badge">
                        <CheckSquare size={12} className="badge-icon" />
                        <span>
                          {checkedCount > 0
                            ? `Dossier: ${checkedCount}/${reqList.length} ready (${Math.round((checkedCount / reqList.length) * 100)}%)`
                            : `${reqList.length} application requirements`}
                        </span>
                      </div>
                    )}

                    {opp.description && (
                      <p className="funding-card-snippet">
                        {opp.description.length > 150 ? opp.description.slice(0, 150) + '…' : opp.description}
                      </p>
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
          ) : (
            /* Deadline Timeline View */
            <div className="funding-timeline-view" id="funding-timeline-view">
              {timelineGroups.length === 0 ? (
                <div className="funding-empty-state">
                  <Clock size={40} />
                  <h3>No opportunities found for this deadline window</h3>
                  <p>Try switching to "All Deadlines" or clearing active filters.</p>
                </div>
              ) : (
                timelineGroups.map(group => (
                  <div key={group.id} className={`timeline-section ${group.urgency}`} id={`timeline-section-${group.id}`}>
                    <div className="timeline-section-header">
                      <div className="section-title-wrap">
                        <group.icon size={17} className="section-icon" />
                        <h4>{group.title}</h4>
                        <span className="section-count-badge">{group.count} calls</span>
                      </div>
                    </div>
                    <div className="timeline-items-list">
                      {group.items.map(opp => {
                        const deadlineMeta = getDeadlineBadge(opp.deadline);
                        const dateMeta = formatTimelineDate(opp.deadline);
                        const eligibilityEval = evaluateEligibility(currentUserRole, opp.eligibility);
                        const reqList = parseRequirements(opp.requirements);
                        const checkedCount = getCheckedRequirementsCount(opp.id);

                        return (
                          <div key={opp.id} className="timeline-item-card" id={`timeline-item-${opp.id}`}>
                            <div className="timeline-date-col">
                              <div className={`date-badge-box ${deadlineMeta.isUrgent ? 'urgent' : ''} ${deadlineMeta.isPassed ? 'passed' : ''}`}>
                                <span className="date-month">{dateMeta.month}</span>
                                <span className="date-day">{dateMeta.day}</span>
                              </div>
                              <span className={`date-countdown-tag ${deadlineMeta.isUrgent ? 'urgent' : ''} ${deadlineMeta.isPassed ? 'passed' : ''}`}>
                                <Clock size={11} /> {deadlineMeta.text}
                              </span>
                            </div>

                            <div className="timeline-content-col">
                              <div className="timeline-content-top">
                                <span className={`funding-pill ${getFundingBadgeClass(opp.fundingType)}`}>
                                  <Award size={11} /> {opp.fundingType}
                                </span>
                                <span className={`funding-status-pill ${getStatusBadgeClass(opp.status)}`}>
                                  {opp.status}
                                </span>
                                {opp.fundingAmount && (
                                  <span className="timeline-amount-pill">
                                    <DollarSign size={12} /> {opp.fundingAmount}
                                  </span>
                                )}
                                {opp.researchArea && (
                                  <span className="timeline-area-pill">
                                    <Tag size={11} /> {opp.researchArea}
                                  </span>
                                )}
                              </div>

                              <h3 
                                className="timeline-item-title clickable"
                                onClick={() => handleOpenDetails(opp.id)}
                              >
                                {opp.title}
                              </h3>

                              <div className="timeline-item-provider">
                                <Building2 size={13} /> {opp.provider}
                              </div>

                              <div className="timeline-metadata-row">
                                {opp.eligibility && (
                                  <div className={`funding-card-eligibility-badge mini ${eligibilityEval.type}`}>
                                    {eligibilityEval.match === true ? (
                                      <Shield size={11} />
                                    ) : eligibilityEval.match === false ? (
                                      <AlertTriangle size={11} />
                                    ) : (
                                      <UserCheck size={11} />
                                    )}
                                    <span>{eligibilityEval.text}</span>
                                  </div>
                                )}

                                {reqList.length > 0 && (
                                  <div className="funding-card-reqs-badge mini">
                                    <CheckSquare size={11} />
                                    <span>
                                      {checkedCount > 0
                                        ? `Dossier: ${checkedCount}/${reqList.length} ready (${Math.round((checkedCount / reqList.length) * 100)}%)`
                                        : `${reqList.length} dossier requirements`}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="timeline-actions-col">
                              <button
                                type="button"
                                className="btn-view-details"
                                onClick={() => handleOpenDetails(opp.id)}
                                title="View detailed eligibility and checklist"
                              >
                                <Eye size={13} /> Details
                              </button>

                              {opp.deadline && (
                                <>
                                  <a
                                    href={getGoogleCalendarUrl(opp)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn-calendar-quick"
                                    title="Add to Google Calendar"
                                  >
                                    <Calendar size={13} /> Calendar
                                  </a>
                                  <button
                                    type="button"
                                    className="btn-calendar-quick"
                                    onClick={() => handleDownloadIcs(opp)}
                                    title="Download iCal (.ics)"
                                  >
                                    <Download size={13} /> .ics
                                  </button>
                                </>
                              )}

                              {opp.applicationUrl && (
                                <a
                                  href={opp.applicationUrl.startsWith('http') ? opp.applicationUrl : `https://${opp.applicationUrl}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn-card-apply"
                                  title="Open official portal"
                                >
                                  Apply <ArrowRight size={12} />
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
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

            <form onSubmit={handleSubmitOpportunity} id="form-manage-funding" noValidate>
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
          userRole={currentUserRole}
          onClose={() => {
            setSelectedOpportunity(null);
            setChecklistRefreshKey(k => k + 1);
          }}
          onEdit={opp => handleStartEdit(opp)}
          onDelete={handleDeleteOpportunity}
          onStatusToggle={handleToggleStatus}
        />
      )}
    </div>
  );
};

export default FundingOpportunities;
