import type { Station } from '../types';

/** Marker color per station category — also usable by dashboard legends. */
export const MAP_CATEGORY_COLORS: Record<Station['category'], string> = {
  cat1: '#3D7BFF',
  cat2: '#FFA63D',
};

export type MapStationInput = Pick<Station, 'id' | 'name' | 'category' | 'lat' | 'lng'>;

export interface MapPin {
  id: string;
  lat: number;
  lng: number;
  color: string;
  label?: string;
}

/** Commands a host (dashboard iframe or app WebView) posts to the map page. */
export type MapCommand =
  | { type: 'init'; stations: MapStationInput[] }
  | { type: 'trail'; stationIds: string[]; color: string }
  | { type: 'pins'; pins: MapPin[] };

/** Messages the map page posts back to its host. */
export type MapHostMessage = { type: 'ready' };

export interface MapTileConfig {
  /**
   * Base URL serving locally pre-downloaded tiles as `{localTileUrl}/{z}/{x}/{y}.png`
   * (see `tools/download-tiles.ts`). When set, these are layered on top of the public
   * OSM CDN so the map still renders Gharzouz with no internet access; missing local
   * tiles fall back to a transparent pixel, letting the OSM layer show through.
   */
  localTileUrl?: string;
}

/** 1x1 transparent PNG used as `errorTileUrl` so missing local tiles don't show a broken-image icon. */
const TRANSPARENT_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

/**
 * Self-contained Leaflet page shared by the dashboard (in an <iframe>) and the app
 * (in a react-native-webview). The host drives it by posting `MapCommand`s as JSON
 * via `postMessage`; the page replies `{type:'ready'}` once Leaflet has initialized.
 */
export function buildMapHtml(tileConfig: MapTileConfig = {}): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
      html, body, #map { margin: 0; height: 100%; width: 100%; background: #0f1b2d; }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      var CATEGORY_COLORS = ${JSON.stringify(MAP_CATEGORY_COLORS)};
      var LOCAL_TILE_URL = ${JSON.stringify(tileConfig.localTileUrl ?? null)};
      var TRANSPARENT_TILE = ${JSON.stringify(TRANSPARENT_PNG)};

      var map = null;
      var stationsById = {};
      var stationMarkers = {};
      var trailLayer = null;
      var pinsLayer = null;

      function notifyHost(message) {
        var json = JSON.stringify(message);
        if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(json);
        if (window.parent && window.parent !== window) window.parent.postMessage(json, '*');
      }

      function ensureMap() {
        if (map) return;
        map = L.map('map');
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map);
        if (LOCAL_TILE_URL) {
          L.tileLayer(LOCAL_TILE_URL + '/{z}/{x}/{y}.png', {
            maxZoom: 19,
            errorTileUrl: TRANSPARENT_TILE,
          }).addTo(map);
        }
      }

      function init(stations) {
        ensureMap();
        Object.keys(stationMarkers).forEach(function (id) {
          map.removeLayer(stationMarkers[id]);
        });
        stationMarkers = {};
        stationsById = {};

        var bounds = [];
        stations.forEach(function (s) {
          stationsById[s.id] = s;
          var color = CATEGORY_COLORS[s.category] || '#999999';
          var marker = L.circleMarker([s.lat, s.lng], {
            radius: 7,
            color: color,
            fillColor: color,
            fillOpacity: 0.25,
            weight: 2,
          }).addTo(map);
          marker.bindTooltip(s.name);
          stationMarkers[s.id] = marker;
          bounds.push([s.lat, s.lng]);
        });
        if (bounds.length > 0) {
          map.fitBounds(bounds, { padding: [30, 30] });
        }
      }

      function setTrail(stationIds, color) {
        if (trailLayer) {
          map.removeLayer(trailLayer);
          trailLayer = null;
        }
        var latlngs = [];
        stationIds.forEach(function (id) {
          var s = stationsById[id];
          if (!s) return;
          latlngs.push([s.lat, s.lng]);
          var marker = stationMarkers[id];
          if (marker) marker.setStyle({ fillOpacity: 0.9, fillColor: color, color: color });
        });
        if (latlngs.length > 1) {
          trailLayer = L.polyline(latlngs, { color: color, weight: 3 }).addTo(map);
        }
      }

      function setPins(pins) {
        if (pinsLayer) {
          map.removeLayer(pinsLayer);
          pinsLayer = null;
        }
        pinsLayer = L.layerGroup();
        pins.forEach(function (p) {
          var marker = L.circleMarker([p.lat, p.lng], {
            radius: 8,
            color: '#ffffff',
            fillColor: p.color,
            fillOpacity: 1,
            weight: 2,
          });
          if (p.label) marker.bindTooltip(p.label);
          marker.addTo(pinsLayer);
        });
        pinsLayer.addTo(map);
      }

      function handleMessage(event) {
        var data = event.data;
        if (typeof data === 'string') {
          try {
            data = JSON.parse(data);
          } catch (e) {
            return;
          }
        }
        if (!data || !data.type) return;
        if (data.type === 'init') init(data.stations);
        else if (data.type === 'trail') setTrail(data.stationIds, data.color);
        else if (data.type === 'pins') setPins(data.pins);
      }

      window.addEventListener('message', handleMessage);
      document.addEventListener('message', handleMessage);

      ensureMap();
      notifyHost({ type: 'ready' });
    </script>
  </body>
</html>
`;
}
