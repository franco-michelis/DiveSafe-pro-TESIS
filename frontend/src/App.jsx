import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import NavBar from './components/NavBar';
import Login from './pages/Login';
import Menu from './pages/Menu';
import Planificar from './pages/Planificar';
import Auditar from './pages/Auditar';
import Usuarios from './pages/Usuarios';
import Sitios from './pages/Sitios';

function RutaPrivada({ children, soloAdmin = false }) {
  const { usuario, cargando, esAdmin } = useAuth();

  if (cargando) return <div className="loading-center">Cargando...</div>;
  if (!usuario) return <Navigate to="/login" replace />;
  if (soloAdmin && !esAdmin) return <Navigate to="/" replace />;

  return (
    <>
      <NavBar />
      {children}
    </>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<RutaPrivada><Menu /></RutaPrivada>} />
      <Route path="/planificar" element={<RutaPrivada><Planificar /></RutaPrivada>} />
      <Route path="/auditar" element={<RutaPrivada><Auditar /></RutaPrivada>} />
      <Route path="/usuarios" element={<RutaPrivada soloAdmin><Usuarios /></RutaPrivada>} />
      <Route path="/sitios" element={<RutaPrivada soloAdmin><Sitios /></RutaPrivada>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
