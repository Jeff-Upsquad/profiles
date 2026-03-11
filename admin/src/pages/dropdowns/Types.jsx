import { useState, useEffect } from 'react';
import api from '../../services/api';
import '../Admin.css';

export default function Types() {
  const [types, setTypes] = useState([]);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  const fetchTypes = async () => {
    const res = await api.get('/admin/types');
    setTypes(res.data.types);
  };

  useEffect(() => { fetchTypes(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await api.post('/admin/types', { name: newName.trim() });
      setNewName('');
      fetchTypes();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add type');
    }
  };

  const handleUpdate = async (id) => {
    if (!editName.trim()) return;
    try {
      await api.put(`/admin/types/${id}`, { name: editName.trim() });
      setEditingId(null);
      fetchTypes();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this type?')) return;
    try {
      await api.delete(`/admin/types/${id}`);
      fetchTypes();
    } catch (err) {
      alert('Failed to delete');
    }
  };

  return (
    <div>
      <h1 className="admin-page-title">Types</h1>

      <form onSubmit={handleAdd} className="admin-inline-form">
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="New type name"
          className="admin-search-input"
        />
        <button type="submit" className="admin-btn">Add</button>
      </form>

      <div className="admin-list">
        {types.map(t => (
          <div key={t._id} className="admin-list-item">
            {editingId === t._id ? (
              <div className="admin-edit-row">
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="admin-edit-input"
                />
                <button onClick={() => handleUpdate(t._id)} className="admin-btn-sm">Save</button>
                <button onClick={() => setEditingId(null)} className="admin-btn-sm secondary">Cancel</button>
              </div>
            ) : (
              <div className="admin-item-row">
                <span className="admin-item-name">{t.name}</span>
                <span className="admin-item-slug">{t.slug}</span>
                <div className="admin-item-actions">
                  <button onClick={() => { setEditingId(t._id); setEditName(t.name); }} className="admin-btn-sm">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(t._id)} className="admin-btn-sm danger">
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
