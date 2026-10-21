const express = require('express');
const bcrypt = require('bcryptjs');
const { sql, getPool } = require('../config/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Todas las rutas de este archivo requieren estar logueado Y ser administrador
router.use(requireAuth, requireAdmin);

// GET /api/usuarios -> lista todos los usuarios (instructores y admins)
router.get('/', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(
      'SELECT UsuarioId, NombreUsuario, NombreCompleto, Rol, Certificacion, Activo, FechaCreacion FROM Usuarios ORDER BY FechaCreacion DESC'
    );
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener los usuarios.' });
  }
});

// POST /api/usuarios -> crea un nuevo instructor o administrador
router.post('/', async (req, res) => {
  const { nombreUsuario, password, nombreCompleto, rol, certificacion } = req.body;

  if (!nombreUsuario || !password || !nombreCompleto || !rol) {
    return res.status(400).json({ error: 'Faltan datos obligatorios.' });
  }
  if (!['Administrador', 'Instructor'].includes(rol)) {
    return res.status(400).json({ error: 'Rol inválido.' });
  }

  try {
    const pool = await getPool();

    const existe = await pool.request()
      .input('nombreUsuario', sql.VarChar, nombreUsuario)
      .query('SELECT UsuarioId FROM Usuarios WHERE NombreUsuario = @nombreUsuario');
    if (existe.recordset.length > 0) {
      return res.status(409).json({ error: 'Ya existe un usuario con ese nombre.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.request()
      .input('nombreUsuario', sql.VarChar, nombreUsuario)
      .input('passwordHash', sql.VarChar, passwordHash)
      .input('nombreCompleto', sql.VarChar, nombreCompleto)
      .input('rol', sql.VarChar, rol)
      .input('certificacion', sql.VarChar, certificacion || null)
      .query(`
        INSERT INTO Usuarios (NombreUsuario, PasswordHash, NombreCompleto, Rol, Certificacion, Activo)
        OUTPUT INSERTED.UsuarioId, INSERTED.NombreUsuario, INSERTED.NombreCompleto, INSERTED.Rol, INSERTED.Certificacion, INSERTED.Activo
        VALUES (@nombreUsuario, @passwordHash, @nombreCompleto, @rol, @certificacion, 1)
      `);

    res.status(201).json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear el usuario.' });
  }
});

// PUT /api/usuarios/:id -> edita datos de un usuario (no la contraseña)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nombreCompleto, rol, certificacion, activo } = req.body;

  try {
    const pool = await getPool();
    await pool.request()
      .input('id', sql.Int, id)
      .input('nombreCompleto', sql.VarChar, nombreCompleto)
      .input('rol', sql.VarChar, rol)
      .input('certificacion', sql.VarChar, certificacion || null)
      .input('activo', sql.Bit, activo ? 1 : 0)
      .query(`
        UPDATE Usuarios
        SET NombreCompleto = @nombreCompleto, Rol = @rol, Certificacion = @certificacion, Activo = @activo
        WHERE UsuarioId = @id
      `);
    res.json({ mensaje: 'Usuario actualizado correctamente.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar el usuario.' });
  }
});

// PUT /api/usuarios/:id/reset-password -> el admin resetea la contraseña de alguien
router.put('/:id/reset-password', async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;
  if (!password || password.length < 3) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 3 caracteres.' });
  }
  try {
    const pool = await getPool();
    const passwordHash = await bcrypt.hash(password, 10);
    await pool.request()
      .input('id', sql.Int, id)
      .input('passwordHash', sql.VarChar, passwordHash)
      .query('UPDATE Usuarios SET PasswordHash = @passwordHash WHERE UsuarioId = @id');
    res.json({ mensaje: 'Contraseña actualizada correctamente.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar la contraseña.' });
  }
});

// DELETE /api/usuarios/:id -> desactiva un usuario (no se borra, para no perder trazabilidad)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await getPool();
    await pool.request()
      .input('id', sql.Int, id)
      .query('UPDATE Usuarios SET Activo = 0 WHERE UsuarioId = @id');
    res.json({ mensaje: 'Usuario desactivado correctamente.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al desactivar el usuario.' });
  }
});

module.exports = router;
