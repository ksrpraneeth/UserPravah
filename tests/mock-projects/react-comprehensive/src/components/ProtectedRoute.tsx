import React from 'react';
import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  middleware?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requireAuth = false, 
  middleware 
}) => {
  // Simulate authentication check
  const isAuthenticated = true; // This would come from auth context
  const userRole = 'admin'; // This would come from user context

  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (middleware === 'admin' && userRole !== 'admin') {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute; 