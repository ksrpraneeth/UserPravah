import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

const Home: React.FC = () => {
  const navigate = useNavigate();

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const handleConditionalNavigation = () => {
    const pathname = window.location.pathname;
    switch (pathname) {
      case '/':
        return <Home />;
      case '/about':
        return <div>About Component</div>;
      case '/contact':
        return <div>Contact Component</div>;
      default:
        return <div>Unknown Component</div>;
    }
  };

  return (
    <div className="home">
      <h1>Welcome to React Comprehensive Test</h1>
      <p>This is a comprehensive test project for UserPravah React analyzer.</p>

      {/* Static Links */}
      <section>
        <h2>Navigation Links</h2>
        <nav>
          <Link to="/about">About</Link>
          <Link to="/contact">Contact</Link>
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/users/123">User Profile</Link>
          <Link to="/settings">Settings</Link>
          <Link to="/admin">Admin Panel</Link>
        </nav>
      </section>

      {/* Programmatic Navigation */}
      <section>
        <h2>Programmatic Navigation</h2>
        <button onClick={() => handleNavigation('/dashboard')}>
          Go to Dashboard
        </button>
        <button onClick={() => handleNavigation('/users/456')}>
          View User 456
        </button>
        <button onClick={() => navigate('/settings/profile')}>
          Profile Settings
        </button>
        <button onClick={() => navigate('/settings/security')}>
          Security Settings
        </button>
      </section>

      {/* Template Literals */}
      <section>
        <h2>Dynamic Links</h2>
        <Link to={`/users/${123}`}>User 123</Link>
        <Link to={`/users/${'admin'}`}>Admin User</Link>
      </section>

      {/* Anchor tags (should be filtered) */}
      <section>
        <h2>External Links (should be ignored)</h2>
        <a href="https://example.com">External Site</a>
        <a href="mailto:test@example.com">Email</a>
        <a href="//cdn.example.com">CDN Link</a>
      </section>
    </div>
  );
};

export default Home; 