import React, { useState } from 'react';
import { 
  X, BookOpen, ExternalLink, Calendar, Users, 
  Copy, Check, FileText, Globe, Lock, Shield, 
  Edit3, Trash2, Link as LinkIcon, Quote 
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

export const PublicationDetailsModal: React.FC<PublicationDetailsModalProps> = ({
  publication,
  isOwner,
  onClose,
  onEdit,
  onDelete,
  onToggleVisibility,
}) => {
  const [copiedType, setCopiedType] = useState<'doi' | 'apa' | 'bibtex' | null>(null);

  const getDoiUrl = (doi: string) => {
    return doi.startsWith('http') ? doi : `https://doi.org/${doi}`;
  };

  // Generate APA Citation
  const generateApaCitation = () => {
    const authors = publication.authors;
    const year = publication.publicationYear;
    const title = publication.title;
    const venue = publication.journalOrConference ? `*${publication.journalOrConference}*` : '';
    const doi = publication.doi ? ` https://doi.org/${publication.doi}` : '';
    return `${authors} (${year}). ${title}. ${venue}.${doi}`.trim();
  };

  // Generate BibTeX
  const generateBibtex = () => {
    const firstAuthor = publication.authors.split(',')[0].trim().replace(/\s+/g, '');
    const key = `${firstAuthor}${publication.publicationYear}`;
    const type = publication.publicationType.toLowerCase() === 'conference' ? 'inproceedings' : 'article';
    return `@${type}{${key},
  title={${publication.title}},
  author={${publication.authors}},
  year={${publication.publicationYear}},
  ${publication.journalOrConference ? `journal={${publication.journalOrConference}},` : ''}
  ${publication.doi ? `doi={${publication.doi}},` : ''}
  ${publication.sourceLink ? `url={${publication.sourceLink}}` : ''}
}`;
  };

  const copyToClipboard = (text: string, type: 'doi' | 'apa' | 'bibtex') => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2500);
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
              <strong>Venue:</strong> {publication.journalOrConference}
            </div>
          </div>
        )}

        {/* Links: DOI & Source Link */}
        <div className="pub-modal-links-row">
          {publication.doi && (
            <div className="pub-link-item doi-item">
              <span className="link-label">DOI:</span>
              <a 
                href={getDoiUrl(publication.doi)} 
                target="_blank" 
                rel="noreferrer" 
                className="doi-link"
                id={`link-doi-${publication.id}`}
              >
                {publication.doi} <ExternalLink size={13} />
              </a>
              <button 
                type="button" 
                className="icon-copy-btn" 
                title="Copy DOI"
                onClick={() => copyToClipboard(publication.doi!, 'doi')}
              >
                {copiedType === 'doi' ? <Check size={14} className="copied-icon" /> : <Copy size={14} />}
              </button>
            </div>
          )}

          {publication.sourceLink && (
            <div className="pub-link-item source-item">
              <span className="link-label">Full Text / Source:</span>
              <a 
                href={publication.sourceLink} 
                target="_blank" 
                rel="noreferrer" 
                className="source-link-btn"
                id={`link-source-${publication.id}`}
              >
                <LinkIcon size={14} /> Open Paper Source <ExternalLink size={13} />
              </a>
            </div>
          )}
        </div>

        {/* Abstract Section */}
        <div className="pub-modal-abstract-section">
          <h3>
            <FileText size={16} /> Abstract
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
              <Quote size={16} /> Citation Generator
            </h3>
            <div className="citation-actions">
              <button 
                type="button" 
                className="citation-copy-btn"
                onClick={() => copyToClipboard(generateApaCitation(), 'apa')}
              >
                {copiedType === 'apa' ? (
                  <>
                    <Check size={14} /> Copied APA
                  </>
                ) : (
                  <>
                    <Copy size={14} /> Copy APA
                  </>
                )}
              </button>
              <button 
                type="button" 
                className="citation-copy-btn secondary"
                onClick={() => copyToClipboard(generateBibtex(), 'bibtex')}
              >
                {copiedType === 'bibtex' ? (
                  <>
                    <Check size={14} /> Copied BibTeX
                  </>
                ) : (
                  <>
                    <Copy size={14} /> Copy BibTeX
                  </>
                )}
              </button>
            </div>
          </div>
          <div className="citation-preview-box">
            <code>{generateApaCitation()}</code>
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
