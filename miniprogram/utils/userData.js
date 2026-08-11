// utils/userData.js
// 个人数据本地存储层：地点标记（想去/已去/备注）、足迹统计、出行清单
// 全部基于 wx.getStorageSync/setStorageSync，无后端依赖，与现有 favoriteCities/savedReports 体系一致。

const MARKS_KEY = 'wbt_user_marks'   // 结构: { [cityCode]: { [placeKey]: { status, note, updated } } }
const PACKING_KEY = 'wbt_packing'    // 结构: { version, items: [{id, text, checked, custom}], updated }

/**
 * 安全读取存储
 */
function _read(key, def) {
  try {
    const v = wx.getStorageSync(key)
    return (v === '' || v === undefined || v === null) ? def : v
  } catch (e) {
    return def
  }
}

/**
 * 安全写入存储
 */
function _write(key, val) {
  try {
    wx.setStorageSync(key, val)
  } catch (e) {
    console.warn('[userData] write failed:', e.message)
  }
}

/* ============ 地点标记（想去 / 已去 / 备注）============ */

function getAllMarks() {
  return _read(MARKS_KEY, {})
}

function getCityMarks(cityCode) {
  const all = getAllMarks()
  return all[cityCode] || {}
}

function getMark(cityCode, key) {
  const city = getCityMarks(cityCode)
  return city[key] || null
}

// 状态循环：无 -> 想去 -> 已去 -> 无
function cycleMark(cityCode, key) {
  const all = getAllMarks()
  const city = all[cityCode] || {}
  const cur = city[key] || { updated: Date.now() }
  let next = null
  if (!cur.status) next = 'want'
  else if (cur.status === 'want') next = 'done'
  else next = null

  if (next) {
    city[key] = { status: next, note: cur.note || '', updated: Date.now() }
  } else {
    delete city[key]
  }
  if (Object.keys(city).length === 0) delete all[cityCode]
  else all[cityCode] = city
  _write(MARKS_KEY, all)
  return city[key] || null
}

// 直接设置状态
function setMarkStatus(cityCode, key, status) {
  const all = getAllMarks()
  const city = all[cityCode] || {}
  if (status === null || status === undefined || status === '') {
    delete city[key]
  } else {
    const cur = city[key] || {}
    city[key] = { status, note: cur.note || '', updated: Date.now() }
  }
  if (Object.keys(city).length === 0) delete all[cityCode]
  else all[cityCode] = city
  _write(MARKS_KEY, all)
  return city[key] || null
}

// 设置备注
function setMarkNote(cityCode, key, note) {
  const all = getAllMarks()
  const city = all[cityCode] || {}
  const cur = city[key] || { status: null, updated: Date.now() }
  cur.note = note || ''
  cur.updated = Date.now()
  if (!cur.status && !cur.note) {
    delete city[key]
  } else {
    city[key] = cur
  }
  if (Object.keys(city).length === 0) delete all[cityCode]
  else all[cityCode] = city
  _write(MARKS_KEY, all)
  return city[key] || null
}

/**
 * 足迹统计
 * @param {Array} favoriteCities 收藏城市 code 列表
 * @param {Array} savedReports 已保存报告列表（含 cityCode）
 */
function getFootprintStats(favoriteCities, savedReports) {
  const all = getAllMarks()
  let wantCount = 0
  let doneCount = 0
  const markCities = new Set()
  Object.keys(all).forEach(c => {
    const city = all[c]
    Object.keys(city).forEach(k => {
      const m = city[k]
      if (m.status === 'want') wantCount++
      else if (m.status === 'done') doneCount++
      markCities.add(c)
    })
  })
  const explored = new Set(markCities)
  ;(favoriteCities || []).forEach(c => explored.add(c))
  ;(savedReports || []).forEach(r => { if (r && r.cityCode) explored.add(r.cityCode) })

  return {
    exploredCities: explored.size,
    wantCount,
    doneCount,
    totalMarks: wantCount + doneCount,
    markCities: Array.from(markCities)
  }
}

/* ============ 出行清单 ============ */

// 默认清单模板（按周末城市游场景定制）
const PACKING_TEMPLATE = [
  {
    cat: '证件与票券',
    icon: '🎫',
    items: ['身份证', '手机（充满电）', '充电宝', '地铁/公交乘车码', '景区预约截图', '演出/门票电子票', '酒店订单']
  },
  {
    cat: '数码设备',
    icon: '📱',
    items: ['充电器/数据线', '耳机', '拍照设备', '移动电源', '耳机转接']
  },
  {
    cat: '衣物鞋帽',
    icon: '👕',
    items: ['舒适步行鞋', '防晒衣/薄外套（夜间降温）', '备用袜子', '遮阳帽']
  },
  {
    cat: '防晒防雨',
    icon: '☂️',
    items: ['防晒霜(SPF50+)', '折叠伞/雨衣', '墨镜', '晴雨两用帽']
  },
  {
    cat: '洗漱护肤',
    icon: '🧴',
    items: ['纸巾/湿巾', '漱口水', '小瓶护肤品', '唇膏']
  },
  {
    cat: '健康防护',
    icon: '💊',
    items: ['常用药', '创可贴', '口罩', '免洗消毒凝胶']
  },
  {
    cat: '随身其他',
    icon: '🎒',
    items: ['水杯', '小背包', '少量现金零钱', '购物袋', '纸巾']
  }
]

function _buildDefaultPacking() {
  const items = []
  let id = 1
  PACKING_TEMPLATE.forEach(group => {
    group.items.forEach(text => {
      items.push({ id: 'd' + (id++), text, checked: false, custom: false, cat: group.cat })
    })
  })
  return { version: 1, items, updated: Date.now() }
}

// 获取清单（首次访问初始化默认模板）
function getPacking() {
  const p = _read(PACKING_KEY, null)
  if (!p || !p.items) {
    const def = _buildDefaultPacking()
    _write(PACKING_KEY, def)
    return def
  }
  return p
}

function savePacking(p) {
  p.updated = Date.now()
  _write(PACKING_KEY, p)
  return p
}

// 切换勾选
function togglePackingItem(itemId) {
  const p = getPacking()
  const it = p.items.find(i => i.id === itemId)
  if (it) {
    it.checked = !it.checked
    savePacking(p)
  }
  return p
}

// 添加自定义项
function addPackingItem(text, cat) {
  const p = getPacking()
  const t = (text || '').trim()
  if (!t) return p
  p.items.push({ id: 'c' + Date.now(), text: t, checked: false, custom: true, cat: cat || '自定义' })
  savePacking(p)
  return p
}

// 删除项
function removePackingItem(itemId) {
  const p = getPacking()
  p.items = p.items.filter(i => i.id !== itemId)
  savePacking(p)
  return p
}

// 重置为默认模板
function resetPacking() {
  const def = _buildDefaultPacking()
  _write(PACKING_KEY, def)
  return def
}

// 统计进度
function getPackingProgress(p) {
  p = p || getPacking()
  const total = p.items.length
  const checked = p.items.filter(i => i.checked).length
  return { total, checked, percent: total ? Math.round(checked / total * 100) : 0 }
}

module.exports = {
  MARKS_KEY,
  PACKING_KEY,
  PACKING_TEMPLATE,
  getAllMarks,
  getCityMarks,
  getMark,
  cycleMark,
  setMarkStatus,
  setMarkNote,
  getFootprintStats,
  getPacking,
  savePacking,
  togglePackingItem,
  addPackingItem,
  removePackingItem,
  resetPacking,
  getPackingProgress
}
