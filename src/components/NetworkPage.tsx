import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, User, UserMinus } from 'lucide-react';
import './NetworkPage.css';

interface ConnectionDto {
  targetId: number;
  requesterId: number;
  targetName: string;
  requesterName: string;
  status: string;
  isRequester: boolean;
  createdAt: string;
}

interface FollowDto {
  followedId: number;
  followerId: number;
  followedName: string;
  followerName: string;
  createdAt: string;
}

const NetworkPage: React.FC = () => {
  const [connections, setConnections] = useState<ConnectionDto[]>([]);
  const [following, setFollowing] = useState<FollowDto[]>([]);
  const [followers, setFollowers] = useState<FollowDto[]>([]);
  const [activeTab, setActiveTab] = useState<'connections' | 'requests' | 'following' | 'followers'>('requests');
  const navigate = useNavigate();

  const fetchData = async () => {
    const token = localStorage.getItem('token');
    try {
      const [cRes, f1Res, f2Res] = await Promise.all([
        fetch('http://localhost:5000/api/network/connections', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('http://localhost:5000/api/network/following', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('http://localhost:5000/api/network/followers', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      if (cRes.ok) setConnections(await cRes.json());
      if (f1Res.ok) setFollowing(await f1Res.json());
      if (f2Res.ok) setFollowers(await f2Res.json());
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAccept = async (id: number) => {
    const token = localStorage.getItem('token');
    await fetch(`http://localhost:5000/api/network/connect/${id}/accept`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } });
    fetchData();
  };

  const handleReject = async (id: number) => {
    const token = localStorage.getItem('token');
    await fetch(`http://localhost:5000/api/network/connect/${id}/reject`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } });
    fetchData();
  };

  const handleDisconnect = async (id: number) => {
    if (!window.confirm('Are you sure you want to remove this connection?')) return;
    const token = localStorage.getItem('token');
    await fetch(`http://localhost:5000/api/network/connect/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    fetchData();
  };

  const handleUnfollow = async (id: number) => {
    const token = localStorage.getItem('token');
    await fetch(`http://localhost:5000/api/network/follow/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    fetchData();
  };

  const pendingRequests = connections.filter(c => c.status === 'Pending' && !c.isRequester);
  const myConnections = connections.filter(c => c.status === 'Accepted');

  return (
    <div className="network-container animate-fade-in">
      <div className="network-header">
        <h1>My Network</h1>
        <p>Manage your connections, followers, and pending requests.</p>
      </div>

      <div className="network-tabs">
        <button className={`tab-btn ${activeTab === 'requests' ? 'active' : ''}`} onClick={() => setActiveTab('requests')}>
          Pending Requests ({pendingRequests.length})
        </button>
        <button className={`tab-btn ${activeTab === 'connections' ? 'active' : ''}`} onClick={() => setActiveTab('connections')}>
          Connections ({myConnections.length})
        </button>
        <button className={`tab-btn ${activeTab === 'following' ? 'active' : ''}`} onClick={() => setActiveTab('following')}>
          Following ({following.length})
        </button>
        <button className={`tab-btn ${activeTab === 'followers' ? 'active' : ''}`} onClick={() => setActiveTab('followers')}>
          Followers ({followers.length})
        </button>
      </div>

      <div className="network-content">
        {activeTab === 'requests' && (
          <div className="network-grid">
            {pendingRequests.length === 0 && <p className="empty-state">No pending requests.</p>}
            {pendingRequests.map(req => (
              <div key={req.requesterId} className="network-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div className="avatar"><User size={24} /></div>
                  <div>
                    <h3 onClick={() => navigate(`/profile/${req.requesterId}`)} style={{ cursor: 'pointer', margin: 0 }}>{req.requesterName}</h3>
                    <span style={{ fontSize: '0.8rem', color: '#888' }}>Sent {new Date(req.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                  <button className="accept-btn" onClick={() => handleAccept(req.requesterId)}><Check size={16} /> Accept</button>
                  <button className="reject-btn" onClick={() => handleReject(req.requesterId)}><X size={16} /> Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'connections' && (
          <div className="network-grid">
            {myConnections.length === 0 && <p className="empty-state">No connections yet.</p>}
            {myConnections.map(c => {
               const otherId = c.isRequester ? c.targetId : c.requesterId;
               const otherName = c.isRequester ? c.targetName : c.requesterName;
               return (
                  <div key={otherId} className="network-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div className="avatar"><User size={24} /></div>
                      <div>
                        <h3 onClick={() => navigate(`/profile/${otherId}`)} style={{ cursor: 'pointer', margin: 0 }}>{otherName}</h3>
                        <span style={{ fontSize: '0.8rem', color: '#888' }}>Connected {new Date(c.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleDisconnect(otherId)}
                      style={{ marginTop: '1rem', width: '100%', padding: '0.5rem', background: 'transparent', border: '1px solid #fee2e2', color: '#ef4444', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
                    >
                      <UserMinus size={14} /> Remove Connection
                    </button>
                  </div>
               );
            })}
          </div>
        )}

        {activeTab === 'following' && (
          <div className="network-grid">
            {following.length === 0 && <p className="empty-state">You aren't following anyone.</p>}
            {following.map(f => (
               <div key={f.followedId} className="network-card">
                 <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                   <div className="avatar"><User size={24} /></div>
                   <div>
                     <h3 onClick={() => navigate(`/profile/${f.followedId}`)} style={{ cursor: 'pointer', margin: 0 }}>{f.followedName}</h3>
                   </div>
                 </div>
                 <button 
                   onClick={() => handleUnfollow(f.followedId)}
                   style={{ marginTop: '1rem', width: '100%', padding: '0.5rem', background: '#f1f5f9', border: 'none', color: '#64748b', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
                 >
                   <UserMinus size={14} /> Unfollow
                 </button>
               </div>
            ))}
          </div>
        )}

        {activeTab === 'followers' && (
          <div className="network-grid">
            {followers.length === 0 && <p className="empty-state">You have no followers.</p>}
            {followers.map(f => (
               <div key={f.followerId} className="network-card">
                 <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                   <div className="avatar"><User size={24} /></div>
                   <div>
                     <h3 onClick={() => navigate(`/profile/${f.followerId}`)} style={{ cursor: 'pointer', margin: 0 }}>{f.followerName}</h3>
                   </div>
                 </div>
               </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NetworkPage;
