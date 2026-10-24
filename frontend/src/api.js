// Cambiá esta URL si tu backend corre en otro puerto/dirección
const API_URL = 'http://localhost:4000/api';

function getToken() {
  return localStorage.getItem('divesafe_token');
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || 'Ocurrió un error inesperado.');
  }
  return data;
}

export const api = {
  login: (nombreUsuario, password) =>
    request('/auth/login', { method: 'POST', body: { nombreUsuario, password } }),
  me: () => request('/auth/me'),

  evaluarRiesgo: (datos) => request('/planificaciones/evaluar', { method: 'POST', body: datos }),
  registrarPlanificacion: (datos) => request('/planificaciones', { method: 'POST', body: datos }),
  listarPlanificaciones: (filtros = {}) => {
    const params = new URLSearchParams(filtros).toString();
    return request(`/planificaciones${params ? `?${params}` : ''}`);
  },
  obtenerEstadisticas: () => request('/planificaciones/estadisticas'),
  obtenerPlanificacion: (id) => request(`/planificaciones/${id}`),

  listarUsuarios: () => request('/usuarios'),
  crearUsuario: (datos) => request('/usuarios', { method: 'POST', body: datos }),
  editarUsuario: (id, datos) => request(`/usuarios/${id}`, { method: 'PUT', body: datos }),
  resetPassword: (id, password) => request(`/usuarios/${id}/reset-password`, { method: 'PUT', body: { password } }),
  desactivarUsuario: (id) => request(`/usuarios/${id}`, { method: 'DELETE' }),

  listarSitios: (soloActivos = false) => request(`/sitios${soloActivos ? '?soloActivos=1' : ''}`),
  obtenerMapaSitios: () => request('/sitios/mapa'),
  obtenerAmbienteSitio: (id, forzar = false) => request(`/sitios/${id}/ambiente${forzar ? '?forzar=1' : ''}`),
  crearSitio: (datos) => request('/sitios', { method: 'POST', body: datos }),
  editarSitio: (id, datos) => request(`/sitios/${id}`, { method: 'PUT', body: datos }),
  cambiarEstadoSitio: (id, activo) => request(`/sitios/${id}/estado`, { method: 'PUT', body: { activo } }),
};

export { getToken };
