import React, { useState } from 'react';
import { 
  X, BookOpen, ExternalLink, Calendar, Users, 
  Copy, Check, FileText, Globe, Lock, Shield, 
  Edit3, Trash2, Link as LinkIcon, Quote, Download, Search
} from 'lucide-react';

export interface PublicationDetail {
  id: number;
  ownerId: number;
  ownerName?: string | null;
  title: string;
  authors: string;
  doi?: string | null;
  journalOrConference?: string | null;
  publicationYear: number;
  abstract?: string | null;
  sourceLink?: string | null;
  publicationType: string;
  visibility: string;
  createdAt: string;
  updatedAt?: string;
}

interface PublicationDetailsModalProps {
  publication: PublicationDetail;
  isOwner: boolean;
  onClose: () => void;
  onEdit?: (pub: PublicationDetail) => void;
  onDelete?: (id: number) => void;
  onToggleVisibility?: (id: number, currentVis: string) => void;
}

export type CitationStyle = 'apa' | 'ieee' | 'mla' | 'bibtex';

export const detectLinkProvider = (url?: string | null) => {
  if (!url) return null;
  const u = url.toLowerCase();
  if (u.includes('arxiv.org')) return { name: 'arXiv', badgeClass: 'pub-provider-arxiv' };
  if (u.includes('ieeexplore.ieee.org')) return { name: 'IEEE Xplore', badgeClass: 'pub-provider-ieee' };
  if (u.includes('dl.acm.org')) return { name: 'ACM Digital Library', badgeClass: 'pub-provider-acm' };
  if (u.includes('ncbi.nlm.nih.gov') || u.includes('pubmed')) return { name: 'PubMed', badgeClass: 'pub-provider-pubmed' };
  if (u.includes('nature.com')) return { name: 'Nature', badgeClass: 'pub-provider-nature' };
  if (u.includes('springer.com') || u.includes('link.springer.com')) return { name: 'Springer', badgeClass: 'pub-provider-springer' };
  if (u.includes('sciencedirect.com') || u.includes('elsevier.com')) return { name: 'ScienceDirect', badgeClass: 'pub-provider-elsevier' };
  if (u.includes('researchgate.net')) return { name: 'ResearchGate', badgeClass: 'pub-provider-rg' };
  if (u.includes('github.com')) return { name: 'GitHub Code/Data', badgeClass: 'pub-provider-github' };
  if (u.endsWith('.pdf')) return { name: 'Direct PDF', badgeClass: 'pub-provider-pdf' };
  return { name: 'Original Source', badgeClass: 'pub-provider-generic' };
};

export const PublicationDetailsModal: React.FC<PublicationDetailsModalProps> = ({
  publication,
  isOwner,
  onClose,
  onEdit,
  onDelete,
  onToggleVisibility,
}) => {
  const [selectedCitationStyle, setSelectedCitationStyle] = useState<CitationStyle>('apa');
  const [copiedType, setCopiedType] = useState<string | null>(null);

  const cleanDoi = publication.doi?.replace(/^https?:\/\/doi\.org\//i, '').replace(/^doi:/i, '').trim();

  const getDoiUrl = (doi: string) => {
    return doi.startsWith('http') ? doi : `https://doi.org/${doi}`;
  };

  // Generate APA Citation (7th Edition)
  const generateApaCitation = () => {
    const authors = publication.authors;
    const year = publication.publicationYear;
    const title = publication.title;
    const venue = publication.journalOrConference ? `${publication.journalOrConference}.` : '';
    const doi = cleanDoi ? ` https://doi.org/${cleanDoi}` : '';
    return `${authors} (${year}). ${title}. ${venue}${doi}`.trim();
  };

  // Generate IEEE Citation
  const generateIeeeCitation = () => {
    const authors = publication.authors;
    const title = publication.title;
    const venue = publication.journalOrConference ? `"${publication.journalOrConference}," ` : '';
    const year = publication.publicationYear;
    const doi = cleanDoi ? `, doi: ${cleanDoi}` : '';
    return `${authors}, "${title}," ${venue}${year}${doi}.`.trim();
  };

  // Generate MLA Citation (9th Edition)
  const generateMlaCitation = () => {
    const authors = publication.authors;
    const title = publication.title;
    const venue = publication.journalOrConference ? `*${publication.journalOrConference}*, ` : '';
    const year = publication.publicationYear;
    const doi = cleanDoi ? `, https://doi.org/${cleanDoi}` : '';
    return `${authors}. "${title}." ${venue}${year}${doi}.`.trim();
  };

  // Generate BibTeX
  const generateBibtex = () => {
    const firstAuthor = publication.authors.split(',')[0].trim().replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '');
    const key = `${firstAuthor || 'Author'}${publication.publicationYear}`;
    const isConference = publication.publicationType.toLowerCase() === 'conference';
    const type = isConference ? 'inproceedings' : 'article';
    const venueField = isConference ? 'booktitle' : 'journal';

    return `@${type}{${key},
  title = {${publication.title}},
  author = {${publication.authors}},
  year = {${publication.publicationYear}},${publication.journalOrConference ? `\n  ${venueField} = {${publication.journalOrConference}},` : ''}${cleanDoi ? `\n  doi = {${cleanDoi}},` : ''}${publication.sourceLink ? `\n  url = {${publication.sourceLink}},` : ''}
  publisher = {ResCollab Academic Repository}
}`;
  };

  const getCurrentCitationText = () => {
    switch (selectedCitationStyle) {
      case 'apa': return generateApaCitation();
      case 'ieee': return generateIeeeCitation();
      case 'mla': return generateMlaCitation();
      case 'bibtex': return generateBibtex();
    }
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2500);
  };

  const downloadBibtexFile = () => {
    const bibtexContent = generateBibtex();
    const firstAuthor = publication.authors.split(',')[0].trim().replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '');
    const filename = `${firstAuthor || 'citation'}_${publication.publicationYear}.bib`;
    const blob = new Blob([bibtexContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getBadgeColorClass = (type: string) => {
    switch (type.toLowerCase()) {
      case 'journal': return 'pub-type-journal';
      case 'conference': return 'pub-type-conference';
      case 'book': return 'pub-type-book';
      case 'thesis': return 'pub-type-thesis';
      case 'preprint': return 'pub-type-preprint';
      default: return 'pub-type-other';
    }
  };

  const linkProvider = detectLinkProvider(publication.sourceLink);

  const googleScholarUrl = `https://scholar.google.com/scholar?q=${encodeURIComponent(publication.title)}`;
  const semanticScholarUrl = `https://www.semanticscholar.org/search?q=${encodeURIComponent(publication.title)}`;
  const crossRefUrl = cleanDoi 
    ? `https://doi.org/${cleanDoi}` 
    : `https://search.crossref.org/?q=${encodeURIComponent(publication.title)}`;

  return (
    <div className="pub-modal-backdrop" onClick={onClose} id="pub-details-modal-backdrop">
      <div 
        className="pub-modal-content" 
        onClick={e => e.stopPropagation()} 
        id={`pub-details-modal-${publication.id}`}
      >
        <button 
          className="pub-modal-close" 
          onClick={onClose} 
          id="btn-close-pub-details"
          aria-label="Close publication details"
        >
          <X size={20} />
        </button>

        {/* Header Tags & Metadata */}
        <div className="pub-modal-header-tags">
          <span className={`pub-type-badge ${getBadgeColorClass(publication.publicationType)}`}>
            <BookOpen size={12} /> {publication.publicationType}
          </span>
          <span className="pub-year-badge">
            <Calendar size={12} /> {publication.publicationYear}
          </span>
          <span className={`pub-vis-badge ${publication.visibility.toLowerCase()}`}>
            {publication.visibility === 'Public' ? <Globe size={12} /> : <Lock size={12} />}
            {publication.visibility}
          </span>
        </div>

        {/* Title */}
        <h2 className="pub-modal-title">{publication.title}</h2>

        {/* Authors */}
        <div className="pub-modal-authors">
          <Users size={16} className="pub-meta-icon" />
          <div className="authors-text">
            <strong>Authors:</strong> {publication.authors}
          </div>
        </div>

        {/* Venue (Journal / Conference) */}
        {publication.journalOrConference && (
          <div className="pub-modal-venue">
            <FileText size={16} className="pub-meta-icon" />
            <div className="venue-text">
              <strong>{publication.publicationType === 'Conference' ? 'Proceedings / Conference:' : 'Journal / Venue:'}</strong>{' '}
              {publication.journalOrConference}
            </div>
          </div>
        )}

        {/* Links Section: DOI & Source Link */}
        <div className="pub-modal-links-row">
          {cleanDoi && (
            <div className="pub-link-item doi-item">
              <span className="link-label">DOI:</span>
              <a 
                href={getDoiUrl(cleanDoi)} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="doi-link"
                id={`link-doi-${publication.id}`}
                title="Open DOI Resolver"
              >
                {cleanDoi} <ExternalLink size={13} />
              </a>
              <button 
                type="button" 
                className="icon-copy-btn" 
                title="Copy DOI identifier"
                onClick={() => copyToClipboard(cleanDoi, 'doi')}
              >
                {copiedType === 'doi' ? <Check size={14} className="copied-icon" /> : <Copy size={14} />}
              </button>
            </div>
          )}

          {publication.sourceLink && (
            <div className="pub-link-item source-item">
              <span className="link-label">Source Link:</span>
              <a 
                href={publication.sourceLink.startsWith('http') ? publication.sourceLink : `https://${publication.sourceLink}`} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="source-link-btn"
                id={`link-source-${publication.id}`}
              >
                <LinkIcon size={14} />
                <span>{linkProvider ? `${linkProvider.name}` : 'Paper URL'}</span>
                <ExternalLink size={13} />
              </a>
              <button 
                type="button" 
                className="icon-copy-btn" 
                title="Copy Source URL"
                onClick={() => copyToClipboard(publication.sourceLink!, 'source')}
              >
                {copiedType === 'source' ? <Check size={14} className="copied-icon" /> : <Copy size={14} />}
              </button>
            </div>
          )}
        </div>

        {/* Scholarly Discovery / External Resolution */}
        <div className="pub-scholarly-lookup-bar">
          <span className="scholarly-label">
            <Search size={13} /> External Scholarly Lookup:
          </span>
          <div className="scholarly-links">
            <a 
              href={googleScholarUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="scholarly-chip"
              title="Search this paper on Google Scholar"
            >
              Google Scholar <ExternalLink size={11} />
            </a>
            <a 
              href={semanticScholarUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="scholarly-chip"
              title="Search this paper on Semantic Scholar"
            >
              Semantic Scholar <ExternalLink size={11} />
            </a>
            <a 
              href={crossRefUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="scholarly-chip"
              title="Resolve metadata on CrossRef"
            >
              CrossRef <ExternalLink size={11} />
            </a>
          </div>
        </div>

        {/* Abstract Section */}
        <div className="pub-modal-abstract-section">
          <h3>
            <FileText size={16} /> Abstract & Synopsis
          </h3>
          <div className="pub-abstract-body">
            {publication.abstract ? (
              <p>{publication.abstract}</p>
            ) : (
              <p className="no-abstract-text">No abstract provided for this publication record.</p>
            )}
          </div>
        </div>

        {/* Citation Generator Section */}
        <div className="pub-modal-citation-section">
          <div className="citation-header">
            <h3>
              <Quote size={16} /> Academic Citations
            </h3>

            {/* Citation Format Switcher */}
            <div className="citation-format-tabs" role="tablist">
              {(['apa', 'ieee', 'mla', 'bibtex'] as CitationStyle[]).map(style => (
                <button
                  key={style}
                  type="button"
                  className={`citation-tab-pill ${selectedCitationStyle === style ? 'active' : ''}`}
                  onClick={() => setSelectedCitationStyle(style)}
                >
                  {style.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="citation-actions">
              <button 
                type="button" 
                className="citation-copy-btn"
                onClick={() => copyToClipboard(getCurrentCitationText(), selectedCitationStyle)}
                title={`Copy ${selectedCitationStyle.toUpperCase()} citation to clipboard`}
              >
                {copiedType === selectedCitationStyle ? (
                  <>
                    <Check size={14} /> Copied!
                  </>
                ) : (
                  <>
                    <Copy size={14} /> Copy Citation
                  </>
                )}
              </button>

              {selectedCitationStyle === 'bibtex' && (
                <button 
                  type="button" 
                  className="citation-copy-btn secondary"
                  onClick={downloadBibtexFile}
                  title="Download .bib file"
                >
                  <Download size={14} /> Download .bib
                </button>
              )}
            </div>
          </div>

          <div className="citation-preview-box">
            <code>{getCurrentCitationText()}</code>
          </div>
        </div>

        {/* Owner Info & Timestamps */}
        <div className="pub-modal-footer-meta">
          <span>Cataloged by <strong>{publication.ownerName || 'Researcher'}</strong></span>
          <span>Added on {new Date(publication.createdAt).toLocaleDateString()}</span>
        </div>

        {/* Owner Actions */}
        {isOwner && (
          <div className="pub-modal-owner-actions">
            {onToggleVisibility && (
              <button 
                type="button" 
                className="pub-action-btn vis-toggle-btn"
                onClick={() => onToggleVisibility(publication.id, publication.visibility)}
                id="btn-modal-toggle-visibility"
              >
                <Shield size={15} /> Toggle to {publication.visibility === 'Public' ? 'Private' : 'Public'}
              </button>
            )}
            {onEdit && (
              <button 
                type="button" 
                className="pub-action-btn edit-btn"
                onClick={() => {
                  onClose();
                  onEdit(publication);
                }}
                id="btn-modal-edit-pub"
              >
                <Edit3 size={15} /> Edit Publication
              </button>
            )}
            {onDelete && (
              <button 
                type="button" 
                className="pub-action-btn delete-btn"
                onClick={() => {
                  if (window.confirm('Are you sure you want to delete this publication record?')) {
                    onClose();
                    onDelete(publication.id);
                  }
                }}
                id="btn-modal-delete-pub"
              >
                <Trash2 size={15} /> Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicationDetailsModal;
