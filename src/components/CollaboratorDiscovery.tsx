import React, { useEffect, useState } from 'react';
import { Users, Handshake, PlusCircle, MapPin, BookOpen, Search } from 'lucide-react';
import './CollaboratorDiscovery.css';

const API = 'http://localhost:5000/api';

interface ResearcherProfile {
  userId: number;
  userName: string;
  institution: string | null;
  department: string | null;
  country: string | null;
  researchInterests: string | null;
  expertiseAreas: string | null;
  isOpenToCollaboration: boolean;
}

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

type Tab = 'discover' | 'opportunities' | 'post';

const CollaboratorDiscovery: React.FC = () => {
  const token = localStorage.getItem('token') ?? '';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const [activeTab, setActiveTab] = useState<Tab>('discover');

  // --- Researcher discovery state ---
  const [researchers, setResearchers] = useState<ResearcherProfile[]>([]);
  const [search, setSearch] = useState('');
  const [institution, setInstitution] = useState('');
  const [country, setCountry] = useState('');
  const [openOnly, setOpenOnly] = useState(false);
  const [loadingResearchers, setLoadingResearchers] = useState(false);

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

  // --- Fetch researchers ---
  const fetchResearchers = async () => {
    setLoadingResearchers(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (institution) params.set('institution', institution);
      if (country) params.set('country', country);
      if (openOnly) params.set('openOnly', 'true');
      const res = await fetch(`${API}/collaborator/discover?${params}`, { headers });
      if (res.ok) setResearchers(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoadingResearchers(false); }
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
    } catch (e) { console.error(e); }
    finally { setLoadingOpps(false); }
  };

  useEffect(() => { if (activeTab === 'discover') fetchResearchers(); }, [activeTab]);
  useEffect(() => { if (activeTab === 'opportunities') fetchOpportunities(); }, [activeTab]);

  const handleResearcherSearch = (e: React.FormEvent) => { e.preventDefault(); fetchResearchers(); };
  const handleOppSearch = (e: React.FormEvent) => { e.preventDefault(); fetchOpportunities(); };

  // --- Post opportunity ---
  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setFormMsg({ type: 'error', text: 'Title is required.' }); return; }
    setPosting(true); setFormMsg(null);
    try {
      const res = await fetch(`${API}/collaborator/opportunities`, {
        method: 'POST', headers,
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
        setForm({ title: '', description: '', requiredExpertise: '', researchArea: '', isCrossInstitution: true, deadline: '' });
      } else {
        const text = await res.text();
        setFormMsg({ type: 'error', text: text || 'Failed to post opportunity.' });
      }
    } catch { setFormMsg({ type: 'error', text: 'Network error.' }); }
    finally { setPosting(false); }
  };

  const getInitials = (name: string | null) =>
    name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?';

  const formatDeadline = (d: string | null) =>
    d ? new Date(d).toLocaleDateString() : null;

  return (
    <div className="collab-container">
      <div className="collab-header">
        <h1>Collaborator Discovery</h1>
        <p>Find researchers to work with and explore cross-institutional opportunities.</p>
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
              placeholder="Search by name or interest…"
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
            <p style={{ color: '#94a3b8' }}>Loading…</p>
          ) : (
            <div className="collab-grid">
              {researchers.length === 0 && (
                <div className="empty-state">
                  <Users size={40} />
                  <p>No researchers found. Try adjusting your filters.</p>
                </div>
              )}
              {researchers.map(r => (
                <div key={r.userId} className="researcher-card" id={`researcher-${r.userId}`}>
                  <div className="researcher-card-header">
                    <div className="researcher-avatar">{getInitials(r.userName)}</div>
                    <div>
                      <h3>{r.userName}</h3>
                      <div className="sub">
                        {[r.institution, r.department].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                  </div>

                  {r.country && (
                    <div className="sub" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <MapPin size={13} /> {r.country}
                    </div>
                  )}

                  {r.researchInterests && (
                    <div className="sub" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <BookOpen size={13} /> {r.researchInterests}
                    </div>
                  )}

                  {r.expertiseAreas && (
                    <div className="tags">
                      {r.expertiseAreas.split(',').slice(0, 4).map((tag, i) => (
                        <span key={i} className="tag">{tag.trim()}</span>
                      ))}
                    </div>
                  )}

                  {r.isOpenToCollaboration && (
                    <span className="open-badge">✓ Open to collaboration</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
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
            <p style={{ color: '#94a3b8' }}>Loading…</p>
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
