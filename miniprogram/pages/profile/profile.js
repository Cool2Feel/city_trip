// pages/profile/profile.js - v2.0 含微信登录 + 足迹统计(A5) + 出行清单入口(A1)
const mockData = require('../../utils/mockData.js')
const util = require('../../utils/util.js')
const auth = require('../../utils/auth.js')
const userData = require('../../utils/userData.js')

Page({
  data: {
    favoriteCities: [],
    savedReports: [],
    totalReports: 0,
    totalCities: 20,
    totalPlaces: 0,
    menuItems: [],
    userInfo: null,
    isLogin: false,
    loginLoading: false,
    dataVersion: '7.2.0',
    footprint: { exploredCities: 0, wantCount: 0, doneCount: 0, totalMarks: 0 }
  },

  onLoad() {
    this.loadData()
  },

  onShow() {
    this.loadData()
  },

  async loadData() {
    const app = getApp()
    const favCities = app.globalData.favoriteCities || []

    // 获取已保存报告
    let savedReports = []
    try {
      savedReports = await auth.getSavedReports()
    } catch (e) {
      savedReports = app.globalData.savedReports || []
    }

    // 标记过期报告
    savedReports = savedReports.map(r => Object.assign({}, r, {
      reportExpired: util.isWeekendExpired(r)
    }))

    const favCityList = favCities.map(code => mockData.getCity(code)).filter(c => c)

    // 计算标记点总数
    let totalPlaces = 0
    const cities = mockData.getCities()
    cities.forEach(c => {
      const places = mockData.getPlaces(c.code)
      if (places) totalPlaces += places.length
    })

    // 用户信息
    const userInfo = auth.getUserInfo()
    const isLogin = auth.isLoggedIn()

    // 足迹统计（A5）
    const footprint = userData.getFootprintStats(favCities, savedReports)

    this.setData({
      favoriteCities: favCityList,
      savedReports,
      totalReports: savedReports.length,
      totalPlaces,
      totalCities: cities.length,
      userInfo,
      isLogin,
      dataVersion: app.globalData.dataVersion || '7.2.0',
      footprint,
      menuItems: [
        { icon: '\uD83D\uDCCB', name: '我的攻略', desc: `${savedReports.length} 份已保存`, action: 'reports' },
        { icon: '\u2B50', name: '收藏城市', desc: `${favCityList.length} 个城市`, action: 'favorites' },
        { icon: '\uD83D\uDEF4', name: '出行清单', desc: '周末随身物品清单', action: 'packing' },
        { icon: '\uD83D\uDDFA\uFE0F', name: '周末地图', desc: '查看城市游玩地图', action: 'map' },
        { icon: '\u2699\uFE0F', name: '设置', desc: '缓存、同步等', action: 'settings' },
        { icon: '\u2139\uFE0F', name: '关于', desc: '版本与说明', action: 'about' }
      ]
    })
  },

  // 微信登录：chooseAvatar 头像 + 昵称输入（替代已废弃的 getUserProfile）
  // 选中头像
  onChooseAvatar(e) {
    const tempPath = e.detail && e.detail.avatarUrl
    if (!tempPath) return
    const app = getApp()
    const userInfo = auth.saveUserInfo({ avatarUrl: tempPath })
    app.globalData.userInfo = userInfo
    app.globalData.loginStatus = true
    this.setData({ userInfo, isLogin: true })
  },

  // 昵称输入完成
  onNicknameInput(e) {
    const nickName = (e.detail && e.detail.value || '').trim()
    if (!nickName) return
    const app = getApp()
    const userInfo = auth.saveUserInfo({ nickName })
    app.globalData.userInfo = userInfo
    app.globalData.loginStatus = true
    this.setData({ userInfo, isLogin: true })
  },

  // 静默登录（wx.login 换取登录态，不弹授权）
  async handleLogin() {
    if (this.data.loginLoading) return
    this.setData({ loginLoading: true })
    try {
      await auth.ensureLogin()
      const app = getApp()
      app.globalData.loginStatus = true
      const userInfo = auth.getUserInfo()
      this.setData({ userInfo, isLogin: !!userInfo, loginLoading: false })
      if (userInfo) {
        util.showToast('登录成功', 'success')
      }
    } catch (e) {
      this.setData({ loginLoading: false })
      util.showToast('登录失败，请重试')
    }
  },

  // 选择城市
  selectCity(e) {
    const code = e.currentTarget.dataset.code
    const city = mockData.getCity(code)
    if (city) {
      const app = getApp()
      app.saveCurrentCity(city)
      wx.navigateTo({
        url: `/pages/report/report?cityCode=${code}`
      })
    }
  },

  // 取消收藏
  removeFavorite(e) {
    const code = e.currentTarget.dataset.code
    const app = getApp()
    app.toggleFavoriteCitySync(code)
    this.loadData()
    util.showToast('已取消收藏')
  },

  // 菜单点击
  onMenuTap(e) {
    const action = e.currentTarget.dataset.action
    switch (action) {
      case 'reports':
        this.showReports()
        break
      case 'favorites':
        if (this.data.favoriteCities.length > 0) {
          wx.pageScrollTo({ scrollTop: 0, duration: 300 })
        } else {
          util.showToast('还没有收藏城市，去首页收藏一个吧')
        }
        break
      case 'packing':
        wx.navigateTo({ url: '/pages/packing/packing' })
        break
      case 'map':
        wx.switchTab({ url: '/pages/map/map' })
        break
      case 'settings':
        this.showSettings()
        break
      case 'about':
        this.showAbout()
        break
    }
  },

  showReports() {
    if (this.data.savedReports.length === 0) {
      util.showToast('暂无已保存的攻略')
      return
    }
    const report = this.data.savedReports[0]
    wx.navigateTo({
      url: `/pages/report/report?cityCode=${report.cityCode}`
    })
  },

  // 打开指定保存的报告
  viewReport(e) {
    const code = e.currentTarget.dataset.code
    const report = this.data.savedReports.find(r => r.cityCode === code)
    if (report) {
      wx.navigateTo({
        url: `/pages/report/report?cityCode=${code}`
      })
    }
  },

  // 长按报告：确认后删除
  onReportLongPress(e) {
    const code = e.currentTarget.dataset.code
    if (!code) return
    this._confirmDeleteReport(code)
  },

  // 删除报告
  deleteReport(e) {
    const code = e.currentTarget.dataset.code
    if (!code) return
    this._confirmDeleteReport(code)
  },

  _confirmDeleteReport(code) {
    const app = getApp()
    util.showModal('删除攻略', '确定要删除这份保存的攻略吗？').then(confirm => {
      if (confirm) {
        app.deleteReportSync(code)
        this.loadData()
        util.showToast('已删除', 'success')
      }
    })
  },

  showSettings() {
    wx.showActionSheet({
      itemList: ['清除API缓存', '清除所有数据', '取消'],
      success: (res) => {
        if (res.tapIndex === 0) {
          const api = require('../../utils/api.js')
          api.clearAllCache()
          util.showToast('缓存已清除', 'success')
        } else if (res.tapIndex === 1) {
          this.clearCache()
        }
      }
    })
  },

  showAbout() {
    wx.showModal({
      title: '关于周末城市游',
      content: `版本 v${this.data.dataVersion}\n\n基于 GitHub 开源项目 weekend-city-trip 开发的微信小程序。\n\n核心功能：\n• ${this.data.totalCities}座城市深度调研\n• 11个方向全覆盖\n• 10节标准攻略\n• 3条周末路线\n• 路线地图折线+预算估算\n• 出行清单+足迹打卡\n• 原生地图+导航\n• 微信登录+云同步\n• 全页面分享\n\n出行前请二次确认关键信息。`,
      showCancel: false,
      confirmText: '知道了',
      confirmColor: '#4A90D9'
    })
  },

  // 清除缓存
  clearCache() {
    util.showModal('清除所有数据', '⚠️ 确定要清除所有本地数据吗？\n包括收藏城市、已保存攻略和登录信息。').then(confirm => {
      if (confirm) {
        wx.clearStorageSync()
        const app = getApp()
        app.globalData.favoriteCities = []
        app.globalData.savedReports = []
        app.globalData.currentCity = null
        app.globalData.userInfo = null
        auth.logout()
        this.loadData()
        util.showToast('已清除', 'success')
      }
    })
  },

  onShareAppMessage() {
    return {
      title: '周末城市游 - 一句话生成城市周末深度攻略',
      path: '/pages/home/home',
      imageUrl: '/assets/images/home-banner.jpg'
    }
  },

  onShareTimeline() {
    return {
      title: `周末城市游 - ${this.data.totalCities}座城市周末深度攻略`,
      query: ''
    }
  }
})
