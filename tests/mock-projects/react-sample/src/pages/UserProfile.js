import { useParams, Link, useNavigate } from "react-router-dom";

function UserProfile() {
  const { id } = useParams();
  const navigate = useNavigate();

  const handleEditProfile = () => {
    navigate("/settings");
  };

  const handleViewDashboard = () => {
    navigate("/dashboard");
  };

  return (
    <div>
      <h1>User Profile - {id}</h1>
      <p>Viewing profile for user ID: {id}</p>

      <div>
        <button onClick={handleEditProfile}>Edit Profile</button>
        <button onClick={handleViewDashboard}>View Dashboard</button>
      </div>

      <nav>
        <Link to="/">Home</Link>
        <Link to="/about">About</Link>
        <Link to="/contact">Contact</Link>
      </nav>
    </div>
  );
}

export default UserProfile;
