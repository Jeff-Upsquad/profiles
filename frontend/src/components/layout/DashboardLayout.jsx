import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Navbar from './Navbar';
import './DashboardLayout.css';

export default function DashboardLayout() {
  const { user, loading } = useAuth();

  if (loading) return <div className="loading">Loading...</div>;
  if (!user) return <Navigate to="/login" />;

  return (
    <div className="dashboard-wrapper">
      <Navbar />
      <div className="dashboard-container">
        <aside className="dashboard-sidebar">
          <nav className="sidebar-nav">
            <NavLink to="/dashboard" end className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              Overview
            </NavLink>
            <NavLink to="/dashboard/portfolio" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              My Portfolio
            </NavLink>
            <NavLink to="/dashboard/upload" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              Upload
            </NavLink>
            <NavLink to="/dashboard/profile" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              Edit Profile
            </NavLink>
          </nav>
        </aside>
        <main className="dashboard-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
