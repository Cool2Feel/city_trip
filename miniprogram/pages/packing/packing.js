// pages/packing/packing.js - A1 出行清单（借鉴 TREK Packing Lists，做减法）
const userData = require('../../utils/userData.js')
const util = require('../../utils/util.js')

Page({
  data: {
    cityName: '',
    groups: [],
    progress: { total: 0, checked: 0, percent: 0 },
    newItem: '',
    showAdd: false
  },

  onLoad(options) {
    const cityName = (options && options.cityName) ? decodeURIComponent(options.cityName) : ''
    this.setData({ cityName })
    this.reload()
  },

  onShow() {
    this.reload()
  },

  // 重新加载清单并按分类分组
  reload() {
    const p = userData.getPacking()
    const order = []
    const map = {}
    userData.PACKING_TEMPLATE.forEach(g => {
      if (!map[g.cat]) { map[g.cat] = { cat: g.cat, icon: g.icon, items: [] }; order.push(g.cat) }
    })
    p.items.forEach(it => {
      if (!map[it.cat]) { map[it.cat] = { cat: it.cat, icon: '📦', items: [] }; order.push(it.cat) }
      map[it.cat].items.push(it)
    })
    const groups = order.map(c => map[c])
    const progress = userData.getPackingProgress(p)
    this.setData({ groups, progress })
  },

  // 切换勾选
  toggleItem(e) {
    const id = e.currentTarget.dataset.id
    userData.togglePackingItem(id)
    this.reload()
  },

  // 打开/关闭自定义添加
  toggleAdd() {
    this.setData({ showAdd: !this.data.showAdd, newItem: '' })
  },

  onNewInput(e) {
    this.setData({ newItem: e.detail.value })
  },

  // 添加自定义项
  addItem() {
    const text = (this.data.newItem || '').trim()
    if (!text) {
      util.showToast('请输入物品名称')
      return
    }
    userData.addPackingItem(text)
    this.setData({ newItem: '', showAdd: false })
    this.reload()
    util.showToast('已添加', 'success')
  },

  // 删除项
  removeItem(e) {
    const id = e.currentTarget.dataset.id
    userData.removePackingItem(id)
    this.reload()
  },

  // 重置为默认模板
  resetAll() {
    util.showModal('重置清单', '确定要清空当前勾选与自定义项，恢复默认清单吗？').then(confirm => {
      if (confirm) {
        userData.resetPacking()
        this.setData({ showAdd: false, newItem: '' })
        this.reload()
        util.showToast('已重置', 'success')
      }
    })
  },

  noop() {},

  onShareAppMessage() {
    return {
      title: '我的周末出行清单 - 周末城市游',
      path: '/pages/packing/packing',
      imageUrl: '/assets/images/home-banner.jpg'
    }
  }
})
