import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { api } from '../api';
import { ARGENTINA, crearMapaArgentina, pinIcon } from '../mapa';

const FORM_VACIO = { id: null, nombre: '', latitud: '', longitud: '' };

// Acepta coma o punto decimal. Devuelve null si todavía no es un número válido.
function parseCoord(texto, min, max) {
  const limpio = String(texto).trim().replace(',', '.');
  if (limpio === '' || !/^-?\d+(\.\d+)?$/.test(limpio)) return null;
  const n = Number(limpio);
  return n >= min && n <= max ? n : null;
}

export default function Sitios() {
  const [sitios, setSitios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [form, setForm] = useState(FORM_VACIO);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [guardando, setGuardando] = useState(false);

  const mapaDiv = useRef(null);
  const mapa = useRef(null);
  const capaSitios = useRef(null);
  const marcadorPreview = useRef(null);

  const lat = parseCoord(form.latitud, -90, 90);
  const lon = parseCoord(form.longitud, -180, 180);
  const hayPunto = lat !== null && lon !== null;
  const fueraDeArgentina = hayPunto && (
    lat < ARGENTINA.latMin || lat > ARGENTINA.latMax || lon < ARGENTINA.lonMin || lon > ARGENTINA.lonMax
  );

  async function cargar() {
    setCargando(true);
    try {
      setSitios(await api.listarSitios());
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargar(); }, []);

  // Crea el mapa una sola vez
  useEffect(() => {
    const map = crearMapaArgentina(mapaDiv.current);
    capaSitios.current = L.layerGroup().addTo(map);
    mapa.current = map;
    return () => {
      map.remove();
      mapa.current = null;
      marcadorPreview.current = null;
    };
  }, []);

  // Pines de los sitios ya creados (el que se está editando se muestra como vista previa)
  useEffect(() => {
    if (!capaSitios.current) return;
    capaSitios.current.clearLayers();
    sitios
      .filter((s) => s.Activo && s.SitioId !== form.id)
      .forEach((s) => {
        L.marker([s.Latitud, s.Longitud], { icon: pinIcon('saved'), title: s.Nombre })
          .bindTooltip(s.Nombre, { direction: 'top', offset: [0, -28] })
          .addTo(capaSitios.current);
      });
  }, [sitios, form.id]);

  // Punto en vivo mientras se escriben las coordenadas
  useEffect(() => {
    const map = mapa.current;
    if (!map) return;
    if (!hayPunto) {
      if (marcadorPreview.current) {
        marcadorPreview.current.remove();
        marcadorPreview.current = null;
      }
      return;
    }
    if (!marcadorPreview.current) {
      marcadorPreview.current = L.marker([lat, lon], { icon: pinIcon('preview'), zIndexOffset: 1000 }).addTo(map);
    } else {
      marcadorPreview.current.setLatLng([lat, lon]);
    }
    if (!map.getBounds().contains([lat, lon])) {
      map.setView([lat, lon], Math.max(map.getZoom(), 6));
    }
  }, [lat, lon, hayPunto]);

  function cambiar(campo, valor) {
    setForm((prev) => ({ ...prev, [campo]: valor }));
    setError('');
    setExito('');
  }

  function empezarEdicion(s) {
    setForm({ id: s.SitioId, nombre: s.Nombre, latitud: String(s.Latitud), longitud: String(s.Longitud) });
    setError('');
    setExito('');
  }

  function cancelar() {
    setForm(FORM_VACIO);
    setError('');
  }

  async function handleGuardar(e) {
    e.preventDefault();
    setError('');
    setExito('');
    if (!hayPunto) {
      setError('Ingresá una latitud (entre -90 y 90) y una longitud (entre -180 y 180) válidas.');
      return;
    }
    setGuardando(true);
    try {
      const datos = { nombre: form.nombre, latitud: lat, longitud: lon };
      if (form.id) {
        await api.editarSitio(form.id, datos);
        setExito(`Sitio "${form.nombre.trim()}" actualizado correctamente.`);
      } else {
        await api.crearSitio(datos);
        setExito(`Sitio "${form.nombre.trim()}" creado correctamente.`);
      }
      setForm(FORM_VACIO);
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function handleToggleActivo(s) {
    setError('');
    setExito('');
    try {
      await api.cambiarEstadoSitio(s.SitioId, !s.Activo);
      if (form.id === s.SitioId) setForm(FORM_VACIO);
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  function verEnMapa(s) {
    mapa.current?.setView([s.Latitud, s.Longitud], 10);
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <h2>Sitios de buceo</h2>
      </div>

      {error && <div className="error-msg"><i className="ti ti-alert-circle" /> {error}</div>}
      {exito && <div className="success-msg"><i className="ti ti-circle-check" /> {exito}</div>}

      <div className="sitios-layout">
        <div className="map-box" ref={mapaDiv} />

        <div className="form-section">
          <h3>
            <i className={`ti ${form.id ? 'ti-edit' : 'ti-map-pin-plus'}`} />
            {form.id ? 'Editar sitio' : 'Nuevo sitio'}
          </h3>
          <form onSubmit={handleGuardar}>
            <div className="form-row">
              <label>Nombre del lugar</label>
              <input
                type="text"
                value={form.nombre}
                onChange={(e) => cambiar('nombre', e.target.value)}
                placeholder="Ej: Punta Pirámide"
                maxLength={150}
                required
              />
            </div>
            <div className="form-row-2">
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label>Latitud</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.latitud}
                  onChange={(e) => cambiar('latitud', e.target.value)}
                  placeholder="-42.770000"
                  required
                />
              </div>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label>Longitud</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.longitud}
                  onChange={(e) => cambiar('longitud', e.target.value)}
                  placeholder="-65.040000"
                  required
                />
              </div>
            </div>
            <div className="env-note" style={{ marginTop: 12 }}>
              <i className="ti ti-info-circle" />
              En Argentina la latitud y la longitud son negativas (grados decimales). Mientras las escribís,
              el punto naranja muestra dónde quedaría en el mapa.
            </div>
            {fueraDeArgentina && (
              <div className="error-msg">
                <i className="ti ti-alert-triangle" /> Esas coordenadas caen fuera de Argentina. Revisá los signos y el orden (latitud primero).
              </div>
            )}
            <div className="sitio-form-actions">
              {form.id && (
                <button type="button" className="btn-secondary" onClick={cancelar}>Cancelar</button>
              )}
              <button type="submit" className="btn-primary" disabled={guardando}>
                <i className="ti ti-device-floppy" /> {guardando ? 'Guardando...' : form.id ? 'Guardar cambios' : 'Crear sitio'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="users-table">
        <div className="st-header">
          <span>Nombre</span>
          <span>Latitud</span>
          <span>Longitud</span>
          <span>Estado</span>
          <span>Acciones</span>
        </div>
        {cargando ? (
          <div className="empty-state">Cargando...</div>
        ) : sitios.length === 0 ? (
          <div className="empty-state">Todavía no hay sitios de buceo cargados. Creá el primero con el formulario.</div>
        ) : (
          sitios.map((s) => (
            <div className="st-row" key={s.SitioId}>
              <span>{s.Nombre}</span>
              <span className="st-coord">{Number(s.Latitud).toFixed(6)}</span>
              <span className="st-coord">{Number(s.Longitud).toFixed(6)}</span>
              <span>
                {s.Activo ? <span className="badge-ok">Activo</span> : <span className="badge-danger">Inactivo</span>}
              </span>
              <div className="ut-actions">
                <button className="icon-btn" title="Ver en el mapa" onClick={() => verEnMapa(s)}>
                  <i className="ti ti-map-search" />
                </button>
                <button className="icon-btn" title="Editar" onClick={() => empezarEdicion(s)}>
                  <i className="ti ti-edit" />
                </button>
                <button
                  className={`icon-btn ${s.Activo ? 'danger' : ''}`}
                  title={s.Activo ? 'Desactivar' : 'Reactivar'}
                  onClick={() => handleToggleActivo(s)}
                >
                  <i className={`ti ${s.Activo ? 'ti-map-pin-off' : 'ti-map-pin-check'}`} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
