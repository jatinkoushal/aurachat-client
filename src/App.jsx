import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Component } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Login from './pages/Login';
import Register from './pages/Register';
import AppLayout from './components/Navigation/AppLayout';
import Chats from './pages/Chats';
import People from './pages/People';
import Groups from './pages/Groups';
import Settings from './pages/Settings';

class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: '#0f0e1a', color: '#fff', padding: 32, textAlign: 'center', gap: 16 }}>
          <div style={{ fontSize: 48 }}>⚠️</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Something went wrong</div>
          <div style={{ fontSize: 13, color: '#a29bfe', maxWidth: 400 }}>{String(this.state.error?.message || this.state.error)}</div>
          <button onClick={() => window.location.reload()} style={{ marginTop: 8, padding: '10px 24px', background: '#6c63ff', color: '#fff', border: 'none', borderRadius: 24, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: '#0f0e1a' }}>
      <div style={{ width: 32, height: 32, border: '3px solid #3d3b6e', borderTopColor: '#6c63ff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  return user ? children : <Navigate to="/login" replace />;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: '#0f0e1a' }}>
      <div style={{ width: 32, height: 32, border: '3px solid #3d3b6e', borderTopColor: '#6c63ff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  return !user ? children : <Navigate to="/chats" replace />;
};

const AppWithSocket = () => (
  <SocketProvider>
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/chats"    element={<Chats />} />
        <Route path="/people"   element={<People />} />
        <Route path="/groups"   element={<Groups />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*"         element={<Navigate to="/chats" replace />} />
      </Route>
    </Routes>
  </SocketProvider>
);

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login"    element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
            <Route path="/*"        element={<PrivateRoute><AppWithSocket /></PrivateRoute>} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
