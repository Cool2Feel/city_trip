// utils/scraper_core.js
// 统一抓取基础设施：所有数据源平台共用，保证容错一致、坐标系可标注、时效可计算。
//
// 提供：
//  - fetchWithRetry   统一的带重试抓取（指数退避，自动识别 JSON / 文本）
//  - parseSourceWindow 解析中文「活动窗口」文本为 {start,end}（ISO 日期或 null）
//  - computeIsExpired  根据活动窗口判断数据是否已过期
//  - wgs2gcj           WGS-84 → GCJ-02 坐标系转换
//  - normalizeCoord    按数据源声明的坐标系，将坐标归一化到规范系 GCJ-02
//  - createAdapter     平台适配器工厂：封装超时/重试/并发限制/失败隔离
//
/* eslint-disable */
// 注意：本模块不依赖 fs/path 等 Node 内置（仅函数体内使用全局 fetch/AbortController），
// 以便可被小程序 runtime 的 mockData 安全 require 而不触发打包错误。

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// 简易并发限制器，避免批量请求打爆配额
function limiter(concurrency) {
  let active = 0
  const queue = []
  const pump = () => {
    if (active >= concurrency || queue.length === 0) return
    active++
    const { fn, resolve, reject } = queue.shift()
    Promise.resolve().then(fn).then(resolve, reject).finally(() => { active--; pump() })
  }
  return fn => new Promise((resolve, reject) => { queue.push({ fn, resolve, reject }); pump() })
}

// 统一带重试抓取：所有平台共用，保证容错参数一致。
// 返回：JSON（content-type 含 application/json）或 文本；超时/HTTP 非 2xx/网络错误在重试耗尽后返回 null。
async function fetchWithRetry(url, { timeoutMs = 20000, retries = 3, backoff = 400, headers = {} } = {}) {
  let lastErr
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const r = await fetch(url, { signal: ctrl.signal, headers })
      if (!r.ok) {
        if (attempt < retries) { console.log('  · 重试(' + (attempt + 1) + ')', url, 'HTTP', r.status); await sleep(backoff * (attempt + 1)); continue }
        console.log('  ✗ 抓取失败(HTTP ' + r.status + '):', url); return null
      }
      const ct = (r.headers && r.headers.get && r.headers.get('content-type')) || ''
      return ct.includes('application/json') ? await r.json() : await r.text()
    } catch (e) {
      lastErr = e
      if (attempt < retries) { console.log('  · 重试(' + (attempt + 1) + ')', url, '(' + e.message + ')'); await sleep(backoff * (attempt + 1)); continue }
      console.log('  ✗ 抓取失败(' + e.message + '):', url); return null
    } finally { clearTimeout(t) }
  }
  return null
}

// 解析中文「活动窗口」文本 → { start, end }（ISO 日期或 null）+ raw。
// 支持：2026年7月4-5日 / 2026年7月4日 / 2026年7月；无法解析（如「未来一个月」「2026年中秋」）仅保留 raw。
function parseSourceWindow(text) {
  if (!text) return null
  const t = String(text).trim()
  const day = t.match(/(\d{4})年(\d{1,2})月(\d{1,2})日?(?:-(\d{1,2})日?)?/)
  if (day) {
    const y = +day[1], m = +day[2], d1 = +day[3], d2 = day[4] ? +day[4] : d1
    const start = new Date(Date.UTC(y, m - 1, d1)).toISOString().slice(0, 10)
    const end = new Date(Date.UTC(y, m - 1, d2)).toISOString().slice(0, 10)
    return { start, end, raw: t }
  }
  const mon = t.match(/(\d{4})年(\d{1,2})月$/)
  if (mon) {
    const y = +mon[1], m = +mon[2]
    const start = new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10)
    const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
    return { start, end, raw: t }
  }
  // 无法解析为具体日期：只保留原始文本，不判定过期
  return { start: null, end: null, raw: t }
}

// 根据活动窗口结束日判断数据是否已过期（结束日 < 当前时刻 → 过期）
function computeIsExpired(window, nowMs = Date.now()) {
  if (!window || !window.end) return false
  return new Date(window.end + 'T23:59:59Z').getTime() < nowMs
}

// WGS-84 → GCJ-02（高德/腾讯/微信 map 同系）。outOfChina 直接原样返回。
// 为未来接入 OSM / 官方 GPS / 部分开放 API（WGS-84）预留，当前 GCJ-02 源不会触发。
function wgs2gcj(lat, lng) {
  const a = 6378245.0
  const ee = 0.00669342162296594323
  const outOfChina = (la, lo) => !(lo > 73.0 && lo < 135.0 && la > 18.0 && la < 53.6)
  if (outOfChina(lat, lng)) return [lat, lng]
  const transformLat = (x, y) => {
    let r = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
    r += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0
    r += (20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin(y / 3.0 * Math.PI)) * 2.0 / 3.0
    r += (160.0 * Math.sin(y / 12.0 * Math.PI) + 320.0 * Math.sin(y * Math.PI / 30.0)) * 2.0 / 3.0
    return r
  }
  const transformLng = (x, y) => {
    let r = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
    r += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0
    r += (20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin(x / 3.0 * Math.PI)) * 2.0 / 3.0
    r += (150.0 * Math.sin(x / 12.0 * Math.PI) + 300.0 * Math.sin(x / 30.0 * Math.PI)) * 2.0 / 3.0
    return r
  }
  let dLat = transformLat(lng - 105.0, lat - 35.0)
  let dLng = transformLng(lng - 105.0, lat - 35.0)
  const radLat = lat / 180.0 * Math.PI
  let magic = Math.sin(radLat)
  magic = 1 - ee * magic * magic
  const sqrtMagic = Math.sqrt(magic)
  dLat = (dLat * 180.0) / ((a * (1 - ee)) / (magic * sqrtMagic) * Math.PI)
  dLng = (dLng * 180.0) / (a / sqrtMagic * Math.cos(radLat) * Math.PI)
  return [lat + dLat, lng + dLng]
}

// 规范坐标系：所有落库 POI 统一转到该系（高德/腾讯/微信 map 同系），
// 以确保不同来源（citymap/腾讯 GCJ-02、OSM/官方 GPS WGS-84）混用时地图标点不会偏移。
const CANONICAL_COORD = 'GCJ-02'

// 按数据源声明的坐标系，将经纬度归一化到规范系 GCJ-02。
//  - 'GCJ-02' / 'GCJ02'：原样返回（已在规范系）
//  - 'WGS-84' / 'WGS84'：经 wgs2gcj 偏移（OpenStreetMap / 官方 GPS / 部分开放 API 使用）
//  - 其它/未声明：原样返回并告警（默认假设 GCJ-02，避免静默错误；适配器必须显式声明坐标系）
// 这是 P2「不同平台抓取处理」的关键：新增 WGS-84 平台时，只要声明 coordSystem，
// 合并层会自动把坐标转对，无需在各处手写转换。
function normalizeCoord(coordSystem, lat, lng) {
  const cs = String(coordSystem || '').trim().toUpperCase().replace('-', '')
  if (cs === 'WGS84') return wgs2gcj(lat, lng)
  if (cs === 'GCJ02' || cs === '') return [lat, lng]
  console.warn('  ⚠ 未知坐标系 "' + coordSystem + '"，按 GCJ-02 原样保留（请在适配器显式声明 coordSystem）')
  return [lat, lng]
}

// 平台适配器工厂：每个数据源（citymap / 腾讯地图 / 和风天气 / 未来演出平台）一个实例。
// - fetch: 单条抓取（带本平台超时与重试）
// - fetchMany: 多条并行抓取，失败隔离（单条失败不中断整轮，返回 ok/failed 清单）
function createAdapter(cfg) {
  const adapter = {
    name: cfg.name,
    coordSystem: cfg.coordSystem || 'gcj-02',
    timeoutMs: cfg.timeoutMs || 20000,
    retries: cfg.retries != null ? cfg.retries : 3,
    lastSuccess: null,
    async fetch(url, headers) {
      const data = await fetchWithRetry(url, { timeoutMs: this.timeoutMs, retries: this.retries, headers })
      if (data != null) this.lastSuccess = new Date().toISOString()
      return data
    },
    async fetchMany(items, fn, concurrency = 3) {
      const limit = limiter(concurrency)
      const ok = [], failed = []
      const results = new Map()
      await Promise.all(items.map(key => limit(async () => {
        try {
          const data = await fn(key, adapter)
          results.set(key, data)
          if (data != null) ok.push(key)
          else failed.push(key)
        } catch (e) {
          failed.push(key)
          results.set(key, null)
        }
      })))
      return { ok, failed, results }
    }
  }
  return adapter
}

module.exports = {
  sleep, limiter, fetchWithRetry,
  parseSourceWindow, computeIsExpired, wgs2gcj,
  normalizeCoord, CANONICAL_COORD,
  createAdapter
}
