import { Link } from 'react-router-dom';
import Navbar from '../../components/layout/Navbar';
import './Landing.css';

export default function Landing() {
  return (
    <div className="landing-page">
      <Navbar />
      <section className="hero">
        <div className="hero-content">
          <h1 className="hero-title">
            Your work deserves<br />a beautiful home.
          </h1>
          <p className="hero-subtitle">
            Create a stunning portfolio in minutes. Showcase your design work,
            videos, and creative projects to the world.
          </p>
          <div className="hero-actions">
            <Link to="/register" className="hero-btn">Create Your Portfolio</Link>
            <Link to="/login" className="hero-btn-outline">Sign In</Link>
          </div>
        </div>
      </section>

      <section className="features">
        <div className="features-grid">
          <div className="feature-card">
            <h3>Bulk Upload</h3>
            <p>Upload up to 50 files at once. Images and videos supported.</p>
          </div>
          <div className="feature-card">
            <h3>Public Portfolio</h3>
            <p>Get your own portfolio page with a clean, shareable URL.</p>
          </div>
          <div className="feature-card">
            <h3>Organize Your Work</h3>
            <p>Categorize projects by type, add descriptions, and sort your gallery.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
