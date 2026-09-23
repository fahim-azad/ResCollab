import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import './DashboardLayout.css';

const DashboardLayout: React.FC = () => {
  return (
    <div className="dashboard-container">
      <Sidebar />
      <main className="main-area">
        <Outlet />
      </main>
    </div>
  );
};

export default DashboardLayout;
