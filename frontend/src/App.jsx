import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuthStore } from './store/authStore';
import LoginPage from './pages/LoginPage';
import WorkspacePage from './pages/WorkspacePage';

function ProtectedRoute({ children }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? <Navigate to="/" replace /> : children;
}

export default function App() {
  const fetchMe = useAuthStore((state) => state.fetchMe);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // On every app load — check if stored token is still valid
    const token = localStorage.getItem('voice_token');
    if (token) {
      fetchMe().finally(() => setChecking(false));
    } else {
      setChecking(false);
    }
  }, []);

  // Show nothing while verifying token — avoids flash to login page
  if (checking) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--label3)', fontSize: '13px' }}>
        Loading...
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <WorkspacePage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}