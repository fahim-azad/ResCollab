import React, { useEffect, useState } from 'react';
import { Bell, Check, CheckCircle, Clock } from 'lucide-react';
import './NotificationsPage.css';

interface NotificationDto {
  id: number;
  title: string;
  message: string;
  type: string | null;
  relatedEntityId: number | null;
  isRead: boolean;
  createdAt: string;
}

const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/notification', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setNotifications(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAsRead = async (id: number) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/notification/${id}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/notification/read-all`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="notifications-container animate-fade-in">
      <div className="notifications-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Bell size={28} color="var(--brand-navy)" />
          <h1 style={{ margin: 0, color: 'var(--brand-navy)' }}>Notifications Center</h1>
        </div>
        
        {unreadCount > 0 && (
          <button className="mark-all-btn" onClick={handleMarkAllAsRead}>
            <CheckCircle size={16} /> Mark All as Read
          </button>
        )}
      </div>

      <div className="notifications-summary">
        You have <strong>{unreadCount}</strong> unread {unreadCount === 1 ? 'notification' : 'notifications'}.
      </div>

      {loading ? (
        <div style={{ padding: '2rem' }}>Loading notifications...</div>
      ) : notifications.length === 0 ? (
        <div className="empty-notifications">
          <Bell size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
          <h3>All caught up!</h3>
          <p>You have no notifications at the moment.</p>
        </div>
      ) : (
        <div className="notifications-list">
          {notifications.map(n => (
            <div key={n.id} className={`notification-card ${n.isRead ? 'read' : 'unread'}`}>
              {!n.isRead && <div className="unread-dot"></div>}
              <div className="notification-content">
                <h3>{n.title}</h3>
                <p>{n.message}</p>
                <div className="notification-meta">
                  <Clock size={12} /> {new Date(n.createdAt).toLocaleString()}
                </div>
              </div>
              {!n.isRead && (
                <button className="read-btn" onClick={() => handleMarkAsRead(n.id)} title="Mark as read">
                  <Check size={18} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
