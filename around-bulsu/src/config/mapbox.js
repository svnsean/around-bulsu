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
export const BSU_CENTER = [120.813778, 14.857830];

// Campus bounds for boundary checking
export const CAMPUS_BOUNDS = {
  north: 14.8485,
  south: 14.8410,
  east: 120.8150,
  west: 120.8050
};

// Default map style
export const MAP_STYLE = MapboxGL.StyleURL.Street;

// Check if coordinates are within campus
export const isWithinCampus = (latitude, longitude) => {
  return latitude <= CAMPUS_BOUNDS.north &&
         latitude >= CAMPUS_BOUNDS.south &&
         longitude <= CAMPUS_BOUNDS.east &&
         longitude >= CAMPUS_BOUNDS.west;
};

export default {
  MAPBOX_ACCESS_TOKEN,
  initializeMapbox,
  BSU_CENTER,
  CAMPUS_BOUNDS,
  MAP_STYLE,
  isWithinCampus,
};
