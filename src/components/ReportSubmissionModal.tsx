import React, { useState } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  X,
  CheckCircle2,
  FileWarning,
  Copy,
  MessageSquareWarning,
  Flame,
  HelpCircle,
  Link as LinkIcon,
  Send,
  Loader2,
  Lock
} from 'lucide-react';
import './ReportSubmissionModal.css';

const API_BASE_URL = 'http://localhost:5000/api';

export type ReportTargetType =
  | 'User'
  | 'CommunityPost'
  | 'CommunityComment'
  | 'OpenProject'
  | 'ResearchIdea'
  | 'Publication';

export interface ReportSummary {
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

export interface ReportSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: number;
  targetTitle?: string;
  reportedUserId?: number;
  reportedUserName?: string;
  onSuccess?: (report: ReportSummary) => void;
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
    description: 'Uncredited copying of text, figures, datasets, or intellectual property.',
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

export const ReportSubmissionModal: React.FC<ReportSubmissionModalProps> = ({
  isOpen,
  onClose,
  targetType,
  targetId,
  targetTitle,
  reportedUserId,
  reportedUserName,
  onSuccess
}) => {
  const [selectedReason, setSelectedReason] = useState<string>('Plagiarism');
  const [description, setDescription] = useState<string>('');
  const [evidenceUrl, setEvidenceUrl] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedReport, setSubmittedReport] = useState<ReportSummary | null>(null);

  if (!isOpen) return null;

  // Retrieve current user ID to avoid self-reporting
  let currentUserId = -1;
  const userStr = localStorage.getItem('user');
  if (userStr) {
    try {
      const parsed = JSON.parse(userStr);
      currentUserId = parsed.id || parsed.userId || -1;
    } catch {
      // Ignored
    }
  }

  const isSelfReport = reportedUserId && reportedUserId === currentUserId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (isSelfReport) {
      setErrorMessage('You cannot submit a report against your own content or account.');
      return;
    }

    if (!selectedReason) {
      setErrorMessage('Please select a violation category.');
      return;
    }

    if (!description.trim() || description.trim().length < 10) {
      setErrorMessage('Please provide a detailed explanation of at least 10 characters.');
      return;
    }

    setSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      const payload = {
        targetType,
        targetId,
        reportedUserId: reportedUserId || undefined,
        reason: selectedReason,
        description: description.trim(),
        evidenceUrl: evidenceUrl.trim() || undefined
      };

      const res = await fetch(`${API_BASE_URL}/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || `Failed to submit report (Status ${res.status})`);
      }

      setSubmittedReport(data);
      if (onSuccess) {
        onSuccess(data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error submitting report.';
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    setSelectedReason('Plagiarism');
    setDescription('');
    setEvidenceUrl('');
    setErrorMessage(null);
    setSubmittedReport(null);
    onClose();
  };

  return (
    <div className="report-modal-backdrop" id="report-modal-backdrop" onClick={handleResetAndClose}>
      <div
        className="report-modal-card"
        id="report-submission-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="report-modal-header">
          <div className="report-header-title-group">
            <div className="report-shield-icon-wrapper">
              <ShieldAlert size={22} className="text-rose" />
            </div>
            <div>
              <h3>Report Inappropriate Content</h3>
              <p className="report-header-subtitle">
                Academic Integrity & Safety Committee Review
              </p>
            </div>
          </div>
          <button
            className="btn-modal-close"
            id="btn-close-report-modal"
            onClick={handleResetAndClose}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        {submittedReport ? (
          <div className="report-success-state" id="report-submission-success">
            <div className="success-icon-bubble">
              <CheckCircle2 size={42} className="text-emerald" />
            </div>
            <h3>Report Submitted for Review</h3>
            <p className="success-description">
              Thank you for helping maintain research integrity on ResCollab. Your report has been
              assigned tracking ID <strong>#{submittedReport.id}</strong> and queued for
              confidential moderator evaluation.
            </p>
            <div className="report-receipt-box">
              <div className="receipt-row">
                <span>Target Entity:</span>
                <strong>
                  {submittedReport.targetType} #{submittedReport.targetId}
                </strong>
              </div>
              <div className="receipt-row">
                <span>Violation Category:</span>
                <span className="badge-receipt-reason">{submittedReport.reason}</span>
              </div>
              <div className="receipt-row">
                <span>Current Status:</span>
                <span className="badge-receipt-status status-pending">
                  {submittedReport.status}
                </span>
              </div>
            </div>
            <button
              className="btn-modal-dismiss"
              id="btn-dismiss-report-success"
              onClick={handleResetAndClose}
            >
              Done & Return
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="report-form" id="form-submit-report">
            {/* Target Summary Preview */}
            <div className="report-target-summary" id="report-target-preview">
              <div className="target-summary-top">
                <span className="target-type-badge">{targetType}</span>
                <span className="target-id-badge">ID #{targetId}</span>
              </div>
              <h4 className="target-title-text">
                {targetTitle || `Target Entity (${targetType} #${targetId})`}
              </h4>
              {reportedUserName && (
                <div className="target-author-text">
                  Reported User: <strong>{reportedUserName}</strong>
                </div>
              )}
            </div>

            {/* Error Notification */}
            {errorMessage && (
              <div className="report-error-banner" id="report-error-banner">
                <AlertTriangle size={18} />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Self-Report Warning */}
            {isSelfReport && (
              <div className="report-warning-banner" id="report-self-warning">
                <Lock size={16} />
                <span>You cannot report your own account or contributions.</span>
              </div>
            )}

            {/* Reason Selector */}
            <div className="form-field-group">
              <label className="field-label">
                Violation Reason <span className="text-rose">*</span>
              </label>
              <div className="reason-options-grid" id="reason-options-grid">
                {VIOLATION_REASONS.map((opt) => {
                  const isSelected = selectedReason === opt.value;
                  return (
                    <div
                      key={opt.value}
                      className={`reason-card-tile ${isSelected ? 'selected' : ''}`}
                      id={`reason-option-${opt.value}`}
                      onClick={() => setSelectedReason(opt.value)}
                      role="radio"
                      aria-checked={isSelected}
                      tabIndex={0}
                    >
                      <div className="reason-card-header">
                        <span className="reason-icon-wrapper">{opt.icon}</span>
                        <span className="reason-label">{opt.label}</span>
                      </div>
                      <p className="reason-desc">{opt.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Detailed Description */}
            <div className="form-field-group">
              <div className="field-label-row">
                <label htmlFor="textarea-report-description" className="field-label">
                  Detailed Explanation <span className="text-rose">*</span>
                </label>
                <span className="char-count">{description.length}/2000</span>
              </div>
              <textarea
                id="textarea-report-description"
                className="report-textarea"
                rows={4}
                maxLength={2000}
                placeholder="Explain why this content violates academic integrity or community guidelines. Include specific details, quotes, or references to assist our moderation team..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            {/* Evidence Link */}
            <div className="form-field-group">
              <label htmlFor="input-report-evidence" className="field-label">
                Supporting Evidence URL (Optional)
              </label>
              <div className="input-with-icon">
                <LinkIcon size={16} className="input-prefix-icon" />
                <input
                  type="url"
                  id="input-report-evidence"
                  className="report-text-input"
                  placeholder="https://... (Link to original paper, screenshot, or DOI citation)"
                  value={evidenceUrl}
                  onChange={(e) => setEvidenceUrl(e.target.value)}
                />
              </div>
            </div>

            {/* Confidentiality Notice */}
            <div className="confidentiality-notice">
              <Lock size={14} className="notice-icon" />
              <span>
                Your identity as the reporter remains confidential and will never be shared with the
                reported user.
              </span>
            </div>

            {/* Modal Actions */}
            <div className="report-modal-actions">
              <button
                type="button"
                className="btn-cancel"
                id="btn-cancel-report"
                onClick={handleResetAndClose}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-submit-report"
                id="btn-submit-report"
                disabled={submitting || isSelfReport || description.trim().length < 10}
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="spin-icon" /> Submitting...
                  </>
                ) : (
                  <>
                    <Send size={16} /> Submit Report
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ReportSubmissionModal;
