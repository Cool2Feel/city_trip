// pages/map/map.js - v5.0 Clustering + SWR auto-refresh + user-friendly labels
const api = require('../../utils/api.js')
const mockData = require('../../utils/mockData.js')
const categories = require('../../utils/categories.js')
const catHelper = require('../../utils/categoryHelper.js')
const uiHelper = require('../../utils/uiHelper.js')
const clusterHelper = require('../../utils/clusterHelper.js')
const util = require('../../utils/util.js')

Page({
  data: {
    currentCity: null,
    places: [],
    filteredPlaces: [],
    activeCategories: {},
    selectedPlace: null,
    markers: [],
    polyline: [],
    cityCenter: { latitude: 23.1291, longitude: 113.2644 },
    searchText: '',
    showList: true,
    showRoute: false,
    routeIndex: 0,
    routes: [],
    activeRouteId: 'A',
    scale: 12,
    categories: categories.CATEGORIES,
    loading: true,
    dataLoading: false,
    dataSource: 'mock',
    isStale: false,
    dataUpdateTime: '',
    // Clustering
    clusterStats: { total: 0, displayed: 0, hidden: 0, clusterCount: 0 },
    showClusterHint: false
  },

  onLoad(options) {
    this.mapCtx = null
    this._rawMarkers = [] // Unclustered markers
    this._clusterThrottle = null

    // 从分享进入：切换城市
    if (options && options.cityCode) {
      const city = mockData.getCity(options.cityCode)
      if (city) {
        const app = getApp()
        app.saveCurrentCity(city)
      }
    }
    this.loadData()
  },

  onReady() {
    this.mapCtx = wx.createMapContext('cityMap')
  },

  onShow() {
    // Only reload if city changed
    const app = getApp()
    const city = app.globalData.currentCity
    const hasFocus = !!wx.getStorageSync('map_focus_place')
    if (city && (!this.data.currentCity || this.data.currentCity.code !== city.code)) {
      this.loadData()
    } else if (hasFocus) {
      // 城市未变但有聚焦请求（报告页二次跳转）：直接消费
      this._handleFocusPlace()
    }
  },

  async loadData(forceRefresh = false) {
    const app = getApp()
    const city = app.globalData.currentCity
    if (!city) {
      this.setData({ loading: false })
      return
    }

    this.setData({ dataLoading: true })

    try {
      const [placesResult, centerResult, reportResult] = await Promise.all([
        api.getPlaces(city.code, forceRefresh),
        api.getCityCenter(city.code, forceRefresh),
        api.getReport(city.code, forceRefresh)
      ])

      const places = placesResult.data || []
      const center = centerResult.data || mockData.getCityCenter(city.code)
      const report = reportResult.data
      const dataSource = placesResult.source || 'mock'
      const isStale = placesResult.stale || false

      const activeCats = {}
      categories.CATEGORIES.forEach(c => { activeCats[c.id] = true })

      this._rawMarkers = this.buildMarkers(places)

      const clusterResult = clusterHelper.clusterMarkers(this._rawMarkers, this.data.scale)
      const clusterStats = clusterHelper.getClusterStats(clusterResult)

      let routes = []
      if (report) {
        const routesSection = report.sections.find(s => s.type === 'routes')
        routes = routesSection ? routesSection.routes : []
      }

      this.setData({
        currentCity: city,
        places,
        filteredPlaces: catHelper.enrichPlaces(places),
        activeCategories: activeCats,
        markers: clusterResult.markers,
        cityCenter: { latitude: center.lat, longitude: center.lng },
        routes,
        loading: false,
        dataLoading: false,
        dataSource,
        isStale,
        dataUpdateTime: uiHelper.timeAgo(Date.now()),
        clusterStats,
        showClusterHint: clusterStats.clusterCount > 0
      })

      // SWR: if stale, auto-refresh in background
      if (isStale && !forceRefresh) {
        api.getPlaces(city.code, true).then(freshResult => {
          if (freshResult && freshResult.data) {
            this._rawMarkers = this.buildMarkers(freshResult.data)
            this.recluster()
            this.setData({
              places: freshResult.data,
              filteredPlaces: catHelper.enrichPlaces(freshResult.data),
              isStale: false,
              dataUpdateTime: uiHelper.timeAgo(Date.now())
            })
          }
        }).catch(() => {})
      }
    } catch (e) {
      console.warn('[map] loadData failed:', e.message)
      this.setData({ loading: false, dataLoading: false })
    }
  },

  // 处理从攻略页带过来的聚焦地点
  _handleFocusPlace() {
    const focus = wx.getStorageSync('map_focus_place')
    if (!focus || !focus.lat || !focus.lng) return
    wx.removeStorageSync('map_focus_place')

    // 优先匹配已加载的地点，选中并高亮
    const place = this.data.places.find(p => p.name === focus.name) ||
      this.data.places.find(p => Math.abs(p.lat - focus.lat) < 0.01 && Math.abs(p.lng - focus.lng) < 0.01)
    if (place) {
      const enriched = catHelper.enrichPlace(place)
      enriched._extLink = uiHelper.getActivityLink(place)
      this.setData({ selectedPlace: enriched, showList: false })
    }

    // 地图移动到目标位置
    if (this.mapCtx) {
      this.mapCtx.moveToLocation({ latitude: focus.lat, longitude: focus.lng })
    }
    this.setData({ scale: 16 })
  },

  // Build individual markers
  buildMarkers(places) {
    return places.map(p => {
      const cat = categories.getCategory(p.category)
      return {
        id: p.id,
        latitude: p.lat,
        longitude: p.lng,
        width: 32,
        height: 40,
        callout: {
          content: p.name,
          color: '#ffffff',
          fontSize: 12,
          borderRadius: 8,
          padding: 8,
          bgColor: cat ? cat.color : '#666',
          display: 'BYCLICK',
          textAlign: 'center'
        },
        label: {
          content: cat ? cat.letter : '?',
          color: '#ffffff',
          fontSize: 10,
          fontWeight: 'bold',
          anchorX: -6,
          anchorY: -18
        },
        _category: p.category,
        _color: cat ? cat.color : '#666',
        _place: p
      }
    })
  },

  // Re-cluster markers based on current zoom
  recluster() {
    if (!this._rawMarkers || this._rawMarkers.length === 0) return

    const activeCats = this.data.activeCategories
    let filtered = this._rawMarkers.filter(m => activeCats[m._category])

    if (this.data.searchText) {
      const key = this.data.searchText.toLowerCase()
      filtered = filtered.filter(m => {
        const p = m._place
        return p && (
          p.name.toLowerCase().includes(key) ||
          (p.address && p.address.toLowerCase().includes(key)) ||
          (p.note && p.note.toLowerCase().includes(key))
        )
      })
    }

    const clusterResult = clusterHelper.clusterMarkers(filtered, this.data.scale)
    const clusterStats = clusterHelper.getClusterStats(clusterResult)

    this.setData({
      markers: clusterResult.markers,
      clusterStats,
      showClusterHint: clusterStats.clusterCount > 0
    })
  },

  // Map region change (zoom/pan)
  onRegionChange(e) {
    if (e.type !== 'end') return

    // Update scale from region change
    if (e.detail && e.detail.scale) {
      const newScale = Math.round(e.detail.scale)
      if (newScale !== this.data.scale) {
        this.setData({ scale: newScale })
        // Throttle re-clustering
        if (this._clusterThrottle) clearTimeout(this._clusterThrottle)
        this._clusterThrottle = setTimeout(() => {
          this.recluster()
        }, 200)
      }
    }
  },

  // Build polyline
  buildPolyline(route) {
    if (!route || !route.timeline) return []

    const points = []
    route.timeline.forEach(item => {
      const matched = this.data.places.find(p =>
        p.name.includes(item.activity) || item.activity.includes(p.name)
      )
      if (matched) {
        points.push({ latitude: matched.lat, longitude: matched.lng })
      }
    })

    // 匹配到的真实地点 <2 个时，不画折线（避免随机虚拟坐标误导）
    if (points.length < 2) {
      return []
    }

    return [{
      points: points,
      color: route.color || '#4A90D9',
      width: 4,
      dottedLine: false,
      arrowLine: true,
      borderColor: '#ffffff',
      borderWidth: 1
    }]
  },

  toggleRoute() {
    if (this.data.routes.length === 0) {
      util.showToast('当前城市暂无路线数据')
      return
    }
    const showRoute = !this.data.showRoute
    let polyline = []
    if (showRoute) {
      const route = this.data.routes[this.data.routeIndex] || this.data.routes[0]
      polyline = this.buildPolyline(route)
      if (polyline.length === 0) {
        util.showToast('该路线部分节点暂未收录地图位置', 'none')
      }
    }
    this.setData({ showRoute, polyline })
  },

  switchRoute(e) {
    const idx = e.currentTarget.dataset.index || 0
    const route = this.data.routes[idx]
    if (!route) return

    const polyline = this.buildPolyline(route)
    this.setData({ routeIndex: idx, activeRouteId: route.id, polyline })

    if (this.mapCtx && polyline.length > 0) {
      this.mapCtx.includePoints({ points: polyline[0].points, padding: 80 })
    } else {
      util.showToast('该路线部分节点暂未收录地图位置', 'none')
    }
  },

  moveToLocation() {
    if (this.mapCtx) {
      wx.getLocation({
        type: 'gcj02',
        success: (res) => {
          this.mapCtx.moveToLocation({ latitude: res.latitude, longitude: res.longitude })
          util.showToast('已定位到当前位置', 'success')
        },
        fail: () => {
          const center = this.data.cityCenter
          this.mapCtx.moveToLocation(center)
          util.showToast('已回到城市中心')
        }
      })
    }
  },

  zoomIn() {
    const scale = Math.min(this.data.scale + 1, 20)
    this.setData({ scale })
    this.recluster()
  },

  zoomOut() {
    const scale = Math.max(this.data.scale - 1, 3)
    this.setData({ scale })
    this.recluster()
  },

  toggleCategory(e) {
    uiHelper.feedbackSwitch()
    const catId = e.currentTarget.dataset.cat
    const active = { ...this.data.activeCategories }
    active[catId] = !active[catId]
    this.filterPlaces(active)
  },

  toggleAll() {
    uiHelper.feedbackSwitch()
    const active = {}
    const allActive = Object.values(this.data.activeCategories).every(v => v)
    categories.CATEGORIES.forEach(c => { active[c.id] = !allActive })
    this.filterPlaces(active)
  },

  filterPlaces(activeCats) {
    let filtered = this.data.places.filter(p => activeCats[p.category])
    if (this.data.searchText) {
      const key = this.data.searchText.toLowerCase()
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(key) ||
        (p.address && p.address.toLowerCase().includes(key)) ||
        (p.note && p.note.toLowerCase().includes(key))
      )
    }
    const enriched = catHelper.enrichPlaces(filtered)

    // Re-cluster with filtered markers
    const filteredRaw = this._rawMarkers.filter(m => activeCats[m._category])
    const clusterResult = clusterHelper.clusterMarkers(filteredRaw, this.data.scale)
    const clusterStats = clusterHelper.getClusterStats(clusterResult)

    this.setData({
      activeCategories: activeCats,
      filteredPlaces: enriched,
      markers: clusterResult.markers,
      clusterStats,
      showClusterHint: clusterStats.clusterCount > 0
    })
  },

  onSearchInput(e) {
    const key = e.detail.value.trim()
    this.setData({ searchText: key })
    this.filterPlaces(this.data.activeCategories)
  },

  clearSearch() {
    this.setData({ searchText: '' })
    this.filterPlaces(this.data.activeCategories)
  },

  retryLoad() {
    if (this.data.currentCity) {
      this.loadData(true)
    }
  },

  // Marker tap - handle both cluster and individual markers
  onMarkerTap(e) {
    const markerId = e.markerId || e.detail.markerId

    // Check if it's a cluster marker
    const clusterMarker = this.data.markers.find(m => m.id === markerId && m._isCluster)
    if (clusterMarker) {
      uiHelper.feedbackSwitch()
      // Zoom in to show individual markers
      const target = clusterHelper.getZoomTarget(clusterMarker)
      if (target && this.mapCtx) {
        this.setData({ scale: target.scale })
        this.mapCtx.moveToLocation({
          latitude: target.latitude,
          longitude: target.longitude
        })
        // Re-cluster after zoom
        setTimeout(() => this.recluster(), 300)
      }
      return
    }

    // Individual marker - show detail
    const place = this.data.places.find(p => p.id === markerId)
    if (place) {
      uiHelper.feedbackSwitch()
      const enriched = catHelper.enrichPlace(place)
      enriched._extLink = uiHelper.getActivityLink(place)
      this.setData({ selectedPlace: enriched, showList: false })
    }
  },

  selectPlace(e) {
    const id = e.currentTarget.dataset.id
    const place = this.data.places.find(p => p.id === id)
    if (place) {
      uiHelper.feedbackSwitch()
      const enriched = catHelper.enrichPlace(place)
      enriched._extLink = uiHelper.getActivityLink(place)
      this.setData({ selectedPlace: enriched })
      if (this.mapCtx) {
        this.mapCtx.moveToLocation({ latitude: place.lat, longitude: place.lng })
      }
    }
  },

  navigateToPlace() {
    const place = this.data.selectedPlace
    if (!place) return
    wx.openLocation({
      latitude: place.lat,
      longitude: place.lng,
      name: place.name,
      address: place.address || '',
      scale: 16,
      fail: () => util.showToast('无法打开导航')
    })
  },

  closeDetail() {
    this.setData({ selectedPlace: null, showList: true })
  },

  openExternal() {
    const link = this.data.selectedPlace && this.data.selectedPlace._extLink
    if (link) {
      uiHelper.openExternalLink(link.url, link.name)
    }
  },

  toggleView() {
    this.setData({ showList: !this.data.showList })
  },

  selectCity() {
    wx.navigateTo({ url: '/pages/city-select/city-select' })
  },

  // Dismiss cluster hint
  dismissClusterHint() {
    this.setData({ showClusterHint: false })
  },

  onShareAppMessage() {
    const city = this.data.currentCity
    return {
      title: `${city ? city.name : '城市'}周末旅游地图 - ${this.data.filteredPlaces.length}个精选地点`,
      path: `/pages/map/map${city ? '?cityCode=' + city.code : ''}`
    }
  },

  onShareTimeline() {
    const city = this.data.currentCity
    return {
      title: `${city ? city.name : ''}周末旅游地图 - 周末城市游`,
      query: city ? 'cityCode=' + city.code : ''
    }
  }
})
