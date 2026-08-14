// utils/platform_osm.js
// 未来平台接入骨架（P2「不同平台抓取处理」）。
//
// 示例：OpenStreetMap Overpass API —— 它返回的是 **WGS-84** 坐标（与高德/腾讯/微信的
// GCJ-02 不同系）。只要本适配器声明 coordSystem='WGS-84'，合并层（merge_citydata）
// 会自动经 scraper_core.normalizeCoord 把坐标转成规范 GCJ-02，地图标点就不会偏到海上。
//
// 这是「新增数据源」的标准模板：
//   1) 用 createAdapter 声明 name + coordSystem + 超时/重试；
//   2) 抓取后把原始 POI 的 {name,lat,lng,category,...} 规整成本项目统一形状；
//   3) report 必须带 authSource='osm'、coordSystem、fetchedAt、platform 等时效字段；
//   4) 默认受 ENABLE_OSM 开关保护 —— CI 默认不跑，避免外部限流影响每日烘焙。
//
// 用法：在 gen_*_report.js 中 require 本模块，按 cityCode 调用 scrapeOsmCity；
// 或在 build 阶段把它的输出并入 mergeAll 的 real/citymap 一侧（需保证 authSource 在
// SOURCE_CONFIDENCE 中已登记，否则按 0.5 兜底）。
//
// 注意：OSM Overpass 为公益服务，批量抓取请控制并发与频率，遵守其使用规范。

/* eslint-disable */
'use strict'

const { createAdapter, normalizeCoord, CANONICAL_COORD } = require('./scraper_core.js')

// OSM 与本项目城市 code 的对应关系（area 用城市名中文/拼音均可，Overpass 按名称匹配）。
// 新增城市时在此登记即可。
const OSM_CITY_AREAS = {
  beijing: '北京',
  shanghai: '上海',
  guangzhou: '广州',
  shenzhen: '深圳',
  chengdu: '成都',
  hangzhou: '杭州',
  // ... 其余城市按需补充
}

// POI 类型映射（OSM key=amenity/tourism/... -> 本项目 category）
const OSM_CAT_MAP = {
  tourism: 'scenic',
  museum: 'museum',
  gallery: 'museum',
  restaurant: 'food',
  cafe: 'food',
  fast_food: 'food',
  park: 'walk',
  market: 'market',
  theatre: 'concert',
  arts_centre: 'concert'
}

// Overpass 适配器：声明 WGS-84，带重试/超时（与 citymap/腾讯一致）。
const osmAdapter = createAdapter({
  name: 'openstreetmap',
  coordSystem: 'WGS-84',
  timeoutMs: 20000,
  retries: 3
})

// 构造 Overpass QL：取某 bbox/区域下的主要 POI 节点。
function buildOverpassQuery(areaName) {
  // 简化示例：取该名称区域内的 tourism/museum/restaurant 节点（上限 200 以免超限）
  return `[out:json][timeout:25];
area["name"="${areaName}"]->.a;
(
  node["tourism"](area.a);
  node["amenity"~"restaurant|cafe|fast_food|market|theatre|arts_centre"](area.a);
  node["amenity"="museum"](area.a);
);
out body 200;`
}

// 把 OSM 节点规整为本项目 POI 形状（lat/lng 保持 WGS-84，交给合并层归一化）。
function osmNodeToPoi(node) {
  const t = node.tags || {}
  const kv = Object.keys(t).find(k => k === 'tourism' || k === 'amenity')
  const rawCat = kv ? t[kv] : ''
  const category = OSM_CAT_MAP[rawCat] || 'scenic'
  return {
    name: t.name || t['name:zh'] || '未命名地点',
    lat: Number(node.lat),
    lng: Number(node.lon),
    category,
    address: t['addr:full'] || t['addr:street'] || '',
    note: '',
    sourceDate: ''
  }
}

// 抓取单城 OSM 数据，返回 { report, places }（report 形状与 citymap/权威源一致）。
// 返回 null 表示该城市未配置 area 或抓取失败（调用方应容忍 null，不中断整轮）。
async function scrapeOsmCity(cityCode, areaNameOverride) {
  const areaName = areaNameOverride || OSM_CITY_AREAS[cityCode]
  if (!areaName) {
    console.log('  · OSM 跳过（未登记 area）:', cityCode)
    return null
  }
  const q = buildOverpassQuery(areaName)
  const url = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(q)
  const data = await osmAdapter.fetch(url)
  if (!data || !data.elements) {
    console.log('  ✗ OSM 抓取失败:', cityCode)
    return null
  }
  const places = data.elements
    .filter(e => typeof e.lat === 'number' && typeof e.lon === 'number')
    .map(osmNodeToPoi)
  console.log('  ✓ OSM', cityCode, 'places=' + places.length)
  const report = {
    cityCode,
    cityName: areaName,
    bakedAt: new Date().toISOString(),
    fetchedAt: new Date().toISOString(),
    authSource: 'osm',
    coordSystem: 'WGS-84', // 关键：声明原始系，合并层会自动转 GCJ-02
    platform: 'openstreetmap',
    sourceDate: '',
    isExpired: false,
    overview: {},
    sections: [],
    qualityCheck: { note: 'OpenStreetMap 公益数据（WGS-84 已自动转 GCJ-02）' },
    sources: ['OpenStreetMap Overpass API']
  }
  return { report, places }
}

// 批量抓取（受 ENABLE_OSM 开关保护）：返回 { code: {report,places} } 或 {}。
async function scrapeOsmAll(codes) {
  if (process.env.ENABLE_OSM !== '1') {
    console.log('[osm] ENABLE_OSM 未开启，跳过（骨架就绪，需要时置 ENABLE_OSM=1）')
    return {}
  }
  const out = {}
  const list = codes || Object.keys(OSM_CITY_AREAS)
  for (const code of list) {
    try {
      const r = await scrapeOsmCity(code)
      if (r) out[code] = r
    } catch (e) {
      console.log('  ✗ OSM 异常跳过:', code, e.message)
    }
  }
  return out
}

module.exports = {
  osmAdapter,
  buildOverpassQuery,
  osmNodeToPoi,
  scrapeOsmCity,
  scrapeOsmAll,
  OSM_CITY_AREAS,
  CANONICAL_COORD
}
