import { useState } from 'react';
import { usePortfolio } from '../../hooks/usePortfolio';
import './Dashboard.css';

export default function Portfolio() {
  const { items, loading, updateItem, deleteItem } = usePortfolio();
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const startEdit = (item) => {
    setEditingId(item._id);
    setEditForm({ title: item.title, description: item.description });
  };

  const handleSave = async () => {
    try {
      await updateItem(editingId, editForm);
      setEditingId(null);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this item? This cannot be undone.')) return;
    try {
      await deleteItem(id);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete');
    }
  };

  if (loading) return <div className="page"><p>Loading...</p></div>;

  return (
    <div className="page">
      <h1 className="page-title">My Portfolio</h1>
      <p className="page-subtitle">{items.length} item(s)</p>

      {items.length === 0 ? (
        <div className="empty-state">
          <p>No portfolio items yet. Start by uploading your work!</p>
        </div>
      ) : (
        <div className="portfolio-grid">
          {items.map(item => (
            <div key={item._id} className="portfolio-card">
              <div className="portfolio-card-media">
                {item.fileType === 'image' ? (
                  <img src={`${import.meta.env.VITE_API_URL?.replace('/api', '')}${item.fileUrl}`} alt={item.title} />
                ) : (
                  <video src={`${import.meta.env.VITE_API_URL?.replace('/api', '')}${item.fileUrl}`} />
                )}
                <span className={`status-badge ${item.status}`}>{item.status}</span>
              </div>
              <div className="portfolio-card-body">
                {editingId === item._id ? (
                  <div className="edit-form">
                    <input
                      type="text"
                      value={editForm.title}
                      onChange={e => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Title"
                    />
                    <textarea
                      value={editForm.description}
                      onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Description"
                      rows={2}
                    />
                    <div className="edit-actions">
                      <button onClick={handleSave} className="btn-sm">Save</button>
                      <button onClick={() => setEditingId(null)} className="btn-sm-outline">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h3 className="card-title">{item.title}</h3>
                    {item.description && <p className="card-desc">{item.description}</p>}
                    {item.category && <span className="card-tag">{item.category.name}</span>}
                    <div className="card-actions">
                      <button onClick={() => startEdit(item)} className="btn-sm-outline">Edit</button>
                      <button onClick={() => handleDelete(item._id)} className="btn-sm-danger">Delete</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
