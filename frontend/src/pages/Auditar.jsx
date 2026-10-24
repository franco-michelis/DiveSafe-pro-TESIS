import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

function badgeRiesgo(nivel) {
  if (nivel === 'Alto') return 'badge-danger';
  if (nivel === 'Medio') return 'badge-warn';
  return 'badge-ok';
}

function formatFecha(fechaIso) {
  if (!fechaIso) return '-';
  const d = new Date(fechaIso);
  return d.toLocaleDateString('es-AR');
}

function formatFechaHora(fechaIso) {
  if (!fechaIso) return '-';
  const d = new Date(fechaIso);
  return `${d.toLocaleDateString('es-AR')} ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs`;
}

const NOMBRE_VARIABLE = { Visibilidad: 'visibilidad', TempAgua: 'temperatura del agua', Oleaje: 'oleaje', Corriente: 'corriente' };

function sinDato(valor, unidad) {
  return valor === null || valor === undefined ? 'Sin datos' : `${valor} ${unidad}`;
}

// De dónde salieron las variables ambientales de una planificación (auditoría del origen del dato).
function origenAmbiente(p) {
  if (!p.AmbienteFuente) return 'Condiciones ambientales cargadas a mano (planificación anterior a la conexión con la API).';
  const manuales = (p.AmbienteManual || '').split(',').map((v) => NOMBRE_VARIABLE[v.trim()]).filter(Boolean);
  const hora = new Date(p.AmbienteFechaHora).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short', hour12: false });
  return `Condiciones ambientales de ${p.AmbienteFuente} (dato de ${hora} hs).${manuales.length ? ` Cargadas por el instructor: ${manuales.join(', ')}.` : ''}`;
}

export default function Auditar() {
  const { esAdmin } = useAuth();
  const [planificaciones, setPlanificaciones] = useState([]);
  const [estadisticas, setEstadisticas] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [riesgo, setRiesgo] = useState('');
  const [detalle, setDetalle] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  async function cargarDatos() {
    setCargando(true);
    setError('');
    try {
      const filtros = {};
      if (riesgo) filtros.riesgo = riesgo;
      if (busqueda) filtros.busqueda = busqueda;
      const [lista, stats] = await Promise.all([
        api.listarPlanificaciones(filtros),
        api.obtenerEstadisticas(),
      ]);
      setPlanificaciones(lista);
      setEstadisticas(stats);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setTimeout(cargarDatos, 350); // debounce de búsqueda
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda, riesgo]);

  async function abrirDetalle(id) {
    if (!esAdmin) return;
    try {
      const data = await api.obtenerPlanificacion(id);
      setDetalle(data);
    } catch (err) {
      setError(err.message);
    }
  }

  const iconoAlertaDot = (tipo) => {
    if (tipo === 'Alerta') return 'tl-dot-warn';
    if (tipo === 'Recomendacion') return 'tl-dot-rec';
    return 'tl-dot-info';
  };

  const EQUIPOS_DETALLE = [
    { key: 'EquipoBoya', label: 'Boya SMB', icon: 'ti-balloon' },
    { key: 'EquipoComputadora', label: 'Computadora', icon: 'ti-device-watch' },
    { key: 'EquipoLinterna', label: 'Linterna', icon: 'ti-bulb' },
    { key: 'EquipoCuchillo', label: 'Cuchillo', icon: 'ti-tools-kitchen-2' },
    { key: 'EquipoCamara', label: 'Cámara', icon: 'ti-camera' },
    { key: 'EquipoSilbato', label: 'Silbato', icon: 'ti-bell' },
  ];

  return (
    <div className="screen">
      <div className="screen-header">
        <h2>Auditar registros</h2>
      </div>

      {error && <div className="error-msg"><i className="ti ti-alert-circle" /> {error}</div>}

      {detalle && (
        <div className="audit-detail">
          <div className="ad-header">
            <div>
              <h3>Auditoría — #INM-{String(detalle.planificacion.PlanificacionId).padStart(3, '0')} · {detalle.planificacion.SitioBuceo}</h3>
              <p>
                Planificado por {detalle.planificacion.InstructorNombre} · {formatFechaHora(detalle.planificacion.FechaRegistro)} ·
                {' '}Hash de integridad: {detalle.planificacion.HashIntegridad}
              </p>
            </div>
            <button className="close-btn" onClick={() => setDetalle(null)}><i className="ti ti-x" /> Cerrar</button>
          </div>

          <div className="ad-grid">
            <div className="ad-item"><div className="ad-item-label">Tipo</div><div className="ad-item-val">{detalle.planificacion.TipoInmersion}</div></div>
            <div className="ad-item"><div className="ad-item-label">Entrada al agua</div><div className="ad-item-val">{detalle.planificacion.TipoEntradaAgua}</div></div>
            <div className="ad-item"><div className="ad-item-label">Prof. máx.</div><div className="ad-item-val">{detalle.planificacion.ProfundidadMaxima} m</div></div>
            <div className="ad-item"><div className="ad-item-label">Tiempo estimado</div><div className="ad-item-val">{detalle.planificacion.TiempoEstimado} min</div></div>
            <div className="ad-item"><div className="ad-item-label">Nocturna</div><div className="ad-item-val">{detalle.planificacion.EsBuceoNocturno ? 'Sí' : 'No'}</div></div>
            <div className="ad-item"><div className="ad-item-label">Riesgo asignado</div><div className="ad-item-val"><span className={badgeRiesgo(detalle.planificacion.NivelRiesgo)}>{detalle.planificacion.NivelRiesgo}</span></div></div>

            <div className="ad-item"><div className="ad-item-label">Alumnos</div><div className="ad-item-val">{detalle.planificacion.CantidadAlumnos} · {detalle.planificacion.CertificacionPromedio}</div></div>
            <div className="ad-item"><div className="ad-item-label">Ratio</div><div className="ad-item-val">1:{detalle.planificacion.RatioInstructorAlumno}</div></div>
            <div className="ad-item"><div className="ad-item-label">Inmersiones previas</div><div className="ad-item-val">{detalle.planificacion.InmersionesPrevias || '—'}</div></div>
            <div className="ad-item"><div className="ad-item-label">Asistente / Divemaster</div><div className="ad-item-val">{detalle.planificacion.AsistenteApoyo || '—'}</div></div>
            <div className="ad-item"><div className="ad-item-label">Tanque / mezcla</div><div className="ad-item-val">{detalle.planificacion.TamanoTanque} · {detalle.planificacion.MezclaTanque}</div></div>
            <div className="ad-item"><div className="ad-item-label">Presión / reserva</div><div className="ad-item-val">{detalle.planificacion.PresionInicial} bar / {detalle.planificacion.ReservaMinima} bar</div></div>
            <div className="ad-item"><div className="ad-item-label">Traje</div><div className="ad-item-val">{detalle.planificacion.TipoTraje}</div></div>
            <div className="ad-item"><div className="ad-item-label">Briefing realizado</div><div className="ad-item-val">{detalle.planificacion.BriefingRealizado || '—'}</div></div>

            <div className="ad-item"><div className="ad-item-label">Viento</div><div className="ad-item-val">{detalle.planificacion.Viento} km/h {detalle.planificacion.DireccionViento}</div></div>
            <div className="ad-item"><div className="ad-item-label">Oleaje</div><div className="ad-item-val">{sinDato(detalle.planificacion.Oleaje, 'm')}</div></div>
            <div className="ad-item"><div className="ad-item-label">Corriente</div><div className="ad-item-val">{sinDato(detalle.planificacion.Corriente, 'nud')} {detalle.planificacion.Corriente != null && detalle.planificacion.DireccionCorriente ? `→ ${detalle.planificacion.DireccionCorriente}` : ''}</div></div>
            <div className="ad-item"><div className="ad-item-label">Visibilidad</div><div className="ad-item-val">{detalle.planificacion.Visibilidad} m</div></div>
            <div className="ad-item"><div className="ad-item-label">Marea</div><div className="ad-item-val">{sinDato(detalle.planificacion.Marea, 'm')} {detalle.planificacion.EstadoMarea ? `· ${detalle.planificacion.EstadoMarea}` : ''}</div></div>
            <div className="ad-item"><div className="ad-item-label">Temp. agua</div><div className="ad-item-val">{sinDato(detalle.planificacion.TempAgua, '°C')}</div></div>
            <div className="ad-item"><div className="ad-item-label">Clima</div><div className="ad-item-val">{detalle.planificacion.Clima}</div></div>
            <div className="ad-item"><div className="ad-item-label">Cobertura de nubes</div><div className="ad-item-val">{detalle.planificacion.CoberturaNubes}%</div></div>
          </div>
          <div className="ad-origen">
            <i className="ti ti-cloud-data-connection" /> {origenAmbiente(detalle.planificacion)}
          </div>

          <div style={{ fontSize: 12, color: '#8b949e', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>
            Equipo adicional
          </div>
          <div className="ad-equip-row">
            {EQUIPOS_DETALLE.filter((eq) => detalle.planificacion[eq.key]).length === 0 ? (
              <div className="ad-equip-chip" style={{ color: '#8b949e' }}>Sin equipo adicional registrado</div>
            ) : (
              EQUIPOS_DETALLE.filter((eq) => detalle.planificacion[eq.key]).map((eq) => (
                <div className="ad-equip-chip" key={eq.key}>
                  <i className={`ti ${eq.icon}`} /> {eq.label}
                </div>
              ))
            )}
          </div>

          {detalle.planificacion.NotasAdicionales && (
            <>
              <div style={{ fontSize: 12, color: '#8b949e', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>
                Plan de buceo / observaciones del instructor
              </div>
              <div className="ad-notes">{detalle.planificacion.NotasAdicionales}</div>
            </>
          )}

          <div style={{ fontSize: 12, color: '#8b949e', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>
            Registro de alertas y decisiones
          </div>
          <div className="timeline">
            {detalle.alertas.length === 0 && (
              <div className="timeline-item">
                <div className="tl-dot tl-dot-ok" />
                <div className="tl-content"><strong>Sin advertencias ni recomendaciones.</strong> Todas las variables estuvieron dentro de rango seguro.</div>
              </div>
            )}
            {detalle.alertas.map((a) => (
              <div className="timeline-item" key={a.AlertaId}>
                <div className={`tl-dot ${iconoAlertaDot(a.Tipo)}`} />
                <div className="tl-content">
                  <strong>{a.Tipo === 'Alerta' ? 'Advertencia emitida' : a.Tipo === 'Recomendacion' ? 'Recomendación emitida' : 'Información'} ({a.ReglaAplicada}):</strong>
                  {' '}{a.Mensaje}
                </div>
              </div>
            ))}
            {detalle.planificacion.Justificacion && (
              <div className="timeline-item">
                <div className="tl-dot tl-dot-info" />
                <div className="tl-content">
                  <strong>Decisión del instructor (con justificación):</strong> "{detalle.planificacion.Justificacion}"
                </div>
              </div>
            )}
            <div className="timeline-item">
              <div className="tl-dot tl-dot-ok" />
              <div className="tl-content">
                <strong>Planificación registrada.</strong> Hash de integridad generado: {detalle.planificacion.HashIntegridad}.
              </div>
            </div>
          </div>
        </div>
      )}

      {estadisticas && (
        <div className="stats-bar">
          <div className="stat-card">
            <div className="sc-label">Total planificaciones</div>
            <div className="sc-val">{estadisticas.Total}</div>
            <div className="sc-sub">Registradas en el sistema</div>
          </div>
          <div className="stat-card">
            <div className="sc-label">Riesgo alto</div>
            <div className="sc-val" style={{ color: '#f85149' }}>{estadisticas.RiesgoAlto}</div>
            <div className="sc-sub">Con justificación obligatoria</div>
          </div>
          <div className="stat-card">
            <div className="sc-label">Riesgo medio</div>
            <div className="sc-val" style={{ color: '#d29922' }}>{estadisticas.RiesgoMedio}</div>
            <div className="sc-sub">Con advertencias emitidas</div>
          </div>
          <div className="stat-card">
            <div className="sc-label">Riesgo bajo</div>
            <div className="sc-val" style={{ color: '#3fb950' }}>{estadisticas.RiesgoBajo}</div>
            <div className="sc-sub">Condiciones óptimas</div>
          </div>
        </div>
      )}

      <div className="filters-bar">
        <input
          type="text"
          placeholder="Buscar por sitio o instructor..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <select value={riesgo} onChange={(e) => setRiesgo(e.target.value)}>
          <option value="">Todos los riesgos</option>
          <option value="Bajo">Riesgo bajo</option>
          <option value="Medio">Riesgo medio</option>
          <option value="Alto">Riesgo alto</option>
        </select>
      </div>

      <div className="records-table">
        <div className="rt-header">
          <span>ID</span>
          <span>Sitio</span>
          <span>Instructor</span>
          <span>Fecha</span>
          <span>Riesgo</span>
          <span>Acción</span>
        </div>
        {cargando ? (
          <div className="empty-state">Cargando...</div>
        ) : planificaciones.length === 0 ? (
          <div className="empty-state">No hay planificaciones registradas todavía.</div>
        ) : (
          planificaciones.map((p) => (
            <div className="rt-row" key={p.PlanificacionId}>
              <span className="rt-id">#INM-{String(p.PlanificacionId).padStart(3, '0')}</span>
              <div>
                <div className="rt-site">{p.SitioBuceo}</div>
                <div className="rt-site-sub">{p.TipoInmersion} · {p.CantidadAlumnos} alumnos · {p.ProfundidadMaxima} m</div>
              </div>
              <span className="rt-instructor">{p.InstructorNombre}</span>
              <span className="rt-date">{formatFecha(p.FechaHoraEntrada)}</span>
              <span><span className={badgeRiesgo(p.NivelRiesgo)}>{p.NivelRiesgo}</span></span>
              <button
                className="audit-btn"
                onClick={() => abrirDetalle(p.PlanificacionId)}
                disabled={!esAdmin}
                title={esAdmin ? '' : 'Solo un administrador puede auditar el detalle'}
              >
                <i className={`ti ${esAdmin ? 'ti-file-search' : 'ti-lock'}`} /> Auditar
              </button>
            </div>
          ))
        )}
      </div>

    </div>
  );
}
