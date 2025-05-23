import { Link, useNavigate } from "react-router-dom";

function Dashboard() {
  const navigate = useNavigate();

  const handleUserClick = (userId) => {
    navigate(`/users/${userId}`);
  };

  const handleSettingsClick = () => {
    navigate("/settings");
  };

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Welcome to your dashboard!</p>

      <div>
        <h2>Quick Actions</h2>
        <button onClick={() => handleUserClick("123")}>View User 123</button>
        <button onClick={() => handleUserClick("456")}>View User 456</button>
        <button onClick={handleSettingsClick}>Go to Settings</button>
      </div>

      <nav>
        <Link to="/">Home</Link>
        <Link to="/about">About</Link>
        <Link to="/contact">Contact</Link>
        <Link to="/settings">Settings</Link>
      </nav>
    </div>
  );
}

export default Dashboard;
