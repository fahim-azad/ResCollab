import React, { useEffect, useState } from 'react';
import { Bookmark, FolderOpen, Lightbulb } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './SavedPage.css';

interface BookmarkDto {
  id: number;
  itemType: string;
  itemId: number;
  createdAt: string;
  itemTitle: string;
  itemSubtitle: string;
}

const SavedPage: React.FC = () => {
  const [bookmarks, setBookmarks] = useState<BookmarkDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('All');
  const navigate = useNavigate();

  const fetchBookmarks = async () => {
    try {
      const token = localStorage.getItem('token');
      const url = filter === 'All' 
        ? 'http://localhost:5000/api/bookmark' 
        : `http://localhost:5000/api/bookmark?itemType=${filter}`;
        
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setBookmarks(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookmarks();
  }, [filter]);

  const handleRemove = async (id: number) => {
    const token = localStorage.getItem('token');
    try {
      await fetch(`http://localhost:5000/api/bookmark/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setBookmarks(prev => prev.filter(b => b.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const getIcon = (type: string) => {
    if (type === 'Project') return <FolderOpen size={20} color="var(--brand-blue)" />;
    if (type === 'Idea') return <Lightbulb size={20} color="var(--brand-purple)" />;
    return <Bookmark size={20} />;
  };

  const handleNavigate = (type: string) => {
    if (type === 'Project') navigate('/projects');
    if (type === 'Idea') navigate('/ideas');
  };

  return (
    <div className="saved-container animate-fade-in">
      <div className="saved-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Bookmark size={28} color="var(--brand-navy)" fill="var(--brand-navy)" />
          <h1 style={{ margin: 0, color: 'var(--brand-navy)' }}>Saved Items</h1>
        </div>
        <p>Access your bookmarked research projects and ideas.</p>
      </div>

      <div className="saved-tabs">
        {['All', 'Project', 'Idea'].map(f => (
          <button 
            key={f} 
            className={`tab-btn ${filter === f ? 'active' : ''}`} 
            onClick={() => setFilter(f)}
          >
            {f}s
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: '2rem' }}>Loading saved items...</div>
      ) : bookmarks.length === 0 ? (
        <div className="empty-saved">
          <Bookmark size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
          <h3>Nothing saved yet</h3>
          <p>When you bookmark an item, it will appear here.</p>
        </div>
      ) : (
        <div className="saved-grid">
          {bookmarks.map(b => (
            <div key={b.id} className="saved-card animate-slide-up">
              <div className="saved-card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f1f5f9', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                  {getIcon(b.itemType)} {b.itemType}
                </div>
                <button className="remove-btn" onClick={() => handleRemove(b.id)}>Remove</button>
              </div>
              <h3 onClick={() => handleNavigate(b.itemType)}>{b.itemTitle}</h3>
              <p>{b.itemSubtitle}</p>
              <div className="saved-meta">Saved {new Date(b.createdAt).toLocaleDateString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SavedPage;
