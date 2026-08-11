// utils/clusterHelper.js - Map marker clustering algorithm
// Grid-based clustering: groups nearby markers into cluster markers at low zoom levels
// At high zoom levels, shows individual markers

/**
 * Cluster configuration by zoom level
 * Higher zoom = more zoomed in = smaller grid = more individual markers
 */
const CLUSTER_CONFIG = {
  // zoom <= 10: very zoomed out, large clusters
  10: { gridSize: 0.08, minClusterSize: 2 },
  11: { gridSize: 0.06, minClusterSize: 2 },
  12: { gridSize: 0.04, minClusterSize: 2 },
  13: { gridSize: 0.02, minClusterSize: 2 },
  14: { gridSize: 0.015, minClusterSize: 3 },
  // zoom >= 15: no clustering, show all individual markers
  15: { gridSize: 0, minClusterSize: 99 }
}

/**
 * Get cluster config for a given zoom level
 */
function getConfig(zoom) {
  if (zoom <= 10) return CLUSTER_CONFIG[10]
  if (zoom >= 15) return CLUSTER_CONFIG[15]
  return CLUSTER_CONFIG[zoom] || CLUSTER_CONFIG[12]
}

/**
 * Cluster markers using a grid-based approach
 * @param {Array} markers - Array of marker objects with latitude/longitude
 * @param {Number} zoom - Current map zoom level (3-20)
 * @param {Object} options - Optional: { centerLat, centerLng, gridSize override }
 * @returns {Object} { markers: [...], clusters: [...], totalCount: N }
 *   - markers: array of final markers to display (either individual or cluster)
 *   - clusters: array of cluster info for debugging
 */
function clusterMarkers(markers, zoom, options = {}) {
  if (!markers || markers.length === 0) {
    return { markers: [], clusters: [], totalCount: 0 }
  }

  const config = options.gridSize != null
    ? { gridSize: options.gridSize, minClusterSize: options.minClusterSize || 2 }
    : getConfig(zoom)

  // If no clustering needed (high zoom or few markers)
  if (config.gridSize === 0 || markers.length < (config.minClusterSize || 2)) {
    return {
      markers: markers.map(m => ({ ...m, _isCluster: false })),
      clusters: [],
      totalCount: markers.length
    }
  }

  // Build grid buckets
  const grid = new Map()
  const halfGrid = config.gridSize / 2

  markers.forEach(marker => {
    // Calculate grid cell key
    const lat = marker.latitude != null ? marker.latitude : marker.lat
    const lng = marker.longitude != null ? marker.longitude : marker.lng

    if (lat == null || lng == null) return

    const cellLat = Math.floor(lat / config.gridSize)
    const cellLng = Math.floor(lng / config.gridSize)
    const key = `${cellLat}_${cellLng}`

    if (!grid.has(key)) {
      grid.set(key, [])
    }
    grid.get(key).push(marker)
  })

  // Process each grid cell
  const resultMarkers = []
  const clusters = []

  grid.forEach((cellMarkers, key) => {
    if (cellMarkers.length >= config.minClusterSize) {
      // Create a cluster marker
      // Calculate weighted center
      let sumLat = 0, sumLng = 0
      cellMarkers.forEach(m => {
        sumLat += m.latitude != null ? m.latitude : m.lat
        sumLng += m.longitude != null ? m.longitude : m.lng
      })
      const centerLat = sumLat / cellMarkers.length
      const centerLng = sumLng / cellMarkers.length

      // Find dominant category (most common)
      const catCount = {}
      cellMarkers.forEach(m => {
        const cat = m._category || m.category || 'unknown'
        catCount[cat] = (catCount[cat] || 0) + 1
      })
      const dominantCat = Object.entries(catCount)
        .sort((a, b) => b[1] - a[1])[0]

      // Find a representative color
      let clusterColor = '#4A90D9'
      const firstWithColor = cellMarkers.find(m => m._color)
      if (firstWithColor && firstWithColor._color) {
        clusterColor = firstWithColor._color
      }

      // Determine cluster size tier
      let tier = 'small'
      if (cellMarkers.length >= 10) tier = 'large'
      else if (cellMarkers.length >= 5) tier = 'medium'

      resultMarkers.push({
        id: 90000 + clusters.length, // Use high IDs to avoid collision
        latitude: centerLat,
        longitude: centerLng,
        width: tier === 'large' ? 48 : tier === 'medium' ? 40 : 32,
        height: tier === 'large' ? 48 : tier === 'medium' ? 40 : 32,
        callout: {
          content: `${cellMarkers.length}个地点`,
          color: '#ffffff',
          fontSize: 12,
          borderRadius: 20,
          padding: 6,
          bgColor: clusterColor,
          display: 'ALWAYS',
          textAlign: 'center'
        },
        _isCluster: true,
        _clusterId: key,
        _clusterSize: cellMarkers.length,
        _clusterTier: tier,
        _clusterColor: clusterColor,
        _clusterMarkers: cellMarkers,
        _clusterCenterLat: centerLat,
        _clusterCenterLng: centerLng
      })

      clusters.push({
        id: key,
        center: { lat: centerLat, lng: centerLng },
        count: cellMarkers.length,
        tier,
        markers: cellMarkers.map(m => m._place || m)
      })
    } else {
      // Not enough markers to cluster, show individually
      cellMarkers.forEach(m => {
        resultMarkers.push({ ...m, _isCluster: false })
      })
    }
  })

  return {
    markers: resultMarkers,
    clusters,
    totalCount: markers.length
  }
}

/**
 * When a cluster is tapped, zoom in to show individual markers
 * @param {Object} cluster - The cluster marker object
 * @returns {Object} { latitude, longitude, scale } for map update
 */
function getZoomTarget(cluster) {
  if (!cluster || !cluster._isCluster) return null

  const tier = cluster._clusterTier
  let targetZoom = 15 // Default: show all individual markers

  if (tier === 'large') targetZoom = 13
  else if (tier === 'medium') targetZoom = 14
  else targetZoom = 15

  return {
    latitude: cluster._clusterCenterLat,
    longitude: cluster._clusterCenterLng,
    scale: targetZoom
  }
}

/**
 * Get clustering stats for UI display
 * @param {Object} clusterResult - Result from clusterMarkers
 * @returns {Object} { total, displayed, hidden, clusterCount }
 */
function getClusterStats(clusterResult) {
  if (!clusterResult) return { total: 0, displayed: 0, hidden: 0, clusterCount: 0 }

  const clusterCount = clusterResult.clusters.length
  const displayed = clusterResult.markers.length
  const total = clusterResult.totalCount

  return {
    total,
    displayed,
    hidden: total - displayed + clusterCount, // clusters replace individual markers
    clusterCount
  }
}

module.exports = {
  CLUSTER_CONFIG,
  clusterMarkers,
  getZoomTarget,
  getClusterStats
}
