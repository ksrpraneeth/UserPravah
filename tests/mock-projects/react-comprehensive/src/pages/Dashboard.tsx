import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'settings':
        navigate('/settings');
        break;
      case 'profile':
        navigate('/settings/profile');
        break;
      case 'users':
        navigate('/users/current');
        break;
      default:
        navigate('/');
    }
  };

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Welcome to your dashboard!</p>
      
      <nav>
        <Link to="/dashboard/analytics">Analytics</Link>
        <Link to="/dashboard/reports">Reports</Link>
        <Link to="/settings">Settings</Link>
        <Link to="/users/profile">My Profile</Link>
      </nav>

      <div>
        <h2>Quick Actions</h2>
        <button onClick={() => handleQuickAction('settings')}>
          Go to Settings
        </button>
        <button onClick={() => handleQuickAction('profile')}>
          Edit Profile
        </button>
        <button onClick={() => handleQuickAction('users')}>
          View Current User
        </button>
      </div>
    </div>
  );
};

export default Dashboard; 