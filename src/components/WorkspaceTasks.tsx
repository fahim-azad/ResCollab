import React, { useEffect, useState } from 'react';
import { Plus, CheckCircle, Clock, Flag, User as UserIcon, MessageSquare } from 'lucide-react';

interface FeedbackDto {
  id: number;
  workspaceTaskId: number;
  givenById: number;
  givenByName: string;
  content: string;
  statusChange: string | null;
  createdAt: string;
}

interface MemberDto {
  userId: number;
  userName: string;
}

interface TaskDto {
  id: number;
  title: string;
  description: string;
  status: string;
  dueDate: string | null;
  isMilestone: boolean;
  assignedToName: string;
}

interface WorkspaceTasksProps {
  workspaceId: number;
  members: MemberDto[];
}

const WorkspaceTasks: React.FC<WorkspaceTasksProps> = ({ workspaceId, members }) => {
  const [tasks, setTasks] = useState<TaskDto[]>([]);
  const [loading, setLoading] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'Todo',
    assignedToId: '',
    dueDate: '',
    isMilestone: false
  });

  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [selectedTaskForFeedback, setSelectedTaskForFeedback] = useState<TaskDto | null>(null);
  const [feedbacks, setFeedbacks] = useState<FeedbackDto[]>([]);
  const [newFeedbackContent, setNewFeedbackContent] = useState('');
  const [newFeedbackStatus, setNewFeedbackStatus] = useState('');

  useEffect(() => {
    fetchTasks();
  }, [workspaceId]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/workspaces/${workspaceId}/tasks`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setTasks(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      
      const payload = {
        title: formData.title,
        description: formData.description,
        status: formData.status,
        isMilestone: formData.isMilestone,
        assignedToId: formData.assignedToId ? parseInt(formData.assignedToId) : null,
        dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : null
      };

      const res = await fetch(`http://localhost:5000/api/workspaces/${workspaceId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        setIsModalOpen(false);
        setFormData({ title: '', description: '', status: 'Todo', assignedToId: '', dueDate: '', isMilestone: false });
        fetchTasks();
      } else {
        alert("Failed to create task");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleStatusChange = async (taskId: number, newStatus: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/workspaces/${workspaceId}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        fetchTasks();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openFeedbackModal = async (task: TaskDto) => {
    setSelectedTaskForFeedback(task);
    setNewFeedbackContent('');
    setNewFeedbackStatus('');
    setIsFeedbackModalOpen(true);
    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/workspaces/${workspaceId}/tasks/${task.id}/feedback`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setFeedbacks(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const submitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskForFeedback) return;
    try {
      const token = localStorage.getItem('token');
      const payload = {
        content: newFeedbackContent,
        statusChange: newFeedbackStatus || null
      };

      const res = await fetch(`http://localhost:5000/api/workspaces/${workspaceId}/tasks/${selectedTaskForFeedback.id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        setNewFeedbackContent('');
        setNewFeedbackStatus('');
        
        const refreshRes = await fetch(`http://localhost:5000/api/workspaces/${workspaceId}/tasks/${selectedTaskForFeedback.id}/feedback`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (refreshRes.ok) setFeedbacks(await refreshRes.json());
        
        fetchTasks();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Todo': return '#cbd5e1';
      case 'InProgress': return '#38bdf8';
      case 'Done': return '#34d399';
      default: return '#cbd5e1';
    }
  };

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'Done').length;
  const progressPercent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  return (
    <div className="workspace-tasks-tab animate-fade-in" style={{ padding: '2rem 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <h3>Tasks & Milestones</h3>
        <button className="create-btn" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} /> New Task
        </button>
      </div>

      {/* Progress Overview */}
      <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '12px', border: '1px solid #eee', marginBottom: '2rem', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem', alignItems: 'flex-end' }}>
          <div>
            <h4 style={{ margin: 0, color: 'var(--brand-navy)' }}>Project Progress Overview</h4>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.9rem', color: '#666' }}>{completedTasks} of {totalTasks} tasks completed</p>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--brand-blue)' }}>
            {progressPercent}%
          </div>
        </div>
        <div style={{ width: '100%', height: '10px', background: '#f1f5f9', borderRadius: '5px', overflow: 'hidden' }}>
          <div style={{ width: `${progressPercent}%`, height: '100%', background: 'linear-gradient(90deg, var(--brand-blue), #38bdf8)', transition: 'width 0.5s ease-out' }}></div>
        </div>
      </div>

      {loading ? (
        <p>Loading tasks...</p>
      ) : tasks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', background: '#f8fafc', borderRadius: '12px' }}>
          <CheckCircle size={48} color="#cbd5e1" style={{ marginBottom: '1rem' }} />
          <p style={{ color: '#64748b' }}>No tasks created yet. Stay organized by adding your first task!</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {tasks.map(task => (
            <div key={task.id} style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              padding: '1.2rem', 
              background: '#fff', 
              borderRadius: '8px', 
              borderLeft: `4px solid ${getStatusColor(task.status)}`,
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                  {task.isMilestone && <Flag size={14} color="#f59e0b" />}
                  <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--brand-navy)' }}>{task.title}</h4>
                </div>
                {task.description && <p style={{ margin: '0 0 0.8rem 0', color: '#666', fontSize: '0.9rem' }}>{task.description}</p>}
                
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', color: '#888' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><UserIcon size={14} /> {task.assignedToName}</span>
                  {task.dueDate && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Clock size={14} /> Due {new Date(task.dueDate).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button 
                  onClick={() => openFeedbackModal(task)}
                  style={{ background: 'transparent', border: '1px solid #e2e8f0', padding: '0.4rem 0.6rem', borderRadius: '6px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem', fontWeight: 500 }}
                >
                  <MessageSquare size={14} /> Feedback
                </button>
                <select 
                  value={task.status} 
                  onChange={(e) => handleStatusChange(task.id, e.target.value)}
                  style={{ 
                    padding: '0.5rem', 
                    borderRadius: '6px', 
                    border: '1px solid #e2e8f0', 
                    background: '#f8fafc',
                    fontWeight: 600,
                    color: getStatusColor(task.status)
                  }}
                >
                  <option value="Todo">To Do</option>
                  <option value="InProgress">In Progress</option>
                  <option value="Done">Done</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="modal-overlay animate-fade-in">
          <div className="modal-content animate-slide-up">
            <div className="modal-header">
              <h2>Create Task or Milestone</h2>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>✕</button>
            </div>
            
            <form onSubmit={handleCreateSubmit}>
              <div className="form-group">
                <label>Task Title *</label>
                <input type="text" className="neo-input" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
              </div>
              
              <div className="form-group">
                <label>Description</label>
                <textarea className="neo-input" rows={2} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}></textarea>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Assign To</label>
                  <select className="neo-input" value={formData.assignedToId} onChange={e => setFormData({...formData, assignedToId: e.target.value})}>
                    <option value="">-- Unassigned --</option>
                    {members.map(m => (
                      <option key={m.userId} value={m.userId}>{m.userName}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Due Date</label>
                  <input type="date" className="neo-input" value={formData.dueDate} onChange={e => setFormData({...formData, dueDate: e.target.value})} />
                </div>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginTop: '1rem' }}>
                  <input type="checkbox" checked={formData.isMilestone} onChange={e => setFormData({...formData, isMilestone: e.target.checked})} style={{ width: '1.2rem', height: '1.2rem' }} />
                  <strong>Mark as Major Milestone</strong>
                </label>
              </div>
              
              <div className="modal-footer">
                <button type="button" className="cancel-btn" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="create-btn" style={{background: 'var(--brand-navy)'}}>Save Task</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isFeedbackModalOpen && selectedTaskForFeedback && (
        <div className="modal-overlay animate-fade-in">
          <div className="modal-content animate-slide-up" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>Feedback: {selectedTaskForFeedback.title}</h2>
              <button className="close-btn" onClick={() => setIsFeedbackModalOpen(false)}>✕</button>
            </div>
            
            <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '1.5rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px' }}>
              {feedbacks.length === 0 ? (
                <p style={{ color: '#888', textAlign: 'center', margin: '2rem 0' }}>No feedback yet.</p>
              ) : (
                feedbacks.map(f => (
                  <div key={f.id} style={{ background: '#fff', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #eee' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <strong style={{ color: 'var(--brand-navy)' }}>{f.givenByName}</strong>
                      <span style={{ fontSize: '0.8rem', color: '#888' }}>{new Date(f.createdAt).toLocaleString()}</span>
                    </div>
                    <p style={{ margin: '0 0 0.5rem 0', color: '#444' }}>{f.content}</p>
                    {f.statusChange && (
                      <span style={{ fontSize: '0.8rem', background: '#e0f2fe', color: '#0284c7', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                        Changed status to: {f.statusChange}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>

            <form onSubmit={submitFeedback} style={{ borderTop: '1px solid #eee', paddingTop: '1.5rem' }}>
              <div className="form-group">
                <label>Add Feedback</label>
                <textarea className="neo-input" rows={3} required placeholder="Write your feedback..." value={newFeedbackContent} onChange={e => setNewFeedbackContent(e.target.value)}></textarea>
              </div>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label>Update Status (Optional)</label>
                <select className="neo-input" value={newFeedbackStatus} onChange={e => setNewFeedbackStatus(e.target.value)}>
                  <option value="">-- No change --</option>
                  <option value="Todo">To Do</option>
                  <option value="InProgress">In Progress</option>
                  <option value="Done">Done</option>
                </select>
              </div>
              <div className="modal-footer">
                <button type="submit" className="create-btn" style={{background: 'var(--brand-blue)'}}>Post Feedback</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkspaceTasks;
