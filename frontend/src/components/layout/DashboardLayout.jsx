import { useState } from 'react';
import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './DashboardLayout.css';

export default function DashboardLayout() {
  const { user, loading, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  if (loading) return <div className="dash-loading">Loading...</div>;
  if (!user) return <Navigate to="/login" />;

  return (
    <div className="dash-wrapper">
      <aside className={`dash-sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="dash-sidebar-header">
          <NavLink to="/" className="dash-logo">
            <span className="dash-logo-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
            </span>
            {!collapsed && <span className="dash-logo-text">Profiles</span>}
          </NavLink>
          <button className="dash-collapse-btn" onClick={() => setCollapsed(!collapsed)} title={collapsed ? 'Expand' : 'Collapse'}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {collapsed ? (
                <polyline points="9 18 15 12 9 6" />
              ) : (
                <polyline points="15 18 9 12 15 6" />
              )}
            </svg>
          </button>
        </div>

        <nav className="dash-nav">
          {!collapsed && <div className="dash-nav-label">Main</div>}
          <NavLink to="/dashboard" end className={({ isActive }) => `dash-nav-link ${isActive ? 'active' : ''}`} title="Overview">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            {!collapsed && <span>Overview</span>}
          </NavLink>
          <NavLink to="/dashboard/portfolio" className={({ isActive }) => `dash-nav-link ${isActive ? 'active' : ''}`} title="Portfolio">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            {!collapsed && <span>Portfolio</span>}
          </NavLink>
          <NavLink to="/dashboard/upload" className={({ isActive }) => `dash-nav-link ${isActive ? 'active' : ''}`} title="Upload">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            {!collapsed && <span>Upload</span>}
          </NavLink>

          {!collapsed && <div className="dash-nav-label">Account</div>}
          <NavLink to="/dashboard/profile" className={({ isActive }) => `dash-nav-link ${isActive ? 'active' : ''}`} title="Profile">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            {!collapsed && <span>Profile</span>}
          </NavLink>
          <NavLink to={`/${user.username}`} className="dash-nav-link" title="Public Profile">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            {!collapsed && <span>Public Profile</span>}
          </NavLink>
        </nav>

        <div className="dash-sidebar-footer">
          <button onClick={logout} className="dash-nav-link dash-logout-btn" title="Logout">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>
      <main className={`dash-main ${collapsed ? 'expanded' : ''}`}>
        <Outlet />
      </main>
    </div>
  );
}
