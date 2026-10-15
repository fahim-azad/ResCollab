import React, { useEffect, useState } from 'react';
import { 
  X, MapPin, BookOpen, CheckCircle, XCircle, Shield, 
  UserPlus, UserCheck, ExternalLink, Calendar, Building, Sparkles 
} from 'lucide-react';
import type { ResearcherProfileData } from './ResearcherCollabCard';

interface ResearcherCollabModalProps {
  userId: number;
  onClose: () => void;
  onConnect?: (userId: number) => void;
  connectionStatus?: string | null;
  isConnecting?: boolean;
}

export const ResearcherCollabModal: React.FC<ResearcherCollabModalProps> = ({
  userId,
  onClose,
  onConnect,
  connectionStatus,
  isConnecting = false,
}) => {
  const [profile, setProfile] = useState<ResearcherProfileData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`http://localhost:5000/api/collaborator/profile/${userId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!res.ok) {
          throw new Error('Failed to load researcher collaboration profile.');
        }

        const data = await res.json();
        setProfile(data);
      } catch (err: any) {
        setError(err.message || 'An error occurred while loading profile.');
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchProfile();
    }
  }, [userId]);

  const getInitials = (name: string | null) =>
    name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?';

  return (
    <div className="collab-modal-backdrop" onClick={onClose} id="collab-profile-modal-backdrop">
      <div 
        className="collab-modal-content" 
        onClick={e => e.stopPropagation()} 
        id={`collab-profile-modal-${userId}`}
      >
        <button 
          className="collab-modal-close" 
          onClick={onClose} 
          id="btn-close-collab-modal"
          aria-label="Close modal"
        >
          <X size={20} />
        </button>

        {loading ? (
          <div className="collab-modal-loading">
            <div className="spinner"></div>
            <p>Loading researcher collaboration profile…</p>
          </div>
        ) : error ? (
          <div className="collab-modal-error">
            <p className="error-msg">{error}</p>
            <button className="form-submit-btn" onClick={onClose} style={{ marginTop: '1rem' }}>
              Close
            </button>
          </div>
        ) : profile ? (
          <>
            <div className="collab-modal-header">
              <div className="collab-modal-avatar">
                {getInitials(profile.userName)}
              </div>
              <div className="collab-modal-header-info">
                <div className="collab-modal-name-row">
                  <h2>{profile.userName}</h2>
                  {profile.visibility && (
                    <span className="visibility-badge">
                      <Shield size={12} /> {profile.visibility}
                    </span>
                  )}
                </div>
                <div className="collab-modal-affiliation">
                  <Building size={14} />
                  <span>
                    {[profile.department, profile.institution].filter(Boolean).join(' · ') || 'Researcher'}
                  </span>
                </div>
                {profile.country && (
                  <div className="collab-modal-location">
                    <MapPin size={14} />
                    <span>{profile.country}</span>
                  </div>
                )}
              </div>
            </div>

            <div className={`collab-status-banner ${profile.isOpenToCollaboration ? 'open' : 'closed'}`}>
              {profile.isOpenToCollaboration ? (
                <>
                  <CheckCircle size={18} />
                  <div>
                    <strong>Open to Collaboration</strong>
                    <p>Actively looking for co-authors, peer researchers, and cross-institutional projects.</p>
                  </div>
                </>
              ) : (
                <>
                  <XCircle size={18} />
                  <div>
                    <strong>Not Currently Seeking Collaborators</strong>
                    <p>This researcher is currently not available for new collaborations.</p>
                  </div>
                </>
              )}
            </div>

            <div className="collab-modal-body">
              {profile.researchInterests && (
                <div className="collab-modal-section">
                  <h4>
                    <BookOpen size={16} /> Research Interests
                  </h4>
                  <p className="section-text">{profile.researchInterests}</p>
                </div>
              )}

              {profile.expertiseAreas && (
                <div className="collab-modal-section">
                  <h4>
                    <Sparkles size={16} /> Expertise Areas
                  </h4>
                  <div className="tags">
                    {profile.expertiseAreas.split(',').map((tag, idx) => (
                      <span key={idx} className="tag large-tag">
                        {tag.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {profile.createdAt && (
                <div className="collab-modal-date">
                  <Calendar size={13} />
                  <span>Joined on {new Date(profile.createdAt).toLocaleDateString()}</span>
                </div>
              )}
            </div>

            <div className="collab-modal-actions">
              {onConnect && (
                <button
                  id={`modal-btn-connect-${profile.userId}`}
                  type="button"
                  className={`form-submit-btn ${connectionStatus ? 'connected-state' : ''}`}
                  onClick={() => onConnect(profile.userId)}
                  disabled={isConnecting || connectionStatus === 'Accepted' || connectionStatus === 'Pending'}
                >
                  {connectionStatus === 'Accepted' ? (
                    <>
                      <UserCheck size={16} /> Connected
                    </>
                  ) : connectionStatus === 'Pending' ? (
                    <>
                      <UserCheck size={16} /> Request Sent
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} /> {isConnecting ? 'Sending…' : 'Connect & Collaborate'}
                    </>
                  )}
                </button>
              )}

              <a
                href={`/profile/${profile.userId}`}
                className="secondary-btn"
                id={`modal-btn-academic-profile-${profile.userId}`}
              >
                <ExternalLink size={16} /> View Academic Profile
              </a>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default ResearcherCollabModal;
