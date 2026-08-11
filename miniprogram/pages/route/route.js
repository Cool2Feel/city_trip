// pages/route/route.js - v3.0 统一API + 交通估算 + 日历导入 + 路线地图折线/预算/POI打卡
const api = require('../../utils/api.js')
const mockData = require('../../utils/mockData.js')
const uiHelper = require('../../utils/uiHelper.js')
const util = require('../../utils/util.js')
const userData = require('../../utils/userData.js')

Page({
  data: {
    cityCode: '',
    cityName: '',
    routes: [],
    activeRouteId: 'A',
    activeRoute: null,
    dataSource: '',
    dataUpdateTime: '',
    isWeekendExpired: false,
    loading: true,
    places: [],
    // 新增：路线地图折线
    mapVisible: false,
    routeMap: { markers: [], polyline: [], includePoints: [], center: {}, matchedCount: 0, total: 0 },
    // 新增：预算估算
    budget: null,
    // 新增：时间线POI标记（想去/已去）
    markMap: {},
    noteMap: {},
    noteModal: { visible: false, key: '', activity: '', text: '' },
    // B级：路线按距离智能重排
    routeOptimized: false,
    optimizedTimeline: null,
    routeOptInfo: {
      canOptimize: false, nodeCount: 0,
      originalDistKm: 0, optimizedDistKm: 0, savedKm: 0, savedMin: 0,
      savedKmText: '0', savedMinText: '0'
    }
  },

  onLoad(options) {
    const cityCode = options.cityCode || 'guangzhou'
    const routeId = options.routeId || 'A'
    const weekendOffset = Number(options.weekend) === 1 ? 1 : 0
    const preference = options.pref || ''
    this._weekendOffset = weekendOffset
    this._preference = preference
    this.loadRoutes(cityCode, routeId, weekendOffset, preference)
  },

  // 下拉刷新：强制拉取最新路线数据
  onPullDownRefresh() {
    const code = this.data.cityCode
    if (!code) {
      wx.stopPullDownRefresh()
      return
    }
    this.refreshRoutes(code)
  },

  // 过期横幅点击
  refreshRouteTap() {
    if (!this.data.cityCode) return
    uiHelper.feedbackSwitch()
    this.refreshRoutes(this.data.cityCode)
  },

  // 强制刷新路线数据（下拉刷新 / 过期横幅共用）
  refreshRoutes(code) {
    api.getReport(code, true, { weekendOffset: this._weekendOffset, preference: this._preference }).then(result => {
      if (result && result.data) {
        const routesSection = result.data.sections.find(s => s.type === 'routes')
        let freshRoutes = routesSection ? routesSection.routes : []
        freshRoutes = freshRoutes.map(route => {
          if (route.timeline && route.timeline.length > 0) {
            route.timeline = uiHelper.enrichTimelineWithTravel(route.timeline, this.data.places)
          }
          return route
        })
        const freshActive = freshRoutes.find(r => r.id === this.data.activeRouteId) || freshRoutes[0]
        this.setData({
          routes: freshRoutes,
          activeRoute: freshActive,
          isWeekendExpired: util.isWeekendExpired(result.data),
          dataUpdateTime: uiHelper.timeAgo(Date.now())
        })
        this._recomputeOptimizeAndExtras()
      }
      wx.stopPullDownRefresh()
    }).catch(() => {
      wx.stopPullDownRefresh()
      util.showToast('刷新失败，请重试')
    })
  },

  async loadRoutes(cityCode, routeId, weekendOffset = 0, preference = '') {
    try {
      const [reportResult, placesResult] = await Promise.all([
        api.getReport(cityCode, false, { weekendOffset, preference }),
        api.getPlaces(cityCode)
      ])
      const report = reportResult.data
      const places = (placesResult && placesResult.data) || mockData.getPlaces(cityCode) || []
      const city = mockData.getCity(cityCode)
      if (report) {
        const routesSection = report.sections.find(s => s.type === 'routes')
        let routes = routesSection ? routesSection.routes : []

        // 交通估算
        routes = routes.map(route => {
          if (route.timeline && route.timeline.length > 0) {
            route.timeline = uiHelper.enrichTimelineWithTravel(route.timeline, places)
          }
          return route
        })

        const activeRoute = routes.find(r => r.id === routeId) || routes[0]
        this.setData({
          cityCode,
          cityName: city ? city.name : '',
          routes,
          activeRouteId: activeRoute ? activeRoute.id : 'A',
          activeRoute,
          isWeekendExpired: util.isWeekendExpired(report),
          dataSource: reportResult.source,
          dataUpdateTime: uiHelper.timeAgo(Date.now()),
          loading: false,
          places
        })

        this._recomputeOptimizeAndExtras()

        // SWR: background refresh if stale
        if (reportResult.stale) {
          api.getReport(cityCode, true, { weekendOffset, preference }).then(freshResult => {
            if (freshResult && freshResult.data) {
              const freshRoutesSec = freshResult.data.sections.find(s => s.type === 'routes')
              let freshRoutes = freshRoutesSec ? freshRoutesSec.routes : []
              freshRoutes = freshRoutes.map(route => {
                if (route.timeline && route.timeline.length > 0) {
                  route.timeline = uiHelper.enrichTimelineWithTravel(route.timeline, this.data.places)
                }
                return route
              })
              const freshActive = freshRoutes.find(r => r.id === this.data.activeRouteId) || freshRoutes[0]
              this.setData({
                routes: freshRoutes,
                activeRoute: freshActive,
                isWeekendExpired: util.isWeekendExpired(freshResult.data),
                dataUpdateTime: uiHelper.timeAgo(Date.now())
              })
              this._recomputeOptimizeAndExtras()
            }
          }).catch(() => {})
        }
      } else {
        this.setData({ loading: false })
      }
    } catch (e) {
      console.warn('[route] loadRoutes failed:', e.message)
      this.setData({ loading: false })
      util.showToast('加载失败，请重试')
    }
  },

  // 切换路线
  switchRoute(e) {
    uiHelper.feedbackSwitch()
    const id = e.currentTarget.dataset.id
    const route = this.data.routes.find(r => r.id === id)
    this.setData({ activeRouteId: id, activeRoute: route })
    this._recomputeOptimizeAndExtras()
    wx.pageScrollTo({ scrollTop: 0, duration: 200 })
  },

  // ===== B级：根据 activeRoute + 顺路模式 计算地图/预算/标记 =====
  _computeRouteExtras() {
    const route = this.data.activeRoute
    if (!route) return
    const dispTimeline = this.data.routeOptimized ? (this.data.optimizedTimeline || route.timeline) : route.timeline
    const mapData = this._buildRouteMap(route, dispTimeline)
    const budget = this._buildRouteBudget(route)
    const cityMarks = userData.getCityMarks(this.data.cityCode)
    const markMap = {}
    const noteMap = {}
    ;(dispTimeline || []).forEach(t => {
      const key = t.activity
      const m = cityMarks[key]
      if (m) {
        markMap[key] = m.status
        if (m.note) noteMap[key] = m.note
      }
    })
    this.setData({ routeMap: mapData, budget, markMap, noteMap })
  },

  // ===== B级：路线按距离智能重排 =====

  // 直线距离（km），基于 haversine
  _haversineKm(a, b) {
    const R = 6371
    const dLat = (b.lat - a.lat) * Math.PI / 180
    const dLng = (b.lng - a.lng) * Math.PI / 180
    const la1 = a.lat * Math.PI / 180
    const la2 = b.lat * Math.PI / 180
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
    return 2 * R * Math.asin(Math.sqrt(h))
  },

  // 路网估算：直线距离 × 城市路网系数（含步行接驳）
  _estimateRoadKm(a, b) {
    return this._haversineKm(a, b) * 1.35
  },

  // 最近邻排序：起点固定为第一个节点（用户所在起点），其余就近排列
  _nearestNeighborOrder(nodes) {
    const n = nodes.length
    if (n <= 2) return nodes.map((_, i) => i)
    const visited = new Array(n).fill(false)
    const order = [0]
    visited[0] = true
    let cur = 0
    for (let step = 1; step < n; step++) {
      let best = -1, bestD = Infinity
      for (let j = 0; j < n; j++) {
        if (visited[j]) continue
        const d = this._haversineKm(nodes[cur], nodes[j])
        if (d < bestD) { bestD = d; best = j }
      }
      if (best >= 0) { order.push(best); visited[best] = true; cur = best }
    }
    return order
  },

  // 计算顺路重排结果与节省指标
  _computeOptimizeInfo(route) {
    const places = this.data.places || []
    const tl = (route && route.timeline) || []
    const nodes = []
    tl.forEach(t => {
      const p = this._matchPlace(t, places)
      if (p && p.lat && p.lng) nodes.push({ t, lat: p.lat, lng: p.lng })
    })
    const info = {
      canOptimize: false, nodeCount: nodes.length,
      originalDistKm: 0, optimizedDistKm: 0, savedKm: 0, savedMin: 0,
      savedKmText: '0', savedMinText: '0'
    }
    if (nodes.length < 2) return { optimizedTimeline: null, info }
    // 原顺序路网距离
    let orig = 0
    for (let i = 1; i < nodes.length; i++) orig += this._estimateRoadKm(nodes[i - 1], nodes[i])
    // 顺路重排
    const order = this._nearestNeighborOrder(nodes)
    const reordered = order.map(i => nodes[i].t)
    const optimizedTimeline = uiHelper.enrichTimelineWithTravel(reordered, places)
    let opt = 0
    for (let i = 1; i < nodes.length; i++) opt += this._estimateRoadKm(nodes[order[i - 1]], nodes[order[i]])
    const saved = Math.max(0, orig - opt)
    const savedMin = Math.round(saved / 25 * 60) // 综合约25km/h（含步行接驳）
    info.canOptimize = true
    info.originalDistKm = Math.round(orig * 10) / 10
    info.optimizedDistKm = Math.round(opt * 10) / 10
    info.savedKm = Math.round(saved * 10) / 10
    info.savedMin = savedMin
    info.savedKmText = info.savedKm.toFixed(1)
    info.savedMinText = String(savedMin)
    return { optimizedTimeline, info }
  },

  // 重算顺路结果与地图/预算（切换路线/刷新/重排通用）
  _recomputeOptimizeAndExtras() {
    const route = this.data.activeRoute
    if (!route) return
    const { optimizedTimeline, info } = this._computeOptimizeInfo(route)
    const routeOptimized = this.data.routeOptimized && info.canOptimize
    this.setData({ optimizedTimeline, routeOptInfo: info, routeOptimized })
    this._computeRouteExtras()
  },

  // 切换顺路模式
  toggleOptimizeRoute() {
    const next = !this.data.routeOptimized
    if (next && !this.data.routeOptInfo.canOptimize) {
      util.showToast('地图节点不足，暂无法重排')
      return
    }
    uiHelper.feedbackSwitch()
    this.setData({ routeOptimized: next })
    this._computeRouteExtras()
    if (next) {
      const km = this.data.routeOptInfo.savedKm
      if (km >= 0.5) util.showToast('已按顺路重排，省 ' + km.toFixed(1) + 'km')
      else util.showToast('当前顺序已较顺路')
    }
  },

  // 时间线节点 -> 地点匹配（模糊匹配活动/地点文本与 places 名称）
  _matchPlace(item, places) {
    if (!places || !places.length) return null
    if (item.mappable === false) return null
    const a = item.activity || ''
    if (!a) return null
    let best = null
    let bestScore = 0
    for (const p of places) {
      let score = 0
      if (a.indexOf(p.name) > -1) score = 10
      else if (p.name.indexOf(a) > -1) score = 8
      else {
        let hit = false
        for (let n = 3; n <= Math.min(6, p.name.length); n++) {
          if (a.indexOf(p.name.slice(0, n)) > -1) { score = 6; hit = true; break }
        }
        if (!hit) {
          // 2字窗口匹配（兜底，分数最低，避免错配优先）
          for (let n = 2; n <= Math.min(4, p.name.length); n++) {
            if (a.indexOf(p.name.slice(0, n)) > -1) { score = 5; break }
          }
        }
      }
      if (score > bestScore) { bestScore = score; best = p }
    }
    return bestScore >= 5 ? best : null
  },

  // 构建路线地图折线 + 标记（支持顺路模式覆盖时间线）
  _buildRouteMap(route, timelineOverride) {
    const places = this.data.places || []
    const timeline = timelineOverride || route.timeline || []
    const markers = []
    const points = []
    let matchedCount = 0
    ;(timeline || []).forEach((t, idx) => {
      const place = this._matchPlace(t, places)
      if (place && place.lat && place.lng) {
        markers.push({
          id: idx,
          latitude: place.lat,
          longitude: place.lng,
          width: 26,
          height: 26,
          callout: {
            content: (idx + 1) + '. ' + (t.activity || '').slice(0, 10),
            color: '#1f2d3d',
            fontSize: 11,
            bgColor: '#ffffff',
            padding: 5,
            borderRadius: 6,
            display: 'BYCLICK'
          },
          anchor: { x: 0.5, y: 0.5 }
        })
        points.push({ latitude: place.lat, longitude: place.lng })
        matchedCount++
      }
    })
    const polyline = points.length >= 2
      ? [{ points, color: this._hexToRgb(route.color || '#4A90D9'), width: 4, dottedLine: false, arrowLine: true }]
      : []
    const center = points.length ? points[Math.floor(points.length / 2)] : {}
    return {
      markers,
      polyline,
      includePoints: points,
      center,
      matchedCount,
      total: (route.timeline || []).length
    }
  },

  // 十六进制颜色转 #RRGGBB 给 polyline 使用
  _hexToRgb(hex) {
    if (!hex) return '#4A90D9'
    const h = hex.replace('#', '')
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
    const r = parseInt(full.slice(0, 2), 16)
    const g = parseInt(full.slice(2, 4), 16)
    const b = parseInt(full.slice(4, 6), 16)
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')
  },

  // 解析价格字符串 -> {min, max, free}
  _parsePrice(str) {
    if (!str) return null
    if (/免费|无需购票|免费逛/.test(str)) return { min: 0, max: 0, free: true }
    if (str === '-') return null
    const range = str.match(/(\d+(?:\.\d+)?)\s*[-~至]\s*(\d+(?:\.\d+)?)/)
    if (range) {
      return { min: parseFloat(range[1]), max: parseFloat(range[2]), free: false }
    }
    const nums = str.match(/\d+(\.\d+)?/g)
    if (!nums) return null
    const v = parseFloat(nums[0])
    return { min: v, max: v, free: false }
  },

  // 构建路线预算估算（门票 + 餐饮 + 免费点）
  _buildRouteBudget(route) {
    const places = this.data.places || []
    let ticketMin = 0, ticketMax = 0, foodMin = 0, foodMax = 0, freeCount = 0, matched = 0
    const TICKET_CATS = ['concert', 'sport', 'scenic', 'museum', 'ticket']
    const FOOD_CATS = ['food', 'tea']
    ;(route.timeline || []).forEach(t => {
      const place = this._matchPlace(t, places)
      if (!place || !place.price) return
      const p = this._parsePrice(place.price)
      if (!p) return
      matched++
      const cat = place.category
      if (TICKET_CATS.indexOf(cat) > -1) {
        if (p.free) freeCount++
        else { ticketMin += p.min; ticketMax += p.max }
      } else if (FOOD_CATS.indexOf(cat) > -1) {
        if (p.free) freeCount++
        else { foodMin += p.min; foodMax += p.max }
      } else if (p.free) {
        freeCount++
      }
    })
    if (matched === 0) return null
    return {
      ticketMin, ticketMax, foodMin, foodMax, freeCount, matched,
      totalMin: ticketMin + foodMin,
      totalMax: ticketMax + foodMax
    }
  },

  // 切换路线地图显示
  toggleRouteMap() {
    uiHelper.feedbackSwitch()
    this.setData({ mapVisible: !this.data.mapVisible })
  },

  // ===== 新增：时间线POI标记（想去/已去）=====
  cycleTimelineMark(e) {
    const activity = e.currentTarget.dataset.activity
    if (!activity) return
    uiHelper.feedbackSwitch()
    const m = userData.cycleMark(this.data.cityCode, activity)
    const markMap = Object.assign({}, this.data.markMap)
    const noteMap = Object.assign({}, this.data.noteMap)
    if (m && m.status) {
      markMap[activity] = m.status
    } else {
      delete markMap[activity]
      delete noteMap[activity]
    }
    this.setData({ markMap, noteMap })
  },

  // 打开备注弹窗
  openTimelineNote(e) {
    const activity = e.currentTarget.dataset.activity
    if (!activity) return
    uiHelper.feedbackSwitch()
    this.setData({
      noteModal: {
        visible: true,
        key: activity,
        activity,
        text: this.data.noteMap[activity] || ''
      }
    })
  },

  // 备注输入
  onNoteInput(e) {
    this.setData({ 'noteModal.text': e.detail.value })
  },

  // 保存备注
  saveNote() {
    const nm = this.data.noteModal
    if (!nm.key) return
    userData.setMarkNote(this.data.cityCode, nm.key, nm.text.trim())
    const noteMap = Object.assign({}, this.data.noteMap)
    if (nm.text.trim()) noteMap[nm.key] = nm.text.trim()
    else delete noteMap[nm.key]
    // 确保至少有一个状态，避免只有备注无图标
    const markMap = Object.assign({}, this.data.markMap)
    if (!markMap[nm.key]) {
      const m = userData.cycleMark(this.data.cityCode, nm.key) // 无->想去
      if (m) markMap[nm.key] = m.status
    }
    this.setData({ noteMap, markMap, 'noteModal.visible': false })
    uiHelper.feedbackSuccess()
  },

  // 关闭备注弹窗
  closeNote() {
    this.setData({ 'noteModal.visible': false })
  },

  // 阻止冒泡
  noop() {},

  // 前往出行清单
  goPacking() {
    uiHelper.feedbackSwitch()
    const city = encodeURIComponent(this.data.cityName || '')
    wx.navigateTo({ url: '/pages/packing/packing?cityName=' + city })
  },

  // 复制路线
  copyRoute() {
    const r = this.data.activeRoute
    if (!r) return
    let text = this.data.cityName + '周末路线' + r.id + ': ' + r.name + '\n' + r.desc + '\n'
    text += '\n行程安排:\n'
    r.timeline.forEach((t, i) => {
      text += '  ' + (i + 1) + '. ' + t.time + ' ' + t.activity + '（' + t.location + '）'
      if (t._travelFromPrev) {
        text += ' [与上一站相距' + t._travelFromPrev.distance + 'km · 约' + t._travelFromPrev.time + ']'
      }
      const mk = this.data.markMap[t.activity]
      if (mk === 'want') text += ' [想去]'
      else if (mk === 'done') text += ' [已去]'
      if (t.note) text += ' - ' + t.note
      text += '\n'
    })
    text += '\n——由周末城市游生成'
    wx.setClipboardData({
      data: text,
      success: () => {
        uiHelper.feedbackSuccess()
        wx.showToast({ title: '行程已复制', icon: 'success' })
      }
    })
  },

  // 添加到日历
  addToCalendar() {
    const r = this.data.activeRoute
    if (!r) return
    uiHelper.feedbackSwitch()

    const calEvent = uiHelper.buildCalendarEvent(r, this.data.cityName)

    if (wx.addPhoneCalendarEvent) {
      wx.addPhoneCalendarEvent({
        title: calEvent.title,
        startTime: calEvent.startTime,
        endTime: calEvent.endTime,
        location: calEvent.location,
        alarm: true,
        alarmOffset: 30,
        success: () => {
          uiHelper.feedbackSuccess()
          wx.showToast({ title: '已添加到日历', icon: 'success' })
        },
        fail: () => {
          this._copyCalendarInfo(calEvent)
        }
      })
    } else {
      this._copyCalendarInfo(calEvent)
    }
  },

  _copyCalendarInfo(calEvent) {
    const text = '📅 ' + calEvent.title + '\n' +
      '开始: ' + calEvent.startTimeStr + '\n' +
      '结束: ' + calEvent.endTimeStr + '\n' +
      '地点: ' + calEvent.location + '\n' +
      '提醒: 提前30分钟'
    wx.setClipboardData({
      data: text,
      success: () => {
        wx.showModal({
          title: '日历信息已复制',
          content: '暂不支持直接添加日历，已复制日程信息到剪贴板，请粘贴到日历App中。',
          showCancel: false
        })
      }
    })
  },

  // 打开外部地图导航
  openInMap(e) {
    const location = e.currentTarget.dataset.location
    if (!location) return
    uiHelper.feedbackSwitch()

    const place = this._findPlace(location)
    if (place) {
      wx.openLocation({
        latitude: place.lat,
        longitude: place.lng,
        name: place.name,
        address: this.data.cityName + ' · ' + location,
        scale: 16,
        fail: () => util.showToast('无法打开导航')
      })
    } else {
      wx.setClipboardData({ data: this.data.cityName + ' · ' + location })
      util.showToast('地点已复制')
    }
  },

  // 在已加载地点中匹配路线节点坐标
  _findPlace(name) {
    const places = this.data.places || []
    if (!places.length) return null
    let hit = places.find(p => p.name === name)
    if (hit) return hit
    for (const q of [name]) {
      if (!q) continue
      hit = places.find(p => q.includes(p.name) || p.name.includes(q))
      if (hit) return hit
    }
    return null
  },

  onShareAppMessage() {
    const r = this.data.activeRoute
    return {
      title: this.data.cityName + '周末路线 | ' + (r ? r.name : '') + ' - 完整行程',
      path: '/pages/route/route?cityCode=' + this.data.cityCode + '&routeId=' + this.data.activeRouteId,
      imageUrl: (r && r.coverImage) ? r.coverImage : '/assets/images/home-banner.jpg'
    }
  },

  onShareTimeline() {
    const r = this.data.activeRoute
    return {
      title: this.data.cityName + '周末路线' + this.data.activeRouteId + ': ' + (r ? r.name : ''),
      query: 'cityCode=' + this.data.cityCode + '&routeId=' + this.data.activeRouteId,
      imageUrl: (r && r.coverImage) ? r.coverImage : '/assets/images/home-banner.jpg'
    }
  }
})
