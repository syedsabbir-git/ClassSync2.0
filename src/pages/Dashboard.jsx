// src/pages/Dashboard.jsx - Updated with React Router nested routes
import React from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import DashboardLayout from '../components/dashboard/Layout/DashboardLayout';
import OverviewPage from '../components/dashboard/Overview/OverviewPage';
import ActivitiesPage from '../components/dashboard/Activities/ActivitiesPage';
import CalendarPage from '../components/dashboard/Calendar/CalendarPage';
import StudentsPage from '../components/dashboard/Students/StudentsPage';
import SettingsPage from '../components/dashboard/Settings/SettingsPage';
import AnnouncementsPage from '../components/dashboard/Announcements/AnnouncementsPage';
import PollsPage from '../components/dashboard/Polls/PollsPage';
import ResourcesPage from '../components/dashboard/Resources/ResourcesPage';

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userRole } = useAuth();
  const isCR = userRole === 'cr';

  // Get current page from URL
  const currentPath = location.pathname.split('/').pop() || 'overview';
  const currentPage = currentPath === 'dashboard' ? 'overview' : currentPath;

  // Handle navigation from sidebar and components
  const handleNavigation = (page) => {
    console.log('Navigating to:', page);
    navigate(`/dashboard/${page}`);
  };

  return (
    <DashboardLayout 
      currentPage={currentPage}
      onNavigate={handleNavigation}
    >
      <Routes>
        <Route index element={<Navigate to="overview" replace />} />
        <Route path="overview" element={<OverviewPage onNavigate={handleNavigation} />} />
        <Route path="activities" element={<ActivitiesPage onNavigate={handleNavigation} />} />
        <Route path="calendar" element={<CalendarPage onNavigate={handleNavigation} />} />
        <Route path="students" element={isCR ? <StudentsPage onNavigate={handleNavigation} /> : <Navigate to="/dashboard/overview" replace />} />
        <Route path="announcements" element={<AnnouncementsPage onNavigate={handleNavigation} />} />
        <Route path="polls" element={<PollsPage onNavigate={handleNavigation} />} />
        <Route path="resources" element={<ResourcesPage onNavigate={handleNavigation} />} />
        <Route path="settings" element={<SettingsPage onNavigate={handleNavigation} />} />
        <Route path="*" element={<Navigate to="overview" replace />} />
      </Routes>
    </DashboardLayout>
  );
};

export default Dashboard;
