// app.js - 周末城市游小程序 v7.0
// v7.0: 全站用户体验优化（语言用户化/时效感知/内容流/跨城市搜索/离线可用/分享回流）

const api = require('./utils/api.js')
const auth = require('./utils/auth.js')

App({
  globalData: {
    currentCity: null,
    currentReport: null,
    apiCallCount: 0,
    userInfo: null,
    favoriteCities: [],
    savedReports: [],
    theme: 'light',
    statusBarHeight: 20,
    windowHeight: 667,
    windowWidth: 375,
    platform: 'devtools',
    // 新增
    dataVersion: '7.7.0',
    cloudReady: false,
    loginStatus: false
  },

  onLaunch() {
    // 初始化系统信息
    const sysInfo = wx.getSystemInfoSync()
    this.globalData.statusBarHeight = sysInfo.statusBarHeight
    this.globalData.windowHeight = sysInfo.windowHeight
    this.globalData.windowWidth = sysInfo.windowWidth
    this.globalData.platform = sysInfo.platform

    // 写入数据包版本，供 api.js 缓存键绑定（数据更新后自动失效各城市缓存）
    try { wx.setStorageSync('api_data_version', this.globalData.dataVersion) } catch (e) {}

    // 恢复本地数据
    this.restoreLocalData()

    // 静默登录
    this.silentLogin()

    // 初始化云开发（如果配置了）
    // 实际使用时需要填入云环境 ID
    // this.initCloud('your-cloud-env-id')

    console.log('[App] 周末城市游 v7.1.0 launched')
  },

  // 恢复本地存储数据
  restoreLocalData() {
    const savedCity = wx.getStorageSync('currentCity')
    if (savedCity) this.globalData.currentCity = savedCity

    const favCities = wx.getStorageSync('favoriteCities')
    if (favCities) this.globalData.favoriteCities = favCities

    const savedReports = wx.getStorageSync('savedReports')
    if (savedReports) this.globalData.savedReports = savedReports

    // 恢复用户信息
    const userInfo = auth.getUserInfo()
    if (userInfo) this.globalData.userInfo = userInfo

    this.globalData.loginStatus = auth.isLoggedIn()
  },

  // 静默登录
  async silentLogin() {
    try {
      await auth.login()
      this.globalData.loginStatus = true
      console.log('[App] Silent login success')
    } catch (e) {
      console.warn('[App] Silent login failed:', e.message)
    }
  },

  // 初始化云开发
  initCloud(envId) {
    const ok = api.initCloud(envId)
    if (ok) {
      this.globalData.cloudReady = true
      auth.enableSync(true)
      console.log('[App] Cloud sync enabled')
    }
    return ok
  },

  // ===== 城市管理 =====
  saveCurrentCity(city) {
    this.globalData.currentCity = city
    wx.setStorageSync('currentCity', city)

    // 预加载城市数据
    api.preloadCity(city.code)
  },

  // ===== 收藏管理（支持云同步）=====
  async toggleFavoriteCity(cityCode) {
    const isFav = await auth.toggleFavoriteCity(cityCode)
    // 更新本地缓存
    this.globalData.favoriteCities = auth.getLocalFavorites ? auth.getLocalFavorites() : []
    return isFav
  },

  isFavorite(cityCode) {
    return auth.isFavorite(cityCode)
  },

  // ===== 报告管理（支持云同步）=====
  async saveReport(report) {
    await auth.saveReport(report)
    // 更新本地缓存
    auth.getSavedReports().then(reports => {
      this.globalData.savedReports = reports
    })
  },

  async deleteReport(cityCode) {
    await auth.deleteReport(cityCode)
    auth.getSavedReports().then(reports => {
      this.globalData.savedReports = reports
    })
  },

  // ===== 用户信息 =====
  async getUserProfile(desc) {
    try {
      const userInfo = await auth.getUserProfile(desc)
      this.globalData.userInfo = userInfo
      return userInfo
    } catch (e) {
      console.warn('[App] getUserProfile failed:', e.message)
      throw e
    }
  },

  // ===== 兼容旧接口（保持向后兼容）=====
  // 旧版同步方法，供未改造的页面使用
  toggleFavoriteCitySync(cityCode) {
    const list = this.globalData.favoriteCities
    const idx = list.indexOf(cityCode)
    if (idx > -1) {
      list.splice(idx, 1)
    } else {
      list.push(cityCode)
    }
    wx.setStorageSync('favoriteCities', list)

    // 异步云同步
    if (auth.isSyncEnabled()) {
      auth.toggleFavoriteCity(cityCode).catch(() => {})
    }

    return idx === -1
  },

  saveReportSync(report) {
    const reports = this.globalData.savedReports
    const existIdx = reports.findIndex(r => r.cityCode === report.cityCode)
    if (existIdx > -1) {
      reports[existIdx] = report
    } else {
      reports.unshift(report)
    }
    wx.setStorageSync('savedReports', reports)

    // 异步云同步
    if (auth.isSyncEnabled()) {
      auth.saveReport(report).catch(() => {})
    }
  },

  deleteReportSync(cityCode) {
    const reports = this.globalData.savedReports.filter(r => r.cityCode !== cityCode)
    this.globalData.savedReports = reports
    wx.setStorageSync('savedReports', reports)

    if (auth.isSyncEnabled()) {
      auth.deleteReport(cityCode).catch(() => {})
    }
  }
})
