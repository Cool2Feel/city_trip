// pages/discover/discover.js - v6.0 内容流：与首页总览互补，聚焦精选推荐
const api = require('../../utils/api.js')
const mockData = require('../../utils/mockData.js')
const util = require('../../utils/util.js')
const uiHelper = require('../../utils/uiHelper.js')
const categories = require('../../utils/categories.js')

Page({
  data: {
    currentCity: null,
    report: null,
    feeds: [],
    themePicks: [],
    isWeekendExpired: false,
    isGenerated: false,
    loading: false,
    isRegenerating: false,
    genSteps: [],
    totalSteps: 10
  },

  onLoad(options) {
    // 分享回流：带 cityCode 时切到对应城市
    if (options && options.cityCode) {
      const city = mockData.getCity(options.cityCode)
      if (city) {
        const app = getApp()
        app.saveCurrentCity(city)
      }
    }
    this.loadData()
  },

  onShow() {
    // 仅当城市变化时重载，避免从子页面返回时重复请求
    const app = getApp()
    const city = app.globalData.currentCity
    if (city && this._lastCityCode !== city.code) {
      this.loadData()
    }
  },

  loadData(forceRefresh = false) {
    const app = getApp()
    const city = app.globalData.currentCity
    if (city) {
      this._lastCityCode = city.code
      // v6.0: 统一走 API 层，构建内容流；forceRefresh 用于"重新生成"时绕过缓存
      this.setData({ loading: true })
      api.getReport(city.code, forceRefresh).then(result => {
        const report = result.data
        if (report) {
          const feeds = this._buildFeeds(report)
          this.setData({
            currentCity: city,
            report,
            feeds,
            themePicks: this._buildThemePicks(report, feeds),
            isWeekendExpired: util.isWeekendExpired(report),
            isGenerated: true,
            loading: false,
            isRegenerating: false
          })
        } else {
          this.setData({ currentCity: city, isGenerated: false, loading: false, isRegenerating: false })
        }
      }).catch(e => {
        console.warn('[discover] loadData failed:', e.message)
        this.setData({ currentCity: city, isGenerated: false, loading: false, isRegenerating: false })
      })
    }
  },

  // 攻略过期：强制刷新
  refreshDiscover() {
    const city = this.data.currentCity
    if (!city) return
    uiHelper.feedbackSwitch()
    util.showToast('正在刷新最新攻略...', 'none')
    this.loadData(true)
  },

  // 从报告构建分类精选流（每类取前3条）
  _buildFeeds(report) {
    const feeds = []
    const activitiesSection = report.sections.find(s => s.type === 'activities')
    const groups = activitiesSection ? activitiesSection.groups : []

    const preferred = ['concert', 'market', 'museum', 'scenic']
    groups.forEach(g => {
      if (!preferred.includes(g.category) || !g.items || !g.items.length) return
      const cat = categories.getCategory(g.category)
      feeds.push({
        category: g.category,
        name: cat ? cat.fullName : g.name,
        icon: cat ? cat.icon : '📌',
        color: cat ? cat.color : '#666',
        items: g.items.slice(0, 3).map(it => ({
          name: it.name,
          time: it.time,
          venue: it.venue,
          price: it.price
        }))
      })
    })

    const extraTypes = [
      { type: 'food', catId: 'food' },
      { type: 'walk', catId: 'walk' },
      { type: 'ticket', catId: 'ticket' },
      { type: 'tea', catId: 'tea' }
    ]
    extraTypes.forEach(et => {
      const section = report.sections.find(s => s.type === et.type)
      if (!section || !section.items || !section.items.length) return
      const cat = categories.getCategory(et.catId)
      feeds.push({
        category: et.catId,
        name: cat ? cat.fullName : section.title,
        icon: cat ? cat.icon : '📌',
        color: cat ? cat.color : '#666',
        items: section.items.slice(0, 3).map(it => ({
          name: it.name,
          address: it.address,
          price: it.price,
          desc: it.desc
        }))
      })
    })

    return feeds
  },

  // 主题精选：从演出/市集/美食/CityWalk 各取第一条，横向卡片展示
  _buildThemePicks(report, feeds) {
    const themeOrder = ['concert', 'market', 'food', 'walk']
    const themeLabel = {
      concert: '演出',
      market: '市集',
      food: '美食',
      walk: 'CityWalk'
    }
    const picks = []
    themeOrder.forEach(id => {
      const feed = feeds.find(f => f.category === id)
      if (!feed || !feed.items.length) return
      const first = feed.items[0]
      picks.push({
        category: id,
        label: themeLabel[id] || feed.name,
        icon: feed.icon,
        color: feed.color,
        name: first.name,
        meta: first.time || first.address || '',
        price: first.price || ''
      })
    })
    return picks
  },

  // 选择城市
  selectCity() {
    wx.navigateTo({ url: '/pages/city-select/city-select' })
  },

  // 加载/重试生成攻略（真实 API，无模拟动画）
  generateReport() {
    if (!this.data.currentCity) {
      util.showToast('请先选择城市')
      return
    }
    uiHelper.feedbackSuccess()
    this.loadData()
  },

  // 查看完整攻略
  viewReport() {
    if (!this.data.currentCity) return
    wx.navigateTo({
      url: `/pages/report/report?cityCode=${this.data.currentCity.code}`
    })
  },

  // 查看路线
  viewRoutes() {
    if (!this.data.currentCity) return
    wx.navigateTo({
      url: `/pages/route/route?cityCode=${this.data.currentCity.code}`
    })
  },

  // 查看地图
  viewMap() {
    wx.switchTab({ url: '/pages/map/map' })
  },

  // 查看分类详情
  viewCategory(e) {
    const cat = e.currentTarget.dataset.cat
    if (!this.data.currentCity || !cat) return
    wx.navigateTo({
      url: `/pages/category/category?cityCode=${this.data.currentCity.code}&catId=${cat}`
    })
  },

  // 点击精选条目 → 进入对应分类详情
  onActivityTap(e) {
    const cat = e.currentTarget.dataset.cat
    if (!cat) return
    uiHelper.feedbackSwitch()
    this.viewCategory(e)
  },

  // 重新生成：先播放调研工作流动画，再强制刷新数据
  regenerate() {
    util.showModal('重新生成', '确定要强制刷新最新攻略数据吗？').then(confirm => {
      if (confirm) {
        uiHelper.feedbackSuccess()
        const steps = (this.data.report && this.data.report.workflow) || []
        this.setData({
          isRegenerating: true,
          genSteps: [],
          totalSteps: steps.length || 10
        })
        this._playGenSteps(steps, () => {
          this.loadData(true)
        })
      }
    })
  },

  // 逐步骤推进生成进度动画（每步 130ms）
  _playGenSteps(steps, done) {
    if (this._genTimer) clearTimeout(this._genTimer)
    this._genTimer = null
    let i = 0
    const tick = () => {
      if (i >= steps.length) {
        done && done()
        return
      }
      this.setData({ genSteps: steps.slice(0, i + 1) })
      i++
      this._genTimer = setTimeout(tick, 130)
    }
    tick()
  },

  onUnload() {
    if (this._genTimer) clearTimeout(this._genTimer)
    this._genTimer = null
  },

  onShareAppMessage() {
    const city = this.data.currentCity
    const query = city ? `cityCode=${city.code}` : ''
    return {
      title: `${city ? city.name : '城市'}周末精选 | 演出·市集·美食 一网打尽`,
      path: `/pages/discover/discover${query ? '?' + query : ''}`
    }
  },

  onShareTimeline() {
    const city = this.data.currentCity
    return {
      title: `${city ? city.name + '周末精选' : '周末城市游'} - 演出·市集·美食 一网打尽`,
      query: city ? `cityCode=${city.code}` : ''
    }
  }
})
