import React from 'react';
import { Link } from 'react-router-dom';

const Contact: React.FC = () => {
  return (
    <div>
      <h1>Contact Us</h1>
      <p>Get in touch with us.</p>
      <Link to="/">Home</Link>
      <Link to="/about">About</Link>
    </div>
  );
};

export default Contact; 