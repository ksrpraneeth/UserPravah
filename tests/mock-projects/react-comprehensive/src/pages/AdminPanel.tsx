import React from 'react';
import { Link } from 'react-router-dom';

const AdminPanel: React.FC = () => {
  return (
    <div>
      <h1>Admin Panel</h1>
      <p>Administrative controls and settings.</p>
      
      <nav>
        <Link to="/dashboard">Dashboard</Link>
        <Link to="/users/admin">Admin Profile</Link>
        <Link to="/settings">Settings</Link>
      </nav>
    </div>
  );
};

export default AdminPanel; 