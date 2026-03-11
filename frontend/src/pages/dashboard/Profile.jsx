import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import './Dashboard.css';

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || '',
    bio: user?.bio || '',
    location: user?.location || '',
    skills: user?.skills?.join(', ') || '',
    socialLinks: {
      website: user?.socialLinks?.website || '',
      instagram: user?.socialLinks?.instagram || '',
      twitter: user?.socialLinks?.twitter || '',
      linkedin: user?.socialLinks?.linkedin || '',
      behance: user?.socialLinks?.behance || '',
      dribbble: user?.socialLinks?.dribbble || '',
    },
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('social.')) {
      const key = name.split('.')[1];
      setForm(prev => ({ ...prev, socialLinks: { ...prev.socialLinks, [key]: value } }));
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const payload = {
        name: form.name,
        bio: form.bio,
        location: form.location,
        skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
        socialLinks: form.socialLinks,
      };

      const res = await api.put('/users/profile', payload);
      updateUser(res.data.user);
      setMessage('Profile updated successfully');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleProfilePicture = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('profilePicture', file);

    try {
      const res = await api.put('/users/profile-picture', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      updateUser(res.data.user);
      setMessage('Profile picture updated');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update picture');
    }
  };

  return (
    <div className="page">
      <h1 className="page-title">Edit Profile</h1>

      {message && <div className="success-msg">{message}</div>}
      {error && <div className="error-msg">{error}</div>}

      <div className="profile-picture-section">
        <div className="profile-avatar">
          {user?.profilePicture ? (
            <img src={`${import.meta.env.VITE_API_URL?.replace('/api', '')}${user.profilePicture}`} alt="Profile" />
          ) : (
            <div className="avatar-placeholder">{user?.username?.[0]?.toUpperCase()}</div>
          )}
        </div>
        <label className="btn-sm-outline upload-label">
          Change Photo
          <input type="file" accept="image/*" onChange={handleProfilePicture} hidden />
        </label>
      </div>

      <form onSubmit={handleSubmit} className="profile-form">
        <div className="form-group">
          <label>Name</label>
          <input name="name" value={form.name} onChange={handleChange} placeholder="Your full name" />
        </div>

        <div className="form-group">
          <label>Bio</label>
          <textarea name="bio" value={form.bio} onChange={handleChange} placeholder="Tell people about yourself" rows={3} />
        </div>

        <div className="form-group">
          <label>Location</label>
          <input name="location" value={form.location} onChange={handleChange} placeholder="City, Country" />
        </div>

        <div className="form-group">
          <label>Skills (comma separated)</label>
          <input name="skills" value={form.skills} onChange={handleChange} placeholder="Graphic Design, Video Editing, Motion Graphics" />
        </div>

        <h3 className="section-title">Social Links</h3>

        <div className="form-row">
          <div className="form-group">
            <label>Website</label>
            <input name="social.website" value={form.socialLinks.website} onChange={handleChange} placeholder="https://..." />
          </div>
          <div className="form-group">
            <label>Instagram</label>
            <input name="social.instagram" value={form.socialLinks.instagram} onChange={handleChange} placeholder="@handle" />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Twitter / X</label>
            <input name="social.twitter" value={form.socialLinks.twitter} onChange={handleChange} placeholder="@handle" />
          </div>
          <div className="form-group">
            <label>LinkedIn</label>
            <input name="social.linkedin" value={form.socialLinks.linkedin} onChange={handleChange} placeholder="Profile URL" />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Behance</label>
            <input name="social.behance" value={form.socialLinks.behance} onChange={handleChange} placeholder="Profile URL" />
          </div>
          <div className="form-group">
            <label>Dribbble</label>
            <input name="social.dribbble" value={form.socialLinks.dribbble} onChange={handleChange} placeholder="Profile URL" />
          </div>
        </div>

        <button type="submit" className="auth-btn" disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}
