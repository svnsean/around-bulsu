// src/config/mapbox.js - Centralized Mapbox Configuration
import MapboxGL from '@rnmapbox/maps';

// Use a single valid Mapbox access token across the app
export const MAPBOX_ACCESS_TOKEN = 'pk.eyJ1Ijoic3Zuc2VhbiIsImEiOiJjbWh6MXViYmQwaWlvMnJxMW15MW41cWltIn0.Qz2opq51Zz3oj-MGPz7aow';

// Initialize Mapbox once at app startup
let isInitialized = false;

export const initializeMapbox = () => {
  if (isInitialized) return;
  
  try {
    MapboxGL.setAccessToken(MAPBOX_ACCESS_TOKEN);
    MapboxGL.setTelemetryEnabled(false);
    isInitialized = true;
    console.log('[Mapbox] Initialized successfully');
  } catch (error) {
    console.error('[Mapbox] Initialization error:', error);
  }
};

// Campus center coordinates (BulSU Malolos)
// 14°51'28.3"N 120°48'50.1"E converted to decimal
export const BSU_CENTER = [120.8139, 14.8579];

// Campus boundary polygon (~500m hexagonal radius from center)
// Points go clockwise: N -> NE -> SE -> S -> SW -> NW
export const CAMPUS_POLYGON = [
  { lat: 14.8624, lng: 120.8139 }, // North
  { lat: 14.8602, lng: 120.8180 }, // Northeast
  { lat: 14.8557, lng: 120.8180 }, // Southeast
  { lat: 14.8534, lng: 120.8139 }, // South
  { lat: 14.8557, lng: 120.8098 }, // Southwest
  { lat: 14.8602, lng: 120.8098 }, // Northwest
];

// Legacy bounds (kept for compatibility, derived from polygon)
export const CAMPUS_BOUNDS = {
  north: 14.8624,
  south: 14.8534,
  east: 120.8180,
  west: 120.8098
};

// Default map style
export const MAP_STYLE = MapboxGL.StyleURL.Street;

// Ray-casting algorithm to check if point is inside polygon
export const isWithinCampus = (latitude, longitude) => {
  const polygon = CAMPUS_POLYGON;
  if (!polygon || polygon.length < 3) return false;
  
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat;
    const xj = polygon[j].lng, yj = polygon[j].lat;
    const intersect = ((yi > latitude) !== (yj > latitude)) &&
                      (longitude < (xj - xi) * (latitude - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

export default {
  MAPBOX_ACCESS_TOKEN,
  initializeMapbox,
  BSU_CENTER,
  CAMPUS_POLYGON,
  CAMPUS_BOUNDS,
  MAP_STYLE,
  isWithinCampus,
};
