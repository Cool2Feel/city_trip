// 烘焙数据校验闸门：被 .github/workflows/bake.yml 调用。
// 发现无效数据（坐标越界 / 缺字段 / authSource 非法）则 exit(1)，
// 使工作流步骤失败 —— 不提交、不发布脏数据，保留上一版可用数据。
const path = require('path')

const errors = []
const warns = []
let fail = 0

function load(file) {
  try {
    return require(path.join(__dirname, file))
  } catch (e) {
    errors.push(`加载失败 ${file}: ${e.message}`)
    fail++
    return null
  }
}

function checkCity(code, data) {
  if (!data || !data.report || !Array.isArray(data.places)) {
    errors.push(`${code}: 缺 report 或 places`)
    fail++
    return
  }
  const { report, places } = data

  // authSource 必须是已知来源
  const okAuth = ['bundled', 'authoritative', 'citymap'].includes(report.authSource)
  if (!okAuth) {
    errors.push(`${code}: authSource 非法=${report.authSource}`)
    fail++
  }

  // 坐标检查：跳过多媒体/非地点节点（mappable:false），其余必须有合法 GCJ-02 坐标
  let missing = 0
  for (const p of places) {
    if (p.mappable === false) continue
    if (!p.name) {
      errors.push(`${code}: POI 缺 name`)
      fail++
    }
    const lat = Number(p.lat)
    const lng = Number(p.lng)
    if (!isFinite(lat) || !isFinite(lng)) {
      missing++
      continue
    }
    // 中国境内坐标范围
    if (lat < 18 || lat > 53.6 || lng < 73 || lng > 135) {
      errors.push(`${code}: 坐标越界 ${p.name || '?'} (${lat}, ${lng})`)
      fail++
    }
  }
  if (missing > 0) {
    errors.push(`${code}: ${missing} 个 POI 缺坐标（非 mappable:false）`)
    fail++
  }

  // routes 段：存在则校验结构，缺失仅告警（地图折线功能降级，但不算脏数据）
  const rs = (report.sections || []).find((s) => s.type === 'routes')
  if (rs) {
    if (!Array.isArray(rs.routes) || rs.routes.length === 0) warns.push(`${code}: routes 段为空`)
  } else {
    warns.push(`${code}: 无 routes 段（地图折线将不可用）`)
  }
}

const a = load('realCityData_citymap_pilot.js')
const b = load('realCityData.js')
let cities = 0
if (a && a.REAL_REPORTS_CITYMAP) {
  for (const [c, d] of Object.entries(a.REAL_REPORTS_CITYMAP)) {
    checkCity(c, d)
    cities++
  }
}
if (b && b.REAL_REPORTS) {
  for (const [c, d] of Object.entries(b.REAL_REPORTS)) {
    checkCity(c, d)
    cities++
  }
}

if (warns.length) {
  console.warn(`\n[validate_bake] 警告 ${warns.length} 条:`)
  warns.slice(0, 20).forEach((w) => console.warn('  ! ' + w))
}

if (fail > 0) {
  console.error(`\n[validate_bake] ✗ 失败: ${fail} 个问题，已阻止发布`)
  errors.slice(0, 40).forEach((e) => console.error('  - ' + e))
  process.exit(1)
}
console.log(`\n[validate_bake] ✓ 通过 (${cities} 城)`)
