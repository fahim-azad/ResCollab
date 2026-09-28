import React, { useEffect, useState } from 'react';
import { Plus, FolderOpen, Users, Clock, Building, Send, DollarSign, Briefcase } from 'lucide-react';
import './IdeaMarketplace.css'; // Reusing modal styles
import './ProjectMarketplace.css';

interface ProjectDto {
  id: number;
  title: string;
  department: string | null;
  requiredSkills: string | null;
  maxStudents: number;
  isFunded: boolean;
  createdAt: string;
  supervisorName: string;
}

const ProjectMarketplace: React.FC = () => {
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [showFundedOnly, setShowFundedOnly] = useState(false);
  const [userRole, setUserRole] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '', description: '', department: '', requiredSkills: '', maxStudents: 1, isFunded: false
  });
  const [submitting, setSubmitting] = useState(false);

  // Application Modal States
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [coverLetter, setCoverLetter] = useState('');
  const [applying, setApplying] = useState(false);

  const [viewMode, setViewMode] = useState<'all' | 'my'>('all');
  const [applications, setApplications] = useState<any[]>([]);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewProjectId, setReviewProjectId] = useState<number | null>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      setUserRole(JSON.parse(userStr).role);
    }
    fetchProjects();
  }, [showFundedOnly, viewMode]);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      let url = 'http://localhost:5000/api/openproject';
      if (viewMode === 'my') {
        url = 'http://localhost:5000/api/openproject/my';
      } else if (showFundedOnly) {
        url = 'http://localhost:5000/api/openproject?isFunded=true';
      }
        
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch projects');
      const data = await res.json();
      setProjects(data);
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
      const res = await fetch('http://localhost:5000/api/openproject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(formData)
      });
      
      if (!res.ok) throw new Error('Failed to create project. Ensure you are a Supervisor/Faculty.');
      
      setIsModalOpen(false);
      setFormData({ title: '', description: '', department: '', requiredSkills: '', maxStudents: 1, isFunded: false });
      fetchProjects();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApplyClick = (projectId: number) => {
    setSelectedProjectId(projectId);
    setCoverLetter('');
    setIsApplyModalOpen(true);
  };

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) return;
    setApplying(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/openproject/${selectedProjectId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ coverLetter })
      });
      
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { message: text }; }
      
      if (!res.ok) throw new Error(data.message || data.title || 'Failed to apply to project.');
      
      alert(data.message || "Application submitted successfully!");
      setIsApplyModalOpen(false);
      setSelectedProjectId(null);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setApplying(false);
    }
  };

  const handleOpenReview = async (projectId: number) => {
    setReviewProjectId(projectId);
    setIsReviewModalOpen(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/openproject/${projectId}/applications`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setApplications(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleReviewAction = async (appId: number, status: string) => {
    if (!reviewProjectId) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/openproject/${reviewProjectId}/applications/${appId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        handleOpenReview(reviewProjectId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="projects-container animate-fade-in">
      <div className="projects-header">
        <div className="projects-title">
          <h1>Open Projects</h1>
          <p>Join established research projects and labs led by faculty.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem' }}>
          {(userRole === 'Supervisor' || userRole === 'Faculty') && (
            <>
              <button 
                style={{ padding: '0.6rem 1.2rem', border: 'none', borderRadius: '8px', cursor: 'pointer', background: viewMode === 'all' ? '#e2e8f0' : 'transparent', fontWeight: viewMode === 'all' ? 600 : 400 }} 
                onClick={() => setViewMode('all')}
              >
                All Projects
              </button>
              <button 
                style={{ padding: '0.6rem 1.2rem', border: 'none', borderRadius: '8px', cursor: 'pointer', background: viewMode === 'my' ? '#e2e8f0' : 'transparent', fontWeight: viewMode === 'my' ? 600 : 400 }} 
                onClick={() => setViewMode('my')}
              >
                My Projects
              </button>
              <button className="create-btn" onClick={() => setIsModalOpen(true)}>
                <Plus size={20} /> Recruit Students
              </button>
            </>
          )}
        </div>
      </div>

      <div className="filters-bar">
        <label className="filter-checkbox">
          <input 
            type="checkbox" 
            checked={showFundedOnly} 
            onChange={(e) => setShowFundedOnly(e.target.checked)} 
          />
          <DollarSign size={16} /> Show only Funded / Paid positions
        </label>
      </div>

      {error && <div className="error-state">{error}</div>}

      {loading ? (
        <div className="loading-state"><h2>Loading Projects...</h2></div>
      ) : projects.length === 0 ? (
        <div className="empty-state">
          <FolderOpen size={64} style={{ opacity: 0.2, marginBottom: '1rem' }} />
          <h3>No open projects found</h3>
          <p>Check back later or adjust your filters.</p>
        </div>
      ) : (
        <div className="projects-grid">
          {projects.map(proj => (
            <div key={proj.id} className="project-card animate-slide-up">
              {proj.isFunded && <div className="funded-ribbon">Funded</div>}
              
              <h3 className="project-title">{proj.title}</h3>
              
              <div className="project-meta">
                <div className="project-meta-row">
                  <Briefcase size={16} /> <strong>{proj.supervisorName}</strong>
                </div>
                <div className="project-meta-row">
                  <Building size={16} /> {proj.department || 'General'}
                </div>
                <div className="project-meta-row">
                  <Clock size={16} /> Posted {new Date(proj.createdAt).toLocaleDateString()}
                </div>
              </div>
              
              <div className="project-skills">
                <div className="project-skills-title">Required Qualifications</div>
                <div className="project-skills-text">{proj.requiredSkills || 'General research interest'}</div>
              </div>
              
              {viewMode === 'my' ? (
                <button className="apply-project-btn" style={{background: 'var(--brand-navy)'}} onClick={() => handleOpenReview(proj.id)}>
                  <Users size={18} /> Review Applications
                </button>
              ) : (
                <button className="apply-project-btn" onClick={() => handleApplyClick(proj.id)}>
                  <Send size={18} /> Apply for Position ({proj.maxStudents} open slots)
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reusing Modal Styles from IdeaMarketplace.css */}
      {isModalOpen && (
        <div className="modal-overlay animate-fade-in">
          <div className="modal-content animate-slide-up">
            <div className="modal-header">
              <h2>Post a Research Position</h2>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>✕</button>
            </div>
            
            <form onSubmit={handleCreateSubmit}>
              <div className="form-group">
                <label>Project Title *</label>
                <input type="text" className="neo-input" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
              </div>
              
              <div className="form-group">
                <label>Detailed Description *</label>
                <textarea className="neo-input" required rows={4} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}></textarea>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Department</label>
                  <input type="text" className="neo-input" value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Required Skills</label>
                  <input type="text" className="neo-input" value={formData.requiredSkills} onChange={e => setFormData({...formData, requiredSkills: e.target.value})} />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Available Slots (Students)</label>
                  <input type="number" className="neo-input" min="1" max="20" required value={formData.maxStudents} onChange={e => setFormData({...formData, maxStudents: parseInt(e.target.value)})} />
                </div>
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginTop: '2rem' }}>
                    <input type="checkbox" checked={formData.isFunded} onChange={e => setFormData({...formData, isFunded: e.target.checked})} style={{ width: '1.2rem', height: '1.2rem' }} />
                    <strong>This is a Funded Position</strong>
                  </label>
                </div>
              </div>
              
              <div className="modal-footer">
                <button type="button" className="cancel-btn" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="create-btn" style={{background: 'var(--brand-navy)'}} disabled={submitting}>
                  {submitting ? 'Posting...' : 'Post Position'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Application Modal */}
      {isApplyModalOpen && (
        <div className="modal-overlay animate-fade-in">
          <div className="modal-content animate-slide-up">
            <div className="modal-header">
              <h2>Apply for Position</h2>
              <button className="close-btn" onClick={() => setIsApplyModalOpen(false)}>✕</button>
            </div>
            
            <form onSubmit={handleApplySubmit}>
              <div className="form-group">
                <label>Cover Letter / Statement of Interest *</label>
                <textarea 
                  className="neo-input" 
                  required 
                  rows={6} 
                  value={coverLetter} 
                  onChange={e => setCoverLetter(e.target.value)}
                  placeholder="Explain why you are a good fit for this project, detailing your skills and prior experience..."
                ></textarea>
              </div>
              
              <div className="modal-footer">
                <button type="button" className="cancel-btn" onClick={() => setIsApplyModalOpen(false)}>Cancel</button>
                <button type="submit" className="create-btn" style={{background: 'var(--brand-mint)', color: 'var(--brand-navy)'}} disabled={applying}>
                  {applying ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {isReviewModalOpen && (
        <div className="modal-overlay animate-fade-in">
          <div className="modal-content animate-slide-up" style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h2>Review Applications</h2>
              <button className="close-btn" onClick={() => setIsReviewModalOpen(false)}>✕</button>
            </div>
            
            <div className="applications-list" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {applications.length === 0 ? (
                <p style={{ color: '#666', textAlign: 'center', padding: '2rem' }}>No applications yet.</p>
              ) : (
                applications.map(app => (
                  <div key={app.id} style={{ border: '1px solid #eee', padding: '1.5rem', borderRadius: '12px', marginBottom: '1rem', background: '#fff', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <h3 style={{ margin: 0, color: 'var(--brand-navy)' }}>{app.applicantName}</h3>
                      <span className={`role-badge ${app.status.toLowerCase()}`}>{app.status}</span>
                    </div>
                    <p style={{ fontSize: '0.9rem', color: '#666', margin: '0 0 1rem 0' }}>{app.applicantEmail}</p>
                    <div style={{ whiteSpace: 'pre-wrap', background: '#f8fafc', padding: '1rem', borderRadius: '8px', fontSize: '0.95rem', borderLeft: '3px solid var(--brand-blue)', marginBottom: '1rem' }}>
                      {app.coverLetter}
                    </div>
                    
                    {app.status === 'Pending' && (
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <button className="create-btn" style={{ background: 'var(--brand-mint)', color: 'var(--brand-navy)', flexGrow: 1, justifyContent: 'center' }} onClick={() => handleReviewAction(app.id, 'Accepted')}>
                          Accept Applicant
                        </button>
                        <button className="cancel-btn" style={{ flexGrow: 1 }} onClick={() => handleReviewAction(app.id, 'Rejected')}>
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectMarketplace;
