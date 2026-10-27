import React, { useEffect, useState, useCallback } from 'react';
import {
  BarChart2, Building2, Users, BookOpen, Layers,
  RefreshCw, TrendingUp, Compass, Award, Shield,
  CheckCircle2, Clock, Globe, ArrowUpRight, FolderGit2,
  ExternalLink, Calendar, CheckSquare, Sparkles, UserCheck
} from 'lucide-react';
import './ResearchAnalyticsDashboard.css';

// ==========================================
// TYPES & INTERFACES (Aligned with Backend DTOs)
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
    scopeName?: string;
    totalPublications: number;
    totalProjects: number;
    activeCollaborations: number;
    progressPercentage: number;
    lastCalculated: string;
  }>;
}

interface YearlyTrend {
  year: number;
  count: number;
}

interface CrossInstitutionCollab {
  targetInstitution: string;
  jointCollaboratorsCount: number;
}

interface DepartmentStat {
  departmentId: number;
  departmentName: string;
  researchersCount: number;
  publicationsCount: number;
  laboratoriesCount: number;
}

interface InstitutionalAnalytics {
  institutionId: number;
  institutionName: string;
  country?: string;
  city?: string;
  website?: string;
  totalResearchers: number;
  facultyCount: number;
  studentCount: number;
  totalPublications: number;
  activeWorkspacesCount: number;
  openProjectsCount: number;
  laboratoriesCount: number;
  departments: DepartmentStat[];
  publicationTrends: YearlyTrend[];
  crossInstitutionalCollaborations: CrossInstitutionCollab[];
}

interface DepartmentAnalytics {
  departmentId: number;
  departmentName: string;
  institutionName: string;
  totalResearchers: number;
  facultyCount: number;
  studentCount: number;
  totalPublications: number;
  laboratoriesCount: number;
  activeProjectsCount: number;
}

interface ResearcherAnalytics {
  userId: number;
  fullName: string;
  role: string;
  institution?: string;
  department?: string;
  bio?: string;
  skills?: string;
  interests?: string;
  totalPublications: number;
  activeProjectsCount: number;
  collaboratorsCount: number;
  totalAssignedTasks: number;
  completedTasksCount: number;
  taskCompletionRate: number;
  taskVelocity30Days: number;
  publicationsTimeline: YearlyTrend[];
}

interface TeamMemberContribution {
  userId: number;
  fullName: string;
  roleInWorkspace: string;
  assignedTasksCount: number;
  completedTasksCount: number;
  taskCompletionRate: number;
  contributionPercentage: number;
}

interface WorkspaceRecentTask {
  taskId: number;
  title: string;
  status: string;
  dueDate?: string;
  assigneeName?: string;
}

interface WorkspaceTeamAnalytics {
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
  memberContributions: TeamMemberContribution[];
  recentTasks: WorkspaceRecentTask[];
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
  const [teamData, setTeamData] = useState<WorkspaceTeamAnalytics | null>(null);

  // Selectors list
  const [universities, setUniversities] = useState<UniversityItem[]>([]);
  const [selectedUniversityId, setSelectedUniversityId] = useState<number>(1);

  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<number>(1);

  const [departmentIdInput, setDepartmentIdInput] = useState<number>(1);
  const [researcherIdInput, setResearcherIdInput] = useState<string>('');
  const [deptSearchTerm, setDeptSearchTerm] = useState<string>('');

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

  // Filtered department list for institutional view
  const filteredDepartments = institutionalData?.departments?.filter(d =>
    d.departmentName.toLowerCase().includes(deptSearchTerm.toLowerCase())
  ) || [];

  return (
    <div className="analytics-container" id="research-analytics-dashboard">
      {/* Header Banner */}
      <div className="analytics-header">
        <div className="analytics-title-group">
          <h1>
            <BarChart2 size={32} color="#4f46e5" />
            Research & Collaboration Analytics
          </h1>
          <p>Institutional metrics, workspace sprint velocity, publication output, and cross-discipline networks.</p>
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
          <Building2 size={18} /> Institutional Metrics
        </button>
        <button
          id="tab-analytics-team"
          className={`analytics-tab-btn ${activeTab === 'team' ? 'active' : ''}`}
          onClick={() => handleTabChange('team')}
        >
          <Shield size={18} /> Team & Workspace Velocity
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
          <Users size={18} /> Researcher Metrics
        </button>
      </div>

      {/* =========================================================================
          TAB 1: GLOBAL PLATFORM ANALYTICS
         ========================================================================= */}
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
                          <th>Scope Name / ID</th>
                          <th>Publications</th>
                          <th>Projects</th>
                          <th>Collaborations</th>
                          <th>Timestamp</th>
                        </tr>
                      </thead>
                      <tbody>
                        {globalData.recentSnapshots.map(s => (
                          <tr key={s.id}>
                            <td><strong className="scope-badge">{s.scopeType}</strong></td>
                            <td>{s.scopeName || `#${s.scopeId}`}</td>
                            <td>{s.totalPublications}</td>
                            <td>{s.totalProjects}</td>
                            <td>{s.activeCollaborations}</td>
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

      {/* =========================================================================
          TAB 2: INSTITUTIONAL METRICS VIEW [T-018.4]
         ========================================================================= */}
      {activeTab === 'institution' && (
        <div id="panel-analytics-institution">
          <div className="filter-bar">
            <label style={{ fontWeight: 600, color: '#475569' }}>Select University / Institution:</label>
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
            <div className="analytics-loading"><RefreshCw size={36} className="spinner-icon" /><p>Aggregating institutional metrics...</p></div>
          ) : institutionalData ? (
            <>
              {/* Institutional Profile Header Card */}
              <div className="profile-banner-card">
                <div className="profile-banner-avatar">
                  <Building2 size={36} color="#4f46e5" />
                </div>
                <div className="profile-banner-info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
                    <h2>{institutionalData.institutionName}</h2>
                    <span className="scope-badge">Verified Institution #{institutionalData.institutionId}</span>
                  </div>
                  <p className="profile-banner-meta">
                    {institutionalData.city && institutionalData.country ? (
                      <span>📍 {institutionalData.city}, {institutionalData.country}</span>
                    ) : (
                      <span>📍 Academic Campus</span>
                    )}
                    {institutionalData.website && (
                      <a href={institutionalData.website} target="_blank" rel="noreferrer" className="meta-link">
                        <ExternalLink size={14} /> Official Website
                      </a>
                    )}
                  </p>
                </div>
              </div>

              {/* Core Institutional KPIs */}
              <div className="kpi-grid">
                <div className="kpi-card" style={{ ['--kpi-accent' as string]: '#4f46e5' }}>
                  <div className="kpi-header">
                    <span className="kpi-label">Affiliated Faculty & Researchers</span>
                    <Users size={22} color="#4f46e5" />
                  </div>
                  <div className="kpi-value">{institutionalData.totalResearchers}</div>
                  <div className="kpi-subtext">
                    <UserCheck size={14} color="#4f46e5" /> {institutionalData.facultyCount} Faculty · {institutionalData.studentCount} Students
                  </div>
                </div>

                <div className="kpi-card" style={{ ['--kpi-accent' as string]: '#06b6d4' }}>
                  <div className="kpi-header">
                    <span className="kpi-label">Repository Publications</span>
                    <BookOpen size={22} color="#06b6d4" />
                  </div>
                  <div className="kpi-value">{institutionalData.totalPublications}</div>
                  <div className="kpi-subtext">
                    <Award size={14} color="#06b6d4" /> Authored institutional works
                  </div>
                </div>

                <div className="kpi-card" style={{ ['--kpi-accent' as string]: '#10b981' }}>
                  <div className="kpi-header">
                    <span className="kpi-label">Research Workspaces & Labs</span>
                    <FolderGit2 size={22} color="#10b981" />
                  </div>
                  <div className="kpi-value">{institutionalData.activeWorkspacesCount + institutionalData.laboratoriesCount}</div>
                  <div className="kpi-subtext">
                    {institutionalData.activeWorkspacesCount} Workspaces · {institutionalData.laboratoriesCount} Labs
                  </div>
                </div>

                <div className="kpi-card" style={{ ['--kpi-accent' as string]: '#f59e0b' }}>
                  <div className="kpi-header">
                    <span className="kpi-label">Cross-Institutional Alliances</span>
                    <Globe size={22} color="#f59e0b" />
                  </div>
                  <div className="kpi-value">{institutionalData.crossInstitutionalCollaborations?.length || 0}</div>
                  <div className="kpi-subtext">
                    <ArrowUpRight size={14} color="#f59e0b" /> Partner universities
                  </div>
                </div>
              </div>

              {/* Publication Output Trends Year-over-Year */}
              {institutionalData.publicationTrends && institutionalData.publicationTrends.length > 0 && (
                <div className="analytics-section">
                  <div className="section-header">
                    <div className="section-title">
                      <TrendingUp size={22} color="#06b6d4" />
                      Annual Publication Output Velocity ({institutionalData.institutionName})
                    </div>
                  </div>
                  <div className="timeline-bars-grid">
                    {institutionalData.publicationTrends.map(t => {
                      const maxCount = Math.max(...institutionalData.publicationTrends.map(x => x.count), 1);
                      const pct = Math.round((t.count / maxCount) * 100);
                      return (
                        <div key={t.year} className="timeline-bar-col">
                          <div className="timeline-bar-count">{t.count} papers</div>
                          <div className="timeline-bar-track">
                            <div className="timeline-bar-fill" style={{ height: `${Math.max(12, pct)}%` }} />
                          </div>
                          <div className="timeline-bar-year">{t.year}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Cross-Institutional Collaborations Grid */}
              {institutionalData.crossInstitutionalCollaborations && institutionalData.crossInstitutionalCollaborations.length > 0 && (
                <div className="analytics-section">
                  <div className="section-header">
                    <div className="section-title">
                      <Globe size={22} color="#f59e0b" />
                      External Institutional Partnerships & Alliances
                    </div>
                  </div>
                  <div className="collab-partners-grid">
                    {institutionalData.crossInstitutionalCollaborations.map((c, idx) => (
                      <div key={idx} className="partner-card">
                        <div className="partner-icon"><Building2 size={24} color="#4f46e5" /></div>
                        <div className="partner-details">
                          <h4>{c.targetInstitution}</h4>
                          <span className="partner-collab-badge">
                            <Users size={13} /> {c.jointCollaboratorsCount} Joint Collaborative Ties
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Departmental Research Breakdown Table */}
              <div className="analytics-section">
                <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <div className="section-title">
                    <Building2 size={22} color="#4f46e5" />
                    Departmental Research Output Breakdown ({institutionalData.institutionName})
                  </div>
                  <input
                    type="text"
                    className="filter-input"
                    style={{ minWidth: '220px', padding: '0.45rem 0.8rem', fontSize: '0.9rem' }}
                    placeholder="Search departments..."
                    value={deptSearchTerm}
                    onChange={e => setDeptSearchTerm(e.target.value)}
                  />
                </div>
                <div className="analytics-table-wrapper">
                  <table className="analytics-table" id="table-analytics-breakdown">
                    <thead>
                      <tr>
                        <th>Department</th>
                        <th>Researchers</th>
                        <th>Publications</th>
                        <th>Research Labs</th>
                        <th>Productivity Ratio</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDepartments.map(dept => {
                        const ratio = dept.researchersCount > 0
                          ? (dept.publicationsCount / dept.researchersCount).toFixed(1)
                          : '0.0';
                        return (
                          <tr key={dept.departmentId}>
                            <td><strong>{dept.departmentName}</strong></td>
                            <td>{dept.researchersCount} faculty/students</td>
                            <td>{dept.publicationsCount} publications</td>
                            <td>{dept.laboratoriesCount} labs</td>
                            <td>
                              <span className="tag-counter" style={{ background: '#e0e7ff', color: '#4338ca' }}>
                                {ratio} papers / researcher
                              </span>
                            </td>
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
                        );
                      })}
                      {filteredDepartments.length === 0 && (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', color: '#94a3b8' }}>
                            {institutionalData.departments?.length === 0
                              ? 'No departmental records enrolled under this institution.'
                              : 'No departments match your search term.'}
                          </td>
                        </tr>
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

      {/* =========================================================================
          TAB 3: TEAM & WORKSPACE VELOCITY VIEW [T-018.4]
         ========================================================================= */}
      {activeTab === 'team' && (
        <div id="panel-analytics-team">
          <div className="filter-bar">
            <label style={{ fontWeight: 600, color: '#475569' }}>Select Workspace / Project Team:</label>
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
            <div className="analytics-loading"><RefreshCw size={36} className="spinner-icon" /><p>Calculating workspace sprint velocity...</p></div>
          ) : teamData ? (
            <>
              {/* Workspace Header Banner */}
              <div className="profile-banner-card">
                <div className="profile-banner-avatar" style={{ background: 'rgba(16, 185, 129, 0.12)' }}>
                  <Shield size={36} color="#10b981" />
                </div>
                <div className="profile-banner-info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
                    <h2>{teamData.workspaceName}</h2>
                    <span className="scope-badge" style={{ background: '#dcfce7', color: '#15803d' }}>
                      Workspace #{teamData.workspaceId}
                    </span>
                  </div>
                  <p className="profile-banner-meta">
                    <span>Lead: <strong>{teamData.ownerName}</strong></span>
                    <span>·</span>
                    <span>{teamData.totalMembersCount} Active Members</span>
                    {teamData.description && (
                      <span style={{ display: 'block', width: '100%', marginTop: '0.3rem', color: '#64748b' }}>
                        {teamData.description}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Core Team Velocity KPIs */}
              <div className="kpi-grid">
                <div className="kpi-card" style={{ ['--kpi-accent' as string]: '#4f46e5' }}>
                  <div className="kpi-header">
                    <span className="kpi-label">Active Team Size</span>
                    <Users size={22} color="#4f46e5" />
                  </div>
                  <div className="kpi-value">{teamData.totalMembersCount}</div>
                  <div className="kpi-subtext">Collaborators & Researchers</div>
                </div>

                <div className="kpi-card" style={{ ['--kpi-accent' as string]: '#10b981' }}>
                  <div className="kpi-header">
                    <span className="kpi-label">Task Completion Velocity</span>
                    <TrendingUp size={22} color="#10b981" />
                  </div>
                  <div className="kpi-value">{Math.round(teamData.taskCompletionRate)}%</div>
                  <div className="kpi-subtext">
                    <CheckCircle2 size={14} color="#10b981" /> {teamData.completedTasksCount} of {teamData.totalTasksCount} tasks done
                  </div>
                </div>

                <div className="kpi-card" style={{ ['--kpi-accent' as string]: '#06b6d4' }}>
                  <div className="kpi-header">
                    <span className="kpi-label">Sprint Task Status</span>
                    <CheckSquare size={22} color="#06b6d4" />
                  </div>
                  <div className="kpi-value" style={{ fontSize: '1.6rem' }}>
                    <span style={{ color: '#10b981' }}>{teamData.completedTasksCount} Done</span> · <span style={{ color: '#06b6d4' }}>{teamData.inProgressTasksCount} In-Prog</span>
                  </div>
                  <div className="kpi-subtext">
                    <Clock size={14} color="#64748b" /> {teamData.pendingTasksCount} Tasks Pending / To-Do
                  </div>
                </div>

                <div className="kpi-card" style={{ ['--kpi-accent' as string]: '#f59e0b' }}>
                  <div className="kpi-header">
                    <span className="kpi-label">Milestones Met</span>
                    <Award size={22} color="#f59e0b" />
                  </div>
                  <div className="kpi-value">{teamData.milestoneTasksCount}</div>
                  <div className="kpi-subtext">
                    <Sparkles size={14} color="#f59e0b" /> Key research deliverables
                  </div>
                </div>
              </div>

              {/* Task Velocity Distribution Bar */}
              {teamData.totalTasksCount > 0 && (
                <div className="analytics-section">
                  <div className="section-header">
                    <div className="section-title">
                      <TrendingUp size={22} color="#4f46e5" />
                      Sprint Task Status Distribution ({teamData.totalTasksCount} Total Tasks)
                    </div>
                  </div>
                  <div className="segmented-progress-wrapper">
                    <div className="segmented-progress-bar">
                      <div
                        className="segment segment-done"
                        style={{ width: `${(teamData.completedTasksCount / teamData.totalTasksCount) * 100}%` }}
                        title={`Completed: ${teamData.completedTasksCount}`}
                      />
                      <div
                        className="segment segment-inprogress"
                        style={{ width: `${(teamData.inProgressTasksCount / teamData.totalTasksCount) * 100}%` }}
                        title={`In Progress: ${teamData.inProgressTasksCount}`}
                      />
                      <div
                        className="segment segment-pending"
                        style={{ width: `${(teamData.pendingTasksCount / teamData.totalTasksCount) * 100}%` }}
                        title={`Pending: ${teamData.pendingTasksCount}`}
                      />
                    </div>
                    <div className="segmented-legend">
                      <span className="legend-item"><span className="legend-dot dot-done" /> Done ({teamData.completedTasksCount})</span>
                      <span className="legend-item"><span className="legend-dot dot-inprogress" /> In-Progress ({teamData.inProgressTasksCount})</span>
                      <span className="legend-item"><span className="legend-dot dot-pending" /> Pending / To-Do ({teamData.pendingTasksCount})</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Member Contribution Breakdown Matrix */}
              <div className="analytics-section">
                <div className="section-header">
                  <div className="section-title">
                    <Users size={22} color="#4f46e5" />
                    Member Task Contribution & Velocity Matrix ({teamData.workspaceName})
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
                        <th>Completion Velocity</th>
                        <th>Sprint Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamData.memberContributions?.map(m => {
                        const rateColor = m.taskCompletionRate >= 70 ? '#10b981' : m.taskCompletionRate >= 40 ? '#06b6d4' : '#f59e0b';
                        return (
                          <tr key={m.userId}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <div className="member-avatar-mini">{m.fullName.charAt(0)}</div>
                                <strong>{m.fullName}</strong>
                              </div>
                            </td>
                            <td><span className="tag-counter">{m.roleInWorkspace || 'Contributor'}</span></td>
                            <td>{m.assignedTasksCount}</td>
                            <td>{m.completedTasksCount}</td>
                            <td style={{ width: '180px' }}>
                              <div className="progress-container">
                                <div className="progress-bar-bg">
                                  <div
                                    className="progress-bar-fill"
                                    style={{ width: `${Math.min(100, m.taskCompletionRate)}%`, background: rateColor }}
                                  />
                                </div>
                                <span className="progress-label">{Math.round(m.taskCompletionRate)}%</span>
                              </div>
                            </td>
                            <td style={{ width: '160px' }}>
                              <div className="progress-container">
                                <div className="progress-bar-bg">
                                  <div
                                    className="progress-bar-fill"
                                    style={{ width: `${Math.min(100, m.contributionPercentage)}%`, background: 'linear-gradient(90deg, #6366f1, #a855f7)' }}
                                  />
                                </div>
                                <span className="progress-label">{Math.round(m.contributionPercentage)}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {(!teamData.memberContributions || teamData.memberContributions.length === 0) && (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', color: '#94a3b8' }}>
                            No team member task assignments registered in this workspace.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Recent Tasks Velocity Log */}
              {teamData.recentTasks && teamData.recentTasks.length > 0 && (
                <div className="analytics-section">
                  <div className="section-header">
                    <div className="section-title">
                      <Clock size={22} color="#06b6d4" />
                      Recent Sprint Activity & Task Log
                    </div>
                  </div>
                  <div className="analytics-table-wrapper">
                    <table className="analytics-table">
                      <thead>
                        <tr>
                          <th>Task Title</th>
                          <th>Status</th>
                          <th>Assignee</th>
                          <th>Due Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teamData.recentTasks.map(t => {
                          const statusClass = t.status === 'Done' || t.status === 'Completed'
                            ? 'task-done'
                            : t.status === 'InProgress'
                            ? 'task-prog'
                            : 'task-todo';
                          return (
                            <tr key={t.taskId}>
                              <td><strong>{t.title}</strong></td>
                              <td><span className={`status-pill ${statusClass}`}>{t.status}</span></td>
                              <td>{t.assigneeName || 'Unassigned'}</td>
                              <td>
                                {t.dueDate ? (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#64748b' }}>
                                    <Calendar size={13} /> {new Date(t.dueDate).toLocaleDateString()}
                                  </span>
                                ) : (
                                  <span style={{ color: '#94a3b8' }}>No deadline set</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="analytics-empty">No workspace team metrics found for this selection.</div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 4: DEPARTMENTAL ANALYTICS
         ========================================================================= */}
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
              <div className="profile-banner-card">
                <div className="profile-banner-avatar" style={{ background: 'rgba(245, 158, 11, 0.12)' }}>
                  <Layers size={36} color="#f59e0b" />
                </div>
                <div className="profile-banner-info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
                    <h2>{departmentData.departmentName}</h2>
                    <span className="scope-badge">Department #{departmentData.departmentId}</span>
                  </div>
                  <p className="profile-banner-meta">
                    <span>Affiliated with <strong>{departmentData.institutionName || 'University'}</strong></span>
                  </p>
                </div>
              </div>

              <div className="kpi-grid">
                <div className="kpi-card" style={{ ['--kpi-accent' as string]: '#4f46e5' }}>
                  <div className="kpi-header"><span className="kpi-label">Department Faculty</span><Users size={22} color="#4f46e5" /></div>
                  <div className="kpi-value">{departmentData.totalResearchers}</div>
                  <div className="kpi-subtext">{departmentData.facultyCount} Faculty · {departmentData.studentCount} Students</div>
                </div>
                <div className="kpi-card" style={{ ['--kpi-accent' as string]: '#06b6d4' }}>
                  <div className="kpi-header"><span className="kpi-label">Publications</span><BookOpen size={22} color="#06b6d4" /></div>
                  <div className="kpi-value">{departmentData.totalPublications}</div>
                  <div className="kpi-subtext">Department research output</div>
                </div>
                <div className="kpi-card" style={{ ['--kpi-accent' as string]: '#10b981' }}>
                  <div className="kpi-header"><span className="kpi-label">Laboratories & Facilities</span><Building2 size={22} color="#10b981" /></div>
                  <div className="kpi-value">{departmentData.laboratoriesCount}</div>
                  <div className="kpi-subtext">Active department research labs</div>
                </div>
                <div className="kpi-card" style={{ ['--kpi-accent' as string]: '#f59e0b' }}>
                  <div className="kpi-header"><span className="kpi-label">Active Collaborative Projects</span><FolderGit2 size={22} color="#f59e0b" /></div>
                  <div className="kpi-value">{departmentData.activeProjectsCount}</div>
                  <div className="kpi-subtext">Workspaces involving department members</div>
                </div>
              </div>
            </>
          ) : (
            <div className="analytics-empty">No department analytics found for ID #{departmentIdInput}.</div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 5: RESEARCHER PROFILE METRICS
         ========================================================================= */}
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
              <div className="profile-banner-card">
                <div className="profile-banner-avatar" style={{ background: 'rgba(79, 70, 229, 0.12)' }}>
                  <Users size={36} color="#4f46e5" />
                </div>
                <div className="profile-banner-info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
                    <h2>{researcherData.fullName}</h2>
                    <span className="scope-badge">{researcherData.role}</span>
                  </div>
                  <p className="profile-banner-meta">
                    <span>{researcherData.department || 'General Department'} · {researcherData.institution || 'University'}</span>
                  </p>
                  {researcherData.bio && <p style={{ margin: '0.4rem 0 0 0', color: '#64748b' }}>{researcherData.bio}</p>}
                </div>
              </div>

              <div className="kpi-grid">
                <div className="kpi-card" style={{ ['--kpi-accent' as string]: '#4f46e5' }}>
                  <div className="kpi-header"><span className="kpi-label">Publications</span><BookOpen size={22} color="#4f46e5" /></div>
                  <div className="kpi-value">{researcherData.totalPublications}</div>
                  <div className="kpi-subtext">Authored & Co-Authored</div>
                </div>
                <div className="kpi-card" style={{ ['--kpi-accent' as string]: '#10b981' }}>
                  <div className="kpi-header"><span className="kpi-label">Collaborators</span><Users size={22} color="#10b981" /></div>
                  <div className="kpi-value">{researcherData.collaboratorsCount}</div>
                  <div className="kpi-subtext">Connected researchers</div>
                </div>
                <div className="kpi-card" style={{ ['--kpi-accent' as string]: '#06b6d4' }}>
                  <div className="kpi-header"><span className="kpi-label">Active Workspaces</span><FolderGit2 size={22} color="#06b6d4" /></div>
                  <div className="kpi-value">{researcherData.activeProjectsCount}</div>
                  <div className="kpi-subtext">Participating teams</div>
                </div>
                <div className="kpi-card" style={{ ['--kpi-accent' as string]: '#f59e0b' }}>
                  <div className="kpi-header"><span className="kpi-label">Task Velocity</span><TrendingUp size={22} color="#f59e0b" /></div>
                  <div className="kpi-value">{Math.round(researcherData.taskCompletionRate)}%</div>
                  <div className="kpi-subtext">{researcherData.completedTasksCount} / {researcherData.totalAssignedTasks} tasks completed</div>
                </div>
              </div>

              {/* Publication Output Timeline */}
              {researcherData.publicationsTimeline && researcherData.publicationsTimeline.length > 0 && (
                <div className="analytics-section">
                  <div className="section-header">
                    <div className="section-title">
                      <BookOpen size={22} color="#4f46e5" />
                      Publication Timeline
                    </div>
                  </div>
                  <div className="timeline-bars-grid">
                    {researcherData.publicationsTimeline.map(t => {
                      const maxCount = Math.max(...researcherData.publicationsTimeline.map(x => x.count), 1);
                      const pct = Math.round((t.count / maxCount) * 100);
                      return (
                        <div key={t.year} className="timeline-bar-col">
                          <div className="timeline-bar-count">{t.count} papers</div>
                          <div className="timeline-bar-track">
                            <div className="timeline-bar-fill" style={{ height: `${Math.max(14, pct)}%` }} />
                          </div>
                          <div className="timeline-bar-year">{t.year}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="analytics-empty">No researcher profile found.</div>
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
