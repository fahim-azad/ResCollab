import React, { useEffect, useState } from 'react';
import { User, MapPin, Building, GraduationCap, AlertCircle } from 'lucide-react';
import './SupervisorRecommendations.css';

interface SupervisorDto {
  userId: number;
  fullName: string;
  department: string | null;
  university: string | null;
  matchedInterests: string[];
  matchScore: number;
  bio: string | null;
}

const SupervisorRecommendations: React.FC = () => {
  const [supervisors, setSupervisors] = useState<SupervisorDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const fetchRecommendations = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authentication token found');

      const res = await fetch('http://localhost:5000/api/recommendation/supervisors', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        throw new Error('Failed to fetch recommendations');
      }

      const data = await res.json();
      setSupervisors(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading-container"><h2>Analyzing your profile and finding matches...</h2></div>;
  }

  if (error) {
    return (
      <div className="error-container">
        <AlertCircle size={48} style={{ marginBottom: '1rem' }} />
        <h2>Something went wrong</h2>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="supervisors-container animate-fade-in">
      <div className="supervisors-header">
        <h1>Supervisor Recommendations</h1>
        <p>AI-powered matches based on your research interests and academic profile.</p>
      </div>

      {supervisors.length === 0 ? (
        <div className="empty-container">
          <User size={64} style={{ opacity: 0.2, marginBottom: '1rem' }} />
          <h3>No supervisors found</h3>
          <p>Update your profile with more specific research interests to get better matches.</p>
        </div>
      ) : (
        <div className="supervisors-grid">
          {supervisors.map(sup => (
            <div key={sup.userId} className="supervisor-card animate-slide-up">
              <div className="supervisor-header-row">
                <div className="supervisor-info">
                  <h3>{sup.fullName}</h3>
                  <p><Building size={14} /> {sup.department || 'No Dept Listed'}</p>
                  <p><GraduationCap size={14} /> {sup.university || 'No University Listed'}</p>
                </div>
                <div className={`match-score ${sup.matchScore >= 15 ? 'perfect' : sup.matchScore === 0 ? 'low' : ''}`}>
                  {sup.matchScore} pts Match
                </div>
              </div>

              <p className="supervisor-bio">
                {sup.bio ? (sup.bio.length > 120 ? sup.bio.substring(0, 120) + '...' : sup.bio) : 'No bio provided.'}
              </p>

              {sup.matchedInterests && sup.matchedInterests.length > 0 && (
                <div className="matched-interests">
                  <div className="matched-interests-title">Shared Research Interests</div>
                  <div className="tags-container">
                    {sup.matchedInterests.map((interest, idx) => (
                      <span key={idx} className="interest-tag">{interest}</span>
                    ))}
                  </div>
                </div>
              )}

              <button className="connect-btn">View Full Profile</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SupervisorRecommendations;
