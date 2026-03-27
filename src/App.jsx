import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import ClientPage from './pages/ClientPage';
import AdminPage from './pages/AdminPage';
import AdminGate from './pages/AdminGate';

const RequireAuth = ({ children }) => {
  const isAuth = localStorage.getItem('admin_asaph_auth') === 'true';
  return isAuth ? children : <Navigate to="/admin" replace />;
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
