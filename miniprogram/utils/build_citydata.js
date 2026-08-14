// utils/build_citydata.js
// 合并 REAL_REPORTS(bundled/authoritative) + REAL_REPORTS_CITYMAP(citymap 真实坐标) 为运行时可拉取的
// bake-dist/cityData.json；并计算「归一化 hash」，判断相较上次是否有实质变化 ——
// 无变化则 GitHub Actions 跳过 commit + Pages 部署，减少噪声与配额消耗。
//
// P1：用置信度加权合并（merge_citydata）替换原先 Object.assign 的整城盲覆盖：
//   - POI 级同名匹配取高置信坐标，互补 POI 直接追加，避免 citymap 无脑覆盖权威坐标。
//   - 坐标差 > 500m 标记 coordConflict，汇总进 .merge_conflicts.json 供 CI 告警人工复核。
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { execSync } = require('child_process')
const { mergeAll } = require('./merge_citydata.js')

function loadCitymap() { try { return require('./realCityData_citymap_pilot.js').REAL_REPORTS_CITYMAP } catch (e) { return {} } }
function loadReal() { try { return require('./realCityData.js').REAL_REPORTS } catch (e) { return {} } }

const citymap = loadCitymap()
const real = loadReal()

// P1：置信度加权合并（不再 Object.assign 盲覆盖）
const { out, conflicts, stats } = mergeAll(real, citymap)

const root = path.join(__dirname, '..', '..')
const distDir = path.join(root, 'bake-dist')
fs.mkdirSync(distDir, { recursive: true })
fs.writeFileSync(path.join(distDir, 'cityData.json'), JSON.stringify(out))

// 坐标冲突汇总（供 CI 步骤开 Issue / Summary 标注；不阻塞发布）
fs.writeFileSync(path.join(distDir, '.merge_conflicts.json'), JSON.stringify(conflicts, null, 2))

// 归一化：保留 bakedAt / fetchedAt / sourceWindow / isExpired。
// 每日成功抓取后这些时效字段会变化，使哈希变化 → 触发重新部署，
// runtime 每次拉取都能拿到「上次成功抓取」的真实新鲜度，消除「伪实时」。
function normalize(o) { return JSON.stringify(o) }
const hash = crypto.createHash('sha256').update(normalize(out)).digest('hex').slice(0, 16)

// 读取上次提交的 hash（首次运行无 HEAD 记录，prev='' -> changed=true）
let prev = ''
try { prev = execSync('git show HEAD:bake-dist/.datahash', { cwd: root }).toString().trim() } catch (e) { prev = '' }
const changed = prev !== hash
fs.writeFileSync(path.join(distDir, '.datahash'), hash)

// 统计摘要
const auth = {}
let places = 0, routes = 0, expired = 0
let oldest = null
for (const code of Object.keys(out)) {
  const rep = out[code].report || {}
  auth[rep.authSource] = (auth[rep.authSource] || 0) + 1
  places += (out[code].places || []).length
  if (rep.isExpired) expired++
  const f = rep.fetchedAt || rep.bakedAt
  if (f && (!oldest || f < oldest)) oldest = f
  const rs = (rep.sections || []).find(s => s.type === 'routes')
  routes += rs ? rs.routes.length : 0
}
console.log('[build] cities=' + Object.keys(out).length +
  ' places=' + places + ' routes=' + routes +
  ' authSource=' + JSON.stringify(auth) +
  ' merged=' + stats.merged + ' citymapOnly=' + stats.citymapOnly + ' realOnly=' + stats.realOnly +
  ' coordConflicts=' + conflicts.length + ' conflictCities=' + stats.conflictCities +
  ' expired=' + expired + ' oldestFetch=' + (oldest || '?') +
  ' hash=' + hash + ' changed=' + (changed ? 'YES' : 'no'))
console.log('CHANGED=' + (changed ? 1 : 0))
