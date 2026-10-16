import React, { useState } from 'react';
import { 
  X, ExternalLink, Calendar, Building2, CheckCircle2, 
  DollarSign, Clock, FileText, Share2, Check, 
  Award, ArrowRight, Download, Edit3, Trash2, Tag, Shield
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
  onClose: () => void;
  onEdit?: (opp: FundingOpportunityDetail) => void;
  onDelete?: (id: number) => void;
  onStatusToggle?: (id: number, currentStatus: string) => void;
}

export const FundingDetailsModal: React.FC<FundingDetailsModalProps> = ({
  opportunity,
  isOwner,
  onClose,
  onEdit,
  onDelete,
  onStatusToggle,
}) => {
  const [copied, setCopied] = useState(false);

  // Calculate days remaining to deadline
  const getDeadlineMeta = (deadlineStr?: string | null) => {
    if (!deadlineStr) return { text: 'Rolling / Open Deadline', isUrgent: false, isPassed: false };
    const deadline = new Date(deadlineStr);
    const now = new Date();
    const diffMs = deadline.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: `Passed (${deadline.toLocaleDateString()})`, isUrgent: false, isPassed: true };
    }
    if (diffDays === 0) {
      return { text: 'Deadline is TODAY!', isUrgent: true, isPassed: false };
    }
    if (diffDays <= 7) {
      return { text: `Due in ${diffDays} day${diffDays === 1 ? '' : 's'} (${deadline.toLocaleDateString()})`, isUrgent: true, isPassed: false };
    }
    return { text: `Due in ${diffDays} days (${deadline.toLocaleDateString()})`, isUrgent: false, isPassed: false };
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
                <CheckCircle2 size={16} /> Eligibility Criteria
              </h3>
              <div className="section-body eligibility-body">
                <p>{opportunity.eligibility}</p>
              </div>
            </div>
          )}

          {/* Submission Requirements Section */}
          {opportunity.requirements && (
            <div className="funding-section">
              <h3>
                <FileText size={16} /> Submission & Application Requirements
              </h3>
              <div className="section-body requirements-body">
                <p>{opportunity.requirements}</p>
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

        {/* Share & Calendar Actions */}
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
            <button 
              type="button" 
              className="btn-tool-pill"
              onClick={handleDownloadCalendarEvent}
              title="Add deadline to Apple/Google/Outlook Calendar"
            >
              <Download size={14} />
              <span>Add to Calendar (.ics)</span>
            </button>
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
