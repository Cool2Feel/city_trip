// pages/city-select/city-select.js - v3.0 触感反馈 + 异步加载
const api = require('../../utils/api.js')
const mockData = require('../../utils/mockData.js')
const util = require('../../utils/util.js')
const uiHelper = require('../../utils/uiHelper.js')

Page({
  data: {
    cities: [],
    filteredCities: [],
    hotCities: [],
    searchKey: '',
    currentCityCode: '',
    loading: true
  },

  async onLoad() {
    const app = getApp()
    try {
      const result = await api.getCities()
      const cities = result.data || []
      const hotCities = mockData.getHotCities()
      this.setData({
        cities,
        filteredCities: cities,
        hotCities,
        currentCityCode: app.globalData.currentCity ? app.globalData.currentCity.code : '',
        loading: false
      })
    } catch (e) {
      console.warn('[city-select] onLoad failed:', e.message)
      const cities = mockData.getCities()
      this.setData({
        cities,
        filteredCities: cities,
        hotCities: mockData.getHotCities(),
        currentCityCode: app.globalData.currentCity ? app.globalData.currentCity.code : '',
        loading: false
      })
    }
  },

  onSearchInput(e) {
    const key = e.detail.value.trim().toLowerCase()
    const filtered = key
      ? this.data.cities.filter(c =>
          c.name.includes(key) ||
          c.pinyin.toLowerCase().includes(key) ||
          c.province.includes(key)
        )
      : this.data.cities
    this.setData({ searchKey: key, filteredCities: filtered })
  },

  clearSearch() {
    uiHelper.feedbackSwitch()
    this.setData({ searchKey: '', filteredCities: this.data.cities })
  },

  selectCity(e) {
    uiHelper.feedbackSuccess()
    const code = e.currentTarget.dataset.code
    // 优先用 API 返回的城市对象（含服务端独有城市），mock 兜底
    const city = (this.data.filteredCities || []).find(c => c.code === code) || mockData.getCity(code)
    if (city) {
      const app = getApp()
      app.saveCurrentCity(city)
      if (!(this.data.filteredCities || []).find(c => c.code === code)) {
        wx.showToast({ title: '该城市详情暂缺，已加载基础信息', icon: 'none' })
      } else {
        wx.showToast({ title: '已选择' + city.name, icon: 'success' })
      }
      setTimeout(() => wx.navigateBack(), 500)
    } else {
      util.showToast('城市信息缺失，请重试', 'none')
    }
  },

  onShareAppMessage() {
    return {
      title: `周末城市游 - ${mockData.getCities().length}座城市周末深度攻略`,
      path: '/pages/home/home'
    }
  }
})
