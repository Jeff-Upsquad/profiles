import { useState, useEffect } from 'react';
import api from '../services/api';
import './Admin.css';

export default function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/admin/stats').then(res => setStats(res.data)).catch(() => {});
  }, []);

  if (!stats) return <div>Loading...</div>;

  return (
    <div>
      <h1 className="admin-page-title">Dashboard</h1>
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-num">{stats.totalUsers}</div>
          <div className="admin-stat-label">Total Users</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-num">{stats.activeUsers}</div>
          <div className="admin-stat-label">Active Users</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-num">{stats.suspendedUsers}</div>
          <div className="admin-stat-label">Suspended</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-num">{stats.totalPortfolioItems}</div>
          <div className="admin-stat-label">Portfolio Items</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-num">{stats.totalCategories}</div>
          <div className="admin-stat-label">Categories</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-num">{stats.totalTypes}</div>
          <div className="admin-stat-label">Types</div>
        </div>
      </div>
    </div>
  );
}
