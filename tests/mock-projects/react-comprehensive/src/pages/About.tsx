import React from 'react';
import { Link } from 'react-router-dom';

const About: React.FC = () => {
  return (
    <div>
      <h1>About Us</h1>
      <p>This is the about page.</p>
      <Link to="/">Back to Home</Link>
      <Link to="/contact">Contact Us</Link>
    </div>
  );
};

export default About; 