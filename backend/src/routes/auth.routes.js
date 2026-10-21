const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sql, getPool } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
require('dotenv').config();

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { nombreUsuario, password } = req.body;
  if (!nombreUsuario || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son obligatorios.' });
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('nombreUsuario', sql.VarChar, nombreUsuario)
      .query('SELECT * FROM Usuarios WHERE NombreUsuario = @nombreUsuario AND Activo = 1');

    const usuario = result.recordset[0];
    if (!usuario) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    }

    const passwordValida = await bcrypt.compare(password, usuario.PasswordHash);
    if (!passwordValida) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    }

    const payload = {
      usuarioId: usuario.UsuarioId,
      nombreUsuario: usuario.NombreUsuario,
      nombreCompleto: usuario.NombreCompleto,
      rol: usuario.Rol,
      certificacion: usuario.Certificacion,
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '12h' });

    res.json({ token, usuario: payload });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor al iniciar sesión.' });
  }
});

// GET /api/auth/me  -> devuelve los datos del usuario logueado (para persistir sesión al refrescar)
router.get('/me', requireAuth, (req, res) => {
  res.json({ usuario: req.usuario });
});

module.exports = router;
