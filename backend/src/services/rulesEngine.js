/**
 * ============================================================
 * Motor de reglas - DiveSafe Pro
 * ============================================================
 * Implementa las 10 reglas del documento "reglas advertencias
 * o recomendaciones" provisto por Franco. Cada regla evalúa
 * una condición cruzando variables técnicas (cargadas por el
 * instructor) con variables ambientales (por ahora cargadas
 * a mano, a futuro vendrán de una API externa).
 *
 * Devuelve un array de alertas: { tipo, regla, mensaje }
 * tipo puede ser: 'Alerta' | 'Recomendacion' | 'Info'
 *
 * El nivel de riesgo general se calcula así:
 *   - 2 o más 'Alerta'                  -> Riesgo Alto
 *   - 1 'Alerta' o 2+ 'Recomendacion'   -> Riesgo Medio
 *   - Solo 'Info' o nada                -> Riesgo Bajo
 * (Este criterio de agregación es una decisión de diseño del
 * prototipo, fácil de ajustar en calcularNivelRiesgo() más abajo)
 */

// Límites de profundidad máxima según certificación (Regla 3)
const LIMITES_PROFUNDIDAD = {
  'Sin certificación': 12,
  'Open Water': 18,
  'Advanced OW': 30,
  'Rescue Diver': 40,
  'Dive Master': 40,
};

function evaluarReglas(datos) {
  const alertas = [];
  let orden = 0;
  const push = (tipo, regla, mensaje) => {
    orden += 1;
    alertas.push({ tipo, regla, mensaje, orden });
  };

  const {
    tempAgua,
    tipoTraje,               // 'Humedo3mm' | 'Humedo5mm' | 'Humedo7mm' | 'Semiseco' | 'Seco' | 'SinTraje'
    certificacionPromedio,   // 'Sin certificación' | 'Open Water' | 'Advanced OW' | 'Rescue Diver' | 'Dive Master'
    profundidadMaxima,
    esBuceoNocturno,
    ratioInstructorAlumno,   // número, ej 4 significa 1:4
    visibilidad,
    oleaje,
    cantidadAlumnos,
    tamanoTanque,            // '10L' | '12L' | '15L' | '2x12L'
    tiempoEstimado,
    corriente,
    equipoBoya,
    equipoCuchillo,
    clima,                   // 'Soleado' | 'Nublado' | 'Lluvia/Tormenta'
    coberturaNubes,
  } = datos;

  // ---- Regla 1: temp_agua < 15°C Y traje húmedo 3/5mm o sin traje ----
  const trajeInsuficienteFrio = ['Humedo3mm', 'Humedo5mm', 'SinTraje'].includes(tipoTraje);
  if (tempAgua < 15 && trajeInsuficienteFrio) {
    push('Alerta', 'Regla 1',
      `Temperatura del agua registrada: ${tempAgua} °C. Se recomienda el uso de traje húmedo/semiseco de al menos 7 mm o traje seco para prevenir hipotermia.`);
  }

  // ---- Regla 2: temp_agua < 22°C Y sin traje ----
  if (tempAgua < 22 && tipoTraje === 'SinTraje') {
    push('Recomendacion', 'Regla 2',
      `Temperatura del agua registrada: ${tempAgua} °C. Se recomienda el uso de traje 3mm o 5mm para prevenir salidas tempranas.`);
  }

  // ---- Regla 3: certificación promedio vs profundidad máxima ----
  const limite = LIMITES_PROFUNDIDAD[certificacionPromedio];
  if (limite !== undefined && profundidadMaxima > limite) {
    push('Alerta', 'Regla 3',
      `Profundidad planificada (${profundidadMaxima} m) excede el máximo recomendado para la certificación ${certificacionPromedio} (${limite} m).`);
  }

  // ---- Regla 4: certificación Open Water + buceo nocturno ----
  if (certificacionPromedio === 'Open Water' && esBuceoNocturno) {
    push('Recomendacion', 'Regla 4',
      'Inmersión en condiciones nocturnas o de baja luz con alumnos Open Water. Mantenerse cerca de los alumnos en todo momento.');
  }

  // ---- Regla 5 (antes "Regla5"): si es horario/buceo nocturno ----
  if (esBuceoNocturno) {
    push('Recomendacion', 'Regla 5',
      'Requiere linterna principal, linterna de respaldo y boya de señalización por cada pareja.');
  }

  // ---- Regla 6 (antes "Regla 6" - ratio): ratio > 8 alumnos por instructor ----
  if (ratioInstructorAlumno > 8) {
    push('Alerta', 'Regla 6',
      'Superado el ratio de seguridad. El estándar máximo es de 8 alumnos por instructor.');
  }

  // ---- Regla 7 (antes segunda "Regla 5"): visibilidad/oleaje + cantidad alumnos ----
  const visibilidadBaja = visibilidad < 5;
  const oleajeAlto = oleaje > 1.5;
  if ((visibilidadBaja || oleajeAlto) && cantidadAlumnos > 4) {
    push('Alerta', 'Regla 7',
      `Baja visibilidad (${visibilidad} m) u oleaje elevado (${oleaje} m). Se recomienda reducir el ratio a máximo 4 alumnos por instructor.`);
  }

  // ---- Regla 8 (antes segunda "Regla 6"): tanque 10L + profundidad + tiempo ----
  if (tamanoTanque === '10L' && profundidadMaxima > 20 && tiempoEstimado > 40) {
    push('Alerta', 'Regla 8',
      `Volumen de gas justo. Un tanque de 10 L a ${profundidadMaxima} m durante ${tiempoEstimado} min puede no ofrecer la reserva de seguridad requerida (mínimo 50 bar al emerger).`);
  }

  // ---- Regla 9: tanque 12L + profundidad + tiempo ----
  if (tamanoTanque === '12L' && profundidadMaxima > 30 && tiempoEstimado > 50) {
    push('Alerta', 'Regla 9',
      `Volumen de gas justo. Un tanque de 12 L a ${profundidadMaxima} m durante ${tiempoEstimado} min puede no ofrecer la reserva de seguridad requerida (mínimo 50 bar al emerger).`);
  }

  // ---- Regla 10: corriente > 1 nudo Y (no tiene boya O no tiene cuchillo) ----
  if (corriente > 1 && (!equipoBoya || !equipoCuchillo)) {
    push('Recomendacion', 'Regla 10',
      `Presencia de corriente (${corriente} nudos). Se recomienda que el guía y/o cada pareja lleven boya de marcación y cuchillo.`);
  }

  // ---- Regla 11: clima adverso o cobertura de nubes > 80% ----
  if (clima === 'Lluvia/Tormenta' || coberturaNubes > 80) {
    push('Alerta', 'Regla 11',
      'Condiciones climáticas adversas.');
  }

  // ---- Regla 12: cobertura de nubes > 60% ----
  if (coberturaNubes > 60 && coberturaNubes <= 80) {
    push('Recomendacion', 'Regla 12',
      'Mucha cobertura de nubes, espere a que se despeje.');
  }

  // ---- Datos ambientales sin valor (la API no los tiene para este sitio, p. ej. lagos y lagunas) ----
  // Un dato desconocido llega como NaN, así que ninguna regla lo toma como 0. Acá se avisa qué no se evaluó.
  if (!Number.isFinite(tempAgua)) {
    push('Info', 'Sin dato: temp. agua',
      'No hay datos de la temperatura del agua para este sitio: no se evaluaron las reglas 1 y 2 (hipotermia).');
  }
  if (!Number.isFinite(oleaje)) {
    push('Info', 'Sin dato: oleaje',
      'No hay datos de oleaje para este sitio: la regla 7 solo se evaluó por visibilidad.');
  }
  if (!Number.isFinite(corriente)) {
    push('Info', 'Sin dato: corriente',
      'No hay datos de corriente para este sitio: no se evaluó la regla 10.');
  }

  return alertas;
}

function calcularNivelRiesgo(alertas) {
  const cantAlertas = alertas.filter(a => a.tipo === 'Alerta').length;
  const cantRecomendaciones = alertas.filter(a => a.tipo === 'Recomendacion').length;

  if (cantAlertas >= 2) return 'Alto';
  if (cantAlertas === 1 || cantRecomendaciones >= 2) return 'Medio';
  return 'Bajo';
}

module.exports = { evaluarReglas, calcularNivelRiesgo, LIMITES_PROFUNDIDAD };
