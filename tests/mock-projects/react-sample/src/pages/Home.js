import { Link, useNavigate } from "react-router-dom";

function Home() {
  const navigate = useNavigate();

  const handleNavigation = () => {
    navigate("/about");
  };

  const handleDashboardNavigation = () => {
    navigate("/dashboard");
  };

  const handleUserNavigation = (userId) => {
    if (userId) {
      navigate(`/users/${userId}`);
    } else {
      navigate("/users/guest");
    }
  };

  const handleConditionalNavigation = () => {
    const isLoggedIn = true; // Simulate user state
    if (isLoggedIn) {
      navigate("/dashboard");
    } else {
      navigate("/about");
    }
  };

  return (
    <div>
      <h1>Home</h1>
      <p>Welcome to the React Sample App!</p>

      {/* Static navigation links */}
      <nav>
        <Link to="/contact">Contact</Link>
        <Link to="/about">About Us</Link>
        <Link to="/dashboard">Dashboard</Link>
        <Link to="/settings">Settings</Link>
      </nav>

      {/* Programmatic navigation buttons */}
      <div>
        <h2>Quick Actions</h2>
        <button onClick={handleNavigation}>Go to About</button>
        <button onClick={handleDashboardNavigation}>View Dashboard</button>
        <button onClick={() => handleUserNavigation("123")}>
          View User 123
        </button>
        <button onClick={() => handleUserNavigation("")}>
          View Guest User
        </button>
        <button onClick={handleConditionalNavigation}>Smart Navigation</button>
      </div>

      {/* Dynamic links with parameters */}
      <div>
        <h2>User Links</h2>
        <Link to="/users/admin">Admin Profile</Link>
        <Link to="/users/john">John's Profile</Link>
        <Link to="/users/jane">Jane's Profile</Link>
      </div>
    </div>
  );
}

export default Home;
