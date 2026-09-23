import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, Search, User, Folder, Bookmark, MessageSquare, Settings, LogOut } from 'lucide-react';
import logo from '../assets/ResCollab-logo.png';
import './DashboardLayout.css';

const Sidebar: React.FC = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
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
        <NavLink to="/projects" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
          <Folder size={20} /> Projects
        </NavLink>
        <NavLink to="/saved" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
          <Bookmark size={20} /> Saved
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
