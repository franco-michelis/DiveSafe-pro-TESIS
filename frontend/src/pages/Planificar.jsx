import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import PanelAmbiente, { LIMITES_AMBIENTE } from '../components/PanelAmbiente';

// Mismos límites que backend/src/services/validaciones.js
const LIMITES = {
  profundidadMaxima: { min: 1, max: 60 },
  tiempoEstimado: { min: 1, max: 180 },
  cantidadAlumnos: { min: 1, max: 30 },
  presionInicial: { min: 50, max: 300 },
  reservaMinima: { min: 10, max: 100 },
};

const dosDigitos = (n) => String(n).padStart(2, '0');
const minutosDelDia = (fecha) => fecha.getHours() * 60 + fecha.getMinutes();

function fechaLocal(fecha) {
  return `${fecha.getFullYear()}-${dosDigitos(fecha.getMonth() + 1)}-${dosDigitos(fecha.getDate())}`;
}

function horaLocal(fecha) {
  return `${dosDigitos(fecha.getHours())}:${dosDigitos(fecha.getMinutes())}`;
}

// 15 minutos desde ahora, sin pasarse de las 23:59 (la entrada tiene que ser hoy).
function horaPorDefecto(ahora) {
  const minutos = Math.min(minutosDelDia(ahora) + 15, 23 * 60 + 59);
  return `${dosDigitos(Math.floor(minutos / 60))}:${dosDigitos(minutos % 60)}`;
}

// Devuelve { campo: 'mensaje' } con los campos inválidos (vacío si todo está bien).
function validarFormulario(form, ahora = new Date(), ambiente = null) {
  const errores = {};
  const num = (v) => (v === '' || v === null || v === undefined ? NaN : Number(v));
  const fueraDeRango = (v, { min, max }, entero) => (
    !Number.isFinite(v) || v < min || v > max || (entero && !Number.isInteger(v))
  );

  const profundidad = num(form.profundidadMaxima);
  if (fueraDeRango(profundidad, LIMITES.profundidadMaxima, false)) {
    errores.profundidadMaxima = `Ingresá una profundidad entre ${LIMITES.profundidadMaxima.min} y ${LIMITES.profundidadMaxima.max} m.`;
  }

  if (fueraDeRango(num(form.tiempoEstimado), LIMITES.tiempoEstimado, true)) {
    errores.tiempoEstimado = `Ingresá minutos enteros entre ${LIMITES.tiempoEstimado.min} y ${LIMITES.tiempoEstimado.max}.`;
  }

  if (fueraDeRango(num(form.cantidadAlumnos), LIMITES.cantidadAlumnos, true)) {
    errores.cantidadAlumnos = `Ingresá un número entero entre ${LIMITES.cantidadAlumnos.min} y ${LIMITES.cantidadAlumnos.max}.`;
  }

  const presion = num(form.presionInicial);
  const presionValida = !fueraDeRango(presion, LIMITES.presionInicial, true);
  if (!presionValida) {
    errores.presionInicial = `Ingresá un número entero entre ${LIMITES.presionInicial.min} y ${LIMITES.presionInicial.max} bar.`;
  }

  const reserva = num(form.reservaMinima);
  if (fueraDeRango(reserva, LIMITES.reservaMinima, true)) {
    errores.reservaMinima = `Ingresá un número entero entre ${LIMITES.reservaMinima.min} y ${LIMITES.reservaMinima.max} bar.`;
  } else if (presionValida && reserva >= presion) {
    errores.reservaMinima = 'Tiene que ser menor que la presión inicial.';
  }

  // Visibilidad: obligatoria. Temperatura, oleaje y corriente: solo si la API no tiene el dato, y opcionales.
  const fueraDeRangoAmbiente = (campo) => {
    const { min, max, unidad, nombre } = LIMITES_AMBIENTE[campo];
    const v = num(form[campo]);
    return !Number.isFinite(v) || v < min || v > max ? `${nombre} debe estar entre ${min} y ${max} ${unidad}.` : null;
  };
  if (form.visibilidad === '') {
    errores.visibilidad = 'Ingresá la visibilidad bajo el agua.';
  } else {
    const mensaje = fueraDeRangoAmbiente('visibilidad');
    if (mensaje) errores.visibilidad = mensaje;
  }
  ['tempAgua', 'oleaje', 'corriente'].forEach((campo) => {
    const faltaEnApi = ambiente && (ambiente[campo] === null || ambiente[campo] === undefined);
    if (faltaEnApi && form[campo] !== '') {
      const mensaje = fueraDeRangoAmbiente(campo);
      if (mensaje) errores[campo] = mensaje;
    }
  });

  const hora = /^(\d{2}):(\d{2})$/.exec(form.horaEntrada || '');
  if (!hora) {
    errores.horaEntrada = 'Ingresá la hora de entrada al agua.';
  } else if (Number(hora[1]) * 60 + Number(hora[2]) < minutosDelDia(ahora)) {
    errores.horaEntrada = `Esa hora ya pasó. Ingresá un horario a partir de las ${horaLocal(ahora)}.`;
  }

  return errores;
}

// La entrada al agua es siempre hoy: el instructor solo carga la hora.
function armarPayload(form, ahora = new Date()) {
  const { horaEntrada, ...resto } = form;
  return { ...resto, fechaHoraEntrada: `${fechaLocal(ahora)}T${horaEntrada}` };
}

// Campos numéricos que no admiten signo ni notación científica.
const bloquearSignos = (e) => {
  if (['-', '+', 'e', 'E'].includes(e.key)) e.preventDefault();
};

const aNumeroOVacio = (texto) => (texto === '' ? '' : Number(texto));

const estadoInicial = () => ({
  // Sitio y tipo
  sitioId: '',
  tipoInmersion: 'Buceo recreativo',
  tipoEntradaAgua: 'Giant stride',
  profundidadMaxima: 18,
  tiempoEstimado: 45,
  horaEntrada: horaPorDefecto(new Date()),
  esBuceoNocturno: false,

  // Instructor y alumnos
  cantidadAlumnos: 4,
  ratioInstructorAlumno: 4,
  certificacionPromedio: 'Open Water',
  inmersionesPrevias: '6-20',
  asistenteApoyo: '',

  // Equipo y tanque
  tamanoTanque: '12L',
  mezclaTanque: 'Aire',
  presionInicial: 200,
  reservaMinima: 50,
  tipoTraje: 'Humedo7mm',
  equipoBoya: true,
  equipoComputadora: true,
  equipoLinterna: true,
  equipoCuchillo: false,
  equipoCamara: false,
  equipoSilbato: true,

  // Notas
  notasAdicionales: '',
  briefingRealizado: 'Sí — completo',

  // Variables ambientales: las trae la API según el sitio. Solo se cargan a mano la visibilidad
  // bajo el agua (siempre) y, si la API no tiene el dato (lagos, lagunas), temperatura, oleaje y corriente.
  visibilidad: '',
  tempAgua: '',
  oleaje: '',
  corriente: '',
});

const EQUIPOS = [
  { key: 'equipoBoya', label: 'Boya SMB', icon: 'ti-balloon' },
  { key: 'equipoComputadora', label: 'Computadora', icon: 'ti-device-watch' },
  { key: 'equipoLinterna', label: 'Linterna', icon: 'ti-bulb' },
  { key: 'equipoCuchillo', label: 'Cuchillo', icon: 'ti-tools-kitchen-2' },
  { key: 'equipoCamara', label: 'Cámara', icon: 'ti-camera' },
  { key: 'equipoSilbato', label: 'Silbato', icon: 'ti-bell' },
];

export default function Planificar() {
  const [form, setForm] = useState(estadoInicial);
  const [resultado, setResultado] = useState(null); // { alertas, nivelRiesgo, requiereJustificacion }
  const [justificacion, setJustificacion] = useState('');
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [evaluando, setEvaluando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [sitios, setSitios] = useState([]);
  const [cargandoSitios, setCargandoSitios] = useState(true);
  const [ambiente, setAmbiente] = useState(null);
  const [cargandoAmbiente, setCargandoAmbiente] = useState(false);
  const [errorAmbiente, setErrorAmbiente] = useState('');
  const pedidoAmbiente = useRef(0);
  const navigate = useNavigate();

  useEffect(() => {
    api.listarSitios(true)
      .then((lista) => {
        setSitios(lista);
        setForm((prev) => ({ ...prev, sitioId: lista[0]?.SitioId ?? '' }));
      })
      .catch((err) => setError(err.message))
      .finally(() => setCargandoSitios(false));
  }, []);

  // Trae las condiciones del sitio desde la API. Si se pide otro sitio mientras llega la respuesta, se descarta la vieja.
  async function cargarAmbiente(sitioId, forzar = false) {
    const pedido = ++pedidoAmbiente.current;
    setCargandoAmbiente(true);
    setErrorAmbiente('');
    setResultado(null);
    try {
      const datos = await api.obtenerAmbienteSitio(sitioId, forzar);
      if (pedido === pedidoAmbiente.current) setAmbiente(datos);
    } catch (err) {
      if (pedido === pedidoAmbiente.current) setErrorAmbiente(err.message);
    } finally {
      if (pedido === pedidoAmbiente.current) setCargandoAmbiente(false);
    }
  }

  useEffect(() => {
    setAmbiente(null);
    if (form.sitioId) cargarAmbiente(form.sitioId);
    else setErrorAmbiente('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.sitioId]);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setResultado(null); // si cambia algo, invalidamos la evaluación anterior
    setExito('');
  }

  // Al cambiar de sitio se descartan los valores cargados a mano para el sitio anterior.
  function cambiarSitio(sitioId) {
    setForm((prev) => ({ ...prev, sitioId, tempAgua: '', oleaje: '', corriente: '' }));
    setResultado(null);
    setExito('');
  }

  function toggleEquipo(key) {
    update(key, !form[key]);
  }

  // Se recalcula en cada render; al evaluar/registrar se vuelve a calcular con la hora exacta de ese momento.
  const errores = validarFormulario(form, new Date(), ambiente);
  const sinAmbiente = !ambiente || Boolean(errorAmbiente);
  const hayErrores = Object.keys(errores).length > 0 || sinAmbiente;

  async function handleEvaluar() {
    setError('');
    const ahora = new Date();
    const erroresAhora = validarFormulario(form, ahora, ambiente);
    if (Object.keys(erroresAhora).length > 0 || sinAmbiente) {
      setError('Revisá los campos marcados en rojo antes de evaluar el riesgo.');
      return;
    }
    setEvaluando(true);
    try {
      const data = await api.evaluarRiesgo(armarPayload(form, ahora));
      setResultado(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setEvaluando(false);
    }
  }

  async function handleRegistrar() {
    setError('');
    const ahora = new Date();
    const erroresAhora = validarFormulario(form, ahora, ambiente);
    if (Object.keys(erroresAhora).length > 0 || sinAmbiente) {
      setResultado(null);
      setError(erroresAhora.horaEntrada || 'Revisá los campos marcados en rojo antes de registrar.');
      return;
    }
    setGuardando(true);
    try {
      await api.registrarPlanificacion({ ...armarPayload(form, ahora), justificacion });
      setExito('Planificación registrada correctamente. Ya está disponible en el módulo de auditoría.');
      setForm({ ...estadoInicial(), sitioId: sitios[0]?.SitioId ?? '' });
      setResultado(null);
      setJustificacion('');
      setTimeout(() => navigate('/auditar'), 1600);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  const iconoTipo = (tipo) => {
    if (tipo === 'Alerta') return 'ti-alert-triangle';
    if (tipo === 'Recomendacion') return 'ti-bulb';
    return 'ti-info-circle';
  };
  const claseTipo = (tipo) => {
    if (tipo === 'Alerta') return 'alert-item';
    if (tipo === 'Recomendacion') return 'alert-item recomendacion';
    return 'alert-item info';
  };
  const claseRiesgo = (nivel) => {
    if (nivel === 'Alto') return 'risk-score-high';
    if (nivel === 'Medio') return 'risk-score-med';
    return 'risk-score-low';
  };

  return (
    <div className="screen">
      <div className="screen-header">
        <h2>Planificar inmersión</h2>
      </div>

      {error && <div className="error-msg"><i className="ti ti-alert-circle" /> {error}</div>}
      {exito && <div className="success-msg"><i className="ti ti-circle-check" /> {exito}</div>}

      <div className="plan-grid">
        {/* Sitio y tipo */}
        <div className="form-section">
          <h3><i className="ti ti-map-pin" /> Sitio y tipo</h3>
          <div className="form-row">
            <label>Sitio de buceo</label>
            <select
              value={form.sitioId}
              onChange={(e) => cambiarSitio(Number(e.target.value))}
              disabled={sitios.length === 0}
            >
              {sitios.length === 0 && (
                <option value="">{cargandoSitios ? 'Cargando...' : 'No hay sitios cargados'}</option>
              )}
              {sitios.map((s) => (
                <option key={s.SitioId} value={s.SitioId}>{s.Nombre}</option>
              ))}
            </select>
            {!cargandoSitios && sitios.length === 0 && (
              <div style={{ fontSize: 11, color: '#d29922', marginTop: 6 }}>
                Un administrador tiene que cargar al menos un sitio en el módulo "Sitios".
              </div>
            )}
          </div>
          <div className="form-row">
            <label>Tipo de inmersión</label>
            <select value={form.tipoInmersion} onChange={(e) => update('tipoInmersion', e.target.value)}>
              <option>Buceo recreativo</option>
              <option>Curso de iniciación</option>
              <option>Advanced OW</option>
              <option>Divemaster</option>
            </select>
          </div>
          <div className="form-row">
            <label>Tipo de entrada al agua</label>
            <select value={form.tipoEntradaAgua} onChange={(e) => update('tipoEntradaAgua', e.target.value)}>
              <option>Shore entry</option>
              <option>Giant stride</option>
              <option>Back roll</option>
              <option>Descenso negativo</option>
            </select>
          </div>
          <div className="form-row-2">
            <div className="form-row" style={{ marginBottom: 0 }}>
              <label>Prof. máx. esperada (m)</label>
              <input
                type="number"
                className={errores.profundidadMaxima ? 'invalid' : ''}
                min={LIMITES.profundidadMaxima.min}
                max={LIMITES.profundidadMaxima.max}
                step="0.1"
                value={form.profundidadMaxima}
                onKeyDown={bloquearSignos}
                onChange={(e) => update('profundidadMaxima', aNumeroOVacio(e.target.value))}
              />
              {errores.profundidadMaxima && <div className="field-error">{errores.profundidadMaxima}</div>}
            </div>
            <div className="form-row" style={{ marginBottom: 0 }}>
              <label>Tiempo estimado (min)</label>
              <input
                type="number"
                className={errores.tiempoEstimado ? 'invalid' : ''}
                min={LIMITES.tiempoEstimado.min}
                max={LIMITES.tiempoEstimado.max}
                step="1"
                value={form.tiempoEstimado}
                onKeyDown={bloquearSignos}
                onChange={(e) => update('tiempoEstimado', aNumeroOVacio(e.target.value))}
              />
              {errores.tiempoEstimado && <div className="field-error">{errores.tiempoEstimado}</div>}
            </div>
          </div>
          <div className="form-row">
            <label>Hora de entrada al agua (hoy, {new Date().toLocaleDateString('es-AR')})</label>
            <input
              type="time"
              className={errores.horaEntrada ? 'invalid' : ''}
              value={form.horaEntrada}
              onChange={(e) => update('horaEntrada', e.target.value)}
            />
            {errores.horaEntrada && <div className="field-error">{errores.horaEntrada}</div>}
          </div>
          <div className="checkbox-row">
            <input type="checkbox" id="nocturno" checked={form.esBuceoNocturno} onChange={(e) => update('esBuceoNocturno', e.target.checked)} />
            <label htmlFor="nocturno">¿Es una inmersión nocturna o de baja luz?</label>
          </div>
        </div>

        {/* Alumnos (el instructor es el usuario logueado) */}
        <div className="form-section">
          <h3><i className="ti ti-users" /> Alumnos y ratio</h3>
          <div className="form-row-2">
            <div className="form-row" style={{ marginBottom: 0 }}>
              <label>Cantidad de alumnos</label>
              <input
                type="number"
                className={errores.cantidadAlumnos ? 'invalid' : ''}
                min={LIMITES.cantidadAlumnos.min}
                max={LIMITES.cantidadAlumnos.max}
                step="1"
                value={form.cantidadAlumnos}
                onKeyDown={bloquearSignos}
                onChange={(e) => update('cantidadAlumnos', aNumeroOVacio(e.target.value))}
              />
              {errores.cantidadAlumnos && <div className="field-error">{errores.cantidadAlumnos}</div>}
            </div>
            <div className="form-row" style={{ marginBottom: 0 }}>
              <label>Ratio instructor:alumno</label>
              <select value={form.ratioInstructorAlumno} onChange={(e) => update('ratioInstructorAlumno', Number(e.target.value))}>
                {[2, 3, 4, 5, 6, 8, 10].map(n => <option key={n} value={n}>1:{n}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <label>Certificación promedio del grupo</label>
            <select value={form.certificacionPromedio} onChange={(e) => update('certificacionPromedio', e.target.value)}>
              <option>Sin certificación</option>
              <option>Open Water</option>
              <option>Advanced OW</option>
              <option>Rescue Diver</option>
              <option>Dive Master</option>
            </select>
          </div>
          <div className="form-row">
            <label>Inmersiones previas promedio</label>
            <select value={form.inmersionesPrevias} onChange={(e) => update('inmersionesPrevias', e.target.value)}>
              <option value="0-5">0–5 inmersiones</option>
              <option value="6-20">6–20 inmersiones</option>
              <option value="21-50">21–50 inmersiones</option>
              <option value="+50">+50 inmersiones</option>
            </select>
          </div>
          <div className="form-row">
            <label>Asistente / Divemaster de apoyo (opcional)</label>
            <input type="text" value={form.asistenteApoyo} onChange={(e) => update('asistenteApoyo', e.target.value)} maxLength={150} placeholder="Nombre del asistente" />
          </div>
        </div>

        {/* Equipo y tanque */}
        <div className="form-section">
          <h3><i className="ti ti-bottle" /> Equipo y tanque</h3>
          <div className="form-row-2">
            <div className="form-row" style={{ marginBottom: 0 }}>
              <label>Tamaño del tanque</label>
              <select value={form.tamanoTanque} onChange={(e) => update('tamanoTanque', e.target.value)}>
                <option value="10L">10 L</option>
                <option value="12L">12 L</option>
                <option value="15L">15 L</option>
                <option value="2x12L">2 × 12 L (dobles)</option>
              </select>
            </div>
            <div className="form-row" style={{ marginBottom: 0 }}>
              <label>Mezcla del tanque</label>
              <select value={form.mezclaTanque} onChange={(e) => update('mezclaTanque', e.target.value)}>
                <option value="Aire">Aire (21% O₂)</option>
                <option value="Nitrox32">Nitrox 32%</option>
                <option value="Nitrox36">Nitrox 36%</option>
                <option value="Trimix">Trimix</option>
              </select>
            </div>
          </div>
          <div className="form-row-2">
            <div className="form-row" style={{ marginBottom: 0 }}>
              <label>Presión inicial (bar)</label>
              <input
                type="number"
                className={errores.presionInicial ? 'invalid' : ''}
                min={LIMITES.presionInicial.min}
                max={LIMITES.presionInicial.max}
                step="1"
                value={form.presionInicial}
                onKeyDown={bloquearSignos}
                onChange={(e) => update('presionInicial', aNumeroOVacio(e.target.value))}
              />
              {errores.presionInicial && <div className="field-error">{errores.presionInicial}</div>}
            </div>
            <div className="form-row" style={{ marginBottom: 0 }}>
              <label>Reserva mínima (bar)</label>
              <input
                type="number"
                className={errores.reservaMinima ? 'invalid' : ''}
                min={LIMITES.reservaMinima.min}
                max={LIMITES.reservaMinima.max}
                step="1"
                value={form.reservaMinima}
                onKeyDown={bloquearSignos}
                onChange={(e) => update('reservaMinima', aNumeroOVacio(e.target.value))}
              />
              {errores.reservaMinima && <div className="field-error">{errores.reservaMinima}</div>}
            </div>
          </div>
          <div className="form-row">
            <label>Tipo de traje</label>
            <select value={form.tipoTraje} onChange={(e) => update('tipoTraje', e.target.value)}>
              <option value="Humedo3mm">Húmedo 3 mm</option>
              <option value="Humedo5mm">Húmedo 5 mm</option>
              <option value="Humedo7mm">Húmedo 7 mm</option>
              <option value="Semiseco">Semi-seco</option>
              <option value="Seco">Seco</option>
              <option value="SinTraje">Sin traje</option>
            </select>
          </div>
          <div className="form-row" style={{ marginBottom: 6 }}><label>Equipo adicional</label></div>
          <div className="equip-grid">
            {EQUIPOS.map((eq) => (
              <label key={eq.key} className={`equip-check ${form[eq.key] ? 'checked' : ''}`} onClick={() => toggleEquipo(eq.key)}>
                <input type="checkbox" checked={form[eq.key]} readOnly />
                <i className={`ti ${eq.icon}`} /> {eq.label}
              </label>
            ))}
          </div>
        </div>

        {/* Notas */}
        <div className="form-section">
          <h3><i className="ti ti-notes" /> Notas adicionales</h3>
          <div className="form-row">
            <label>Plan de buceo / observaciones del instructor</label>
            <textarea
              style={{ minHeight: 165 }}
              value={form.notasAdicionales}
              maxLength={4000}
              onChange={(e) => update('notasAdicionales', e.target.value)}
              placeholder="Ej: Descenso por la línea de fondeo hasta el primer arrecife. Recorrido N-S siguiendo la pared hasta los 18 m..."
            />
          </div>
          <div className="form-row">
            <label>Briefing realizado con alumnos</label>
            <select value={form.briefingRealizado} onChange={(e) => update('briefingRealizado', e.target.value)}>
              <option>Sí — completo</option>
              <option>Sí — abreviado (grupo experimentado)</option>
              <option>Pendiente</option>
            </select>
          </div>
        </div>

        {/* Condiciones ambientales: las trae la API según las coordenadas del sitio (solo lectura) */}
        <div className="form-section full">
          <h3><i className="ti ti-cloud" /> Condiciones ambientales</h3>
          <div className="env-note">
            <i className="ti ti-info-circle" />
            Estas condiciones se obtienen en tiempo real para las coordenadas del sitio elegido y no se pueden modificar.
            Solo cargás a mano la visibilidad bajo el agua y, si la API no tiene el dato (lagos y lagunas), lo que falte del agua.
          </div>
          <PanelAmbiente
            sitio={sitios.find((s) => s.SitioId === form.sitioId)}
            ambiente={ambiente}
            cargando={cargandoAmbiente}
            error={errorAmbiente}
            onActualizar={() => cargarAmbiente(form.sitioId, true)}
            form={form}
            errores={errores}
            onManual={update}
            bloquearSignos={bloquearSignos}
          />
        </div>
      </div>

      <div className="evaluate-bar">
        <div className="evaluate-bar-info">
          Una vez completados los datos, el sistema cruza la información ingresada con las condiciones
          ambientales y las reglas basadas en estándares de <strong>PADI, SNSI y NAUI</strong> para asignar un nivel de riesgo.
        </div>
        <button className="btn-primary" onClick={handleEvaluar} disabled={evaluando || !form.sitioId || hayErrores}>
          <i className="ti ti-shield-check" /> {evaluando ? 'Evaluando...' : 'Evaluar riesgo'}
        </button>
      </div>

      {resultado && (
        <div className="risk-panel">
          <div className="risk-header">
            <h3>Evaluación de riesgo automática</h3>
            <span className={claseRiesgo(resultado.nivelRiesgo)}>RIESGO {resultado.nivelRiesgo.toUpperCase()}</span>
          </div>

          {resultado.alertas.length === 0 ? (
            <div className="no-alerts">
              <i className="ti ti-circle-check" />
              No se detectaron advertencias ni recomendaciones para las condiciones cargadas.
            </div>
          ) : (
            <div className="alerts-grid">
              {resultado.alertas.map((a) => (
                <div className={claseTipo(a.tipo)} key={a.regla}>
                  <i className={`ti ${iconoTipo(a.tipo)}`} />
                  <div>
                    <strong>{a.tipo === 'Alerta' ? 'Advertencia' : a.tipo === 'Recomendacion' ? 'Recomendación' : 'Info'} ({a.regla}):</strong>
                    {a.mensaje}
                  </div>
                </div>
              ))}
            </div>
          )}

          {resultado.requiereJustificacion ? (
            <div className="justification-area">
              <p><i className="ti ti-alert-circle" /> Existen advertencias activas. Para registrar, tenés que justificar tu decisión. Queda guardado de forma permanente.</p>
              <textarea
                value={justificacion}
                maxLength={4000}
                onChange={(e) => setJustificacion(e.target.value)}
                placeholder="Ej: Se verificó con todos los alumnos el uso de traje de 7mm. La inmersión se planificó para finalizar antes del pico de corriente..."
              />
              <button className="btn-success" onClick={handleRegistrar} disabled={guardando || !justificacion.trim()}>
                <i className="ti ti-lock" /> {guardando ? 'Registrando...' : 'Registrar planificación'}
              </button>
            </div>
          ) : (
            <button className="btn-success" onClick={handleRegistrar} disabled={guardando} style={{ marginTop: 16 }}>
              <i className="ti ti-lock" /> {guardando ? 'Registrando...' : 'Registrar planificación'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
