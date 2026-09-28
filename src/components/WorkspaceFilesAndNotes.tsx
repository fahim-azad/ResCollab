import React, { useEffect, useState, useRef } from 'react';
import { FileText, File, Plus, Upload, Download, Edit3 } from 'lucide-react';

interface NoteDto {
  id: number;
  title: string;
  content: string;
  createdByName: string;
  updatedAt: string;
}

interface FileDto {
  id: number;
  fileName: string;
  fileUrl: string;
  fileSizeBytes: number;
  uploadedByName: string;
  uploadedAt: string;
}

interface WorkspaceFilesAndNotesProps {
  workspaceId: number;
}

const WorkspaceFilesAndNotes: React.FC<WorkspaceFilesAndNotesProps> = ({ workspaceId }) => {
  const [notes, setNotes] = useState<NoteDto[]>([]);
  const [files, setFiles] = useState<FileDto[]>([]);
  
  // Note Modal
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [noteForm, setNoteForm] = useState({ id: 0, title: '', content: '' });
  const [savingNote, setSavingNote] = useState(false);

  // File Upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchNotes();
    fetchFiles();
  }, [workspaceId]);

  const fetchNotes = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/workspaces/${workspaceId}/notes`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setNotes(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const fetchFiles = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/workspaces/${workspaceId}/files`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setFiles(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingNote(true);
    try {
      const token = localStorage.getItem('token');
      const url = noteForm.id === 0 
        ? `http://localhost:5000/api/workspaces/${workspaceId}/notes`
        : `http://localhost:5000/api/workspaces/${workspaceId}/notes/${noteForm.id}`;
      
      const method = noteForm.id === 0 ? 'POST' : 'PATCH';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ title: noteForm.title, content: noteForm.content })
      });
      
      if (res.ok) {
        setIsNoteModalOpen(false);
        fetchNotes();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingNote(false);
    }
  };

  const openNoteForEdit = (note: NoteDto) => {
    setNoteForm({ id: note.id, title: note.title, content: note.content });
    setIsNoteModalOpen(true);
  };

  const openNewNote = () => {
    setNoteForm({ id: 0, title: '', content: '' });
    setIsNoteModalOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`http://localhost:5000/api/workspaces/${workspaceId}/files`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }, // Do not set Content-Type, browser will set it to multipart/form-data with boundary
        body: formData
      });

      if (res.ok) {
        fetchFiles();
      } else {
        alert("File upload failed.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  };

  return (
    <div className="animate-fade-in" style={{ padding: '2rem 0', display: 'flex', gap: '3rem', flexWrap: 'wrap' }}>
      
      {/* Shared Notes Section */}
      <div style={{ flex: '1 1 400px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}><FileText size={20} color="var(--brand-blue)" /> Shared Notes</h3>
          <button className="create-btn" onClick={openNewNote} style={{ padding: '0.5rem 1rem' }}>
            <Plus size={16} /> New Note
          </button>
        </div>

        {notes.length === 0 ? (
          <div style={{ padding: '2rem', background: '#f8fafc', borderRadius: '12px', textAlign: 'center', color: '#888' }}>
            No notes yet. Create one to share context with your team.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {notes.map(note => (
              <div key={note.id} style={{ padding: '1.5rem', background: '#fff', borderRadius: '8px', border: '1px solid #eee', position: 'relative' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--brand-navy)' }}>{note.title}</h4>
                <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#444', whiteSpace: 'pre-wrap', maxHeight: '100px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {note.content}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#999', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                  <span>By {note.createdByName}</span>
                  <span>{new Date(note.updatedAt).toLocaleDateString()}</span>
                </div>
                
                <button 
                  onClick={() => openNoteForEdit(note)} 
                  style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
                >
                  <Edit3 size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Workspace Files Section */}
      <div style={{ flex: '1 1 400px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}><File size={20} color="var(--brand-blue)" /> Files</h3>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            onChange={handleFileUpload} 
          />
          <button className="create-btn" onClick={() => fileInputRef.current?.click()} style={{ padding: '0.5rem 1rem', background: '#e2e8f0', color: '#334155' }} disabled={uploading}>
            <Upload size={16} /> {uploading ? 'Uploading...' : 'Upload File'}
          </button>
        </div>

        {files.length === 0 ? (
          <div style={{ padding: '2rem', background: '#f8fafc', borderRadius: '12px', textAlign: 'center', color: '#888' }}>
            No files uploaded.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {files.map(file => (
              <div key={file.id} style={{ display: 'flex', alignItems: 'center', padding: '1rem', background: '#fff', borderRadius: '8px', border: '1px solid #eee' }}>
                <div style={{ background: '#f1f5f9', padding: '0.8rem', borderRadius: '8px', marginRight: '1rem' }}>
                  <File size={24} color="#64748b" />
                </div>
                <div style={{ flexGrow: 1 }}>
                  <h4 style={{ margin: '0 0 0.2rem 0', color: 'var(--brand-navy)' }}>{file.fileName}</h4>
                  <div style={{ fontSize: '0.8rem', color: '#888', display: 'flex', gap: '1rem' }}>
                    <span>{formatSize(file.fileSizeBytes)}</span>
                    <span>Uploaded by {file.uploadedByName}</span>
                  </div>
                </div>
                <a href={file.fileUrl} download style={{ color: 'var(--brand-blue)', textDecoration: 'none', padding: '0.5rem', background: '#f0f9ff', borderRadius: '6px' }}>
                  <Download size={18} />
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Note Modal */}
      {isNoteModalOpen && (
        <div className="modal-overlay animate-fade-in">
          <div className="modal-content animate-slide-up">
            <div className="modal-header">
              <h2>{noteForm.id === 0 ? 'Create Shared Note' : 'Edit Note'}</h2>
              <button className="close-btn" onClick={() => setIsNoteModalOpen(false)}>✕</button>
            </div>
            
            <form onSubmit={handleSaveNote}>
              <div className="form-group">
                <label>Title</label>
                <input type="text" className="neo-input" required value={noteForm.title} onChange={e => setNoteForm({...noteForm, title: e.target.value})} />
              </div>
              
              <div className="form-group">
                <label>Content</label>
                <textarea className="neo-input" rows={8} required value={noteForm.content} onChange={e => setNoteForm({...noteForm, content: e.target.value})} placeholder="Write down research ideas, meeting notes, etc."></textarea>
              </div>
              
              <div className="modal-footer">
                <button type="button" className="cancel-btn" onClick={() => setIsNoteModalOpen(false)}>Cancel</button>
                <button type="submit" className="create-btn" style={{background: 'var(--brand-navy)'}} disabled={savingNote}>
                  {savingNote ? 'Saving...' : 'Save Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default WorkspaceFilesAndNotes;
