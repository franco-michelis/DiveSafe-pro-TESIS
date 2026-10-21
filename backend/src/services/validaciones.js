/**
 * Validaciones de los datos que carga el instructor al planificar una inmersión.
 * No se validan las variables ambientales (viento, oleaje, etc.): se van a completar
 * automáticamente desde una API climática.
 *
 * Los mismos límites están duplicados en frontend/src/pages/Planificar.jsx
 * (para mostrar el error apenas se escribe). Si se cambian acá, cambiarlos allá también.
 */

const LIMITES = {
  profundidadMaxima: { min: 1, max: 60 },   // metros
  tiempoEstimado: { min: 1, max: 180 },     // minutos
  cantidadAlumnos: { min: 1, max: 30 },
  presionInicial: { min: 50, max: 300 },    // bar
  reservaMinima: { min: 10, max: 100 },     // bar
};

const MAX_ASISTENTE = 150;
const MAX_TEXTO_LARGO = 4000;

function aNumero(valor) {
  if (valor === '' || valor === null || valor === undefined || typeof valor === 'boolean') return NaN;
  return Number(valor);
}

function dosDigitos(n) {
  return String(n).padStart(2, '0');
}

/** Devuelve una lista de mensajes de error (vacía si todo está bien). */
function validarPlanificacion(body, ahora = new Date()) {
  const errores = [];

  const profundidad = aNumero(body.profundidadMaxima);
  const { min: pMin, max: pMax } = LIMITES.profundidadMaxima;
  if (!Number.isFinite(profundidad) || profundidad < pMin || profundidad > pMax) {
    errores.push(`La profundidad máxima debe estar entre ${pMin} y ${pMax} m.`);
  }

  const tiempo = aNumero(body.tiempoEstimado);
  const { min: tMin, max: tMax } = LIMITES.tiempoEstimado;
  if (!Number.isInteger(tiempo) || tiempo < tMin || tiempo > tMax) {
    errores.push(`El tiempo estimado debe ser un número entero de minutos entre ${tMin} y ${tMax}.`);
  }

  const alumnos = aNumero(body.cantidadAlumnos);
  const { min: aMin, max: aMax } = LIMITES.cantidadAlumnos;
  if (!Number.isInteger(alumnos) || alumnos < aMin || alumnos > aMax) {
    errores.push(`La cantidad de alumnos debe ser un número entero entre ${aMin} y ${aMax}.`);
  }

  const presion = aNumero(body.presionInicial);
  const { min: prMin, max: prMax } = LIMITES.presionInicial;
  const presionValida = Number.isInteger(presion) && presion >= prMin && presion <= prMax;
  if (!presionValida) {
    errores.push(`La presión inicial debe ser un número entero entre ${prMin} y ${prMax} bar.`);
  }

  const reserva = aNumero(body.reservaMinima);
  const { min: rMin, max: rMax } = LIMITES.reservaMinima;
  const reservaValida = Number.isInteger(reserva) && reserva >= rMin && reserva <= rMax;
  if (!reservaValida) {
    errores.push(`La reserva mínima debe ser un número entero entre ${rMin} y ${rMax} bar.`);
  } else if (presionValida && reserva >= presion) {
    errores.push('La reserva mínima debe ser menor que la presión inicial.');
  }

  // La entrada al agua tiene que ser hoy y no en un horario que ya pasó.
  const partes = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(body.fechaHoraEntrada || ''));
  if (!partes) {
    errores.push('Ingresá la hora de entrada al agua.');
  } else {
    const [, anio, mes, dia, hora, minuto] = partes.map(Number);
    const esHoy = anio === ahora.getFullYear() && mes === ahora.getMonth() + 1 && dia === ahora.getDate();
    const horaValida = hora <= 23 && minuto <= 59;
    if (!esHoy) {
      errores.push('La entrada al agua tiene que ser hoy.');
    } else if (!horaValida) {
      errores.push('La hora de entrada al agua no es válida.');
    } else if (hora * 60 + minuto < ahora.getHours() * 60 + ahora.getMinutes()) {
      errores.push(`La hora de entrada al agua ya pasó. Ingresá un horario de hoy a partir de las ${dosDigitos(ahora.getHours())}:${dosDigitos(ahora.getMinutes())}.`);
    }
  }

  if (typeof body.asistenteApoyo === 'string' && body.asistenteApoyo.length > MAX_ASISTENTE) {
    errores.push(`El nombre del asistente no puede superar los ${MAX_ASISTENTE} caracteres.`);
  }
  if (typeof body.notasAdicionales === 'string' && body.notasAdicionales.length > MAX_TEXTO_LARGO) {
    errores.push(`Las notas adicionales no pueden superar los ${MAX_TEXTO_LARGO} caracteres.`);
  }
  if (typeof body.justificacion === 'string' && body.justificacion.length > MAX_TEXTO_LARGO) {
    errores.push(`La justificación no puede superar los ${MAX_TEXTO_LARGO} caracteres.`);
  }

  return errores;
}

module.exports = { validarPlanificacion, LIMITES };
