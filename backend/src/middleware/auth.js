const jwt = require('jsonwebtoken');
require('dotenv').config();

/** Verifica que la petición traiga un token válido (usuario logueado) */
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autenticado. Iniciá sesión de nuevo.' });
  }
  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = payload; // { usuarioId, nombreUsuario, rol, nombreCompleto }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Sesión inválida o expirada. Iniciá sesión de nuevo.' });
  }
}

/** Verifica que el usuario logueado tenga rol Administrador */
function requireAdmin(req, res, next) {
  if (req.usuario?.rol !== 'Administrador') {
    return res.status(403).json({ error: 'Esta acción requiere permisos de administrador.' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
