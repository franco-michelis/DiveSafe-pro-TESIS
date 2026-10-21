import { useEffect, useState } from 'react';
import { api } from '../api';

const USUARIO_VACIO = { nombreUsuario: '', password: '', nombreCompleto: '', rol: 'Instructor', certificacion: '' };

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [modalCrear, setModalCrear] = useState(false);
  const [nuevoUsuario, setNuevoUsuario] = useState(USUARIO_VACIO);
  const [modalReset, setModalReset] = useState(null); // usuarioId o null
  const [nuevaPassword, setNuevaPassword] = useState('');

  async function cargar() {
    setCargando(true);
    try {
      const data = await api.listarUsuarios();
      setUsuarios(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargar(); }, []);

  async function handleCrear(e) {
    e.preventDefault();
    setError('');
    try {
      await api.crearUsuario(nuevoUsuario);
      setExito(`Usuario "${nuevoUsuario.nombreUsuario}" creado correctamente.`);
      setModalCrear(false);
      setNuevoUsuario(USUARIO_VACIO);
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleToggleActivo(usuario) {
    setError('');
    try {
      if (usuario.Activo) {
        await api.desactivarUsuario(usuario.UsuarioId);
      } else {
        await api.editarUsuario(usuario.UsuarioId, {
          nombreCompleto: usuario.NombreCompleto,
          rol: usuario.Rol,
          certificacion: usuario.Certificacion,
          activo: true,
        });
      }
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    setError('');
    try {
      await api.resetPassword(modalReset, nuevaPassword);
      setExito('Contraseña actualizada correctamente.');
      setModalReset(null);
      setNuevaPassword('');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <h2>Gestión de usuarios</h2>
        <button className="btn-primary" onClick={() => setModalCrear(true)}>
          <i className="ti ti-user-plus" /> Nuevo usuario
        </button>
      </div>

      {error && <div className="error-msg"><i className="ti ti-alert-circle" /> {error}</div>}
      {exito && <div className="success-msg"><i className="ti ti-circle-check" /> {exito}</div>}

      <div className="users-table">
        <div className="ut-header">
          <span>Usuario</span>
          <span>Nombre completo</span>
          <span>Rol</span>
          <span>Certificación</span>
          <span>Estado</span>
          <span>Acciones</span>
        </div>
        {cargando ? (
          <div className="empty-state">Cargando...</div>
        ) : (
          usuarios.map((u) => (
            <div className="ut-row" key={u.UsuarioId}>
              <span>{u.NombreUsuario}</span>
              <span>{u.NombreCompleto}</span>
              <span><span className="badge-neutral">{u.Rol}</span></span>
              <span style={{ color: '#8b949e' }}>{u.Certificacion || '—'}</span>
              <span>
                {u.Activo ? <span className="badge-ok">Activo</span> : <span className="badge-danger">Inactivo</span>}
              </span>
              <div className="ut-actions">
                <button className="icon-btn" title="Resetear contraseña" onClick={() => setModalReset(u.UsuarioId)}>
                  <i className="ti ti-key" />
                </button>
                <button
                  className={`icon-btn ${u.Activo ? 'danger' : ''}`}
                  title={u.Activo ? 'Desactivar' : 'Reactivar'}
                  onClick={() => handleToggleActivo(u)}
                >
                  <i className={`ti ${u.Activo ? 'ti-user-off' : 'ti-user-check'}`} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal: crear usuario */}
      {modalCrear && (
        <div className="modal-overlay" onClick={() => setModalCrear(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>Nuevo usuario</h3>
            <form onSubmit={handleCrear}>
              <div className="form-row">
                <label>Nombre de usuario</label>
                <input
                  type="text"
                  value={nuevoUsuario.nombreUsuario}
                  onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, nombreUsuario: e.target.value })}
                  required
                />
              </div>
              <div className="form-row">
                <label>Nombre completo</label>
                <input
                  type="text"
                  value={nuevoUsuario.nombreCompleto}
                  onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, nombreCompleto: e.target.value })}
                  required
                />
              </div>
              <div className="form-row">
                <label>Contraseña inicial</label>
                <input
                  type="password"
                  value={nuevoUsuario.password}
                  onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, password: e.target.value })}
                  required
                />
              </div>
              <div className="form-row">
                <label>Rol</label>
                <select
                  value={nuevoUsuario.rol}
                  onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, rol: e.target.value })}
                >
                  <option value="Instructor">Instructor</option>
                  <option value="Administrador">Administrador</option>
                </select>
              </div>
              <div className="form-row">
                <label>Certificación (opcional)</label>
                <input
                  type="text"
                  value={nuevoUsuario.certificacion}
                  onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, certificacion: e.target.value })}
                  placeholder="Ej: PADI Instructor, Divemaster..."
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setModalCrear(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">Crear usuario</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: resetear contraseña */}
      {modalReset && (
        <div className="modal-overlay" onClick={() => setModalReset(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>Resetear contraseña</h3>
            <form onSubmit={handleResetPassword}>
              <div className="form-row">
                <label>Nueva contraseña</label>
                <input
                  type="password"
                  value={nuevaPassword}
                  onChange={(e) => setNuevaPassword(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setModalReset(null)}>Cancelar</button>
                <button type="submit" className="btn-primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
