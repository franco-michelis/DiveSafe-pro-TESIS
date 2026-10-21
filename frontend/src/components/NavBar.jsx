import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function NavBar() {
  const { usuario, logout, esAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [confirmarSalida, setConfirmarSalida] = useState(false);

  function confirmarLogout() {
    logout();
    setConfirmarSalida(false);
    navigate('/login');
  }

  function iniciales(nombre) {
    if (!nombre) return '';
    return nombre.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  }

  return (
    <nav className="nav">
      <Link to="/" className="nav-logo">
        <div className="nav-logo-icon"><i className="ti ti-ripple" /></div>
        DiveSafe Pro
      </Link>
      <div className="nav-links">
        <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}>
          <i className="ti ti-home" /> Menú
        </Link>
        <Link to="/planificar" className={`nav-link ${location.pathname === '/planificar' ? 'active' : ''}`}>
          <i className="ti ti-clipboard-list" /> Planificar
        </Link>
        <Link to="/auditar" className={`nav-link ${location.pathname.startsWith('/auditar') ? 'active' : ''}`}>
          <i className="ti ti-shield-search" /> Auditar
        </Link>
        {esAdmin && (
          <Link to="/sitios" className={`nav-link ${location.pathname === '/sitios' ? 'active' : ''}`}>
            <i className="ti ti-map-pin" /> Sitios
          </Link>
        )}
        {esAdmin && (
          <Link to="/usuarios" className={`nav-link ${location.pathname === '/usuarios' ? 'active' : ''}`}>
            <i className="ti ti-users-group" /> Usuarios
          </Link>
        )}
      </div>
      <div className="nav-right">
        <div className="nav-user">
          <div className="nav-avatar">{iniciales(usuario?.nombreCompleto)}</div>
          <span>{usuario?.nombreCompleto} · {usuario?.rol}</span>
        </div>
        <button className="logout-btn" onClick={() => setConfirmarSalida(true)}>
          <i className="ti ti-logout" /> Salir
        </button>
      </div>

      {confirmarSalida && (
        <div className="modal-overlay" onClick={() => setConfirmarSalida(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>Cerrar sesión</h3>
            <p style={{ fontSize: 13, color: '#8b949e', marginTop: 8, marginBottom: 4 }}>
              ¿Estás seguro de que querés cerrar sesión?
            </p>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setConfirmarSalida(false)}>Cancelar</button>
              <button type="button" className="btn-primary" onClick={confirmarLogout}>Salir</button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
