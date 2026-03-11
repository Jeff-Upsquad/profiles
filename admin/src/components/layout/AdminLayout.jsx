import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './AdminLayout.css';

export default function AdminLayout() {
  const { user, loading, logout } = useAuth();

  if (loading) return <div className="admin-loading">Loading...</div>;
  if (!user) return <Navigate to="/login" />;

  return (
    <div className="admin-wrapper">
      <aside className="admin-sidebar">
        <div className="admin-brand">Admin Panel</div>
        <nav className="admin-nav">
          <NavLink to="/" end className={({ isActive }) => `admin-link ${isActive ? 'active' : ''}`}>
            Dashboard
          </NavLink>
          <NavLink to="/users" className={({ isActive }) => `admin-link ${isActive ? 'active' : ''}`}>
            Users
          </NavLink>
          <NavLink to="/portfolios" className={({ isActive }) => `admin-link ${isActive ? 'active' : ''}`}>
            Portfolios
          </NavLink>
          <NavLink to="/categories" className={({ isActive }) => `admin-link ${isActive ? 'active' : ''}`}>
            Categories
          </NavLink>
          <NavLink to="/types" className={({ isActive }) => `admin-link ${isActive ? 'active' : ''}`}>
            Types
          </NavLink>
        </nav>
        <button onClick={logout} className="admin-logout">Logout</button>
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}