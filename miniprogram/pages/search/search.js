// pages/search/search.js - 跨城市内容搜索
const api = require('../../utils/api.js')
const mockData = require('../../utils/mockData.js')
const uiHelper = require('../../utils/uiHelper.js')
const util = require('../../utils/util.js')

const HISTORY_KEY = 'search_history'
const HISTORY_MAX = 8

Page({
  data: {
    keyword: '',
    results: [],
    searching: false,
    searched: false,
    searchError: false,
    total: 0,
    autoFocus: true,
    cityCount: 19,
    history: [],
    hotKeywords: ['演唱会', '音乐节', '市集', '博物馆', '美食街', 'City Walk']
  },

  onLoad(options) {
    this.setData({
      cityCount: mockData.getCities().length,
      history: this._loadHistory()
    })
    const kw = (options.q || '').trim()
    if (kw) {
      this.setData({ keyword: kw, autoFocus: false })
      this.doSearch(kw)
    }
  },

  onInput(e) {
    this.setData({ keyword: e.detail.value })
  },

  clearSearch() {
    this.setData({ keyword: '', results: [], searched: false, total: 0 })
  },

  onConfirm() {
    const kw = this.data.keyword.trim()
    if (!kw) {
      util.showToast('请输入搜索内容', 'none')
      return
    }
    this.doSearch(kw)
  },

  onHotTap(e) {
    const kw = e.currentTarget.dataset.kw
    this.setData({ keyword: kw })
    this.doSearch(kw)
  },

  async doSearch(keyword) {
    if (!keyword) return
    this.setData({ searching: true, searchError: false })
    try {
      const result = await api.searchContent(keyword)
      const results = (result.data || []).map(g => Object.assign({}, g, {
        _key: g.cityCode + '_' + g.category
      }))
      this.setData({
        results,
        searching: false,
        searched: true,
        total: results.reduce((sum, g) => sum + (g.items || []).length, 0),
        history: this._saveHistory(keyword)
      })
    } catch (e) {
      console.warn('[search] doSearch failed:', e.message)
      this.setData({ searching: false, searched: true, searchError: true })
      util.showToast('搜索失败，请重试')
    }
  },

  // 搜索失败：重试
  retrySearch() {
    const kw = this.data.keyword.trim()
    if (!kw) return
    uiHelper.feedbackSwitch()
    this.doSearch(kw)
  },

  // 点击历史词直达搜索
  onHistoryTap(e) {
    const kw = e.currentTarget.dataset.kw
    if (!kw) return
    this.setData({ keyword: kw, autoFocus: false })
    this.doSearch(kw)
  },

  // 单条删除历史
  removeHistory(e) {
    const kw = e.currentTarget.dataset.kw
    const h = this._loadHistory().filter(k => k !== kw)
    wx.setStorageSync(HISTORY_KEY, h)
    this.setData({ history: h })
  },

  // 一键清空历史
  clearHistory() {
    wx.removeStorageSync(HISTORY_KEY)
    this.setData({ history: [] })
  },

  _loadHistory() {
    const h = wx.getStorageSync(HISTORY_KEY)
    return Array.isArray(h) ? h : []
  },

  _saveHistory(kw) {
    let h = this._loadHistory().filter(k => k !== kw)
    h.unshift(kw)
    if (h.length > HISTORY_MAX) h = h.slice(0, HISTORY_MAX)
    wx.setStorageSync(HISTORY_KEY, h)
    return h
  },

  openResult(e) {
    uiHelper.feedbackSwitch()
    const cityCode = e.currentTarget.dataset.cityCode
    const catId = e.currentTarget.dataset.catId
    if (!cityCode || !catId) return
    // 联动全局城市：首页/地图/发现页上下文跟随
    const app = getApp()
    const city = mockData.getCity(cityCode)
    if (city) {
      app.saveCurrentCity(city)
    }
    wx.navigateTo({ url: `/pages/category/category?cityCode=${cityCode}&catId=${catId}` })
  }
})
