import React, { useEffect, useState, useCallback } from 'react';
import {
  BarChart2, Building2, Users, BookOpen, Layers,
  RefreshCw, TrendingUp, Compass, Award, Shield,
  CheckCircle2, Clock, Globe, ArrowUpRight, FolderGit2
} from 'lucide-react';
import './ResearchAnalyticsDashboard.css';

// ==========================================
// TYPES & INTERFACES
// ==========================================

interface GlobalSummary {
  totalResearchers: number;
  totalPublications: number;
  totalWorkspaces: number;
  totalOpenProjects: number;
  totalLaboratories: number;
  totalUniversities: number;
  totalCollaborations: number;
  topResearchAreas: Array<{ tag: string; count: number }>;
  recentSnapshots: Array<{
    id: number;
    scopeType: string;
    scopeId: number;
    totalPublications: number;
    totalProjects: number;
    activeCollaborations: number;
    progressPercentage: number;
    lastCalculated: string;
  }>;
}

interface InstitutionalAnalytics {
  institutionId: number;
  institutionName: string;
  totalResearchers: number;
  totalPublications: number;
  activeWorkspaces: number;
  openProjects: number;
  externalPartnerships: number;
  departmentBreakdown: Array<{
    departmentId: number;
    departmentName: string;
    researcherCount: number;
    publicationCount: number;
    activeProjectsCount: number;
  }>;
}

interface DepartmentAnalytics {
  departmentId: number;
  departmentName: string;
  institutionName: string;
  researchersCount: number;
  publicationsCount: number;
  activeProjectsCount: number;
  activeResearchers: Array<{
    userId: number;
    fullName: string;
    role: string;
    publicationCount: number;
    activeProjectsCount: number;
  }>;
}

interface ResearcherAnalytics {
  userId: number;
  fullName: string;
  institution?: string;
  department?: string;
  role: string;
  publicationCount: number;
  activeCollaborations: number;
  activeWorkspaces: number;
  supervisedProjects: number;
  assignedTasksCount: number;
  completedTasksCount: number;
  taskCompletionRate: number;
  recentPublications: Array<{
    id: number;
    title: string;
    journalOrConference?: string;
    publicationYear: number;
  }>;
  collaboratorNetwork: Array<{
    userId: number;
    fullName: string;
    institution?: string;
  }>;
}

interface TeamAnalytics {
  workspaceId: number;
  workspaceName: string;
  membersCount: number;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  todoTasks: number;
  completionRate: number;
  memberContributions: Array<{
    userId: number;
    fullName: string;
    role: string;
    assignedTasksCount: number;
    completedTasksCount: number;
  }>;
  milestoneVelocity: number;
}

interface UniversityItem {
  id: number;
  name: string;
}

interface WorkspaceItem {
  id: number;
  name: string;
}

const ResearchAnalyticsDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'global' | 'institution' | 'department' | 'researcher' | 'team'>('global');
  const [loading, setLoading] = useState<boolean>(true);
  const [recalculating, setRecalculating] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Data states
  const [globalData, setGlobalData] = useState<GlobalSummary | null>(null);
  const [institutionalData, setInstitutionalData] = useState<InstitutionalAnalytics | null>(null);
  const [departmentData, setDepartmentData] = useState<DepartmentAnalytics | null>(null);
  const [researcherData, setResearcherData] = useState<ResearcherAnalytics | null>(null);
  const [teamData, setTeamData] = useState<TeamAnalytics | null>(null);

  // Selectors list
  const [universities, setUniversities] = useState<UniversityItem[]>([]);
  const [selectedUniversityId, setSelectedUniversityId] = useState<number>(1);

  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<number>(1);

  const [departmentIdInput, setDepartmentIdInput] = useState<number>(1);
  const [researcherIdInput, setResearcherIdInput] = useState<string>('');

  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const currentUser = userStr ? JSON.parse(userStr) : null;
  const currentUserId = currentUser?.id || 1;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 1. Fetch Global Platform Analytics
  const fetchGlobalAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('http://localhost:5000/api/analytics/summary', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setGlobalData(data);
      }
    } catch (err) {
      console.error('Error fetching global analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // 2. Fetch Institutional Analytics
  const fetchInstitutionalAnalytics = useCallback(async (instId: number) => {
    try {
      setLoading(true);
      const res = await fetch(`http://localhost:5000/api/analytics/institutional/${instId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setInstitutionalData(data);
      } else {
        setInstitutionalData(null);
      }
    } catch (err) {
      console.error('Error fetching institutional analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // 3. Fetch Department Analytics
  const fetchDepartmentAnalytics = useCallback(async (deptId: number) => {
    try {
      setLoading(true);
      const res = await fetch(`http://localhost:5000/api/analytics/department/${deptId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDepartmentData(data);
      } else {
        setDepartmentData(null);
      }
    } catch (err) {
      console.error('Error fetching department analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // 4. Fetch Researcher Analytics
  const fetchResearcherAnalytics = useCallback(async (userIdTarget: number) => {
    try {
      setLoading(true);
      const res = await fetch(`http://localhost:5000/api/analytics/researcher/${userIdTarget}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setResearcherData(data);
      } else {
        setResearcherData(null);
      }
    } catch (err) {
      console.error('Error fetching researcher analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // 5. Fetch Team Analytics
  const fetchTeamAnalytics = useCallback(async (wsId: number) => {
    try {
      setLoading(true);
      const res = await fetch(`http://localhost:5000/api/analytics/team/${wsId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTeamData(data);
      } else {
        setTeamData(null);
      }
    } catch (err) {
      console.error('Error fetching team analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Initial Dropdowns Data
  useEffect(() => {
    const fetchDropdowns = async () => {
      try {
        const [uRes, wRes] = await Promise.all([
          fetch('http://localhost:5000/api/university', { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch('http://localhost:5000/api/workspace', { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        if (uRes.ok) {
          const uList = await uRes.json();
          if (Array.isArray(uList) && uList.length > 0) {
            setUniversities(uList);
            setSelectedUniversityId(uList[0].id);
          }
        }

        if (wRes.ok) {
          const wList = await wRes.json();
          if (Array.isArray(wList) && wList.length > 0) {
            setWorkspaces(wList);
            setSelectedWorkspaceId(wList[0].id);
          }
        }
      } catch (e) {
        console.error('Failed to load selector options', e);
      }
    };

    fetchDropdowns();
    fetchGlobalAnalytics();
  }, [token, fetchGlobalAnalytics]);

  // Switch tabs handler
  const handleTabChange = (tab: 'global' | 'institution' | 'department' | 'researcher' | 'team') => {
    setActiveTab(tab);
    if (tab === 'global') fetchGlobalAnalytics();
    if (tab === 'institution') fetchInstitutionalAnalytics(selectedUniversityId);
    if (tab === 'department') fetchDepartmentAnalytics(departmentIdInput);
    if (tab === 'researcher') fetchResearcherAnalytics(researcherIdInput ? parseInt(researcherIdInput) : currentUserId);
    if (tab === 'team') fetchTeamAnalytics(selectedWorkspaceId);
  };

  // Recalculate Snapshots Trigger
  const handleRecalculate = async () => {
    try {
      setRecalculating(true);
      const res = await fetch('http://localhost:5000/api/analytics/recalculate', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        showToast('✓ Platform analytics snapshots recalculated successfully.');
        if (activeTab === 'global') fetchGlobalAnalytics();
        if (activeTab === 'institution') fetchInstitutionalAnalytics(selectedUniversityId);
        if (activeTab === 'department') fetchDepartmentAnalytics(departmentIdInput);
        if (activeTab === 'researcher') fetchResearcherAnalytics(researcherIdInput ? parseInt(researcherIdInput) : currentUserId);
        if (activeTab === 'team') fetchTeamAnalytics(selectedWorkspaceId);
      } else {
        showToast('Only authorized administrators or moderators can trigger metric rollups.');
      }
    } catch {
      showToast('Recalculation request failed.');
    } finally {
      setRecalculating(false);
    }
  };

  return (
    <div className="analytics-container" id="research-analytics-dashboard">
      {/* Header Banner */}
      <div className="analytics-header">
        <div className="analytics-title-group">
          <h1>
            <BarChart2 size={32} color="#4f46e5" />
            Research & Collaboration Analytics
          </h1>
          <p>Multi-dimensional performance metrics, publication outputs, and collaboration networks.</p>
        </div>

        <div className="analytics-header-actions">
          <button
            id="btn-analytics-recalculate"
            className="btn-recalc"
            onClick={handleRecalculate}
            disabled={recalculating}
          >
            <RefreshCw size={17} className={recalculating ? 'spinner-icon' : ''} />
            {recalculating ? 'Recalculating...' : 'Recalculate Metrics'}
          </button>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="analytics-tabs" role="tablist">
        <button
          id="tab-analytics-global"
          className={`analytics-tab-btn ${activeTab === 'global' ? 'active' : ''}`}
          onClick={() => handleTabChange('global')}
        >
          <Globe size={18} /> Global Pulse
        </button>
        <button
          id="tab-analytics-institution"
          className={`analytics-tab-btn ${activeTab === 'institution' ? 'active' : ''}`}
          onClick={() => handleTabChange('institution')}
        >
          <Building2 size={18} /> Institutional
        </button>
        <button
          id="tab-analytics-department"
          className={`analytics-tab-btn ${activeTab === 'department' ? 'active' : ''}`}
          onClick={() => handleTabChange('department')}
        >
          <Layers size={18} /> Departmental
        </button>
        <button
          id="tab-analytics-researcher"
          className={`analytics-tab-btn ${activeTab === 'researcher' ? 'active' : ''}`}
          onClick={() => handleTabChange('researcher')}
        >
          <Users size={18} /> My Researcher Metrics
        </button>
        <button
          id="tab-analytics-team"
          className={`analytics-tab-btn ${activeTab === 'team' ? 'active' : ''}`}
          onClick={() => handleTabChange('team')}
        >
          <Shield size={18} /> Workspace & Team Velocity
        </button>
      </div>

      {/* TAB 1: GLOBAL PLATFORM ANALYTICS */}
      {activeTab === 'global' && (
        <div id="panel-analytics-global">
          {loading && !globalData ? (
            <div className="analytics-loading">
              <RefreshCw size={36} className="spinner-icon" />
              <p>Aggregating platform research data...</p>
            </div>
          ) : globalData ? (
            <>
              <div className="kpi-grid">
                <div className="kpi-card" id="card-metric-researchers" style={{ ['--kpi-accent' as string]: '#4f46e5', ['--kpi-bg' as string]: 'rgba(79, 70, 229, 0.1)' }}>
                  <div className="kpi-header">
                    <span className="kpi-label">Active Researchers</span>
                    <span className="kpi-icon-badge"><Users size={22} /></span>
                  </div>
                  <div className="kpi-value">{globalData.totalResearchers}</div>
                  <div className="kpi-subtext"><TrendingUp size={15} color="#10b981" /> Verified academic profiles</div>
                </div>

                <div className="kpi-card" id="card-metric-publications" style={{ ['--kpi-accent' as string]: '#06b6d4', ['--kpi-bg' as string]: 'rgba(6, 182, 212, 0.1)' }}>
                  <div className="kpi-header">
                    <span className="kpi-label">Total Publications</span>
                    <span className="kpi-icon-badge"><BookOpen size={22} /></span>
                  </div>
                  <div className="kpi-value">{globalData.totalPublications}</div>
                  <div className="kpi-subtext"><Award size={15} color="#06b6d4" /> Peer-reviewed & preprints</div>
                </div>

                <div className="kpi-card" id="card-metric-workspaces" style={{ ['--kpi-accent' as string]: '#10b981', ['--kpi-bg' as string]: 'rgba(16, 185, 129, 0.1)' }}>
                  <div className="kpi-header">
                    <span className="kpi-label">Active Workspaces</span>
                    <span className="kpi-icon-badge"><FolderGit2 size={22} /></span>
                  </div>
                  <div className="kpi-value">{globalData.totalWorkspaces}</div>
                  <div className="kpi-subtext"><CheckCircle2 size={15} color="#10b981" /> Collaborative teams</div>
                </div>

                <div className="kpi-card" id="card-metric-collaborations" style={{ ['--kpi-accent' as string]: '#f59e0b', ['--kpi-bg' as string]: 'rgba(245, 158, 11, 0.1)' }}>
                  <div className="kpi-header">
                    <span className="kpi-label">Inter-Researcher Links</span>
                    <span className="kpi-icon-badge"><Globe size={22} /></span>
                  </div>
                  <div className="kpi-value">{globalData.totalCollaborations}</div>
                  <div className="kpi-subtext"><ArrowUpRight size={15} color="#f59e0b" /> Cross-institutional networks</div>
                </div>
              </div>

              {/* Research Topic Frequency */}
              <div className="analytics-section">
                <div className="section-header">
                  <div className="section-title">
                    <Compass size={22} color="#4f46e5" />
                    High-Velocity Research Disciplines & Topics
                  </div>
                </div>

                <div className="tags-cloud">
                  {globalData.topResearchAreas.length > 0 ? (
                    globalData.topResearchAreas.map(t => (
                      <span key={t.tag} className="topic-tag-chip" id={`analytics-tag-${t.tag.toLowerCase().replace(/\s+/g, '-')}`}>
                        {t.tag}
                        <span className="tag-counter">{t.count}</span>
                      </span>
                    ))
                  ) : (
                    <p style={{ color: '#94a3b8' }}>No tagged research areas recorded yet.</p>
                  )}
                </div>
              </div>

              {/* Recent Cached Snapshot Rollups */}
              {globalData.recentSnapshots && globalData.recentSnapshots.length > 0 && (
                <div className="analytics-section">
                  <div className="section-header">
                    <div className="section-title">
                      <Clock size={22} color="#06b6d4" />
                      Recent Analytics Snapshot Rollups
                    </div>
                  </div>
                  <div className="analytics-table-wrapper">
                    <table className="analytics-table">
                      <thead>
                        <tr>
                          <th>Scope Type</th>
                          <th>Scope ID</th>
                          <th>Publications</th>
                          <th>Projects</th>
                          <th>Collaborations</th>
                          <th>Task Velocity</th>
                          <th>Timestamp</th>
                        </tr>
                      </thead>
                      <tbody>
                        {globalData.recentSnapshots.map(s => (
                          <tr key={s.id}>
                            <td><strong>{s.scopeType}</strong></td>
                            <td>#{s.scopeId}</td>
                            <td>{s.totalPublications}</td>
                            <td>{s.totalProjects}</td>
                            <td>{s.activeCollaborations}</td>
                            <td>
                              <div className="progress-container">
                                <div className="progress-bar-bg">
                                  <div className="progress-bar-fill" style={{ width: `${Math.min(100, s.progressPercentage)}%` }} />
                                </div>
                                <span className="progress-label">{Math.round(s.progressPercentage)}%</span>
                              </div>
                            </td>
                            <td>{new Date(s.lastCalculated).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="analytics-empty">No global analytics records found.</div>
          )}
        </div>
      )}

      {/* TAB 2: INSTITUTIONAL ANALYTICS */}
      {activeTab === 'institution' && (
        <div id="panel-analytics-institution">
          <div className="filter-bar">
            <label style={{ fontWeight: 600, color: '#475569' }}>Select University:</label>
            <select
              id="select-analytics-institution"
              className="filter-select"
              value={selectedUniversityId}
              onChange={e => {
                const id = parseInt(e.target.value);
                setSelectedUniversityId(id);
                fetchInstitutionalAnalytics(id);
              }}
            >
              {universities.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
              {universities.length === 0 && <option value={1}>Institution #1 (Default)</option>}
            </select>
          </div>

          {loading ? (
            <div className="analytics-loading"><RefreshCw size={36} className="spinner-icon" /><p>Loading institutional metrics...</p></div>
          ) : institutionalData ? (
            <>
              <div className="kpi-grid">
                <div className="kpi-card" style={{ ['--kpi-accent' as string]: '#4f46e5' }}>
                  <div className="kpi-header"><span className="kpi-label">Affiliated Faculty</span><Users size={22} color="#4f46e5" /></div>
                  <div className="kpi-value">{institutionalData.totalResearchers}</div>
                  <div className="kpi-subtext">Researchers & Professors</div>
                </div>
                <div className="kpi-card" style={{ ['--kpi-accent' as string]: '#06b6d4' }}>
                  <div className="kpi-header"><span className="kpi-label">Institutional Papers</span><BookOpen size={22} color="#06b6d4" /></div>
                  <div className="kpi-value">{institutionalData.totalPublications}</div>
                  <div className="kpi-subtext">Published works</div>
                </div>
                <div className="kpi-card" style={{ ['--kpi-accent' as string]: '#10b981' }}>
                  <div className="kpi-header"><span className="kpi-label">Funded Projects</span><FolderGit2 size={22} color="#10b981" /></div>
                  <div className="kpi-value">{institutionalData.openProjects}</div>
                  <div className="kpi-subtext">Ongoing initiatives</div>
                </div>
                <div className="kpi-card" style={{ ['--kpi-accent' as string]: '#f59e0b' }}>
                  <div className="kpi-header"><span className="kpi-label">External Partnerships</span><Globe size={22} color="#f59e0b" /></div>
                  <div className="kpi-value">{institutionalData.externalPartnerships}</div>
                  <div className="kpi-subtext">Inter-institutional alliances</div>
                </div>
              </div>

              {/* Departmental Output Table */}
              <div className="analytics-section">
                <div className="section-header">
                  <div className="section-title">
                    <Building2 size={22} color="#4f46e5" />
                    Departmental Research Output ({institutionalData.institutionName})
                  </div>
                </div>
                <div className="analytics-table-wrapper">
                  <table className="analytics-table" id="table-analytics-breakdown">
                    <thead>
                      <tr>
                        <th>Department</th>
                        <th>Researchers</th>
                        <th>Publications</th>
                        <th>Active Projects</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {institutionalData.departmentBreakdown.map(dept => (
                        <tr key={dept.departmentId}>
                          <td><strong>{dept.departmentName}</strong></td>
                          <td>{dept.researcherCount}</td>
                          <td>{dept.publicationCount}</td>
                          <td>{dept.activeProjectsCount}</td>
                          <td>
                            <button
                              className="btn-recalc"
                              style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                              onClick={() => {
                                setDepartmentIdInput(dept.departmentId);
                                setActiveTab('department');
                                fetchDepartmentAnalytics(dept.departmentId);
                              }}
                            >
                              View Department
                            </button>
                          </td>
                        </tr>
                      ))}
                      {institutionalData.departmentBreakdown.length === 0 && (
                        <tr><td colSpan={5} style={{ textAlign: 'center', color: '#94a3b8' }}>No departmental breakdown records found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="analytics-empty">No institutional data recorded for this selection.</div>
          )}
        </div>
      )}

      {/* TAB 3: DEPARTMENTAL ANALYTICS */}
      {activeTab === 'department' && (
        <div id="panel-analytics-department">
          <div className="filter-bar">
            <label style={{ fontWeight: 600, color: '#475569' }}>Department ID:</label>
            <input
              id="select-analytics-department"
              className="filter-input"
              type="number"
              min="1"
              value={departmentIdInput}
              onChange={e => setDepartmentIdInput(parseInt(e.target.value) || 1)}
            />
            <button
              className="btn-recalc"
              onClick={() => fetchDepartmentAnalytics(departmentIdInput)}
            >
              Analyze Department
            </button>
          </div>

          {loading ? (
            <div className="analytics-loading"><RefreshCw size={36} className="spinner-icon" /><p>Analyzing department statistics...</p></div>
          ) : departmentData ? (
            <>
              <div className="kpi-grid">
                <div className="kpi-card" style={{ ['--kpi-accent' as string]: '#4f46e5' }}>
                  <div className="kpi-header"><span className="kpi-label">Department Faculty</span><Users size={22} color="#4f46e5" /></div>
                  <div className="kpi-value">{departmentData.researchersCount}</div>
                  <div className="kpi-subtext">{departmentData.departmentName}</div>
                </div>
                <div className="kpi-card" style={{ ['--kpi-accent' as string]: '#06b6d4' }}>
                  <div className="kpi-header"><span className="kpi-label">Publications</span><BookOpen size={22} color="#06b6d4" /></div>
                  <div className="kpi-value">{departmentData.publicationsCount}</div>
                  <div className="kpi-subtext">Department output</div>
                </div>
                <div className="kpi-card" style={{ ['--kpi-accent' as string]: '#10b981' }}>
                  <div className="kpi-header"><span className="kpi-label">Projects</span><FolderGit2 size={22} color="#10b981" /></div>
                  <div className="kpi-value">{departmentData.activeProjectsCount}</div>
                  <div className="kpi-subtext">Collaborative initiatives</div>
                </div>
              </div>

              {/* Active Researchers List */}
              <div className="analytics-section">
                <div className="section-header">
                  <div className="section-title">
                    <Users size={22} color="#4f46e5" />
                    Top Active Researchers ({departmentData.departmentName})
                  </div>
                </div>
                <div className="analytics-table-wrapper">
                  <table className="analytics-table">
                    <thead>
                      <tr>
                        <th>Researcher Name</th>
                        <th>Role</th>
                        <th>Publications</th>
                        <th>Active Projects</th>
                        <th>Profile Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {departmentData.activeResearchers.map(r => (
                        <tr key={r.userId}>
                          <td><strong>{r.fullName}</strong></td>
                          <td><span className="tag-counter">{r.role}</span></td>
                          <td>{r.publicationCount}</td>
                          <td>{r.activeProjectsCount}</td>
                          <td>
                            <button
                              className="btn-recalc"
                              style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                              onClick={() => {
                                setResearcherIdInput(r.userId.toString());
                                setActiveTab('researcher');
                                fetchResearcherAnalytics(r.userId);
                              }}
                            >
                              View Metrics
                            </button>
                          </td>
                        </tr>
                      ))}
                      {departmentData.activeResearchers.length === 0 && (
                        <tr><td colSpan={5} style={{ textAlign: 'center', color: '#94a3b8' }}>No researcher profiles recorded in this department.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="analytics-empty">No department analytics found for ID #{departmentIdInput}.</div>
          )}
        </div>
      )}

      {/* TAB 4: RESEARCHER PROFILE METRICS */}
      {activeTab === 'researcher' && (
        <div id="panel-analytics-researcher">
          <div className="filter-bar">
            <label style={{ fontWeight: 600, color: '#475569' }}>Researcher User ID:</label>
            <input
              id="input-analytics-researcher-id"
              className="filter-input"
              type="text"
              placeholder={`Current User (#${currentUserId})`}
              value={researcherIdInput}
              onChange={e => setResearcherIdInput(e.target.value)}
            />
            <button
              className="btn-recalc"
              onClick={() => fetchResearcherAnalytics(researcherIdInput ? parseInt(researcherIdInput) : currentUserId)}
            >
              Analyze Researcher
            </button>
          </div>

          {loading ? (
            <div className="analytics-loading"><RefreshCw size={36} className="spinner-icon" /><p>Analyzing researcher output...</p></div>
          ) : researcherData ? (
            <>
              <div className="kpi-grid">
                <div className="kpi-card" style={{ ['--kpi-accent' as string]: '#4f46e5' }}>
                  <div className="kpi-header"><span className="kpi-label">Publications</span><BookOpen size={22} color="#4f46e5" /></div>
                  <div className="kpi-value">{researcherData.publicationCount}</div>
                  <div className="kpi-subtext">Authored & Co-Authored</div>
                </div>
                <div className="kpi-card" style={{ ['--kpi-accent' as string]: '#10b981' }}>
                  <div className="kpi-header"><span className="kpi-label">Collaborators</span><Users size={22} color="#10b981" /></div>
                  <div className="kpi-value">{researcherData.activeCollaborations}</div>
                  <div className="kpi-subtext">Connected researchers</div>
                </div>
                <div className="kpi-card" style={{ ['--kpi-accent' as string]: '#06b6d4' }}>
                  <div className="kpi-header"><span className="kpi-label">Active Workspaces</span><FolderGit2 size={22} color="#06b6d4" /></div>
                  <div className="kpi-value">{researcherData.activeWorkspaces}</div>
                  <div className="kpi-subtext">Participating teams</div>
                </div>
                <div className="kpi-card" style={{ ['--kpi-accent' as string]: '#f59e0b' }}>
                  <div className="kpi-header"><span className="kpi-label">Task Velocity</span><TrendingUp size={22} color="#f59e0b" /></div>
                  <div className="kpi-value">{Math.round(researcherData.taskCompletionRate)}%</div>
                  <div className="kpi-subtext">{researcherData.completedTasksCount} / {researcherData.assignedTasksCount} tasks done</div>
                </div>
              </div>

              {/* Recent Publications */}
              <div className="analytics-section">
                <div className="section-header">
                  <div className="section-title">
                    <BookOpen size={22} color="#4f46e5" />
                    Publications by {researcherData.fullName}
                  </div>
                </div>
                <div className="analytics-table-wrapper">
                  <table className="analytics-table">
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Venue / Journal</th>
                        <th>Year</th>
                      </tr>
                    </thead>
                    <tbody>
                      {researcherData.recentPublications.map(p => (
                        <tr key={p.id}>
                          <td><strong>{p.title}</strong></td>
                          <td>{p.journalOrConference || 'Scholarly Publication'}</td>
                          <td>{p.publicationYear}</td>
                        </tr>
                      ))}
                      {researcherData.recentPublications.length === 0 && (
                        <tr><td colSpan={3} style={{ textAlign: 'center', color: '#94a3b8' }}>No publications registered yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Collaborator Network Edge List */}
              <div className="analytics-section">
                <div className="section-header">
                  <div className="section-title">
                    <Globe size={22} color="#10b981" />
                    Collaborator Network
                  </div>
                </div>
                <div className="tags-cloud">
                  {researcherData.collaboratorNetwork.map(c => (
                    <span key={c.userId} className="topic-tag-chip">
                      <strong>{c.fullName}</strong>
                      <span className="tag-counter">{c.institution || 'University'}</span>
                    </span>
                  ))}
                  {researcherData.collaboratorNetwork.length === 0 && (
                    <p style={{ color: '#94a3b8' }}>No active collaboration edges found.</p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="analytics-empty">No researcher profile found.</div>
          )}
        </div>
      )}

      {/* TAB 5: TEAM & WORKSPACE VELOCITY */}
      {activeTab === 'team' && (
        <div id="panel-analytics-team">
          <div className="filter-bar">
            <label style={{ fontWeight: 600, color: '#475569' }}>Select Workspace:</label>
            <select
              id="select-analytics-workspace"
              className="filter-select"
              value={selectedWorkspaceId}
              onChange={e => {
                const id = parseInt(e.target.value);
                setSelectedWorkspaceId(id);
                fetchTeamAnalytics(id);
              }}
            >
              {workspaces.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
              {workspaces.length === 0 && <option value={1}>Workspace #1</option>}
            </select>
          </div>

          {loading ? (
            <div className="analytics-loading"><RefreshCw size={36} className="spinner-icon" /><p>Calculating workspace velocity...</p></div>
          ) : teamData ? (
            <>
              <div className="kpi-grid">
                <div className="kpi-card" style={{ ['--kpi-accent' as string]: '#4f46e5' }}>
                  <div className="kpi-header"><span className="kpi-label">Team Members</span><Users size={22} color="#4f46e5" /></div>
                  <div className="kpi-value">{teamData.membersCount}</div>
                  <div className="kpi-subtext">Active collaborators</div>
                </div>
                <div className="kpi-card" style={{ ['--kpi-accent' as string]: '#10b981' }}>
                  <div className="kpi-header"><span className="kpi-label">Completed Tasks</span><CheckCircle2 size={22} color="#10b981" /></div>
                  <div className="kpi-value">{teamData.completedTasks}</div>
                  <div className="kpi-subtext">of {teamData.totalTasks} total tasks</div>
                </div>
                <div className="kpi-card" style={{ ['--kpi-accent' as string]: '#06b6d4' }}>
                  <div className="kpi-header"><span className="kpi-label">Completion Velocity</span><TrendingUp size={22} color="#06b6d4" /></div>
                  <div className="kpi-value">{Math.round(teamData.completionRate)}%</div>
                  <div className="kpi-subtext">Overall sprint progress</div>
                </div>
                <div className="kpi-card" style={{ ['--kpi-accent' as string]: '#f59e0b' }}>
                  <div className="kpi-header"><span className="kpi-label">Milestones Met</span><Award size={22} color="#f59e0b" /></div>
                  <div className="kpi-value">{teamData.milestoneVelocity}</div>
                  <div className="kpi-subtext">Key research milestones</div>
                </div>
              </div>

              {/* Member Contribution Breakdown */}
              <div className="analytics-section">
                <div className="section-header">
                  <div className="section-title">
                    <Users size={22} color="#4f46e5" />
                    Member Task Breakdown ({teamData.workspaceName})
                  </div>
                </div>
                <div className="analytics-table-wrapper">
                  <table className="analytics-table">
                    <thead>
                      <tr>
                        <th>Member Name</th>
                        <th>Role</th>
                        <th>Assigned Tasks</th>
                        <th>Completed Tasks</th>
                        <th>Progress</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamData.memberContributions.map(m => {
                        const pct = m.assignedTasksCount > 0 ? (m.completedTasksCount * 100) / m.assignedTasksCount : 0;
                        return (
                          <tr key={m.userId}>
                            <td><strong>{m.fullName}</strong></td>
                            <td><span className="tag-counter">{m.role}</span></td>
                            <td>{m.assignedTasksCount}</td>
                            <td>{m.completedTasksCount}</td>
                            <td style={{ width: '220px' }}>
                              <div className="progress-container">
                                <div className="progress-bar-bg">
                                  <div className="progress-bar-fill" style={{ width: `${Math.min(100, pct)}%` }} />
                                </div>
                                <span className="progress-label">{Math.round(pct)}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {teamData.memberContributions.length === 0 && (
                        <tr><td colSpan={5} style={{ textAlign: 'center', color: '#94a3b8' }}>No member contributions recorded for this workspace.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="analytics-empty">No workspace analytics recorded.</div>
          )}
        </div>
      )}

      {/* Toast Notice */}
      {toastMessage && (
        <div className="toast-notice" id="analytics-toast">
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default ResearchAnalyticsDashboard;
