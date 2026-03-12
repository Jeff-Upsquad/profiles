import { Link } from 'react-router-dom';
import Navbar from '../../components/layout/Navbar';
import './Landing.css';

export default function Landing() {
  return (
    <div className="landing-page">
      <Navbar />

      {/* Hero — Hashnode-style with gradient + dot pattern */}
      <section className="hero">
        <div className="hero-bg" />
        <div className="hero-content">
          <h1 className="hero-title">
            Create to inspire.
            <br />
            <span className="hero-title-accent">Share to connect.</span>
          </h1>
          <p className="hero-subtitle">
            The portfolio platform for designers and video editors.
            Showcase your best work with a beautiful, shareable profile.
          </p>
          <div className="hero-actions">
            <Link to="/register" className="hero-btn-primary">
              Start Your Portfolio
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </Link>
            <Link to="/login" className="hero-btn-outline">Sign In</Link>
          </div>

          {/* Stats row like Hashnode */}
          <div className="hero-stats">
            <div className="hero-stat">
              <span className="hero-stat-dot" />
              Free forever
            </div>
            <div className="hero-stat">
              <span className="hero-stat-dot" />
              Bulk upload 50 files
            </div>
            <div className="hero-stat">
              <span className="hero-stat-dot" />
              Custom portfolio URL
            </div>
          </div>
        </div>
      </section>

      {/* Features — clean card grid */}
      <section className="features-section">
        <div className="features-container">
          <h2 className="features-heading">Everything you need</h2>
          <p className="features-sub">Tools built for creative professionals</p>

          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              </div>
              <h3>Bulk Upload</h3>
              <p>Upload up to 50 files at once. Images and videos — drag, drop, done.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              </div>
              <h3>Public Portfolio</h3>
              <p>Get your own portfolio page with a clean, shareable URL anyone can visit.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
              </div>
              <h3>Organize Your Work</h3>
              <p>Categorize projects by type, add descriptions, and curate your gallery.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <span className="landing-footer-brand">
            <span className="footer-logo-icon">P</span>
            Profiles
          </span>
          <span className="landing-footer-copy">Built for creatives</span>
        </div>
      </footer>
    </div>
  );
}
