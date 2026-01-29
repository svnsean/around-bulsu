// filters.js - GPS, Compass, and Pitch filtering utilities for AR Navigation
// Extracted from ARNavigationScreen for reusability

/**
 * Kalman Filter for GPS coordinates
 * Smooths location updates and predicts position based on velocity
 */
export class GPSKalmanFilter {
  constructor() {
    this.lat = null;
    this.lng = null;
    this.velocityLat = 0;
    this.velocityLng = 0;
    this.accuracy = 10;
    this.lastTimestamp = null;
    this.processNoise = 3;
    this.minAccuracy = 100;
  }
  
  filter(lat, lng, accuracy, timestamp) {
    if (this.lat === null) {
      this.lat = lat;
      this.lng = lng;
      this.accuracy = accuracy || 10;
      this.lastTimestamp = timestamp || Date.now();
      return { lat: this.lat, lng: this.lng };
    }
    
    const now = timestamp || Date.now();
    const dt = Math.max(0.1, (now - this.lastTimestamp) / 1000);
    this.lastTimestamp = now;
    
    const predictedLat = this.lat + this.velocityLat * dt;
    const predictedLng = this.lng + this.velocityLng * dt;
    const predictedAccuracy = this.accuracy + this.processNoise * dt;
    const measurementAccuracy = Math.min(accuracy || 10, this.minAccuracy);
    const kalmanGain = predictedAccuracy / (predictedAccuracy + measurementAccuracy);
    
    this.lat = predictedLat + kalmanGain * (lat - predictedLat);
    this.lng = predictedLng + kalmanGain * (lng - predictedLng);
    this.velocityLat = (this.lat - predictedLat) / dt * 0.5 + this.velocityLat * 0.5;
    this.velocityLng = (this.lng - predictedLng) / dt * 0.5 + this.velocityLng * 0.5;
    this.accuracy = (1 - kalmanGain) * predictedAccuracy;
    
    return { lat: this.lat, lng: this.lng };
  }
  
  reset() {
    this.lat = null;
    this.lng = null;
    this.velocityLat = 0;
    this.velocityLng = 0;
  }
}

/**
 * Low-Pass Filter for Compass/Magnetometer heading
 * Uses median filtering and angular interpolation for smooth heading
 */
export class CompassFilter {
  constructor(alpha = 0.15) {
    this.alpha = alpha;
    this.heading = null;
    this.history = [];
    this.historySize = 10;
  }
  
  normalize(angle) {
    while (angle < 0) angle += 360;
    while (angle >= 360) angle -= 360;
    return angle;
  }
  
  angularDifference(from, to) {
    let diff = to - from;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    return diff;
  }
  
  filter(rawHeading) {
    rawHeading = this.normalize(rawHeading);
    
    if (this.heading === null) {
      this.heading = rawHeading;
      this.history = [rawHeading];
      return this.heading;
    }
    
    this.history.push(rawHeading);
    if (this.history.length > this.historySize) {
      this.history.shift();
    }
    
    const sortedHistory = [...this.history].sort((a, b) => a - b);
    const medianHeading = sortedHistory[Math.floor(sortedHistory.length / 2)];
    const diff = this.angularDifference(this.heading, medianHeading);
    this.heading = this.normalize(this.heading + this.alpha * diff);
    
    return this.heading;
  }
  
  reset() {
    this.heading = null;
    this.history = [];
  }
}

/**
 * Low-Pass Filter for Accelerometer pitch
 * Simple exponential smoothing for device tilt angle
 */
export class PitchFilter {
  constructor(alpha = 0.2) {
    this.alpha = alpha;
    this.pitch = 0;
  }
  
  filter(rawPitch) {
    this.pitch = this.pitch + this.alpha * (rawPitch - this.pitch);
    return this.pitch;
  }
  
  reset() {
    this.pitch = 0;
  }
}
