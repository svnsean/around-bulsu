// src/lib/pathfinding.js - A* Pathfinding Utility for ARound BulSU
// This module provides optimized A* pathfinding with blockage awareness

/**
 * Calculate distance in meters between two GPS coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in meters
 */
export const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth radius in meters
  const p1 = lat1 * Math.PI / 180;
  const p2 = lat2 * Math.PI / 180;
  const dp = (lat2 - lat1) * Math.PI / 180;
  const dl = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * Calculate bearing between two GPS coordinates
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Bearing in degrees (0-360)
 */
export const getBearing = (lat1, lon1, lat2, lon2) => {
  // Guard: if points are coincident (same location), return 0 to avoid potential NaN
  if (lat1 === lat2 && lon1 === lon2) {
    return 0;
  }
  
  const p1 = lat1 * Math.PI / 180;
  const p2 = lat2 * Math.PI / 180;
  const dl = (lon2 - lon1) * Math.PI / 180;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  const bearing = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  
  // Safety check: ensure result is a valid number
  return isNaN(bearing) ? 0 : bearing;
};

/**
 * Check if a point is inside a polygon using ray-casting algorithm
 * @param {number} lng - Longitude of point to check
 * @param {number} lat - Latitude of point to check
 * @param {Array<{lng: number, lat: number}>} polygon - Array of polygon vertices
 * @returns {boolean} True if point is inside polygon
 */
export const isPointInPolygon = (lng, lat, polygon) => {
  if (!polygon || polygon.length < 3) return false;
  
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat;
    const xj = polygon[j].lng, yj = polygon[j].lat;
    const intersect = ((yi > lat) !== (yj > lat)) &&
                      (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

/**
 * Check if an edge passes through any active blockage
 * @param {Object} edge - Edge object with from/to node IDs
 * @param {Array<Object>} activeBlockages - Array of active blockage objects with points
 * @param {Map|Object} nodesMap - Map or object of node ID to node data
 * @returns {boolean} True if edge is blocked
 */
export const isEdgeBlocked = (edge, activeBlockages, nodesMap) => {
  if (!nodesMap || !activeBlockages || activeBlockages.length === 0) return false;
  
  // Support both Map and plain object
  const getNode = (id) => nodesMap instanceof Map ? nodesMap.get(id) : nodesMap[id];
  
  // Support both from_node/to_node (Supabase) and from/to property names
  const fromId = edge.from_node || edge.from;
  const toId = edge.to_node || edge.to;
  
  const fromNode = getNode(fromId);
  const toNode = getNode(toId);
  if (!fromNode || !toNode) return false;
  
  // Check multiple points along the edge (start, 1/4, middle, 3/4, end)
  const checkPoints = [0, 0.25, 0.5, 0.75, 1];
  
  return checkPoints.some(t => {
    const checkLng = fromNode.lng + t * (toNode.lng - fromNode.lng);
    const checkLat = fromNode.lat + t * (toNode.lat - fromNode.lat);
    
    return activeBlockages.some(blockage => {
      if (!blockage.points || blockage.points.length < 3) return false;
      return isPointInPolygon(checkLng, checkLat, blockage.points);
    });
  });
};

/**
 * Find the nearest node to a given GPS coordinate
 * @param {number} lng - Longitude of reference point
 * @param {number} lat - Latitude of reference point
 * @param {Array<Object>} nodes - Array of node objects with id, lng, lat
 * @returns {Object|null} Nearest node or null if no nodes
 */
export const findNearestNode = (lng, lat, nodes) => {
  if (!nodes || nodes.length === 0) return null;
  
  let nearestNode = null;
  let minDistance = Infinity;
  
  for (const node of nodes) {
    const dist = getDistance(lat, lng, node.lat, node.lng);
    if (dist < minDistance) {
      minDistance = dist;
      nearestNode = node;
    }
  }
  
  return nearestNode;
};

/**
 * Find the nearest node that is connected in the graph (has neighbors)
 * @param {number} lng - Longitude of reference point
 * @param {number} lat - Latitude of reference point
 * @param {Array<Object>} nodes - Array of node objects with id, lng, lat
 * @param {Map} graph - Graph adjacency map
 * @param {number} maxCandidates - Maximum number of candidates to check (default: 10)
 * @returns {Object|null} Nearest connected node or null if none found
 */
export const findNearestConnectedNode = (lng, lat, nodes, graph, maxCandidates = 10) => {
  if (!nodes || nodes.length === 0 || !graph) return null;
  
  // Sort nodes by distance
  const sortedNodes = [...nodes]
    .map(node => ({
      node,
      distance: getDistance(lat, lng, node.lat, node.lng)
    }))
    .sort((a, b) => a.distance - b.distance);
  
  // Find the first connected node
  for (let i = 0; i < Math.min(sortedNodes.length, maxCandidates); i++) {
    const candidate = sortedNodes[i].node;
    const graphNode = graph.get(candidate.id);
    
    // Check if this node has neighbors (is connected)
    if (graphNode && graphNode.neighbors && graphNode.neighbors.length > 0) {
      return candidate;
    }
  }
  
  // If no connected node found, return the nearest one anyway
  return sortedNodes.length > 0 ? sortedNodes[0].node : null;
};

/**
 * Check if two nodes can reach each other using BFS
 * @param {string} startId - Start node ID
 * @param {string} endId - End node ID
 * @param {Map} graph - Graph adjacency map
 * @returns {boolean} True if nodes are connected
 */
export const canReachNode = (startId, endId, graph) => {
  if (!graph || !graph.has(startId) || !graph.has(endId)) return false;
  if (startId === endId) return true;
  
  const visited = new Set();
  const queue = [startId];
  
  while (queue.length > 0) {
    const currentId = queue.shift();
    if (currentId === endId) return true;
    
    if (visited.has(currentId)) continue;
    visited.add(currentId);
    
    const node = graph.get(currentId);
    if (node && node.neighbors) {
      for (const neighbor of node.neighbors) {
        if (!visited.has(neighbor.node)) {
          queue.push(neighbor.node);
        }
      }
    }
  }
  
  return false;
};

/**
 * Find a node that can reach the target node
 * @param {number} lng - Longitude of reference point
 * @param {number} lat - Latitude of reference point
 * @param {string} targetNodeId - ID of the node we need to reach
 * @param {Array<Object>} nodes - Array of node objects
 * @param {Map} graph - Graph adjacency map
 * @param {number} maxCandidates - Max candidates to check
 * @returns {Object|null} Nearest node that can reach target
 */
export const findNearestReachableNode = (lng, lat, targetNodeId, nodes, graph, maxCandidates = 20) => {
  if (!nodes || nodes.length === 0 || !graph) return null;
  
  // Sort nodes by distance
  const sortedNodes = [...nodes]
    .map(node => ({
      node,
      distance: getDistance(lat, lng, node.lat, node.lng)
    }))
    .sort((a, b) => a.distance - b.distance);
  
  // Find the first connected node that can reach the target
  for (let i = 0; i < Math.min(sortedNodes.length, maxCandidates); i++) {
    const candidate = sortedNodes[i].node;
    const graphNode = graph.get(candidate.id);
    
    // Check if this node has neighbors and can reach the target
    if (graphNode && graphNode.neighbors && graphNode.neighbors.length > 0) {
      if (canReachNode(candidate.id, targetNodeId, graph)) {
        return candidate;
      }
    }
  }
  
  // If no reachable node found, return the nearest connected one
  return findNearestConnectedNode(lng, lat, nodes, graph, maxCandidates);
};

/**
 * Build a graph from nodes and edges, filtering out blocked edges
 * @param {Array<Object>} nodes - Array of node objects with id, lng, lat
 * @param {Array<Object>} edges - Array of edge objects with from, to, weight
 * @param {Array<Object>} blockages - Array of blockage objects (optional)
 * @returns {Map} Graph as adjacency list Map
 */
export const buildGraph = (nodes, edges, blockages = []) => {
  const graph = new Map();
  const nodesMap = new Map();
  
  // Initialize graph with all nodes
  nodes.forEach(node => {
    nodesMap.set(node.id, node);
    graph.set(node.id, { ...node, neighbors: [] });
  });
  
  // Get active blockages only
  const activeBlockages = blockages.filter(b => b.active);
  
  // Add edges (bidirectional), filtering blocked ones
  edges.forEach(edge => {
    // Support both from_node/to_node (Supabase) and from/to property names
    const fromId = edge.from_node || edge.from;
    const toId = edge.to_node || edge.to;
    
    if (!graph.has(fromId) || !graph.has(toId)) return;
    
    // Check if edge is blocked by any active blockage
    if (isEdgeBlocked(edge, activeBlockages, nodesMap)) return;
    
    const fromNode = graph.get(fromId);
    const toNode = graph.get(toId);
    
    // Calculate weight if not provided (using actual distance in meters)
    const weight = edge.weight || getDistance(fromNode.lat, fromNode.lng, toNode.lat, toNode.lng);
    
    fromNode.neighbors.push({ node: toId, cost: weight });
    toNode.neighbors.push({ node: fromId, cost: weight });
  });
  
  return graph;
};

/**
 * A* pathfinding algorithm
 * @param {Object} options - Pathfinding options
 * @param {[number, number]} options.startCoords - Start coordinates [lng, lat]
 * @param {[number, number]} options.endCoords - End coordinates [lng, lat]
 * @param {Array<Object>} options.nodes - Array of node objects
 * @param {Array<Object>} options.edges - Array of edge objects
 * @param {Array<Object>} options.blockages - Array of blockage objects (optional)
 * @param {boolean} options.includeEndpoints - Whether to include start/end coords in path (default: true)
 * @returns {Object} Result object with path, pathNodes, distance, and error if any
 */
export const findPath = ({
  startCoords,
  endCoords,
  nodes,
  edges,
  blockages = [],
  includeEndpoints = true
}) => {
  // Validate inputs
  if (!nodes || nodes.length === 0) {
    return { path: [], pathNodes: [], distance: 0, error: 'No nodes available for pathfinding' };
  }
  
  if (!edges || edges.length === 0) {
    return { path: [], pathNodes: [], distance: 0, error: 'No edges available for pathfinding' };
  }
  
  if (!startCoords || !endCoords) {
    return { path: [], pathNodes: [], distance: 0, error: 'Start or end coordinates not provided' };
  }
  
  // Normalize coordinates to [lng, lat] format
  const start = Array.isArray(startCoords) ? startCoords : [startCoords.longitude, startCoords.latitude];
  const end = Array.isArray(endCoords) ? endCoords : [endCoords.longitude, endCoords.latitude];
  
  // Build graph first so we can check connectivity
  const graph = buildGraph(nodes, edges, blockages);
  
  // Count connected nodes for debugging
  let connectedNodeCount = 0;
  for (const [id, node] of graph) {
    if (node.neighbors && node.neighbors.length > 0) {
      connectedNodeCount++;
    }
  }
  
  console.log(`[Pathfinding] Graph built: ${nodes.length} nodes, ${edges.length} edges, ${connectedNodeCount} connected nodes`);
  
  // First, find the nearest connected end node (destination)
  let endNode = findNearestConnectedNode(end[0], end[1], nodes, graph);
  
  if (!endNode) {
    return { path: [], pathNodes: [], distance: 0, error: 'Could not find nearest node to destination' };
  }
  
  // Then find a start node that can actually REACH the end node
  let startNode = findNearestReachableNode(start[0], start[1], endNode.id, nodes, graph, 30);
  
  if (!startNode) {
    // Fallback to just nearest connected node
    startNode = findNearestConnectedNode(start[0], start[1], nodes, graph);
  }
  
  if (!startNode) {
    return { path: [], pathNodes: [], distance: 0, error: 'Could not find nearest node to start point' };
  }
  
  // Check if nodes are actually connected in the graph
  const startGraphNode = graph.get(startNode.id);
  const endGraphNode = graph.get(endNode.id);
  
  const startNeighborCount = startGraphNode?.neighbors?.length || 0;
  const endNeighborCount = endGraphNode?.neighbors?.length || 0;
  
  console.log(`[Pathfinding] Start node: ${startNode.id} (${startNeighborCount} neighbors), End node: ${endNode.id} (${endNeighborCount} neighbors)`);
  
  // Check reachability
  const reachable = canReachNode(startNode.id, endNode.id, graph);
  console.log(`[Pathfinding] Start can reach End: ${reachable}`);
  
  if (!reachable) {
    return { 
      path: [], 
      pathNodes: [], 
      distance: 0, 
      error: `Start and end nodes are not connected. The graph may have disconnected components.`,
      startNode,
      endNode
    };
  }
  
  if (startNeighborCount === 0) {
    return { 
      path: [], 
      pathNodes: [], 
      distance: 0, 
      error: `Start node (${startNode.id}) has no connections. The node network may be incomplete.`,
      startNode,
      endNode
    };
  }
  
  if (endNeighborCount === 0) {
    return { 
      path: [], 
      pathNodes: [], 
      distance: 0, 
      error: `End node (${endNode.id}) has no connections. The node network may be incomplete.`,
      startNode,
      endNode
    };
  }
  
  // Check if start and end are the same node
  if (startNode.id === endNode.id) {
    const pathCoords = includeEndpoints ? [start, [startNode.lng, startNode.lat], end] : [[startNode.lng, startNode.lat]];
    return {
      path: pathCoords,
      pathNodes: [startNode],
      distance: getDistance(start[1], start[0], end[1], end[0]),
      startNode,
      endNode
    };
  }
  
  // A* algorithm initialization
  const openSet = new Set([startNode.id]);
  const closedSet = new Set();
  const cameFrom = new Map();
  const gScore = new Map();
  const fScore = new Map();
  
  // Initialize scores
  nodes.forEach(node => {
    gScore.set(node.id, Infinity);
    fScore.set(node.id, Infinity);
  });
  
  gScore.set(startNode.id, 0);
  // Heuristic: actual distance to end node
  fScore.set(startNode.id, getDistance(startNode.lat, startNode.lng, endNode.lat, endNode.lng));
  
  const MAX_ITERATIONS = nodes.length * 3;
  let iterations = 0;
  
  // A* main loop
  while (openSet.size > 0 && iterations < MAX_ITERATIONS) {
    iterations++;
    
    // Find node with lowest fScore in openSet
    let currentId = null;
    let lowestF = Infinity;
    for (const id of openSet) {
      const score = fScore.get(id);
      if (score < lowestF) {
        lowestF = score;
        currentId = id;
      }
    }
    
    if (!currentId) break;
    
    // Check if we reached the destination
    if (currentId === endNode.id) {
      // Reconstruct path
      const pathCoords = [];
      const pathNodesList = [];
      let current = currentId;
      
      while (current) {
        const node = graph.get(current);
        pathCoords.unshift([node.lng, node.lat]);
        pathNodesList.unshift(node);
        current = cameFrom.get(current);
      }
      
      // Calculate total path distance (between graph nodes only)
      let totalDistance = 0;
      for (let i = 0; i < pathCoords.length - 1; i++) {
        totalDistance += getDistance(
          pathCoords[i][1], pathCoords[i][0],
          pathCoords[i + 1][1], pathCoords[i + 1][0]
        );
      }
      
      // Calculate distances to endpoints for total distance (but keep endpoints separate for visual-only dotted line)
      let userStartPoint = null;
      let destinationEndPoint = null;
      
      if (includeEndpoints) {
        // Add distance from actual start to first node
        totalDistance += getDistance(start[1], start[0], pathCoords[0][1], pathCoords[0][0]);
        // Add distance from last node to actual end
        totalDistance += getDistance(
          pathCoords[pathCoords.length - 1][1], pathCoords[pathCoords.length - 1][0],
          end[1], end[0]
        );
        
        // Store endpoints separately for visual-only dotted line rendering
        // DO NOT add to pathCoords - path only contains actual graph nodes
        userStartPoint = start;  // [lng, lat]
        destinationEndPoint = end;  // [lng, lat]
      }
      
      return {
        path: pathCoords,
        pathNodes: pathNodesList,
        distance: Math.round(totalDistance),
        userStartPoint,  // Separate: for dotted line from user to first node
        destinationEndPoint,  // Separate: for dotted line from last node to destination
        startNode,
        endNode
      };
    }
    
    // Move current from open to closed
    openSet.delete(currentId);
    closedSet.add(currentId);
    
    // Process neighbors
    const currentNode = graph.get(currentId);
    if (!currentNode || !currentNode.neighbors) continue;
    
    for (const neighbor of currentNode.neighbors) {
      if (closedSet.has(neighbor.node)) continue;
      
      const neighborNode = graph.get(neighbor.node);
      if (!neighborNode) continue;
      
      const tentativeG = gScore.get(currentId) + neighbor.cost;
      
      if (tentativeG < gScore.get(neighbor.node)) {
        // This is a better path
        cameFrom.set(neighbor.node, currentId);
        gScore.set(neighbor.node, tentativeG);
        
        // f = g + h (heuristic is actual distance to end)
        const h = getDistance(neighborNode.lat, neighborNode.lng, endNode.lat, endNode.lng);
        fScore.set(neighbor.node, tentativeG + h);
        
        if (!openSet.has(neighbor.node)) {
          openSet.add(neighbor.node);
        }
      }
    }
  }
  
  // No path found
  return {
    path: [],
    pathNodes: [],
    distance: 0,
    error: 'No path found. Check if nodes are connected or if all paths are blocked.',
    startNode,
    endNode
  };
};

/**
 * Convert path coordinates to GeoJSON FeatureCollection for map display
 * @param {Array<[number, number]>} pathCoords - Array of [lng, lat] coordinates
 * @returns {Object} GeoJSON FeatureCollection
 */
export const pathToGeoJSON = (pathCoords) => {
  if (!pathCoords || pathCoords.length === 0) {
    return {
      type: 'FeatureCollection',
      features: []
    };
  }
  
  // Ensure at least 2 points for a valid LineString
  let coords = pathCoords;
  if (coords.length === 1) {
    coords = [coords[0], [coords[0][0] + 0.00001, coords[0][1] + 0.00001]];
  }
  
  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: coords
      }
    }]
  };
};

/**
 * Calculate path bounds with padding for map camera
 * @param {Array<[number, number]>} pathCoords - Array of [lng, lat] coordinates
 * @param {number} padding - Padding in degrees (default: 0.0005 ~= 50m)
 * @returns {Object} Bounds object with ne and sw coordinates
 */
export const getPathBounds = (pathCoords, padding = 0.0005) => {
  if (!pathCoords || pathCoords.length === 0) return null;
  
  let minLng = Infinity, maxLng = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;
  
  pathCoords.forEach(([lng, lat]) => {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  });
  
  return {
    ne: [maxLng + padding, maxLat + padding],
    sw: [minLng - padding, minLat - padding]
  };
};

/**
 * Detect turn direction between three consecutive waypoints
 * @param {Object} prevNode - Previous node with lat, lng
 * @param {Object} currentNode - Current node with lat, lng
 * @param {Object} nextNode - Next node with lat, lng
 * @returns {string|null} Turn type: 'left', 'right', 'slight-left', 'slight-right', 'straight', or null
 */
export const detectTurn = (prevNode, currentNode, nextNode) => {
  if (!prevNode || !currentNode || !nextNode) return null;
  
  const bearing1 = getBearing(prevNode.lat, prevNode.lng, currentNode.lat, currentNode.lng);
  const bearing2 = getBearing(currentNode.lat, currentNode.lng, nextNode.lat, nextNode.lng);
  
  let turn = bearing2 - bearing1;
  if (turn > 180) turn -= 360;
  if (turn < -180) turn += 360;
  
  if (turn > 45) return 'right';
  if (turn < -45) return 'left';
  if (turn > 20) return 'slight-right';
  if (turn < -20) return 'slight-left';
  return 'straight';
};

/**
 * Calculate ETA based on walking speed
 * @param {number} distanceMeters - Distance in meters
 * @param {number} walkingSpeed - Walking speed in m/s (default: 1.4 ~= 5 km/h)
 * @returns {string} Formatted ETA string
 */
export const calculateETA = (distanceMeters, walkingSpeed = 1.4) => {
  const etaSeconds = Math.round(distanceMeters / walkingSpeed);
  const etaMinutes = Math.floor(etaSeconds / 60);
  const etaSecondsRemainder = etaSeconds % 60;
  
  if (etaMinutes > 0) {
    return `${etaMinutes}m ${etaSecondsRemainder}s`;
  }
  return `${etaSeconds}s`;
};

/**
 * Calculate perpendicular distance from a point to a line segment
 * @param {number} px - Point longitude
 * @param {number} py - Point latitude
 * @param {number} x1 - Segment start longitude
 * @param {number} y1 - Segment start latitude
 * @param {number} x2 - Segment end longitude
 * @param {number} y2 - Segment end latitude
 * @returns {number} Distance in meters
 */
const pointToSegmentDistance = (px, py, x1, y1, x2, y2) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  
  if (dx === 0 && dy === 0) {
    // Segment is a point
    return getDistance(py, px, y1, x1);
  }
  
  // Calculate projection parameter t
  let t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
  
  // Clamp t to [0, 1] to stay within segment
  t = Math.max(0, Math.min(1, t));
  
  // Find closest point on segment
  const closestX = x1 + t * dx;
  const closestY = y1 + t * dy;
  
  return getDistance(py, px, closestY, closestX);
};

/**
 * Calculate minimum distance from user to any segment of the path
 * @param {number} userLat - User latitude
 * @param {number} userLng - User longitude
 * @param {Array<Object>} pathNodes - Array of path nodes with lat, lng
 * @returns {Object} { distance: number, closestSegmentIndex: number, closestPoint: {lat, lng} }
 */
export const getDistanceFromPath = (userLat, userLng, pathNodes) => {
  if (!pathNodes || pathNodes.length < 2) {
    return { distance: Infinity, closestSegmentIndex: -1, closestPoint: null };
  }
  
  let minDistance = Infinity;
  let closestSegmentIndex = 0;
  let closestPoint = null;
  
  for (let i = 0; i < pathNodes.length - 1; i++) {
    const node1 = pathNodes[i];
    const node2 = pathNodes[i + 1];
    
    const dist = pointToSegmentDistance(
      userLng, userLat,
      node1.lng, node1.lat,
      node2.lng, node2.lat
    );
    
    if (dist < minDistance) {
      minDistance = dist;
      closestSegmentIndex = i;
      
      // Calculate the actual closest point on the segment
      const dx = node2.lng - node1.lng;
      const dy = node2.lat - node1.lat;
      let t = 0;
      if (dx !== 0 || dy !== 0) {
        t = ((userLng - node1.lng) * dx + (userLat - node1.lat) * dy) / (dx * dx + dy * dy);
        t = Math.max(0, Math.min(1, t));
      }
      closestPoint = {
        lng: node1.lng + t * dx,
        lat: node1.lat + t * dy
      };
    }
  }
  
  return { distance: minDistance, closestSegmentIndex, closestPoint };
};

/**
 * Trim path to remove segments behind the user (progressive path clearing)
 * @param {Array<Object>} pathNodes - Full path nodes array
 * @param {number} userLat - User latitude
 * @param {number} userLng - User longitude
 * @param {number} clearedIndex - Index of already cleared segments (to prevent re-adding)
 * @param {number} threshold - Distance threshold in meters to consider a waypoint "passed" (default: 8m)
 * @returns {Object} { trimmedNodes: Array, newClearedIndex: number }
 */
export const trimPathBehindUser = (pathNodes, userLat, userLng, clearedIndex = 0, threshold = 8) => {
  if (!pathNodes || pathNodes.length < 2) {
    return { trimmedNodes: pathNodes || [], newClearedIndex: clearedIndex };
  }
  
  let newClearedIndex = clearedIndex;
  
  // Find the furthest node the user has passed
  for (let i = clearedIndex; i < pathNodes.length - 1; i++) {
    const distToNode = getDistance(userLat, userLng, pathNodes[i].lat, pathNodes[i].lng);
    const distToNextNode = getDistance(userLat, userLng, pathNodes[i + 1].lat, pathNodes[i + 1].lng);
    
    // User has passed this node if:
    // 1. They're close enough to it (within threshold), AND
    // 2. They're closer to the next node than to this one
    if (distToNode < threshold && distToNextNode < distToNode) {
      newClearedIndex = i + 1;
    } else if (distToNode >= threshold) {
      // Stop checking once we're far from nodes
      break;
    }
  }
  
  // Return trimmed path starting from cleared index
  const trimmedNodes = pathNodes.slice(newClearedIndex);
  
  return { trimmedNodes, newClearedIndex };
};

// Default export with all functions
export default {
  getDistance,
  getBearing,
  isPointInPolygon,
  isEdgeBlocked,
  findNearestNode,
  findNearestConnectedNode,
  findNearestReachableNode,
  canReachNode,
  buildGraph,
  findPath,
  pathToGeoJSON,
  getPathBounds,
  detectTurn,
  calculateETA,
  getDistanceFromPath,
  trimPathBehindUser
};
