import React, { useState } from 'react';
import { Search, Filter, BookOpen, Database, Users, ExternalLink } from 'lucide-react';
import './SearchPage.css';

interface SearchResult {
  id: string;
  title: string;
  type: string;
  description: string;
  url: string;
  tags: string[];
  publishedDate: string;
  source: string;
}

const SearchPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const filters = ['All', 'Papers', 'Datasets', 'Researchers'];

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setLoading(true);
    setSearched(false);
    setError(null);
    
    try {
      const res = await fetch(`http://localhost:5000/api/search?q=${encodeURIComponent(query)}&filter=${encodeURIComponent(filter)}`);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setResults(data);
      setSearched(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getIconForType = (type: string) => {
    switch (type.toLowerCase()) {
      case 'paper': return <BookOpen size={18} />;
      case 'dataset': return <Database size={18} />;
      case 'researcher': return <Users size={18} />;
      default: return <BookOpen size={18} />;
    }
  };

  const getColorForType = (type: string) => {
    switch (type.toLowerCase()) {
      case 'paper': return 'var(--brand-navy)';
      case 'dataset': return 'var(--brand-cyan)';
      case 'researcher': return 'var(--brand-purple)';
      default: return 'var(--brand-navy)';
    }
  };

  return (
    <div className="search-page-container">
      <div className="animate-fade-in search-wrapper">
        <h1 className="text-gradient search-title">Unified Research Search</h1>
        <p className="search-subtitle">
          Discover papers, datasets, source code, and global researchers.
        </p>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="neo-container search-bar-container">
          <Search size={24} color="var(--brand-navy)" style={{ marginLeft: '1rem' }} />
          <input 
            type="text" 
            placeholder="Search for quantum computing, machine learning datasets..." 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="search-input"
          />
          <button type="submit" className="neo-button brand-button" style={{ padding: '0.75rem 2rem', width: 'auto', whiteSpace: 'nowrap' }}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>

        {/* Filters */}
        <div className="animate-slide-up delay-100 filters-container">
          <div className="filter-label">
            <Filter size={18} /> Filters:
          </div>
          {filters.map(f => (
            <button 
              key={f} 
              type="button"
              onClick={() => setFilter(f)}
              className={`tag-pill ${filter === f ? 'active' : ''}`}
              style={filter === f ? { backgroundColor: 'var(--brand-cyan)', color: 'white' } : { cursor: 'pointer' }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Results */}
        <div className="animate-slide-up delay-200 search-results-list">
          
          {loading && (
            <div className="search-loading">
              Searching global databases and local resources...
            </div>
          )}

          {error && (
            <div className="neo-container search-empty">
              <h3 style={{ color: '#d32f2f' }}>Error Occurred</h3>
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && searched && results.length === 0 && (
            <div className="neo-container search-empty">
              <Search size={48} color="var(--text-secondary)" style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
              <h3>No results found</h3>
              <p>We couldn't find any {filter !== 'All' ? filter.toLowerCase() : 'resources'} matching "{query}". Try adjusting your keywords or filters.</p>
            </div>
          )}

          {!loading && !error && searched && results.length > 0 && (
            <>
              <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                Found {results.length} results for "{query}"
              </p>
              
              {results.map((result) => (
                <div key={result.id} className="neo-container search-card">
                  <div className="search-card-header" style={{ color: getColorForType(result.type) }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {getIconForType(result.type)}
                      <span className="search-card-type">{result.type}</span>
                    </div>
                    <span style={{ fontSize: '0.75rem', backgroundColor: '#eef3f9', padding: '0.2rem 0.5rem', borderRadius: '10px' }}>
                      Source: {result.source}
                    </span>
                  </div>
                  <h3 className="search-card-title">{result.title}</h3>
                  <p className="search-card-desc">{result.description}</p>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '1rem' }}>
                    <div className="search-card-tags">
                      {result.tags && result.tags.map((tag, idx) => (
                        <span key={idx} className="tag-pill" style={{ margin: 0, marginRight: '0.5rem' }}>{tag}</span>
                      ))}
                    </div>
                    
                    {result.url && (
                      <a href={result.url} target="_blank" rel="noopener noreferrer" className="neo-button" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none' }}>
                        <ExternalLink size={14} /> View External
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}

        </div>
      </div>
    </div>
  );
};

export default SearchPage;
