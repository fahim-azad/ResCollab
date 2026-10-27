import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Building, GraduationCap, AlertCircle, User, Sparkles } from 'lucide-react';
import './TeammateRecommendations.css';

interface TeammateDto {
  userId: number;
  fullName: string;
  department: string | null;
  university: string | null;
  matchedInterests: string[];
  skills: string[];
  matchScore: number;
  bio: string | null;
}

const TeammateRecommendations: React.FC = () => {
  const [teammates, setTeammates] = useState<TeammateDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchTeammates();
  }, []);

  const fetchTeammates = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authentication token found');

      const res = await fetch('http://localhost:5000/api/recommendation/teammates', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        throw new Error('Failed to fetch teammate recommendations');
      }

      const data = await res.json();
      setTeammates(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading-state"><h2>Finding potential teammates...</h2></div>;
  }

  if (error) {
    return (
      <div className="error-state">
        <AlertCircle size={48} style={{ marginBottom: '1rem' }} />
        <h2>Something went wrong</h2>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="teammates-container animate-fade-in">
      <div className="teammates-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>Find Teammates</h1>
          <p style={{ margin: '0.4rem 0 0 0' }}>Connect with peers who share your research interests and bring complementary skills to the table.</p>
        </div>
        <button
          onClick={() => navigate('/recommendations?tab=teammates')}
          style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: '#fff', border: 'none', borderRadius: '10px', padding: '0.65rem 1.2rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}
        >
          <Sparkles size={16} /> Open Full AI Hub
        </button>
      </div>

      {teammates.length === 0 ? (
        <div className="empty-state">
          <Users size={64} style={{ opacity: 0.2, marginBottom: '1rem' }} />
          <h3>No students found</h3>
          <p>We couldn't find any other students that match your profile yet.</p>
        </div>
      ) : (
        <div className="teammates-grid">
          {teammates.map(peer => (
            <div key={peer.userId} className="teammate-card animate-slide-up">
              <div className="teammate-header-row">
                <div className="teammate-info">
                  <h3>{peer.fullName}</h3>
                  <p><GraduationCap size={14} /> {peer.university || 'University not set'}</p>
                  <p><Building size={14} /> {peer.department || 'Department not set'}</p>
                </div>
                <div className={`match-badge ${peer.matchScore >= 15 ? 'high' : peer.matchScore === 0 ? 'low' : ''}`}>
                  {peer.matchScore} pts Match
                </div>
              </div>

              <p className="teammate-bio">
                {peer.bio ? (peer.bio.length > 100 ? peer.bio.substring(0, 100) + '...' : peer.bio) : 'No bio provided.'}
              </p>

              <div className="tags-row">
                <div className="section-title">Shared Interests</div>
                {peer.matchedInterests && peer.matchedInterests.length > 0 ? (
                  <div className="tags-wrapper">
                    {peer.matchedInterests.map((interest, idx) => (
                      <span key={idx} className="interest-badge">{interest}</span>
                    ))}
                  </div>
                ) : (
                  <div className="empty-tags">No shared interests found</div>
                )}
              </div>

              <div className="tags-row">
                <div className="section-title">Technical Skills</div>
                {peer.skills && peer.skills.length > 0 ? (
                  <div className="tags-wrapper">
                    {peer.skills.map((skill, idx) => (
                      <span key={idx} className="skill-badge">{skill}</span>
                    ))}
                  </div>
                ) : (
                  <div className="empty-tags">No specific skills listed</div>
                )}
              </div>

              <button className="message-btn" onClick={() => navigate(`/profile/${peer.userId}`)}>
                <User size={18} /> View Profile
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TeammateRecommendations;
