import { useAuth } from '../../context/AuthContext';
import { usePortfolio } from '../../hooks/usePortfolio';
import { Link } from 'react-router-dom';
import './Dashboard.css';

export default function Overview() {
  const { user } = useAuth();
  const { items, loading } = usePortfolio();

  const published = items.filter(i => i.status === 'published').length;
  const drafts = items.filter(i => i.status === 'draft').length;

  return (
    <div className="page">
      <h1 className="page-title">Welcome, {user?.name || user?.username}</h1>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-number">{loading ? '...' : items.length}</div>
          <div className="stat-label">Total Items</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{loading ? '...' : published}</div>
          <div className="stat-label">Published</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{loading ? '...' : drafts}</div>
          <div className="stat-label">Drafts</div>
        </div>
      </div>

      <div className="quick-actions">
        <Link to="/dashboard/upload" className="action-btn">Upload New Work</Link>
        <Link to="/dashboard/portfolio" className="action-btn-outline">Manage Portfolio</Link>
        <Link to="/dashboard/profile" className="action-btn-outline">Edit Profile</Link>
      </div>
    </div>
  );
}
