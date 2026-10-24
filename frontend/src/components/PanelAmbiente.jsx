// Mismos límites que backend/src/services/validaciones.js (LIMITES_AMBIENTE_MANUAL)
export const LIMITES_AMBIENTE = {
  visibilidad: { min: 0, max: 60, unidad: 'm', nombre: 'La visibilidad' },
  tempAgua: { min: -2, max: 40, unidad: '°C', nombre: 'La temperatura del agua' },
  oleaje: { min: 0, max: 15, unidad: 'm', nombre: 'El oleaje' },
  corriente: { min: 0, max: 10, unidad: 'nudos', nombre: 'La corriente' },
};

const num = (v) => (v === '' || v === null || v === undefined ? NaN : Number(v));
const formato = (n, decimales = 1) => Number(n).toLocaleString('es-AR', { maximumFractionDigits: decimales });
const horaLocal = (iso) => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });

// Las etiquetas de color replican los umbrales de las reglas de evaluación (viento y marea no tienen regla).
const BADGE = {
  clima: (c) => ({ Soleado: { texto: 'Soleado', tipo: 'ok' }, Nublado: { texto: 'Nublado', tipo: 'neutral' }, 'Lluvia/Tormenta': { texto: 'Adverso', tipo: 'danger' } }[c]),
  nubes: (n) => (n > 80 ? { texto: 'Alta', tipo: 'danger' } : n > 60 ? { texto: 'Media', tipo: 'warn' } : { texto: 'Baja', tipo: 'ok' }),
  tempAgua: (t) => (t < 15 ? { texto: 'Fría', tipo: 'warn' } : t < 22 ? { texto: 'Templada', tipo: 'neutral' } : { texto: 'Cálida', tipo: 'ok' }),
  oleaje: (o) => (o > 1.5 ? { texto: 'Elevado', tipo: 'warn' } : { texto: 'Normal', tipo: 'ok' }),
  corriente: (c) => (c > 1 ? { texto: 'Fuerte', tipo: 'warn' } : { texto: 'Suave', tipo: 'ok' }),
  visibilidad: (v) => (v < 5 ? { texto: 'Baja', tipo: 'warn' } : { texto: 'Buena', tipo: 'ok' }),
};

const ICONO_CLIMA = { Soleado: 'ti-sun', Nublado: 'ti-cloud', 'Lluvia/Tormenta': 'ti-cloud-storm' };

function Tarjeta({ icono, titulo, badge, sub, clase = '', children }) {
  return (
    <div className={`amb-card ${clase}`}>
      <div className="amb-top">
        <span className="amb-label"><i className={`ti ${icono}`} /> {titulo}</span>
        {badge && <span className={`badge-${badge.tipo}`}>{badge.texto}</span>}
      </div>
      {children}
      {sub && <div className="amb-sub">{sub}</div>}
    </div>
  );
}

function Valor({ valor, unidad, texto = false }) {
  return (
    <div className={`amb-value ${texto ? 'amb-text' : ''}`}>
      {valor}{unidad && <span className="amb-unit">{unidad}</span>}
    </div>
  );
}

function CampoManual({ campo, form, errores, onManual, bloquearSignos, placeholder, mostrarError = true }) {
  const { min, max, unidad } = LIMITES_AMBIENTE[campo];
  return (
    <>
      <div className="amb-manual">
        <input
          type="number"
          className={errores[campo] && mostrarError ? 'invalid' : ''}
          min={min}
          max={max}
          step="0.1"
          value={form[campo]}
          placeholder={placeholder}
          onKeyDown={bloquearSignos}
          onChange={(e) => onManual(campo, e.target.value === '' ? '' : Number(e.target.value))}
        />
        <span>{unidad}</span>
      </div>
      {errores[campo] && mostrarError && <div className="field-error">{errores[campo]}</div>}
    </>
  );
}

// Tarjeta de una variable del agua: si la API tiene el dato se muestra (solo lectura);
// si no (lagos y lagunas), el instructor puede cargarlo a mano o dejarlo vacío.
function TarjetaAgua({ campo, icono, titulo, unidad, decimales, dato, sub, ...resto }) {
  const { form } = resto;
  if (dato !== null && dato !== undefined) {
    return (
      <Tarjeta icono={icono} titulo={titulo} badge={BADGE[campo](dato)} sub={sub}>
        <Valor valor={formato(dato, decimales)} unidad={unidad} />
      </Tarjeta>
    );
  }
  const manual = num(form[campo]);
  const { min, max } = LIMITES_AMBIENTE[campo];
  const valido = Number.isFinite(manual) && manual >= min && manual <= max;
  return (
    <Tarjeta icono={icono} titulo={titulo} badge={valido ? BADGE[campo](manual) : null} clase="amb-sin-dato">
      <div className="amb-nodata">Sin datos de la API para este sitio</div>
      <CampoManual campo={campo} placeholder="A mano (opcional)" {...resto} />
    </Tarjeta>
  );
}

export default function PanelAmbiente({ sitio, ambiente, cargando, error, onActualizar, form, errores, onManual, bloquearSignos }) {
  if (!sitio) {
    return <div className="amb-estado"><i className="ti ti-map-pin-off" /> Elegí un sitio de buceo para ver sus condiciones ambientales.</div>;
  }

  if (error) {
    return (
      <div className="amb-estado amb-error">
        <i className="ti ti-cloud-off" />
        <div>
          <strong>No se pudieron obtener las condiciones de {sitio.Nombre}.</strong>
          <div>{error}</div>
        </div>
        <button className="btn-secondary" onClick={onActualizar} disabled={cargando}>
          <i className="ti ti-refresh" /> {cargando ? 'Reintentando...' : 'Reintentar'}
        </button>
      </div>
    );
  }

  if (!ambiente) {
    return (
      <div className="amb-grid">
        {Array.from({ length: 8 }, (_, i) => <div className="amb-card amb-skeleton" key={i} />)}
      </div>
    );
  }

  const comunes = { form, errores, onManual, bloquearSignos };
  const visibilidad = num(form.visibilidad);
  const visibilidadValida = Number.isFinite(visibilidad) && !errores.visibilidad;

  return (
    <>
      <div className="amb-header">
        <div className="amb-meta">
          <span className="amb-live"><i className="amb-dot" /> En tiempo real</span>
          <span>
            Dato de las {horaLocal(ambiente.fechaHora)} hs · {ambiente.sitio} ({ambiente.latitud.toFixed(4)}, {ambiente.longitud.toFixed(4)})
          </span>
        </div>
        <button className="btn-secondary amb-refresh" onClick={onActualizar} disabled={cargando}>
          <i className="ti ti-refresh" /> {cargando ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>

      <div className="amb-grid">
        <Tarjeta icono={ICONO_CLIMA[ambiente.clima]} titulo="Clima" badge={BADGE.clima(ambiente.clima)}>
          <Valor valor={ambiente.climaDetalle} texto />
        </Tarjeta>

        <Tarjeta icono="ti-wind" titulo="Viento" sub={ambiente.direccionViento ? `Desde el ${ambiente.direccionViento}` : null}>
          <Valor valor={formato(ambiente.viento)} unidad="km/h" />
        </Tarjeta>

        <Tarjeta icono="ti-cloud" titulo="Cobertura de nubes" badge={BADGE.nubes(ambiente.coberturaNubes)}>
          <Valor valor={formato(ambiente.coberturaNubes, 0)} unidad="%" />
        </Tarjeta>

        <Tarjeta
          icono="ti-eye"
          titulo="Visibilidad bajo el agua"
          badge={visibilidadValida ? BADGE.visibilidad(visibilidad) : null}
          sub="La cargás vos: ninguna API gratuita mide la visibilidad bajo el agua."
          clase="amb-manual-card"
        >
          <CampoManual campo="visibilidad" placeholder="Obligatoria" mostrarError={form.visibilidad !== ''} {...comunes} />
        </Tarjeta>

        <TarjetaAgua campo="oleaje" icono="ti-waves" titulo="Oleaje" unidad="m" decimales={1} dato={ambiente.oleaje} {...comunes} />

        <TarjetaAgua
          campo="corriente"
          icono="ti-current-location"
          titulo="Corriente"
          unidad="nudos"
          decimales={2}
          dato={ambiente.corriente}
          sub={ambiente.direccionCorriente ? `Hacia el ${ambiente.direccionCorriente}` : null}
          {...comunes}
        />

        <TarjetaAgua campo="tempAgua" icono="ti-droplet" titulo="Temperatura del agua" unidad="°C" decimales={1} dato={ambiente.tempAgua} {...comunes} />

        <Tarjeta
          icono="ti-anchor"
          titulo="Marea"
          sub={ambiente.marea === null ? 'La API no tiene datos de marea para este sitio.' : `${ambiente.estadoMarea ? `${ambiente.estadoMarea} · ` : ''}sobre el nivel medio del mar`}
          clase={ambiente.marea === null ? 'amb-sin-dato' : ''}
        >
          {ambiente.marea === null
            ? <div className="amb-nodata">Sin datos</div>
            : <Valor valor={formato(ambiente.marea)} unidad="m" />}
        </Tarjeta>
      </div>

      <div className="amb-attrib">{ambiente.atribucion}</div>
    </>
  );
}
