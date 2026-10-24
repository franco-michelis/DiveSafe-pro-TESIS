/**
 * Variables ambientales en tiempo real desde Open-Meteo (https://open-meteo.com).
 * Gratis para uso no comercial, sin API key. Los datos son CC BY 4.0: hay que mostrar la atribución.
 *
 * Se usan dos APIs con las coordenadas del sitio de buceo:
 *  - Forecast: clima, viento y nubes.
 *  - Marine:   oleaje, temperatura del agua, corriente y nivel del mar (marea).
 * En lagos y lagunas (y a veces en la costa) la API marina no tiene datos: esos campos quedan en null.
 */
const { sql } = require('../config/db');

const FUENTE = 'Open-Meteo';
const ATRIBUCION = 'Datos meteorológicos y marinos: Open-Meteo.com (CC BY 4.0) · Modelo de oleaje: DWD.';
const TTL_MS = 10 * 60 * 1000;   // las mismas condiciones se reusan 10 min: evaluar y registrar ven lo mismo
const TIMEOUT_MS = 8000;
const NUDOS_POR_KMH = 1 / 1.852;

const URL_FORECAST = 'https://api.open-meteo.com/v1/forecast';
const URL_MARINE = 'https://marine-api.open-meteo.com/v1/marine';

class ErrorAmbiente extends Error {}
class SitioInvalido extends Error {}

const cache = new Map();

const ROSA = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];

const DESCRIPCION_WMO = {
  0: 'Despejado', 1: 'Mayormente despejado', 2: 'Parcialmente nublado', 3: 'Nublado',
  45: 'Niebla', 48: 'Niebla con escarcha',
  51: 'Llovizna leve', 53: 'Llovizna', 55: 'Llovizna intensa', 56: 'Llovizna helada', 57: 'Llovizna helada intensa',
  61: 'Lluvia leve', 63: 'Lluvia', 65: 'Lluvia intensa', 66: 'Lluvia helada', 67: 'Lluvia helada intensa',
  71: 'Nevada leve', 73: 'Nevada', 75: 'Nevada intensa', 77: 'Granizo fino',
  80: 'Chubascos leves', 81: 'Chubascos', 82: 'Chubascos violentos', 85: 'Chubascos de nieve', 86: 'Chubascos de nieve intensos',
  95: 'Tormenta', 96: 'Tormenta con granizo', 99: 'Tormenta con granizo fuerte',
};

function cardinal(grados) {
  return ROSA[Math.round((((grados % 360) + 360) % 360) / 22.5) % 16];
}

// Categorías que usa el motor de reglas: Soleado | Nublado | Lluvia/Tormenta
function categoriaClima(codigo) {
  if (codigo <= 1) return 'Soleado';
  if (codigo <= 48) return 'Nublado';
  return 'Lluvia/Tormenta';
}

const numero = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const redondear = (v, decimales) => (v === null ? null : Number(v.toFixed(decimales)));

async function pedirJson(url) {
  const control = new AbortController();
  const timer = setTimeout(() => control.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: control.signal });
    if (!res.ok) throw new ErrorAmbiente(`Open-Meteo respondió HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (err instanceof ErrorAmbiente) throw err;
    throw new ErrorAmbiente(err.name === 'AbortError' ? 'Open-Meteo tardó demasiado en responder' : `No se pudo conectar con Open-Meteo (${err.message})`);
  } finally {
    clearTimeout(timer);
  }
}

function interpretar(forecast, marine) {
  const c = forecast.current;
  const m = marine.current;
  if (!c || !m) throw new ErrorAmbiente('Open-Meteo devolvió una respuesta sin datos actuales');

  const codigo = numero(c.weather_code);
  const viento = numero(c.wind_speed_10m);
  const direccionViento = numero(c.wind_direction_10m);
  const nubes = numero(c.cloud_cover);
  if (codigo === null || viento === null || nubes === null) {
    throw new ErrorAmbiente('Open-Meteo no devolvió clima, viento o nubes para esta ubicación');
  }

  const velocidadCorriente = numero(m.ocean_current_velocity);
  const direccionCorriente = numero(m.ocean_current_direction);
  const marea = numero(m.sea_level_height_msl);

  // Subiendo/Bajando: se compara la hora actual con la siguiente del pronóstico horario.
  let estadoMarea = null;
  const horas = marine.hourly?.time || [];
  const niveles = marine.hourly?.sea_level_height_msl || [];
  const idx = horas.reduce((ultimo, t, i) => (t <= c.time ? i : ultimo), -1);
  if (marea !== null && idx >= 0 && numero(niveles[idx]) !== null && numero(niveles[idx + 1]) !== null) {
    if (niveles[idx + 1] > niveles[idx]) estadoMarea = 'Subiendo';
    else if (niveles[idx + 1] < niveles[idx]) estadoMarea = 'Bajando';
  }

  return {
    fuente: FUENTE,
    fechaHora: new Date(c.time * 1000).toISOString(),
    viento: redondear(viento, 1),
    direccionViento: direccionViento === null ? null : cardinal(direccionViento),
    clima: categoriaClima(codigo),
    climaDetalle: DESCRIPCION_WMO[codigo] || categoriaClima(codigo),
    coberturaNubes: redondear(nubes, 1),
    oleaje: redondear(numero(m.wave_height), 1),
    corriente: velocidadCorriente === null ? null : redondear(velocidadCorriente * NUDOS_POR_KMH, 2),
    direccionCorriente: velocidadCorriente === null || direccionCorriente === null ? null : cardinal(direccionCorriente),
    tempAgua: redondear(numero(m.sea_surface_temperature), 1),
    marea: redondear(marea, 1),
    estadoMarea,
  };
}

/** Condiciones actuales para unas coordenadas. Lanza ErrorAmbiente si Open-Meteo no responde. */
async function obtenerAmbiente(latitud, longitud, forzar = false) {
  const clave = `${latitud.toFixed(4)},${longitud.toFixed(4)}`;
  const guardado = cache.get(clave);
  if (!forzar && guardado && Date.now() - guardado.momento < TTL_MS) return guardado.datos;

  const comunes = `latitude=${latitud}&longitude=${longitud}&timeformat=unixtime&timezone=GMT`;
  const [forecast, marine] = await Promise.all([
    pedirJson(`${URL_FORECAST}?${comunes}&current=weather_code,cloud_cover,wind_speed_10m,wind_direction_10m&wind_speed_unit=kmh`),
    pedirJson(`${URL_MARINE}?${comunes}&current=wave_height,sea_surface_temperature,ocean_current_velocity,ocean_current_direction,sea_level_height_msl&hourly=sea_level_height_msl&past_hours=1&forecast_hours=3`),
  ]);

  const datos = interpretar(forecast, marine);
  cache.set(clave, { momento: Date.now(), datos });
  return datos;
}

/** Busca el sitio activo y trae sus condiciones. Lanza SitioInvalido o ErrorAmbiente. */
async function ambienteDelSitio(pool, sitioId, forzar = false) {
  const id = Number(sitioId);
  if (!Number.isInteger(id)) throw new SitioInvalido();
  const resultado = await pool.request()
    .input('id', sql.Int, id)
    .query('SELECT SitioId, Nombre, Latitud, Longitud FROM SitiosBuceo WHERE SitioId = @id AND Activo = 1');
  if (resultado.recordset.length === 0) throw new SitioInvalido();
  const sitio = resultado.recordset[0];
  const ambiente = await obtenerAmbiente(Number(sitio.Latitud), Number(sitio.Longitud), forzar);
  return { sitio, ambiente };
}

module.exports = { obtenerAmbiente, ambienteDelSitio, ErrorAmbiente, SitioInvalido, FUENTE, ATRIBUCION };
