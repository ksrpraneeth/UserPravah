import React from 'react';
import { Link, Outlet } from 'react-router-dom';

const Settings: React.FC = () => {
  return (
    <div>
      <h1>Settings</h1>
      <p>Manage your application settings.</p>
      
      <nav>
        <Link to="/settings/profile">Profile Settings</Link>
        <Link to="/settings/security">Security Settings</Link>
        <Link to="/dashboard">Back to Dashboard</Link>
      </nav>

      <div>
        <Outlet />
      </div>
    </div>
  );
};

export default Settings; 