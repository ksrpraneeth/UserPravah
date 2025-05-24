import { Link, useNavigate } from "react-router-dom";

function Settings() {
  const navigate = useNavigate();

  const handleSaveAndReturn = () => {
    // Simulate saving settings
    console.log("Settings saved!");
    navigate("/dashboard");
  };

  const handleCancel = () => {
    navigate(-1); // Go back to previous page
  };

  return (
    <div>
      <h1>Settings</h1>
      <p>Configure your account settings here.</p>

      <div>
        <h2>Actions</h2>
        <button onClick={handleSaveAndReturn}>
          Save & Return to Dashboard
        </button>
        <button onClick={handleCancel}>Cancel</button>
      </div>

      <nav>
        <Link to="/">Home</Link>
        <Link to="/dashboard">Dashboard</Link>
        <Link to="/about">About</Link>
      </nav>
    </div>
  );
}

export default Settings;
