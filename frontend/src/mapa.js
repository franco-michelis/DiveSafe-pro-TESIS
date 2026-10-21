import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export const ARGENTINA = { latMin: -55.1, latMax: -21.7, lonMin: -73.6, lonMax: -53.6 };
export const ARGENTINA_BOUNDS = [[ARGENTINA.latMin, ARGENTINA.lonMin], [ARGENTINA.latMax, ARGENTINA.lonMax]];

export function crearMapaArgentina(elemento) {
  const map = L.map(elemento, {
    minZoom: 4,
    maxBounds: [[-60, -80], [-17, -48]],
  });
  map.fitBounds(ARGENTINA_BOUNDS);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  return map;
}

export function pinIcon(clase) {
  return L.divIcon({
    className: `map-pin ${clase}`,
    html: '<i class="ti ti-map-pin-filled"></i>',
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -28],
    tooltipAnchor: [14, -18],
  });
}
