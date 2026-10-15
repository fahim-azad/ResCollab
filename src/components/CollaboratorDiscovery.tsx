import React, { useEffect, useState } from 'react';
import { 
  Users, Handshake, PlusCircle, Search, 
  UserCheck, Shield, Sparkles, BookOpen, Building, Globe, Check 
} from 'lucide-react';
import ResearcherCollabCard, { type ResearcherProfileData } from './ResearcherCollabCard';
import ResearcherCollabModal from './ResearcherCollabModal';
import './CollaboratorDiscovery.css';

const API = 'http://localhost:5000/api';

interface CollabOpportunity {
  id: number;
  title: string;
  description: string | null;
  requiredExpertise: string | null;
  researchArea: string | null;
  status: string;
  isCrossInstitution: boolean;
  deadline: string | null;
  createdAt: string;
  postedById: number;
  postedByName: string | null;
}

type Tab = 'discover' | 'opportunities' | 'post' | 'profile';

const CollaboratorDiscovery: React.FC = () => {
  const token = localStorage.getItem('token') ?? '';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // Detect query param ?tab=profile or ?tab=my-profile
  const initialTab = (): Tab => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'profile' || tabParam === 'my-profile') return 'profile';
    if (tabParam === 'opportunities') return 'opportunities';
    if (tabParam === 'post') return 'post';
    return 'discover';
  };

  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  // --- Researcher discovery state ---
  const [researchers, setResearchers] = useState<ResearcherProfileData[]>([]);
  const [search, setSearch] = useState('');
  const [institution, setInstitution] = useState('');
  const [country, setCountry] = useState('');
  const [openOnly, setOpenOnly] = useState(false);
  const [loadingResearchers, setLoadingResearchers] = useState(false);

  // Modal & Connections state
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [connectionMap, setConnectionMap] = useState<{ [userId: number]: string }>({});
  const [connectingUserId, setConnectingUserId] = useState<number | null>(null);

  // --- Opportunities state ---
  const [opportunities, setOpportunities] = useState<CollabOpportunity[]>([]);
  const [oppSearch, setOppSearch] = useState('');
  const [crossOnly, setCrossOnly] = useState(false);
  const [loadingOpps, setLoadingOpps] = useState(false);

  // --- Post form state ---
  const [form, setForm] = useState({
    title: '', description: '', requiredExpertise: '',
    researchArea: '', isCrossInstitution: true, deadline: ''
  });
  const [posting, setPosting] = useState(false);
  const [formMsg, setFormMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // --- My Collaboration Profile state ---
  const [myProfile, setMyProfile] = useState({
    userName: 'My Profile',
    institution: '',
    department: '',
    country: '',
    researchInterests: '',
    expertiseAreas: '',
    isOpenToCollaboration: true,
    visibility: 'Public'
  });
  const [loadingMyProfile, setLoadingMyProfile] = useState(false);
  const [savingMyProfile, setSavingMyProfile] = useState(false);
  const [myProfileMsg, setMyProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // --- Fetch researchers ---
  const fetchResearchers = async () => {
    setLoadingResearchers(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('expertise', search);
      if (institution) params.set('institution', institution);
      if (country) params.set('country', country);
      if (openOnly) params.set('openOnly', 'true');
      const res = await fetch(`${API}/collaborator/discover?${params}`, { headers });
      if (res.ok) setResearchers(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingResearchers(false);
    }
  };

  // --- Fetch opportunities ---
  const fetchOpportunities = async () => {
    setLoadingOpps(true);
    try {
      const params = new URLSearchParams({ status: 'Open' });
      if (oppSearch) params.set('researchArea', oppSearch);
      if (crossOnly) params.set('crossInstitution', 'true');
      const res = await fetch(`${API}/collaborator/opportunities?${params}`, { headers });
      if (res.ok) setOpportunities(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingOpps(false);
    }
  };

  // --- Fetch My Collaboration Profile ---
  const fetchMyProfile = async () => {
    setLoadingMyProfile(true);
    setMyProfileMsg(null);
    try {
      // First fetch general profile to get user's display name
      let displayName = 'My Profile';
      try {
        const uRes = await fetch(`${API}/profile`, { headers });
        if (uRes.ok) {
          const uData = await uRes.json();
          displayName = uData.name || 'My Profile';
        }
      } catch (err) {
        console.warn('Could not fetch user name', err);
      }

      // Next fetch collaborator profile
      const res = await fetch(`${API}/collaborator/profile/me`, { headers });
      if (res.ok) {
        const data = await res.json();
        setMyProfile({
          userName: displayName,
          institution: data.institution || '',
          department: data.department || '',
          country: data.country || '',
          researchInterests: data.researchInterests || '',
          expertiseAreas: data.expertiseAreas || '',
          isOpenToCollaboration: data.isOpenToCollaboration ?? true,
          visibility: data.visibility || 'Public'
        });
      } else if (res.status === 404) {
        // Fallback: populate from general profile if collaborator profile not yet created
        try {
          const uRes = await fetch(`${API}/profile`, { headers });
          if (uRes.ok) {
            const uData = await uRes.json();
            setMyProfile(prev => ({
              ...prev,
              userName: uData.name || 'My Profile',
              institution: uData.university || '',
              department: uData.department || '',
              country: uData.country || '',
              researchInterests: (uData.interests || []).join(', '),
              expertiseAreas: (uData.skills || []).join(', ')
            }));
          }
        } catch {
          // ignore
        }
      }
    } catch (e) {
      console.error(e);
      setMyProfileMsg({ type: 'error', text: 'Failed to load your collaboration profile.' });
    } finally {
      setLoadingMyProfile(false);
    }
  };

  // --- Save My Collaboration Profile ---
  const handleSaveMyProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingMyProfile(true);
    setMyProfileMsg(null);
    try {
      const res = await fetch(`${API}/collaborator/profile`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          institution: myProfile.institution || null,
          department: myProfile.department || null,
          country: myProfile.country || null,
          researchInterests: myProfile.researchInterests || null,
          expertiseAreas: myProfile.expertiseAreas || null,
          isOpenToCollaboration: myProfile.isOpenToCollaboration,
          visibility: myProfile.visibility
        })
      });

      if (res.ok) {
        setMyProfileMsg({ type: 'success', text: 'Collaboration profile updated successfully!' });
      } else {
        const text = await res.text();
        setMyProfileMsg({ type: 'error', text: text || 'Failed to update profile.' });
      }
    } catch {
      setMyProfileMsg({ type: 'error', text: 'Network error occurred while saving.' });
    } finally {
      setSavingMyProfile(false);
    }
  };

  // --- Connect with a researcher ---
  const handleConnect = async (targetUserId: number) => {
    setConnectingUserId(targetUserId);
    try {
      const res = await fetch(`${API}/network/connect/${targetUserId}`, {
        method: 'POST',
        headers
      });
      if (res.ok) {
        setConnectionMap(prev => ({ ...prev, [targetUserId]: 'Pending' }));
      } else {
        const text = await res.text();
        if (text.includes('already exists') || text.includes('Pending')) {
          setConnectionMap(prev => ({ ...prev, [targetUserId]: 'Pending' }));
        } else {
          alert(`Connection notice: ${text || 'Could not send request.'}`);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setConnectingUserId(null);
    }
  };

  useEffect(() => {
    if (activeTab === 'discover') fetchResearchers();
    if (activeTab === 'opportunities') fetchOpportunities();
    if (activeTab === 'profile') fetchMyProfile();
  }, [activeTab]);

  const handleResearcherSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchResearchers();
  };

  const handleOppSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOpportunities();
  };

  // --- Post opportunity ---
  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setFormMsg({ type: 'error', text: 'Title is required.' });
      return;
    }
    setPosting(true);
    setFormMsg(null);
    try {
      const res = await fetch(`${API}/collaborator/opportunities`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: form.title,
          description: form.description || null,
          requiredExpertise: form.requiredExpertise || null,
          researchArea: form.researchArea || null,
          isCrossInstitution: form.isCrossInstitution,
          deadline: form.deadline || null
        })
      });
      if (res.ok) {
        setFormMsg({ type: 'success', text: 'Opportunity posted successfully!' });
        setForm({
          title: '',
          description: '',
          requiredExpertise: '',
          researchArea: '',
          isCrossInstitution: true,
          deadline: ''
        });
      } else {
        const text = await res.text();
        setFormMsg({ type: 'error', text: text || 'Failed to post opportunity.' });
      }
    } catch {
      setFormMsg({ type: 'error', text: 'Network error.' });
    } finally {
      setPosting(false);
    }
  };

  const formatDeadline = (d: string | null) =>
    d ? new Date(d).toLocaleDateString() : null;

  return (
    <div className="collab-container">
      <div className="collab-header">
        <h1>Collaborator Discovery & Opportunities</h1>
        <p>Find research partners, manage your cross-institution profile, and explore collaboration calls.</p>
      </div>

      {/* Tabs */}
      <div className="collab-tabs">
        <button
          id="tab-discover"
          className={`tab-btn ${activeTab === 'discover' ? 'active' : ''}`}
          onClick={() => setActiveTab('discover')}
        >
          <Users size={16} style={{ marginRight: '0.4rem' }} />
          Discover Researchers
        </button>
        <button
          id="tab-my-profile"
          className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          <UserCheck size={16} style={{ marginRight: '0.4rem' }} />
          My Collaboration Profile
        </button>
        <button
          id="tab-opportunities"
          className={`tab-btn ${activeTab === 'opportunities' ? 'active' : ''}`}
          onClick={() => setActiveTab('opportunities')}
        >
          <Handshake size={16} style={{ marginRight: '0.4rem' }} />
          Opportunities
        </button>
        <button
          id="tab-post"
          className={`tab-btn ${activeTab === 'post' ? 'active' : ''}`}
          onClick={() => setActiveTab('post')}
        >
          <PlusCircle size={16} style={{ marginRight: '0.4rem' }} />
          Post Opportunity
        </button>
      </div>

      {/* ── DISCOVER TAB ── */}
      {activeTab === 'discover' && (
        <>
          <form className="collab-filters" onSubmit={handleResearcherSearch}>
            <input
              id="filter-search"
              className="filter-search"
              placeholder="Search by expertise or interest…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <input
              id="filter-institution"
              placeholder="Institution"
              value={institution}
              onChange={e => setInstitution(e.target.value)}
            />
            <input
              id="filter-country"
              placeholder="Country"
              value={country}
              onChange={e => setCountry(e.target.value)}
            />
            <button
              id="filter-open-toggle"
              type="button"
              className={`filter-toggle ${openOnly ? 'active' : ''}`}
              onClick={() => setOpenOnly(p => !p)}
            >
              Open to Collab
            </button>
            <button id="btn-search-researchers" type="submit" className="form-submit-btn">
              <Search size={16} style={{ marginRight: '0.35rem' }} /> Search
            </button>
          </form>

          {loadingResearchers ? (
            <p style={{ color: '#94a3b8' }}>Loading researchers…</p>
          ) : (
            <div className="collab-grid">
              {researchers.length === 0 && (
                <div className="empty-state">
                  <Users size={40} />
                  <p>No researchers found. Try adjusting your filters.</p>
                </div>
              )}
              {researchers.map(r => (
                <ResearcherCollabCard
                  key={r.userId}
                  researcher={r}
                  onViewProfile={id => setSelectedUserId(id)}
                  onConnect={handleConnect}
                  isConnecting={connectingUserId === r.userId}
                  connectionStatus={connectionMap[r.userId]}
                />
              ))}
            </div>
          )}

          {/* Modal when inspecting a researcher's card */}
          {selectedUserId !== null && (
            <ResearcherCollabModal
              userId={selectedUserId}
              onClose={() => setSelectedUserId(null)}
              onConnect={handleConnect}
              isConnecting={connectingUserId === selectedUserId}
              connectionStatus={connectionMap[selectedUserId]}
            />
          )}
        </>
      )}

      {/* ── MY COLLABORATION PROFILE TAB ── */}
      {activeTab === 'profile' && (
        <div className="my-collab-profile-layout">
          <form 
            className="my-collab-form" 
            id="my-collab-profile-form" 
            onSubmit={handleSaveMyProfile}
          >
            <div className="form-header-group">
              <h2>Researcher Collaboration Profile</h2>
              <p>Configure how fellow researchers and prospective collaborators discover you across institutions.</p>
            </div>

            {myProfileMsg && (
              <div className={myProfileMsg.type === 'success' ? 'success-msg' : 'error-msg'}>
                {myProfileMsg.text}
              </div>
            )}

            {loadingMyProfile ? (
              <p style={{ color: '#94a3b8' }}>Loading your profile data…</p>
            ) : (
              <>
                <div className="form-field-group">
                  <label htmlFor="my-collab-institution">
                    <Building size={15} /> Institution / University
                  </label>
                  <input
                    id="my-collab-institution"
                    placeholder="e.g. Stanford University"
                    value={myProfile.institution}
                    onChange={e => setMyProfile(p => ({ ...p, institution: e.target.value }))}
                  />
                </div>

                <div className="form-grid-2">
                  <div className="form-field-group">
                    <label htmlFor="my-collab-department">Department / Faculty</label>
                    <input
                      id="my-collab-department"
                      placeholder="e.g. Computer Science"
                      value={myProfile.department}
                      onChange={e => setMyProfile(p => ({ ...p, department: e.target.value }))}
                    />
                  </div>
                  <div className="form-field-group">
                    <label htmlFor="my-collab-country">
                      <Globe size={15} /> Country
                    </label>
                    <input
                      id="my-collab-country"
                      placeholder="e.g. United States"
                      value={myProfile.country}
                      onChange={e => setMyProfile(p => ({ ...p, country: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="form-field-group">
                  <label htmlFor="my-collab-interests">
                    <BookOpen size={15} /> Research Interests
                  </label>
                  <textarea
                    id="my-collab-interests"
                    rows={2}
                    placeholder="e.g. Deep Learning, Distributed Systems, Bioinformatics..."
                    value={myProfile.researchInterests}
                    onChange={e => setMyProfile(p => ({ ...p, researchInterests: e.target.value }))}
                  />
                </div>

                <div className="form-field-group">
                  <label htmlFor="my-collab-expertise">
                    <Sparkles size={15} /> Expertise Areas (comma-separated tags)
                  </label>
                  <input
                    id="my-collab-expertise"
                    placeholder="e.g. PyTorch, Kubernetes, Genomics, NLP, React"
                    value={myProfile.expertiseAreas}
                    onChange={e => setMyProfile(p => ({ ...p, expertiseAreas: e.target.value }))}
                  />
                </div>

                <div className="form-grid-2">
                  <div className="form-field-group">
                    <label htmlFor="my-collab-visibility">
                      <Shield size={15} /> Profile Visibility
                    </label>
                    <select
                      id="my-collab-visibility"
                      value={myProfile.visibility}
                      onChange={e => setMyProfile(p => ({ ...p, visibility: e.target.value }))}
                    >
                      <option value="Public">Public (All Researchers)</option>
                      <option value="Connections">Connections Only</option>
                      <option value="Institution">Same Institution Only</option>
                      <option value="Private">Private</option>
                    </select>
                  </div>

                  <div className="form-field-group checkbox-group">
                    <label className="toggle-label" htmlFor="my-collab-open-toggle">
                      <input
                        id="my-collab-open-toggle"
                        type="checkbox"
                        checked={myProfile.isOpenToCollaboration}
                        onChange={e => setMyProfile(p => ({ ...p, isOpenToCollaboration: e.target.checked }))}
                      />
                      <span>Open to Collaboration</span>
                    </label>
                    <span className="helper-text">
                      Allow other researchers to find you in collaboration discovery calls.
                    </span>
                  </div>
                </div>

                <button
                  id="btn-save-collab-profile"
                  type="submit"
                  className="form-submit-btn"
                  disabled={savingMyProfile}
                  style={{ alignSelf: 'flex-start' }}
                >
                  <Check size={16} style={{ marginRight: '0.4rem' }} />
                  {savingMyProfile ? 'Saving Changes…' : 'Save Collaboration Profile'}
                </button>
              </>
            )}
          </form>

          {/* Live Collaboration Card Preview */}
          <div className="card-preview-container">
            <div className="preview-label">Live Collaboration Card Preview</div>
            <p className="preview-hint">This is how your collaboration profile appears on researcher discovery cards:</p>
            <ResearcherCollabCard
              isPreview={true}
              researcher={{
                userId: 0,
                userName: myProfile.userName || 'Your Name',
                institution: myProfile.institution || 'Your Institution',
                department: myProfile.department || 'Department',
                country: myProfile.country || 'Location',
                researchInterests: myProfile.researchInterests || 'Add your key research topics and project interests',
                expertiseAreas: myProfile.expertiseAreas || 'Domain, Methodology, Tools',
                isOpenToCollaboration: myProfile.isOpenToCollaboration,
                visibility: myProfile.visibility
              }}
            />
          </div>
        </div>
      )}

      {/* ── OPPORTUNITIES TAB ── */}
      {activeTab === 'opportunities' && (
        <>
          <form className="collab-filters" onSubmit={handleOppSearch}>
            <input
              id="opp-filter-area"
              className="filter-search"
              placeholder="Filter by research area…"
              value={oppSearch}
              onChange={e => setOppSearch(e.target.value)}
            />
            <button
              id="opp-filter-cross"
              type="button"
              className={`filter-toggle ${crossOnly ? 'active' : ''}`}
              onClick={() => setCrossOnly(p => !p)}
            >
              Cross-Institution Only
            </button>
            <button id="btn-search-opps" type="submit" className="form-submit-btn">
              <Search size={16} style={{ marginRight: '0.35rem' }} /> Search
            </button>
          </form>

          {loadingOpps ? (
            <p style={{ color: '#94a3b8' }}>Loading opportunities…</p>
          ) : (
            <div className="collab-grid">
              {opportunities.length === 0 && (
                <div className="empty-state">
                  <Handshake size={40} />
                  <p>No open opportunities found.</p>
                </div>
              )}
              {opportunities.map(opp => (
                <div key={opp.id} className="opportunity-card" id={`opportunity-${opp.id}`}>
                  <h3>{opp.title}</h3>

                  <div className="tags">
                    {opp.isCrossInstitution && <span className="cross-badge">🌐 Cross-Institution</span>}
                    {opp.researchArea && <span className="tag">{opp.researchArea}</span>}
                  </div>

                  {opp.description && (
                    <p className="meta" style={{ lineHeight: 1.55 }}>
                      {opp.description.length > 130 ? opp.description.slice(0, 130) + '…' : opp.description}
                    </p>
                  )}

                  {opp.requiredExpertise && (
                    <div className="meta">
                      <strong>Required expertise:</strong> {opp.requiredExpertise}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="meta">Posted by {opp.postedByName ?? 'Unknown'}</span>
                    {opp.deadline && (
                      <span className="deadline">⏰ {formatDeadline(opp.deadline)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── POST OPPORTUNITY TAB ── */}
      {activeTab === 'post' && (
        <form className="opp-form" id="post-opportunity-form" onSubmit={handlePost}>
          <h2>Post a Collaboration Opportunity</h2>

          {formMsg && (
            <div className={formMsg.type === 'success' ? 'success-msg' : 'error-msg'}>
              {formMsg.text}
            </div>
          )}

          <input
            id="opp-title"
            placeholder="Opportunity title *"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            required
          />

          <textarea
            id="opp-description"
            placeholder="Description (what are you working on?)"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          />

          <div className="opp-form-row">
            <input
              id="opp-expertise"
              placeholder="Required expertise"
              value={form.requiredExpertise}
              onChange={e => setForm(f => ({ ...f, requiredExpertise: e.target.value }))}
            />
            <input
              id="opp-area"
              placeholder="Research area"
              value={form.researchArea}
              onChange={e => setForm(f => ({ ...f, researchArea: e.target.value }))}
            />
          </div>

          <div className="opp-form-row">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem', color: '#374151' }}>
              <input
                id="opp-cross"
                type="checkbox"
                checked={form.isCrossInstitution}
                onChange={e => setForm(f => ({ ...f, isCrossInstitution: e.target.checked }))}
              />
              Open to cross-institution collaborators
            </label>
            <input
              id="opp-deadline"
              type="date"
              value={form.deadline}
              onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
            />
          </div>

          <button id="btn-post-opportunity" type="submit" className="form-submit-btn" disabled={posting}>
            {posting ? 'Posting…' : 'Post Opportunity'}
          </button>
        </form>
      )}
    </div>
  );
};

export default CollaboratorDiscovery;
