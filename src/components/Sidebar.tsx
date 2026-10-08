import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, Search, User, Folder, Bookmark, MessageSquare, Settings, LogOut, Users, UsersRound, Lightbulb, Shield, Globe, Bell } from 'lucide-react';
import logo from '../assets/ResCollab-logo.png';
import './DashboardLayout.css';

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const res = await fetch('http://localhost:5000/api/notification/unread-count', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.count);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchUnread();
    
    // Poll every 30s
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <img src={logo} alt="ResCollab Logo" />
      </div>
      
      <nav className="nav-menu">
        {/* We use NavLink so the active class is added automatically by react-router */}
        <NavLink to="/home" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
          <Home size={20} /> Home
        </NavLink>
        <NavLink to="/search" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
          <Search size={20} /> Search
        </NavLink>
        <NavLink to="/profile" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
          <User size={20} /> Profile
        </NavLink>
        <NavLink to="/network" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
          <Globe size={20} /> My Network
        </NavLink>
        <NavLink to="/supervisors" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
          <Users size={20} /> Supervisors
        </NavLink>
        <NavLink to="/teammates" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
          <UsersRound size={20} /> Teammates
        </NavLink>
        <NavLink to="/ideas" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
          <Lightbulb size={20} /> Ideas
        </NavLink>
        <NavLink to="/projects" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
          <Folder size={20} /> Projects
        </NavLink>
        <NavLink to="/workspaces" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
          <Shield size={20} /> Workspaces
        </NavLink>
        <NavLink to="/saved" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
          <Bookmark size={20} /> Saved
        </NavLink>
        <NavLink to="/notifications" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
              <Bell size={20} /> Notifications
            </span>
            {unreadCount > 0 && (
              <span className="unread-badge" style={{ background: '#ef4444', color: '#fff', fontSize: '0.75rem', padding: '0.1rem 0.5rem', borderRadius: '10px', fontWeight: 'bold' }}>
                {unreadCount}
              </span>
            )}
          </div>
        </NavLink>
        <NavLink to="/messages" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
          <MessageSquare size={20} /> Messages
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
          <Settings size={20} /> Settings
        </NavLink>
      </nav>
      
      <div className="sidebar-quote">
        "Research connects minds and builds a better tomorrow."
      </div>

      <button onClick={handleLogout} className="nav-item" style={{ marginTop: '1rem', border: 'none', background: 'transparent', width: '100%', cursor: 'pointer' }}>
        <LogOut size={20} /> Log Out
      </button>
    </aside>
  );
};

export default Sidebar;
