import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import Navigation from './components/Navigation';
import ProtectedRoute from './components/ProtectedRoute';

// Static imports
import Home from './pages/Home';
import About from './pages/About';
import Contact from './pages/Contact';

// Lazy loaded components
const Dashboard = lazy(() => import('./pages/Dashboard'));
const UserProfile = lazy(() => import('./pages/UserProfile'));
const Settings = lazy(() => import('./pages/Settings'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));

// Route configuration object
const routeConfig = [
  {
    path: '/',
    element: <Home />,
    index: true
  },
  {
    path: '/about',
    element: <About />
  },
  {
    path: '/contact',
    element: <Contact />
  },
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <Suspense fallback={<div>Loading Dashboard...</div>}>
          <Dashboard />
        </Suspense>
      </ProtectedRoute>
    )
  },
  {
    path: '/users/:id',
    element: (
      <Suspense fallback={<div>Loading User...</div>}>
        <UserProfile />
      </Suspense>
    )
  },
  {
    path: '/settings',
    element: (
      <ProtectedRoute requireAuth>
        <Suspense fallback={<div>Loading Settings...</div>}>
          <Settings />
        </Suspense>
      </ProtectedRoute>
    ),
    children: [
      {
        path: 'profile',
        element: <div>Profile Settings</div>
      },
      {
        path: 'security',
        element: <div>Security Settings</div>
      }
    ]
  },
  {
    path: '/admin',
    element: (
      <ProtectedRoute requireAuth middleware="admin">
        <Suspense fallback={<div>Loading Admin...</div>}>
          <AdminPanel />
        </Suspense>
      </ProtectedRoute>
    )
  },
  {
    path: '/old-path',
    element: <Navigate to="/new-path" replace />
  },
  {
    path: '/new-path',
    element: <div>New Path Content</div>
  }
];

// Alternative router using createBrowserRouter
const browserRouter = createBrowserRouter(routeConfig);

function App() {
  const useNewRouter = process.env.REACT_APP_USE_NEW_ROUTER === 'true';

  if (useNewRouter) {
    return <RouterProvider router={browserRouter} />;
  }

  return (
    <Router>
      <div className="App">
        <Navigation />
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            
            {/* Protected routes */}
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Suspense fallback={<div>Loading Dashboard...</div>}>
                    <Dashboard />
                  </Suspense>
                </ProtectedRoute>
              } 
            />
            
            {/* Dynamic routes */}
            <Route 
              path="/users/:id" 
              element={
                <Suspense fallback={<div>Loading User...</div>}>
                  <UserProfile />
                </Suspense>
              } 
            />
            
            {/* Nested routes */}
            <Route path="/settings" element={
              <ProtectedRoute requireAuth>
                <Suspense fallback={<div>Loading Settings...</div>}>
                  <Settings />
                </Suspense>
              </ProtectedRoute>
            }>
              <Route path="profile" element={<div>Profile Settings</div>} />
              <Route path="security" element={<div>Security Settings</div>} />
            </Route>
            
            {/* Admin routes with guards */}
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute requireAuth middleware="admin">
                  <Suspense fallback={<div>Loading Admin...</div>}>
                    <AdminPanel />
                  </Suspense>
                </ProtectedRoute>
              } 
            />
            
            {/* Redirects */}
            <Route path="/old-path" element={<Navigate to="/new-path" replace />} />
            <Route path="/new-path" element={<div>New Path Content</div>} />
            
            {/* Catch all */}
            <Route path="*" element={<div>404 - Page Not Found</div>} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App; 