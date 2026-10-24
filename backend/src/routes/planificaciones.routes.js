const express = require('express');
const crypto = require('crypto');
const { sql, getPool } = require('../config/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { evaluarReglas, calcularNivelRiesgo } = require('../services/rulesEngine');
const { validarPlanificacion, resolverAmbiente } = require('../services/validaciones');
const { ambienteDelSitio, ErrorAmbiente, SitioInvalido, FUENTE } = require('../services/ambiente');

function responderErroresDeValidacion(res, errores) {
  return res.status(400).json({ error: errores.join(' '), errores });
}

function responderError(res, err, mensajeGenerico) {
  if (err instanceof SitioInvalido) {
    return res.status(400).json({ error: 'El sitio de buceo seleccionado no existe o está inactivo.' });
  }
  if (err instanceof ErrorAmbiente) {
    console.error('Open-Meteo:', err.message);
    return res.status(502).json({ error: 'No se pudieron obtener las condiciones ambientales en tiempo real. Reintentá en unos minutos.' });
  }
  console.error(err);
  return res.status(500).json({ error: mensajeGenerico });
}

const router = express.Router();

router.use(requireAuth);

/**
 * Arma las variables que espera el motor de reglas: las técnicas vienen del formulario y las
 * ambientales de la API. Un dato ambiental sin valor (null) pasa a NaN para que ninguna regla
 * lo tome como 0.
 */
function extraerDatosParaReglas(body, ambiente) {
  const desconocido = (v) => (v === null || v === undefined ? NaN : Number(v));
  return {
    tempAgua: desconocido(ambiente.tempAgua),
    tipoTraje: body.tipoTraje,
    certificacionPromedio: body.certificacionPromedio,
    profundidadMaxima: Number(body.profundidadMaxima),
    esBuceoNocturno: Boolean(body.esBuceoNocturno),
    ratioInstructorAlumno: Number(body.ratioInstructorAlumno),
    visibilidad: Number(ambiente.visibilidad),
    oleaje: desconocido(ambiente.oleaje),
    cantidadAlumnos: Number(body.cantidadAlumnos),
    tamanoTanque: body.tamanoTanque,
    tiempoEstimado: Number(body.tiempoEstimado),
    corriente: desconocido(ambiente.corriente),
    equipoBoya: Boolean(body.equipoBoya),
    equipoCuchillo: Boolean(body.equipoCuchillo),
    clima: ambiente.clima,
    coberturaNubes: Number(ambiente.coberturaNubes),
  };
}

/**
 * Valida, trae las condiciones ambientales del sitio y evalúa las reglas.
 * Devuelve { errores } si algo es inválido, o el resultado completo de la evaluación.
 */
async function prepararEvaluacion(body) {
  const errores = validarPlanificacion(body);
  if (errores.length > 0) return { errores };

  const pool = await getPool();
  const { sitio, ambiente: ambienteApi } = await ambienteDelSitio(pool, body.sitioId);
  const resuelto = resolverAmbiente(body, ambienteApi);
  if (resuelto.errores.length > 0) return { errores: resuelto.errores };

  const alertas = evaluarReglas(extraerDatosParaReglas(body, resuelto.ambiente));
  return {
    pool,
    sitio,
    ambienteApi,
    ambiente: resuelto.ambiente,
    manuales: resuelto.manuales,
    alertas,
    nivelRiesgo: calcularNivelRiesgo(alertas),
  };
}

// POST /api/planificaciones/evaluar
// Calcula el riesgo SIN guardar nada en la base (para mostrar el resultado en pantalla)
router.post('/evaluar', async (req, res) => {
  try {
    const evaluacion = await prepararEvaluacion(req.body);
    if (evaluacion.errores) return responderErroresDeValidacion(res, evaluacion.errores);

    const { alertas, nivelRiesgo } = evaluacion;
    const requiereJustificacion = alertas.some(a => a.tipo === 'Alerta');
    res.json({ alertas, nivelRiesgo, requiereJustificacion });
  } catch (err) {
    responderError(res, err, 'Error al evaluar el riesgo. Revisá que todos los campos estén completos.');
  }
});

// POST /api/planificaciones
// Evalúa el riesgo Y guarda la planificación completa + sus alertas
router.post('/', async (req, res) => {
  const body = req.body;
  const usuarioId = req.usuario.usuarioId;

  try {
    const evaluacion = await prepararEvaluacion(body);
    if (evaluacion.errores) return responderErroresDeValidacion(res, evaluacion.errores);

    const { pool, sitio, ambiente, ambienteApi, manuales, alertas, nivelRiesgo } = evaluacion;
    const cantAlertas = alertas.filter(a => a.tipo === 'Alerta').length;
    const cantRecomendaciones = alertas.filter(a => a.tipo === 'Recomendacion').length;

    if (cantAlertas > 0 && (!body.justificacion || !body.justificacion.trim())) {
      return res.status(400).json({ error: 'Hay advertencias activas: la justificación del instructor es obligatoria para registrar esta planificación.' });
    }

    const request = pool.request();

    request
      .input('usuarioId', sql.Int, usuarioId)
      .input('sitioId', sql.Int, sitio.SitioId)
      .input('sitioBuceo', sql.VarChar, sitio.Nombre)
      .input('tipoInmersion', sql.VarChar, body.tipoInmersion)
      .input('tipoEntradaAgua', sql.VarChar, body.tipoEntradaAgua)
      .input('profundidadMaxima', sql.Decimal(5, 1), body.profundidadMaxima)
      .input('tiempoEstimado', sql.Int, body.tiempoEstimado)
      .input('fechaHoraEntrada', sql.DateTime, new Date(body.fechaHoraEntrada))
      .input('esBuceoNocturno', sql.Bit, body.esBuceoNocturno ? 1 : 0)
      .input('cantidadAlumnos', sql.Int, body.cantidadAlumnos)
      .input('ratioInstructorAlumno', sql.Int, body.ratioInstructorAlumno)
      .input('certificacionPromedio', sql.VarChar, body.certificacionPromedio)
      .input('inmersionesPrevias', sql.VarChar, body.inmersionesPrevias || null)
      .input('asistenteApoyo', sql.VarChar, body.asistenteApoyo || null)
      .input('tamanoTanque', sql.VarChar, body.tamanoTanque)
      .input('mezclaTanque', sql.VarChar, body.mezclaTanque)
      .input('presionInicial', sql.Int, body.presionInicial)
      .input('reservaMinima', sql.Int, body.reservaMinima || 50)
      .input('tipoTraje', sql.VarChar, body.tipoTraje)
      .input('equipoBoya', sql.Bit, body.equipoBoya ? 1 : 0)
      .input('equipoComputadora', sql.Bit, body.equipoComputadora ? 1 : 0)
      .input('equipoLinterna', sql.Bit, body.equipoLinterna ? 1 : 0)
      .input('equipoCuchillo', sql.Bit, body.equipoCuchillo ? 1 : 0)
      .input('equipoCamara', sql.Bit, body.equipoCamara ? 1 : 0)
      .input('equipoSilbato', sql.Bit, body.equipoSilbato ? 1 : 0)
      .input('notasAdicionales', sql.VarChar(4000), body.notasAdicionales || null)
      .input('briefingRealizado', sql.VarChar, body.briefingRealizado || null)
      .input('viento', sql.Decimal(5, 1), ambiente.viento)
      .input('direccionViento', sql.VarChar, ambiente.direccionViento)
      .input('oleaje', sql.Decimal(4, 1), ambiente.oleaje)
      .input('corriente', sql.Decimal(4, 2), ambiente.corriente)
      .input('direccionCorriente', sql.VarChar, ambiente.direccionCorriente)
      .input('visibilidad', sql.Decimal(4, 1), ambiente.visibilidad)
      .input('marea', sql.Decimal(4, 1), ambiente.marea)
      .input('estadoMarea', sql.VarChar, ambiente.estadoMarea)
      .input('tempAgua', sql.Decimal(4, 1), ambiente.tempAgua)
      .input('clima', sql.VarChar, ambiente.clima)
      .input('coberturaNubes', sql.Decimal(4, 1), ambiente.coberturaNubes)
      .input('ambienteFuente', sql.VarChar, FUENTE)
      .input('ambienteFechaHora', sql.DateTime, new Date(ambienteApi.fechaHora))
      .input('ambienteManual', sql.VarChar, manuales.length > 0 ? manuales.join(', ') : null)
      .input('nivelRiesgo', sql.VarChar, nivelRiesgo)
      .input('cantidadAdvertencias', sql.Int, cantAlertas)
      .input('cantidadRecomendaciones', sql.Int, cantRecomendaciones)
      .input('justificacion', sql.VarChar(4000), body.justificacion || null)
      .input('hashIntegridad', sql.VarChar, crypto.randomBytes(16).toString('hex'));

    const result = await request.query(`
      INSERT INTO Planificaciones (
        UsuarioId, SitioId, SitioBuceo, TipoInmersion, TipoEntradaAgua, ProfundidadMaxima, TiempoEstimado,
        FechaHoraEntrada, EsBuceoNocturno, CantidadAlumnos, RatioInstructorAlumno, CertificacionPromedio,
        InmersionesPrevias, AsistenteApoyo, TamanoTanque, MezclaTanque, PresionInicial, ReservaMinima,
        TipoTraje, EquipoBoya, EquipoComputadora, EquipoLinterna, EquipoCuchillo, EquipoCamara, EquipoSilbato,
        NotasAdicionales, BriefingRealizado, Viento, DireccionViento, Oleaje, Corriente, DireccionCorriente,
        Visibilidad, Marea, EstadoMarea, TempAgua, Clima, CoberturaNubes,
        AmbienteFuente, AmbienteFechaHora, AmbienteManual,
        NivelRiesgo, CantidadAdvertencias, CantidadRecomendaciones, Justificacion, HashIntegridad
      )
      OUTPUT INSERTED.PlanificacionId
      VALUES (
        @usuarioId, @sitioId, @sitioBuceo, @tipoInmersion, @tipoEntradaAgua, @profundidadMaxima, @tiempoEstimado,
        @fechaHoraEntrada, @esBuceoNocturno, @cantidadAlumnos, @ratioInstructorAlumno, @certificacionPromedio,
        @inmersionesPrevias, @asistenteApoyo, @tamanoTanque, @mezclaTanque, @presionInicial, @reservaMinima,
        @tipoTraje, @equipoBoya, @equipoComputadora, @equipoLinterna, @equipoCuchillo, @equipoCamara, @equipoSilbato,
        @notasAdicionales, @briefingRealizado, @viento, @direccionViento, @oleaje, @corriente, @direccionCorriente,
        @visibilidad, @marea, @estadoMarea, @tempAgua, @clima, @coberturaNubes,
        @ambienteFuente, @ambienteFechaHora, @ambienteManual,
        @nivelRiesgo, @cantidadAdvertencias, @cantidadRecomendaciones, @justificacion, @hashIntegridad
      )
    `);

    const planificacionId = result.recordset[0].PlanificacionId;

    // Guardar cada alerta generada, asociada a esta planificación
    for (const alerta of alertas) {
      await pool.request()
        .input('planificacionId', sql.Int, planificacionId)
        .input('tipo', sql.VarChar, alerta.tipo)
        .input('regla', sql.VarChar, alerta.regla)
        .input('mensaje', sql.VarChar, alerta.mensaje)
        .input('orden', sql.Int, alerta.orden)
        .query(`
          INSERT INTO AlertasGeneradas (PlanificacionId, Tipo, ReglaAplicada, Mensaje, Orden)
          VALUES (@planificacionId, @tipo, @regla, @mensaje, @orden)
        `);
    }

    res.status(201).json({ planificacionId, nivelRiesgo, alertas });
  } catch (err) {
    responderError(res, err, 'Error al registrar la planificación.');
  }
});

// GET /api/planificaciones -> lista para el módulo de auditoría, con filtros opcionales
router.get('/', async (req, res) => {
  const { riesgo, instructorId, busqueda } = req.query;
  try {
    const pool = await getPool();
    const request = pool.request();

    let where = 'WHERE 1=1';
    if (riesgo) {
      request.input('riesgo', sql.VarChar, riesgo);
      where += ' AND p.NivelRiesgo = @riesgo';
    }
    if (instructorId) {
      request.input('instructorId', sql.Int, instructorId);
      where += ' AND p.UsuarioId = @instructorId';
    }
    if (busqueda) {
      request.input('busqueda', sql.VarChar, `%${busqueda}%`);
      where += ' AND (p.SitioBuceo LIKE @busqueda OR u.NombreCompleto LIKE @busqueda)';
    }

    const result = await request.query(`
      SELECT p.PlanificacionId, p.SitioBuceo, p.TipoInmersion, p.CantidadAlumnos, p.ProfundidadMaxima,
             p.NivelRiesgo, p.FechaHoraEntrada, p.FechaRegistro, p.CantidadAdvertencias, p.CantidadRecomendaciones,
             u.NombreCompleto AS InstructorNombre, u.UsuarioId AS InstructorId
      FROM Planificaciones p
      JOIN Usuarios u ON u.UsuarioId = p.UsuarioId
      ${where}
      ORDER BY p.FechaRegistro DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener las planificaciones.' });
  }
});

// GET /api/planificaciones/estadisticas -> tarjetas resumen del módulo de auditoría
router.get('/estadisticas', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        COUNT(*) AS Total,
        SUM(CASE WHEN NivelRiesgo = 'Alto' THEN 1 ELSE 0 END) AS RiesgoAlto,
        SUM(CASE WHEN NivelRiesgo = 'Medio' THEN 1 ELSE 0 END) AS RiesgoMedio,
        SUM(CASE WHEN NivelRiesgo = 'Bajo' THEN 1 ELSE 0 END) AS RiesgoBajo
      FROM Planificaciones
    `);
    res.json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener las estadísticas.' });
  }
});

// GET /api/planificaciones/:id -> detalle completo para el panel de auditoría
// Solo administradores pueden ver el detalle completo de una planificación.
router.get('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await getPool();

    const planificacion = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT p.*, u.NombreCompleto AS InstructorNombre, u.Certificacion AS InstructorCertificacion
        FROM Planificaciones p
        JOIN Usuarios u ON u.UsuarioId = p.UsuarioId
        WHERE p.PlanificacionId = @id
      `);

    if (planificacion.recordset.length === 0) {
      return res.status(404).json({ error: 'Planificación no encontrada.' });
    }

    const alertas = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM AlertasGeneradas WHERE PlanificacionId = @id ORDER BY Orden');

    res.json({ planificacion: planificacion.recordset[0], alertas: alertas.recordset });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener el detalle de la planificación.' });
  }
});

module.exports = router;
