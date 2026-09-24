import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import ProfilePage from './components/ProfilePage';
import SearchPage from './components/SearchPage';
import DashboardLayout from './components/DashboardLayout';
import ProtectedRoute from './components/ProtectedRoute';
import SupervisorRecommendations from './components/SupervisorRecommendations';
import TeammateRecommendations from './components/TeammateRecommendations';
import IdeaMarketplace from './components/IdeaMarketplace';
import ProjectMarketplace from './components/ProjectMarketplace';
import './index.css';

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/supervisors" element={<SupervisorRecommendations />} />
            <Route path="/teammates" element={<TeammateRecommendations />} />
            <Route path="/ideas" element={<IdeaMarketplace />} />
            <Route path="/projects" element={<ProjectMarketplace />} />
          </Route>
        </Route>
      </Routes>
    </Router>
  );
};

export default App;
