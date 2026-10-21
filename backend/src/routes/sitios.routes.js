const express = require('express');
const { sql, getPool } = require('../config/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

function validarSitio(body) {
  const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';
  const latitud = Number(body.latitud);
  const longitud = Number(body.longitud);

  if (!nombre) return { error: 'El nombre del sitio es obligatorio.' };
  if (nombre.length > 150) return { error: 'El nombre no puede superar los 150 caracteres.' };
  if (body.latitud === '' || body.latitud == null || !Number.isFinite(latitud) || latitud < -90 || latitud > 90) {
    return { error: 'La latitud debe ser un número entre -90 y 90.' };
  }
  if (body.longitud === '' || body.longitud == null || !Number.isFinite(longitud) || longitud < -180 || longitud > 180) {
    return { error: 'La longitud debe ser un número entre -180 y 180.' };
  }
  return { nombre, latitud, longitud };
}

// GET /api/sitios -> lista de sitios. Los instructores solo ven los activos (para el desplegable de planificación).
router.get('/', async (req, res) => {
  const soloActivos = req.usuario.rol !== 'Administrador' || req.query.soloActivos === '1';
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT SitioId, Nombre, Latitud, Longitud, Activo
      FROM SitiosBuceo
      ${soloActivos ? 'WHERE Activo = 1' : ''}
      ORDER BY Nombre
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener los sitios de buceo.' });
  }
});

// GET /api/sitios/mapa -> sitios activos con la cantidad de planificaciones por nivel de riesgo (para el mapa del menú).
// Solo cuenta planificaciones vinculadas a un sitio (SitioId); las anteriores al módulo de sitios no tienen vínculo.
router.get('/mapa', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT s.SitioId, s.Nombre, s.Latitud, s.Longitud,
             COUNT(p.PlanificacionId) AS Total,
             SUM(CASE WHEN p.NivelRiesgo = 'Alto'  THEN 1 ELSE 0 END) AS Alto,
             SUM(CASE WHEN p.NivelRiesgo = 'Medio' THEN 1 ELSE 0 END) AS Medio,
             SUM(CASE WHEN p.NivelRiesgo = 'Bajo'  THEN 1 ELSE 0 END) AS Bajo,
             MAX(p.FechaRegistro) AS UltimaPlanificacion
      FROM SitiosBuceo s
      LEFT JOIN Planificaciones p ON p.SitioId = s.SitioId
      WHERE s.Activo = 1
      GROUP BY s.SitioId, s.Nombre, s.Latitud, s.Longitud
      ORDER BY s.Nombre
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener el mapa de riesgo por sitio.' });
  }
});

// POST /api/sitios -> crea un sitio (solo administrador)
router.post('/', requireAdmin, async (req, res) => {
  const datos = validarSitio(req.body);
  if (datos.error) return res.status(400).json({ error: datos.error });

  try {
    const pool = await getPool();

    const existe = await pool.request()
      .input('nombre', sql.VarChar(150), datos.nombre)
      .query('SELECT SitioId FROM SitiosBuceo WHERE Nombre = @nombre');
    if (existe.recordset.length > 0) {
      return res.status(409).json({ error: 'Ya existe un sitio con ese nombre.' });
    }

    const result = await pool.request()
      .input('nombre', sql.VarChar(150), datos.nombre)
      .input('latitud', sql.Decimal(9, 6), datos.latitud)
      .input('longitud', sql.Decimal(9, 6), datos.longitud)
      .query(`
        INSERT INTO SitiosBuceo (Nombre, Latitud, Longitud, Activo)
        OUTPUT INSERTED.SitioId, INSERTED.Nombre, INSERTED.Latitud, INSERTED.Longitud, INSERTED.Activo
        VALUES (@nombre, @latitud, @longitud, 1)
      `);
    res.status(201).json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear el sitio de buceo.' });
  }
});

// PUT /api/sitios/:id -> edita nombre y coordenadas (solo administrador)
router.put('/:id', requireAdmin, async (req, res) => {
  const datos = validarSitio(req.body);
  if (datos.error) return res.status(400).json({ error: datos.error });

  try {
    const pool = await getPool();

    const duplicado = await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('nombre', sql.VarChar(150), datos.nombre)
      .query('SELECT SitioId FROM SitiosBuceo WHERE Nombre = @nombre AND SitioId <> @id');
    if (duplicado.recordset.length > 0) {
      return res.status(409).json({ error: 'Ya existe otro sitio con ese nombre.' });
    }

    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('nombre', sql.VarChar(150), datos.nombre)
      .input('latitud', sql.Decimal(9, 6), datos.latitud)
      .input('longitud', sql.Decimal(9, 6), datos.longitud)
      .query(`
        UPDATE SitiosBuceo SET Nombre = @nombre, Latitud = @latitud, Longitud = @longitud
        WHERE SitioId = @id
      `);
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Sitio no encontrado.' });
    }
    res.json({ mensaje: 'Sitio actualizado correctamente.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar el sitio de buceo.' });
  }
});

// PUT /api/sitios/:id/estado -> activa o desactiva un sitio (no se borra, para no perder trazabilidad)
router.put('/:id/estado', requireAdmin, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('activo', sql.Bit, req.body.activo ? 1 : 0)
      .query('UPDATE SitiosBuceo SET Activo = @activo WHERE SitioId = @id');
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Sitio no encontrado.' });
    }
    res.json({ mensaje: req.body.activo ? 'Sitio activado.' : 'Sitio desactivado.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cambiar el estado del sitio.' });
  }
});

module.exports = router;
