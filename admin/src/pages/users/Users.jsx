import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import '../Admin.css';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1 });

  const fetchUsers = async (page = 1) => {
    try {
      setLoading(true);
      const res = await api.get('/admin/users', { params: { search, page, limit: 20 } });
      setUsers(res.data.users);
      setPagination(res.data.pagination);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchUsers(1);
  };

  const handleStatusToggle = async (userId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    try {
      await api.put(`/admin/users/${userId}/status`, { status: newStatus });
      setUsers(prev => prev.map(u => u._id === userId ? { ...u, status: newStatus } : u));
    } catch (err) {
      alert('Failed to update status');
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('Delete this user and all their data? This cannot be undone.')) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      setUsers(prev => prev.filter(u => u._id !== userId));
    } catch (err) {
      alert('Failed to delete user');
    }
  };

  return (
    <div>
      <h1 className="admin-page-title">Users</h1>

      <form onSubmit={handleSearch} className="admin-search">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, username, or email..."
          className="admin-search-input"
        />
        <button type="submit" className="admin-btn">Search</button>
      </form>

      {loading ? <p>Loading...</p> : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Email</th>
                <th>Name</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user._id}>
                  <td><Link to={`/users/${user._id}`} className="table-link">{user.username}</Link></td>
                  <td>{user.email}</td>
                  <td>{user.name || '-'}</td>
                  <td><span className={`role-badge ${user.role}`}>{user.role}</span></td>
                  <td><span className={`status-badge-admin ${user.status}`}>{user.status}</span></td>
                  <td className="actions-cell">
                    <button onClick={() => handleStatusToggle(user._id, user.status)} className="admin-btn-sm">
                      {user.status === 'active' ? 'Suspend' : 'Activate'}
                    </button>
                    <button onClick={() => handleDelete(user._id)} className="admin-btn-sm danger">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {pagination.pages > 1 && (
            <div className="admin-pagination">
              {Array.from({ length: pagination.pages }, (_, i) => (
                <button
                  key={i + 1}
                  onClick={() => fetchUsers(i + 1)}
                  className={`page-btn ${pagination.page === i + 1 ? 'active' : ''}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
