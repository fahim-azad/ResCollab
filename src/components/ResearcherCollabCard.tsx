import React from 'react';
import { MapPin, BookOpen, UserPlus, UserCheck, Eye, ExternalLink, CheckCircle, Shield } from 'lucide-react';

export interface ResearcherProfileData {
  id?: number;
  userId: number;
  userName: string;
  institution: string | null;
  department: string | null;
  country: string | null;
  researchInterests: string | null;
  expertiseAreas: string | null;
  isOpenToCollaboration: boolean;
  visibility?: string;
  createdAt?: string;
}

interface ResearcherCollabCardProps {
  researcher: ResearcherProfileData;
  onViewProfile?: (userId: number) => void;
  onConnect?: (userId: number) => void;
  connectionStatus?: string | null;
  isConnecting?: boolean;
  isPreview?: boolean;
}

export const ResearcherCollabCard: React.FC<ResearcherCollabCardProps> = ({
  researcher,
  onViewProfile,
  onConnect,
  connectionStatus,
  isConnecting = false,
  isPreview = false,
}) => {
  const getInitials = (name: string | null) =>
    name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?';

  const expertiseList = researcher.expertiseAreas
    ? researcher.expertiseAreas.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  return (
    <div
      className={`researcher-card ${isPreview ? 'preview-card' : ''}`}
      id={`researcher-card-${researcher.userId}`}
    >
      <div className="researcher-card-header">
        <div className="researcher-avatar">
          {getInitials(researcher.userName || 'Researcher')}
        </div>
        <div className="researcher-info-header">
          <div className="researcher-name-row">
            <h3 className="researcher-name">{researcher.userName || 'Unnamed Researcher'}</h3>
            {researcher.visibility && (
              <span className="visibility-badge" title={`Visibility: ${researcher.visibility}`}>
                <Shield size={11} /> {researcher.visibility}
              </span>
            )}
          </div>
          <div className="sub affiliation-sub">
            {[researcher.department, researcher.institution].filter(Boolean).join(' · ') || 'Academic Researcher'}
          </div>
        </div>
      </div>

      <div className="card-meta-row">
        {researcher.country && (
          <span className="meta-badge location-badge">
            <MapPin size={12} /> {researcher.country}
          </span>
        )}
        <span
          className={`status-pill ${
            researcher.isOpenToCollaboration ? 'open-collab-pill' : 'closed-collab-pill'
          }`}
        >
          {researcher.isOpenToCollaboration ? (
            <>
              <CheckCircle size={12} /> Open to Collaboration
            </>
          ) : (
            'Not Seeking Collaborators'
          )}
        </span>
      </div>

      {researcher.researchInterests && (
        <div className="interests-box">
          <BookOpen size={13} className="interests-icon" />
          <span className="interests-text">
            <strong>Interests:</strong> {researcher.researchInterests}
          </span>
        </div>
      )}

      {expertiseList.length > 0 && (
        <div className="tags">
          {expertiseList.slice(0, 5).map((tag, idx) => (
            <span key={idx} className="tag">
              {tag}
            </span>
          ))}
          {expertiseList.length > 5 && (
            <span className="tag more-tag">+{expertiseList.length - 5} more</span>
          )}
        </div>
      )}

      {!isPreview && (
        <div className="card-actions-row">
          {onViewProfile && (
            <button
              id={`btn-view-card-${researcher.userId}`}
              type="button"
              className="card-action-btn view-collab-btn"
              onClick={() => onViewProfile(researcher.userId)}
            >
              <Eye size={14} /> View Profile
            </button>
          )}

          {onConnect && (
            <button
              id={`btn-connect-${researcher.userId}`}
              type="button"
              className={`card-action-btn connect-btn ${connectionStatus ? 'connected-state' : ''}`}
              onClick={() => onConnect(researcher.userId)}
              disabled={isConnecting || connectionStatus === 'Accepted' || connectionStatus === 'Pending'}
            >
              {connectionStatus === 'Accepted' ? (
                <>
                  <UserCheck size={14} /> Connected
                </>
              ) : connectionStatus === 'Pending' ? (
                <>
                  <UserCheck size={14} /> Request Sent
                </>
              ) : (
                <>
                  <UserPlus size={14} /> {isConnecting ? 'Sending…' : 'Connect'}
                </>
              )}
            </button>
          )}

          <a
            href={`/profile/${researcher.userId}`}
            className="card-icon-link"
            title="View full academic profile"
            id={`link-academic-profile-${researcher.userId}`}
          >
            <ExternalLink size={15} />
          </a>
        </div>
      )}
    </div>
  );
};

export default ResearcherCollabCard;
