import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';

// Menu configuration for testing menu extraction
const menuItems = [
  {
    title: 'Home',
    path: '/',
    roles: ['user', 'admin']
  },
  {
    title: 'About',
    path: '/about',
    roles: ['user', 'admin']
  },
  {
    title: 'Contact',
    path: '/contact',
    roles: ['user', 'admin']
  },
  {
    title: 'Dashboard',
    path: '/dashboard',
    roles: ['user', 'admin'],
    children: [
      {
        title: 'Analytics',
        path: '/dashboard/analytics',
        roles: ['user', 'admin']
      },
      {
        title: 'Reports',
        path: '/dashboard/reports',
        roles: ['admin']
      }
    ]
  },
  {
    title: 'Settings',
    path: '/settings',
    roles: ['user', 'admin'],
    children: [
      {
        title: 'Profile',
        path: '/settings/profile',
        roles: ['user', 'admin']
      },
      {
        title: 'Security',
        path: '/settings/security',
        roles: ['user', 'admin']
      }
    ]
  },
  {
    title: 'Admin',
    path: '/admin',
    roles: ['admin']
  }
];

const Navigation: React.FC = () => {
  const navigate = useNavigate();

  const handleProgrammaticNavigation = (path: string) => {
    navigate(path);
  };

  const handleConditionalNavigation = () => {
    const userRole = 'admin'; // Simulate user role
    if (userRole === 'admin') {
      navigate('/admin');
    } else {
      navigate('/dashboard');
    }
  };

  const handleDynamicNavigation = (userId: string) => {
    navigate(`/users/${userId}`);
  };

  return (
    <nav className="navigation">
      <div className="nav-brand">
        <Link to="/">React App</Link>
      </div>

      {/* Static navigation links */}
      <ul className="nav-menu">
        {menuItems.map((item) => (
          <li key={item.path} className="nav-item">
            <NavLink 
              to={item.path} 
              className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
            >
              {item.title}
            </NavLink>
            
            {/* Submenu */}
            {item.children && (
              <ul className="submenu">
                {item.children.map((child) => (
                  <li key={child.path}>
                    <Link to={child.path}>{child.title}</Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>

      {/* Programmatic navigation buttons */}
      <div className="nav-actions">
        <button onClick={() => handleProgrammaticNavigation('/dashboard')}>
          Go to Dashboard
        </button>
        <button onClick={() => handleProgrammaticNavigation('/settings')}>
          Settings
        </button>
        <button onClick={handleConditionalNavigation}>
          Smart Navigation
        </button>
        <button onClick={() => handleDynamicNavigation('123')}>
          View User 123
        </button>
      </div>

      {/* External links (should be ignored) */}
      <div className="external-links">
        <a href="https://example.com">External Link</a>
        <a href="mailto:contact@example.com">Email</a>
        <a href="/api/data">API Endpoint</a>
      </div>
    </nav>
  );
};

export default Navigation; 