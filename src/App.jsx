import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase/config';
import ClientPage from './pages/ClientPage';
import AdminPage from './pages/AdminPage';
import AdminGate from './pages/AdminGate';

const RequireAuth = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', color: '#a78bfa' }}>Verificando conexão segura...</div>;
  }

  return user ? children : <Navigate to="/admin" replace />;
};

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<ClientPage />} />
        <Route path="/admin" element={<AdminGate />} />
        <Route path="/admin/dashboard" element={
          <RequireAuth>
            <AdminPage />
          </RequireAuth>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
