import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Copy,
  MessageSquareWarning,
  FileWarning,
  HelpCircle,
  Link as LinkIcon,
  Send,
  Loader2,
  RefreshCw,
  PlusCircle,
  Search,
  Lock,
  Flame,
  ArrowRight
} from 'lucide-react';
import './ReportCenter.css';
import ModerationQueue from './ModerationQueue';

const API_BASE_URL = 'http://localhost:5000/api';

export type ReportTargetType =
  | 'User'
  | 'CommunityPost'
  | 'CommunityComment'
  | 'OpenProject'
  | 'ResearchIdea'
  | 'Publication';

export interface MyReportItem {
  id: number;
  targetType: string;
  targetId: number;
  reason: string;
  description: string;
  status: string;
  reporterName: string;
  reportedUserName?: string;
  actionTaken?: string;
  submittedAt: string;
  resolvedAt?: string;
}

interface ReasonOption {
  value: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const VIOLATION_REASONS: ReasonOption[] = [
  {
    value: 'Plagiarism',
    label: 'Plagiarism / IP Theft',
    description: 'Unauthorized copying of text, figures, datasets, or intellectual property.',
    icon: <Copy size={16} className="reason-icon text-rose" />
  },
  {
    value: 'Harassment',
    label: 'Harassment or Abuse',
    description: 'Personal attacks, discriminatory remarks, intimidation, or hate speech.',
    icon: <Flame size={16} className="reason-icon text-amber" />
  },
  {
    value: 'Spam',
    label: 'Spam or Commercial Ads',
    description: 'Bulk unsolicited promotions, fraudulent services, or repetitive noise.',
    icon: <MessageSquareWarning size={16} className="reason-icon text-purple" />
  },
  {
    value: 'Misinformation',
    label: 'Fabricated Data / Fraud',
    description: 'Manipulated experiments, deceptive results, or fraudulent citations.',
    icon: <FileWarning size={16} className="reason-icon text-rose" />
  },
  {
    value: 'CopyrightViolation',
    label: 'Copyright Infringement',
    description: 'Unauthorized upload or sharing of paywalled / protected content.',
    icon: <AlertTriangle size={16} className="reason-icon text-orange" />
  },
  {
    value: 'Other',
    label: 'Other Academic Misconduct',
    description: 'General breach of ResCollab community guidelines or academic standards.',
    icon: <HelpCircle size={16} className="reason-icon text-teal" />
  }
];

export const ReportCenter: React.FC = () => {
  // Navigation Tabs: 'submit' | 'my-reports' | 'moderation'
  const [activeTab, setActiveTab] = useState<'submit' | 'my-reports' | 'moderation'>('submit');

  const userStr = localStorage.getItem('user');
  const currentUser = useMemo(() => (userStr ? JSON.parse(userStr) : null), [userStr]);
  const userRole = (currentUser?.role || currentUser?.userType || '').toLowerCase();
  const isStaff = userRole === 'admin' || userRole === 'moderator' || userRole === 'institutionaladmin';

  // Submit Form States
  const [targetType, setTargetType] = useState<ReportTargetType>('CommunityPost');
  const [targetId, setTargetId] = useState<string>('');
  const [reportedUserId, setReportedUserId] = useState<string>('');
  const [reason, setReason] = useState<string>('Plagiarism');
  const [description, setDescription] = useState<string>('');
  const [evidenceUrl, setEvidenceUrl] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // My Reports States
  const [myReports, setMyReports] = useState<MyReportItem[]>([]);
  const [loadingReports, setLoadingReports] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Toast Notification State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

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

  // Fetch My Reports
  const fetchMyReports = useCallback(async () => {
    setLoadingReports(true);
    try {
      const res = await fetch(`${API_BASE_URL}/reports/my-reports`, {
        headers: getAuthHeader()
      });

      if (res.ok) {
        const data: MyReportItem[] = await res.json();
        setMyReports(data);
      }
    } catch (err) {
      console.error('Error fetching reports:', err);
    } finally {
      setLoadingReports(false);
    }
  }, []);

  useEffect(() => {
    fetchMyReports();
  }, [fetchMyReports]);

  // Handle Form Submission
  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);

    const parsedTargetId = parseInt(targetId, 10);
    if (isNaN(parsedTargetId) || parsedTargetId <= 0) {
      setSubmitError('Please enter a valid numeric Target ID.');
      return;
    }

    if (!description.trim() || description.trim().length < 10) {
      setSubmitError('Please provide a detailed explanation of at least 10 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const parsedReportedUserId = reportedUserId.trim() ? parseInt(reportedUserId, 10) : undefined;

      const payload = {
        targetType,
        targetId: parsedTargetId,
        reportedUserId: !isNaN(parsedReportedUserId as number) ? parsedReportedUserId : undefined,
        reason,
        description: description.trim(),
        evidenceUrl: evidenceUrl.trim() || undefined
      };

      const res = await fetch(`${API_BASE_URL}/reports`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || `Failed to submit report (Status ${res.status})`);
      }

      setSubmitSuccess(`Report #${data.id} submitted successfully to the moderation committee.`);
      showToast(`Report #${data.id} submitted successfully.`);

      // Reset form
      setTargetId('');
      setReportedUserId('');
      setDescription('');
      setEvidenceUrl('');
      setReason('Plagiarism');

      // Refresh reports list
      fetchMyReports();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error submitting report.';
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered reports
  const filteredReports = useMemo(() => {
    return myReports.filter((r) => {
      const matchStatus =
        statusFilter === 'all' || r.status.toLowerCase() === statusFilter.toLowerCase();
      const matchSearch =
        !searchQuery.trim() ||
        r.reason.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.targetType.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.id.toString().includes(searchQuery.trim());
      return matchStatus && matchSearch;
    });
  }, [myReports, statusFilter, searchQuery]);

  // Status badge class
  const getStatusBadgeClass = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'status-pending';
      case 'underreview':
        return 'status-review';
      case 'resolved':
        return 'status-resolved';
      case 'dismissed':
        return 'status-dismissed';
      default:
        return 'status-pending';
    }
  };

  return (
    <div className="report-center-container" id="report-center-root">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="dashboard-toast" id="report-center-toast">
          <CheckCircle2 size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* =========================================================================
          1. HERO HEADER BANNER
          ========================================================================= */}
      <section className="report-hero-banner" id="report-hero-banner">
        <div className="report-hero-content">
          <div className="report-hero-icon-bubble">
            <ShieldAlert size={32} className="hero-shield-icon" />
          </div>
          <div className="report-hero-text">
            <div className="integrity-badge">
              <ShieldCheck size={14} /> ResCollab Academic Safety & Integrity Center
            </div>
            <h1>Research Ethics & Content Moderation</h1>
            <p>
              ResCollab is committed to an open, rigorous, and respectful academic environment.
              Submit reports regarding plagiarism, harassment, fabricated data, or copyright breaches.
              All submissions are strictly confidential.
            </p>
          </div>
        </div>

        {/* Quick Stats Strip */}
        <div className="report-stats-strip" id="report-stats-strip">
          <div className="report-stat-pill">
            <span className="stat-num">{myReports.length}</span>
            <span className="stat-label">Reports Submitted</span>
          </div>
          <div className="report-stat-pill">
            <span className="stat-num text-amber">
              {myReports.filter((r) => r.status === 'Pending' || r.status === 'UnderReview').length}
            </span>
            <span className="stat-label">Pending Evaluation</span>
          </div>
          <div className="report-stat-pill">
            <span className="stat-num text-emerald">
              {myReports.filter((r) => r.status === 'Resolved').length}
            </span>
            <span className="stat-label">Resolved Actions</span>
          </div>
        </div>
      </section>

      {/* =========================================================================
          2. TAB CONTROLS
          ========================================================================= */}
      <div className="report-tabs-nav" id="report-center-tabs">
        <button
          className={`report-tab-btn ${activeTab === 'submit' ? 'active' : ''}`}
          id="tab-submit-report"
          onClick={() => setActiveTab('submit')}
        >
          <PlusCircle size={18} />
          <span>Submit a Report</span>
        </button>
        <button
          className={`report-tab-btn ${activeTab === 'my-reports' ? 'active' : ''}`}
          id="tab-my-reports"
          onClick={() => {
            setActiveTab('my-reports');
            fetchMyReports();
          }}
        >
          <Clock size={18} />
          <span>My Submitted Reports ({myReports.length})</span>
        </button>
        {isStaff && (
          <button
            className={`report-tab-btn ${activeTab === 'moderation' ? 'active' : ''}`}
            id="tab-moderation-queue"
            onClick={() => setActiveTab('moderation')}
          >
            <ShieldCheck size={18} />
            <span>Moderation Queue</span>
          </button>
        )}
      </div>

      {/* =========================================================================
          3. TAB CONTENT: SUBMIT REPORT FORM
          ========================================================================= */}
      {activeTab === 'submit' && (
        <section className="report-card-section" id="section-submit-report">
          <div className="section-card-header">
            <div>
              <h2>File an Incident or Misconduct Report</h2>
              <p className="section-subtitle">
                Provide accurate details and context so our moderation committee can inspect the issue.
              </p>
            </div>
          </div>

          {submitSuccess && (
            <div className="alert-success-banner" id="submit-success-banner">
              <CheckCircle2 size={20} className="text-emerald" />
              <div className="banner-content">
                <strong>Submission Received</strong>
                <p>{submitSuccess}</p>
              </div>
              <button
                className="btn-link-action"
                onClick={() => setActiveTab('my-reports')}
              >
                View in My Reports <ArrowRight size={14} />
              </button>
            </div>
          )}

          {submitError && (
            <div className="alert-error-banner" id="submit-error-banner">
              <AlertTriangle size={20} className="text-rose" />
              <span>{submitError}</span>
            </div>
          )}

          <form onSubmit={handleSubmitReport} className="report-center-form" id="form-report-center">
            {/* Target Entity Selection */}
            <div className="form-group">
              <label className="field-label">Target Content or Entity Type *</label>
              <div className="target-types-selector-grid">
                {[
                  { value: 'CommunityPost', label: 'Community Post', desc: 'Discussions & announcements' },
                  { value: 'CommunityComment', label: 'Comment / Reply', desc: 'Discussion comments' },
                  { value: 'User', label: 'Researcher Profile', desc: 'User account or credentials' },
                  { value: 'OpenProject', label: 'Open Project', desc: 'Recruitment & listings' },
                  { value: 'Publication', label: 'Publication', desc: 'Paper uploads & metadata' },
                  { value: 'ResearchIdea', label: 'Research Idea', desc: 'Marketplace proposals' }
                ].map((item) => (
                  <div
                    key={item.value}
                    className={`target-type-card ${targetType === item.value ? 'selected' : ''}`}
                    id={`target-select-${item.value}`}
                    onClick={() => setTargetType(item.value as ReportTargetType)}
                  >
                    <span className="target-card-title">{item.label}</span>
                    <span className="target-card-desc">{item.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Target ID and Optional Reported User ID */}
            <div className="form-row-dual">
              <div className="form-group flex-1">
                <label htmlFor="input-target-id" className="field-label">
                  Target Entity ID *
                </label>
                <input
                  type="number"
                  id="input-target-id"
                  className="form-input"
                  placeholder="e.g. 104"
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  required
                />
                <span className="field-hint">
                  The numerical ID of the flagged {targetType} (shown in URL or card footer).
                </span>
              </div>

              <div className="form-group flex-1">
                <label htmlFor="input-reported-user-id" className="field-label">
                  Reported User ID (Optional)
                </label>
                <input
                  type="number"
                  id="input-reported-user-id"
                  className="form-input"
                  placeholder="e.g. 42 (Auto-detected if left blank)"
                  value={reportedUserId}
                  onChange={(e) => setReportedUserId(e.target.value)}
                />
                <span className="field-hint">
                  Author ID if known. Our server will automatically detect the creator if omitted.
                </span>
              </div>
            </div>

            {/* Violation Reason Selector */}
            <div className="form-group">
              <label className="field-label">Violation Category *</label>
              <div className="reason-tiles-grid">
                {VIOLATION_REASONS.map((opt) => {
                  const isSelected = reason === opt.value;
                  return (
                    <div
                      key={opt.value}
                      className={`reason-tile ${isSelected ? 'selected' : ''}`}
                      id={`reason-tile-${opt.value}`}
                      onClick={() => setReason(opt.value)}
                    >
                      <div className="reason-tile-header">
                        {opt.icon}
                        <span className="reason-tile-label">{opt.label}</span>
                      </div>
                      <p className="reason-tile-desc">{opt.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Detailed Explanation */}
            <div className="form-group">
              <div className="field-label-row">
                <label htmlFor="input-report-description" className="field-label">
                  Detailed Explanation & Evidence Narrative *
                </label>
                <span className="char-counter">{description.length}/2000</span>
              </div>
              <textarea
                id="input-report-description"
                className="form-textarea"
                rows={5}
                maxLength={2000}
                placeholder="Describe the violation in detail. Provide background context, quote problematic language, or reference uncredited work..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            {/* Supporting Evidence Link */}
            <div className="form-group">
              <label htmlFor="input-evidence-url" className="field-label">
                Supporting Evidence URL (Optional)
              </label>
              <div className="input-with-icon">
                <LinkIcon size={16} className="input-icon" />
                <input
                  type="url"
                  id="input-evidence-url"
                  className="form-input with-prefix"
                  placeholder="https://... (Link to screenshot, DOI paper, or archive link)"
                  value={evidenceUrl}
                  onChange={(e) => setEvidenceUrl(e.target.value)}
                />
              </div>
            </div>

            {/* Confidentiality Callout */}
            <div className="confidential-callout">
              <Lock size={16} className="text-emerald" />
              <span>
                Reporter Privacy Protected: All reports submitted are treated confidentially and
                reviewed in accordance with ResCollab Academic Standards.
              </span>
            </div>

            {/* Form Submit Button */}
            <div className="form-submit-row">
              <button
                type="submit"
                className="btn-submit-report-primary"
                id="btn-submit-report-primary"
                disabled={submitting || !targetId || description.trim().length < 10}
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="spin-icon" /> Processing...
                  </>
                ) : (
                  <>
                    <Send size={16} /> Submit Incident Report
                  </>
                )}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* =========================================================================
          4. TAB CONTENT: MY SUBMITTED REPORTS
          ========================================================================= */}
      {activeTab === 'my-reports' && (
        <section className="report-card-section" id="section-my-reports">
          <div className="my-reports-header">
            <div>
              <h2>Your Submitted Reports & Status</h2>
              <p className="section-subtitle">
                Track the moderation status and actions taken for incidents you flagged.
              </p>
            </div>
            <button
              className="btn-refresh-reports"
              id="btn-refresh-my-reports"
              onClick={fetchMyReports}
              disabled={loadingReports}
            >
              <RefreshCw size={15} className={loadingReports ? 'spin-icon' : ''} />
              <span>{loadingReports ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>

          {/* Filter & Search Bar */}
          <div className="reports-filter-bar">
            <div className="filter-tabs-strip" id="filter-reports-status">
              {['all', 'Pending', 'UnderReview', 'Resolved', 'Dismissed'].map((st) => (
                <button
                  key={st}
                  className={`filter-pill ${statusFilter === st ? 'active' : ''}`}
                  id={`filter-status-${st.toLowerCase()}`}
                  onClick={() => setStatusFilter(st)}
                >
                  {st === 'all' ? 'All Reports' : st}
                </button>
              ))}
            </div>

            <div className="search-box">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                id="input-search-reports"
                className="search-input"
                placeholder="Search by reason, type, ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Reports Stream */}
          <div className="reports-stream-list" id="my-reports-list">
            {loadingReports && myReports.length === 0 ? (
              <div className="loading-state-box">
                <Loader2 size={32} className="spin-icon text-muted" />
                <p>Loading your submitted reports...</p>
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="empty-reports-box" id="empty-reports-state">
                <ShieldCheck size={40} className="empty-shield-icon" />
                <h3>No Reports Found</h3>
                <p>
                  {statusFilter !== 'all' || searchQuery
                    ? 'No reports match your current filter criteria.'
                    : 'You haven’t submitted any reports yet. Thank you for contributing to an ethical academic community!'}
                </p>
                {statusFilter === 'all' && !searchQuery && (
                  <button
                    className="btn-empty-submit"
                    id="btn-empty-file-report"
                    onClick={() => setActiveTab('submit')}
                  >
                    <PlusCircle size={16} /> File a Report
                  </button>
                )}
              </div>
            ) : (
              filteredReports.map((report) => (
                <article
                  key={report.id}
                  className="report-item-card"
                  id={`report-item-${report.id}`}
                >
                  <div className="report-item-header">
                    <div className="report-header-left">
                      <span className="report-id-pill">Report #{report.id}</span>
                      <span className="target-pill">{report.targetType} #{report.targetId}</span>
                      <span className="reason-pill">{report.reason}</span>
                    </div>

                    <div className="report-header-right">
                      <span className={`status-pill ${getStatusBadgeClass(report.status)}`} id={`status-pill-${report.id}`}>
                        {report.status}
                      </span>
                      {report.actionTaken && report.actionTaken !== 'None' && (
                        <span className="action-taken-pill">
                          Action: {report.actionTaken}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="report-description-text">{report.description}</p>

                  <div className="report-footer-meta">
                    <div className="meta-left">
                      {report.reportedUserName && (
                        <span>
                          Reported User: <strong>{report.reportedUserName}</strong>
                        </span>
                      )}
                      <span>&bull;</span>
                      <span>
                        Submitted {new Date(report.submittedAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </span>
                    </div>

                    {report.resolvedAt && (
                      <div className="meta-right text-emerald">
                        <CheckCircle2 size={14} /> Resolved {new Date(report.resolvedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      )}

      {/* =========================================================================
          4. TAB CONTENT: MODERATION QUEUE (STAFF ONLY)
          ========================================================================= */}
      {activeTab === 'moderation' && (
        <section className="report-card-section" id="section-moderation-embed" style={{ padding: '0', background: 'transparent', border: 'none', boxShadow: 'none' }}>
          <ModerationQueue embedMode={true} />
        </section>
      )}

      {/* =========================================================================
          5. ACADEMIC INTEGRITY STANDARDS & FAQ ACCORDION
          ========================================================================= */}
      <section className="report-info-card" id="report-guidelines-section">
        <h3>ResCollab Academic Integrity Standards</h3>
        <div className="standards-grid">
          <div className="standard-item">
            <h4>1. Uncompromising Confidentiality</h4>
            <p>
              Your identity is protected under ResCollab academic whistleblower guidelines. The reported
              party is never notified of who filed the report.
            </p>
          </div>
          <div className="standard-item">
            <h4>2. Impartial Committee Review</h4>
            <p>
              All submissions are investigated by accredited academic moderators. Actions range from
              content redaction to formal institutional warnings.
            </p>
          </div>
          <div className="standard-item">
            <h4>3. False Reporting Policy</h4>
            <p>
              To protect researchers against vexatious claims, intentionally submitting fabricated or
              malicious reports is strictly prohibited and subject to account review.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ReportCenter;
