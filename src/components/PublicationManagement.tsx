import React, { useEffect, useState, useMemo } from 'react';
import {
  BookOpen, Plus, Search, Globe, Lock,
  ExternalLink, Calendar, Users, FileText, CheckCircle2,
  AlertCircle, Edit3, Trash2, Eye, RefreshCw,
  Sparkles, Award, Check, X, Link as LinkIcon,
  ArrowUpDown, Copy
} from 'lucide-react';
import PublicationDetailsModal, { 
  type PublicationDetail, 
  detectLinkProvider 
} from './PublicationDetailsModal';
import './PublicationManagement.css';

const API = 'http://localhost:5000/api';

const PUBLICATION_TYPES = ['Journal', 'Conference', 'Book', 'Thesis', 'Preprint', 'Other'];

const POPULAR_VENUES = [
  'IEEE Transactions on Software Engineering',
  'ACM SIGKDD Conference',
  'NeurIPS',
  'ICSE',
  'Nature',
  'Science',
  'arXiv Preprint'
];

export const normalizeDoi = (raw?: string | null): string => {
  if (!raw) return '';
  return raw
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    .replace(/^doi:/i, '')
    .trim()
    .replace(/^\/+|\/+$/g, '');
};

export const normalizeUrl = (u?: string | null): string => {
  if (!u) return '';
  const trimmed = u.trim();
  if (!trimmed) return '';
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
};

export const PublicationManagement: React.FC = () => {
  const token = localStorage.getItem('token') || '';
  const userStr = localStorage.getItem('user');
  const currentUser = userStr ? JSON.parse(userStr) : null;
  const currentUserId = currentUser?.id ?? -1;

  // Tabs: 'my' | 'explore' | 'add'
  const [activeTab, setActiveTab] = useState<'my' | 'explore' | 'add'>('my');

  // Publications state
  const [myPublications, setMyPublications] = useState<PublicationDetail[]>([]);
  const [publicPublications, setPublicPublications] = useState<PublicationDetail[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filters for Explore tab
  const [exploreSearch, setExploreSearch] = useState<string>('');
  const [exploreType, setExploreType] = useState<string>('All');
  const [exploreYear, setExploreYear] = useState<string>('');

  // Filters and Sorting for My Publications tab
  const [mySearch, setMySearch] = useState<string>('');
  const [myTypeFilter, setMyTypeFilter] = useState<string>('All');
  const [myYearFilter, setMyYearFilter] = useState<string>('All');
  const [mySortBy, setMySortBy] = useState<'year-desc' | 'year-asc' | 'title-asc'>('year-desc');

  // Modals state
  const [viewPublication, setViewPublication] = useState<PublicationDetail | null>(null);
  const [editingPublication, setEditingPublication] = useState<PublicationDetail | null>(null);

  // Copy feedback state
  const [copiedDoiId, setCopiedDoiId] = useState<number | null>(null);

  // Form state (used for Add and Edit)
  const initialFormState = {
    title: '',
    authors: '',
    doi: '',
    journalOrConference: '',
    publicationYear: new Date().getFullYear(),
    abstract: '',
    sourceLink: '',
    publicationType: 'Journal',
    visibility: 'Public'
  };
  const [form, setForm] = useState(initialFormState);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [fetchingDoiMetadata, setFetchingDoiMetadata] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch My Publications
  const fetchMyPublications = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/publication/my`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        const data = await res.json();
        setMyPublications(data);
      }
    } catch (err) {
      console.error('Error fetching my publications:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Public Publications (Explore)
  const fetchPublicPublications = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (exploreSearch.trim()) params.set('search', exploreSearch.trim());
      if (exploreType && exploreType !== 'All') params.set('publicationType', exploreType);
      if (exploreYear.trim()) params.set('year', exploreYear.trim());

      const res = await fetch(`${API}/publication?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        const data = await res.json();
        setPublicPublications(data);
      }
    } catch (err) {
      console.error('Error exploring publications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'my') {
      fetchMyPublications();
    } else if (activeTab === 'explore') {
      fetchPublicPublications();
    }
  }, [activeTab]);

  // Handle Explore Search Form Submit
  const handleExploreSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPublicPublications();
  };

  // Reset Explore filters
  const handleResetFilters = () => {
    setExploreSearch('');
    setExploreType('All');
    setExploreYear('');
    setTimeout(() => {
      fetchPublicPublications();
    }, 0);
  };

  // Open Full Details View
  const handleOpenDetails = async (id: number) => {
    try {
      const res = await fetch(`${API}/publication/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        const detail = await res.json();
        setViewPublication(detail);
      } else {
        alert('Could not load publication details.');
      }
    } catch (err) {
      console.error('Error fetching publication details:', err);
    }
  };

  // Open Edit Form
  const handleStartEdit = (pub: PublicationDetail) => {
    setEditingPublication(pub);
    setForm({
      title: pub.title,
      authors: pub.authors,
      doi: pub.doi || '',
      journalOrConference: pub.journalOrConference || '',
      publicationYear: pub.publicationYear,
      abstract: pub.abstract || '',
      sourceLink: pub.sourceLink || '',
      publicationType: pub.publicationType,
      visibility: pub.visibility
    });
    setFormError(null);
  };

  // Auto-fetch publication metadata from CrossRef API
  const handleFetchDoiMetadata = async () => {
    const clean = normalizeDoi(form.doi);
    if (!clean || !clean.startsWith('10.') || !clean.includes('/')) {
      setFormError("Please enter a valid DOI (e.g. 10.1109/TSE.2024.1234567 or doi.org URL) before auto-fetching.");
      return;
    }

    setFetchingDoiMetadata(true);
    setFormError(null);
    try {
      const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(clean)}`);
      if (!res.ok) {
        throw new Error(`CrossRef lookup returned status ${res.status}`);
      }
      const json = await res.json();
      const item = json.message;
      if (item) {
        const title = Array.isArray(item.title) ? item.title[0] : (item.title || '');
        const authors = Array.isArray(item.author)
          ? item.author
              .map((a: any) => [a.given, a.family].filter(Boolean).join(' '))
              .filter(Boolean)
              .join(', ')
          : '';
        const venue = Array.isArray(item['container-title'])
          ? item['container-title'][0]
          : (item['container-title'] || '');
        
        const year =
          item['published-print']?.['date-parts']?.[0]?.[0] ||
          item['published-online']?.['date-parts']?.[0]?.[0] ||
          item.issued?.['date-parts']?.[0]?.[0] ||
          form.publicationYear;

        let type = 'Journal';
        if (item.type === 'proceedings-article') type = 'Conference';
        else if (item.type === 'book-chapter' || item.type === 'book') type = 'Book';
        else if (item.type === 'posted-content') type = 'Preprint';
        else if (item.type === 'dissertation') type = 'Thesis';

        const url = item.resource?.primary?.url || item.URL || (clean ? `https://doi.org/${clean}` : '');
        const abstractText = item.abstract ? item.abstract.replace(/<[^>]+>/g, '').trim() : '';

        setForm(prev => ({
          ...prev,
          doi: clean,
          title: title || prev.title,
          authors: authors || prev.authors,
          journalOrConference: venue || prev.journalOrConference,
          publicationYear: Number(year) || prev.publicationYear,
          publicationType: type,
          sourceLink: url || prev.sourceLink,
          abstract: abstractText || prev.abstract
        }));

        setFeedbackMsg({
          type: 'success',
          text: `Metadata imported from CrossRef: "${title ? (title.length > 50 ? title.slice(0, 50) + '…' : title) : clean}"`
        });
        setTimeout(() => setFeedbackMsg(null), 4500);
      }
    } catch {
      setFormError('Could not auto-fetch metadata for this DOI. You can enter or adjust the bibliographic details manually.');
    } finally {
      setFetchingDoiMetadata(false);
    }
  };

  // Handle Save (Add or Update)
  const handleSubmitPublication = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanDoi = normalizeDoi(form.doi);
    const cleanSource = normalizeUrl(form.sourceLink);

    // Client-side quick checks
    if (!form.title.trim()) {
      setFormError('Title is required.');
      return;
    }
    if (!form.authors.trim()) {
      setFormError('Authors field is required.');
      return;
    }
    const currentYear = new Date().getFullYear();
    if (form.publicationYear < 1900 || form.publicationYear > currentYear + 1) {
      setFormError(`Publication year must be between 1900 and ${currentYear + 1}.`);
      return;
    }
    if (!cleanDoi && !form.journalOrConference.trim() && !cleanSource) {
      setFormError('At least one of DOI, Journal/Conference, or Source Link must be provided.');
      return;
    }
    if (cleanDoi && (!cleanDoi.startsWith('10.') || !cleanDoi.includes('/'))) {
      setFormError("DOI format appears invalid. Standard DOIs begin with '10.' followed by a registrant code (e.g. 10.1109/TSE.2024.1234567).");
      return;
    }

    setSubmitting(true);
    try {
      const isEditing = editingPublication !== null;
      const url = isEditing
        ? `${API}/publication/${editingPublication.id}`
        : `${API}/publication`;
      const method = isEditing ? 'PUT' : 'POST';

      const payload = {
        title: form.title.trim(),
        authors: form.authors.trim(),
        doi: cleanDoi || null,
        journalOrConference: form.journalOrConference.trim() || null,
        publicationYear: Number(form.publicationYear),
        abstract: form.abstract.trim() || null,
        sourceLink: cleanSource || null,
        publicationType: form.publicationType,
        visibility: form.visibility
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
            ? 'Publication updated successfully!'
            : 'Publication added to your academic portfolio!'
        });
        setTimeout(() => setFeedbackMsg(null), 4000);
        setForm(initialFormState);
        setEditingPublication(null);
        setActiveTab('my');
        fetchMyPublications();
      } else {
        const errorText = await res.text();
        setFormError(errorText || 'Failed to save publication. Please check fields.');
      }
    } catch {
      setFormError('Network error occurred. Please check your connection.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete
  const handleDeletePublication = async (id: number) => {
    try {
      const res = await fetch(`${API}/publication/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        setFeedbackMsg({ type: 'success', text: 'Publication deleted successfully.' });
        setTimeout(() => setFeedbackMsg(null), 3500);
        setMyPublications(prev => prev.filter(p => p.id !== id));
      } else {
        const err = await res.text();
        alert(`Failed to delete publication: ${err}`);
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  // Handle Visibility Toggle
  const handleToggleVisibility = async (id: number, currentVis: string) => {
    const newVis = currentVis === 'Public' ? 'Private' : 'Public';
    try {
      const res = await fetch(`${API}/publication/${id}/visibility`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newVis)
      });
      if (res.ok) {
        setMyPublications(prev => prev.map(p => p.id === id ? { ...p, visibility: newVis } : p));
        if (viewPublication && viewPublication.id === id) {
          setViewPublication({ ...viewPublication, visibility: newVis });
        }
      }
    } catch (err) {
      console.error('Visibility update error:', err);
    }
  };

  // Copy DOI to clipboard helper
  const handleCopyDoi = (pubId: number, doi: string) => {
    const clean = normalizeDoi(doi);
    navigator.clipboard.writeText(clean);
    setCopiedDoiId(pubId);
    setTimeout(() => setCopiedDoiId(null), 2000);
  };

  // Available Years for filter dropdown
  const availableYears = useMemo(() => {
    const years = Array.from(new Set(myPublications.map(p => p.publicationYear)));
    return years.sort((a, b) => b - a);
  }, [myPublications]);

  // Filtered and Sorted My Publications
  const filteredMyPublications = useMemo(() => {
    return myPublications
      .filter(p => {
        const matchSearch = !mySearch.trim() ||
          p.title.toLowerCase().includes(mySearch.toLowerCase()) ||
          p.authors.toLowerCase().includes(mySearch.toLowerCase()) ||
          (p.doi && p.doi.toLowerCase().includes(mySearch.toLowerCase())) ||
          (p.journalOrConference && p.journalOrConference.toLowerCase().includes(mySearch.toLowerCase()));
        const matchType = myTypeFilter === 'All' || p.publicationType === myTypeFilter;
        const matchYear = myYearFilter === 'All' || p.publicationYear.toString() === myYearFilter;
        return matchSearch && matchType && matchYear;
      })
      .sort((a, b) => {
        if (mySortBy === 'year-desc') return b.publicationYear - a.publicationYear;
        if (mySortBy === 'year-asc') return a.publicationYear - b.publicationYear;
        if (mySortBy === 'title-asc') return a.title.localeCompare(b.title);
        return 0;
      });
  }, [myPublications, mySearch, myTypeFilter, myYearFilter, mySortBy]);

  // Statistics calculation for My Publications
  const stats = useMemo(() => {
    const total = myPublications.length;
    const journals = myPublications.filter(p => p.publicationType === 'Journal').length;
    const conferences = myPublications.filter(p => p.publicationType === 'Conference').length;
    const withDoi = myPublications.filter(p => Boolean(p.doi)).length;
    const publicCount = myPublications.filter(p => p.visibility === 'Public').length;
    return { total, journals, conferences, withDoi, publicCount };
  }, [myPublications]);

  const getBadgeColorClass = (type: string) => {
    switch (type.toLowerCase()) {
      case 'journal': return 'pub-type-journal';
      case 'conference': return 'pub-type-conference';
      case 'book': return 'pub-type-book';
      case 'thesis': return 'pub-type-thesis';
      case 'preprint': return 'pub-type-preprint';
      default: return 'pub-type-other';
    }
  };

  const previewCleanDoi = normalizeDoi(form.doi);

  return (
    <div className="pub-container" id="publication-management-page">
      {/* Top Header */}
      <div className="pub-header">
        <div className="pub-header-content">
          <div className="pub-header-badge">
            <BookOpen size={15} /> Academic Publications
          </div>
          <h1>Publication Management & Discovery</h1>
          <p>
            Catalog, publish, and explore peer-reviewed journal papers, conference proceedings, books, and preprints across academic institutions.
          </p>
        </div>
        <div className="pub-header-actions">
          <button
            id="btn-header-add-publication"
            className="pub-primary-btn"
            onClick={() => {
              setEditingPublication(null);
              setForm(initialFormState);
              setActiveTab('add');
            }}
          >
            <Plus size={16} /> Add Publication
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {feedbackMsg && (
        <div
          className={`pub-feedback-alert ${feedbackMsg.type}`}
          id="pub-global-feedback-alert"
        >
          {feedbackMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="pub-tabs" role="tablist">
        <button
          id="tab-my-publications"
          role="tab"
          aria-selected={activeTab === 'my'}
          className={`pub-tab-btn ${activeTab === 'my' ? 'active' : ''}`}
          onClick={() => {
            setEditingPublication(null);
            setActiveTab('my');
          }}
        >
          <Award size={16} /> My Publications ({myPublications.length})
        </button>

        <button
          id="tab-explore-publications"
          role="tab"
          aria-selected={activeTab === 'explore'}
          className={`pub-tab-btn ${activeTab === 'explore' ? 'active' : ''}`}
          onClick={() => {
            setEditingPublication(null);
            setActiveTab('explore');
          }}
        >
          <Globe size={16} /> Explore Publications
        </button>

        <button
          id="tab-add-publication"
          role="tab"
          aria-selected={activeTab === 'add'}
          className={`pub-tab-btn ${activeTab === 'add' ? 'active' : ''}`}
          onClick={() => {
            if (!editingPublication) setForm(initialFormState);
            setActiveTab('add');
          }}
        >
          {editingPublication ? <Edit3 size={16} /> : <Plus size={16} />}
          {editingPublication ? 'Edit Publication' : 'Add New Publication'}
        </button>
      </div>

      {/* ─── TAB 1: MY PUBLICATIONS ─── */}
      {activeTab === 'my' && (
        <div className="pub-tab-pane" id="pane-my-publications">
          {/* Quick Stats Grid */}
          <div className="pub-stats-grid">
            <div className="pub-stat-card" id="stat-total-publications">
              <div className="stat-icon-wrapper blue">
                <BookOpen size={20} />
              </div>
              <div className="stat-data">
                <span className="stat-number">{stats.total}</span>
                <span className="stat-label">Total Publications</span>
              </div>
            </div>

            <div className="pub-stat-card" id="stat-journal-papers">
              <div className="stat-icon-wrapper indigo">
                <FileText size={20} />
              </div>
              <div className="stat-data">
                <span className="stat-number">{stats.journals}</span>
                <span className="stat-label">Journal Articles</span>
              </div>
            </div>

            <div className="pub-stat-card" id="stat-conference-proceedings">
              <div className="stat-icon-wrapper purple">
                <Users size={20} />
              </div>
              <div className="stat-data">
                <span className="stat-number">{stats.conferences}</span>
                <span className="stat-label">Conferences</span>
              </div>
            </div>

            <div className="pub-stat-card" id="stat-doi-registered">
              <div className="stat-icon-wrapper emerald">
                <Sparkles size={20} />
              </div>
              <div className="stat-data">
                <span className="stat-number">{stats.withDoi}</span>
                <span className="stat-label">Verified DOIs</span>
              </div>
            </div>
          </div>

          {/* Filter Bar for My Publications */}
          <div className="pub-filter-toolbar">
            <div className="search-input-wrapper">
              <Search size={16} className="search-icon" />
              <input
                id="search-my-publications"
                type="text"
                placeholder="Search your publications by title, author, venue, or DOI…"
                value={mySearch}
                onChange={e => setMySearch(e.target.value)}
              />
              {mySearch && (
                <button
                  type="button"
                  className="clear-search-btn"
                  onClick={() => setMySearch('')}
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="toolbar-dropdowns">
              <div className="type-filter-group">
                <span className="filter-label">Type:</span>
                <select
                  id="filter-my-type"
                  value={myTypeFilter}
                  onChange={e => setMyTypeFilter(e.target.value)}
                  className="pub-select-filter"
                >
                  <option value="All">All Types</option>
                  {PUBLICATION_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {availableYears.length > 0 && (
                <div className="type-filter-group">
                  <span className="filter-label">Year:</span>
                  <select
                    id="filter-my-year"
                    value={myYearFilter}
                    onChange={e => setMyYearFilter(e.target.value)}
                    className="pub-select-filter"
                  >
                    <option value="All">All Years</option>
                    {availableYears.map(y => (
                      <option key={y} value={y.toString()}>{y}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="type-filter-group">
                <span className="filter-label"><ArrowUpDown size={13} /> Sort:</span>
                <select
                  id="filter-my-sort"
                  value={mySortBy}
                  onChange={e => setMySortBy(e.target.value as any)}
                  className="pub-select-filter"
                >
                  <option value="year-desc">Year (Newest First)</option>
                  <option value="year-asc">Year (Oldest First)</option>
                  <option value="title-asc">Title (A - Z)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Publications List */}
          {loading ? (
            <div className="pub-loading-state">
              <RefreshCw size={24} className="spin-icon" />
              <p>Loading your publication records…</p>
            </div>
          ) : filteredMyPublications.length === 0 ? (
            <div className="pub-empty-state" id="empty-my-publications">
              <BookOpen size={44} />
              <h3>No publications found</h3>
              <p>
                {myPublications.length === 0
                  ? "You haven't cataloged any publications yet. Add your research papers to showcase your academic credentials."
                  : 'No publications matched your current filter criteria.'}
              </p>
              {myPublications.length === 0 && (
                <button
                  className="pub-primary-btn"
                  onClick={() => {
                    setEditingPublication(null);
                    setForm(initialFormState);
                    setActiveTab('add');
                  }}
                  style={{ marginTop: '1rem' }}
                >
                  <Plus size={16} /> Add Your First Publication
                </button>
              )}
            </div>
          ) : (
            <div className="pub-cards-list" id="my-publications-grid">
              {filteredMyPublications.map(pub => {
                const cleanDoiVal = normalizeDoi(pub.doi);
                const linkProvider = detectLinkProvider(pub.sourceLink);
                return (
                  <div
                    key={pub.id}
                    className="pub-card"
                    id={`my-pub-card-${pub.id}`}
                  >
                    <div className="pub-card-top">
                      <div className="pub-card-badges">
                        <span className={`pub-type-badge ${getBadgeColorClass(pub.publicationType)}`}>
                          {pub.publicationType}
                        </span>
                        <span className="pub-year-badge">
                          <Calendar size={12} /> {pub.publicationYear}
                        </span>
                        <button
                          type="button"
                          id={`btn-toggle-vis-${pub.id}`}
                          className={`pub-vis-badge interactive ${pub.visibility.toLowerCase()}`}
                          title="Click to toggle visibility"
                          onClick={() => handleToggleVisibility(pub.id, pub.visibility)}
                        >
                          {pub.visibility === 'Public' ? <Globe size={11} /> : <Lock size={11} />}
                          {pub.visibility}
                        </button>
                      </div>

                      <div className="pub-card-quick-actions">
                        <button
                          id={`btn-edit-pub-${pub.id}`}
                          type="button"
                          className="pub-icon-action-btn"
                          title="Edit Publication"
                          onClick={() => {
                            handleStartEdit(pub);
                            setActiveTab('add');
                          }}
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          id={`btn-delete-pub-${pub.id}`}
                          type="button"
                          className="pub-icon-action-btn delete"
                          title="Delete Publication"
                          onClick={() => {
                            if (window.confirm(`Delete publication "${pub.title}"?`)) {
                              handleDeletePublication(pub.id);
                            }
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    <h3
                      className="pub-card-title clickable"
                      onClick={() => handleOpenDetails(pub.id)}
                      title="Click to view full details"
                    >
                      {pub.title}
                    </h3>

                    <p className="pub-card-authors">
                      <Users size={14} className="pub-inline-icon" />
                      <span>{pub.authors}</span>
                    </p>

                    {pub.journalOrConference && (
                      <p className="pub-card-venue">
                        <FileText size={14} className="pub-inline-icon" />
                        <span>{pub.journalOrConference}</span>
                      </p>
                    )}

                    {pub.abstract && (
                      <p className="pub-card-abstract-snippet">
                        {pub.abstract.length > 170 ? pub.abstract.slice(0, 170) + '…' : pub.abstract}
                      </p>
                    )}

                    <div className="pub-card-footer">
                      <div className="pub-card-links">
                        {cleanDoiVal && (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <a
                              href={`https://doi.org/${cleanDoiVal}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="pub-doi-link"
                              title="Open DOI resolver"
                            >
                              DOI: {cleanDoiVal} <ExternalLink size={10} />
                            </a>
                            <button
                              type="button"
                              className="icon-copy-btn"
                              style={{ width: '22px', height: '22px', border: 'none', background: 'transparent' }}
                              title="Copy DOI"
                              onClick={() => handleCopyDoi(pub.id, cleanDoiVal)}
                            >
                              {copiedDoiId === pub.id ? <Check size={12} style={{ color: '#10b981' }} /> : <Copy size={12} />}
                            </button>
                          </div>
                        )}
                        {pub.sourceLink && (
                          <a
                            href={pub.sourceLink.startsWith('http') ? pub.sourceLink : `https://${pub.sourceLink}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`pub-source-link ${linkProvider?.badgeClass || ''}`}
                            title={`Open ${linkProvider?.name || 'source paper'}`}
                          >
                            <LinkIcon size={11} /> {linkProvider?.name || 'Full Paper'} <ExternalLink size={10} />
                          </a>
                        )}
                      </div>

                      <button
                        id={`btn-view-details-${pub.id}`}
                        type="button"
                        className="pub-view-details-btn"
                        onClick={() => handleOpenDetails(pub.id)}
                      >
                        <Eye size={14} /> View Details
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: EXPLORE PUBLICATIONS ─── */}
      {activeTab === 'explore' && (
        <div className="pub-tab-pane" id="pane-explore-publications">
          {/* Explore Search and Filter Form */}
          <form className="pub-explore-filter-form" onSubmit={handleExploreSearchSubmit}>
            <div className="search-field">
              <Search size={16} className="search-icon" />
              <input
                id="filter-pub-search"
                type="text"
                placeholder="Search across public papers, authors, venues, keywords, or DOI…"
                value={exploreSearch}
                onChange={e => setExploreSearch(e.target.value)}
              />
            </div>

            <div className="filter-field">
              <select
                id="filter-pub-type"
                value={exploreType}
                onChange={e => setExploreType(e.target.value)}
              >
                <option value="All">All Types</option>
                {PUBLICATION_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="filter-field year-field">
              <input
                id="filter-pub-year"
                type="number"
                placeholder="Year (e.g. 2024)"
                value={exploreYear}
                onChange={e => setExploreYear(e.target.value)}
                min="1900"
                max={new Date().getFullYear() + 1}
              />
            </div>

            <button id="btn-submit-explore-search" type="submit" className="pub-search-btn">
              <Search size={15} /> Search
            </button>

            {(exploreSearch || exploreType !== 'All' || exploreYear) && (
              <button
                type="button"
                className="pub-reset-btn"
                onClick={handleResetFilters}
              >
                Reset
              </button>
            )}
          </form>

          {/* Results list */}
          {loading ? (
            <div className="pub-loading-state">
              <RefreshCw size={24} className="spin-icon" />
              <p>Searching public academic publications…</p>
            </div>
          ) : publicPublications.length === 0 ? (
            <div className="pub-empty-state" id="empty-explore-publications">
              <Globe size={44} />
              <h3>No publications found</h3>
              <p>Try adjusting your search keywords, publication type, or publication year.</p>
            </div>
          ) : (
            <div className="pub-cards-list" id="explore-publications-grid">
              {publicPublications.map(pub => {
                const cleanDoiVal = normalizeDoi(pub.doi);
                const linkProvider = detectLinkProvider(pub.sourceLink);
                return (
                  <div
                    key={pub.id}
                    className="pub-card explore-card"
                    id={`explore-pub-card-${pub.id}`}
                  >
                    <div className="pub-card-top">
                      <div className="pub-card-badges">
                        <span className={`pub-type-badge ${getBadgeColorClass(pub.publicationType)}`}>
                          {pub.publicationType}
                        </span>
                        <span className="pub-year-badge">
                          <Calendar size={12} /> {pub.publicationYear}
                        </span>
                        {pub.ownerName && (
                          <span className="pub-owner-badge">
                            By {pub.ownerName}
                          </span>
                        )}
                      </div>
                    </div>

                    <h3
                      className="pub-card-title clickable"
                      onClick={() => handleOpenDetails(pub.id)}
                      title="Click to view full details"
                    >
                      {pub.title}
                    </h3>

                    <p className="pub-card-authors">
                      <Users size={14} className="pub-inline-icon" />
                      <span>{pub.authors}</span>
                    </p>

                    {pub.journalOrConference && (
                      <p className="pub-card-venue">
                        <FileText size={14} className="pub-inline-icon" />
                        <span>{pub.journalOrConference}</span>
                      </p>
                    )}

                    <div className="pub-card-footer">
                      <div className="pub-card-links">
                        {cleanDoiVal && (
                          <a
                            href={`https://doi.org/${cleanDoiVal}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="pub-doi-link"
                          >
                            DOI: {cleanDoiVal} <ExternalLink size={10} />
                          </a>
                        )}
                        {pub.sourceLink && (
                          <a
                            href={pub.sourceLink.startsWith('http') ? pub.sourceLink : `https://${pub.sourceLink}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`pub-source-link ${linkProvider?.badgeClass || ''}`}
                          >
                            <LinkIcon size={11} /> {linkProvider?.name || 'Full Paper'} <ExternalLink size={10} />
                          </a>
                        )}
                      </div>

                      <button
                        id={`btn-explore-view-details-${pub.id}`}
                        type="button"
                        className="pub-view-details-btn"
                        onClick={() => handleOpenDetails(pub.id)}
                      >
                        <Eye size={14} /> Full Details & Citation
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 3: ADD / EDIT PUBLICATION FORM ─── */}
      {activeTab === 'add' && (
        <div className="pub-tab-pane" id="pane-add-publication">
          <div className="pub-form-container">
            <div className="pub-form-header">
              <h2>{editingPublication ? 'Edit Publication Record' : 'Catalog New Research Publication'}</h2>
              <p>
                Provide detailed bibliographic information about your work. You can auto-fill details by entering a DOI or fill the fields manually.
              </p>
            </div>

            {formError && (
              <div className="pub-form-error" id="pub-form-error-banner">
                <AlertCircle size={16} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitPublication} id="form-manage-publication" noValidate>
              {/* DOI First with Auto-fill helper */}
              <div className="form-group">
                <label htmlFor="pub-doi">
                  Digital Object Identifier (DOI)
                </label>
                <div className="doi-input-container">
                  <div className="doi-input-row">
                    <input
                      id="pub-doi"
                      type="text"
                      placeholder="e.g. 10.1109/TSE.2024.1234567 or https://doi.org/10.1145/3377811.3380387"
                      value={form.doi}
                      onChange={e => setForm(f => ({ ...f, doi: e.target.value }))}
                    />
                    <button
                      type="button"
                      className="btn-autofill-doi"
                      disabled={fetchingDoiMetadata || !form.doi.trim()}
                      onClick={handleFetchDoiMetadata}
                      title="Fetch metadata automatically from CrossRef"
                    >
                      {fetchingDoiMetadata ? (
                        <>
                          <RefreshCw size={14} className="spin-icon" /> Fetching…
                        </>
                      ) : (
                        <>
                          <Sparkles size={14} /> Auto-fill from DOI
                        </>
                      )}
                    </button>
                  </div>

                  {previewCleanDoi && previewCleanDoi.startsWith('10.') && previewCleanDoi.includes('/') && (
                    <div className="doi-preview-row">
                      <span>Live Resolver:</span>
                      <a href={`https://doi.org/${previewCleanDoi}`} target="_blank" rel="noopener noreferrer">
                        https://doi.org/{previewCleanDoi} <ExternalLink size={11} />
                      </a>
                    </div>
                  )}
                  <span className="field-hint">Entering a DOI allows automatic bibliographic extraction via CrossRef.</span>
                </div>
              </div>

              {/* Title */}
              <div className="form-group">
                <label htmlFor="pub-title">
                  Paper / Publication Title <span className="required">*</span>
                </label>
                <input
                  id="pub-title"
                  type="text"
                  placeholder="e.g. Distributed Consensus in Decentralized Research Collaborations"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  required
                />
              </div>

              {/* Authors */}
              <div className="form-group">
                <label htmlFor="pub-authors">
                  Authors (comma-separated list) <span className="required">*</span>
                </label>
                <input
                  id="pub-authors"
                  type="text"
                  placeholder="e.g. Fahim Azad, Nahiyan Kamal, Ispahani Ahmed"
                  value={form.authors}
                  onChange={e => setForm(f => ({ ...f, authors: e.target.value }))}
                  required
                />
                <span className="field-hint">List authors in publication sequence separated by commas.</span>
              </div>

              {/* Grid 2: Type & Year */}
              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="pub-type">Publication Type</label>
                  <select
                    id="pub-type"
                    value={form.publicationType}
                    onChange={e => setForm(f => ({ ...f, publicationType: e.target.value }))}
                  >
                    {PUBLICATION_TYPES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="pub-year">
                    Publication Year <span className="required">*</span>
                  </label>
                  <input
                    id="pub-year"
                    type="number"
                    value={form.publicationYear}
                    onChange={e => setForm(f => ({ ...f, publicationYear: Number(e.target.value) }))}
                    min="1900"
                    max={new Date().getFullYear() + 1}
                    required
                  />
                  <div className="year-presets-row">
                    <span className="preset-chip-label">Quick:</span>
                    {[
                      new Date().getFullYear(),
                      new Date().getFullYear() - 1,
                      new Date().getFullYear() - 2,
                      new Date().getFullYear() - 3
                    ].map(y => (
                      <button
                        key={y}
                        type="button"
                        className={`year-preset-btn ${form.publicationYear === y ? 'active' : ''}`}
                        onClick={() => setForm(f => ({ ...f, publicationYear: y }))}
                      >
                        {y}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Journal / Conference Venue */}
              <div className="form-group">
                <label htmlFor="pub-journal">
                  Journal or Conference Proceedings Name
                </label>
                <input
                  id="pub-journal"
                  type="text"
                  placeholder="e.g. IEEE Transactions on Software Engineering or ACM SIGKDD"
                  value={form.journalOrConference}
                  onChange={e => setForm(f => ({ ...f, journalOrConference: e.target.value }))}
                />
                <div className="preset-chips-row">
                  <span className="preset-chip-label">Suggested Venues:</span>
                  {POPULAR_VENUES.map(venue => (
                    <button
                      key={venue}
                      type="button"
                      className="preset-chip"
                      onClick={() => setForm(f => ({ ...f, journalOrConference: venue }))}
                    >
                      {venue}
                    </button>
                  ))}
                </div>
              </div>

              {/* Visibility */}
              <div className="form-group">
                <label htmlFor="pub-visibility">Portfolio Visibility</label>
                <select
                  id="pub-visibility"
                  value={form.visibility}
                  onChange={e => setForm(f => ({ ...f, visibility: e.target.value }))}
                >
                  <option value="Public">Public (Visible across ResCollab)</option>
                  <option value="Private">Private (Visible only to you)</option>
                </select>
              </div>

              {/* Source Link */}
              <div className="form-group">
                <label htmlFor="pub-sourcelink">
                  Source Link / Repository URL
                </label>
                <input
                  id="pub-sourcelink"
                  type="text"
                  placeholder="e.g. https://arxiv.org/abs/2401.12345 or IEEE Xplore URL"
                  value={form.sourceLink}
                  onChange={e => setForm(f => ({ ...f, sourceLink: e.target.value }))}
                />
                <span className="field-hint">Supports arXiv, IEEE, ACM, Nature, PubMed, Springer, GitHub, or direct paper links.</span>
              </div>

              {/* Abstract */}
              <div className="form-group">
                <label htmlFor="pub-abstract">
                  Abstract / Executive Summary
                </label>
                <textarea
                  id="pub-abstract"
                  rows={4}
                  placeholder="Enter the paper abstract or key findings summary..."
                  value={form.abstract}
                  onChange={e => setForm(f => ({ ...f, abstract: e.target.value }))}
                />
              </div>

              {/* Form Buttons */}
              <div className="pub-form-actions">
                <button
                  id="btn-submit-publication"
                  type="submit"
                  className="pub-primary-btn"
                  disabled={submitting}
                >
                  <Check size={16} />
                  {submitting ? 'Saving Publication…' : editingPublication ? 'Update Publication' : 'Save Publication'}
                </button>

                <button
                  type="button"
                  className="pub-secondary-btn"
                  onClick={() => {
                    setEditingPublication(null);
                    setForm(initialFormState);
                    setActiveTab('my');
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
      {viewPublication && (
        <PublicationDetailsModal
          publication={viewPublication}
          isOwner={viewPublication.ownerId === currentUserId}
          onClose={() => setViewPublication(null)}
          onEdit={pub => {
            handleStartEdit(pub);
            setActiveTab('add');
          }}
          onDelete={handleDeletePublication}
          onToggleVisibility={handleToggleVisibility}
        />
      )}
    </div>
  );
};

export default PublicationManagement;
