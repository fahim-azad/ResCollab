import React, { useEffect, useState } from 'react';
import { Plus, Users, Shield, User, Clock, Briefcase } from 'lucide-react';
import './WorkspaceDashboard.css';

interface WorkspaceDto {
  id: number;
  name: string;
  description: string;
  role: string;
  joinedAt: string;
  createdAt: string;
}

interface MemberDto {
  userId: number;
  userName: string;
  userEmail: string;
  role: string;
  joinedAt: string;
}

const WorkspaceDashboard: React.FC = () => {
  const [workspaces, setWorkspaces] = useState<WorkspaceDto[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<WorkspaceDto | null>(null);
  const [members, setMembers] = useState<MemberDto[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [newUserId, setNewUserId] = useState('');
  
  // Modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createData, setCreateData] = useState({ name: '', description: '' });

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const fetchWorkspaces = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/workspace', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setWorkspaces(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectWorkspace = async (ws: WorkspaceDto) => {
    setSelectedWorkspace(ws);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/workspace/${ws.id}/members`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMembers(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(createData)
      });
      if (res.ok) {
        setIsCreateOpen(false);
        setCreateData({ name: '', description: '' });
        fetchWorkspaces();
      } else {
        alert("Failed to create workspace.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkspace || !newUserId) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/workspace/${selectedWorkspace.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ userId: parseInt(newUserId), role: 'Member' })
      });
      
      const text = await res.text();
      if (!res.ok) {
        let msg = text;
        try { msg = JSON.parse(text).message || text; } catch {}
        alert(msg);
        return;
      }
      
      setNewUserId('');
      handleSelectWorkspace(selectedWorkspace); // refresh members
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="workspace-container animate-fade-in">
      <div className="workspace-header">
        <div className="workspace-title">
          <h1>Private Workspaces</h1>
          <p>Collaborate with your research team in a secure environment.</p>
        </div>
        
        <button className="create-btn" onClick={() => setIsCreateOpen(true)}>
          <Plus size={20} /> New Workspace
        </button>
      </div>

      {loading ? (
        <div className="loading-state"><h2>Loading Workspaces...</h2></div>
      ) : workspaces.length === 0 ? (
        <div className="empty-state" style={{ marginTop: '3rem' }}>
          <Briefcase size={64} style={{ opacity: 0.2, marginBottom: '1rem' }} />
          <h3>No Workspaces Yet</h3>
          <p>Create a new workspace to start collaborating.</p>
        </div>
      ) : (
        <div className="workspace-grid">
          {workspaces.map(ws => (
            <div key={ws.id} className="workspace-card" onClick={() => handleSelectWorkspace(ws)}>
              <h3>{ws.name}</h3>
              <p>{ws.description || 'No description provided.'}</p>
              
              <div className="workspace-meta">
                <span className={`role-badge ${ws.role.toLowerCase()}`}>
                  {ws.role === 'Admin' ? <Shield size={14}/> : <User size={14}/>}
                  {ws.role}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Clock size={14}/> {new Date(ws.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedWorkspace && (
        <div className="workspace-detail">
          <div className="detail-header">
            <h2>{selectedWorkspace.name} - Members Access Management</h2>
          </div>

          {selectedWorkspace.role === 'Admin' && (
            <form className="add-member-form" onSubmit={handleAddMember}>
              <div className="form-group" style={{ margin: 0, flexGrow: 1 }}>
                <label>Add User ID to Workspace</label>
                <input 
                  type="number" 
                  className="neo-input" 
                  placeholder="e.g. 2" 
                  required 
                  value={newUserId} 
                  onChange={e => setNewUserId(e.target.value)} 
                />
              </div>
              <button type="submit" className="create-btn" style={{ background: 'var(--brand-mint)', color: 'var(--brand-navy)' }}>
                Add Member
              </button>
            </form>
          )}

          <div className="members-list">
            {members.map(member => (
              <div key={member.userId} className="member-row">
                <div style={{ background: '#e2e8f0', padding: '0.8rem', borderRadius: '50%' }}>
                  <User size={24} color="#64748b" />
                </div>
                <div className="member-info">
                  <h4>{member.userName}</h4>
                  <p>{member.userEmail}</p>
                </div>
                <span className={`role-badge ${member.role.toLowerCase()}`}>
                  {member.role === 'Admin' ? <Shield size={14}/> : <User size={14}/>}
                  {member.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reused modal for creating workspace */}
      {isCreateOpen && (
        <div className="modal-overlay animate-fade-in">
          <div className="modal-content animate-slide-up">
            <div className="modal-header">
              <h2>Create New Workspace</h2>
              <button className="close-btn" onClick={() => setIsCreateOpen(false)}>✕</button>
            </div>
            
            <form onSubmit={handleCreateWorkspace}>
              <div className="form-group">
                <label>Workspace Name *</label>
                <input type="text" className="neo-input" required value={createData.name} onChange={e => setCreateData({...createData, name: e.target.value})} />
              </div>
              
              <div className="form-group">
                <label>Description</label>
                <textarea className="neo-input" rows={3} value={createData.description} onChange={e => setCreateData({...createData, description: e.target.value})}></textarea>
              </div>
              
              <div className="modal-footer">
                <button type="button" className="cancel-btn" onClick={() => setIsCreateOpen(false)}>Cancel</button>
                <button type="submit" className="create-btn" style={{background: 'var(--brand-navy)'}}>Create Workspace</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkspaceDashboard;
