// pages/home/home.js - v5.0 用户语言优先 + SWR自动刷新
const api = require('../../utils/api.js')
const mockData = require('../../utils/mockData.js')
const util = require('../../utils/util.js')
const uiHelper = require('../../utils/uiHelper.js')

Page({
  data: {
    currentCity: null,
    weekendDate: null,
    hotCities: [],
    report: null,
    loading: true,
    isFavorite: false,
    statusBarHeight: 20,
    dataSource: '',
    dataUpdateTime: '',
    weather: null,
    isStale: false,
    isWeekendExpired: false,
    loadError: false,
    cityCount: 19
  },

  onLoad(options) {
    const app = getApp()
    this.setData({ statusBarHeight: app.globalData.statusBarHeight, cityCount: mockData.getCities().length })
    // 分享回流：带 cityCode 时切到对应城市
    if (options && options.cityCode) {
      const city = mockData.getCity(options.cityCode)
      if (city) app.saveCurrentCity(city)
    }
    this.loadData()
  },

  onPullDownRefresh() {
    const app = getApp()
    // 下拉刷新：强制拉取最新攻略与热门城市（语义明确）
    if (app.globalData.currentCity) {
      this.loadReport(app.globalData.currentCity.code, true)
    } else {
      this.loadData()
    }
    api.getHotCities().then(result => {
      if (result && result.data) {
        this.setData({ hotCities: result.data })
      }
    }).catch(() => {})
    setTimeout(() => wx.stopPullDownRefresh(), 600)
  },

  onShow() {
    // 仅当城市变化时重载，避免从子页面返回时重复请求
    const app = getApp()
    const city = app.globalData.currentCity
    if (city && this._lastCityCode !== city.code) {
      this.setData({ currentCity: city })
      const isFav = app.globalData.favoriteCities.includes(city.code)
      this.setData({ isFavorite: isFav })
      this.loadReport(city.code)
    } else if (!city && this.data.currentCity) {
      // 清除数据后：重置回"未选城市"初始态
      this._lastCityCode = null
      this.setData({
        currentCity: null,
        report: null,
        weather: null,
        isFavorite: false,
        isWeekendExpired: false,
        loadError: false
      })
    }
  },

  loadData() {
    const app = getApp()
    const weekend = util.getWeekendDate()

    api.getHotCities().then(result => {
      this.setData({ hotCities: result.data || mockData.getHotCities() })
    }).catch(() => {
      this.setData({ hotCities: mockData.getHotCities() })
    })

    if (app.globalData.currentCity) {
      const isFav = app.globalData.favoriteCities.includes(app.globalData.currentCity.code)
      this._lastCityCode = app.globalData.currentCity.code
      this.setData({
        currentCity: app.globalData.currentCity,
        weekendDate: weekend,
        isFavorite: isFav,
        loading: false
      })
      this.loadReport(app.globalData.currentCity.code)
    } else {
      this.setData({
        weekendDate: weekend,
        loading: false
      })
    }
  },

  loadReport(cityCode, forceRefresh = false) {
    // v5.0: SWR自动刷新，无需用户手动操作
    this.setData({ loadError: false })
    api.getReport(cityCode, forceRefresh).then(result => {
      const report = result.data
      if (report) {
        const isWeekendExpired = util.isWeekendExpired(report)
        this.setData({
          report,
          dataSource: result.source,
          isStale: result.stale || false,
          isWeekendExpired,
          dataUpdateTime: uiHelper.timeAgo(Date.now())
        })
        // SWR: 如果数据过期，后台自动刷新，用户无需操作
        if (result.stale) {
          // 过期数据自动后台刷新，刷新完成后更新时间
          api.getReport(cityCode, true).then(freshResult => {
            if (freshResult && freshResult.data) {
              this.setData({
                report: freshResult.data,
                isStale: false,
                isWeekendExpired: util.isWeekendExpired(freshResult.data),
                dataUpdateTime: uiHelper.timeAgo(Date.now())
              })
            }
          }).catch(() => {})
        }
      } else {
        this.setData({ loadError: true })
      }
    }).catch(e => {
      console.warn('[home] loadReport failed:', e.message)
      this.setData({ loadError: true })
    })

    api.getWeather(cityCode).then(result => {
      if (result.data) {
        this.setData({ weather: result.data })
      }
    }).catch(() => {})
  },

  // 攻略加载失败：重试
  retryLoadReport() {
    if (!this.data.currentCity) return
    uiHelper.feedbackSwitch()
    this.loadReport(this.data.currentCity.code)
  },

  // 攻略过期：强制刷新最新数据
  refreshReport() {
    if (!this.data.currentCity) return
    uiHelper.feedbackSwitch()
    util.showToast('正在刷新最新攻略...', 'none')
    api.getReport(this.data.currentCity.code, true).then(result => {
      if (result && result.data) {
        this.setData({
          report: result.data,
          isWeekendExpired: util.isWeekendExpired(result.data),
          dataUpdateTime: uiHelper.timeAgo(Date.now())
        })
        uiHelper.feedbackSuccess()
        util.showToast('攻略已更新', 'success')
      } else {
        util.showToast('刷新失败，请重试')
      }
    }).catch(() => {
      util.showToast('刷新失败，请重试')
    })
  },

  // 全局搜索
  openSearch() {
    uiHelper.feedbackSwitch()
    wx.navigateTo({ url: '/pages/search/search' })
  },

  // 选择城市
  selectCity() {
    wx.navigateTo({ url: '/pages/city-select/city-select' })
  },

  // 快速选择热门城市
  quickSelectCity(e) {
    const code = e.currentTarget.dataset.code
    const city = mockData.getCity(code)
    if (city) {
      uiHelper.feedbackSwitch()
      const app = getApp()
      app.saveCurrentCity(city)
      const isFav = app.globalData.favoriteCities.includes(city.code)
      this._lastCityCode = city.code
      this.setData({ currentCity: city, isFavorite: isFav, loadError: false })
      this.loadReport(code)
      util.showToast('已切换到' + city.name, 'success')
    }
  },

  // 查看报告
  viewReport() {
    if (!this.data.currentCity) {
      util.showToast('请先选择城市', 'none')
      return
    }
    wx.navigateTo({
      url: `/pages/report/report?cityCode=${this.data.currentCity.code}`
    })
  },

  // 查看地图
  viewMap() {
    if (!this.data.currentCity) {
      util.showToast('请先选择城市', 'none')
      return
    }
    wx.switchTab({ url: '/pages/map/map' })
  },

  // 查看路线
  viewRoutes() {
    if (!this.data.currentCity) return
    wx.navigateTo({
      url: `/pages/route/route?cityCode=${this.data.currentCity.code}`
    })
  },

  // 查看分类
  viewCategory(e) {
    const cat = e.currentTarget.dataset.cat
    if (!this.data.currentCity) {
      util.showToast('请先选择城市', 'none')
      return
    }
    wx.navigateTo({
      url: `/pages/category/category?cityCode=${this.data.currentCity.code}&catId=${cat}`
    })
  },

  // 收藏城市
  toggleFavorite() {
    if (!this.data.currentCity) return
    uiHelper.feedbackSuccess()
    const app = getApp()
    const isFav = app.toggleFavoriteCitySync(this.data.currentCity.code)
    util.showToast(isFav ? '已收藏' : '已取消收藏', isFav ? 'success' : 'none')
    this.setData({ isFavorite: isFav })
  },

  onShareAppMessage() {
    const city = this.data.currentCity
    const query = city ? `cityCode=${city.code}` : ''
    return {
      title: `${city ? city.name : '城市'}周末游攻略 | 演出·市集·美食·CityWalk 一站式规划`,
      path: `/pages/home/home${query ? '?' + query : ''}`,
      imageUrl: '/assets/images/home-banner.jpg'
    }
  },

  onShareTimeline() {
    const city = this.data.currentCity
    return {
      title: `${city ? city.name + '周末游' : '周末城市游'} - 一句话生成城市深度攻略`,
      query: city ? `cityCode=${city.code}` : '',
      imageUrl: '/assets/images/home-banner.jpg'
    }
  }
})
