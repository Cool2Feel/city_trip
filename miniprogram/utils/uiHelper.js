// utils/uiHelper.js
// UI 辅助函数：触感反馈、骨架屏数据生成、空状态配置、时间格式化

/**
 * 触感反馈（轻触）
 */
function vibrateShort() {
  if (wx.vibrateShort) {
    wx.vibrateShort({ type: 'light' })
  }
}

/**
 * 触感反馈（中等）
 */
function vibrateMedium() {
  if (wx.vibrateShort) {
    wx.vibrateShort({ type: 'medium' })
  }
}

/**
 * 触感反馈（成功操作）
 */
function feedbackSuccess() {
  vibrateShort()
}

/**
 * 触感反馈（切换操作）
 */
function feedbackSwitch() {
  vibrateShort()
}

/**
 * 触感反馈（警告操作）
 */
function feedbackWarning() {
  if (wx.vibrateShort) {
    wx.vibrateShort({ type: 'heavy' })
  }
}

/**
 * 生成骨架屏占位数据
 * @param {number} count - 占位项数量
 * @param {string} type - 类型: 'card' | 'list' | 'grid'
 */
function getSkeletonData(count, type) {
  const items = []
  for (let i = 0; i < count; i++) {
    items.push({ id: i, type })
  }
  return items
}

/**
 * 空状态配置
 */
const EMPTY_STATES = {
  noCity: {
    icon: '📍',
    title: '请先选择城市',
    desc: '选择城市后即可查看详细攻略',
    actionText: '选择城市'
  },
  noData: {
    icon: '📭',
    title: '暂无数据',
    desc: '该城市暂无调研数据，请尝试其他城市',
    actionText: '切换城市'
  },
  noReport: {
    icon: '📋',
    title: '报告尚未生成',
    desc: '点击下方按钮开始10步标准化调研',
    actionText: '开始调研'
  },
  noPlaces: {
    icon: '🗺️',
    title: '暂无地点数据',
    desc: '该城市暂无地图标记点',
    actionText: ''
  },
  noFavorites: {
    icon: '⭐',
    title: '暂无收藏',
    desc: '在首页点击星标即可收藏城市',
    actionText: ''
  },
  noReports: {
    icon: '📥',
    title: '暂无已保存报告',
    desc: '在攻略报告页点击保存即可查看',
    actionText: ''
  },
  searchEmpty: {
    icon: '🔍',
    title: '未找到相关结果',
    desc: '试试其他关键词',
    actionText: ''
  }
}

/**
 * 格式化时间戳为"x分钟前/x小时前/x天前"
 */
function timeAgo(timestamp) {
  if (!timestamp) return '未知'
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return minutes + '分钟前'
  if (hours < 24) return hours + '小时前'
  if (days < 7) return days + '天前'
  return new Date(timestamp).toLocaleDateString('zh-CN')
}

/**
 * 估算两个坐标点之间的直线距离（km）
 */
function estimateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c * 10) / 10
}

/**
 * 根据距离估算出行时间
 * @param {number} distance - 距离(km)
 * @param {string} mode - 交通方式: 'walk'|'metro'|'taxi'
 * @returns {string} 时间描述，如"约15分钟"
 */
function estimateTravelTime(distance, mode) {
  if (!distance || distance <= 0) return ''
  const speeds = {
    walk: 5,    // 5 km/h
    metro: 30,  // 30 km/h
    taxi: 25    // 25 km/h (含红绿灯)
  }
  const speed = speeds[mode] || speeds.metro
  const minutes = Math.ceil(distance / speed * 60)
  if (minutes < 60) return '约' + minutes + '分钟'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return '约' + h + '小时' + (m > 0 ? m + '分钟' : '')
}

/**
 * 为路线时间线添加行程间交通估算
 * @param {Array} timeline - 路线时间线
 * @param {Array} places - 地点列表（含坐标）
 * @returns {Array} 注入 _travelFromPrev 字段的时间线
 */
function enrichTimelineWithTravel(timeline, places) {
  if (!Array.isArray(timeline) || timeline.length === 0) return timeline
  const placeMap = {}
  if (Array.isArray(places)) {
    places.forEach(p => { placeMap[p.name] = p })
  }

  return timeline.map((item, idx) => {
    let travelFromPrev = null
    if (idx > 0) {
      const prev = timeline[idx - 1]
      const prevPlace = findPlaceByName(prev.activity || prev.location, placeMap, places)
      const currPlace = findPlaceByName(item.activity || item.location, placeMap, places)
      if (prevPlace && currPlace) {
        const dist = estimateDistance(
          prevPlace.lat, prevPlace.lng,
          currPlace.lat, currPlace.lng
        )
        if (dist > 0) {
          travelFromPrev = {
            distance: dist,
            time: estimateTravelTime(dist, 'metro')
          }
        }
      }
    }
    return { ...item, _travelFromPrev: travelFromPrev }
  })
}

function findPlaceByName(name, placeMap, places) {
  if (!name) return null
  if (placeMap[name]) return placeMap[name]
  if (Array.isArray(places)) {
    return places.find(p =>
      p.name && (p.name.includes(name) || name.includes(p.name))
    )
  }
  return null
}

/**
 * 构建日历事件描述
 */
function buildCalendarEvent(route, cityName) {
  if (!route || !route.timeline) return ''
  const lines = route.timeline.map(t =>
    `${t.time} ${t.activity}${t.note ? ' (' + t.note + ')' : ''}`
  )
  return `${cityName}周末游 - 路线${route.id}: ${route.name}\n\n${lines.join('\n')}\n\n——由周末城市游生成`
}

/**
 * 打开外部链接（微信小程序限制：仅支持已配置的域名）
 * 降级方案：复制链接到剪贴板
 */
function openExternalLink(url, name) {
  if (!url) {
    wx.showToast({ title: '链接不可用', icon: 'none' })
    return
  }
  // 尝试通过小程序业务域名打开
  wx.setClipboardData({
    data: url,
    success: () => {
      wx.showModal({
        title: '链接已复制',
        content: `${name || '外部'}链接已复制到剪贴板，请在浏览器中打开粘贴访问。`,
        showCancel: false,
        confirmText: '知道了',
        confirmColor: '#4A90D9'
      })
    }
  })
}

/**
 * 根据活动类型生成外链
 */
function getActivityLink(activity) {
  if (!activity) return null
  const name = activity.name || activity.activity || ''
  const keyword = encodeURIComponent(name)
  const category = activity.category || ''

  if (category === 'concert' || category === 'sport') {
    return {
      url: `https://search.damai.cn/search.htm?keyword=${keyword}`,
      name: '在大麦网查看',
      icon: '🎫'
    }
  }
  if (category === 'food' || category === 'museum' || category === 'scenic' || category === 'market') {
    return {
      url: `https://www.dianping.com/search/keyword/2/${keyword}`,
      name: '在大众点评查看',
      icon: '📍'
    }
  }
  if (category === 'mall') {
    return {
      url: `https://m.amap.com/search/?query=${keyword}`,
      name: '在高德地图查看',
      icon: '🗺️'
    }
  }
  return null
}

module.exports = {
  vibrateShort,
  vibrateMedium,
  feedbackSuccess,
  feedbackSwitch,
  feedbackWarning,
  getSkeletonData,
  EMPTY_STATES,
  timeAgo,
  estimateDistance,
  estimateTravelTime,
  enrichTimelineWithTravel,
  buildCalendarEvent,
  openExternalLink,
  getActivityLink
}
