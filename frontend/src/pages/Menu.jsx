import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { ARGENTINA_BOUNDS, crearMapaArgentina, pinIcon } from '../mapa';

const NIVELES = ['Alto', 'Medio', 'Bajo'];

// Color del pin = nivel de riesgo más frecuente; en caso de empate gana el más grave.
function claseSitio(s) {
  if (s.Total === 0) return 'sin-datos';
  if (s.Alto >= s.Medio && s.Alto >= s.Bajo) return 'alto';
  if (s.Medio >= s.Bajo) return 'medio';
  return 'bajo';
}

function escapeHtml(texto) {
  return String(texto).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function tarjetaHtml(s) {
  const titulo = `<div class="mc-title">${escapeHtml(s.Nombre)}</div>`;
  if (s.Total === 0) {
    return `${titulo}<div class="mc-empty">No hay planificaciones registradas aquí</div>`;
  }
  const barra = NIVELES.filter((n) => s[n] > 0)
    .map((n) => `<span class="mc-seg ${n.toLowerCase()}" style="width:${(s[n] / s.Total) * 100}%"></span>`)
    .join('');
  const filas = NIVELES.map((n) => (s[n] > 0
    ? `<div class="mc-row"><span class="mc-dot ${n.toLowerCase()}"></span><span class="mc-lvl">${n}</span><span class="mc-val">${Math.round((s[n] / s.Total) * 100)}% · ${s[n]}</span></div>`
    : `<div class="mc-row mc-none"><span class="mc-dot ${n.toLowerCase()}"></span>No hay planificaciones de riesgo ${n} aquí</div>`
  )).join('');
  return `${titulo}<div class="mc-sub">${s.Total === 1 ? '1 planificación' : `${s.Total} planificaciones`}</div><div class="mc-bar">${barra}</div>${filas}`;
}

function formatFecha(iso) {
  return new Date(iso).toLocaleDateString('es-AR');
}

// Posiciones posibles de la tarjeta respecto de su pin, en orden de preferencia.
// A los costados puede correrse hacia arriba/abajo; arriba/abajo puede correrse hacia los lados.
function candidatos(ancho, alto) {
  const dy = alto * 0.6;
  const dx = ancho * 0.55;
  return [
    { direction: 'right', offset: [6, 0] },
    { direction: 'left', offset: [-6, 0] },
    { direction: 'right', offset: [6, -dy] },
    { direction: 'right', offset: [6, dy] },
    { direction: 'left', offset: [-6, -dy] },
    { direction: 'left', offset: [-6, dy] },
    { direction: 'top', offset: [0, -14] },
    { direction: 'bottom', offset: [0, -4] },
    { direction: 'top', offset: [-dx, -14] },
    { direction: 'top', offset: [dx, -14] },
    { direction: 'bottom', offset: [-dx, -4] },
    { direction: 'bottom', offset: [dx, -4] },
  ];
}

function areaSolapada(a, b) {
  const ancho = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const alto = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return ancho > 0 && alto > 0 ? ancho * alto : 0;
}

// Para cada tarjeta elige el lado donde menos se pisa con otras tarjetas, con otros pines y con el borde del mapa.
function acomodarTarjetas(map, marcadores) {
  const caja = map.getContainer().getBoundingClientRect();
  const pines = marcadores.map((m) => m.getElement().getBoundingClientRect());
  const ocupados = [];
  const orden = marcadores
    .map((m, i) => ({ m, i, p: map.latLngToContainerPoint(m.getLatLng()) }))
    .sort((a, b) => a.p.y - b.p.y || a.p.x - b.p.x);

  orden.forEach(({ m, i }) => {
    const tooltip = m.getTooltip();
    const el = tooltip.getElement();
    let mejor = null;
    for (const lado of candidatos(el.offsetWidth, el.offsetHeight)) {
      tooltip.options.direction = lado.direction;
      tooltip.options.offset = L.point(lado.offset);
      tooltip.update();
      const r = tooltip.getElement().getBoundingClientRect();
      let penalidad = 0;
      ocupados.forEach((o) => { penalidad += areaSolapada(r, o); });
      pines.forEach((p, j) => { if (j !== i) penalidad += areaSolapada(r, p) * 4; });
      penalidad += (r.width * r.height) - areaSolapada(r, caja);
      if (!mejor || penalidad < mejor.penalidad) mejor = { lado, penalidad };
      if (penalidad === 0) break;
    }
    tooltip.options.direction = mejor.lado.direction;
    tooltip.options.offset = L.point(mejor.lado.offset);
    tooltip.update();
    ocupados.push(tooltip.getElement().getBoundingClientRect());
  });
}

export default function Menu() {
  const { esAdmin } = useAuth();
  const [sitios, setSitios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mostrarTarjetas, setMostrarTarjetas] = useState(true);

  const mapaDiv = useRef(null);
  const mapa = useRef(null);
  const capaSitios = useRef(null);
  const yaAjustado = useRef(false);
  const marcadores = useRef([]);

  useEffect(() => {
    api.obtenerMapaSitios()
      .then(setSitios)
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    const map = crearMapaArgentina(mapaDiv.current);
    capaSitios.current = L.layerGroup().addTo(map);
    mapa.current = map;
    yaAjustado.current = false;
    return () => {
      map.remove();
      mapa.current = null;
    };
  }, []);

  function ajustarASitios() {
    const map = mapa.current;
    if (!map) return;
    if (sitios.length === 0) {
      map.fitBounds(ARGENTINA_BOUNDS);
      return;
    }
    map.fitBounds(L.latLngBounds(sitios.map((s) => [s.Latitud, s.Longitud])), {
      paddingTopLeft: [60, 120],
      paddingBottomRight: [60, 120],
      maxZoom: 8,
    });
  }

  useEffect(() => {
    if (!capaSitios.current) return;
    capaSitios.current.clearLayers();
    marcadores.current = sitios.map((s) => L.marker([s.Latitud, s.Longitud], { icon: pinIcon(claseSitio(s)) })
      .bindTooltip(tarjetaHtml(s), {
        permanent: mostrarTarjetas,
        interactive: true,
        direction: 'right',
        className: 'mapa-card',
        opacity: 1,
      })
      .addTo(capaSitios.current));
    if (!yaAjustado.current && sitios.length > 0) {
      yaAjustado.current = true;
      ajustarASitios();
    }
    if (mostrarTarjetas && marcadores.current.length > 0) acomodarTarjetas(mapa.current, marcadores.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sitios, mostrarTarjetas]);

  // Al mover o hacer zoom, las posiciones relativas cambian: se vuelven a acomodar las tarjetas.
  useEffect(() => {
    const map = mapa.current;
    if (!map || !mostrarTarjetas) return undefined;
    const reacomodar = () => {
      if (marcadores.current.length > 0) acomodarTarjetas(map, marcadores.current);
    };
    map.on('zoomend moveend', reacomodar);
    return () => map.off('zoomend moveend', reacomodar);
  }, [mostrarTarjetas]);

  const totalPlanificaciones = sitios.reduce((suma, s) => suma + s.Total, 0);
  const totalAlto = sitios.reduce((suma, s) => suma + s.Alto, 0);
  const ultima = sitios
    .filter((s) => s.UltimaPlanificacion)
    .sort((a, b) => new Date(b.UltimaPlanificacion) - new Date(a.UltimaPlanificacion))[0];

  return (
    <div className="screen">
      <div className="screen-header">
        <h2>Mapa de riesgo por sitio</h2>
      </div>

      {error && <div className="error-msg"><i className="ti ti-alert-circle" /> {error}</div>}

      <div className="stats-bar">
        <div className="stat-card">
          <div className="sc-label">Sitios activos</div>
          <div className="sc-val">{sitios.length}</div>
          <div className="sc-sub">Con ubicación cargada</div>
        </div>
        <div className="stat-card">
          <div className="sc-label">Planificaciones</div>
          <div className="sc-val">{totalPlanificaciones}</div>
          <div className="sc-sub">Registradas en estos sitios</div>
        </div>
        <div className="stat-card">
          <div className="sc-label">Riesgo alto</div>
          <div className="sc-val" style={{ color: '#f85149' }}>{totalAlto}</div>
          <div className="sc-sub">
            {totalPlanificaciones > 0 ? `${Math.round((totalAlto / totalPlanificaciones) * 100)}% del total` : 'Sin planificaciones todavía'}
          </div>
        </div>
        <div className="stat-card">
          <div className="sc-label">Última planificación</div>
          <div className="sc-val" style={{ fontSize: 20 }}>{ultima ? formatFecha(ultima.UltimaPlanificacion) : '—'}</div>
          <div className="sc-sub">{ultima ? ultima.Nombre : 'Sin planificaciones todavía'}</div>
        </div>
      </div>

      {!cargando && sitios.length === 0 && !error && (
        <div className="env-note" style={{ marginBottom: 14 }}>
          <i className="ti ti-info-circle" />
          <span>
            Todavía no hay sitios de buceo activos.{' '}
            {esAdmin
              ? <>Cargalos en el módulo <Link to="/sitios" style={{ color: '#58a6ff' }}>Sitios</Link> para verlos acá.</>
              : 'Un administrador tiene que cargarlos para verlos acá.'}
          </span>
        </div>
      )}

      <div className="map-toolbar">
        <div className="map-legend">
          <span><i className="map-legend-dot bajo" /> Mayoría riesgo bajo</span>
          <span><i className="map-legend-dot medio" /> Mayoría riesgo medio</span>
          <span><i className="map-legend-dot alto" /> Mayoría riesgo alto</span>
          <span><i className="map-legend-dot sin-datos" /> Sin planificaciones</span>
          <span className="map-legend-note">En caso de empate se muestra el más grave.</span>
        </div>
        <div className="map-toolbar-actions">
          <button className="btn-secondary" onClick={() => mapa.current?.fitBounds(ARGENTINA_BOUNDS)}>
            <i className="ti ti-world" /> Argentina completa
          </button>
          <button className="btn-secondary" onClick={ajustarASitios} disabled={sitios.length === 0}>
            <i className="ti ti-focus-2" /> Ajustar a los sitios
          </button>
          <button className="btn-secondary" onClick={() => setMostrarTarjetas((v) => !v)}>
            <i className={`ti ${mostrarTarjetas ? 'ti-eye-off' : 'ti-eye'}`} /> {mostrarTarjetas ? 'Ocultar tarjetas' : 'Mostrar tarjetas'}
          </button>
        </div>
      </div>

      <div className="map-box menu-map" ref={mapaDiv} />
    </div>
  );
}
