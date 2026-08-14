// utils/validate_bake.js
// 数据有效性闸门：对最终对外发布的合并产物（bake-dist/cityData.json）逐城校验。
// 坐标越界 / 缺字段 / authSource 非法 -> exit(1) 阻断发布，保留上一版可用数据。
// 本地无 bake-dist 时退化为校验源文件（realCityData.js + realCityData_citymap_pilot.js）。
// 注意：本脚本在「合并之后、发布之前」运行。
const fs = require('fs')
const path = require('path')

function loadMerged() {
  const p = path.join(__dirname, '..', '..', 'bake-dist', 'cityData.json')
  if (fs.existsSync(p)) return { src: 'bake-dist/cityData.json', data: JSON.parse(fs.readFileSync(p, 'utf8')) }
  const a = require('./realCityData_citymap_pilot.js').REAL_REPORTS_CITYMAP
  const b = require('./realCityData.js').REAL_REPORTS
  return { src: '源文件(退化模式)', data: Object.assign({}, b, a) }
}

const { src, data } = loadMerged()
const ALLOWED = ['bundled', 'authoritative', 'citymap', 'merged', 'osm']
const LAT_MIN = 18, LAT_MAX = 53.6, LNG_MIN = 73, LNG_MAX = 135
// P2 时效 SLA：抓取时间距现在超过该天数即告警（数据可能已陈旧）。可用环境变量覆盖。
const MAX_STALE_DAYS = Number(process.env.MAX_STALE_DAYS || 7)
const nowMs = Date.now()
const DAY = 86400000
let errors = 0, warns = 0
const cities = Object.keys(data)
for (const code of cities) {
  const { report, places } = data[code]
  const tag = '[' + code + ']'
  if (!report) { console.error(tag + ' 缺失 report'); errors++; continue }
  if (!ALLOWED.includes(report.authSource)) { console.error(tag + ' authSource 非法: ' + report.authSource); errors++ }
  // P2 坐标系 SLA：落库坐标必须已归一化为规范系 GCJ-02（大小写不敏感）
  const repCs = String(report.coordSystem || '').toUpperCase().replace('-', '')
  if (repCs !== 'GCJ02' && repCs !== '') {
    console.error(tag + ' 坐标系非法(必须为 GCJ-02，实际 ' + report.coordSystem + ')'); errors++
  }
  if (!places || !places.length) { console.error(tag + ' places 为空'); errors++; continue }
  let miss = 0, conflictCnt = 0, badCs = 0
  for (const p of places) {
    if (p._coordConflict) conflictCnt++
    // P2 坐标系 SLA：每个 POI 也必须是 GCJ-02
    const pcs = String(p.coordSystem || '').toUpperCase().replace('-', '')
    if (pcs && pcs !== 'GCJ02') { console.error(tag + ' POI 坐标系未归一化: ' + p.name + ' (' + p.coordSystem + ')'); errors++; badCs++ }
    if (!p.name) { console.error(tag + ' POI 缺 name'); errors++ }
    const lat = Number(p.lat), lng = Number(p.lng)
    if (!p.lat || !p.lng || isNaN(lat) || isNaN(lng)) { miss++; errors++ }
    else if (lat < LAT_MIN || lat > LAT_MAX || lng < LNG_MIN || lng > LNG_MAX) {
      console.error(tag + ' 坐标越界: ' + p.name + ' (' + lat + ',' + lng + ')'); errors++
    }
    if (!p.category) { console.error(tag + ' POI 缺 category: ' + p.name); errors++ }
  }
  if (miss) console.error(tag + ' ' + miss + ' 个 POI 缺坐标')
  if (badCs) console.error(tag + ' ' + badCs + ' 个 POI 坐标系未归一化')
  if (conflictCnt) console.warn(tag + ' ⚠ ' + conflictCnt + ' 个 POI 存在坐标冲突(已取高置信来源)，建议人工复核'); warns++
  // P2 时效 SLA：抓取时间陈旧告警
  const f = report.fetchedAt || report.bakedAt
  if (f) {
    const age = (nowMs - new Date(f).getTime()) / DAY
    if (age > MAX_STALE_DAYS) { console.warn(tag + ' ⚠ 时效 SLA 告警：数据集已 ' + age.toFixed(1) + ' 天未刷新（> ' + MAX_STALE_DAYS + ' 天），runtime 可能展示陈旧数据'); warns++ }
  } else {
    console.warn(tag + ' ⚠ 缺失 fetchedAt/bakedAt，无法判断时效'); warns++
  }
  const rs = (report.sections || []).find(s => s.type === 'routes')
  if (!rs || !rs.routes || !rs.routes.length) { console.warn(tag + ' ⚠ 无路线(warn)'); warns++ }
  if (report.isExpired) { console.warn(tag + ' ⚠ 数据已过期(活动窗口已结束)，runtime 将降级展示'); warns++ }
}
console.log('[validate] 校验对象=' + src + ' cities=' + cities.length + ' errors=' + errors + ' warns=' + warns)
if (errors > 0) { console.error('[validate] 校验失败，阻断发布'); process.exit(1) }
console.log('[validate] 校验通过 ✅')
