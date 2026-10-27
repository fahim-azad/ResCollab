import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Sparkles, Users, BookOpen, FolderGit2, AlertCircle,
  GraduationCap, Building2, ExternalLink, RefreshCw,
  Search, CheckCircle2, UserCheck, ArrowRight,
  UserPlus, XCircle, ChevronRight, Zap
} from 'lucide-react';
import './RecommendationsHub.css';

// ==========================================
// INTERFACES & DTOs
// ==========================================

export interface UserRecommendationItem {
  userId: number;
  fullName: string;
  role: string;
  university?: string;
  department?: string;
  bio?: string;
  matchScore: number;
  matchedKeywords: string[];
  complementarySkills: string[];
  recommendationReason: string;
  isAcceptingStudents: boolean;
}

export interface PublicationRecommendation {
  publicationId: number;
  title: string;
  authors: string;
  journalOrConference?: string;
  publicationYear: number;
  doi?: string;
  sourceLink?: string;
  matchScore: number;
  matchedTopics: string[];
  reason: string;
}

export interface ProjectRecommendation {
  projectId: number;
  title: string;
  description: string;
  supervisorName: string;
  department?: string;
  matchScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  isFunded: boolean;
  openPositions: number;
}

export interface SkillGapAnalysis {
  id: number;
  userId: number;
  targetDomain: string;
  targetProjectId?: number;
  currentSkills: string;
  missingSkills: string;
  readinessScore: number;
  recommendedAction?: string;
  analyzedAt: string;
}

export interface AiRecommendationResponse {
  userId: number;
  hasSufficientProfileData: boolean;
  guidanceMessage?: string;
  supervisors: UserRecommendationItem[];
  teammates: UserRecommendationItem[];
  researchers: UserRecommendationItem[];
  publications: PublicationRecommendation[];
  projects: ProjectRecommendation[];
  primarySkillGap?: SkillGapAnalysis;
  generatedAt: string;
}

type TabType = 'all' | 'supervisors' | 'teammates' | 'researchers' | 'papers' | 'projects' | 'skillgap';

const RecommendationsHub: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabType) || 'all';

  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [data, setData] = useState<AiRecommendationResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [minScoreFilter, setMinScoreFilter] = useState<number>(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Skill Gap On-Demand query state
  const [customDomain, setCustomDomain] = useState<string>('');
  const [analyzingGap, setAnalyzingGap] = useState<boolean>(false);
  const [activeSkillGap, setActiveSkillGap] = useState<SkillGapAnalysis | null>(null);

  const token = localStorage.getItem('token');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchAllRecommendations = useCallback(async (forceRefresh = false) => {
    try {
      if (forceRefresh) setRefreshing(true);
      else setLoading(true);

      const res = await fetch(`http://localhost:5000/api/recommendation/all?forceRefresh=${forceRefresh}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const result: AiRecommendationResponse = await res.json();
        setData(result);
        if (result.primarySkillGap) {
          setActiveSkillGap(result.primarySkillGap);
        }
        if (forceRefresh) {
          showToast('✓ AI Recommendations re-indexed and refreshed!');
        }
      }
    } catch (err) {
      console.error('Failed to load AI recommendations:', err);
      showToast('Failed to load recommendations.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchAllRecommendations();
  }, [fetchAllRecommendations]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Dismiss Recommendation
  const handleDismiss = async (type: string, id: number) => {
    try {
      await fetch(`http://localhost:5000/api/recommendation/${id}/dismiss`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      // Optimistically remove from state
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          supervisors: type === 'supervisor' ? prev.supervisors.filter(s => s.userId !== id) : prev.supervisors,
          teammates: type === 'teammate' ? prev.teammates.filter(t => t.userId !== id) : prev.teammates,
          researchers: type === 'researcher' ? prev.researchers.filter(r => r.userId !== id) : prev.researchers,
          publications: type === 'publication' ? prev.publications.filter(p => p.publicationId !== id) : prev.publications,
          projects: type === 'project' ? prev.projects.filter(pr => pr.projectId !== id) : prev.projects,
        };
      });

      showToast('Match dismissed from your recommendations.');
    } catch {
      showToast('Could not dismiss item.');
    }
  };

  // Custom Domain Skill Gap Analysis
  const handleAnalyzeSkillGap = async () => {
    if (!customDomain.trim()) return;
    try {
      setAnalyzingGap(true);
      const res = await fetch(`http://localhost:5000/api/recommendation/skill-gap?targetDomain=${encodeURIComponent(customDomain.trim())}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const gapResult: SkillGapAnalysis = await res.json();
        setActiveSkillGap(gapResult);
        showToast(`Analyzed readiness for "${customDomain}"`);
      }
    } catch {
      showToast('Skill gap analysis request failed.');
    } finally {
      setAnalyzingGap(false);
    }
  };

  // Filters
  const filteredSupervisors = useMemo(() => {
    return (data?.supervisors || []).filter(s =>
      s.matchScore >= minScoreFilter &&
      (s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
       (s.department && s.department.toLowerCase().includes(searchTerm.toLowerCase())) ||
       (s.matchedKeywords && s.matchedKeywords.some(k => k.toLowerCase().includes(searchTerm.toLowerCase()))))
    );
  }, [data?.supervisors, minScoreFilter, searchTerm]);

  const filteredTeammates = useMemo(() => {
    return (data?.teammates || []).filter(t =>
      t.matchScore >= minScoreFilter &&
      (t.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
       (t.department && t.department.toLowerCase().includes(searchTerm.toLowerCase())) ||
       (t.matchedKeywords && t.matchedKeywords.some(k => k.toLowerCase().includes(searchTerm.toLowerCase()))) ||
       (t.complementarySkills && t.complementarySkills.some(cs => cs.toLowerCase().includes(searchTerm.toLowerCase()))))
    );
  }, [data?.teammates, minScoreFilter, searchTerm]);

  const filteredResearchers = useMemo(() => {
    return (data?.researchers || []).filter(r =>
      r.matchScore >= minScoreFilter &&
      (r.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
       (r.university && r.university.toLowerCase().includes(searchTerm.toLowerCase())) ||
       (r.matchedKeywords && r.matchedKeywords.some(k => k.toLowerCase().includes(searchTerm.toLowerCase()))))
    );
  }, [data?.researchers, minScoreFilter, searchTerm]);

  const filteredPublications = useMemo(() => {
    return (data?.publications || []).filter(p =>
      p.matchScore >= minScoreFilter &&
      (p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
       p.authors.toLowerCase().includes(searchTerm.toLowerCase()) ||
       (p.matchedTopics && p.matchedTopics.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()))))
    );
  }, [data?.publications, minScoreFilter, searchTerm]);

  const filteredProjects = useMemo(() => {
    return (data?.projects || []).filter(pr =>
      pr.matchScore >= minScoreFilter &&
      (pr.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
       pr.supervisorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
       (pr.matchedSkills && pr.matchedSkills.some(s => s.toLowerCase().includes(searchTerm.toLowerCase()))))
    );
  }, [data?.projects, minScoreFilter, searchTerm]);

  return (
    <div className="recommendations-container" id="ai-recommendations-hub">
      {/* Header Banner */}
      <div className="recommendations-header">
        <div className="recommendations-title-group">
          <h1>
            <Sparkles size={32} color="#6366f1" />
            AI Recommendations & Matching Hub
          </h1>
          <p>Multi-attribute vector matching based on research interests, skills, department affiliations, and activity.</p>
        </div>

        <div className="recommendations-header-actions">
          <button
            id="btn-rec-refresh"
            className="btn-refresh-rec"
            onClick={() => fetchAllRecommendations(true)}
            disabled={refreshing}
          >
            <RefreshCw size={17} className={refreshing ? 'spinner-icon' : ''} />
            {refreshing ? 'Re-indexing Matches...' : 'Recalculate Matches'}
          </button>
        </div>
      </div>

      {/* Profile Completeness Cold Start Alert */}
      {data && !data.hasSufficientProfileData && (
        <div className="guidance-banner" id="banner-profile-guidance">
          <div className="guidance-icon">
            <AlertCircle size={28} color="#f59e0b" />
          </div>
          <div className="guidance-content">
            <h3>Boost Your Recommendation Accuracy</h3>
            <p>
              {data.guidanceMessage ||
                'Your profile currently has limited research interests or skill keywords. Add your technical disciplines and interests to unlock high-precision AI matching!'}
            </p>
          </div>
          <button className="btn-guidance-action" onClick={() => navigate('/profile')}>
            Complete Profile <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Tabs Navigation Bar */}
      <div className="recommendations-tabs" role="tablist">
        <button
          id="tab-rec-all"
          className={`rec-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => handleTabChange('all')}
        >
          <Sparkles size={17} /> All Matches
        </button>
        <button
          id="tab-rec-supervisors"
          className={`rec-tab-btn ${activeTab === 'supervisors' ? 'active' : ''}`}
          onClick={() => handleTabChange('supervisors')}
        >
          <GraduationCap size={17} /> Supervisors ({filteredSupervisors.length})
        </button>
        <button
          id="tab-rec-teammates"
          className={`rec-tab-btn ${activeTab === 'teammates' ? 'active' : ''}`}
          onClick={() => handleTabChange('teammates')}
        >
          <Users size={17} /> Teammates ({filteredTeammates.length})
        </button>
        <button
          id="tab-rec-researchers"
          className={`rec-tab-btn ${activeTab === 'researchers' ? 'active' : ''}`}
          onClick={() => handleTabChange('researchers')}
        >
          <UserCheck size={17} /> Collaborators ({filteredResearchers.length})
        </button>
        <button
          id="tab-rec-papers"
          className={`rec-tab-btn ${activeTab === 'papers' ? 'active' : ''}`}
          onClick={() => handleTabChange('papers')}
        >
          <BookOpen size={17} /> Literature & Papers ({filteredPublications.length})
        </button>
        <button
          id="tab-rec-projects"
          className={`rec-tab-btn ${activeTab === 'projects' ? 'active' : ''}`}
          onClick={() => handleTabChange('projects')}
        >
          <FolderGit2 size={17} /> Open Projects ({filteredProjects.length})
        </button>
        <button
          id="tab-rec-skillgap"
          className={`rec-tab-btn ${activeTab === 'skillgap' ? 'active' : ''}`}
          onClick={() => handleTabChange('skillgap')}
        >
          <Zap size={17} /> Skill Gap Analysis
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="rec-toolbar">
        <div className="rec-search-wrapper">
          <Search size={18} color="#64748b" />
          <input
            id="input-rec-search"
            type="text"
            className="rec-search-input"
            placeholder="Search matches by keyword, skill, topic, or department..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="rec-filter-group">
          <label style={{ fontSize: '0.88rem', fontWeight: 600, color: '#475569' }}>
            Min Match: {minScoreFilter}%
          </label>
          <input
            type="range"
            min="0"
            max="90"
            step="5"
            value={minScoreFilter}
            onChange={e => setMinScoreFilter(parseInt(e.target.value))}
            className="rec-slider"
          />
        </div>
      </div>

      {loading ? (
        <div className="rec-loading">
          <RefreshCw size={36} className="spinner-icon" />
          <p>Evaluating multi-dimensional compatibility vectors...</p>
        </div>
      ) : (
        <>
          {/* =========================================================================
              VIEW 1: ALL MATCHES OVERVIEW
             ========================================================================= */}
          {activeTab === 'all' && (
            <div className="rec-all-overview">
              {/* Top Supervisors Preview */}
              {filteredSupervisors.length > 0 && (
                <div className="rec-category-block">
                  <div className="rec-category-header">
                    <div className="rec-category-title">
                      <GraduationCap size={22} color="#6366f1" />
                      Top Matched Supervisors
                    </div>
                    <button className="btn-see-all" onClick={() => handleTabChange('supervisors')}>
                      View All ({filteredSupervisors.length}) <ArrowRight size={15} />
                    </button>
                  </div>
                  <div className="rec-cards-grid">
                    {filteredSupervisors.slice(0, 3).map(sup => (
                      <SupervisorCard key={sup.userId} item={sup} onDismiss={() => handleDismiss('supervisor', sup.userId)} onNavigate={navigate} />
                    ))}
                  </div>
                </div>
              )}

              {/* Top Teammates Preview */}
              {filteredTeammates.length > 0 && (
                <div className="rec-category-block">
                  <div className="rec-category-header">
                    <div className="rec-category-title">
                      <Users size={22} color="#10b981" />
                      Complementary Teammates
                    </div>
                    <button className="btn-see-all" onClick={() => handleTabChange('teammates')}>
                      View All ({filteredTeammates.length}) <ArrowRight size={15} />
                    </button>
                  </div>
                  <div className="rec-cards-grid">
                    {filteredTeammates.slice(0, 3).map(tm => (
                      <TeammateCard key={tm.userId} item={tm} onDismiss={() => handleDismiss('teammate', tm.userId)} onNavigate={navigate} />
                    ))}
                  </div>
                </div>
              )}

              {/* Top Publications Preview */}
              {filteredPublications.length > 0 && (
                <div className="rec-category-block">
                  <div className="rec-category-header">
                    <div className="rec-category-title">
                      <BookOpen size={22} color="#06b6d4" />
                      Recommended Literature
                    </div>
                    <button className="btn-see-all" onClick={() => handleTabChange('papers')}>
                      View All ({filteredPublications.length}) <ArrowRight size={15} />
                    </button>
                  </div>
                  <div className="rec-cards-grid">
                    {filteredPublications.slice(0, 3).map(pub => (
                      <PublicationCard key={pub.publicationId} item={pub} onDismiss={() => handleDismiss('publication', pub.publicationId)} />
                    ))}
                  </div>
                </div>
              )}

              {/* Top Projects Preview */}
              {filteredProjects.length > 0 && (
                <div className="rec-category-block">
                  <div className="rec-category-header">
                    <div className="rec-category-title">
                      <FolderGit2 size={22} color="#f59e0b" />
                      Active Research Opportunities
                    </div>
                    <button className="btn-see-all" onClick={() => handleTabChange('projects')}>
                      View All ({filteredProjects.length}) <ArrowRight size={15} />
                    </button>
                  </div>
                  <div className="rec-cards-grid">
                    {filteredProjects.slice(0, 3).map(pr => (
                      <ProjectCard key={pr.projectId} item={pr} onDismiss={() => handleDismiss('project', pr.projectId)} onNavigate={navigate} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              VIEW 2: SUPERVISORS
             ========================================================================= */}
          {activeTab === 'supervisors' && (
            <div className="rec-cards-grid">
              {filteredSupervisors.map(sup => (
                <SupervisorCard key={sup.userId} item={sup} onDismiss={() => handleDismiss('supervisor', sup.userId)} onNavigate={navigate} />
              ))}
              {filteredSupervisors.length === 0 && (
                <div className="rec-empty-state">
                  <GraduationCap size={48} style={{ opacity: 0.2 }} />
                  <h3>No supervisor matches found</h3>
                  <p>Try lowering the match threshold or expanding your research interests.</p>
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              VIEW 3: TEAMMATES
             ========================================================================= */}
          {activeTab === 'teammates' && (
            <div className="rec-cards-grid">
              {filteredTeammates.map(tm => (
                <TeammateCard key={tm.userId} item={tm} onDismiss={() => handleDismiss('teammate', tm.userId)} onNavigate={navigate} />
              ))}
              {filteredTeammates.length === 0 && (
                <div className="rec-empty-state">
                  <Users size={48} style={{ opacity: 0.2 }} />
                  <h3>No complementary teammate matches found</h3>
                  <p>Expand your project disciplines or skills in your profile.</p>
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              VIEW 4: RESEARCHERS & COLLABORATORS
             ========================================================================= */}
          {activeTab === 'researchers' && (
            <div className="rec-cards-grid">
              {filteredResearchers.map(resItem => (
                <TeammateCard key={resItem.userId} item={resItem} onDismiss={() => handleDismiss('researcher', resItem.userId)} onNavigate={navigate} />
              ))}
              {filteredResearchers.length === 0 && (
                <div className="rec-empty-state">
                  <UserCheck size={48} style={{ opacity: 0.2 }} />
                  <h3>No researcher matches found</h3>
                  <p>No active researchers in your domain match the current query.</p>
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              VIEW 5: LITERATURE & PAPERS
             ========================================================================= */}
          {activeTab === 'papers' && (
            <div className="rec-cards-grid">
              {filteredPublications.map(pub => (
                <PublicationCard key={pub.publicationId} item={pub} onDismiss={() => handleDismiss('publication', pub.publicationId)} />
              ))}
              {filteredPublications.length === 0 && (
                <div className="rec-empty-state">
                  <BookOpen size={48} style={{ opacity: 0.2 }} />
                  <h3>No publication matches found</h3>
                  <p>Bookmark or add papers to your portfolio to train publication recommendations.</p>
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              VIEW 6: OPEN PROJECTS
             ========================================================================= */}
          {activeTab === 'projects' && (
            <div className="rec-cards-grid">
              {filteredProjects.map(pr => (
                <ProjectCard key={pr.projectId} item={pr} onDismiss={() => handleDismiss('project', pr.projectId)} onNavigate={navigate} />
              ))}
              {filteredProjects.length === 0 && (
                <div className="rec-empty-state">
                  <FolderGit2 size={48} style={{ opacity: 0.2 }} />
                  <h3>No open project matches found</h3>
                  <p>Check the project marketplace or adjust your skill filters.</p>
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              VIEW 7: SKILL GAP ANALYSIS
             ========================================================================= */}
          {activeTab === 'skillgap' && (
            <div className="skillgap-container">
              {/* Custom Analysis Bar */}
              <div className="skillgap-custom-box">
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontWeight: 700, color: '#0f172a', marginBottom: '0.4rem' }}>
                    Target Research Discipline or Project Title
                  </label>
                  <input
                    type="text"
                    className="rec-search-input"
                    placeholder="e.g. Distributed Consensus, Cancer Genomics, Quantum ML, Robotics..."
                    value={customDomain}
                    onChange={e => setCustomDomain(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAnalyzeSkillGap(); }}
                  />
                </div>
                <button
                  className="btn-refresh-rec"
                  style={{ height: '44px', marginTop: '1.6rem' }}
                  onClick={handleAnalyzeSkillGap}
                  disabled={analyzingGap}
                >
                  <Zap size={16} />
                  {analyzingGap ? 'Evaluating Gap...' : 'Analyze Readiness'}
                </button>
              </div>

              {activeSkillGap ? (
                <div className="skillgap-card">
                  <div className="skillgap-header">
                    <div>
                      <h2>Target Domain: {activeSkillGap.targetDomain}</h2>
                      <p style={{ color: '#64748b', margin: '0.3rem 0 0 0' }}>
                        Evaluated on {new Date(activeSkillGap.analyzedAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="readiness-gauge">
                      <div className="readiness-value">{activeSkillGap.readinessScore}%</div>
                      <div className="readiness-label">Readiness Score</div>
                    </div>
                  </div>

                  {/* Readiness Progress Bar */}
                  <div style={{ margin: '1.5rem 0' }}>
                    <div className="progress-container">
                      <div className="progress-bar-bg" style={{ height: '10px' }}>
                        <div
                          className="progress-bar-fill"
                          style={{
                            width: `${Math.min(100, activeSkillGap.readinessScore)}%`,
                            background: activeSkillGap.readinessScore >= 70
                              ? '#10b981'
                              : activeSkillGap.readinessScore >= 40
                              ? '#06b6d4'
                              : '#f59e0b'
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="skillgap-lists-grid">
                    {/* Current Possessed Skills */}
                    <div className="skillgap-column current-col">
                      <h4>
                        <CheckCircle2 size={18} color="#10b981" />
                        Skills You Possess
                      </h4>
                      <div className="tags-cloud">
                        {activeSkillGap.currentSkills
                          ? activeSkillGap.currentSkills.split(',').map(s => s.trim()).filter(Boolean).map((s, idx) => (
                              <span key={idx} className="topic-tag-chip" style={{ background: '#dcfce7', color: '#15803d' }}>
                                ✓ {s}
                              </span>
                            ))
                          : <p style={{ color: '#94a3b8' }}>No profile skills registered yet.</p>}
                      </div>
                    </div>

                    {/* Missing Recommended Skills */}
                    <div className="skillgap-column missing-col">
                      <h4>
                        <AlertCircle size={18} color="#f59e0b" />
                        High-Yield Missing Skills to Acquire
                      </h4>
                      <div className="tags-cloud">
                        {activeSkillGap.missingSkills
                          ? activeSkillGap.missingSkills.split(',').map(s => s.trim()).filter(Boolean).map((s, idx) => (
                              <span key={idx} className="topic-tag-chip" style={{ background: '#fef3c7', color: '#b45309' }}>
                                + {s}
                              </span>
                            ))
                          : <p style={{ color: '#10b981' }}>Outstanding! No critical skill gaps detected for this area.</p>}
                      </div>
                    </div>
                  </div>

                  {activeSkillGap.recommendedAction && (
                    <div className="skillgap-action-box">
                      <strong>AI Recommendation:</strong> {activeSkillGap.recommendedAction}
                    </div>
                  )}
                </div>
              ) : (
                <div className="rec-empty-state">
                  <Zap size={48} style={{ opacity: 0.2 }} />
                  <h3>No Skill Gap Analysis Performed Yet</h3>
                  <p>Type a target research topic above to evaluate your readiness and identify missing skills.</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Toast Notice */}
      {toastMessage && (
        <div className="toast-notice" id="rec-toast">
          {toastMessage}
        </div>
      )}
    </div>
  );
};

// ==========================================
// SUB-COMPONENTS: RESULT CARDS
// ==========================================

const SupervisorCard: React.FC<{
  item: UserRecommendationItem;
  onDismiss: () => void;
  onNavigate: (path: string) => void;
}> = ({ item, onDismiss, onNavigate }) => {
  return (
    <div className="rec-card supervisor-card" id={`rec-card-supervisor-${item.userId}`}>
      <button className="btn-dismiss" title="Dismiss match" onClick={onDismiss}>
        <XCircle size={17} />
      </button>

      <div className="rec-card-header">
        <div className="rec-avatar-initial" style={{ background: '#eef2ff', color: '#4f46e5' }}>
          {item.fullName.charAt(0)}
        </div>
        <div className="rec-card-title-meta">
          <h3>{item.fullName}</h3>
          <span className="rec-role-badge badge-faculty">{item.role}</span>
        </div>
        <div className="rec-score-badge" style={{ background: item.matchScore >= 75 ? '#dcfce7' : '#e0e7ff', color: item.matchScore >= 75 ? '#15803d' : '#4338ca' }}>
          {item.matchScore}% Match
        </div>
      </div>

      <div className="rec-card-body">
        <div className="rec-affiliation">
          {item.university && (
            <span><Building2 size={14} /> {item.university}</span>
          )}
          {item.department && (
            <span><GraduationCap size={14} /> {item.department}</span>
          )}
        </div>

        {item.isAcceptingStudents && (
          <div className="pill-accepting">
            <CheckCircle2 size={13} /> Accepting Graduate & Thesis Students
          </div>
        )}

        {item.bio && <p className="rec-bio-text">{item.bio}</p>}

        {item.recommendationReason && (
          <div className="rec-reason-text">
            <strong>Why:</strong> {item.recommendationReason}
          </div>
        )}

        {item.matchedKeywords && item.matchedKeywords.length > 0 && (
          <div className="rec-tags-section">
            <span className="rec-tags-title">Shared Research Themes:</span>
            <div className="tags-cloud">
              {item.matchedKeywords.map((k, idx) => (
                <span key={idx} className="topic-tag-chip" id={`tag-keyword-${k.toLowerCase().replace(/\s+/g, '-')}`}>
                  {k}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="rec-card-actions">
        <button className="btn-primary-action" onClick={() => onNavigate(`/profile/${item.userId}`)}>
          View Profile
        </button>
        <button className="btn-secondary-action" onClick={() => onNavigate(`/messages`)}>
          Message
        </button>
      </div>
    </div>
  );
};

const TeammateCard: React.FC<{
  item: UserRecommendationItem;
  onDismiss: () => void;
  onNavigate: (path: string) => void;
}> = ({ item, onDismiss, onNavigate }) => {
  return (
    <div className="rec-card teammate-card" id={`rec-card-teammate-${item.userId}`}>
      <button className="btn-dismiss" title="Dismiss match" onClick={onDismiss}>
        <XCircle size={17} />
      </button>

      <div className="rec-card-header">
        <div className="rec-avatar-initial" style={{ background: '#ecfdf5', color: '#059669' }}>
          {item.fullName.charAt(0)}
        </div>
        <div className="rec-card-title-meta">
          <h3>{item.fullName}</h3>
          <span className="rec-role-badge badge-student">{item.role}</span>
        </div>
        <div className="rec-score-badge" style={{ background: item.matchScore >= 75 ? '#dcfce7' : '#e0e7ff', color: item.matchScore >= 75 ? '#15803d' : '#4338ca' }}>
          {item.matchScore}% Match
        </div>
      </div>

      <div className="rec-card-body">
        <div className="rec-affiliation">
          {item.university && (
            <span><Building2 size={14} /> {item.university}</span>
          )}
          {item.department && (
            <span><GraduationCap size={14} /> {item.department}</span>
          )}
        </div>

        {item.bio && <p className="rec-bio-text">{item.bio}</p>}

        {item.recommendationReason && (
          <div className="rec-reason-text">
            <strong>Why:</strong> {item.recommendationReason}
          </div>
        )}

        {/* Complementary Skills Highlight */}
        {item.complementarySkills && item.complementarySkills.length > 0 && (
          <div className="rec-tags-section">
            <span className="rec-tags-title" style={{ color: '#059669' }}>Complementary Skills They Bring:</span>
            <div className="tags-cloud">
              {item.complementarySkills.map((cs, idx) => (
                <span key={idx} className="topic-tag-chip" style={{ background: '#d1fae5', color: '#065f46' }}>
                  ★ {cs}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Shared Interests */}
        {item.matchedKeywords && item.matchedKeywords.length > 0 && (
          <div className="rec-tags-section">
            <span className="rec-tags-title">Shared Interests:</span>
            <div className="tags-cloud">
              {item.matchedKeywords.map((k, idx) => (
                <span key={idx} className="topic-tag-chip">
                  {k}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="rec-card-actions">
        <button className="btn-primary-action" onClick={() => onNavigate(`/profile/${item.userId}`)}>
          View Profile
        </button>
        <button className="btn-secondary-action" onClick={() => onNavigate(`/network`)}>
          <UserPlus size={14} /> Connect
        </button>
      </div>
    </div>
  );
};

const PublicationCard: React.FC<{
  item: PublicationRecommendation;
  onDismiss: () => void;
}> = ({ item, onDismiss }) => {
  return (
    <div className="rec-card paper-card" id={`rec-card-paper-${item.publicationId}`}>
      <button className="btn-dismiss" title="Dismiss match" onClick={onDismiss}>
        <XCircle size={17} />
      </button>

      <div className="rec-card-header">
        <div className="rec-avatar-initial" style={{ background: '#ecfeff', color: '#0891b2' }}>
          <BookOpen size={20} />
        </div>
        <div className="rec-card-title-meta">
          <h3 style={{ fontSize: '1.05rem', lineHeight: '1.3' }}>{item.title}</h3>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{item.authors} · {item.publicationYear}</span>
        </div>
        <div className="rec-score-badge" style={{ background: '#cffafe', color: '#0e7490' }}>
          {item.matchScore}% Match
        </div>
      </div>

      <div className="rec-card-body">
        {item.journalOrConference && (
          <p style={{ fontSize: '0.86rem', color: '#475569', margin: '0.2rem 0 0.5rem 0', fontWeight: 600 }}>
            {item.journalOrConference}
          </p>
        )}

        {item.reason && (
          <div className="rec-reason-text">
            <strong>Why:</strong> {item.reason}
          </div>
        )}

        {item.matchedTopics && item.matchedTopics.length > 0 && (
          <div className="rec-tags-section">
            <span className="rec-tags-title">Matched Themes:</span>
            <div className="tags-cloud">
              {item.matchedTopics.map((t, idx) => (
                <span key={idx} className="topic-tag-chip" style={{ background: '#e0f2fe', color: '#0369a1' }}>
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="rec-card-actions">
        {item.sourceLink || item.doi ? (
          <a
            href={item.sourceLink || `https://doi.org/${item.doi}`}
            target="_blank"
            rel="noreferrer"
            className="btn-primary-action"
            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
          >
            <ExternalLink size={14} /> Read Paper
          </a>
        ) : (
          <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>DOI pending</span>
        )}
      </div>
    </div>
  );
};

const ProjectCard: React.FC<{
  item: ProjectRecommendation;
  onDismiss: () => void;
  onNavigate: (path: string) => void;
}> = ({ item, onDismiss, onNavigate }) => {
  return (
    <div className="rec-card project-card" id={`rec-card-project-${item.projectId}`}>
      <button className="btn-dismiss" title="Dismiss match" onClick={onDismiss}>
        <XCircle size={17} />
      </button>

      <div className="rec-card-header">
        <div className="rec-avatar-initial" style={{ background: '#fffbeb', color: '#d97706' }}>
          <FolderGit2 size={20} />
        </div>
        <div className="rec-card-title-meta">
          <h3>{item.title}</h3>
          <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
            Lead: <strong>{item.supervisorName}</strong> {item.department && `· ${item.department}`}
          </span>
        </div>
        <div className="rec-score-badge" style={{ background: '#fef3c7', color: '#b45309' }}>
          {item.matchScore}% Match
        </div>
      </div>

      <div className="rec-card-body">
        {item.isFunded && (
          <span className="pill-funded">
            💰 Grant Funded Research Project
          </span>
        )}

        <p className="rec-bio-text">{item.description}</p>

        {/* Matched Skills */}
        {item.matchedSkills && item.matchedSkills.length > 0 && (
          <div className="rec-tags-section">
            <span className="rec-tags-title" style={{ color: '#15803d' }}>Skills You Match:</span>
            <div className="tags-cloud">
              {item.matchedSkills.map((ms, idx) => (
                <span key={idx} className="topic-tag-chip" style={{ background: '#dcfce7', color: '#15803d' }}>
                  ✓ {ms}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Missing Skills */}
        {item.missingSkills && item.missingSkills.length > 0 && (
          <div className="rec-tags-section">
            <span className="rec-tags-title" style={{ color: '#b45309' }}>Additional Desired Skills:</span>
            <div className="tags-cloud">
              {item.missingSkills.map((mis, idx) => (
                <span key={idx} className="topic-tag-chip" style={{ background: '#fef3c7', color: '#b45309' }}>
                  + {mis}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="rec-card-actions">
        <button className="btn-primary-action" onClick={() => onNavigate(`/projects`)}>
          Apply / View Project
        </button>
      </div>
    </div>
  );
};

export default RecommendationsHub;
