import { useState, useEffect } from 'react';
import api from '../../services/api';
import '../Admin.css';

export default function Portfolios() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1 });

  const fetchItems = async (page = 1) => {
    try {
      setLoading(true);
      const res = await api.get('/admin/portfolios', { params: { search, page, limit: 20 } });
      setItems(res.data.items);
      setPagination(res.data.pagination);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchItems(); }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchItems(1);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this portfolio item?')) return;
    try {
      await api.delete(`/admin/portfolios/${id}`);
      setItems(prev => prev.filter(i => i._id !== id));
    } catch (err) {
      alert('Failed to delete');
    }
  };

  return (
    <div>
      <h1 className="admin-page-title">Portfolios</h1>

      <form onSubmit={handleSearch} className="admin-search">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by title..."
          className="admin-search-input"
        />
        <button type="submit" className="admin-btn">Search</button>
      </form>

      {loading ? <p>Loading...</p> : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>User</th>
                <th>Category</th>
                <th>Type</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item._id}>
                  <td>{item.title}</td>
                  <td>{item.user?.username || 'N/A'}</td>
                  <td>{item.category?.name || '-'}</td>
                  <td>{item.type?.name || '-'}</td>
                  <td><span className={`status-badge-admin ${item.status}`}>{item.status}</span></td>
                  <td>
                    <button onClick={() => handleDelete(item._id)} className="admin-btn-sm danger">
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
                  onClick={() => fetchItems(i + 1)}
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
