import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  RefreshCw,
  ExternalLink,
  User,
  MessageSquare,
  MessageCircle,
  Folder,
  Lightbulb,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Eye,
  Check,
  X,
  History,
  FileText,
  AlertOctagon,
  ArrowRight
} from 'lucide-react';
import './ModerationQueue.css';

const API_BASE_URL = 'http://localhost:5000/api';

export type ReportTargetType =
  | 'User'
  | 'CommunityPost'
  | 'CommunityComment'
  | 'OpenProject'
  | 'ResearchIdea'
  | 'Publication';

export interface ReportItem {
  id: number;
  targetType: string;
  targetId: number;
  reason: string;
  description: string;
  status: string;
  reporterName: string;
  reportedUserName?: string;
  moderatorName?: string;
  actionTaken?: string;
  submittedAt: string;
  resolvedAt?: string;
}

export interface ModerationAuditLogItem {
  id: number;
  moderatorId: number;
  moderatorName: string;
  previousStatus: string;
  newStatus: string;
  actionDetails: string;
  timestamp: string;
}

export interface ReportDetailItem extends ReportItem {
  reporterId: number;
  reportedUserId?: number;
  evidenceUrl?: string;
  moderatorId?: number;
  resolutionNote?: string;
  targetTitle?: string;
  targetContentPreview?: string;
  targetUrl?: string;
  auditLogs: ModerationAuditLogItem[];
}

export interface ModerationStats {
  totalReports: number;
  pendingCount: number;
  underReviewCount: number;
  resolvedCount: number;
  dismissedCount: number;
  byReason: Array<{ reason: string; count: number }>;
  byTargetType: Array<{ targetType: string; count: number }>;
  actionsBreakdown: Array<{ action: string; count: number }>;
}

export interface ModerationQueueProps {
  embedMode?: boolean;
}

const CANNED_JUSTIFICATIONS = [
  'Confirmed plagiarism or uncredited reproduction of scholarly material.',
  'Content contains harassment or abusive conduct violating community guidelines.',
  'Spam or commercial advertisement with no scholarly academic value.',
  'Inaccurate or misleading claims violating scientific integrity standards.',
  'Copyright violation: unauthorized redistribution of copyrighted literature.',
  'Reviewed content: substantiated compliance with academic freedom & guidelines.'
];

export const ModerationQueue: React.FC<ModerationQueueProps> = ({ embedMode = false }) => {
  // Authentication & Role
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const currentUser = useMemo(() => (userStr ? JSON.parse(userStr) : null), [userStr]);
  const userRole = (currentUser?.role || currentUser?.userType || '').toLowerCase();

  const isAuthorized = useMemo(() => {
    return userRole === 'admin' || userRole === 'moderator' || userRole === 'institutionaladmin';
  }, [userRole]);

  // Queue Data States
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Stats State
  const [stats, setStats] = useState<ModerationStats | null>(null);

  // Filters State
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [targetTypeFilter, setTargetTypeFilter] = useState<string>('All');
  const [reasonFilter, setReasonFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');

  // Review Modal / Drawer States
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const [reportDetail, setReportDetail] = useState<ReportDetailItem | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  // Decision Form States
  const [decisionStatus, setDecisionStatus] = useState<string>('UnderReview');
  const [decisionAction, setDecisionAction] = useState<string>('None');
  const [resolutionNote, setResolutionNote] = useState<string>('');
  const [submittingDecision, setSubmittingDecision] = useState<boolean>(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const getAuthHeader = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }, [token]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch Stats
  const fetchStats = useCallback(async () => {
    if (!isAuthorized) return;
    try {
      const res = await fetch(`${API_BASE_URL}/reports/stats`, {
        headers: getAuthHeader()
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch moderation stats:', err);
    }
  }, [isAuthorized, getAuthHeader]);

  // Fetch Reports Queue
  const fetchReports = useCallback(async () => {
    if (!isAuthorized) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'All') params.append('status', statusFilter);
      if (targetTypeFilter && targetTypeFilter !== 'All') params.append('targetType', targetTypeFilter);
      if (reasonFilter && reasonFilter !== 'All') params.append('reason', reasonFilter);
      if (debouncedSearch.trim()) params.append('search', debouncedSearch.trim());
      params.append('page', page.toString());
      params.append('pageSize', pageSize.toString());

      const res = await fetch(`${API_BASE_URL}/reports?${params.toString()}`, {
        headers: getAuthHeader()
      });

      if (res.ok) {
        const data = await res.json();
        setReports(data.items || []);
        setTotalCount(data.totalCount || 0);
        setTotalPages(data.totalPages || 1);
      } else if (res.status === 403) {
        showToast('Access denied: You do not possess moderator clearance.');
      }
    } catch (err) {
      console.error('Error fetching reports queue:', err);
      showToast('Error loading moderation queue.');
    } finally {
      setLoading(false);
    }
  }, [isAuthorized, statusFilter, targetTypeFilter, reasonFilter, debouncedSearch, page, pageSize, getAuthHeader]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Open Report Detail Modal
  const handleOpenReview = async (id: number) => {
    setSelectedReportId(id);
    setLoadingDetail(true);
    setDecisionError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/reports/${id}`, {
        headers: getAuthHeader()
      });
      if (res.ok) {
        const data: ReportDetailItem = await res.json();
        setReportDetail(data);
        // Pre-populate decision fields
        setDecisionStatus(data.status === 'Pending' ? 'UnderReview' : data.status);
        setDecisionAction(data.actionTaken || 'None');
        setResolutionNote(data.resolutionNote || '');
      } else {
        showToast('Failed to fetch report details.');
        setSelectedReportId(null);
      }
    } catch (err) {
      console.error('Error fetching report detail:', err);
      showToast('Error fetching report detail.');
      setSelectedReportId(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCloseReview = () => {
    setSelectedReportId(null);
    setReportDetail(null);
    setDecisionError(null);
  };

  // Submit Moderation Decision
  const handleSubmitDecision = async () => {
    if (!selectedReportId) return;

    if ((decisionStatus === 'Resolved' || decisionStatus === 'Dismissed') && !resolutionNote.trim()) {
      setDecisionError('Please provide a written justification or findings rationale.');
      return;
    }

    setSubmittingDecision(true);
    setDecisionError(null);

    try {
      const payload = {
        status: decisionStatus,
        resolutionNote: resolutionNote.trim(),
        actionTaken: decisionAction
      };

      const res = await fetch(`${API_BASE_URL}/reports/${selectedReportId}/status`, {
        method: 'PUT',
        headers: getAuthHeader(),
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast(`✓ Report #${selectedReportId} successfully updated to ${decisionStatus}.`);
        handleCloseReview();
        fetchReports();
        fetchStats();
      } else {
        const errData = await res.json().catch(() => ({}));
        setDecisionError(errData.message || 'Failed to submit decision.');
      }
    } catch (err) {
      console.error('Error submitting decision:', err);
      setDecisionError('Network error submitting moderation decision.');
    } finally {
      setSubmittingDecision(false);
    }
  };

  // Quick Action: Triage to UnderReview
  const handleQuickInvestigate = async (reportId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`${API_BASE_URL}/reports/${reportId}/status`, {
        method: 'PUT',
        headers: getAuthHeader(),
        body: JSON.stringify({
          status: 'UnderReview',
          resolutionNote: 'Claimed for formal review by moderator.',
          actionTaken: 'None'
        })
      });
      if (res.ok) {
        showToast(`Report #${reportId} moved to Under Review.`);
        fetchReports();
        fetchStats();
      }
    } catch {
      showToast('Failed to update status.');
    }
  };

  // Helpers
  const formatRelativeTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;
    const diffDays = Math.floor(diffHour / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  const getTargetIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'user':
        return <User size={15} className="target-badge-icon" />;
      case 'communitypost':
        return <MessageSquare size={15} className="target-badge-icon" />;
      case 'communitycomment':
        return <MessageCircle size={15} className="target-badge-icon" />;
      case 'openproject':
        return <Folder size={15} className="target-badge-icon" />;
      case 'researchidea':
        return <Lightbulb size={15} className="target-badge-icon" />;
      case 'publication':
        return <BookOpen size={15} className="target-badge-icon" />;
      default:
        return <FileText size={15} className="target-badge-icon" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Pending':
        return <span className="mod-badge badge-pending"><Clock size={12} /> Pending</span>;
      case 'UnderReview':
        return <span className="mod-badge badge-review"><Eye size={12} /> Under Review</span>;
      case 'Resolved':
        return <span className="mod-badge badge-resolved"><CheckCircle2 size={12} /> Resolved</span>;
      case 'Dismissed':
        return <span className="mod-badge badge-dismissed"><XCircle size={12} /> Dismissed</span>;
      default:
        return <span className="mod-badge badge-default">{status}</span>;
    }
  };

  const getReasonBadgeClass = (reason: string) => {
    switch (reason.toLowerCase()) {
      case 'plagiarism':
        return 'reason-tag-rose';
      case 'harassment':
        return 'reason-tag-amber';
      case 'spam':
        return 'reason-tag-purple';
      case 'misinformation':
        return 'reason-tag-cyan';
      case 'copyrightviolation':
        return 'reason-tag-orange';
      default:
        return 'reason-tag-slate';
    }
  };

  // If unauthorized, render security barrier
  if (!isAuthorized) {
    return (
      <div className={`moderation-container ${embedMode ? 'embedded' : ''}`} id="moderation-unauthorized-view">
        <div className="security-barrier-card">
          <div className="barrier-icon-wrapper">
            <ShieldAlert size={48} className="text-rose" />
          </div>
          <h2>Privileged Moderation Access Required</h2>
          <p>
            The ResCollab Content & User Moderation Queue is strictly restricted to designated
            platform administrators, moderators, and institutional academic integrity officers.
          </p>
          <div className="barrier-badge">
            Current Role: <strong>{currentUser?.role || 'Standard Researcher'}</strong>
          </div>
          <div className="barrier-actions">
            <a href="/reports" className="btn-return-action" id="btn-return-reports">
              <ArrowRight size={16} /> Return to Report Center
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`moderation-container ${embedMode ? 'embedded' : ''}`} id="moderation-queue-page">
      {/* =========================================================================
          1. HEADER & HERO
          ========================================================================= */}
      <div className="moderation-header">
        <div className="moderation-title-group">
          <div className="mod-header-icon-box">
            <ShieldCheck size={28} className="text-indigo" />
          </div>
          <div>
            <h1>Academic Integrity & Moderation Queue</h1>
            <p>
              Triage user incident reports, conduct peer inquiry reviews, and enforce community standards.
            </p>
          </div>
        </div>

        <div className="header-meta-actions">
          <button
            className="btn-refresh-mod"
            id="btn-refresh-queue"
            onClick={() => {
              fetchReports();
              fetchStats();
              showToast('Queue refreshed.');
            }}
            title="Refresh queue"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          2. METRICS & SUMMARY OVERVIEW CARDS
          ========================================================================= */}
      {stats && (
        <div className="moderation-stats-grid" id="moderation-stats-overview">
          <div
            className={`mod-stat-card ${statusFilter === 'All' ? 'active-filter-card' : ''}`}
            onClick={() => {
              setStatusFilter('All');
              setPage(1);
            }}
          >
            <div className="stat-card-top">
              <span className="stat-label">Total Submissions</span>
              <FileText size={18} className="stat-icon text-indigo" />
            </div>
            <div className="stat-number">{stats.totalReports}</div>
            <div className="stat-footnote">Across all entity types</div>
          </div>

          <div
            className={`mod-stat-card stat-pending ${statusFilter === 'Pending' ? 'active-filter-card' : ''}`}
            id="card-stat-pending"
            onClick={() => {
              setStatusFilter('Pending');
              setPage(1);
            }}
          >
            <div className="stat-card-top">
              <span className="stat-label">Pending Triage</span>
              <Clock size={18} className="stat-icon text-amber" />
            </div>
            <div className="stat-number text-amber">{stats.pendingCount}</div>
            <div className="stat-footnote">Awaiting initial inspection</div>
          </div>

          <div
            className={`mod-stat-card stat-review ${statusFilter === 'UnderReview' ? 'active-filter-card' : ''}`}
            id="card-stat-review"
            onClick={() => {
              setStatusFilter('UnderReview');
              setPage(1);
            }}
          >
            <div className="stat-card-top">
              <span className="stat-label">Under Investigation</span>
              <Eye size={18} className="stat-icon text-blue" />
            </div>
            <div className="stat-number text-blue">{stats.underReviewCount}</div>
            <div className="stat-footnote">Active moderator scrutiny</div>
          </div>

          <div
            className={`mod-stat-card stat-resolved ${statusFilter === 'Resolved' ? 'active-filter-card' : ''}`}
            id="card-stat-resolved"
            onClick={() => {
              setStatusFilter('Resolved');
              setPage(1);
            }}
          >
            <div className="stat-card-top">
              <span className="stat-label">Resolved & Enforced</span>
              <CheckCircle2 size={18} className="stat-icon text-emerald" />
            </div>
            <div className="stat-number text-emerald">{stats.resolvedCount}</div>
            <div className="stat-footnote">Corrective action applied</div>
          </div>

          <div
            className={`mod-stat-card stat-dismissed ${statusFilter === 'Dismissed' ? 'active-filter-card' : ''}`}
            id="card-stat-dismissed"
            onClick={() => {
              setStatusFilter('Dismissed');
              setPage(1);
            }}
          >
            <div className="stat-card-top">
              <span className="stat-label">Dismissed</span>
              <XCircle size={18} className="stat-icon text-slate" />
            </div>
            <div className="stat-number text-slate">{stats.dismissedCount}</div>
            <div className="stat-footnote">No policy violation detected</div>
          </div>
        </div>
      )}

      {/* =========================================================================
          3. FILTER & SEARCH TOOLBAR
          ========================================================================= */}
      <div className="moderation-controls-bar" id="moderation-controls-bar">
        {/* Search Input */}
        <div className="mod-search-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            id="input-moderation-search"
            className="mod-search-input"
            placeholder="Search reports by keyword, target, reporter, or reported user..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="btn-clear-search"
              onClick={() => setSearchQuery('')}
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filters Group */}
        <div className="mod-dropdowns-group">
          {/* Status Filter */}
          <div className="filter-select-wrap">
            <label htmlFor="select-status-filter" className="sr-only">Status Filter</label>
            <select
              id="select-status-filter"
              className="mod-select"
              value={statusFilter}
              onChange={e => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="UnderReview">Under Review</option>
              <option value="Resolved">Resolved</option>
              <option value="Dismissed">Dismissed</option>
            </select>
          </div>

          {/* Target Type Filter */}
          <div className="filter-select-wrap">
            <label htmlFor="select-target-type-filter" className="sr-only">Target Type Filter</label>
            <select
              id="select-target-type-filter"
              className="mod-select"
              value={targetTypeFilter}
              onChange={e => {
                setTargetTypeFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="All">All Target Types</option>
              <option value="CommunityPost">Community Posts</option>
              <option value="CommunityComment">Comments & Replies</option>
              <option value="User">User Profiles</option>
              <option value="OpenProject">Research Projects</option>
              <option value="ResearchIdea">Research Ideas</option>
              <option value="Publication">Publications</option>
            </select>
          </div>

          {/* Violation Reason Filter */}
          <div className="filter-select-wrap">
            <label htmlFor="select-reason-filter" className="sr-only">Reason Filter</label>
            <select
              id="select-reason-filter"
              className="mod-select"
              value={reasonFilter}
              onChange={e => {
                setReasonFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="All">All Reasons</option>
              <option value="Plagiarism">Plagiarism</option>
              <option value="Harassment">Harassment</option>
              <option value="Spam">Spam</option>
              <option value="Misinformation">Misinformation</option>
              <option value="CopyrightViolation">Copyright Violation</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Page Size Filter */}
          <div className="filter-select-wrap">
            <label htmlFor="select-page-size" className="sr-only">Page Size</label>
            <select
              id="select-page-size"
              className="mod-select"
              value={pageSize}
              onChange={e => {
                setPageSize(parseInt(e.target.value, 10));
                setPage(1);
              }}
            >
              <option value="10">10 per page</option>
              <option value="15">15 per page</option>
              <option value="25">25 per page</option>
              <option value="50">50 per page</option>
            </select>
          </div>

          {/* Active Filters Clear Button */}
          {(statusFilter !== 'All' || targetTypeFilter !== 'All' || reasonFilter !== 'All' || debouncedSearch) && (
            <button
              className="btn-reset-filters"
              onClick={() => {
                setStatusFilter('All');
                setTargetTypeFilter('All');
                setReasonFilter('All');
                setSearchQuery('');
                setPage(1);
              }}
              title="Reset all filters"
            >
              <X size={14} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* =========================================================================
          4. MODERATION QUEUE LIST / TABLE
          ========================================================================= */}
      <div className="moderation-queue-container" id="moderation-queue-table-view">
        {loading ? (
          <div className="mod-loading-state">
            <RefreshCw size={32} className="animate-spin text-indigo" />
            <p>Scanning moderation ledger...</p>
          </div>
        ) : reports.length === 0 ? (
          <div className="mod-empty-state" id="moderation-empty-notice">
            <ShieldCheck size={48} className="text-emerald" />
            <h3>All Clear — Queue Empty</h3>
            <p>
              {debouncedSearch || statusFilter !== 'All' || targetTypeFilter !== 'All' || reasonFilter !== 'All'
                ? 'No reports match your selected criteria. Try resetting the filters.'
                : 'There are currently no active or pending reports in the moderation queue.'}
            </p>
          </div>
        ) : (
          <div className="mod-table-wrapper">
            <table className="mod-table">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>ID</th>
                  <th style={{ width: '150px' }}>Target Entity</th>
                  <th style={{ width: '140px' }}>Reason</th>
                  <th>Incident Context</th>
                  <th style={{ width: '130px' }}>Parties</th>
                  <th style={{ width: '120px' }}>Status</th>
                  <th style={{ width: '110px' }}>Action</th>
                  <th style={{ width: '110px' }}>Submitted</th>
                  <th style={{ width: '130px', textAlign: 'right' }}>Review</th>
                </tr>
              </thead>
              <tbody>
                {reports.map(report => (
                  <tr
                    key={report.id}
                    className={`mod-table-row ${selectedReportId === report.id ? 'row-selected' : ''}`}
                    id={`report-row-${report.id}`}
                    onClick={() => handleOpenReview(report.id)}
                  >
                    {/* ID */}
                    <td className="cell-id">
                      <span className="id-badge">#{report.id}</span>
                    </td>

                    {/* Target Entity */}
                    <td className="cell-target">
                      <div className="target-chip">
                        {getTargetIcon(report.targetType)}
                        <span>{report.targetType}</span>
                      </div>
                      <span className="target-ref-id">ID: {report.targetId}</span>
                    </td>

                    {/* Reason */}
                    <td className="cell-reason">
                      <span className={`reason-pill ${getReasonBadgeClass(report.reason)}`}>
                        {report.reason}
                      </span>
                    </td>

                    {/* Description Snippet */}
                    <td className="cell-context">
                      <div className="report-desc-preview" title={report.description}>
                        {report.description}
                      </div>
                    </td>

                    {/* Parties */}
                    <td className="cell-parties">
                      <div className="party-line">
                        <span className="party-tag reported-party">Against:</span>
                        <span className="party-name" title={report.reportedUserName || 'Unknown'}>
                          {report.reportedUserName || 'User'}
                        </span>
                      </div>
                      <div className="party-line">
                        <span className="party-tag reporter-party">By:</span>
                        <span className="party-name" title={report.reporterName}>
                          {report.reporterName}
                        </span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="cell-status" id={`status-cell-${report.id}`}>
                      {getStatusBadge(report.status)}
                    </td>

                    {/* Action Taken */}
                    <td className="cell-action">
                      {report.actionTaken && report.actionTaken !== 'None' ? (
                        <span className="action-taken-badge" title={`Action: ${report.actionTaken}`}>
                          {report.actionTaken}
                        </span>
                      ) : (
                        <span className="action-none">—</span>
                      )}
                    </td>

                    {/* Submitted Date */}
                    <td className="cell-date">
                      <span className="date-relative" title={new Date(report.submittedAt).toLocaleString()}>
                        {formatRelativeTime(report.submittedAt)}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="cell-buttons" style={{ textAlign: 'right' }}>
                      <div className="row-action-buttons">
                        {report.status === 'Pending' && (
                          <button
                            className="btn-quick-triage"
                            id={`btn-triage-report-${report.id}`}
                            title="Claim for review"
                            onClick={e => handleQuickInvestigate(report.id, e)}
                          >
                            <Eye size={13} />
                          </button>
                        )}
                        <button
                          className="btn-review-cta"
                          id={`btn-review-report-${report.id}`}
                          onClick={e => {
                            e.stopPropagation();
                            handleOpenReview(report.id);
                          }}
                        >
                          Review
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="mod-pagination-bar" id="moderation-pagination">
            <span className="pagination-info">
              Showing {reports.length} of {totalCount} reports (Page {page} of {totalPages})
            </span>
            <div className="pagination-buttons">
              <button
                className="btn-page-nav"
                id="btn-prev-page"
                disabled={page <= 1}
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
              >
                <ChevronLeft size={16} /> Prev
              </button>
              <span className="current-page-badge">{page}</span>
              <button
                className="btn-page-nav"
                id="btn-next-page"
                disabled={page >= totalPages}
                onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          5. REVIEW & DECISION MODAL / DRAWER
          ========================================================================= */}
      {selectedReportId && (
        <div className="mod-modal-backdrop" id="modal-moderation-review" onClick={handleCloseReview}>
          <div className="mod-modal-card" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="mod-modal-header">
              <div className="modal-header-left">
                <span className="modal-case-tag">Case #{selectedReportId}</span>
                {reportDetail && (
                  <div className="modal-type-badge">
                    {getTargetIcon(reportDetail.targetType)}
                    <span>{reportDetail.targetType} #{reportDetail.targetId}</span>
                  </div>
                )}
                {reportDetail && getStatusBadge(reportDetail.status)}
              </div>
              <button className="btn-modal-close" id="btn-close-review-modal" onClick={handleCloseReview}>
                <X size={20} />
              </button>
            </div>

            {loadingDetail ? (
              <div className="mod-modal-loading">
                <RefreshCw size={30} className="animate-spin text-indigo" />
                <p>Retrieving target records & audit logs...</p>
              </div>
            ) : reportDetail ? (
              <div className="mod-modal-body">
                {/* 2-Column Split: Context & Details on Left, Decision Form on Right */}
                <div className="mod-modal-grid">
                  {/* LEFT COLUMN: Target and Complaint Evidence */}
                  <div className="mod-modal-col-context">
                    {/* Target Information Card */}
                    <div className="detail-section-card">
                      <div className="detail-card-title">
                        <FileText size={16} className="text-indigo" />
                        <h3>Flagged Target Entity</h3>
                      </div>

                      <div className="target-context-box">
                        <div className="target-header-row">
                          <span className="target-type-label">{reportDetail.targetType}</span>
                          <span className="target-id-label">Record #{reportDetail.targetId}</span>
                          {reportDetail.targetUrl && (
                            <a
                              href={reportDetail.targetUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="target-external-link"
                              id="link-view-target"
                            >
                              Open Target <ExternalLink size={12} />
                            </a>
                          )}
                        </div>

                        {reportDetail.targetTitle && (
                          <div className="target-title-display">
                            <strong>Title / Subject:</strong> {reportDetail.targetTitle}
                          </div>
                        )}

                        {reportDetail.targetContentPreview && (
                          <div className="target-content-quote">
                            <span className="quote-label">Content Excerpt:</span>
                            <p>{reportDetail.targetContentPreview}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Complaint & Evidence Card */}
                    <div className="detail-section-card">
                      <div className="detail-card-title">
                        <AlertTriangle size={16} className="text-rose" />
                        <h3>Reporter Allegations & Evidence</h3>
                      </div>

                      <div className="complaint-summary-box">
                        <div className="complaint-meta-grid">
                          <div>
                            <span className="meta-label">Reported Party</span>
                            <span className="meta-value font-medium text-slate-800">
                              {reportDetail.reportedUserName || `User #${reportDetail.reportedUserId || 'N/A'}`}
                            </span>
                          </div>
                          <div>
                            <span className="meta-label">Filing Reporter</span>
                            <span className="meta-value font-medium text-slate-800">
                              {reportDetail.reporterName} (Confidential)
                            </span>
                          </div>
                          <div>
                            <span className="meta-label">Violation Category</span>
                            <span className={`reason-pill ${getReasonBadgeClass(reportDetail.reason)}`}>
                              {reportDetail.reason}
                            </span>
                          </div>
                          <div>
                            <span className="meta-label">Submitted On</span>
                            <span className="meta-value">
                              {new Date(reportDetail.submittedAt).toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {/* Detailed Description */}
                        <div className="complaint-narrative">
                          <span className="narrative-label">Reporter Narrative:</span>
                          <div className="narrative-text">{reportDetail.description}</div>
                        </div>

                        {/* Evidence Link */}
                        {reportDetail.evidenceUrl && (
                          <div className="evidence-link-row">
                            <span className="evidence-label">Documentary Evidence:</span>
                            <a
                              href={reportDetail.evidenceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="evidence-anchor"
                              id="link-view-evidence"
                            >
                              {reportDetail.evidenceUrl} <ExternalLink size={12} />
                            </a>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Audit Trail Timeline */}
                    <div className="detail-section-card">
                      <div className="detail-card-title">
                        <History size={16} className="text-slate" />
                        <h3>Moderation Audit Trail ({reportDetail.auditLogs?.length || 0})</h3>
                      </div>

                      {reportDetail.auditLogs && reportDetail.auditLogs.length > 0 ? (
                        <div className="audit-timeline" id="moderation-audit-timeline">
                          {reportDetail.auditLogs.map(log => (
                            <div key={log.id} className="timeline-item">
                              <div className="timeline-marker"></div>
                              <div className="timeline-content">
                                <div className="timeline-header">
                                  <span className="timeline-moderator">{log.moderatorName}</span>
                                  <span className="timeline-transition">
                                    {log.previousStatus} ➔ <strong>{log.newStatus}</strong>
                                  </span>
                                  <span className="timeline-date">
                                    {new Date(log.timestamp).toLocaleString()}
                                  </span>
                                </div>
                                <div className="timeline-details">{log.actionDetails}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="audit-empty-note">
                          No previous decisions logged. This ticket is in its initial submission state.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* RIGHT COLUMN: Moderation Decision Workspace */}
                  <div className="mod-modal-col-decision">
                    <div className="decision-workspace-card">
                      <div className="workspace-title">
                        <ShieldAlert size={18} className="text-indigo" />
                        <h3>Adjudicate & Record Decision</h3>
                      </div>

                      <p className="workspace-subtitle">
                        Record institutional findings. Decisions update the ticket status, execute
                        content policies, and log an immutable audit record.
                      </p>

                      {decisionError && (
                        <div className="decision-alert-error" id="decision-error-banner">
                          <AlertOctagon size={16} />
                          <span>{decisionError}</span>
                        </div>
                      )}

                      {/* Decision Status Selector */}
                      <div className="decision-field-group">
                        <label className="field-label">Target Review Status *</label>
                        <div className="status-selector-grid">
                          <button
                            type="button"
                            className={`status-choice-btn btn-choice-review ${decisionStatus === 'UnderReview' ? 'selected' : ''}`}
                            id="btn-status-under-review"
                            onClick={() => setDecisionStatus('UnderReview')}
                          >
                            <Eye size={15} />
                            <span>Under Review</span>
                          </button>

                          <button
                            type="button"
                            className={`status-choice-btn btn-choice-resolve ${decisionStatus === 'Resolved' ? 'selected' : ''}`}
                            id="btn-status-resolved"
                            onClick={() => setDecisionStatus('Resolved')}
                          >
                            <CheckCircle2 size={15} />
                            <span>Resolved</span>
                          </button>

                          <button
                            type="button"
                            className={`status-choice-btn btn-choice-dismiss ${decisionStatus === 'Dismissed' ? 'selected' : ''}`}
                            id="btn-status-dismissed"
                            onClick={() => setDecisionStatus('Dismissed')}
                          >
                            <XCircle size={15} />
                            <span>Dismissed</span>
                          </button>
                        </div>
                      </div>

                      {/* Action Taken Selector */}
                      <div className="decision-field-group">
                        <label className="field-label" htmlFor="select-action-taken">
                          Policy Enforcement Action
                        </label>
                        <select
                          id="select-action-taken"
                          className="decision-select"
                          value={decisionAction}
                          onChange={e => setDecisionAction(e.target.value)}
                        >
                          <option value="None">None (Observation / Dismissal)</option>
                          <option value="ContentRemoved">Content Removed (Redact from Platform)</option>
                          <option value="WarningIssued">Warning Issued (Academic Notice to User)</option>
                          <option value="AccountSuspended">Account Suspended (Restricted Access)</option>
                        </select>
                        <span className="field-hint">
                          Selecting "Content Removed" will automatically redact the flagged post or comment.
                        </span>
                      </div>

                      {/* Resolution Note Textarea */}
                      <div className="decision-field-group">
                        <div className="field-label-row">
                          <label className="field-label" htmlFor="textarea-resolution-note">
                            Findings & Policy Justification *
                          </label>
                          <span className="char-count">{resolutionNote.length} / 2000</span>
                        </div>
                        <textarea
                          id="textarea-resolution-note"
                          className="decision-textarea"
                          rows={4}
                          maxLength={2000}
                          placeholder="Document the investigative rationale, evidence citations, or dismissal basis..."
                          value={resolutionNote}
                          onChange={e => setResolutionNote(e.target.value)}
                        />
                      </div>

                      {/* Quick Canned Rationale Helpers */}
                      <div className="canned-rationales-box">
                        <span className="canned-title">Standard Findings Templates:</span>
                        <div className="canned-buttons-cloud">
                          {CANNED_JUSTIFICATIONS.map((just, idx) => (
                            <button
                              key={idx}
                              type="button"
                              className="canned-chip"
                              onClick={() => setResolutionNote(just)}
                            >
                              {just.slice(0, 36)}...
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Submit Action Button */}
                      <div className="decision-submit-row">
                        <button
                          type="button"
                          className="btn-cancel-decision"
                          onClick={handleCloseReview}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="btn-confirm-decision"
                          id="btn-submit-decision"
                          disabled={submittingDecision}
                          onClick={handleSubmitDecision}
                        >
                          {submittingDecision ? (
                            <>
                              <RefreshCw size={16} className="animate-spin" />
                              <span>Enforcing Decision...</span>
                            </>
                          ) : (
                            <>
                              <Check size={16} />
                              <span>Commit Moderation Decision</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Toast Feedback */}
      {toastMessage && (
        <div className="mod-toast-notice" id="moderation-toast">
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default ModerationQueue;
