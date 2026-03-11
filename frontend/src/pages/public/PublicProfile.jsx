import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../services/api';
import Navbar from '../../components/layout/Navbar';
import './PublicProfile.css';

export default function PublicProfile() {
  const { username } = useParams();
  const [profile, setProfile] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get(`/users/${username}`);
        setProfile(res.data.user);
        setItems(res.data.portfolioItems);
      } catch (err) {
        setError(err.response?.status === 404 ? 'User not found' : 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [username]);

  const categories = [...new Set(items.map(i => i.category?.name).filter(Boolean))];
  const filtered = filter === 'all' ? items : items.filter(i => i.category?.name === filter);

  if (loading) return <div className="public-loading">Loading...</div>;
  if (error) return <div className="public-error">{error}</div>;
  if (!profile) return null;

  return (
    <div className="public-page">
      <Navbar />
      <div className="public-container">
        <header className="profile-header">
          <div className="profile-avatar-lg">
            {profile.profilePicture ? (
              <img src={`${import.meta.env.VITE_API_URL?.replace('/api', '')}${profile.profilePicture}`} alt={profile.name} />
            ) : (
              <div className="avatar-placeholder-lg">{profile.username[0].toUpperCase()}</div>
            )}
          </div>
          <div className="profile-info">
            <h1 className="profile-name">{profile.name || profile.username}</h1>
            <p className="profile-username">@{profile.username}</p>
            {profile.bio && <p className="profile-bio">{profile.bio}</p>}
            {profile.location && <p className="profile-location">{profile.location}</p>}
            {profile.skills?.length > 0 && (
              <div className="profile-skills">
                {profile.skills.map((skill, i) => (
                  <span key={i} className="skill-tag">{skill}</span>
                ))}
              </div>
            )}
            {profile.socialLinks && (
              <div className="profile-socials">
                {Object.entries(profile.socialLinks)
                  .filter(([, v]) => v)
                  .map(([key, value]) => (
                    <a key={key} href={value.startsWith('http') ? value : `https://${value}`} target="_blank" rel="noopener noreferrer" className="social-link">
                      {key}
                    </a>
                  ))}
              </div>
            )}
          </div>
        </header>

        {categories.length > 0 && (
          <div className="filter-bar">
            <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
            {categories.map(cat => (
              <button key={cat} className={`filter-btn ${filter === cat ? 'active' : ''}`} onClick={() => setFilter(cat)}>
                {cat}
              </button>
            ))}
          </div>
        )}

        <div className="gallery-grid">
          {filtered.map(item => (
            <div key={item._id} className="gallery-item">
              {item.fileType === 'image' ? (
                <img src={`${import.meta.env.VITE_API_URL?.replace('/api', '')}${item.fileUrl}`} alt={item.title} />
              ) : (
                <video src={`${import.meta.env.VITE_API_URL?.replace('/api', '')}${item.fileUrl}`} controls />
              )}
              <div className="gallery-overlay">
                <h3>{item.title}</h3>
                {item.description && <p>{item.description}</p>}
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="empty-gallery">No work to show yet.</div>
        )}
      </div>
    </div>
  );
}
