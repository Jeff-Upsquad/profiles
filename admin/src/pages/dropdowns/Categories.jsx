import { useState, useEffect } from 'react';
import api from '../../services/api';
import '../Admin.css';

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  const fetchCategories = async () => {
    const res = await api.get('/admin/categories');
    setCategories(res.data.categories);
  };

  useEffect(() => { fetchCategories(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await api.post('/admin/categories', { name: newName.trim() });
      setNewName('');
      fetchCategories();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add category');
    }
  };

  const handleUpdate = async (id) => {
    if (!editName.trim()) return;
    try {
      await api.put(`/admin/categories/${id}`, { name: editName.trim() });
      setEditingId(null);
      fetchCategories();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this category?')) return;
    try {
      await api.delete(`/admin/categories/${id}`);
      fetchCategories();
    } catch (err) {
      alert('Failed to delete');
    }
  };

  return (
    <div>
      <h1 className="admin-page-title">Categories</h1>

      <form onSubmit={handleAdd} className="admin-inline-form">
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="New category name"
          className="admin-search-input"
        />
        <button type="submit" className="admin-btn">Add</button>
      </form>

      <div className="admin-list">
        {categories.map(cat => (
          <div key={cat._id} className="admin-list-item">
            {editingId === cat._id ? (
              <div className="admin-edit-row">
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="admin-edit-input"
                />
                <button onClick={() => handleUpdate(cat._id)} className="admin-btn-sm">Save</button>
                <button onClick={() => setEditingId(null)} className="admin-btn-sm secondary">Cancel</button>
              </div>
            ) : (
              <div className="admin-item-row">
                <span className="admin-item-name">{cat.name}</span>
                <span className="admin-item-slug">{cat.slug}</span>
                <div className="admin-item-actions">
                  <button onClick={() => { setEditingId(cat._id); setEditName(cat.name); }} className="admin-btn-sm">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(cat._id)} className="admin-btn-sm danger">
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
