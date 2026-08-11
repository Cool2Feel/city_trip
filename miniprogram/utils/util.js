// utils/util.js - 辅助函数

// 格式化日期
function formatDate(date, fmt = 'YYYY-MM-DD') {
  if (typeof date === 'string') date = new Date(date)
  const opt = {
    'Y+': date.getFullYear().toString(),
    'M+': (date.getMonth() + 1).toString().padStart(2, '0'),
    'D+': date.getDate().toString().padStart(2, '0'),
    'H+': date.getHours().toString().padStart(2, '0'),
    'm+': date.getMinutes().toString().padStart(2, '0')
  }
  let result = fmt
  for (const k in opt) {
    result = result.replace(new RegExp(k), opt[k])
  }
  return result
}

// 计算本周末日期
function getWeekendDate() {
  const today = new Date()
  const dayOfWeek = today.getDay()
  const saturday = new Date(today)
  saturday.setDate(today.getDate() + (6 - dayOfWeek))
  const sunday = new Date(saturday)
  sunday.setDate(saturday.getDate() + 1)
  return {
    saturday: formatDate(saturday),
    sunday: formatDate(sunday),
    saturdayLabel: `${saturday.getMonth() + 1}月${saturday.getDate()}日(周六)`,
    sundayLabel: `${sunday.getMonth() + 1}月${sunday.getDate()}日(周日)`
  }
}

// 计算下周末日期
function getNextWeekendDate() {
  const today = new Date()
  const dayOfWeek = today.getDay()
  const nextSaturday = new Date(today)
  nextSaturday.setDate(today.getDate() + (6 - dayOfWeek) + 7)
  const nextSunday = new Date(nextSaturday)
  nextSunday.setDate(nextSaturday.getDate() + 1)
  return {
    saturday: formatDate(nextSaturday),
    sunday: formatDate(nextSunday),
    saturdayLabel: `${nextSaturday.getMonth() + 1}月${nextSaturday.getDate()}日(周六)`,
    sundayLabel: `${nextSunday.getMonth() + 1}月${nextSunday.getDate()}日(周日)`
  }
}

// 解析"8月1日-8月2日"格式的周末标签，返回 { start: Date, end: Date } 或 null
function parseWeekendLabel(weekend) {
  if (!weekend) return null
  const match = String(weekend).match(/(\d{1,2})月(\d{1,2})日[^-]*?[-~至][^-]*?(\d{1,2})月(\d{1,2})日/)
  if (!match) return null
  const year = new Date().getFullYear()
  const start = new Date(year, Number(match[1]) - 1, Number(match[2]))
  const end = new Date(year, Number(match[3]) - 1, Number(match[4]))
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null
  return { start, end }
}

// 判断攻略是否对应"本周末"（跨周一重置，周末仍算当前）
function isWeekendCurrent(weekend) {
  const parsed = parseWeekendLabel(weekend)
  if (!parsed) return true // 无法解析则不做过期判断
  const today = new Date()
  // 本周一
  const monday = new Date(today)
  const day = today.getDay() // 0=周日
  monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1))
  monday.setHours(0, 0, 0, 0)
  // 本周日
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

  const start = new Date(parsed.start)
  const end = new Date(parsed.end)
  // 攻略周末起点不早于本周一（视为当前/未来），且不晚于下周日前
  return start >= monday && start <= sunday
}

// 判断条目有效期是否已过（支持"8月31日"、"8月31日-9月2日"、"长期"/空）
function isExpiryPassed(expiry) {
  if (!expiry) return false
  const str = String(expiry)
  if (str.includes('长期')) return false
  const match = str.match(/(\d{1,2})月(\d{1,2})日/)
  if (!match) return false
  const today = new Date()
  const year = today.getFullYear()
  const expDate = new Date(year, Number(match[1]) - 1, Number(match[2]))
  // 已跨年（如 1月1日 在 12月 之后）视为次年
  if (expDate < new Date(year, 0, 1) && today.getMonth() > 6) {
    expDate.setFullYear(year + 1)
  }
  expDate.setHours(23, 59, 59, 999)
  return expDate.getTime() < today.getTime()
}

// 判断报告是否对应已过期周末
function isWeekendExpired(report) {
  return !!(report && report.overview && !isWeekendCurrent(report.overview.weekend))
}

// 节流
function throttle(fn, delay = 300) {
  let lastTime = 0
  return function (...args) {
    const now = Date.now()
    if (now - lastTime >= delay) {
      lastTime = now
      fn.apply(this, args)
    }
  }
}

// 防抖
function debounce(fn, delay = 300) {
  let timer = null
  return function (...args) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn.apply(this, args), delay)
  }
}

// 显示Toast
function showToast(title, icon = 'none', duration = 2000) {
  wx.showToast({ title, icon, duration })
}

// 显示加载
function showLoading(title = '加载中') {
  wx.showLoading({ title, mask: true })
}

function hideLoading() {
  wx.hideLoading()
}

// 显示模态框
function showModal(title, content) {
  return new Promise((resolve) => {
    wx.showModal({
      title,
      content,
      confirmColor: '#4A90D9',
      success(res) {
        resolve(res.confirm)
      }
    })
  })
}

// rpx转px
function rpx2px(rpx) {
  const sysInfo = wx.getSystemInfoSync()
  return rpx * sysInfo.windowWidth / 750
}

// 计算距离
function calcDistance(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// 格式化时间（xx分钟前）
function timeAgo(timestamp) {
  const diff = Date.now() - timestamp
  const min = Math.floor(diff / 60000)
  const hour = Math.floor(min / 60)
  const day = Math.floor(hour / 24)
  if (day > 0) return `${day}天前`
  if (hour > 0) return `${hour}小时前`
  if (min > 0) return `${min}分钟前`
  return '刚刚'
}

module.exports = {
  formatDate,
  getWeekendDate,
  getNextWeekendDate,
  parseWeekendLabel,
  isWeekendCurrent,
  isWeekendExpired,
  isExpiryPassed,
  throttle,
  debounce,
  showToast,
  showLoading,
  hideLoading,
  showModal,
  rpx2px,
  calcDistance,
  timeAgo
}
