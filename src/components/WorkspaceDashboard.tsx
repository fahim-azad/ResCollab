import React, { useEffect, useState } from 'react';
import { Plus, Shield, User, Clock, Briefcase, BarChart2, TrendingUp, CheckCircle2, Award, Calendar, CheckSquare } from 'lucide-react';
import WorkspaceTasks from './WorkspaceTasks';
import WorkspaceFilesAndNotes from './WorkspaceFilesAndNotes';
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

interface TeamAnalyticsDto {
  workspaceId: number;
  workspaceName: string;
  description?: string;
  ownerName: string;
  totalMembersCount: number;
  totalTasksCount: number;
  completedTasksCount: number;
  inProgressTasksCount: number;
  pendingTasksCount: number;
  taskCompletionRate: number;
  milestoneTasksCount: number;
  memberContributions: Array<{
    userId: number;
    fullName: string;
    roleInWorkspace: string;
    assignedTasksCount: number;
    completedTasksCount: number;
    taskCompletionRate: number;
    contributionPercentage: number;
  }>;
  recentTasks: Array<{
    taskId: number;
    title: string;
    status: string;
    dueDate?: string;
    assigneeName?: string;
  }>;
}

const WorkspaceDashboard: React.FC = () => {
  const [workspaces, setWorkspaces] = useState<WorkspaceDto[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<WorkspaceDto | null>(null);
  const [activeTab, setActiveTab] = useState<'members' | 'tasks' | 'files' | 'analytics'>('members');
  const [members, setMembers] = useState<MemberDto[]>([]);
  const [connections, setConnections] = useState<{ id: number; name: string }[]>([]);
  const [teamAnalytics, setTeamAnalytics] = useState<TeamAnalyticsDto | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState<boolean>(false);
  
  const [loading, setLoading] = useState(true);
  const [newUserId, setNewUserId] = useState('');
  
  // Modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createData, setCreateData] = useState({ name: '', description: '' });

  useEffect(() => {
    fetchWorkspaces();
    fetchConnections();
  }, []);

  const fetchConnections = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await fetch('http://localhost:5000/api/network/connections', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const accepted = data
          .filter((c: any) => c.status === 'Accepted')
          .map((c: any) => ({
            id: c.isRequester ? c.targetId : c.requesterId,
            name: c.isRequester ? c.targetName : c.requesterName
          }));
        setConnections(accepted);
      }
    } catch (err) {
      console.error(err);
    }
  };

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
    setActiveTab('members');
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

  const fetchTeamAnalytics = async (wsId: number) => {
    try {
      setLoadingAnalytics(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/analytics/team/${wsId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTeamAnalytics(data);
      } else {
        setTeamAnalytics(null);
      }
    } catch (err) {
      console.error('Error fetching team analytics:', err);
    } finally {
      setLoadingAnalytics(false);
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
          <div className="detail-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '1rem' }}>
            <h2 style={{ margin: 0 }}>{selectedWorkspace.name}</h2>
            
            <div className="workspace-tabs" style={{ display: 'flex', gap: '1rem', width: '100%', borderBottom: '1px solid #eee', overflowX: 'auto' }}>
              <button className={`tab-btn ${activeTab === 'members' ? 'active' : ''}`} onClick={() => setActiveTab('members')}>Members & Access</button>
              <button className={`tab-btn ${activeTab === 'tasks' ? 'active' : ''}`} onClick={() => setActiveTab('tasks')}>Tasks & Milestones</button>
              <button className={`tab-btn ${activeTab === 'files' ? 'active' : ''}`} onClick={() => setActiveTab('files')}>Files & Notes</button>
              <button
                id="tab-workspace-analytics"
                className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('analytics');
                  fetchTeamAnalytics(selectedWorkspace.id);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <BarChart2 size={16} /> Team Velocity & Analytics
              </button>
            </div>
          </div>

          {activeTab === 'members' && (
            <>
              {selectedWorkspace.role === 'Admin' && (
                <form className="add-member-form" onSubmit={handleAddMember} style={{ display: 'flex', alignItems: 'flex-end', gap: '0.8rem', flexWrap: 'wrap' }}>
                  <div className="form-group" style={{ margin: 0, flexGrow: 1, minWidth: '220px' }}>
                    <label>Add Teammate / Connection to Workspace</label>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {connections.length > 0 && (
                        <select 
                          className="neo-input" 
                          style={{ flex: 1, minWidth: '180px' }}
                          value={newUserId} 
                          onChange={e => setNewUserId(e.target.value)}
                        >
                          <option value="">-- Choose from your connections --</option>
                          {connections
                            .filter(c => !members.some(m => m.userId === c.id))
                            .map(c => (
                              <option key={c.id} value={c.id}>{c.name} (ID: {c.id})</option>
                            ))
                          }
                        </select>
                      )}
                      <input 
                        type="number" 
                        className="neo-input" 
                        style={{ width: '120px' }}
                        placeholder="Or User ID" 
                        required 
                        value={newUserId} 
                        onChange={e => setNewUserId(e.target.value)} 
                      />
                    </div>
                  </div>
                  <button type="submit" className="create-btn" style={{ background: 'var(--brand-mint)', color: 'var(--brand-navy)', height: '42px', whiteSpace: 'nowrap' }}>
                    Add Teammate
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
            </>
          )}

          {activeTab === 'tasks' && (
             <WorkspaceTasks workspaceId={selectedWorkspace.id} members={members} />
          )}

          {activeTab === 'files' && (
             <WorkspaceFilesAndNotes workspaceId={selectedWorkspace.id} />
          )}

          {activeTab === 'analytics' && (
            <div className="workspace-analytics-panel" style={{ marginTop: '1.5rem' }}>
              {loadingAnalytics ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                  <p>Calculating team sprint velocity metrics...</p>
                </div>
              ) : teamAnalytics ? (
                <>
                  {/* KPI Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.8rem' }}>
                    <div style={{ background: '#f8fafc', padding: '1.2rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.85rem', fontWeight: 600 }}>
                        <span>Team Size</span>
                        <User size={18} color="#4f46e5" />
                      </div>
                      <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', margin: '0.4rem 0' }}>{teamAnalytics.totalMembersCount}</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Active Collaborators</div>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '1.2rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.85rem', fontWeight: 600 }}>
                        <span>Sprint Velocity</span>
                        <TrendingUp size={18} color="#10b981" />
                      </div>
                      <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10b981', margin: '0.4rem 0' }}>{Math.round(teamAnalytics.taskCompletionRate)}%</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{teamAnalytics.completedTasksCount} / {teamAnalytics.totalTasksCount} tasks done</div>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '1.2rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.85rem', fontWeight: 600 }}>
                        <span>Task Status</span>
                        <CheckSquare size={18} color="#06b6d4" />
                      </div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: '0.4rem 0' }}>
                        <span style={{ color: '#10b981' }}>{teamAnalytics.completedTasksCount}</span> / <span style={{ color: '#06b6d4' }}>{teamAnalytics.inProgressTasksCount}</span> / <span style={{ color: '#64748b' }}>{teamAnalytics.pendingTasksCount}</span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Done / In-Prog / Todo</div>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '1.2rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.85rem', fontWeight: 600 }}>
                        <span>Milestones Met</span>
                        <Award size={18} color="#f59e0b" />
                      </div>
                      <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f59e0b', margin: '0.4rem 0' }}>{teamAnalytics.milestoneTasksCount}</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Research Milestones</div>
                    </div>
                  </div>

                  {/* Task Status Segmented Progress Bar */}
                  {teamAnalytics.totalTasksCount > 0 && (
                    <div style={{ background: '#ffffff', padding: '1.4rem', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '1.8rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem', fontWeight: 600, color: '#334155' }}>
                        <span>Sprint Task Distribution</span>
                        <span style={{ color: '#64748b', fontSize: '0.9rem' }}>{teamAnalytics.totalTasksCount} Total Tasks</span>
                      </div>
                      <div style={{ display: 'flex', height: '12px', borderRadius: '9999px', overflow: 'hidden', background: '#f1f5f9' }}>
                        <div style={{ width: `${(teamAnalytics.completedTasksCount / teamAnalytics.totalTasksCount) * 100}%`, background: '#10b981' }} title={`Completed: ${teamAnalytics.completedTasksCount}`} />
                        <div style={{ width: `${(teamAnalytics.inProgressTasksCount / teamAnalytics.totalTasksCount) * 100}%`, background: '#06b6d4' }} title={`In-Progress: ${teamAnalytics.inProgressTasksCount}`} />
                        <div style={{ width: `${(teamAnalytics.pendingTasksCount / teamAnalytics.totalTasksCount) * 100}%`, background: '#cbd5e1' }} title={`Pending: ${teamAnalytics.pendingTasksCount}`} />
                      </div>
                      <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.8rem', fontSize: '0.82rem', color: '#64748b' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} /> Done ({teamAnalytics.completedTasksCount})
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#06b6d4' }} /> In Progress ({teamAnalytics.inProgressTasksCount})
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#cbd5e1' }} /> To-Do ({teamAnalytics.pendingTasksCount})
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Member Contribution Breakdown */}
                  <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.4rem', marginBottom: '1.8rem' }}>
                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <CheckCircle2 size={18} color="#4f46e5" /> Member Task Velocity Matrix
                    </h3>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b' }}>
                            <th style={{ padding: '0.6rem 0.8rem' }}>Member</th>
                            <th style={{ padding: '0.6rem 0.8rem' }}>Role</th>
                            <th style={{ padding: '0.6rem 0.8rem' }}>Assigned</th>
                            <th style={{ padding: '0.6rem 0.8rem' }}>Completed</th>
                            <th style={{ padding: '0.6rem 0.8rem' }}>Velocity</th>
                            <th style={{ padding: '0.6rem 0.8rem' }}>Sprint Contribution</th>
                          </tr>
                        </thead>
                        <tbody>
                          {teamAnalytics.memberContributions?.map(m => {
                            const barColor = m.taskCompletionRate >= 70 ? '#10b981' : m.taskCompletionRate >= 40 ? '#06b6d4' : '#f59e0b';
                            return (
                              <tr key={m.userId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '0.8rem', fontWeight: 600 }}>{m.fullName}</td>
                                <td style={{ padding: '0.8rem' }}><span className="role-badge" style={{ background: '#f1f5f9' }}>{m.roleInWorkspace || 'Member'}</span></td>
                                <td style={{ padding: '0.8rem' }}>{m.assignedTasksCount}</td>
                                <td style={{ padding: '0.8rem' }}>{m.completedTasksCount}</td>
                                <td style={{ padding: '0.8rem', width: '160px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <div style={{ flex: 1, height: '6px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                      <div style={{ width: `${Math.min(100, m.taskCompletionRate)}%`, height: '100%', background: barColor }} />
                                    </div>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, minWidth: '34px' }}>{Math.round(m.taskCompletionRate)}%</span>
                                  </div>
                                </td>
                                <td style={{ padding: '0.8rem', width: '160px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <div style={{ flex: 1, height: '6px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                      <div style={{ width: `${Math.min(100, m.contributionPercentage)}%`, height: '100%', background: 'linear-gradient(90deg, #6366f1, #a855f7)' }} />
                                    </div>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, minWidth: '34px' }}>{Math.round(m.contributionPercentage)}%</span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                          {(!teamAnalytics.memberContributions || teamAnalytics.memberContributions.length === 0) && (
                            <tr><td colSpan={6} style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8' }}>No member contributions yet.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Recent Tasks */}
                  {teamAnalytics.recentTasks && teamAnalytics.recentTasks.length > 0 && (
                    <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.4rem' }}>
                      <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Clock size={18} color="#06b6d4" /> Recent Sprint Tasks & Status
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        {teamAnalytics.recentTasks.map(t => (
                          <div key={t.taskId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: '#f8fafc', borderRadius: '8px' }}>
                            <div>
                              <div style={{ fontWeight: 600, color: '#1e293b' }}>{t.title}</div>
                              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Assignee: {t.assigneeName || 'Unassigned'}</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                              {t.dueDate && (
                                <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                                  <Calendar size={13} /> {new Date(t.dueDate).toLocaleDateString()}
                                </span>
                              )}
                              <span style={{
                                padding: '0.2rem 0.6rem',
                                borderRadius: '9999px',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                background: t.status === 'Done' || t.status === 'Completed' ? '#dcfce7' : t.status === 'InProgress' ? '#cffafe' : '#f1f5f9',
                                color: t.status === 'Done' || t.status === 'Completed' ? '#15803d' : t.status === 'InProgress' ? '#0e7490' : '#64748b'
                              }}>
                                {t.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                  <p>No analytics data available for this workspace.</p>
                </div>
              )}
            </div>
          )}
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
