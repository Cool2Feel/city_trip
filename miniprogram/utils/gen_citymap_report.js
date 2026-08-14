// utils/gen_citymap_report.js
// 从第三方静态站 citymap.348349.xyz 的地图页抓取 TRIP_DATA（高德 GCJ-02 坐标），
// 映射成与 realCityData.js 完全一致的 schema（report.sections + places），烤进包。
//
// 设计要点（与 C 方案一致：构建期烘焙，运行时零后端零 key）：
//  - 坐标系已是 GCJ-02（高德），与微信 <map> 组件一致，无需转换。
//  - 数据带 date_range（快照日期），烤进 report.sourceDate 并展示，避免展示过期活动误导。
//  - authSource 设为 'citymap'，区别于 bundled/authoritative；report.wxml 芯片单独标「博查版参考」。
//  - 全量城市：先抓首页拿到各城地图页链接，按小程序已知城市名做前缀匹配，映射到城市 code；
//    仅覆盖小程序已知的城市（19 城），其余保持 bundled。单城抓取失败仅告警、不中断整轮。
//
// 运行：node utils/gen_citymap_report.js  ->  生成 utils/realCityData_citymap_pilot.js

/* eslint-disable */
const fs = require('fs')
const path = require('path')
const { fetchWithRetry, limiter, parseSourceWindow, computeIsExpired, createAdapter } = require('./scraper_core.js')

const BASE = 'https://citymap.348349.xyz/'

// 小程序已知城市：中文名 -> code（仅这些会被 citymap 数据覆盖，其余保持 bundled）
const CITY_CODES = {
  '北京': 'beijing', '上海': 'shanghai', '广州': 'guangzhou', '深圳': 'shenzhen',
  '成都': 'chengdu', '重庆': 'chongqing', '杭州': 'hangzhou', '西安': 'xian',
  '南京': 'nanjing', '厦门': 'xiamen', '长沙': 'changsha', '武汉': 'wuhan',
  '天津': 'tianjin', '苏州': 'suzhou', '青岛': 'qingdao', '昆明': 'kunming',
  '大连': 'dalian', '桂林': 'guilin', '郑州': 'zhengzhou'
}
// 兜底：即使首页抓取失败，也尝试这两个已知文件名（日期可能过期，但优于退化为空）
const FALLBACK_FILES = [
  { code: 'shanghai', name: '上海', file: '上海7月4-5日地图_博查版.html' },
  { code: 'beijing', name: '北京', file: '北京中秋地图_博查版.html' }
]

// TRIP_DATA.type 编码 -> 小程序 category
// 5=5A景区 U=博物馆 M=集市 S=球赛 C=演唱会 F=美食街 H=喜茶 W=路线节点 D=地铁 L=购物中心 其余=景点
function typeToCategory(t) {
  switch (t) {
    case '5': return 'scenic'
    case 'U': return 'museum'
    case 'M': return 'market'
    case 'S': return 'sport'
    case 'C': return 'concert'
    case 'F': return 'food'
    case 'H': return 'mall'
    case 'W': return 'walk'
    case 'D': return 'metro'
    case 'L': return 'mall'
    default: return 'scenic'
  }
}

function activityGroupFor(p) {
  if (p.type === 'C') return 'concert'
  if (p.type === 'M') return 'market'
  if (p.type === 'S') return 'sport'
  if (p.type === 'U') return 'museum'
  if (p.type === '5') return 'scenic'
  return null
}
const GROUP_NAME = { concert: '演唱会/演出', market: '集市/夜市', sport: '球赛', museum: '博物馆/展览', scenic: '5A景区' }

const fetchLimit = limiter(3)

// 平台适配器：citymap 为静态 HTML（GCJ-02 坐标），统一超时/重试/失败隔离
const citymapAdapter = createAdapter({ name: 'citymap', coordSystem: 'gcj-02', timeoutMs: 20000, retries: 3 })

function parseTrip(html) {
  const start = html.indexOf('TRIP_DATA = {')
  if (start < 0) return null
  let i = start + 'TRIP_DATA = '.length
  let depth = 0, inStr = false, esc = false, end = -1
  for (; i < html.length; i++) {
    const c = html[i]
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue }
    if (c === '"') inStr = true
    else if (c === '{') depth++
    else if (c === '}') { depth--; if (depth === 0) { end = i + 1; break } }
  }
  try { return eval('(' + html.slice(start + 'TRIP_DATA = '.length, end) + ')') } catch (e) { return null }
}

function parseRouteSection(section) {
  const m = (section || '').match(/路线\s*([A-C])\s*[:：]\s*([^(（]+)/)
  if (m) return { id: m[1], name: m[2].trim() }
  return null
}

// 从首页抓取所有「地图_博查版.html」链接
async function fetchIndexLinks() {
  const html = await fetchWithRetry(BASE)
  if (!html) return []
  const out = []
  const re = /href="([^"]*地图_博查版\.html)"/g
  let m
  while ((m = re.exec(html))) out.push(m[1])
  return out
}

// 由文件名推断城市中文名（取「_博查版」前、开头的连续中文）
function cityFromFilename(href) {
  let f = decodeURIComponent(href.split('/').pop())
  f = f.replace(/\.html$/, '')
  const base = f.split('_博查版')[0]
  const leading = (base.match(/^[一-鿿]+/) || [''])[0]
  return leading
}

function matchCity(leading) {
  const names = Object.keys(CITY_CODES).sort((a, b) => b.length - a.length)
  for (const n of names) if (leading.startsWith(n)) return CITY_CODES[n]
  return null
}

function resolveUrl(href) {
  if (/^https?:\/\//.test(href)) return href
  return BASE + href
}

function buildCity(data, meta) {
  const win = parseSourceWindow(data.date_range)
  const isExpired = computeIsExpired(win)
  const expiredCats = ['concert', 'market', 'sport']
  const places = (data.places || [])
    .filter(p => p.lat && p.lng && p.name)
    .map((p, i) => {
      const category = typeToCategory(p.type)
      return {
        id: meta.code + '-cm-' + i,
        name: p.name,
        lat: p.lat,
        lng: p.lng,
        category: category,
        price: '',
        rating: null,
        address: p.address || '',
        note: p.note || '',
        desc: p.note || '',
        sourceDate: data.date_range || '',
        coordSystem: 'gcj-02',
        // 时效敏感类目在活动窗口结束后标记为过期（runtime 降级隐藏）
        expired: expiredCats.includes(category) && isExpired
      }
    })

  const groups = {}
  for (const p of (data.places || [])) {
    const g = activityGroupFor(p)
    if (!g) continue
    if (!groups[g]) groups[g] = []
    groups[g].push({ name: p.name, time: '', venue: p.address || '', price: '', source: '博查版调研' })
  }
  const groupList = ['concert', 'market', 'sport', 'museum', 'scenic']
    .filter(g => groups[g] && groups[g].length)
    .map(g => ({ category: g, name: GROUP_NAME[g], items: groups[g] }))

  const foodStreets = (data.places || []).filter(p => p.type === 'F')
    .map(p => ({ name: p.name, address: p.address || '', feature: p.note || '', metro: '地铁直达', rating: null, source: '博查版调研' }))
  const teaItems = (data.places || []).filter(p => p.type === 'H')
    .map(p => ({ name: p.name, address: p.address || '', feature: '喜茶/品牌门店', metro: '地铁直达', source: '博查版调研' }))
  const metroStations = (data.places || []).filter(p => p.type === 'D')
    .map(p => ({ name: p.name, line: p.section || '', exit: '', desc: p.note || '' }))

  const routeMap = {}
  for (const p of (data.places || [])) {
    if (p.type !== 'W') continue
    const r = parseRouteSection(p.section)
    if (!r) continue
    if (!routeMap[r.id]) routeMap[r.id] = { id: r.id, name: r.name, icon: '🗺', color: '#1565c0', coverImage: '', desc: '', timeline: [] }
    routeMap[r.id].timeline.push({ time: '', activity: p.name, location: meta.name, note: p.note || '' })
  }
  const routes = Object.values(routeMap)

  const byCat = c => places.filter(p => p.category === c)
  const overview = {
    weather: '',
    tempRange: '',
    weekend: (data.date_range || '参考时段'),
    metroLines: '',
    scenic5A: byCat('scenic').length,
    concertCount: (groups.concert || []).length,
    marketCount: (groups.market || []).length,
    museumCount: (groups.museum || []).length,
    foodStreetCount: foodStreets.length,
    cityWalkCount: routes.length,
    teaShopCount: teaItems.length,
    highlights: [
      ...(groupList[0] ? [groupList[0].items[0] && groupList[0].items[0].name] : []),
      ...(routes[0] ? [routes[0].name] : []),
      ...(foodStreets[0] ? [foodStreets[0].name] : [])
    ].filter(Boolean).slice(0, 4)
  }

  const sections = [
    {
      index: 0, title: '一图速览', type: 'overview', icon: '📈',
      content: meta.name + '周末核心情报（博查版调研快照）',
      summary: meta.name + '（' + (data.date_range || '参考时段') + '）共 ' + places.length + ' 个地点：' +
        overview.concertCount + '场演出+' + overview.marketCount + '个市集+' + overview.museumCount + '个博物馆+' + foodStreets.length + '条美食街+' + routes.length + '条路线。',
      tableData: [
        { label: '数据快照', value: data.date_range || '参考时段' },
        { label: '地点总数', value: places.length + '个' },
        { label: '演出活动', value: overview.concertCount + '场' },
        { label: '创意市集', value: overview.marketCount + '个' },
        { label: '博物馆展览', value: overview.museumCount + '个' },
        { label: '美食街', value: foodStreets.length + '条' },
        { label: '推荐路线', value: routes.length + '条' },
        { label: '喜茶门店', value: teaItems.length + '家' }
      ]
    },
    {
      index: 1, title: '活动全清单', type: 'activities', icon: '🎯',
      content: '演唱会/集市/球赛/博物馆/5A景区全汇总',
      groups: groupList.length ? groupList : [{ category: 'scenic', name: '5A景区', items: [] }]
    },
    {
      index: 4, title: '美食街', type: 'food', icon: '🍜',
      content: '本地人真正会去的美食街',
      items: foodStreets
    },
    {
      index: 3, title: '喜茶门店热点', type: 'tea', icon: '🍵',
      content: '品牌文化打卡',
      items: teaItems
    },
    {
      index: 5, title: 'City Walk路线', type: 'walk', icon: '🚶',
      content: '经典步行路线（来自调研路线分组）',
      items: routes.map(r => ({ name: r.name, duration: '', distance: '', highlights: r.timeline.map(t => t.activity).join('→'), photoSpots: [], metro: '地铁直达', source: '博查版调研' }))
    },
    {
      index: 6, title: '地铁路线', type: 'metro', icon: '🚇',
      content: '关键站点',
      metroLines: '',
      keyStations: metroStations,
      scenicDirect: []
    },
    {
      index: 7, title: '周末组合路线', type: 'routes', icon: '🗺',
      content: '调研整理的主题路线，带时间表（时间以现场为准）',
      routes: routes
    },
    {
      index: 8, title: '时效可靠性说明', type: 'reliability', icon: '⚠️',
      content: '出行前请二次确认',
      notes: [
        '本数据来自第三方「博查版城市调研」静态快照（' + (data.date_range || '参考时段') + '），活动/票价/开放请以官方渠道为准。',
        '演出与赛事时效性最强，出行前请在大麦网/秀动/官方公众号复核是否仍在进行。',
        '坐标用于路线预览（GCJ-02，与地图一致），步行/驾车距离以地图导航为准。',
        '本页为参考性质，非官方发布。'
      ]
    },
    {
      index: 9, title: '数据来源说明', type: 'stats', icon: '📊',
      content: '透明展示数据来源',
      totalCalls: 0,
      batches: [{ batch: 1, count: 1, queries: ['citymap.348349.xyz 地图页 TRIP_DATA'], duration: '构建期烘焙', results: places.length }],
      totalResults: places.length,
      reportSize: '由抓取数据生成'
    }
  ]

  const report = {
    cityCode: meta.code,
    cityName: meta.name,
    generatedAt: (data.date_range || ''),
    totalCalls: 1,
    reportSize: '抓取烘焙',
    aiGenerated: false,
    bakedAt: new Date().toISOString(),
    authSource: 'citymap',
    sourceDate: data.date_range || '',
    fetchedAt: meta.fetchedAt,
    coordSystem: 'gcj-02',
    platform: 'citymap',
    sourceWindow: win,
    isExpired: isExpired,
    overview: overview,
    sections: sections,
    qualityCheck: { overallScore: 0, dimensions: [] },
    sources: [{ name: '博查版城市调研', type: '第三方静态站', count: places.length }],
    workflow: []
  }
  return { report, places }
}

async function main() {
  const fetchedAt = new Date().toISOString()
  const byCode = {}
  const indexLinks = await fetchIndexLinks()
  console.log('[index] 首页地图页链接:', indexLinks.length)
  for (const href of indexLinks) {
    const code = matchCity(cityFromFilename(href))
    if (code && !byCode[code]) byCode[code] = resolveUrl(href)
  }
  // 兜底：确保已知的两城即使首页解析失败也在
  for (const f of FALLBACK_FILES) {
    if (!byCode[f.code]) byCode[f.code] = resolveUrl(BASE + encodeURIComponent(f.file))
  }
  const discovered = Object.keys(byCode)
  const missing = Object.values(CITY_CODES).filter(c => !discovered.includes(c))
  if (missing.length) console.log('[index] 未在 citymap 找到匹配的城市(保持 bundled):', missing.join(', '))

  const entries = await Promise.all(discovered.map(code => fetchLimit(async () => {
    const url = byCode[code]
    const name = Object.keys(CITY_CODES).find(n => CITY_CODES[n] === code)
    console.log('[fetch]', name, url)
    const html = await citymapAdapter.fetch(url)
    if (!html) { console.log('  ✗ 抓取失败:', name); return [code, null] }
    const data = parseTrip(html)
    if (!data) { console.log('  ✗ 解析失败(无 TRIP_DATA):', name); return [code, null] }
    const built = buildCity(data, { code, name, fetchedAt })
    const rs = built.report.sections.find(s => s.type === 'routes')
    console.log('  ✓', name, 'places=', built.places.length, 'routes=', rs ? rs.routes.length : 0, 'date=', data.date_range)
    return [code, built]
  })))

  const out = {}
  entries.forEach(([code, v]) => { if (v) out[code] = v })
  const content = '// 全量烘焙数据（citymap.348349.xyz 抓取），与 realCityData.js schema 完全一致。\n' +
    '// authSource=citymap；坐标 GCJ-02（高德），与微信 map 一致。数据带快照日期，仅供参考。\n' +
    'const REAL_REPORTS_CITYMAP = ' + JSON.stringify(out, null, 2) + ';\n\nmodule.exports = { REAL_REPORTS_CITYMAP };\n'
  const target = path.join(__dirname, 'realCityData_citymap_pilot.js')
  fs.writeFileSync(target, content, 'utf8')
  console.log('[gen_citymap_report] 已生成', Object.keys(out).length, '座城市(citymap) ->', target)
}

main().catch(e => { console.error('[gen_citymap_report] 失败:', e); process.exit(1) })
