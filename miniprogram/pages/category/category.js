// pages/category/category.js - v3.0 统一API + 数据来源 + 触感反馈
const api = require('../../utils/api.js')
const mockData = require('../../utils/mockData.js')
const categories = require('../../utils/categories.js')
const catHelper = require('../../utils/categoryHelper.js')
const uiHelper = require('../../utils/uiHelper.js')
const util = require('../../utils/util.js')

Page({
  data: {
    cityCode: '',
    catId: '',
    category: null,
    cityName: '',
    items: [],
    groupData: null,
    dataSource: '',
    dataUpdateTime: '',
    loading: true,
    isWeekendExpired: false
  },

  onLoad(options) {
    const catId = options.catId || 'concert'
    const cityCode = options.cityCode || 'guangzhou'
    const category = categories.getCategory(catId)
    const weekendOffset = Number(options.weekend) === 1 ? 1 : 0
    const preference = options.pref || ''
    this._weekendOffset = weekendOffset
    this._preference = preference
    this.setData({ catId, cityCode, category })
    this.loadData(cityCode, catId, category, weekendOffset, preference)
  },

  // 下拉刷新：强制拉取最新数据
  onPullDownRefresh() {
    if (!this.data.cityCode) {
      wx.stopPullDownRefresh()
      return
    }
    this.refreshCategory()
  },

  // 强制刷新分类数据
  async refreshCategory() {
    try {
      const result = await api.getReport(this.data.cityCode, true, { weekendOffset: this._weekendOffset, preference: this._preference })
      const report = result.data
      if (report) {
        const extracted = this._extractItems(report, this.data.catId)
        this.setData({
          items: extracted.items,
          groupData: extracted.groupData,
          isWeekendExpired: util.isWeekendExpired(report),
          dataUpdateTime: uiHelper.timeAgo(Date.now()),
          loading: false
        })
      }
      wx.stopPullDownRefresh()
    } catch (e) {
      wx.stopPullDownRefresh()
      util.showToast('刷新失败，请重试')
    }
  },

  // 从报告中抽取分类条目
  _extractItems(report, catId) {
    let items = []
    let groupData = null

    // 活动全清单中的分组
    const activitiesSection = report.sections.find(s => s.type === 'activities')
    if (activitiesSection && activitiesSection.groups) {
      const group = activitiesSection.groups.find(g => g.category === catId)
      if (group) {
        groupData = group
        items = group.items
      }
    }

    // 其他节中的数据
    if (items.length === 0) {
      const matchingSection = report.sections.find(s => s.type === catId)
      if (matchingSection && matchingSection.items) {
        items = matchingSection.items
      }
    }

    // 地铁
    if (catId === 'metro') {
      const metroSection = report.sections.find(s => s.type === 'metro')
      if (metroSection) {
        items = metroSection.keyStations || []
      }
    }

    // 优惠门票：标记已过期，与报告页角标保持一致
    if (catId === 'ticket' && items.length) {
      items = items.map(it => Object.assign({}, it, { _expired: util.isExpiryPassed(it.expiry) }))
    }

    // 信息有限标注：条目过少 → 提示信息不足，建议出发前核实（与报告页规则一致）
    if (groupData) {
      groupData._infoLimited = !!(items && items.length < 3)
    }

    return { items, groupData }
  },

  async loadData(cityCode, catId, category, weekendOffset = 0, preference = '') {
    try {
      const result = await api.getReport(cityCode, false, { weekendOffset, preference })
      const report = result.data
      const city = mockData.getCity(cityCode)

      if (!report) {
        this.setData({ loading: false })
        return
      }

      const extracted = this._extractItems(report, catId)

      this.setData({
        cityName: city ? city.name : '',
        items: extracted.items,
        groupData: extracted.groupData,
        dataSource: result.source,
        isWeekendExpired: util.isWeekendExpired(report),
        dataUpdateTime: uiHelper.timeAgo(Date.now()),
        loading: false
      })

      wx.setNavigationBarTitle({ title: (category ? category.name : '') + ' - ' + (city ? city.name : '') })
    } catch (e) {
      console.warn('[category] loadData failed:', e.message)
      this.setData({ loading: false })
    }
  },

  // 打开外链
  openExternal(e) {
    uiHelper.feedbackSwitch()
    const name = e.currentTarget.dataset.name || ''
    if (!name) return
    let link = uiHelper.getActivityLink({ name, category: this.data.catId })
    // getActivityLink 未覆盖的类别退化为通用搜索
    if (!link) {
      link = { url: `https://www.baidu.com/s?wd=${encodeURIComponent(name)}`, name: '百度搜索' }
    }
    uiHelper.openExternalLink(link.url, link.name || name)
  },

  // 在地图查看该分类地点
  goMap() {
    uiHelper.feedbackSwitch()
    if (!this.data.cityCode) return
    wx.switchTab({ url: '/pages/map/map' })
  },

  onShareAppMessage() {
    const cat = this.data.category
    const city = this.data.cityName
    return {
      title: city + (cat ? cat.name : '') + '推荐 - 周末城市游',
      path: '/pages/category/category?cityCode=' + this.data.cityCode + '&catId=' + this.data.catId
    }
  }
})
