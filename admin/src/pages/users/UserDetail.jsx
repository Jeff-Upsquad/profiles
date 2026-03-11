import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import '../Admin.css';

export default function UserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.get(`/admin/users/${id}`).then(res => {
      setUser(res.data.user);
      setForm({
        name: res.data.user.name || '',
        bio: res.data.user.bio || '',
        location: res.data.user.location || '',
        role: res.data.user.role,
        status: res.data.user.status,
        skills: res.data.user.skills?.join(', ') || '',
      });
    }).catch(() => navigate('/users'));
  }, [id, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const payload = {
        ...form,
        skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
      };
      const res = await api.put(`/admin/users/${id}`, payload);
      setUser(res.data.user);
      setMessage('User updated successfully');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return <div>Loading...</div>;

  return (
    <div>
      <button onClick={() => navigate('/users')} className="admin-back-btn">&larr; Back to Users</button>
      <h1 className="admin-page-title">Edit User: {user.username}</h1>
      <p className="admin-page-sub">{user.email}</p>

      {message && <div className="admin-message">{message}</div>}

      <form onSubmit={handleSubmit} className="admin-form">
        <div className="form-group">
          <label>Name</label>
          <input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} />
        </div>
        <div className="form-group">
          <label>Bio</label>
          <textarea value={form.bio} onChange={e => setForm(p => ({...p, bio: e.target.value}))} rows={3} />
        </div>
        <div className="form-group">
          <label>Location</label>
          <input value={form.location} onChange={e => setForm(p => ({...p, location: e.target.value}))} />
        </div>
        <div className="form-group">
          <label>Skills (comma separated)</label>
          <input value={form.skills} onChange={e => setForm(p => ({...p, skills: e.target.value}))} />
        </div>
        <div className="admin-form-row">
          <div className="form-group">
            <label>Role</label>
            <select value={form.role} onChange={e => setForm(p => ({...p, role: e.target.value}))}>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="form-group">
            <label>Status</label>
            <select value={form.status} onChange={e => setForm(p => ({...p, status: e.target.value}))}>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>
        <button type="submit" className="admin-btn" disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}
