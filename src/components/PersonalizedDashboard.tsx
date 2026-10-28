import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderGit2,
  CheckSquare,
  AlertTriangle,
  Bookmark,
  Users,
  Bell,
  Sparkles,
  MessageCircle,
  Calendar,
  ArrowRight,
  Clock,
  ExternalLink,
  PlusCircle,
  RefreshCw,
  SlidersHorizontal,
  CheckCircle2,
  Award,
  BookOpen,
  DollarSign,
  X,
  Flame,
  GraduationCap,
  Building2
} from 'lucide-react';
import './PersonalizedDashboard.css';

const API_BASE_URL = 'http://localhost:5000/api';

// ==========================================
// DATA CONTRACTS & INTERFACES
// ==========================================

export interface DashboardMetrics {
  activeProjectsCount: number;
  pendingTasksCount: number;
  upcomingDeadlinesCount: number;
  savedResourcesCount: number;
  unreadNotificationsCount: number;
  networkConnectionsCount: number;
}

export interface WorkspaceSummaryItem {
  workspaceId: number;
  title: string;
  roleInWorkspace?: string;
  totalTasks: number;
  completedTasks: number;
  progressPercentage: number;
  nextPendingTask?: string;
}

export interface UpcomingDeadlineItem {
  title: string;
  deadlineType: string; // "Task", "Milestone", "CallForPapers", "Conference"
  deadlineDate: string;
  daysRemaining: number;
  contextTitle?: string;
  actionUrl?: string;
  isUrgent: boolean;
}

export interface TopRecommendationItem {
  id: number;
  userId: number;
  category: string;
  targetEntityId: number;
  title: string;
  subtitle?: string;
  description?: string;
  matchScore: number;
  matchedTags?: string;
  recommendationReason?: string;
  status: string;
  generatedAt: string;
}

export interface CommunityPostSummary {
  postId: number;
  title: string;
  authorName: string;
  category: string;
  reactionsCount: number;
  commentsCount: number;
  createdAt: string;
}

export interface PersonalizedActivityItem {
  id: number;
  userId: number;
  activityType: string;
  title: string;
  description?: string;
  targetUrl?: string;
  createdAt: string;
}

export interface DashboardWidgetPreferenceItem {
  id?: number;
  userId?: number;
  widgetKey: string;
  isVisible: boolean;
  displayOrder: number;
}

export interface PersonalizedDashboardData {
  userId: number;
  fullName: string;
  role: string;
  institution?: string;
  department?: string;
  profileCompletionPercentage: number;
  metrics: DashboardMetrics;
  activeWorkspaces: WorkspaceSummaryItem[];
  upcomingDeadlines: UpcomingDeadlineItem[];
  topRecommendations: TopRecommendationItem[];
  recentDiscussions: CommunityPostSummary[];
  recentActivities: PersonalizedActivityItem[];
}

export const PersonalizedDashboard: React.FC = () => {
  const navigate = useNavigate();

  // State Management
  const [dashboardData, setDashboardData] = useState<PersonalizedDashboardData | null>(null);
  const [preferences, setPreferences] = useState<DashboardWidgetPreferenceItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Deadline Filter Tabs ("all", "tasks", "cfps", "conferences")
  const [deadlineFilter, setDeadlineFilter] = useState<'all' | 'tasks' | 'cfps' | 'conferences'>('all');

  // Modals
  const [showPreferencesModal, setShowPreferencesModal] = useState<boolean>(false);
  const [showLogActivityModal, setShowLogActivityModal] = useState<boolean>(false);
  const [savingPrefs, setSavingPrefs] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form State for Quick Activity Logging
  const [newActivityType, setNewActivityType] = useState<string>('MilestoneCompleted');
  const [newActivityTitle, setNewActivityTitle] = useState<string>('');
  const [newActivityDesc, setNewActivityDesc] = useState<string>('');
  const [newActivityUrl, setNewActivityUrl] = useState<string>('');
  const [submittingActivity, setSubmittingActivity] = useState<boolean>(false);

  // Show Toast Helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Auth Helper
  const getAuthHeader = (): Record<string, string> => {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  };

  // Fetch Dashboard Summary
  const fetchDashboardData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const res = await fetch(`${API_BASE_URL}/dashboard/summary`, {
        headers: getAuthHeader()
      });

      if (!res.ok) {
        throw new Error(`Failed to load dashboard data (Status ${res.status})`);
      }

      const data: PersonalizedDashboardData = await res.json();
      setDashboardData(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error loading dashboard.';
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [navigate]);

  // Fetch Widget Layout Preferences
  const fetchPreferences = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/dashboard/preferences`, {
        headers: getAuthHeader()
      });
      if (res.ok) {
        const prefs: DashboardWidgetPreferenceItem[] = await res.json();
        if (prefs && prefs.length > 0) {
          setPreferences(prefs);
        } else {
          // Initialize default layout if none returned
          setPreferences([
            { widgetKey: 'Workspaces', isVisible: true, displayOrder: 1 },
            { widgetKey: 'Deadlines', isVisible: true, displayOrder: 2 },
            { widgetKey: 'Recommendations', isVisible: true, displayOrder: 3 },
            { widgetKey: 'Community', isVisible: true, displayOrder: 4 },
            { widgetKey: 'ActivityLog', isVisible: true, displayOrder: 5 }
          ]);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch widget preferences:', err);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    fetchPreferences();
  }, [fetchDashboardData, fetchPreferences]);

  // Save Preferences Handler
  const handleSavePreferences = async (updatedPrefs: DashboardWidgetPreferenceItem[]) => {
    setSavingPrefs(true);
    try {
      const res = await fetch(`${API_BASE_URL}/dashboard/preferences`, {
        method: 'PUT',
        headers: getAuthHeader(),
        body: JSON.stringify({ preferences: updatedPrefs })
      });

      if (res.ok) {
        const saved: DashboardWidgetPreferenceItem[] = await res.json();
        setPreferences(saved);
        setShowPreferencesModal(false);
        showToast('Dashboard layout preferences updated successfully!');
      } else {
        throw new Error('Failed to save layout preferences');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not save preferences';
      alert(msg);
    } finally {
      setSavingPrefs(false);
    }
  };

  // Toggle Visibility in Preferences Modal
  const toggleWidgetVisibility = (key: string) => {
    setPreferences((prev) =>
      prev.map((p) => (p.widgetKey.toLowerCase() === key.toLowerCase() ? { ...p, isVisible: !p.isVisible } : p))
    );
  };

  // Quick Activity Logging Submission
  const handleLogActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActivityTitle.trim()) {
      alert('Please enter an activity title.');
      return;
    }

    setSubmittingActivity(true);
    try {
      const payload = {
        activityType: newActivityType,
        title: newActivityTitle.trim(),
        description: newActivityDesc.trim() || undefined,
        targetUrl: newActivityUrl.trim() || undefined
      };

      const res = await fetch(`${API_BASE_URL}/dashboard/activity`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error('Failed to record activity.');
      }

      const createdItem: PersonalizedActivityItem = await res.json();
      // Prepend to current activity list
      if (dashboardData) {
        setDashboardData({
          ...dashboardData,
          recentActivities: [createdItem, ...(dashboardData.recentActivities || [])]
        });
      }

      setNewActivityTitle('');
      setNewActivityDesc('');
      setNewActivityUrl('');
      setShowLogActivityModal(false);
      showToast('Research activity milestone logged successfully!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record activity.';
      alert(msg);
    } finally {
      setSubmittingActivity(false);
    }
  };

  // Check if a widget is enabled
  const isWidgetVisible = (key: string) => {
    if (!preferences || preferences.length === 0) return true;
    const pref = preferences.find((p) => p.widgetKey.toLowerCase() === key.toLowerCase());
    return pref ? pref.isVisible : true;
  };

  // Filtered Deadlines
  const filteredDeadlines = useMemo(() => {
    if (!dashboardData?.upcomingDeadlines) return [];
    if (deadlineFilter === 'all') return dashboardData.upcomingDeadlines;
    if (deadlineFilter === 'tasks') {
      return dashboardData.upcomingDeadlines.filter(
        (d) => d.deadlineType.toLowerCase() === 'task' || d.deadlineType.toLowerCase() === 'milestone'
      );
    }
    if (deadlineFilter === 'cfps') {
      return dashboardData.upcomingDeadlines.filter((d) => d.deadlineType.toLowerCase() === 'callforpapers');
    }
    if (deadlineFilter === 'conferences') {
      return dashboardData.upcomingDeadlines.filter((d) => d.deadlineType.toLowerCase() === 'conference');
    }
    return dashboardData.upcomingDeadlines;
  }, [dashboardData, deadlineFilter]);

  // Greeting helper
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Relative Date Formatter
  const formatTimeAgo = (dateStr: string) => {
    try {
      const diffMs = Date.now() - new Date(dateStr).getTime();
      const mins = Math.floor(diffMs / (1000 * 60));
      if (mins < 1) return 'Just now';
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      if (days < 7) return `${days}d ago`;
      return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Activity Type Icon / Badge Helper
  const renderActivityIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'projectjoined':
      case 'workspacecreated':
        return <FolderGit2 size={16} className="activity-icon-blue" />;
      case 'taskcompleted':
      case 'milestonecompleted':
        return <CheckCircle2 size={16} className="activity-icon-green" />;
      case 'paperbookmarked':
        return <Bookmark size={16} className="activity-icon-amber" />;
      case 'postcreated':
        return <MessageCircle size={16} className="activity-icon-purple" />;
      case 'profileactivated':
        return <Award size={16} className="activity-icon-emerald" />;
      default:
        return <Sparkles size={16} className="activity-icon-teal" />;
    }
  };

  return (
    <div className="personalized-dashboard-container" id="personalized-dashboard-root">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="dashboard-toast" id="dashboard-toast-notification">
          <CheckCircle2 size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Loading State */}
      {loading && !dashboardData ? (
        <div className="dashboard-loading-skeleton" id="dashboard-loading-skeleton">
          <div className="skeleton-hero-banner" />
          <div className="skeleton-metrics-grid">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="skeleton-metric-card" />
            ))}
          </div>
          <div className="skeleton-content-grid">
            <div className="skeleton-card-large" />
            <div className="skeleton-card-large" />
          </div>
        </div>
      ) : error ? (
        <div className="dashboard-error-state" id="dashboard-error-card">
          <AlertTriangle size={48} className="error-icon" />
          <h2>Unable to Load Dashboard</h2>
          <p>{error}</p>
          <button
            className="btn-retry"
            id="btn-retry-dashboard-load"
            onClick={() => fetchDashboardData()}
          >
            <RefreshCw size={18} /> Retry
          </button>
        </div>
      ) : dashboardData ? (
        <>
          {/* =========================================================================
              1. HERO BANNER & WELCOME PROFILE SECTION
              ========================================================================= */}
          <section className="dashboard-hero-banner" id="dashboard-welcome-banner">
            <div className="hero-banner-content">
              <div className="hero-greeting-group">
                <div className="avatar-monogram" id="user-avatar-badge">
                  {dashboardData.fullName
                    ? dashboardData.fullName
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()
                    : 'RC'}
                </div>
                <div className="hero-text-details">
                  <div className="greeting-pill-row">
                    <span className="greeting-time-tag">
                      <Clock size={14} /> {getGreeting()}
                    </span>
                    <span className="role-tag" id="user-role-badge">
                      <GraduationCap size={14} /> {dashboardData.role || 'Researcher'}
                    </span>
                  </div>
                  <h1 className="user-welcome-name" id="user-greeting-heading">
                    {dashboardData.fullName || 'Welcome, Researcher'}
                  </h1>
                  <p className="user-affiliation" id="user-affiliation-text">
                    {dashboardData.department ? `${dashboardData.department}, ` : ''}
                    {dashboardData.institution ? (
                      <span className="institution-inline">
                        <Building2 size={15} /> {dashboardData.institution}
                      </span>
                    ) : (
                      'ResCollab Collaborative Network'
                    )}
                  </p>
                </div>
              </div>

              {/* Profile Completion Gauge */}
              <div className="profile-completion-box" id="profile-completion-card">
                <div className="completion-header">
                  <span className="completion-title">Profile Strength</span>
                  <span className="completion-percent" id="profile-strength-score">
                    {dashboardData.profileCompletionPercentage}%
                  </span>
                </div>
                <div className="completion-progress-track">
                  <div
                    className="completion-progress-bar"
                    style={{ width: `${dashboardData.profileCompletionPercentage}%` }}
                    id="profile-strength-fill"
                  />
                </div>
                {dashboardData.profileCompletionPercentage < 100 && (
                  <button
                    className="btn-complete-profile"
                    id="btn-complete-profile-cta"
                    onClick={() => navigate('/profile')}
                  >
                    Complete Profile <ArrowRight size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Hero Quick Toolbar */}
            <div className="hero-toolbar">
              <button
                className={`btn-toolbar-action ${refreshing ? 'rotating' : ''}`}
                id="btn-refresh-dashboard"
                onClick={() => fetchDashboardData(true)}
                title="Refresh Dashboard Data"
              >
                <RefreshCw size={16} />
                <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
              </button>
              <button
                className="btn-toolbar-action"
                id="btn-open-log-modal"
                onClick={() => setShowLogActivityModal(true)}
                title="Log Milestone or Activity"
              >
                <PlusCircle size={16} />
                <span>Log Milestone</span>
              </button>
              <button
                className="btn-toolbar-action"
                id="btn-open-preferences-modal"
                onClick={() => setShowPreferencesModal(true)}
                title="Customize Dashboard Widgets"
              >
                <SlidersHorizontal size={16} />
                <span>Customize</span>
              </button>
            </div>
          </section>

          {/* =========================================================================
              2. KEY PRODUCTIVITY METRICS (KPIs)
              ========================================================================= */}
          <section className="dashboard-metrics-grid" id="dashboard-kpi-metrics-grid">
            {/* Active Workspaces & Projects */}
            <div
              className="kpi-card"
              id="kpi-card-workspaces"
              onClick={() => navigate('/workspaces')}
              tabIndex={0}
              role="button"
            >
              <div className="kpi-icon-wrapper kpi-color-blue">
                <FolderGit2 size={24} />
              </div>
              <div className="kpi-content">
                <div className="kpi-count" id="kpi-count-workspaces">
                  {dashboardData.metrics?.activeProjectsCount ?? 0}
                </div>
                <div className="kpi-label">Active Workspaces</div>
                <div className="kpi-subtext">Collaborations in progress</div>
              </div>
              <ArrowRight size={16} className="kpi-arrow" />
            </div>

            {/* Pending Tasks */}
            <div
              className="kpi-card"
              id="kpi-card-pending-tasks"
              onClick={() => navigate('/workspaces')}
              tabIndex={0}
              role="button"
            >
              <div className="kpi-icon-wrapper kpi-color-amber">
                <CheckSquare size={24} />
              </div>
              <div className="kpi-content">
                <div className="kpi-count" id="kpi-count-tasks">
                  {dashboardData.metrics?.pendingTasksCount ?? 0}
                </div>
                <div className="kpi-label">Pending Tasks</div>
                <div className="kpi-subtext">Milestones awaiting action</div>
              </div>
              <ArrowRight size={16} className="kpi-arrow" />
            </div>

            {/* Upcoming Deadlines */}
            <div
              className={`kpi-card ${
                (dashboardData.metrics?.upcomingDeadlinesCount ?? 0) > 0 ? 'kpi-card-highlight-urgent' : ''
              }`}
              id="kpi-card-deadlines"
              onClick={() => {
                const el = document.getElementById('widget-deadlines-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
                else navigate('/events');
              }}
              tabIndex={0}
              role="button"
            >
              <div className="kpi-icon-wrapper kpi-color-rose">
                <AlertTriangle size={24} />
              </div>
              <div className="kpi-content">
                <div className="kpi-count" id="kpi-count-deadlines">
                  {dashboardData.metrics?.upcomingDeadlinesCount ?? 0}
                </div>
                <div className="kpi-label">Imminent Deadlines</div>
                <div className="kpi-subtext">Due within 30 days</div>
              </div>
              <ArrowRight size={16} className="kpi-arrow" />
            </div>

            {/* Saved Resources */}
            <div
              className="kpi-card"
              id="kpi-card-saved"
              onClick={() => navigate('/saved')}
              tabIndex={0}
              role="button"
            >
              <div className="kpi-icon-wrapper kpi-color-purple">
                <Bookmark size={24} />
              </div>
              <div className="kpi-content">
                <div className="kpi-count" id="kpi-count-saved">
                  {dashboardData.metrics?.savedResourcesCount ?? 0}
                </div>
                <div className="kpi-label">Saved Resources</div>
                <div className="kpi-subtext">Papers & conferences</div>
              </div>
              <ArrowRight size={16} className="kpi-arrow" />
            </div>

            {/* Network Connections */}
            <div
              className="kpi-card"
              id="kpi-card-network"
              onClick={() => navigate('/network')}
              tabIndex={0}
              role="button"
            >
              <div className="kpi-icon-wrapper kpi-color-teal">
                <Users size={24} />
              </div>
              <div className="kpi-content">
                <div className="kpi-count" id="kpi-count-network">
                  {dashboardData.metrics?.networkConnectionsCount ?? 0}
                </div>
                <div className="kpi-label">Network Connections</div>
                <div className="kpi-subtext">Peers & research advisors</div>
              </div>
              <ArrowRight size={16} className="kpi-arrow" />
            </div>

            {/* Unread Alerts */}
            <div
              className="kpi-card"
              id="kpi-card-notifications"
              onClick={() => navigate('/notifications')}
              tabIndex={0}
              role="button"
            >
              <div className="kpi-icon-wrapper kpi-color-indigo">
                <Bell size={24} />
              </div>
              <div className="kpi-content">
                <div className="kpi-count" id="kpi-count-notifications">
                  {dashboardData.metrics?.unreadNotificationsCount ?? 0}
                </div>
                <div className="kpi-label">Unread Alerts</div>
                <div className="kpi-subtext">Mentions & activity updates</div>
              </div>
              <ArrowRight size={16} className="kpi-arrow" />
            </div>
          </section>

          {/* =========================================================================
              3. QUICK ACTION SHORTCUTS RIBBON
              ========================================================================= */}
          <section className="dashboard-shortcuts-ribbon" id="dashboard-shortcuts-ribbon">
            <button
              className="shortcut-btn"
              id="shortcut-btn-community"
              onClick={() => navigate('/community')}
            >
              <MessageCircle size={18} className="shortcut-icon icon-purple" />
              <span>Community Feed</span>
            </button>
            <button
              className="shortcut-btn"
              id="shortcut-btn-events"
              onClick={() => navigate('/events')}
            >
              <Calendar size={18} className="shortcut-icon icon-rose" />
              <span>Events & CFPs</span>
            </button>
            <button
              className="shortcut-btn"
              id="shortcut-btn-recommendations"
              onClick={() => navigate('/recommendations')}
            >
              <Sparkles size={18} className="shortcut-icon icon-amber" />
              <span>AI Matches</span>
            </button>
            <button
              className="shortcut-btn"
              id="shortcut-btn-collaborators"
              onClick={() => navigate('/collaborators')}
            >
              <Users size={18} className="shortcut-icon icon-teal" />
              <span>Find Collaborators</span>
            </button>
            <button
              className="shortcut-btn"
              id="shortcut-btn-funding"
              onClick={() => navigate('/funding')}
            >
              <DollarSign size={18} className="shortcut-icon icon-emerald" />
              <span>Grants & Funding</span>
            </button>
            <button
              className="shortcut-btn"
              id="shortcut-btn-publications"
              onClick={() => navigate('/publications')}
            >
              <BookOpen size={18} className="shortcut-icon icon-blue" />
              <span>Publications</span>
            </button>
          </section>

          {/* =========================================================================
              4. MAIN WIDGETS DUAL-COLUMN GRID
              ========================================================================= */}
          <div className="dashboard-main-layout-grid">
            {/* LEFT / PRIMARY COLUMN */}
            <div className="dashboard-primary-column">
              {/* WIDGET: IMMINENT DEADLINES */}
              {isWidgetVisible('Deadlines') && (
                <section
                  className="dashboard-widget-card"
                  id="widget-deadlines-section"
                >
                  <div className="widget-header">
                    <div className="widget-header-title">
                      <AlertTriangle size={20} className="widget-icon icon-rose" />
                      <h2>Imminent Deadlines & Timelines</h2>
                      <span className="badge-count" id="badge-deadline-count">
                        {filteredDeadlines.length}
                      </span>
                    </div>

                    {/* Filter Tabs */}
                    <div className="deadline-filter-tabs" id="deadline-filter-tabs">
                      <button
                        className={`filter-tab ${deadlineFilter === 'all' ? 'active' : ''}`}
                        id="filter-deadline-all"
                        onClick={() => setDeadlineFilter('all')}
                      >
                        All
                      </button>
                      <button
                        className={`filter-tab ${deadlineFilter === 'tasks' ? 'active' : ''}`}
                        id="filter-deadline-tasks"
                        onClick={() => setDeadlineFilter('tasks')}
                      >
                        Tasks
                      </button>
                      <button
                        className={`filter-tab ${deadlineFilter === 'cfps' ? 'active' : ''}`}
                        id="filter-deadline-cfps"
                        onClick={() => setDeadlineFilter('cfps')}
                      >
                        CFPs
                      </button>
                      <button
                        className={`filter-tab ${deadlineFilter === 'conferences' ? 'active' : ''}`}
                        id="filter-deadline-conferences"
                        onClick={() => setDeadlineFilter('conferences')}
                      >
                        Conferences
                      </button>
                    </div>
                  </div>

                  <div className="deadlines-list" id="dashboard-deadlines-list">
                    {filteredDeadlines.length === 0 ? (
                      <div className="widget-empty-state" id="empty-state-deadlines">
                        <CheckCircle2 size={36} className="empty-icon text-green" />
                        <h4>All caught up!</h4>
                        <p>No impending deadlines matching your filter within the next 30 days.</p>
                      </div>
                    ) : (
                      filteredDeadlines.map((item, idx) => (
                        <div
                          key={idx}
                          className={`deadline-item-row ${item.isUrgent ? 'urgent-border' : ''}`}
                          id={`deadline-item-${idx}`}
                        >
                          <div className="deadline-info-left">
                            <div className="deadline-badge-row">
                              <span
                                className={`deadline-type-tag tag-${item.deadlineType.toLowerCase()}`}
                              >
                                {item.deadlineType === 'CallForPapers' ? 'CFP' : item.deadlineType}
                              </span>
                              {item.isUrgent && (
                                <span className="urgent-badge" id={`urgent-badge-${idx}`}>
                                  <Flame size={12} /> Urgent (&le; 7 days)
                                </span>
                              )}
                              <span className="deadline-context-name">{item.contextTitle}</span>
                            </div>
                            <h3 className="deadline-title">{item.title}</h3>
                            <div className="deadline-date-detail">
                              <Calendar size={14} />
                              <span>Due {new Date(item.deadlineDate).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}</span>
                            </div>
                          </div>

                          <div className="deadline-action-right">
                            <span
                              className={`days-countdown-pill ${
                                item.daysRemaining <= 3
                                  ? 'countdown-danger'
                                  : item.daysRemaining <= 7
                                  ? 'countdown-warning'
                                  : 'countdown-normal'
                              }`}
                              id={`countdown-pill-${idx}`}
                            >
                              {item.daysRemaining <= 0
                                ? 'Due today'
                                : item.daysRemaining === 1
                                ? '1 day left'
                                : `${item.daysRemaining} days left`}
                            </span>
                            <button
                              className="btn-deadline-action"
                              id={`btn-deadline-action-${idx}`}
                              onClick={() => {
                                if (item.actionUrl) navigate(item.actionUrl);
                                else if (item.deadlineType.toLowerCase() === 'task') navigate('/workspaces');
                                else navigate('/events');
                              }}
                            >
                              View <ArrowRight size={14} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              )}

              {/* WIDGET: ACTIVE WORKSPACES PROGRESS */}
              {isWidgetVisible('Workspaces') && (
                <section
                  className="dashboard-widget-card"
                  id="widget-workspaces-section"
                >
                  <div className="widget-header">
                    <div className="widget-header-title">
                      <FolderGit2 size={20} className="widget-icon icon-blue" />
                      <h2>Active Workspaces & Projects</h2>
                      <span className="badge-count" id="badge-workspace-count">
                        {dashboardData.activeWorkspaces?.length ?? 0}
                      </span>
                    </div>
                    <button
                      className="btn-widget-action"
                      id="btn-nav-all-workspaces"
                      onClick={() => navigate('/workspaces')}
                    >
                      All Workspaces <ArrowRight size={14} />
                    </button>
                  </div>

                  <div className="workspaces-grid" id="dashboard-workspaces-grid">
                    {!dashboardData.activeWorkspaces || dashboardData.activeWorkspaces.length === 0 ? (
                      <div className="widget-empty-state" id="empty-state-workspaces">
                        <FolderGit2 size={36} className="empty-icon text-muted" />
                        <h4>No active workspaces yet</h4>
                        <p>Create or join research workspaces to coordinate tasks, files, and milestones.</p>
                        <button
                          className="btn-create-first"
                          id="btn-empty-create-workspace"
                          onClick={() => navigate('/workspaces')}
                        >
                          <PlusCircle size={16} /> Open Workspaces
                        </button>
                      </div>
                    ) : (
                      dashboardData.activeWorkspaces.map((ws) => {
                        const wsTitle = ws.title || (ws as any).Title || 'Research Workspace';
                        const wsRole = ws.roleInWorkspace || (ws as any).RoleInWorkspace || 'Member';
                        const wsCompleted = ws.completedTasks ?? (ws as any).CompletedTasks ?? 0;
                        const wsTotal = ws.totalTasks ?? (ws as any).TotalTasks ?? 0;
                        const wsProgress = ws.progressPercentage ?? (ws as any).ProgressPercentage ?? 0;
                        const wsNext = ws.nextPendingTask || (ws as any).NextPendingTask;

                        return (
                          <div
                            key={ws.workspaceId || (ws as any).WorkspaceId}
                            className="workspace-progress-card"
                            id={`workspace-card-${ws.workspaceId || (ws as any).WorkspaceId}`}
                            onClick={() => navigate('/workspaces')}
                          >
                            <div className="workspace-card-top">
                              <h3 className="workspace-title">{wsTitle}</h3>
                              <span className="workspace-role-pill">
                                {wsRole}
                              </span>
                            </div>

                            {/* Progress Meter */}
                            <div className="workspace-progress-box">
                              <div className="progress-labels">
                                <span className="progress-tasks-text">
                                  {wsCompleted} of {wsTotal} tasks completed
                                </span>
                                <span className="progress-percent-text">
                                  {Math.round(wsProgress)}%
                                </span>
                              </div>
                              <div className="progress-track">
                                <div
                                  className="progress-bar-fill"
                                  style={{ width: `${Math.min(100, Math.max(0, wsProgress))}%` }}
                                />
                              </div>
                            </div>

                            {/* Next Pending Task Highlight */}
                            {wsNext ? (
                              <div className="next-task-box">
                                <Clock size={14} className="next-task-icon" />
                                <span className="next-task-text">
                                  Next: <strong>{wsNext}</strong>
                                </span>
                              </div>
                            ) : (
                              <div className="next-task-box completed">
                                <CheckCircle2 size={14} className="next-task-icon" />
                                <span className="next-task-text">All scheduled tasks completed</span>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>
              )}

              {/* WIDGET: AI MATCHES & RECOMMENDATIONS */}
              {isWidgetVisible('Recommendations') && (
                <section
                  className="dashboard-widget-card"
                  id="widget-recommendations-section"
                >
                  <div className="widget-header">
                    <div className="widget-header-title">
                      <Sparkles size={20} className="widget-icon icon-amber" />
                      <h2>Top Recommended Collaborators & Projects</h2>
                      <span className="badge-count" id="badge-recommendations-count">
                        {dashboardData.topRecommendations?.length ?? 0}
                      </span>
                    </div>
                    <button
                      className="btn-widget-action"
                      id="btn-nav-all-recommendations"
                      onClick={() => navigate('/recommendations')}
                    >
                      AI Matches Hub <ArrowRight size={14} />
                    </button>
                  </div>

                  <div className="recommendations-preview-grid" id="dashboard-recommendations-grid">
                    {!dashboardData.topRecommendations || dashboardData.topRecommendations.length === 0 ? (
                      <div className="widget-empty-state" id="empty-state-recommendations">
                        <Sparkles size={36} className="empty-icon text-muted" />
                        <h4>Personalized matches are loading</h4>
                        <p>Explore recommendations based on shared research interests, skills, and affiliations.</p>
                        <button
                          className="btn-create-first"
                          id="btn-empty-explore-recommendations"
                          onClick={() => navigate('/recommendations')}
                        >
                          Discover Matches
                        </button>
                      </div>
                    ) : (
                      dashboardData.topRecommendations.map((rec) => (
                        <div
                          key={rec.id}
                          className="recommendation-preview-card"
                          id={`rec-card-${rec.id}`}
                        >
                          <div className="rec-card-top">
                            <span className={`rec-category-badge cat-${rec.category.toLowerCase()}`}>
                              {rec.category}
                            </span>
                            <div className="rec-match-pill" id={`match-pill-${rec.id}`}>
                              <Sparkles size={12} /> {rec.matchScore}% Match
                            </div>
                          </div>

                          <h3 className="rec-title">{rec.title}</h3>
                          {rec.subtitle && <p className="rec-subtitle">{rec.subtitle}</p>}
                          {rec.recommendationReason && (
                            <p className="rec-reason">{rec.recommendationReason}</p>
                          )}

                          {rec.matchedTags && (
                            <div className="rec-tags-strip">
                              {rec.matchedTags.split(',').map((tag, tIdx) => (
                                <span key={tIdx} className="rec-tag-pill">
                                  {tag.trim()}
                                </span>
                              ))}
                            </div>
                          )}

                          <button
                            className="btn-view-recommendation"
                            id={`btn-view-rec-${rec.id}`}
                            onClick={() => {
                              if (rec.category.toLowerCase() === 'supervisor' || rec.category.toLowerCase() === 'teammate') {
                                navigate(`/profile/${rec.targetEntityId}`);
                              } else {
                                navigate('/recommendations');
                              }
                            }}
                          >
                            View Match <ArrowRight size={14} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              )}
            </div>

            {/* RIGHT / SECONDARY COLUMN */}
            <div className="dashboard-secondary-column">
              {/* WIDGET: TRENDING COMMUNITY DISCUSSIONS */}
              {isWidgetVisible('Community') && (
                <section
                  className="dashboard-widget-card"
                  id="widget-community-section"
                >
                  <div className="widget-header">
                    <div className="widget-header-title">
                      <MessageCircle size={20} className="widget-icon icon-purple" />
                      <h2>Community Discussions</h2>
                    </div>
                    <button
                      className="btn-widget-action"
                      id="btn-nav-all-community"
                      onClick={() => navigate('/community')}
                    >
                      Feed <ArrowRight size={14} />
                    </button>
                  </div>

                  <div className="community-summary-list" id="dashboard-community-list">
                    {!dashboardData.recentDiscussions || dashboardData.recentDiscussions.length === 0 ? (
                      <div className="widget-empty-state" id="empty-state-discussions">
                        <MessageCircle size={32} className="empty-icon text-muted" />
                        <p>No discussions yet. Start a discussion in the community!</p>
                      </div>
                    ) : (
                      dashboardData.recentDiscussions.map((post) => (
                        <div
                          key={post.postId}
                          className="community-post-mini-row"
                          id={`post-row-${post.postId}`}
                          onClick={() => navigate('/community')}
                        >
                          <div className="post-mini-category-tag">
                            {post.category || 'Discussion'}
                          </div>
                          <h4 className="post-mini-title">{post.title}</h4>
                          <div className="post-mini-meta">
                            <span className="post-mini-author">{post.authorName}</span>
                            <span className="post-mini-time">{formatTimeAgo(post.createdAt)}</span>
                          </div>
                          <div className="post-mini-stats">
                            <span className="stat-item">
                              <Flame size={13} className="text-rose" /> {post.reactionsCount} reactions
                            </span>
                            <span className="stat-item">
                              <MessageCircle size={13} className="text-blue" /> {post.commentsCount} comments
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              )}

              {/* WIDGET: PERSONAL AUDIT & ACTIVITY STREAM */}
              {isWidgetVisible('ActivityLog') && (
                <section
                  className="dashboard-widget-card"
                  id="widget-activity-section"
                >
                  <div className="widget-header">
                    <div className="widget-header-title">
                      <LayoutDashboard size={20} className="widget-icon icon-teal" />
                      <h2>Activity Timeline</h2>
                    </div>
                    <button
                      className="btn-quick-log-inline"
                      id="btn-quick-log-inline"
                      onClick={() => setShowLogActivityModal(true)}
                    >
                      <PlusCircle size={14} /> Log Milestone
                    </button>
                  </div>

                  <div className="activity-timeline-stream" id="dashboard-activity-stream">
                    {!dashboardData.recentActivities || dashboardData.recentActivities.length === 0 ? (
                      <div className="widget-empty-state" id="empty-state-activities">
                        <Clock size={32} className="empty-icon text-muted" />
                        <p>No recent activity logs. Record your research milestones!</p>
                      </div>
                    ) : (
                      dashboardData.recentActivities.map((act) => (
                        <div
                          key={act.id}
                          className="activity-timeline-item"
                          id={`activity-item-${act.id}`}
                        >
                          <div className="activity-icon-bubble">
                            {renderActivityIcon(act.activityType)}
                          </div>
                          <div className="activity-body">
                            <div className="activity-time-row">
                              <span className="activity-type-label">{act.activityType}</span>
                              <span className="activity-time-stamp">{formatTimeAgo(act.createdAt)}</span>
                            </div>
                            <h4 className="activity-title">{act.title}</h4>
                            {act.description && (
                              <p className="activity-description">{act.description}</p>
                            )}
                            {act.targetUrl && (
                              <button
                                className="activity-target-link"
                                id={`activity-link-${act.id}`}
                                onClick={() => navigate(act.targetUrl!)}
                              >
                                View Context <ExternalLink size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              )}
            </div>
          </div>

          {/* =========================================================================
              MODAL: LOG MILESTONE / RESEARCH ACTIVITY
              ========================================================================= */}
          {showLogActivityModal && (
            <div className="modal-backdrop" id="log-activity-modal-backdrop">
              <div className="modal-card" id="log-activity-modal">
                <div className="modal-header">
                  <div className="modal-title-group">
                    <PlusCircle size={20} className="text-teal" />
                    <h3>Log Research Milestone</h3>
                  </div>
                  <button
                    className="btn-modal-close"
                    id="btn-close-log-modal"
                    onClick={() => setShowLogActivityModal(false)}
                  >
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleLogActivity} className="modal-form" id="form-log-activity">
                  <div className="form-group">
                    <label htmlFor="select-activity-type">Milestone / Activity Type</label>
                    <select
                      id="select-activity-type"
                      value={newActivityType}
                      onChange={(e) => setNewActivityType(e.target.value)}
                      className="form-select"
                    >
                      <option value="MilestoneCompleted">Milestone Completed</option>
                      <option value="PaperBookmarked">Paper Bookmarked</option>
                      <option value="LiteratureReview">Literature Review</option>
                      <option value="ExperimentConducted">Experiment Conducted</option>
                      <option value="ManuscriptDrafted">Manuscript Drafted</option>
                      <option value="GrantSubmitted">Grant Application Submitted</option>
                      <option value="CustomAction">Custom Action</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="input-activity-title">Milestone Title *</label>
                    <input
                      type="text"
                      id="input-activity-title"
                      className="form-input"
                      placeholder="e.g., Completed ablation study for model architecture"
                      value={newActivityTitle}
                      onChange={(e) => setNewActivityTitle(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="input-activity-desc">Notes / Description (Optional)</label>
                    <textarea
                      id="input-activity-desc"
                      className="form-textarea"
                      placeholder="Add key insights, findings, or next steps..."
                      rows={3}
                      value={newActivityDesc}
                      onChange={(e) => setNewActivityDesc(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="input-activity-url">Related Link / Route (Optional)</label>
                    <input
                      type="text"
                      id="input-activity-url"
                      className="form-input"
                      placeholder="e.g., /workspaces or /publications"
                      value={newActivityUrl}
                      onChange={(e) => setNewActivityUrl(e.target.value)}
                    />
                  </div>

                  <div className="modal-actions">
                    <button
                      type="button"
                      className="btn-modal-cancel"
                      id="btn-cancel-log-activity"
                      onClick={() => setShowLogActivityModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn-modal-submit"
                      id="btn-submit-log-activity"
                      disabled={submittingActivity}
                    >
                      {submittingActivity ? 'Saving...' : 'Log Milestone'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* =========================================================================
              MODAL: DASHBOARD WIDGET PREFERENCES
              ========================================================================= */}
          {showPreferencesModal && (
            <div className="modal-backdrop" id="preferences-modal-backdrop">
              <div className="modal-card" id="preferences-modal">
                <div className="modal-header">
                  <div className="modal-title-group">
                    <SlidersHorizontal size={20} className="text-blue" />
                    <h3>Customize Dashboard Widgets</h3>
                  </div>
                  <button
                    className="btn-modal-close"
                    id="btn-close-prefs-modal"
                    onClick={() => setShowPreferencesModal(false)}
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="preferences-modal-body">
                  <p className="prefs-instruction">
                    Toggle which widget cards appear on your personalized research dashboard.
                  </p>

                  <div className="prefs-list">
                    {[
                      { key: 'Deadlines', label: 'Imminent Deadlines & Timelines', desc: 'Upcoming tasks, milestones, conferences and CFPs' },
                      { key: 'Workspaces', label: 'Active Workspaces & Projects', desc: 'Progress meters and next pending tasks in workspaces' },
                      { key: 'Recommendations', label: 'AI Matches & Recommendations', desc: 'Smart recommendations for advisors, teammates, and papers' },
                      { key: 'Community', label: 'Community Discussions', desc: 'Trending academic discussions and calls for collaborators' },
                      { key: 'ActivityLog', label: 'Personal Activity Timeline', desc: 'Chronological research milestones and audit logs' }
                    ].map((widget) => {
                      const enabled = isWidgetVisible(widget.key);
                      return (
                        <div
                          key={widget.key}
                          className="pref-toggle-row"
                          id={`pref-toggle-row-${widget.key}`}
                        >
                          <div className="pref-toggle-info">
                            <span className="pref-title">{widget.label}</span>
                            <span className="pref-desc">{widget.desc}</span>
                          </div>
                          <button
                            type="button"
                            className={`toggle-switch ${enabled ? 'active' : ''}`}
                            id={`toggle-widget-${widget.key}`}
                            onClick={() => toggleWidgetVisibility(widget.key)}
                          >
                            <span className="toggle-slider" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn-modal-cancel"
                    id="btn-cancel-prefs"
                    onClick={() => setShowPreferencesModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-modal-submit"
                    id="btn-save-prefs"
                    disabled={savingPrefs}
                    onClick={() => handleSavePreferences(preferences)}
                  >
                    {savingPrefs ? 'Saving...' : 'Save Preferences'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
};

export default PersonalizedDashboard;
