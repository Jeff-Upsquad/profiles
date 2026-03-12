import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Navbar.css';

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-logo">
          <span className="logo-icon">P</span>
          Profiles
        </Link>
        <div className="navbar-right">
          {user ? (
            <>
              <Link to="/dashboard" className="navbar-link">Dashboard</Link>
              <Link to={`/${user.username}`} className="navbar-link">My Portfolio</Link>
              <button onClick={logout} className="navbar-link navbar-btn">Logout</button>
              <Link to="/dashboard/profile" className="navbar-avatar">
                {user.profilePicture ? (
                  <img src={`${import.meta.env.VITE_API_URL?.replace('/api', '')}${user.profilePicture}`} alt="" />
                ) : (
                  <span>{(user.username || 'U')[0].toUpperCase()}</span>
                )}
              </Link>
            </>
          ) : (
            <>
              <Link to="/login" className="navbar-link">Log in</Link>
              <Link to="/register" className="btn btn-primary">Create Account</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
