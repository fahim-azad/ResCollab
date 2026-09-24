import React, { useEffect, useState } from 'react';
import { Plus, Lightbulb, Users, Clock, Tag, X, Send } from 'lucide-react';
import './IdeaMarketplace.css';

interface IdeaDto {
  id: number;
  title: string;
  researchArea: string | null;
  requiredSkills: string | null;
  requiredTeamSize: number;
  status: string;
  createdAt: string;
  creatorName: string;
}

const IdeaMarketplace: React.FC = () => {
  const [ideas, setIdeas] = useState<IdeaDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '', description: '', researchArea: '', requiredSkills: '', expectedOutcome: '', requiredTeamSize: 1
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchIdeas();
  }, []);

  const fetchIdeas = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/idea', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch ideas');
      const data = await res.json();
      setIdeas(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/idea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(formData)
      });
      
      if (!res.ok) throw new Error('Failed to create idea');
      
      setIsModalOpen(false);
      setFormData({ title: '', description: '', researchArea: '', requiredSkills: '', expectedOutcome: '', requiredTeamSize: 1 });
      fetchIdeas(); // Refresh list
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApply = async (ideaId: number) => {
    const message = window.prompt("Write a short message to the idea creator:");
    if (message === null) return; // User cancelled

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/idea/${ideaId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ message })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to apply');
      
      alert("Application sent successfully!");
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) return <div className="loading-state"><h2>Loading Ideas...</h2></div>;

  return (
    <div className="ideas-container animate-fade-in">
      <div className="ideas-header">
        <div className="ideas-title">
          <h1>Idea Marketplace</h1>
          <p>Discover research pitches, or post your own idea to build a team.</p>
        </div>
        <button className="create-btn" onClick={() => setIsModalOpen(true)}>
          <Plus size={20} /> Pitch an Idea
        </button>
      </div>

      {error && <div className="error-state">{error}</div>}

      {ideas.length === 0 ? (
        <div className="empty-state">
          <Lightbulb size={64} style={{ opacity: 0.2, marginBottom: '1rem' }} />
          <h3>No ideas posted yet</h3>
          <p>Be the first to pitch a research idea!</p>
        </div>
      ) : (
        <div className="ideas-grid">
          {ideas.map(idea => (
            <div key={idea.id} className="idea-card animate-slide-up">
              <span className={`idea-status ${idea.status.toLowerCase()}`}>{idea.status}</span>
              
              <h3 className="idea-title">{idea.title}</h3>
              
              <div className="idea-meta">
                <span><UserIcon size={14} /> {idea.creatorName}</span>
                <span><Clock size={14} /> {new Date(idea.createdAt).toLocaleDateString()}</span>
                {idea.researchArea && <span><Tag size={14} /> {idea.researchArea}</span>}
              </div>
              
              <div className="idea-skills">
                <div className="skills-label">Looking for:</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--brand-purple)', fontWeight: 500 }}>
                    {idea.requiredSkills || 'Any skills'}
                  </span>
                  <span style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-secondary)' }}>
                    <Users size={16} /> {idea.requiredTeamSize} Members
                  </span>
                </div>
              </div>
              
              <button className="apply-btn" onClick={() => handleApply(idea.id)}>
                <Send size={16} /> Express Interest
              </button>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="modal-overlay animate-fade-in">
          <div className="modal-content animate-slide-up">
            <div className="modal-header">
              <h2>Pitch a Research Idea</h2>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}><X size={24} /></button>
            </div>
            
            <form onSubmit={handleCreateSubmit}>
              <div className="form-group">
                <label>Project Title *</label>
                <input type="text" className="neo-input" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="e.g. AI-driven Cancer Detection" />
              </div>
              
              <div className="form-group">
                <label>Description *</label>
                <textarea className="neo-input" required rows={4} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Describe your idea..."></textarea>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Research Area</label>
                  <input type="text" className="neo-input" value={formData.researchArea} onChange={e => setFormData({...formData, researchArea: e.target.value})} placeholder="e.g. Machine Learning" />
                </div>
                <div className="form-group">
                  <label>Expected Outcome</label>
                  <input type="text" className="neo-input" value={formData.expectedOutcome} onChange={e => setFormData({...formData, expectedOutcome: e.target.value})} placeholder="e.g. IEEE Paper" />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Required Skills (comma separated)</label>
                  <input type="text" className="neo-input" value={formData.requiredSkills} onChange={e => setFormData({...formData, requiredSkills: e.target.value})} placeholder="e.g. Python, React" />
                </div>
                <div className="form-group">
                  <label>Team Size Needed</label>
                  <input type="number" className="neo-input" min="1" max="10" required value={formData.requiredTeamSize} onChange={e => setFormData({...formData, requiredTeamSize: parseInt(e.target.value)})} />
                </div>
              </div>
              
              <div className="modal-footer">
                <button type="button" className="cancel-btn" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="create-btn" disabled={submitting}>
                  {submitting ? 'Posting...' : 'Post Idea'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Quick mock for UserIcon since lucide-react User might collide with naming sometimes
const UserIcon = ({ size }: { size: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
);

export default IdeaMarketplace;
