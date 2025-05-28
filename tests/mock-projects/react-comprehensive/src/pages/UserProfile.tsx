import React from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';

const UserProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  return (
    <div>
      <h1>User Profile: {id}</h1>
      <p>Viewing profile for user {id}</p>
      
      <nav>
        <Link to="/dashboard">Back to Dashboard</Link>
        <Link to="/settings">Settings</Link>
        <Link to="/users/admin">Admin Profile</Link>
      </nav>

      <button onClick={() => navigate('/dashboard')}>
        Return to Dashboard
      </button>
    </div>
  );
};

export default UserProfile; 