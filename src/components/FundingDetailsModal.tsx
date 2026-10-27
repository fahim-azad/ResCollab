import React, { useState } from 'react';
import { 
  X, ExternalLink, Calendar, Building2, CheckCircle2, 
  DollarSign, Clock, FileText, Share2, Check, 
  Award, ArrowRight, Download, Edit3, Trash2, Tag, Shield,
  CheckSquare, Square, UserCheck, AlertTriangle, Sparkles
} from 'lucide-react';

export interface FundingOpportunityDetail {
  id: number;
  title: string;
  provider: string;
  description?: string | null;
  eligibility?: string | null;
  requirements?: string | null;
  fundingAmount?: string | null;
  fundingType: string;
  researchArea?: string | null;
  applicationUrl?: string | null;
  applicationInfo?: string | null;
  deadline?: string | null;
  status: string;
  postedById?: number | null;
  postedByName?: string | null;
  createdAt: string;
  updatedAt?: string;
}

interface FundingDetailsModalProps {
  opportunity: FundingOpportunityDetail;
  isOwner?: boolean;
  userRole?: string | null;
  onClose: () => void;
  onEdit?: (opp: FundingOpportunityDetail) => void;
  onDelete?: (id: number) => void;
  onStatusToggle?: (id: number, currentStatus: string) => void;
}

export const parseRequirements = (req?: string | null): string[] => {
  if (!req) return [];
  return req
    .split(/;|\n|\u2022|\d+\.\s/)
    .map(s => s.trim().replace(/^[-*•]\s*/, ''))
    .filter(s => s.length > 2);
};

export const evaluateEligibility = (userRole?: string | null, eligibility?: string | null) => {
  if (!eligibility) return { match: true, text: 'Open to All Qualified Researchers', type: 'open' };
  const e = eligibility.toLowerCase();
  const r = (userRole || '').toLowerCase();

  const isStudent = r.includes('student');
  const isSupervisor = r.includes('supervisor') || r.includes('faculty') || r.includes('professor');

  const targetsStudent = e.includes('student') || e.includes('phd') || e.includes('graduate') || e.includes('undergraduate');
  const targetsFaculty = e.includes('faculty') || e.includes('principal investigator') || e.includes('pi') || e.includes('professor') || e.includes('tenured');
  const targetsPostdoc = e.includes('postdoc') || e.includes('postdoctoral');

  if (isStudent && targetsStudent) {
    return { match: true, text: 'Profile Match: Eligible for Students & PhD Candidates', type: 'match' };
  }
  if (isSupervisor && targetsFaculty) {
    return { match: true, text: 'Profile Match: Eligible for Faculty & Principal Investigators', type: 'match' };
  }
  if (targetsPostdoc) {
    return { match: null, text: 'Target: Postdoctoral Researcher Standing', type: 'postdoc' };
  }
  if (targetsFaculty && isStudent) {
    return { match: false, text: 'Target Notice: Faculty / Principal Investigator Standing Required', type: 'notice' };
  }
  return { match: true, text: 'Broad Academic Eligibility', type: 'open' };
};

export const FundingDetailsModal: React.FC<FundingDetailsModalProps> = ({
  opportunity,
  isOwner,
  userRole,
  onClose,
  onEdit,
  onDelete,
  onStatusToggle,
}) => {
  const [copied, setCopied] = useState(false);

  // Requirements checklist state with localStorage persistence
  const requirementsList = parseRequirements(opportunity.requirements);
  const checklistStorageKey = `funding_reqs_checklist_${opportunity.id}`;

  const [completedReqs, setCompletedReqs] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(checklistStorageKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const toggleRequirement = (reqItem: string) => {
    setCompletedReqs(prev => {
      const next = prev.includes(reqItem)
        ? prev.filter(r => r !== reqItem)
        : [...prev, reqItem];
      localStorage.setItem(checklistStorageKey, JSON.stringify(next));
      return next;
    });
  };

  const clearChecklist = () => {
    setCompletedReqs([]);
    localStorage.removeItem(checklistStorageKey);
  };

  const eligibilityEval = evaluateEligibility(userRole, opportunity.eligibility);

  // Calculate detailed deadline metadata
  const getDeadlineMeta = (deadlineStr?: string | null) => {
    if (!deadlineStr) return { text: 'Rolling / Open Deadline', isUrgent: false, isPassed: false, days: null };
    const deadline = new Date(deadlineStr);
    const now = new Date();
    const diffMs = deadline.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: `Passed (${deadline.toLocaleDateString()})`, isUrgent: false, isPassed: true, days: diffDays };
    }
    if (diffDays === 0) {
      return { text: 'Deadline is TODAY!', isUrgent: true, isPassed: false, days: 0 };
    }
    if (diffDays <= 7) {
      return { text: `Due in ${diffDays} day${diffDays === 1 ? '' : 's'} (${deadline.toLocaleDateString()})`, isUrgent: true, isPassed: false, days: diffDays };
    }
    return { text: `Due in ${diffDays} days (${deadline.toLocaleDateString()})`, isUrgent: false, isPassed: false, days: diffDays };
  };

  const deadlineMeta = getDeadlineMeta(opportunity.deadline);

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

  const handleCopyLink = () => {
    const shareText = `${opportunity.title} by ${opportunity.provider}\nAmount: ${opportunity.fundingAmount || 'Unspecified'}\nDeadline: ${opportunity.deadline ? new Date(opportunity.deadline).toLocaleDateString() : 'Rolling'}\nApply: ${opportunity.applicationUrl || window.location.href}`;
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadCalendarEvent = () => {
    if (!opportunity.deadline) return;
    const date = new Date(opportunity.deadline);
    const dateFormatted = date.toISOString().replace(/-|:|\.\d\d\d/g, '');
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//ResCollab//Funding Opportunity Reminder//EN
BEGIN:VEVENT
UID:funding-${opportunity.id}@rescollab.org
DTSTAMP:${dateFormatted}
DTSTART:${dateFormatted}
SUMMARY:Deadline: ${opportunity.title}
DESCRIPTION:${opportunity.provider} - Funding Amount: ${opportunity.fundingAmount || 'N/A'}\\nApply at: ${opportunity.applicationUrl || ''}
LOCATION:Online / Portal
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Funding_Deadline_${opportunity.id}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getGoogleCalendarUrl = () => {
    if (!opportunity.deadline) return '';
    const d = new Date(opportunity.deadline);
    const dateStr = d.toISOString().replace(/-|:|\.\d\d\d/g, '').slice(0, 15) + 'Z';
    const title = `Grant Deadline: ${opportunity.title}`;
    const details = `${opportunity.provider}\nAmount: ${opportunity.fundingAmount || 'N/A'}\nApply: ${opportunity.applicationUrl || ''}`;
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${dateStr}/${dateStr}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(opportunity.applicationUrl || '')}`;
  };

  const progressPercent = requirementsList.length > 0
    ? Math.round((completedReqs.length / requirementsList.length) * 100)
    : 0;

  return (
    <div className="funding-modal-backdrop" onClick={onClose} id="funding-details-modal-backdrop">
      <div 
        className="funding-modal-content" 
        onClick={e => e.stopPropagation()} 
        id={`funding-modal-${opportunity.id}`}
      >
        {/* Close Button */}
        <button 
          className="funding-modal-close" 
          onClick={onClose} 
          id="btn-close-funding-details"
          aria-label="Close funding details"
        >
          <X size={20} />
        </button>

        {/* Header Tags & Metadata */}
        <div className="funding-modal-header-tags">
          <span className={`funding-pill ${getFundingBadgeClass(opportunity.fundingType)}`}>
            <Award size={13} /> {opportunity.fundingType}
          </span>
          <span className={`funding-status-pill ${getStatusBadgeClass(opportunity.status)}`}>
            {opportunity.status}
          </span>
          {opportunity.researchArea && (
            <span className="funding-area-pill">
              <Tag size={12} /> {opportunity.researchArea}
            </span>
          )}
          <span className={`funding-deadline-pill ${deadlineMeta.isUrgent ? 'urgent' : ''} ${deadlineMeta.isPassed ? 'passed' : ''}`}>
            <Clock size={12} /> {deadlineMeta.text}
          </span>
        </div>

        {/* Title */}
        <h2 className="funding-modal-title">{opportunity.title}</h2>

        {/* Provider Banner */}
        <div className="funding-modal-provider">
          <Building2 size={18} className="funding-meta-icon" />
          <div className="provider-info">
            <span className="provider-label">Sponsoring Institution / Funder:</span>
            <span className="provider-name">{opportunity.provider}</span>
          </div>
        </div>

        {/* Amount Hero Card */}
        {opportunity.fundingAmount && (
          <div className="funding-amount-hero">
            <div className="amount-icon-circle">
              <DollarSign size={24} />
            </div>
            <div className="amount-details">
              <span className="amount-label">Award Value / Budget Allowance</span>
              <span className="amount-value">{opportunity.fundingAmount}</span>
            </div>
            {opportunity.applicationUrl && (
              <a
                href={opportunity.applicationUrl.startsWith('http') ? opportunity.applicationUrl : `https://${opportunity.applicationUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-apply-hero"
                id={`btn-apply-hero-${opportunity.id}`}
              >
                Apply Now <ArrowRight size={15} />
              </a>
            )}
          </div>
        )}

        {/* Profile Compatibility Banner */}
        <div className={`eligibility-profile-banner ${eligibilityEval.type}`}>
          <div className="banner-icon">
            {eligibilityEval.match === true ? (
              <UserCheck size={18} />
            ) : eligibilityEval.match === false ? (
              <AlertTriangle size={18} />
            ) : (
              <Sparkles size={18} />
            )}
          </div>
          <div className="banner-content">
            <span className="banner-title">Applicant Profile Assessment</span>
            <span className="banner-desc">{eligibilityEval.text}</span>
          </div>
        </div>

        {/* Main Content Sections */}
        <div className="funding-modal-sections">
          {/* Description Section */}
          {opportunity.description && (
            <div className="funding-section">
              <h3>
                <FileText size={16} /> Scope & Opportunity Overview
              </h3>
              <div className="section-body description-body">
                <p>{opportunity.description}</p>
              </div>
            </div>
          )}

          {/* Eligibility Criteria Section */}
          {opportunity.eligibility && (
            <div className="funding-section">
              <h3>
                <CheckCircle2 size={16} /> Eligibility Criteria & Applicant Profile
              </h3>
              <div className="section-body eligibility-body">
                <p>{opportunity.eligibility}</p>
              </div>
            </div>
          )}

          {/* Submission Requirements & Interactive Checklist */}
          {requirementsList.length > 0 && (
            <div className="funding-section">
              <div className="checklist-section-header">
                <h3>
                  <FileText size={16} /> Application Requirements & Checklist
                </h3>
                {completedReqs.length > 0 && (
                  <button type="button" className="btn-clear-checklist" onClick={clearChecklist}>
                    Reset Checklist
                  </button>
                )}
              </div>

              {/* Progress bar */}
              <div className="checklist-progress-bar-wrap">
                <div className="progress-info">
                  <span>Dossier Preparation Progress:</span>
                  <strong>{completedReqs.length} of {requirementsList.length} items ready ({progressPercent}%)</strong>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
                </div>
              </div>

              <div className="checklist-items-list">
                {requirementsList.map((reqItem, idx) => {
                  const isChecked = completedReqs.includes(reqItem);
                  return (
                    <div
                      key={idx}
                      className={`checklist-item ${isChecked ? 'completed' : ''}`}
                      onClick={() => toggleRequirement(reqItem)}
                    >
                      <button type="button" className="checklist-checkbox" aria-label="Toggle requirement">
                        {isChecked ? <CheckSquare size={18} className="checked-icon" /> : <Square size={18} />}
                      </button>
                      <span className="checklist-text">{reqItem}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Application Info & Instructions */}
          {opportunity.applicationInfo && (
            <div className="funding-section">
              <h3>
                <Building2 size={16} /> Application Instructions & Review Process
              </h3>
              <div className="section-body instructions-body">
                <p>{opportunity.applicationInfo}</p>
              </div>
            </div>
          )}
        </div>

        {/* Application Portal CTA Box */}
        {opportunity.applicationUrl && (
          <div className="funding-portal-box">
            <div className="portal-info">
              <span className="portal-title">Official Application Portal</span>
              <span className="portal-url">
                {opportunity.applicationUrl.replace(/^https?:\/\//i, '').slice(0, 60)}…
              </span>
            </div>
            <a
              href={opportunity.applicationUrl.startsWith('http') ? opportunity.applicationUrl : `https://${opportunity.applicationUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-open-portal"
              id={`btn-open-portal-${opportunity.id}`}
            >
              Open Official Portal <ExternalLink size={14} />
            </a>
          </div>
        )}

        {/* Share & Calendar Tools */}
        <div className="funding-modal-tools">
          <button 
            type="button" 
            className="btn-tool-pill"
            onClick={handleCopyLink}
            title="Copy opportunity summary and link to clipboard"
          >
            {copied ? <Check size={14} style={{ color: '#10b981' }} /> : <Share2 size={14} />}
            <span>{copied ? 'Details Copied!' : 'Share Opportunity'}</span>
          </button>

          {opportunity.deadline && (
            <>
              <a
                href={getGoogleCalendarUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-tool-pill"
                title="Add deadline directly to Google Calendar"
              >
                <Calendar size={14} />
                <span>Google Calendar</span>
              </a>

              <button 
                type="button" 
                className="btn-tool-pill"
                onClick={handleDownloadCalendarEvent}
                title="Download iCal (.ics) for Apple/Outlook Calendar"
              >
                <Download size={14} />
                <span>Download .ics</span>
              </button>
            </>
          )}
        </div>

        {/* Footer Meta */}
        <div className="funding-modal-footer-meta">
          <span>
            Posted by <strong>{opportunity.postedByName || 'Academic Program Office'}</strong>
          </span>
          <span>Cataloged on {new Date(opportunity.createdAt).toLocaleDateString()}</span>
        </div>

        {/* Owner Action Buttons */}
        {isOwner && (
          <div className="funding-modal-owner-actions">
            {onStatusToggle && (
              <button
                type="button"
                className="funding-action-btn status-btn"
                onClick={() => onStatusToggle(opportunity.id, opportunity.status)}
                id="btn-modal-toggle-status"
              >
                <Shield size={14} /> Mark as {opportunity.status === 'Open' ? 'Closed' : 'Open'}
              </button>
            )}
            {onEdit && (
              <button
                type="button"
                className="funding-action-btn edit-btn"
                onClick={() => {
                  onClose();
                  onEdit(opportunity);
                }}
                id="btn-modal-edit-opp"
              >
                <Edit3 size={14} /> Edit Opportunity
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                className="funding-action-btn delete-btn"
                onClick={() => {
                  if (window.confirm(`Delete funding opportunity "${opportunity.title}"?`)) {
                    onClose();
                    onDelete(opportunity.id);
                  }
                }}
                id="btn-modal-delete-opp"
              >
                <Trash2 size={14} /> Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FundingDetailsModal;
