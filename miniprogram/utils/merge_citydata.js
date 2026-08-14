// utils/merge_citydata.js
// 置信度加权合并：将「权威/打包(bundled)」与「第三方 citymap 抓取」两路数据，
// 以 POI 级粒度做可信度加权合并，取代原先 Object.assign 的整城盲覆盖。
//
// 设计目标：
//  - P1「数据源有效准确」：同名 POI 取高置信坐标 + 坐标差 >500m 标冲突 + 互补追加。
//  - P2「坐标系适配」：合并前按各源声明的坐标系把 POI 归一化为规范系 GCJ-02，
//    使 WGS-84（OSM/官方 GPS 等未来平台）与 GCJ-02 源混用时地图标点不偏移。
//    每个 POI/report 落库后记录 coordSystem='GCJ-02' 与来源系，供校验 SLA 与审计。
//
// 纯函数模块：不依赖 fs/网络；build 与小程序 runtime 兜底（mockData）均可安全 require。
// 仅依赖 scraper_core 的纯函数（normalizeCoord / CANONICAL_COORD，无顶层 IO）。

/* eslint-disable */
'use strict'

const { normalizeCoord, CANONICAL_COORD } = require('./scraper_core.js')

// 各来源置信度（0~1）。authoritative=配 key 的腾讯/和风烘焙；hand=手写精校；
// citymap=第三方博查版调研快照；osm=OpenStreetMap 公益数据（WGS-84，已转 GCJ-02）；
// bundled=未配 key 回落的打包坐标。新增平台在此登记即可获得权重。
const SOURCE_CONFIDENCE = {
  authoritative: 0.95,
  hand: 0.9,
  citymap: 0.7,
  osm: 0.6,
  bundled: 0.5
}
const CONFLICT_METERS = 500

function confOf(report) {
  const a = report && report.authSource
  return SOURCE_CONFIDENCE[a] != null ? SOURCE_CONFIDENCE[a] : 0.5
}

function normName(n) {
  return String(n || '').trim().toLowerCase().replace(/\s+/g, '')
}

// 两点球面距离（米），WGS/GCJ 同系即可比较（同坐标系内偏移是真实的地面偏移）
function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const toRad = d => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(a)))
}

// 按归一化名称匹配并加权合并两路 POI。
// base/supp 为 { places, label, conf, report }；base 为更高优先级来源的 POI 集合。
function mergePlaces(base, supp) {
  const places = base.places || []
  const suppPlaces = supp.places || []
  const conflicts = []

  // 以 base 建立名称索引；supp 命中则合并，否则追加
  const index = new Map()
  places.forEach((p, i) => {
    const k = normName(p.name)
    if (!index.has(k)) index.set(k, [])
    index.get(k).push({ p, used: false })
  })

  const out = []
  let matched = 0
  for (const sp of suppPlaces) {
    const k = normName(sp.name)
    const bucket = index.get(k)
    const hit = bucket && bucket.find(e => !e.used)
    if (!hit) {
      // 补充来源独有 POI：直接追加
      out.push(withMeta(sp, [supp.label], supp.conf, false))
      continue
    }
    hit.used = true
    matched++
    const bp = hit.p
    let coordConflict = false
    if (typeof bp.lat === 'number' && typeof sp.lat === 'number') {
      const d = haversineM(bp.lat, bp.lng, sp.lat, sp.lng)
      if (d > CONFLICT_METERS) {
        coordConflict = true
        conflicts.push({
          name: sp.name,
          baseSource: base.label,
          suppSource: supp.label,
          baseCoord: [round6(bp.lat), round6(bp.lng)],
          suppCoord: [round6(sp.lat), round6(sp.lng)],
          distM: d,
          baseConf: base.conf,
          suppConf: supp.conf
        })
      }
    }
    // 取高置信来源的坐标；其余字段优先补充来源（更全的快照），但冲突时坐标用高置信方
    const keeperConf = Math.max(base.conf, supp.conf)
    const keeper = Object.assign({}, sp) // 补充来源字段更丰富（活动/地址），默认以它为基
    // 坐标：高置信方胜出
    if (base.conf >= supp.conf) {
      keeper.lat = bp.lat
      keeper.lng = bp.lng
    }
    out.push(withMeta(keeper, [base.label, supp.label], keeperConf, coordConflict))
  }
  // 追加 base 中未被匹配的 POI（base 独有）
  for (const bucket of index.values()) {
    for (const e of bucket) {
      if (!e.used) out.push(withMeta(e.p, [base.label], base.conf, false))
    }
  }
  return { places: out, conflicts, matched }
}

function withMeta(p, sources, conf, conflict) {
  const o = Object.assign({}, p)
  o._sources = sources
  o._confidence = conf
  o.coordSystem = CANONICAL_COORD
  if (conflict) o._coordConflict = true
  return o
}

// 合并前把整批 POI 按其来源坐标系归一化到规范系 GCJ-02（P2 坐标系适配）。
// 同时记录 originalCoordSystem 便于审计：若来源系本就是 GCJ-02，则不再重复标注。
function normalizePlaces(places, coordSystem) {
  const cs = String(coordSystem || 'gcj-02').toUpperCase().replace('-', '')
  return (places || []).map(p => {
    const base = Object.assign({}, p)
    if (typeof p.lat === 'number' && typeof p.lng === 'number') {
      const [lat, lng] = normalizeCoord(coordSystem, p.lat, p.lng)
      base.lat = lat
      base.lng = lng
    }
    base.coordSystem = CANONICAL_COORD
    if (cs && cs !== 'GCJ02') base.originalCoordSystem = cs
    return base
  })
}

// 取来源坐标系的对外标签（用于报告 coordSystemsUsed）
function coordLabel(cs) {
  const s = String(cs || '').toUpperCase().replace('-', '')
  if (s === 'WGS84') return 'WGS-84'
  if (s === 'GCJ02' || s === '') return 'GCJ-02'
  return cs || 'GCJ-02'
}

function round6(n) { return Math.round(n * 1e6) / 1e6 }

function pickFresh(a, b) {
  if (a && a.fetchedAt) return a
  if (b && b.fetchedAt) return b
  return a || b
}

function recomputeOverview(report, places) {
  const ov = report.overview || {}
  const byCat = c => places.filter(p => p.category === c).length
  if ('scenic5A' in ov) ov.scenic5A = byCat('scenic')
  if ('concertCount' in ov) ov.concertCount = byCat('concert')
  if ('marketCount' in ov) ov.marketCount = byCat('market')
  if ('museumCount' in ov) ov.museumCount = byCat('museum')
  if ('foodStreetCount' in ov) ov.foodStreetCount = byCat('food')
  if ('cityWalkCount' in ov) ov.cityWalkCount = byCat('walk')
  if ('teaShopCount' in ov) ov.teaShopCount = byCat('mall')
  report.overview = ov
  // 同步概览表格的「地点总数」
  if (report.sections) {
    for (const s of report.sections) {
      if (s.type === 'overview' && Array.isArray(s.tableData)) {
        const t = s.tableData.find(r => r.label === '地点总数')
        if (t) t.value = places.length + '个'
      }
    }
  }
  return report
}

// 合并单城：a、b 为 { report, places }。缺失其一则直接返回存在的。
function mergeCity(a, b) {
  if (!a && !b) return null
  if (!a) return b
  if (!b) return a
  const ca = confOf(a.report)
  const cb = confOf(b.report)
  // base = 更高置信来源
  const baseCity = ca >= cb ? a : b
  const suppCity = ca >= cb ? b : a
  // P2：合并前按各自坐标系归一化为规范 GCJ-02，避免跨系误差（如未来接入 WGS-84 源）
  const baseCoord = baseCity.report.coordSystem
  const suppCoord = suppCity.report.coordSystem
  const baseMeta = {
    places: normalizePlaces(baseCity.places, baseCoord),
    label: baseCity.report.authSource,
    conf: Math.max(ca, cb)
  }
  const suppMeta = {
    places: normalizePlaces(suppCity.places, suppCoord),
    label: suppCity.report.authSource,
    conf: Math.min(ca, cb)
  }

  const { places, conflicts, matched } = mergePlaces(baseMeta, suppMeta)

  // report 基：高置信来源；叠加更新鲜的时效字段
  const mergedReport = JSON.parse(JSON.stringify(baseCity.report))
  const fresh = pickFresh(a.report, b.report)
  mergedReport.fetchedAt = fresh.fetchedAt || mergedReport.fetchedAt
  mergedReport.sourceWindow = fresh.sourceWindow || mergedReport.sourceWindow
  mergedReport.isExpired = !!(a.report && a.report.isExpired) || !!(b.report && b.report.isExpired)
  // P2：落库坐标系统一为规范 GCJ-02，并记录来源系用于审计
  mergedReport.coordSystem = CANONICAL_COORD
  mergedReport.coordSystemsUsed = [coordLabel(baseCoord), coordLabel(suppCoord)]
  mergedReport.platform = fresh.platform || mergedReport.platform
  mergedReport.authSource = 'merged'
  mergedReport.mergedSources = [a.report.authSource, b.report.authSource].filter(Boolean)
  mergedReport.mergedConfidence = Math.max(ca, cb)
  mergedReport.mergedAt = new Date().toISOString()
  mergedReport.mergeMeta = {
    sources: mergedReport.mergedSources,
    confidence: mergedReport.mergedConfidence,
    coordSystemsUsed: mergedReport.coordSystemsUsed,
    placesMerged: matched,
    conflicts: conflicts
  }
  recomputeOverview(mergedReport, places)

  return { report: mergedReport, places }
}

// 合并全量：real(权威/打包) + citymap(第三方)。返回 { out, conflicts, stats }
function mergeAll(real, citymap) {
  const out = {}
  const conflicts = []
  const stats = { merged: 0, citymapOnly: 0, realOnly: 0, conflictCities: 0 }
  const codes = new Set([...Object.keys(real || {}), ...Object.keys(citymap || {})])
  for (const code of codes) {
    const r = real && real[code]
    const c = citymap && citymap[code]
    if (r && c) {
      const m = mergeCity(r, c)
      out[code] = m
      stats.merged++
      if (m.report.mergeMeta.conflicts.length) {
        conflicts.push({ city: code, items: m.report.mergeMeta.conflicts })
        stats.conflictCities++
      }
    } else if (c) {
      out[code] = c
      stats.citymapOnly++
    } else if (r) {
      out[code] = r
      stats.realOnly++
    }
  }
  return { out, conflicts, stats }
}

module.exports = {
  SOURCE_CONFIDENCE,
  CONFLICT_METERS,
  confOf,
  normName,
  haversineM,
  mergePlaces,
  mergeCity,
  mergeAll,
  recomputeOverview
}
