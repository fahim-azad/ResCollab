import React, { useEffect, useState, useCallback } from 'react';
import {
  Calendar, Search, Filter, Bookmark, Globe, MapPin, ExternalLink,
  Plus, X, RefreshCw, AlertCircle, Clock, CheckCircle2, ChevronRight,
  Sparkles, Award, FileText, Video, Building2, Tag, Trash2, Edit3, Check
} from 'lucide-react';
import './AcademicEvents.css';

// ==========================================
// TYPES & INTERFACES
// ==========================================

export interface AcademicEvent {
  id: number;
  title: string;
  organizer: string;
  eventType: string;
  description: string;
  fieldOfStudy: string;
  location?: string | null;
  isVirtual: boolean;
  startDate?: string | null;
  endDate?: string | null;
  submissionDeadline?: string | null;
  registrationDeadline?: string | null;
  websiteUrl?: string | null;
  registrationUrl?: string | null;
  source?: string | null;
  status: string;
  postedById?: number | null;
  postedByName?: string | null;
  createdAt: string;
  updatedAt: string;
  daysRemainingForSubmission?: number | null;
  daysRemainingForRegistration?: number | null;
  isBookmarked: boolean;
  bookmarkId?: number | null;
  bookmarkNotes?: string | null;
  isSubmitter: boolean;
}

export interface AcademicEventDetail extends AcademicEvent {
  totalBookmarksCount: number;
}

export interface PaginatedEventsResult {
  items: AcademicEvent[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface UrgentDeadline {
  eventId: number;
  title: string;
  organizer: string;
  eventType: string;
  fieldOfStudy: string;
  submissionDeadline: string;
  daysRemaining: number;
  urgencyLevel: 'critical' | 'high' | 'medium' | 'normal' | string;
  isVirtual: boolean;
  websiteUrl?: string | null;
}

export interface EventFacets {
  totalEvents: number;
  upcomingEvents: number;
  openCfpCount: number;
  virtualCount: number;
  eventTypes: { name: string; count: number }[];
  fieldsOfStudy: { name: string; count: number }[];
}

export const EVENT_TYPES = [
  { id: 'All', label: 'All Events', icon: Calendar },
  { id: 'Conference', label: 'Conferences', icon: Award },
  { id: 'Workshop', label: 'Workshops', icon: Sparkles },
  { id: 'CallForPapers', label: 'Calls for Papers', icon: FileText },
  { id: 'Symposium', label: 'Symposia', icon: Building2 },
  { id: 'Seminar', label: 'Seminars & Webinars', icon: Video },
  { id: 'Competition', label: 'Competitions', icon: Award },
];

const AcademicEvents: React.FC = () => {
  const [events, setEvents] = useState<AcademicEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const pageSize = 12;

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('All');
  const [selectedField, setSelectedField] = useState<string>('All');
  const [selectedMode, setSelectedMode] = useState<string>('all'); // 'all', 'virtual', 'in-person'
  const [selectedDeadlineFilter, setSelectedDeadlineFilter] = useState<string>('all'); // 'all', 'open-cfp', '30-days', '60-days'
  const [sortBy, setSortBy] = useState<string>('deadline');
  const [showOnlyBookmarks, setShowOnlyBookmarks] = useState<boolean>(false);

  // Facets & Urgent Deadlines
  const [facets, setFacets] = useState<EventFacets | null>(null);
  const [urgentDeadlines, setUrgentDeadlines] = useState<UrgentDeadline[]>([]);

  // Modals
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [eventDetail, setEventDetail] = useState<AcademicEventDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState<boolean>(false);
  const [editingEvent, setEditingEvent] = useState<AcademicEvent | null>(null);
  const [bookmarkNotesInput, setBookmarkNotesInput] = useState<string>('');
  const [savingBookmarkNotes, setSavingBookmarkNotes] = useState<boolean>(false);

  // Submit / Edit Form Fields
  const [formTitle, setFormTitle] = useState<string>('');
  const [formOrganizer, setFormOrganizer] = useState<string>('');
  const [formType, setFormType] = useState<string>('Conference');
  const [formField, setFormField] = useState<string>('Computer Science');
  const [formLocation, setFormLocation] = useState<string>('');
  const [formIsVirtual, setFormIsVirtual] = useState<boolean>(false);
  const [formStartDate, setFormStartDate] = useState<string>('');
  const [formEndDate, setFormEndDate] = useState<string>('');
  const [formSubDeadline, setFormSubDeadline] = useState<string>('');
  const [formRegDeadline, setFormRegDeadline] = useState<string>('');
  const [formWebsiteUrl, setFormWebsiteUrl] = useState<string>('');
  const [formRegUrl, setFormRegUrl] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [submittingForm, setSubmittingForm] = useState<boolean>(false);

  // Toast Notice
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const token = localStorage.getItem('token');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 1. Fetch Events List
  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);

      if (showOnlyBookmarks) {
        const res = await fetch('http://localhost:5000/api/events/my-bookmarks', {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        if (res.ok) {
          const data: AcademicEvent[] = await res.json();
          setEvents(data);
          setTotalCount(data.length);
        }
        return;
      }

      const params = new URLSearchParams();
      if (searchTerm.trim()) params.append('search', searchTerm.trim());
      if (selectedType && selectedType !== 'All') params.append('eventType', selectedType);
      if (selectedField && selectedField !== 'All') params.append('fieldOfStudy', selectedField);
      if (selectedMode === 'virtual') params.append('isVirtual', 'true');
      if (selectedMode === 'in-person') params.append('isVirtual', 'false');

      if (selectedDeadlineFilter === 'open-cfp') {
        params.append('hasOpenCfp', 'true');
      } else if (selectedDeadlineFilter === '30-days') {
        params.append('deadlineWithinDays', '30');
      } else if (selectedDeadlineFilter === '60-days') {
        params.append('deadlineWithinDays', '60');
      }

      params.append('sort', sortBy);
      params.append('page', page.toString());
      params.append('pageSize', pageSize.toString());

      const res = await fetch(`http://localhost:5000/api/events?${params.toString()}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });

      if (res.ok) {
        const data: PaginatedEventsResult = await res.json();
        setEvents(data.items || []);
        setTotalCount(data.totalCount || 0);
      }
    } catch (err) {
      console.error('Failed to fetch events:', err);
      showToast('Could not load academic events.');
    } finally {
      setLoading(false);
    }
  }, [token, showOnlyBookmarks, searchTerm, selectedType, selectedField, selectedMode, selectedDeadlineFilter, sortBy, page]);

  // 2. Fetch Facets & Deadlines
  const fetchFacetsAndDeadlines = useCallback(async () => {
    try {
      const [facetsRes, deadlinesRes] = await Promise.all([
        fetch('http://localhost:5000/api/events/facets'),
        fetch('http://localhost:5000/api/events/upcoming-deadlines?days=30')
      ]);

      if (facetsRes.ok) {
        const facetsData: EventFacets = await facetsRes.json();
        setFacets(facetsData);
      }

      if (deadlinesRes.ok) {
        const deadlinesData: UrgentDeadline[] = await deadlinesRes.json();
        setUrgentDeadlines(deadlinesData);
      }
    } catch (err) {
      console.error('Failed to load facets or deadlines:', err);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    fetchFacetsAndDeadlines();
  }, [fetchFacetsAndDeadlines]);

  // 3. Open Single Event Detail Modal
  const handleOpenDetail = async (eventId: number) => {
    setSelectedEventId(eventId);
    setLoadingDetail(true);
    try {
      const res = await fetch(`http://localhost:5000/api/events/${eventId}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data: AcademicEventDetail = await res.json();
        setEventDetail(data);
        setBookmarkNotesInput(data.bookmarkNotes || '');
      } else {
        showToast('Event details not found.');
      }
    } catch {
      showToast('Error fetching event details.');
    } finally {
      setLoadingDetail(false);
    }
  };

  // 4. Toggle Bookmark
  const handleToggleBookmark = async (eventId: number, notes?: string) => {
    if (!token) {
      showToast('Please sign in to bookmark research events.');
      return;
    }

    try {
      const res = await fetch(`http://localhost:5000/api/events/${eventId}/bookmark`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ notes: notes || null })
      });

      if (res.ok) {
        const data = await res.json();
        const isNowBookmarked = data.isBookmarked;

        // Update in event list
        setEvents(prev => prev.map(e => e.id === eventId ? {
          ...e,
          isBookmarked: isNowBookmarked,
          bookmarkId: data.bookmarkId,
          bookmarkNotes: data.notes
        } : e));

        // Update in modal detail if open
        if (eventDetail && eventDetail.id === eventId) {
          setEventDetail({
            ...eventDetail,
            isBookmarked: isNowBookmarked,
            bookmarkId: data.bookmarkId,
            bookmarkNotes: data.notes,
            totalBookmarksCount: isNowBookmarked
              ? eventDetail.totalBookmarksCount + 1
              : Math.max(0, eventDetail.totalBookmarksCount - 1)
          });
        }

        showToast(isNowBookmarked ? '✓ Event saved to your bookmarks!' : 'Event removed from bookmarks.');
      }
    } catch {
      showToast('Failed to toggle bookmark.');
    }
  };

  // 5. Save Bookmark Notes
  const handleSaveBookmarkNotes = async () => {
    if (!eventDetail) return;
    try {
      setSavingBookmarkNotes(true);
      await handleToggleBookmark(eventDetail.id, bookmarkNotesInput);
      showToast('✓ Research notes saved to calendar.');
    } finally {
      setSavingBookmarkNotes(false);
    }
  };

  // 6. Delete Event
  const handleDeleteEvent = async (eventId: number) => {
    if (!window.confirm('Are you sure you want to delete this academic event?')) return;
    try {
      const res = await fetch(`http://localhost:5000/api/events/${eventId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setEvents(prev => prev.filter(e => e.id !== eventId));
        setSelectedEventId(null);
        setEventDetail(null);
        showToast('✓ Academic event removed.');
      } else {
        showToast('Could not delete event.');
      }
    } catch {
      showToast('Deletion failed.');
    }
  };

  // 7. Submit or Update Event
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formOrganizer.trim() || !formDescription.trim()) {
      showToast('Please fill out the required title, organizer, and description.');
      return;
    }

    try {
      setSubmittingForm(true);

      const payload = {
        title: formTitle.trim(),
        organizer: formOrganizer.trim(),
        eventType: formType,
        description: formDescription.trim(),
        fieldOfStudy: formField.trim() || 'General',
        location: formLocation.trim() || null,
        isVirtual: formIsVirtual,
        startDate: formStartDate || null,
        endDate: formEndDate || null,
        submissionDeadline: formSubDeadline || null,
        registrationDeadline: formRegDeadline || null,
        websiteUrl: formWebsiteUrl.trim() || null,
        registrationUrl: formRegUrl.trim() || null,
        status: 'Upcoming'
      };

      const isEdit = !!editingEvent;
      const url = isEdit
        ? `http://localhost:5000/api/events/${editingEvent.id}`
        : 'http://localhost:5000/api/events';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast(isEdit ? '✓ Academic event updated!' : '✓ Research event published to the portal!');
        setIsSubmitModalOpen(false);
        setEditingEvent(null);
        resetForm();
        fetchEvents();
        fetchFacetsAndDeadlines();
      } else {
        const err = await res.json();
        showToast(err.message || 'Failed to save event.');
      }
    } catch {
      showToast('Error connecting to events service.');
    } finally {
      setSubmittingForm(false);
    }
  };

  const resetForm = () => {
    setFormTitle('');
    setFormOrganizer('');
    setFormType('Conference');
    setFormField('Computer Science');
    setFormLocation('');
    setFormIsVirtual(false);
    setFormStartDate('');
    setFormEndDate('');
    setFormSubDeadline('');
    setFormRegDeadline('');
    setFormWebsiteUrl('');
    setFormRegUrl('');
    setFormDescription('');
  };

  const openEditModal = (ev: AcademicEvent) => {
    setEditingEvent(ev);
    setFormTitle(ev.title);
    setFormOrganizer(ev.organizer);
    setFormType(ev.eventType);
    setFormField(ev.fieldOfStudy);
    setFormLocation(ev.location || '');
    setFormIsVirtual(ev.isVirtual);
    setFormStartDate(ev.startDate ? ev.startDate.split('T')[0] : '');
    setFormEndDate(ev.endDate ? ev.endDate.split('T')[0] : '');
    setFormSubDeadline(ev.submissionDeadline ? ev.submissionDeadline.split('T')[0] : '');
    setFormRegDeadline(ev.registrationDeadline ? ev.registrationDeadline.split('T')[0] : '');
    setFormWebsiteUrl(ev.websiteUrl || '');
    setFormRegUrl(ev.registrationUrl || '');
    setFormDescription(ev.description);
    setIsSubmitModalOpen(true);
    setSelectedEventId(null);
  };

  // Helper: Format Date Range
  const formatDateRange = (start?: string | null, end?: string | null) => {
    if (!start && !end) return 'Date TBD';
    if (start && !end) return new Date(start).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    if (!start && end) return `Concludes ${new Date(end).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
    
    const dStart = new Date(start!);
    const dEnd = new Date(end!);
    if (dStart.getFullYear() === dEnd.getFullYear() && dStart.getMonth() === dEnd.getMonth()) {
      return `${dStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${dEnd.getDate()}, ${dEnd.getFullYear()}`;
    }
    return `${dStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${dEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  // Helper: Format Deadline Countdown
  const renderDeadlinePill = (deadline?: string | null, daysRemaining?: number | null) => {
    if (!deadline) {
      return (
        <span className="deadline-badge neutral">
          <Clock size={12} /> No CFP Required
        </span>
      );
    }

    if (daysRemaining == null || daysRemaining < 0) {
      return (
        <span className="deadline-badge expired">
          <Clock size={12} /> CFP Closed
        </span>
      );
    }

    if (daysRemaining === 0) {
      return (
        <span className="deadline-badge critical">
          <AlertCircle size={12} /> CFP Ends Today!
        </span>
      );
    }

    if (daysRemaining <= 3) {
      return (
        <span className="deadline-badge critical">
          <AlertCircle size={12} /> CFP: {daysRemaining} days left!
        </span>
      );
    }

    if (daysRemaining <= 7) {
      return (
        <span className="deadline-badge urgent">
          <Clock size={12} /> CFP: {daysRemaining} days left
        </span>
      );
    }

    if (daysRemaining <= 30) {
      return (
        <span className="deadline-badge active">
          <CheckCircle2 size={12} /> CFP: {daysRemaining} days left
        </span>
      );
    }

    return (
      <span className="deadline-badge normal">
        <Clock size={12} /> CFP: {new Date(deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
      </span>
    );
  };

  return (
    <div className="academic-events-container" id="academic-events-page">
      {/* =========================================================================
          HERO BANNER & FACET METRICS
         ========================================================================= */}
      <header className="events-hero-header">
        <div className="events-title-group">
          <h1>
            <Calendar size={32} color="#4f46e5" />
            Academic Events, Conferences & CFPs
          </h1>
          <p>
            Explore global conferences, calls for papers, research symposia, and track submission deadlines across disciplines.
          </p>

          {facets && (
            <div className="facets-stats-strip">
              <div className="facet-stat-pill">
                <Sparkles size={14} color="#6366f1" />
                <span><strong>{facets.totalEvents}</strong> Active Events</span>
              </div>
              <div className="facet-stat-pill">
                <CheckCircle2 size={14} color="#10b981" />
                <span><strong>{facets.openCfpCount}</strong> Open Calls for Papers</span>
              </div>
              <div className="facet-stat-pill">
                <Globe size={14} color="#3b82f6" />
                <span><strong>{facets.virtualCount}</strong> Virtual & Hybrid Streams</span>
              </div>
            </div>
          )}
        </div>

        <div className="events-header-actions">
          <button
            id="btn-toggle-my-bookmarks"
            className={`btn-header-secondary ${showOnlyBookmarks ? 'active-tab' : ''}`}
            onClick={() => {
              setShowOnlyBookmarks(!showOnlyBookmarks);
              setPage(1);
            }}
          >
            <Bookmark size={16} />
            {showOnlyBookmarks ? 'All Events' : 'My Bookmarks'}
          </button>

          <button
            id="btn-open-submit-event"
            className="btn-header-primary"
            onClick={() => {
              resetForm();
              setEditingEvent(null);
              setIsSubmitModalOpen(true);
            }}
          >
            <Plus size={18} /> Submit Event / CFP
          </button>
        </div>
      </header>

      {/* =========================================================================
          URGENT DEADLINES STRIP (< 30 DAYS)
         ========================================================================= */}
      {urgentDeadlines.length > 0 && !showOnlyBookmarks && (
        <section className="urgent-deadlines-section" id="urgent-deadlines-carousel">
          <div className="deadlines-strip-header">
            <span className="strip-title">
              <Clock size={16} color="#ef4444" />
              Impending Submission Deadlines (Next 30 Days)
            </span>
            <span className="strip-count">{urgentDeadlines.length} urgent opportunities</span>
          </div>

          <div className="deadlines-cards-scroll">
            {urgentDeadlines.map(d => (
              <div
                key={d.eventId}
                className={`deadline-mini-card urgency-${d.urgencyLevel}`}
                onClick={() => handleOpenDetail(d.eventId)}
              >
                <div className="mini-card-top">
                  <span className="mini-type-tag">{d.eventType}</span>
                  <span className={`mini-days-pill urgency-${d.urgencyLevel}`}>
                    {d.daysRemaining === 0 ? 'Today!' : `${d.daysRemaining}d left`}
                  </span>
                </div>
                <h4 className="mini-card-title" title={d.title}>{d.title}</h4>
                <p className="mini-card-organizer">{d.organizer}</p>
                <div className="mini-card-footer">
                  <span>{new Date(d.submissionDeadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                  {d.isVirtual && <span className="mini-virtual-badge"><Globe size={11} /> Virtual</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* =========================================================================
          CATEGORY / EVENT TYPE TABS
         ========================================================================= */}
      <div className="event-type-tabs" role="tablist">
        {EVENT_TYPES.map(cat => {
          const Icon = cat.icon;
          const isActive = selectedType === cat.id;
          return (
            <button
              key={cat.id}
              id={`tab-event-${cat.id.toLowerCase()}`}
              className={`event-type-tab-btn ${isActive ? 'active' : ''}`}
              onClick={() => {
                setSelectedType(cat.id);
                setPage(1);
              }}
            >
              <Icon size={16} />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* =========================================================================
          DISCOVERY SEARCH & MULTI-FACET FILTER TOOLBAR
         ========================================================================= */}
      <div className="events-filter-toolbar">
        {/* Keyword Search */}
        <div className="events-search-box">
          <Search size={18} color="#64748b" />
          <input
            id="input-events-search"
            type="text"
            placeholder="Search conferences, workshops, venues, topics, or organizers..."
            value={searchTerm}
            onChange={e => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
          />
          {searchTerm && (
            <button className="clear-search-btn" onClick={() => setSearchTerm('')}>
              <X size={15} />
            </button>
          )}
        </div>

        {/* Discipline / Field of Study Filter */}
        <div className="filter-dropdown-wrapper">
          <Tag size={15} color="#64748b" />
          <select
            id="select-field-filter"
            className="filter-select"
            value={selectedField}
            onChange={e => {
              setSelectedField(e.target.value);
              setPage(1);
            }}
          >
            <option value="All">All Disciplines</option>
            {facets?.fieldsOfStudy.map(f => (
              <option key={f.name} value={f.name}>{f.name} ({f.count})</option>
            ))}
          </select>
        </div>

        {/* Mode Filter: Virtual / In-Person */}
        <div className="filter-dropdown-wrapper">
          <Globe size={15} color="#64748b" />
          <select
            id="select-mode-filter"
            className="filter-select"
            value={selectedMode}
            onChange={e => {
              setSelectedMode(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All Modes</option>
            <option value="virtual">Virtual Only</option>
            <option value="in-person">In-Person Venue</option>
          </select>
        </div>

        {/* CFP & Deadline Window Filter */}
        <div className="filter-dropdown-wrapper">
          <Clock size={15} color="#64748b" />
          <select
            id="select-deadline-filter"
            className="filter-select"
            value={selectedDeadlineFilter}
            onChange={e => {
              setSelectedDeadlineFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All Deadlines</option>
            <option value="open-cfp">Open CFPs Only</option>
            <option value="30-days">Deadlines in 30 Days</option>
            <option value="60-days">Deadlines in 60 Days</option>
          </select>
        </div>

        {/* Sort Selector */}
        <div className="filter-dropdown-wrapper">
          <Filter size={15} color="#64748b" />
          <select
            id="select-events-sort"
            className="filter-select"
            value={sortBy}
            onChange={e => {
              setSortBy(e.target.value);
              setPage(1);
            }}
          >
            <option value="deadline">Impending CFP Deadline</option>
            <option value="date">Event Start Date</option>
            <option value="title">Title (A-Z)</option>
            <option value="newest">Recently Posted</option>
          </select>
        </div>

        {/* Clear Filters Button */}
        {(searchTerm || selectedType !== 'All' || selectedField !== 'All' || selectedMode !== 'all' || selectedDeadlineFilter !== 'all') && (
          <button
            className="btn-clear-filters"
            onClick={() => {
              setSearchTerm('');
              setSelectedType('All');
              setSelectedField('All');
              setSelectedMode('all');
              setSelectedDeadlineFilter('all');
              setPage(1);
            }}
            title="Reset all filters"
          >
            <RefreshCw size={14} /> Clear
          </button>
        )}
      </div>

      {/* =========================================================================
          EVENTS CARDS GRID
         ========================================================================= */}
      {loading ? (
        <div className="events-loading-state">
          <RefreshCw size={36} className="spinner-icon" />
          <p>Gathering international conferences and academic calls for papers...</p>
        </div>
      ) : events.length === 0 ? (
        <div className="events-empty-state" id="events-empty-state">
          <Calendar size={54} style={{ opacity: 0.25, marginBottom: '1rem' }} />
          <h3>No Academic Events Found</h3>
          <p>
            {showOnlyBookmarks
              ? "You haven't bookmarked any research events or conferences yet."
              : 'No upcoming opportunities match your filter combination. Try clearing your search parameters.'}
          </p>
          <button
            className="btn-header-primary"
            style={{ marginTop: '1.2rem' }}
            onClick={() => {
              if (showOnlyBookmarks) {
                setShowOnlyBookmarks(false);
              } else {
                setSearchTerm('');
                setSelectedType('All');
                setSelectedField('All');
                setSelectedMode('all');
                setSelectedDeadlineFilter('all');
              }
            }}
          >
            {showOnlyBookmarks ? 'Explore All Events' : 'Reset Search Filters'}
          </button>
        </div>
      ) : (
        <div className="events-grid" id="events-stream-grid">
          {events.map(ev => {
            return (
              <article key={ev.id} className="event-card" id={`event-card-${ev.id}`}>
                {/* Card Top Pill Row */}
                <div className="card-top-row">
                  <span className={`event-type-badge type-${ev.eventType.toLowerCase()}`}>
                    {ev.eventType}
                  </span>

                  <div className="card-top-actions">
                    {ev.isVirtual ? (
                      <span className="mode-pill virtual" title="Virtual / Hybrid Attendance">
                        <Globe size={12} /> Virtual
                      </span>
                    ) : ev.location ? (
                      <span className="mode-pill in-person" title={ev.location}>
                        <MapPin size={12} /> {ev.location.split(',')[0]}
                      </span>
                    ) : (
                      <span className="mode-pill neutral">
                        <MapPin size={12} /> Venue TBD
                      </span>
                    )}

                    <button
                      id={`btn-bookmark-event-${ev.id}`}
                      className={`btn-bookmark-icon ${ev.isBookmarked ? 'bookmarked' : ''}`}
                      title={ev.isBookmarked ? 'Remove bookmark' : 'Bookmark event'}
                      onClick={() => handleToggleBookmark(ev.id)}
                    >
                      <Bookmark size={16} fill={ev.isBookmarked ? '#4f46e5' : 'none'} color={ev.isBookmarked ? '#4f46e5' : '#64748b'} />
                    </button>
                  </div>
                </div>

                {/* Event Title */}
                <h3
                  className="event-card-title"
                  title={ev.title}
                  onClick={() => handleOpenDetail(ev.id)}
                >
                  {ev.title}
                </h3>

                {/* Organizer & Discipline */}
                <div className="card-organizer-row">
                  <span className="organizer-name" title={ev.organizer}>
                    <Building2 size={13} /> {ev.organizer}
                  </span>
                  <span className="discipline-tag">{ev.fieldOfStudy}</span>
                </div>

                {/* Event Schedule & Dates */}
                <div className="card-dates-box">
                  <div className="date-item">
                    <span className="date-label">Event Dates:</span>
                    <span className="date-value">
                      <Calendar size={13} color="#6366f1" /> {formatDateRange(ev.startDate, ev.endDate)}
                    </span>
                  </div>
                </div>

                {/* CFP Deadline Countdown Pill */}
                <div className="card-deadline-row">
                  {renderDeadlinePill(ev.submissionDeadline, ev.daysRemainingForSubmission)}
                </div>

                {/* Description Excerpt */}
                <p className="card-description-snippet">
                  {ev.description.length > 140 ? `${ev.description.substring(0, 140)}...` : ev.description}
                </p>

                {/* Card Action Footer */}
                <div className="card-footer-row">
                  {ev.websiteUrl ? (
                    <a
                      href={ev.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="external-link-anchor"
                      onClick={e => e.stopPropagation()}
                    >
                      Official Portal <ExternalLink size={12} />
                    </a>
                  ) : (
                    <span className="no-link-placeholder">Portal info inside</span>
                  )}

                  <button
                    id={`btn-view-event-${ev.id}`}
                    className="btn-view-details"
                    onClick={() => handleOpenDetail(ev.id)}
                  >
                    View Scope <ChevronRight size={14} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* =========================================================================
          PAGINATION BAR
         ========================================================================= */}
      {!loading && totalCount > pageSize && !showOnlyBookmarks && (
        <div className="events-pagination">
          <button
            className="btn-page"
            disabled={page <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <span className="page-indicator">
            Page {page} of {Math.ceil(totalCount / pageSize)}
          </span>
          <button
            className="btn-page"
            disabled={page >= Math.ceil(totalCount / pageSize)}
            onClick={() => setPage(p => p + 1)}
          >
            Next
          </button>
        </div>
      )}

      {/* =========================================================================
          EVENT DETAILS MODAL
         ========================================================================= */}
      {selectedEventId && (
        <div className="modal-overlay animate-fade-in" id="modal-event-details">
          <div className="modal-content animate-slide-up" style={{ maxWidth: '780px' }}>
            <div className="modal-header">
              <div className="modal-title-with-badge">
                <span className={`event-type-badge type-${eventDetail?.eventType.toLowerCase() || 'conference'}`}>
                  {eventDetail?.eventType || 'Conference'}
                </span>
                <span className="status-pill-modal">{eventDetail?.status || 'Upcoming'}</span>
              </div>
              <button
                className="close-btn"
                onClick={() => {
                  setSelectedEventId(null);
                  setEventDetail(null);
                }}
              >
                ✕
              </button>
            </div>

            {loadingDetail ? (
              <div className="modal-loading-box">
                <RefreshCw size={28} className="spinner-icon" />
                <p>Retrieving conference prospectus and submission tracks...</p>
              </div>
            ) : eventDetail ? (
              <div className="event-detail-body">
                <h2 className="detail-modal-title">{eventDetail.title}</h2>
                <div className="detail-organizer-line">
                  <Building2 size={16} color="#4f46e5" />
                  <strong>Organized by:</strong> {eventDetail.organizer}
                  <span className="divider-dot">·</span>
                  <Tag size={14} color="#64748b" /> {eventDetail.fieldOfStudy}
                </div>

                {/* Important Dates & Venues Grid */}
                <div className="detail-grid-metrics">
                  <div className="metric-box">
                    <span className="metric-label">Conference Schedule</span>
                    <span className="metric-val">
                      <Calendar size={15} color="#4f46e5" />
                      {formatDateRange(eventDetail.startDate, eventDetail.endDate)}
                    </span>
                  </div>

                  <div className="metric-box">
                    <span className="metric-label">Call For Papers Cutoff</span>
                    <span className="metric-val">
                      <Clock size={15} color="#ef4444" />
                      {eventDetail.submissionDeadline
                        ? new Date(eventDetail.submissionDeadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                        : 'No submission cutoff'}
                    </span>
                    {eventDetail.daysRemainingForSubmission != null && (
                      <span className="metric-sublabel">
                        {eventDetail.daysRemainingForSubmission >= 0
                          ? `(${eventDetail.daysRemainingForSubmission} days remaining)`
                          : '(Submission closed)'}
                      </span>
                    )}
                  </div>

                  <div className="metric-box">
                    <span className="metric-label">Registration Cutoff</span>
                    <span className="metric-val">
                      <Clock size={15} color="#10b981" />
                      {eventDetail.registrationDeadline
                        ? new Date(eventDetail.registrationDeadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                        : 'Rolling Registration'}
                    </span>
                  </div>

                  <div className="metric-box">
                    <span className="metric-label">Location / Platform</span>
                    <span className="metric-val">
                      {eventDetail.isVirtual ? (
                        <><Globe size={15} color="#3b82f6" /> Virtual Webinar Stream</>
                      ) : (
                        <><MapPin size={15} color="#f59e0b" /> {eventDetail.location || 'Venue TBD'}</>
                      )}
                    </span>
                  </div>
                </div>

                {/* Description & Submission Scope */}
                <div className="detail-section">
                  <h3>Overview & Submission Scope</h3>
                  <div className="detail-description-text">{eventDetail.description}</div>
                </div>

                {/* External Action Links (Secure Outbound) */}
                <div className="detail-links-bar">
                  {eventDetail.websiteUrl && (
                    <a
                      id="link-official-website"
                      href={eventDetail.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-external-action official-portal"
                    >
                      <Globe size={16} /> Official Conference Portal <ExternalLink size={13} />
                    </a>
                  )}

                  {eventDetail.registrationUrl && (
                    <a
                      id="link-registration-portal"
                      href={eventDetail.registrationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-external-action register-cta"
                    >
                      <CheckCircle2 size={16} /> Submit Paper / Register <ExternalLink size={13} />
                    </a>
                  )}
                </div>

                {/* Personal Notes & Bookmarks Section */}
                <div className="detail-bookmarks-card">
                  <div className="bookmark-card-top">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <Bookmark size={18} color="#4f46e5" fill={eventDetail.isBookmarked ? '#4f46e5' : 'none'} />
                      <h4>Personal Calendar & Submission Notes</h4>
                    </div>
                    <button
                      id="btn-modal-bookmark"
                      className={`btn-modal-bookmark-toggle ${eventDetail.isBookmarked ? 'saved' : ''}`}
                      onClick={() => handleToggleBookmark(eventDetail.id, bookmarkNotesInput)}
                    >
                      {eventDetail.isBookmarked ? '★ Bookmarked' : '☆ Save to My Calendar'}
                    </button>
                  </div>

                  {eventDetail.isBookmarked && (
                    <div className="bookmark-notes-composer">
                      <textarea
                        id="input-bookmark-notes"
                        className="neo-input"
                        rows={2}
                        placeholder="Add private notes on track submissions, co-authors, or travel plans..."
                        value={bookmarkNotesInput}
                        onChange={e => setBookmarkNotesInput(e.target.value)}
                      />
                      <button
                        className="btn-save-notes"
                        disabled={savingBookmarkNotes}
                        onClick={handleSaveBookmarkNotes}
                      >
                        <Check size={14} />
                        {savingBookmarkNotes ? 'Saving...' : 'Update Notes'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Submitter Actions */}
                {eventDetail.isSubmitter && (
                  <div className="submitter-actions-row">
                    <button
                      id="btn-modal-edit-event"
                      className="btn-subtle-edit"
                      onClick={() => openEditModal(eventDetail)}
                    >
                      <Edit3 size={15} /> Edit Event
                    </button>
                    <button
                      id="btn-modal-delete-event"
                      className="btn-subtle-delete"
                      onClick={() => handleDeleteEvent(eventDetail.id)}
                    >
                      <Trash2 size={15} /> Delete Event
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* =========================================================================
          SUBMIT OR EDIT EVENT MODAL
         ========================================================================= */}
      {isSubmitModalOpen && (
        <div className="modal-overlay animate-fade-in" id="modal-create-event">
          <div className="modal-content animate-slide-up" style={{ maxWidth: '720px' }}>
            <div className="modal-header">
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0 }}>
                <Calendar size={22} color="#4f46e5" />
                {editingEvent ? 'Edit Academic Event' : 'Submit Research Event / Call for Papers'}
              </h2>
              <button className="close-btn" onClick={() => setIsSubmitModalOpen(false)}>✕</button>
            </div>

            <form id="form-create-event" onSubmit={handleSubmitForm} style={{ padding: '1.2rem 0 0 0' }}>
              <div className="form-group">
                <label>Event / Conference Title *</label>
                <input
                  id="input-event-title"
                  type="text"
                  className="neo-input"
                  required
                  placeholder="e.g. 2026 IEEE International Conference on Robotics and Automation (ICRA)"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                />
              </div>

              <div className="form-row-2col">
                <div className="form-group">
                  <label>Organizing Institution / Society *</label>
                  <input
                    id="input-event-organizer"
                    type="text"
                    className="neo-input"
                    required
                    placeholder="e.g. IEEE Robotics Society, ACM SIGGRAPH"
                    value={formOrganizer}
                    onChange={e => setFormOrganizer(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Event Classification *</label>
                  <select
                    id="select-event-type"
                    className="neo-input"
                    value={formType}
                    onChange={e => setFormType(e.target.value)}
                  >
                    <option value="Conference">Conference</option>
                    <option value="Workshop">Workshop</option>
                    <option value="CallForPapers">Call for Papers (CFP)</option>
                    <option value="Symposium">Symposium</option>
                    <option value="Seminar">Seminar / Webinar</option>
                    <option value="Competition">Research Competition</option>
                  </select>
                </div>
              </div>

              <div className="form-row-2col">
                <div className="form-group">
                  <label>Field of Study / Discipline *</label>
                  <input
                    id="input-event-field"
                    type="text"
                    className="neo-input"
                    required
                    placeholder="e.g. Machine Learning, Biomedical Engineering, Economics"
                    value={formField}
                    onChange={e => setFormField(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Physical Venue / Location</label>
                  <input
                    id="input-event-location"
                    type="text"
                    className="neo-input"
                    placeholder="e.g. London, United Kingdom"
                    value={formLocation}
                    onChange={e => setFormLocation(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-checkbox-row">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontWeight: 600 }}>
                  <input
                    id="checkbox-event-virtual"
                    type="checkbox"
                    checked={formIsVirtual}
                    onChange={e => setFormIsVirtual(e.target.checked)}
                  />
                  <span>Offers Virtual / Online Attendance or Webinar Stream</span>
                </label>
              </div>

              <div className="form-row-2col">
                <div className="form-group">
                  <label>Start Date</label>
                  <input
                    id="input-event-start-date"
                    type="date"
                    className="neo-input"
                    value={formStartDate}
                    onChange={e => setFormStartDate(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>End Date</label>
                  <input
                    id="input-event-end-date"
                    type="date"
                    className="neo-input"
                    value={formEndDate}
                    onChange={e => setFormEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row-2col">
                <div className="form-group">
                  <label>Paper / CFP Submission Deadline</label>
                  <input
                    id="input-event-submission-deadline"
                    type="date"
                    className="neo-input"
                    value={formSubDeadline}
                    onChange={e => setFormSubDeadline(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Registration Cutoff Deadline</label>
                  <input
                    id="input-event-registration-deadline"
                    type="date"
                    className="neo-input"
                    value={formRegDeadline}
                    onChange={e => setFormRegDeadline(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row-2col">
                <div className="form-group">
                  <label>Official Website URL</label>
                  <input
                    id="input-event-website-url"
                    type="url"
                    className="neo-input"
                    placeholder="https://conference.org"
                    value={formWebsiteUrl}
                    onChange={e => setFormWebsiteUrl(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Registration / EasyChair Submission Link</label>
                  <input
                    id="input-event-registration-url"
                    type="url"
                    className="neo-input"
                    placeholder="https://easychair.org/my/..."
                    value={formRegUrl}
                    onChange={e => setFormRegUrl(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Event Description & Submission Guidelines *</label>
                <textarea
                  id="textarea-event-description"
                  className="neo-input"
                  rows={5}
                  required
                  placeholder="Detail conference topics, paper length constraints, peer-review format, keynote speakers, or competition tracks..."
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                />
              </div>

              <div className="modal-footer" style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1.2rem', marginTop: '1.2rem', display: 'flex', justifyContent: 'flex-end', gap: '0.8rem' }}>
                <button type="button" className="cancel-btn" onClick={() => setIsSubmitModalOpen(false)}>
                  Cancel
                </button>
                <button
                  id="btn-submit-event"
                  type="submit"
                  className="btn-header-primary"
                  disabled={submittingForm}
                >
                  <Calendar size={16} />
                  {submittingForm ? 'Publishing...' : editingEvent ? 'Save Changes' : 'Publish Opportunity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast-notice" id="events-toast">
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default AcademicEvents;
