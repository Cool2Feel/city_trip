// utils/api.js - Enhanced API Service Layer v4.0
// Features:
// 1. Real REST API + Cloud + Mock fallback chain
// 2. Stale-While-Revalidate (SWR): return stale cache instantly, refresh in background
// 3. Differentiated cache TTL per data type (cities: 24h, report: 2h, places: 6h, weather: 1h)
// 4. Manual refresh: bypass cache on demand
// 5. Cache management: LRU eviction, size limit, status reporting
// 6. Request deduplication: concurrent identical requests share one call
// 7. Retry with exponential backoff
// 8. Auth token interceptor
// 9. Configurable per-endpoint timeout

const mockData = require('./mockData.js')
const categories = require('./categories.js')

// ===== Configuration =====
const CONFIG = {
  // REST API base URL (local dev server)
  baseUrl: 'http://localhost:3001/v1',
  // Production API URL (switch when deploying)
  // baseUrl: 'https://api.weekend-city-trip.com/v1',

  // Cloud development
  useCloud: false,
  cloudEnv: '',

  // Default request timeout (ms)
  timeout: 10000,

  // Cache max entries (LRU eviction when exceeded)
  maxCacheEntries: 50,
  // Cache max storage size (KB estimate)
  maxCacheSizeKB: 2048,

  // Retry config
  maxRetries: 2,
  retryBaseDelay: 500,

  // Enable SWR (stale-while-revalidate)
  enableSWR: true,

  // REST API 开关。
  // 当前没有可达的真实后端（baseUrl 指向 localhost:3001，真机既连不上又是明文 HTTP），
  // 故默认关闭：前台/后台首拉直接走本地打包数据，避免每次加载先试死服务器浪费约 1.5s。
  // 接入真实后端时：把 baseUrl 改为 https 域名，再打开此开关即可启用「校验 + 实时拉取」。
  useRest: false,

  // Enable request deduplication
  enableDedup: true
}

// ===== Data Version (cache invalidation on bundle updates) =====
// app.js onLaunch writes globalData.dataVersion -> wx.storage 'api_data_version'.
// Binding this into every city-scoped cache key means that bumping dataVersion
// (e.g. after a POI deepening) automatically invalidates ALL cities' cached
// report/places on next launch — the real "update propagation" we need.
function _dataVersion() {
  try {
    return wx.getStorageSync('api_data_version') || '0'
  } catch (e) {
    return '0'
  }
}

// Build a cache key bound to the current data version
function _vkey(base) {
  return base + '_v' + _dataVersion()
}

// ===== Data Validity Guards =====
// 在缓存/UI 之前校验拉取到的数据。畸形数据被「隔离」（不缓存），拉取链继续向下一个
// 数据源回退。这是「数据有效」的第一道防线：坏掉的 REST/Cloud 响应再也无法静默污染
// 缓存或让页面崩溃。
const CN_BOUNDS = { latMin: 18.0, latMax: 53.6, lngMin: 73.0, lngMax: 135.0 }

function _coordValid(lat, lng) {
  return typeof lat === 'number' && typeof lng === 'number' &&
    lat >= CN_BOUNDS.latMin && lat <= CN_BOUNDS.latMax &&
    lng >= CN_BOUNDS.lngMin && lng <= CN_BOUNDS.lngMax
}

function _ratingValid(r) {
  return r == null || (typeof r === 'number' && r >= 0 && r <= 5)
}

// 路线在两种报告结构里位置不同：
//  - 手写/AI 报告：嵌套在 sections[type==='routes'].routes
//  - 个别导出：可能直接挂在顶层 routes
// 统一抽取，避免误判「routes 缺失」（与 route.js 的读取方式保持一致）
function _extractRoutes(report) {
  if (Array.isArray(report.routes) && report.routes.length) return report.routes
  if (Array.isArray(report.sections)) {
    const sec = report.sections.find(s => s && s.type === 'routes' && Array.isArray(s.routes) && s.routes.length)
    if (sec) return sec.routes
  }
  return []
}

function validateReport(report) {
  if (!report || typeof report !== 'object') return { ok: false, reason: 'report 为空或非对象' }
  if (!report.cityCode && !report.city) return { ok: false, reason: '缺少 cityCode/city' }
  const routes = _extractRoutes(report)
  if (routes.length === 0) return { ok: false, reason: 'routes 缺失或为空' }
  for (const rt of routes) {
    if (!rt.id || !rt.name) return { ok: false, reason: '路线缺少 id/name' }
    if (!Array.isArray(rt.timeline) || rt.timeline.length === 0) return { ok: false, reason: `路线「${rt.name}」timeline 为空` }
  }
  return { ok: true }
}

function validatePlaces(places) {
  if (!Array.isArray(places)) return { ok: false, reason: 'places 非数组' }
  if (places.length === 0) return { ok: false, reason: 'places 为空' }
  let badCoord = 0, badRating = 0, noName = 0
  for (const p of places) {
    if (!p.name) noName++
    if (!_coordValid(p.lat, p.lng)) badCoord++
    if (!_ratingValid(p.rating)) badRating++
  }
  if (noName > 0) return { ok: false, reason: `存在 ${noName} 个无名 POI` }
  if (badCoord > 0) return { ok: false, reason: `存在 ${badCoord} 个越界坐标` }
  if (badRating > 0) return { ok: false, reason: `存在 ${badRating} 个评分越界` }
  return { ok: true }
}

function validateWeather(w) {
  if (!w || typeof w !== 'object') return { ok: false, reason: 'weather 为空' }
  if (w.temp == null && w.temperature == null && w.desc == null) return { ok: false, reason: 'weather 缺少温度/描述' }
  return { ok: true }
}

// 按缓存类型分发校验；未知类型直接放行（不强制守卫）
function _validateForType(type, data) {
  if (type === 'report') return validateReport(data)
  if (type === 'places') return validatePlaces(data)
  if (type === 'weather') return validateWeather(data)
  return { ok: true }
}

// ===== Differentiated Cache TTL =====
const CACHE_TTL = {
  cities:    24 * 60 * 60 * 1000,  // 24 hours - city list rarely changes
  city:      24 * 60 * 60 * 1000,  // 24 hours - city detail
  hot_cities: 24 * 60 * 60 * 1000, // 24 hours
  report:    2 * 60 * 60 * 1000,   // 2 hours - report data changes weekly
  places:    6 * 60 * 60 * 1000,   // 6 hours - places change occasionally
  center:    30 * 24 * 60 * 60 * 1000, // 30 days - coordinates rarely change
  weather:   1 * 60 * 60 * 1000    // 1 hour - weather updates frequently
}

// ===== LRU Cache =====
// FIX: _store Map now stays in sync with wx.storage so LRU eviction actually works.
// Previously _store was never written to, so _evictIfNeeded() condition was always false.
const cache = {
  _store: new Map(), // key (without prefix) -> { data, expire, staleExpire, timestamp, hitCount, lastAccess, size, type }
  _totalSize: 0,
  _synced: false,

  // Sync _store from existing storage entries (called once on first access)
  _syncFromStorage() {
    if (this._synced) return
    this._synced = true
    try {
      const info = wx.getStorageInfoSync()
      const cacheKeys = info.keys.filter(k => k.startsWith('api_cache_'))
      cacheKeys.forEach(fullKey => {
        try {
          const item = wx.getStorageSync(fullKey)
          if (item && item.data) {
            const key = fullKey.replace('api_cache_', '')
            this._store.set(key, item)
            this._totalSize += (item.size || 1)
          }
        } catch (e) {}
      })
      if (cacheKeys.length > 0) {
        console.log(`[api] cache sync: ${cacheKeys.length} entries, ${this._totalSize}KB`)
      }
    } catch (e) {}
  },

  _estimateSize(data) {
    try {
      return Math.max(1, Math.round(JSON.stringify(data).length / 1024)) // KB
    } catch (e) {
      return 1
    }
  },

  _evictIfNeeded() {
    this._syncFromStorage()
    while (this._store.size >= CONFIG.maxCacheEntries || this._totalSize >= CONFIG.maxCacheSizeKB) {
      // Find LRU entry (lowest hitCount * recency)
      let lruKey = null
      let lruScore = Infinity
      const now = Date.now()

      for (const [key, item] of this._store) {
        // Score: lower = less valuable = evict first
        const recency = now - (item.lastAccess || item.timestamp || now)
        const score = (item.hitCount || 0) * 1000 / (recency / 60000 + 1)
        if (score < lruScore) {
          lruScore = score
          lruKey = key
        }
      }

      if (lruKey) {
        const item = this._store.get(lruKey)
        this._totalSize -= (item.size || 1)
        this._store.delete(lruKey)
        // Also remove from persistent storage
        try { wx.removeStorageSync('api_cache_' + lruKey) } catch (e) {}
      } else {
        break
      }
    }
  },

  get(key, allowStale = false) {
    this._syncFromStorage()
    const fullKey = 'api_cache_' + key
    try {
      // Try in-memory store first (fast path)
      let item = this._store.get(key)
      if (!item) {
        // Fallback to persistent storage (entry from previous session)
        item = wx.getStorageSync(fullKey)
        if (!item) return null
        // Populate _store for future LRU tracking
        this._store.set(key, item)
        this._totalSize += (item.size || 1)
      }

      const now = Date.now()
      if (item.expire > now) {
        // Fresh cache hit
        item.hitCount = (item.hitCount || 0) + 1
        item.lastAccess = now
        // Persist updated hit count
        try { wx.setStorageSync(fullKey, item) } catch (e) {}
        return { data: item.data, stale: false, age: now - item.timestamp, timestamp: item.timestamp }
      }

      if (allowStale && item.staleExpire && item.staleExpire > now) {
        // Stale cache hit (SWR mode)
        return { data: item.data, stale: true, age: now - item.timestamp, timestamp: item.timestamp }
      }

      // Cache expired completely
      return null
    } catch (e) {
      return null
    }
  },

  set(key, data, ttl, type = 'default') {
    this._syncFromStorage()
    const fullKey = 'api_cache_' + key
    try {
      // Remove old entry size if replacing
      const oldItem = this._store.get(key)
      if (oldItem) {
        this._totalSize -= (oldItem.size || 1)
      }

      const now = Date.now()
      const expire = now + ttl
      // Stale period: keep stale data for additional 50% of TTL
      const staleExpire = expire + ttl * 0.5
      const size = this._estimateSize(data)

      const item = {
        data,
        expire,
        staleExpire,
        timestamp: now,
        hitCount: 0,
        lastAccess: now,
        type,
        size
      }

      // Write to BOTH in-memory store AND persistent storage
      this._store.set(key, item)
      this._totalSize += size
      wx.setStorageSync(fullKey, item)

      this._evictIfNeeded()
    } catch (e) {
      // Storage might be full, try to clear old entries
      console.warn('[api] cache set failed:', key, e.message)
      this._evictOldest()
    }
  },

  _evictOldest() {
    // Emergency: remove oldest 5 entries from both _store and storage
    try {
      const info = wx.getStorageInfoSync()
      const cacheKeys = info.keys.filter(k => k.startsWith('api_cache_'))
      cacheKeys.slice(0, 5).forEach(fullKey => {
        wx.removeStorageSync(fullKey)
        const key = fullKey.replace('api_cache_', '')
        const item = this._store.get(key)
        if (item) {
          this._totalSize -= (item.size || 1)
          this._store.delete(key)
        }
      })
    } catch (e) {}
  },

  remove(key) {
    try {
      wx.removeStorageSync('api_cache_' + key)
      const item = this._store.get(key)
      if (item) {
        this._totalSize -= (item.size || 1)
        this._store.delete(key)
      }
    } catch (e) {}
  },

  // Remove all cache entries whose key starts with the given prefix.
  // Handles versioned + variant keys (e.g. report_guangzhou_v7.5.0_w0) so that
  // per-city invalidation actually clears the real cached entries.
  removeByPrefix(prefix) {
    try {
      const info = wx.getStorageInfoSync()
      info.keys.forEach(k => {
        if (k.startsWith('api_cache_')) {
          const key = k.replace('api_cache_', '')
          if (key.startsWith(prefix)) {
            const item = this._store.get(key)
            if (item) {
              this._totalSize -= (item.size || 1)
              this._store.delete(key)
            }
            try { wx.removeStorageSync(k) } catch (e) {}
          }
        }
      })
    } catch (e) {}
  },

  clearAll() {
    try {
      const info = wx.getStorageInfoSync()
      info.keys.forEach(k => {
        if (k.startsWith('api_cache_')) wx.removeStorageSync(k)
      })
      this._store.clear()
      this._totalSize = 0
    } catch (e) {}
  },

  /**
   * Get cache status report
   */
  getStatus() {
    try {
      const info = wx.getStorageInfoSync()
      const cacheKeys = info.keys.filter(k => k.startsWith('api_cache_'))
      let totalSize = 0
      let totalHits = 0
      let oldest = Date.now()
      const byType = {}

      cacheKeys.forEach(k => {
        try {
          const item = wx.getStorageSync(k)
          if (item) {
            totalSize += item.size || 0
            totalHits += item.hitCount || 0
            if (item.timestamp < oldest) oldest = item.timestamp
            const type = item.type || 'unknown'
            if (!byType[type]) byType[type] = { count: 0, size: 0, hits: 0 }
            byType[type].count++
            byType[type].size += item.size || 0
            byType[type].hits += item.hitCount || 0
          }
        } catch (e) {}
      })

      return {
        totalEntries: cacheKeys.length,
        totalSizeKB: totalSize,
        storageLimitKB: Math.round(info.limitSize / 1024),
        storageUsedKB: Math.round(info.currentSize / 1024),
        totalHits,
        oldestEntry: oldest < Date.now() ? new Date(oldest).toISOString() : null,
        byType
      }
    } catch (e) {
      return { error: e.message }
    }
  }
}

// ===== Auth Token Interceptor =====
let _authToken = null
function setAuthToken(token) {
  _authToken = token
}
function getAuthToken() {
  return _authToken || wx.getStorageSync('auth_token') || null
}

// ===== HTTP Request with Retry =====
function request(options) {
  const maxRetries = options.retries != null ? options.retries : CONFIG.maxRetries
  const baseDelay = CONFIG.retryBaseDelay

  function attempt(retryCount) {
    return new Promise((resolve, reject) => {
      const headers = {
        'Content-Type': 'application/json',
        ...options.header
      }

      // Inject auth token
      const token = getAuthToken()
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      wx.request({
        url: CONFIG.baseUrl + options.path,
        method: options.method || 'GET',
        data: options.data || {},
        timeout: options.timeout || CONFIG.timeout,
        header: headers,
        success(res) {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(res.data)
          } else if (res.statusCode >= 500 && retryCount < maxRetries) {
            // Server error - retry
            const delay = baseDelay * Math.pow(2, retryCount)
            console.warn(`[api] retry ${retryCount + 1}/${maxRetries} in ${delay}ms`)
            setTimeout(() => attempt(retryCount + 1).then(resolve).catch(reject), delay)
          } else if (res.statusCode === 401) {
            // Auth expired
            _authToken = null
            wx.removeStorageSync('auth_token')
            reject(new Error('Authentication expired'))
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${res.data && res.data.error ? res.data.error.message : 'Request failed'}`))
          }
        },
        fail(err) {
          if (retryCount < maxRetries) {
            const delay = baseDelay * Math.pow(2, retryCount)
            console.warn(`[api] network retry ${retryCount + 1}/${maxRetries}: ${err.errMsg}`)
            setTimeout(() => attempt(retryCount + 1).then(resolve).catch(reject), delay)
          } else {
            reject(new Error(err.errMsg || 'Network error after retries'))
          }
        }
      })
    })
  }

  return attempt(0)
}

// ===== Cloud Development =====
function cloudCall(name, data) {
  return new Promise((resolve, reject) => {
    if (!CONFIG.useCloud || !wx.cloud) {
      reject(new Error('Cloud not initialized'))
      return
    }
    wx.cloud.callFunction({
      name,
      data,
      success(res) {
        resolve(res.result)
      },
      fail(err) {
        reject(new Error(err.errMsg || 'Cloud function failed'))
      }
    })
  })
}

// ===== Request Deduplication =====
const _pendingRequests = new Map()

function dedup(key, fn) {
  if (!CONFIG.enableDedup) return fn()

  if (_pendingRequests.has(key)) {
    // Return the existing promise
    return _pendingRequests.get(key)
  }

  const promise = fn().finally(() => {
    _pendingRequests.delete(key)
  })

  _pendingRequests.set(key, promise)
  return promise
}

// ===== Enhanced Fetch with SWR =====
/**
 * Fetch with fallback chain and Stale-While-Revalidate
 * @param {String} cacheKey - Cache key
 * @param {Function} apiFn - REST API call function
 * @param {Function} cloudFn - Cloud function call
 * @param {Function} mockFn - Mock fallback function
 * @param {Object} opts - { ttl, type, forceRefresh, onStaleUpdate }
 */
async function fetchWithFallback(cacheKey, apiFn, cloudFn, mockFn, opts = {}) {
  const ttl = opts.ttl || CONFIG.cacheTTL || 30 * 60 * 1000
  const type = opts.type || 'default'
  const forceRefresh = opts.forceRefresh || false
  const onStaleUpdate = opts.onStaleUpdate || null

  // 1. Check cache (unless force refresh)
  if (!forceRefresh) {
    const cached = cache.get(cacheKey, CONFIG.enableSWR)
    if (cached) {
      const out = {
        data: cached.data,
        source: 'cache',
        stale: cached.stale,
        age: cached.age,
        fetchedAt: cached.timestamp || Date.now()
      }
      if (cached.stale) {
        // Stale cache - return immediately, refresh in background
        console.log(`[api] SWR: returning stale cache for ${cacheKey}`)
        // Trigger background refresh
        _backgroundRefresh(cacheKey, apiFn, cloudFn, mockFn, ttl, type, onStaleUpdate)
      }
      return out
    }
  }

  // 2. Try REST API (with dedup) — 校验通过才信任
  if (CONFIG.useRest) {
    try {
      const result = await dedup(cacheKey + '_api', apiFn)
      if (result) {
        const data = result.data != null ? result.data : result
        const v = _validateForType(type, data)
        if (!v.ok) {
          console.warn(`[api] REST 数据无效（${cacheKey}）：${v.reason}；回退下一源`)
        } else {
          cache.set(cacheKey, data, ttl, type)
          if (onStaleUpdate) onStaleUpdate(data)
          return { data, source: 'api', stale: false, fetchedAt: Date.now() }
        }
      }
    } catch (e) {
      console.warn(`[api] REST API failed for ${cacheKey}:`, e.message)
    }
  }

  // 3. Try cloud development — 校验通过才信任
  if (CONFIG.useCloud) {
    try {
      const result = await cloudFn()
      if (result) {
        const v = _validateForType(type, result)
        if (!v.ok) {
          console.warn(`[api] Cloud 数据无效（${cacheKey}）：${v.reason}；回退下一源`)
        } else {
          cache.set(cacheKey, result, ttl, type)
          if (onStaleUpdate) onStaleUpdate(result)
          return { data: result, source: 'cloud', stale: false, fetchedAt: Date.now() }
        }
      }
    } catch (e) {
      console.warn(`[api] cloud failed for ${cacheKey}:`, e.message)
    }
  }

  // 4. Try stale cache (even if expired, for offline support)
  if (CONFIG.enableSWR) {
    try {
      const item = wx.getStorageSync('api_cache_' + cacheKey)
      if (item && item.data) {
        console.log(`[api] offline: returning expired cache for ${cacheKey}`)
        return { data: item.data, source: 'cache', stale: true, offline: true, fetchedAt: item.timestamp || Date.now() }
      }
    } catch (e) {}
  }

  // 5. Final fallback: Mock / 本地打包数据（最后一源，仍做校验告警但不阻断）
  const mockResult = mockFn()
  const mv = _validateForType(type, mockResult)
  if (!mv.ok) console.warn(`[api] 本地打包数据异常（${cacheKey}）：${mv.reason}`)
  return { data: mockResult, source: 'mock', stale: false, fetchedAt: Date.now() }
}

/**
 * Background refresh for SWR
 * Primary source (REST/Cloud) first; if it fails, fall back to the local bundled
 * data so the cache is still updated from the latest package (recomputes weekend
 * string etc.) instead of being stuck on a stale entry forever.
 */
async function _backgroundRefresh(cacheKey, apiFn, cloudFn, mockFn, ttl, type, onStaleUpdate) {
  try {
    // useRest=false 时后台刷新直接用 mock 数据，避免发出注定失败的请求
    if (CONFIG.useRest) {
      try {
        const result = await dedup(cacheKey + '_bg_refresh', apiFn)
        if (result) {
          const data = result.data != null ? result.data : result
          const v = _validateForType(type, data)
          if (!v.ok) {
            console.warn(`[api] SWR bg: REST 数据无效（${cacheKey}）：${v.reason}；跳过`)
          } else {
            cache.set(cacheKey, data, ttl, type)
            if (onStaleUpdate) onStaleUpdate(data)
            console.log(`[api] SWR: background refresh complete for ${cacheKey}`)
            return
          }
        }
      } catch (e) {
        console.warn(`[api] SWR: bg REST failed for ${cacheKey}, fallback to local:`, e.message)
      }
    }
    if (CONFIG.useCloud) {
      try {
        const result = await cloudFn()
        if (result) {
          const v = _validateForType(type, result)
          if (!v.ok) {
            console.warn(`[api] SWR bg: Cloud 数据无效（${cacheKey}）：${v.reason}；跳过`)
          } else {
            cache.set(cacheKey, result, ttl, type)
            if (onStaleUpdate) onStaleUpdate(result)
            console.log(`[api] SWR: background refresh (cloud) complete for ${cacheKey}`)
            return
          }
        }
      } catch (e) {
        console.warn(`[api] SWR: bg cloud failed for ${cacheKey}, fallback to local:`, e.message)
      }
    }
    // Fallback: local bundled data (the only real source in this deployment)
    const mockResult = mockFn()
    if (mockResult != null) {
      cache.set(cacheKey, mockResult, ttl, type)
      if (onStaleUpdate) onStaleUpdate(mockResult)
      console.log(`[api] SWR: background refresh (local) complete for ${cacheKey}`)
    }
  } catch (e) {
    // Background refresh failed, keep stale cache
    console.warn(`[api] SWR: background refresh failed for ${cacheKey}:`, e.message)
  }
}

// ===== API Methods =====

/**
 * Get all cities
 */
async function getCities(forceRefresh = false) {
  return fetchWithFallback(
    _vkey('cities'),
    () => request({ path: '/cities' }),
    () => cloudCall('getCities', {}),
    () => mockData.getCities(),
    { ttl: CACHE_TTL.cities, type: 'cities', forceRefresh }
  )
}

/**
 * Get city detail
 */
async function getCity(cityCode, forceRefresh = false) {
  return fetchWithFallback(
    _vkey(`city_${cityCode}`),
    () => request({ path: `/cities/${cityCode}` }),
    () => cloudCall('getCity', { cityCode }),
    () => mockData.getCity(cityCode),
    { ttl: CACHE_TTL.city, type: 'city', forceRefresh }
  )
}

/**
 * Get hot cities
 */
async function getHotCities(forceRefresh = false) {
  return fetchWithFallback(
    _vkey('hot_cities'),
    () => request({ path: '/cities/hot' }),
    () => cloudCall('getHotCities', {}),
    () => mockData.getHotCities(),
    { ttl: CACHE_TTL.hot_cities, type: 'hot_cities', forceRefresh }
  )
}

/**
 * Get city report (10-section)
 */
async function getReport(cityCode, forceRefresh = false, opts = {}) {
  const weekendOffset = opts.weekendOffset || 0
  const preference = opts.preference || ''
  const variant = `_w${weekendOffset}${preference ? '_p' + preference : ''}`
  return fetchWithFallback(
    _vkey(`report_${cityCode}${variant}`),
    () => request({ path: `/reports/${cityCode}`, data: { weekendOffset, preference } }),
    () => cloudCall('getReport', { cityCode, weekendOffset, preference }),
    () => mockData.getReport(cityCode, { weekendOffset, preference }),
    { ttl: CACHE_TTL.report, type: 'report', forceRefresh }
  )
}

/**
 * Get map places
 */
async function getPlaces(cityCode, forceRefresh = false) {
  return fetchWithFallback(
    _vkey(`places_${cityCode}`),
    () => request({ path: `/places/${cityCode}` }),
    () => cloudCall('getPlaces', { cityCode }),
    () => mockData.getPlaces(cityCode),
    { ttl: CACHE_TTL.places, type: 'places', forceRefresh }
  )
}

/**
 * Get city center coordinates
 */
async function getCityCenter(cityCode, forceRefresh = false) {
  return fetchWithFallback(
    _vkey(`center_${cityCode}`),
    () => request({ path: `/cities/${cityCode}/center` }),
    () => cloudCall('getCityCenter', { cityCode }),
    () => mockData.getCityCenter(cityCode),
    { ttl: CACHE_TTL.center, type: 'center', forceRefresh }
  )
}

/**
 * Search cities (local operation)
 */
async function searchCities(keyword) {
  const cities = mockData.getCities()
  const key = keyword.toLowerCase().trim()
  if (!key) return { data: cities, source: 'local' }

  const results = cities.filter(c =>
    c.name.includes(keyword) ||
    c.pinyin.toLowerCase().includes(key) ||
    c.province.includes(keyword)
  )
  return { data: results, source: 'local' }
}

/**
 * Search content across all cities (server-side aggregation)
 * Falls back to a local mock scan of report content when the server is unreachable.
 */
async function searchContent(keyword) {
  const q = (keyword || '').trim()
  if (!q) return { data: [], source: 'local' }
  // useRest=false 时直接走本地 mock 扫描
  if (!CONFIG.useRest) return { data: searchContentMock(q), source: 'mock' }
  try {
    const result = await request({ path: `/searchContent?q=${encodeURIComponent(q)}`, timeout: 8000 })
    return { data: (result && result.data) || [], source: 'api' }
  } catch (e) {
    try {
      return { data: searchContentMock(q), source: 'mock' }
    } catch (e2) {
      return { data: [], source: 'error' }
    }
  }
}

// ===== Mock content search (client-side fallback) =====
function _searchItemText(item) {
  const parts = []
  Object.keys(item || {}).forEach(k => {
    const v = item[k]
    if (typeof v === 'string' && v) parts.push(v)
  })
  return parts.join(' ')
}

function _searchItemSub(item) {
  const skip = ['name', 'source']
  const parts = []
  Object.keys(item || {}).forEach(k => {
    if (skip.includes(k)) return
    const v = item[k]
    if (typeof v === 'string' && v) parts.push(v)
  })
  return parts.join(' · ')
}

function searchContentMock(keyword) {
  const q = keyword.toLowerCase().trim()
  const bucket = new Map()
  const push = (key, catId, item, city) => {
    if (!bucket.has(key)) {
      const cat = categories.getCategory(catId)
      bucket.set(key, {
        cityCode: city.code,
        cityName: city.name,
        category: catId,
        categoryLabel: cat ? cat.name : catId,
        items: []
      })
    }
    const group = bucket.get(key)
    if (group.items.length < 5) {
      group.items.push({ name: item.name || item.title || '', sub: _searchItemSub(item) })
    }
  }

  mockData.getCities().forEach(city => {
    const report = mockData.getReport(city.code)
    if (!report || !report.sections) return
    report.sections.forEach(section => {
      if (!section) return
      if (section.type === 'activities' && section.groups) {
        section.groups.forEach(group => {
          ;(group.items || []).forEach(item => {
            if (_searchItemText(item).toLowerCase().includes(q)) push(`${city.code}_${group.category}`, group.category, item, city)
          })
        })
      } else if (['ticket', 'tea', 'food', 'walk'].includes(section.type) && section.items) {
        section.items.forEach(item => {
          if (_searchItemText(item).toLowerCase().includes(q)) push(`${city.code}_${section.type}`, section.type, item, city)
        })
      } else if (section.type === 'metro' && section.keyStations) {
        section.keyStations.forEach(item => {
          if (_searchItemText(item).toLowerCase().includes(q)) push(`${city.code}_metro`, 'metro', item, city)
        })
      }
    })
  })

  return Array.from(bucket.values())
}

/**
 * Get weather data
 */
async function getWeather(cityCode, forceRefresh = false) {
  return fetchWithFallback(
    _vkey(`weather_${cityCode}`),
    () => request({ path: `/weather/${cityCode}` }),
    () => cloudCall('getWeather', { cityCode }),
    () => {
      const city = mockData.getCity(cityCode)
      return city ? generateMockWeather(city) : null
    },
    { ttl: CACHE_TTL.weather, type: 'weather', forceRefresh }
  )
}

/**
 * Get WeChat mini program code image (for poster sharing)
 * Returns a temp file path via wx.getImageInfo, or null on failure.
 * @param {String} scene - scene value embedded in the code
 * @param {String} page - page path (default pages/home/home)
 * @returns {Promise<String|null>} tempFilePath
 */
async function getWxacode(scene = 'home', page = 'pages/home/home') {
  if (!CONFIG.useRest) return Promise.resolve(null)
  const url = `${CONFIG.baseUrl}/wxacode?scene=${encodeURIComponent(scene)}&page=${encodeURIComponent(page)}`
  return new Promise((resolve) => {
    wx.getImageInfo({
      src: url,
      success: (res) => resolve(res.path),
      fail: () => resolve(null)
    })
  })
}

/**
 * Generate mock weather
 */
function generateMockWeather(city) {
  const seasons = {
    summer: { temp: '28-35°C', text: '晴', icon: '☀️' },
    winter: { temp: '5-12°C', text: '多云', icon: '⛅' },
    spring: { temp: '15-25°C', text: '晴转多云', icon: '🌤️' },
    autumn: { temp: '18-26°C', text: '晴', icon: '☀️' }
  }
  const month = new Date().getMonth() + 1
  let season = 'spring'
  if (month >= 6 && month <= 8) season = 'summer'
  else if (month >= 12 || month <= 2) season = 'winter'
  else if (month >= 9 && month <= 11) season = 'autumn'

  const w = seasons[season]
  return {
    city: city.name,
    temp: w.temp,
    text: w.text,
    icon: w.icon,
    forecast: [
      { day: '周六', weather: w.text, temp: w.temp },
      { day: '周日', weather: w.text, temp: w.temp }
    ]
  }
}

/**
 * Get weekend info
 */
function getWeekendInfo() {
  const now = new Date()
  const day = now.getDay()
  const saturday = new Date(now)
  saturday.setDate(now.getDate() + (6 - day))
  const sunday = new Date(saturday)
  sunday.setDate(saturday.getDate() + 1)

  const fmt = (d) => `${d.getMonth() + 1}月${d.getDate()}日`
  const fmtLabel = (d) => {
    const days = ['日', '一', '二', '三', '四', '五', '六']
    return `${d.getMonth() + 1}月${d.getDate()}日(周${days[d.getDay()]})`
  }

  return {
    saturday: saturday,
    sunday: sunday,
    saturdayLabel: fmtLabel(saturday),
    sundayLabel: fmtLabel(sunday),
    range: `${fmt(saturday)}~${fmt(sunday)}`
  }
}

/**
 * Initialize cloud development
 */
function initCloud(env) {
  if (wx.cloud && env) {
    CONFIG.useCloud = true
    CONFIG.cloudEnv = env
    wx.cloud.init({
      env: env,
      traceUser: true
    })
    console.log('[api] Cloud initialized:', env)
    return true
  }
  console.log('[api] Cloud not available, using REST API + Mock fallback')
  return false
}

/**
 * Set API base URL (for environment switching)
 */
function setBaseUrl(url) {
  CONFIG.baseUrl = url
  console.log('[api] Base URL set to:', url)
}

/**
 * Preload city data
 */
async function preloadCity(cityCode) {
  try {
    await Promise.all([
      getReport(cityCode),
      getPlaces(cityCode),
      getCityCenter(cityCode),
      getWeather(cityCode)
    ])
    console.log('[api] Preloaded city:', cityCode)
  } catch (e) {
    console.warn('[api] Preload failed:', e.message)
  }
}

/**
 * Remove every cached entry for a city (covers versioned + variant keys).
 * report_xxx includes _w0/_w1/_pX variants; places_/city_/center_/weather_ too.
 */
function _removeCityCacheEntries(cityCode) {
  ;['report_', 'places_', 'city_', 'center_', 'weather_'].forEach(p => {
    cache.removeByPrefix(p + cityCode)
  })
}

/**
 * Refresh all data for a city (force bypass cache)
 */
async function refreshCity(cityCode) {
  _removeCityCacheEntries(cityCode)

  const [report, places, weather] = await Promise.all([
    getReport(cityCode, true),
    getPlaces(cityCode, true),
    getWeather(cityCode, true)
  ])

  return { report, places, weather }
}

/**
 * Clear cache for a specific city
 */
function clearCityCache(cityCode) {
  _removeCityCacheEntries(cityCode)
}

/**
 * Check if server is reachable
 */
async function checkServerHealth() {
  if (!CONFIG.useRest) {
    return { reachable: false, error: 'REST API disabled (useRest=false)' }
  }
  try {
    const result = await request({ path: '/health', timeout: 3000, retries: 0 })
    return { reachable: true, info: result }
  } catch (e) {
    return { reachable: false, error: e.message }
  }
}

module.exports = {
  CONFIG,
  CACHE_TTL,
  cache,
  // Data API
  getCities,
  getCity,
  getHotCities,
  getReport,
  getPlaces,
  getCityCenter,
  searchCities,
  searchContent,
  getWeather,
  getWeekendInfo,
  getWxacode,
  // Cloud
  initCloud,
  // Config
  setBaseUrl,
  setAuthToken,
  getAuthToken,
  // Cache management
  preloadCity,
  refreshCity,
  clearCityCache,
  clearAllCache: cache.clearAll,
  getCacheStatus: cache.getStatus,
  // Health
  checkServerHealth,
  // Data version (for UI display + cache invalidation)
  getDataVersion: _dataVersion,
  // Data validity guards (exported for reuse / testing)
  validateReport,
  validatePlaces,
  validateWeather
}
