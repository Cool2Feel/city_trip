// pages/report/report.js - v7.1 用户语言优先 + 活动联动 + 时效性 + 海报 + 周末/偏好进阶
const api = require('../../utils/api.js')
const mockData = require('../../utils/mockData.js')
const catHelper = require('../../utils/categoryHelper.js')
const categories = require('../../utils/categories.js')
const util = require('../../utils/util.js')
const uiHelper = require('../../utils/uiHelper.js')
const userData = require('../../utils/userData.js')

const WEEKEND_OPTIONS = [
  { value: 0, label: '本周末' },
  { value: 1, label: '下周末' }
]
const PREFERENCE_OPTIONS = [
  { value: '', label: '通用' },
  { value: 'family', label: '亲子' },
  { value: 'couple', label: '情侣' },
  { value: 'art', label: '文艺' },
  { value: 'food', label: '吃货' }
]

Page({
  data: {
    cityCode: '',
    cityName: '',
    report: null,
    aiGenerated: false,
    statsData: null,
    activeSection: 0,
    expandedSections: {},
    sources: [],
    dataSource: '',
    dataUpdateTime: '',
    showQuickNav: false,
    showMore: false,
    qualityCheck: null,
    qualityHasLimited: false,
    showQuality: false,
    loading: true,
    loadError: false,
    places: [],
    expandedProcess: false,
    isWeekendExpired: false,
    refreshing: false,
    weekendOffset: 0,
    preference: '',
    weekendOptions: WEEKEND_OPTIONS,
    preferenceOptions: PREFERENCE_OPTIONS,
    freshnessLabel: '',
    dataVersion: '',
    bakedAt: '',
    authSource: 'bundled',
    showBackTop: false,
    // 新增：个人标记（A3）
    marksSummary: { want: 0, done: 0 },
    markMap: {},
    markPanel: { visible: false, list: [] }
  },

  onLoad(options) {
    const cityCode = options.cityCode || 'guangzhou'
    const weekendOffset = Number(options.weekend) === 1 ? 1 : 0
    const preference = options.pref || ''
    this.loadReport(cityCode, weekendOffset, preference)
  },

  // 下拉刷新：强制拉取最新数据
  onPullDownRefresh() {
    const code = this.data.cityCode
    if (!code) {
      wx.stopPullDownRefresh()
      return
    }
    api.getReport(code, true, { weekendOffset: this.data.weekendOffset, preference: this.data.preference }).then(result => {
      if (result && result.data) {
        const enriched = this._enrichReport(result.data)
        result.data.sections = enriched.sections
        this.setData({
          report: result.data,
          aiGenerated: !!(result.data && result.data.aiGenerated),
          statsData: enriched.statsData,
          qualityCheck: result.data.qualityCheck || null,
          qualityHasLimited: enriched.qualityHasLimited,
          sources: this._enrichSources(result.data.sources || []),
          isWeekendExpired: this._isReportExpired(result.data, this.data.weekendOffset),
          dataUpdateTime: uiHelper.timeAgo(result.fetchedAt || Date.now()),
          dataSourceLabel: this._dataSourceLabel(result.source, result.stale),
          dataVersion: api.getDataVersion(),
          bakedAt: (result.data && result.data.bakedAt) || '',
          authSource: (result.data && result.data.authSource) || 'bundled'
        })
        this._refreshMarks()
      }
      wx.stopPullDownRefresh()
    }).catch(() => {
      wx.stopPullDownRefresh()
      util.showToast('刷新失败，请重试')
    })
  },

  // 页面滚动：滚动超过阈值显示返回顶部
  onPageScroll(e) {
    const scrollTop = e && e.scrollTop ? e.scrollTop : 0
    if (scrollTop > 600 && !this.data.showBackTop) {
      this.setData({ showBackTop: true })
    } else if (scrollTop <= 600 && this.data.showBackTop) {
      this.setData({ showBackTop: false })
    }
  },

  // 返回顶部
  backToTop() {
    wx.pageScrollTo({ scrollTop: 0, duration: 300 })
  },

  // 数据来源中文标签（诚实区分「实时」与「缓存/打包」）
  _dataSourceLabel(source, stale) {
    if (source === 'api') return '实时API'
    if (source === 'cloud') return '云端同步'
    if (source === 'mock') return '本地打包'
    if (source === 'cache') return stale ? '本地缓存(可能非最新)' : '本地缓存'
    return '未知来源'
  },

  async loadReport(cityCode, weekendOffset = 0, preference = '') {
    try {
      this.setData({ loadError: false })
      const [result, placesResult] = await Promise.all([
        api.getReport(cityCode, false, { weekendOffset, preference }),
        api.getPlaces(cityCode)
      ])
      const report = result.data
      const places = (placesResult && placesResult.data) || mockData.getPlaces(cityCode) || []
      const city = mockData.getCity(cityCode)

      if (report) {
        // 预处理 sections（含抽取 stats 节）+ 活动分组/指标卡片注入
        const enriched = this._enrichReport(report)
        report.sections = enriched.sections
        const statsData = enriched.statsData
        const isWeekendExpired = this._isReportExpired(report, weekendOffset)
        const sources = this._enrichSources(report.sources || [])
        const freshnessLabel = this._computeFreshness(report, weekendOffset, isWeekendExpired)

        // 恢复该城市的展开状态（默认展开第一节）
        const savedExpanded = wx.getStorageSync('report_expanded_' + cityCode)
        const expanded = (savedExpanded && typeof savedExpanded === 'object') ? savedExpanded : { 0: true }

        this.setData({
          cityCode,
          cityName: city ? city.name : '',
          report,
          statsData,
          dataVersion: api.getDataVersion(),
          bakedAt: (report && report.bakedAt) || '',
          authSource: (report && report.authSource) || 'bundled',
          qualityCheck: report.qualityCheck || null,
          qualityHasLimited: enriched.qualityHasLimited,
          isWeekendExpired,
          expandedSections: expanded,
          sources,
          dataSource: result.source,
          dataSourceLabel: this._dataSourceLabel(result.source, result.stale),
          dataUpdateTime: uiHelper.timeAgo(result.fetchedAt || Date.now()),
          loading: false,
          places,
          weekendOffset,
          preference,
          freshnessLabel
        })

        this._refreshMarks()

        // SWR: background refresh if stale
        if (result.stale) {
          api.getReport(cityCode, true, { weekendOffset, preference }).then(freshResult => {
            if (freshResult && freshResult.data) {
              const fresh = this._enrichReport(freshResult.data)
              freshResult.data.sections = fresh.sections
              this.setData({
                report: freshResult.data,
                aiGenerated: !!(freshResult.data && freshResult.data.aiGenerated),
                statsData: fresh.statsData,
                qualityCheck: freshResult.data.qualityCheck || null,
                qualityHasLimited: fresh.qualityHasLimited,
                isWeekendExpired: this._isReportExpired(freshResult.data, weekendOffset),
                dataUpdateTime: uiHelper.timeAgo(Date.now())
              })
            }
          }).catch(() => {})
        }
      } else {
        this.setData({ loading: false, loadError: true })
        util.showToast('攻略加载失败，请检查网络')
      }
    } catch (e) {
      console.warn('[report] loadReport failed:', e.message)
      this.setData({ loading: false, loadError: true })
      util.showToast('加载失败，请重试')
    }
  },

  // 加载失败：重试
  retryLoad() {
    uiHelper.feedbackSwitch()
    this.setData({ loading: true, loadError: false })
    this.loadReport(this.data.cityCode, this.data.weekendOffset, this.data.preference)
  },

  // 判断报告是否过期：下周末报告未来才到期，不视为过期
  _isReportExpired(report, weekendOffset) {
    if (weekendOffset === 1) return false
    return util.isWeekendExpired(report)
  },

  // 新鲜度徽标：本周末最新 / 下周末预告 / 已过期
  _computeFreshness(report, weekendOffset, isWeekendExpired) {
    if (isWeekendExpired) return { text: '可能已过时', type: 'expired' }
    if (weekendOffset === 1) return { text: '下周末预告', type: 'next' }
    return { text: '本周末最新', type: 'current' }
  },

  // 统一预处理报告：注入中文数字/活动分组颜色/时效标签/指标卡片配色，并抽取 stats 节
  _enrichReport(report) {
    let statsData = null
    const sections = catHelper.enrichSections(report.sections || [])
      .filter(s => {
        if (s.type === 'stats') {
          statsData = s
          return false
        }
        return true
      })
      .map(s => {
        if (s.type === 'activities' && s.groups) {
          s.groups = catHelper.enrichActivityGroups(s.groups)
          s.groups.forEach(g => {
            const cat = categories.getCategory(g.category)
            if (cat) {
              g._timeLabel = cat.timeSensitivity === 'strong' ? '出行前确认' : cat.timeSensitivity === 'medium' ? '建议确认' : ''
            }
            // 信息有限标注：条目过少 → 提示信息不足，建议出发前核实
            g._infoLimited = !!(g.items && g.items.length < 3)
          })
        }
        if (s.type === 'overview' && s.tableData) {
          s.tableData = s.tableData.map(row => {
            const cat = categories.getCategory(row.category || _guessCategory(row.label))
            return {
              ...row,
              _color: cat ? cat.color : '#4A90D9',
              _icon: cat ? cat.icon : '📊'
            }
          })
        }
        if (s.type === 'ticket' && s.items) {
          s.items = s.items.map(it => ({
            ...it,
            _expired: util.isExpiryPassed(it.expiry)
          }))
        }
        return s
      })

    // 质量分维度信息有限标注：低分维度提示核实
    if (report.qualityCheck && report.qualityCheck.dimensions) {
      report.qualityCheck.dimensions.forEach(dim => {
        dim._infoLimited = dim.score < 85
      })
    }

    // 是否存在信息有限维度（供 WXML 渲染提示）
    const qualityHasLimited = !!(report.qualityCheck && report.qualityCheck.dimensions
      && report.qualityCheck.dimensions.some(dim => dim._infoLimited))

    return { sections, statsData, qualityHasLimited }
  },

  // 引用源 → 外链映射：按名称关键词生成可追溯搜索链接
  _enrichSources(sources) {
    return (sources || []).map(s => {
      const name = s.name || ''
      const keyword = encodeURIComponent(name)
      let link = null
      let linkName = ''
      if (name.includes('大麦') || name.includes('秀动')) {
        link = `https://search.damai.cn/search.htm?keyword=${keyword}`
        linkName = '大麦网'
      } else if (name.includes('大众点评')) {
        link = `https://www.dianping.com/search/keyword/2/${keyword}`
        linkName = '大众点评'
      } else if (name.includes('高德') || name.includes('地图')) {
        link = `https://m.amap.com/search/?query=${keyword}`
        linkName = '高德地图'
      } else if (name.includes('小红书')) {
        link = `https://www.xiaohongshu.com/search_result?keyword=${keyword}`
        linkName = '小红书'
      } else if (name.includes('美团')) {
        link = `https://i.meituan.com/mobile/desktop/search/1/0/${keyword}`
        linkName = '美团'
      } else if (name.includes('喜茶')) {
        link = `https://www.xixicha.cn/`
        linkName = '喜茶'
      } else if (name.includes('公众号') || name.includes('官网') || name.includes('官方')) {
        link = `https://www.baidu.com/s?wd=${keyword}`
        linkName = '百度'
      }
      return { ...s, link, linkName }
    })
  },

  // 点击引用源：复制/打开溯源链接
  onSourceTap(e) {
    const index = e.currentTarget.dataset.index
    const source = this.data.sources[index]
    if (!source || !source.link) return
    uiHelper.openExternalLink(source.link, source.linkName || source.name)
  },

  // 活动条目点击：弹出操作菜单
  onActivityTap(e) {
    const { name, venue, cat } = e.currentTarget.dataset
    uiHelper.feedbackSwitch()

    wx.showActionSheet({
      itemList: ['🗺️ 在地图查看', '🧭 导航到此处', '📂 查看分类详情'],
      success: (res) => {
        if (res.tapIndex === 0) {
          // 在地图查看：带目标地点跳转
          const place = this._findPlace(name, venue)
          if (place) {
            wx.switchTab({
              url: '/pages/map/map',
              success: () => {
                wx.setStorageSync('map_focus_place', { lat: place.lat, lng: place.lng, name: place.name })
              }
            })
          } else {
            // 该活动在地图上没有对应标记：明确提示，仍打开城市地图
            wx.switchTab({ url: '/pages/map/map' })
            util.showToast('该活动暂无地图标记')
          }
        } else if (res.tapIndex === 1) {
          // 导航
          const place = this._findPlace(name, venue)
          if (place) {
            wx.openLocation({
              latitude: place.lat,
              longitude: place.lng,
              name: name,
              address: this.data.cityName + ' · ' + (venue || place.address || ''),
              scale: 16,
              fail: () => {
                wx.setClipboardData({ data: name + ' - ' + (venue || place.address || '') })
                util.showToast('已复制地点信息')
              }
            })
          } else {
            // 无坐标：复制活动信息供用户自行导航
            wx.setClipboardData({
              data: this.data.cityName + ' ' + name + (venue ? ' - ' + venue : '')
            })
            util.showToast('地点信息已复制')
          }
        } else if (res.tapIndex === 2) {
          // 跳转分类详情
          wx.navigateTo({
            url: '/pages/category/category?cityCode=' + this.data.cityCode + '&catId=' + cat
          })
        }
      }
    })
  },

  // 在已加载的地点中匹配活动坐标
  _findPlace(name, venue) {
    const places = this.data.places || []
    if (!places.length) return null

    // 1. 精确匹配 name
    let hit = places.find(p => p.name === name)
    if (hit) return hit

    // 2. venue 与地点名互相包含
    const query = [name, venue].filter(Boolean)
    for (const q of query) {
      if (!q) continue
      hit = places.find(p => q.includes(p.name) || p.name.includes(q))
      if (hit) return hit
    }

    // 3. 分类内模糊匹配第一个词（如"张韶涵演唱会"→"广州体育馆"）
    return null
  },

  // 生成攻略海报
  generatePoster() {
    const r = this.data.report
    if (!r) return
    uiHelper.feedbackSwitch()
    util.showToast('正在生成海报...')

    // 新版 2D canvas：先获取画布节点
    const query = wx.createSelectorQuery()
    query.select('#posterCanvas').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0] || !res[0].node) {
        util.showToast('海报生成失败')
        return
      }
      const canvas = res[0].node
      const ctx = canvas.getContext('2d')
      const W = 600, H = 900
      const dpr = (wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()).pixelRatio || 2
      canvas.width = W * dpr
      canvas.height = H * dpr
      ctx.scale(dpr, dpr)

      // 背景
      ctx.fillStyle = '#1a233c'
      ctx.fillRect(0, 0, W, H)

      // 渐变背景
      const grad = ctx.createLinearGradient(0, 0, W, H)
      grad.addColorStop(0, '#1a233c')
      grad.addColorStop(1, '#2d3e5f')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, W, H)

      // 城市名
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 48px sans-serif'
      ctx.fillText(this.data.cityName + '周末游', 40, 80)

      // 日期
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.font = '24px sans-serif'
      ctx.fillText(r.overview.weekend + ' ' + r.overview.weather, 40, 120)

      // 分隔线
      ctx.fillStyle = 'rgba(255,255,255,0.2)'
      ctx.fillRect(40, 150, W - 80, 1)

      // 指标卡片
      const metrics = [
        { label: '演出', value: r.overview.concertCount, color: '#d32f2f', icon: '🎤' },
        { label: '市集', value: r.overview.marketCount, color: '#f9a825', icon: '🎪' },
        { label: '展览', value: r.overview.museumCount, color: '#1565c0', icon: '🏛️' },
        { label: '美食街', value: r.overview.foodStreetCount, color: '#ad1457', icon: '🍜' },
        { label: 'CityWalk', value: r.overview.cityWalkCount, color: '#00838f', icon: '🚶' },
        { label: '喜茶', value: r.overview.teaShopCount, color: '#ec407a', icon: '🍵' }
      ]
      metrics.forEach((m, i) => {
        const col = i % 3
        const row = Math.floor(i / 3)
        const x = 40 + col * 180
        const y = 180 + row * 130

        // 卡片背景
        ctx.fillStyle = 'rgba(255,255,255,0.08)'
        ctx.beginPath()
        ctx.arc(x + 70, y + 30, 60, 0, 2 * Math.PI)
        ctx.fill()

        // 数值
        ctx.fillStyle = m.color
        ctx.font = 'bold 40px sans-serif'
        ctx.fillText(String(m.value), x + 35, y + 45)

        // 标签
        ctx.fillStyle = 'rgba(255,255,255,0.6)'
        ctx.font = '20px sans-serif'
        ctx.fillText(m.label, x + 35, y + 75)
      })

      // 亮点
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.font = 'bold 28px sans-serif'
      ctx.fillText('✨ 本周末亮点', 40, 500)

      r.overview.highlights.slice(0, 4).forEach((h, i) => {
        ctx.fillStyle = 'rgba(255,255,255,0.7)'
        ctx.font = '22px sans-serif'
        const text = h.length > 28 ? h.substring(0, 28) + '...' : h
        ctx.fillText('• ' + text, 40, 540 + i * 36)
      })

      // 二维码（引流回流小程序）
      const codeSize = 132
      const codeX = W - codeSize - 40
      const codeY = H - codeSize - 30

      const drawCode = (imgPath) => {
        if (imgPath) {
          const img = canvas.createImage()
          img.onload = () => {
            ctx.drawImage(img, codeX, codeY, codeSize, codeSize)
            this._savePoster(canvas, W, H, true)
          }
          img.onerror = () => {
            this._drawBrandFallback(ctx, codeX, codeY, codeSize)
            this._savePoster(canvas, W, H, false)
          }
          img.src = imgPath
        } else {
          // 无服务端/小程序码失败：降级为品牌文案
          this._drawBrandFallback(ctx, codeX, codeY, codeSize)
          this._savePoster(canvas, W, H, false)
        }
      }

      // 拉取小程序码（失败则无码导出）
      api.getWxacode(this.data.cityCode + '_' + this.data.cityName, 'pages/report/report').then(drawCode)
    })
  },

  // 无码降级：在二维码区域绘制品牌文案块
  _drawBrandFallback(ctx, x, y, size) {
    // 圆角卡片背景
    ctx.fillStyle = 'rgba(255,255,255,0.14)'
    const r = 16
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + size - r, y)
    ctx.arcTo(x + size, y, x + size, y + r, r)
    ctx.lineTo(x + size, y + size - r)
    ctx.arcTo(x + size, y + size, x + size - r, y + size, r)
    ctx.lineTo(x + r, y + size)
    ctx.arcTo(x, y + size, x, y + size - r, r)
    ctx.lineTo(x, y + r)
    ctx.arcTo(x, y, x + r, y, r)
    ctx.closePath()
    ctx.fill()

    // 品牌名
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 26px sans-serif'
    ctx.fillText('周末城市游', x + 18, y + 48)
    // 引导文案
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.font = '18px sans-serif'
    ctx.fillText('微信搜索小程序', x + 18, y + 82)
    ctx.fillText('获取完整攻略', x + 18, y + 108)
  },

  _savePoster(canvas, W, H, hasCode) {
    const ctx = canvas.getContext('2d')
    // 品牌提示（二维码左侧，避开二维码区域）
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.font = 'bold 24px sans-serif'
    ctx.fillText('周末城市游', 40, H - 72)
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.font = '20px sans-serif'
    ctx.fillText(hasCode ? '长按识别 · 获取完整攻略' : '微信搜索小程序 · 获取完整攻略', 40, H - 44)

    wx.canvasToTempFilePath({
      canvas,
      success: (res) => {
        const tempFilePath = res.tempFilePath
        wx.showActionSheet({
          itemList: ['保存到相册', '预览海报'],
          success: (act) => {
            if (act.tapIndex === 0) {
              wx.saveImageToPhotosAlbum({
                filePath: tempFilePath,
                success: () => {
                  uiHelper.feedbackSuccess()
                  util.showToast('海报已保存到相册', 'success')
                },
                fail: () => {
                  wx.previewImage({ urls: [tempFilePath] })
                }
              })
            } else {
              wx.previewImage({ urls: [tempFilePath] })
            }
          },
          fail: () => {
            wx.previewImage({ urls: [tempFilePath] })
          }
        })
      },
      fail: () => {
        util.showToast('海报生成失败')
      }
    })
  },

  // 切换展开/折叠
  toggleSection(e) {
    uiHelper.feedbackSwitch()
    const idx = e.currentTarget.dataset.index
    const expanded = { ...this.data.expandedSections }
    expanded[idx] = !expanded[idx]
    this.setData({ expandedSections: expanded })
    this._saveExpandedState(expanded)
  },

  // 全部展开
  expandAll() {
    uiHelper.feedbackSuccess()
    const expanded = {}
    for (let i = 0; i < this.data.report.sections.length; i++) {
      expanded[i] = true
    }
    this.setData({ expandedSections: expanded })
    this._saveExpandedState(expanded)
  },

  // 全部折叠
  collapseAll() {
    const expanded = {}
    this.setData({ expandedSections: expanded })
    this._saveExpandedState(expanded)
  },

  // 持久化该城市的节展开状态
  _saveExpandedState(expanded) {
    if (this.data.cityCode) {
      wx.setStorageSync('report_expanded_' + this.data.cityCode, expanded)
    }
  },

  // 快速跳转到指定节
  quickJump(e) {
    const idx = e.currentTarget.dataset.index
    const expanded = { ...this.data.expandedSections }
    expanded[idx] = true
    this.setData({
      expandedSections: expanded,
      showQuickNav: false,
      activeSection: idx
    })
    this._saveExpandedState(expanded)
    // 滚动到对应节
    const query = wx.createSelectorQuery()
    query.select('#section-' + idx).boundingClientRect()
    query.selectViewport().scrollOffset()
    query.exec(res => {
      if (res[0] && res[1]) {
        wx.pageScrollTo({
          scrollTop: res[0].top + res[1].scrollTop - 80,
          duration: 300
        })
      }
    })
  },

  // 切换快速导航显示
  toggleQuickNav() {
    this.setData({ showQuickNav: !this.data.showQuickNav })
  },

  // 切换更多操作显示
  toggleMore() {
    this.setData({ showMore: !this.data.showMore })
  },

  // 展开/收起质量分详情
  toggleQuality() {
    this.setData({ showQuality: !this.data.showQuality })
  },

  // AI 整理提示
  showAiNotice() {
    wx.showModal({
      title: 'AI 整理攻略',
      content: '本攻略由 AI 基于公开资料整理（景点、坐标、票价、开放时间等为近似值），可能存在偏差。演出时间、门票价格、景区开放情况请务必以官方渠道（大麦网/景区官网/公众号）出行前二次核实。',
      showCancel: false,
      confirmText: '我知道了'
    })
  },

  // 切换生成过程展开
  toggleProcess() {
    this.setData({ expandedProcess: !this.data.expandedProcess })
  },

  // 攻略已过期：强制刷新最新周末数据
  async refreshReport() {
    if (this.data.refreshing) return
    this.setData({ refreshing: true })
    uiHelper.feedbackSwitch()
    util.showToast('正在刷新最新攻略...', 'none')
    try {
      const result = await api.getReport(this.data.cityCode, true, { weekendOffset: this.data.weekendOffset, preference: this.data.preference })
      if (result && result.data) {
        const fresh = this._enrichReport(result.data)
        result.data.sections = fresh.sections
        this.setData({
          report: result.data,
          statsData: fresh.statsData,
          qualityCheck: result.data.qualityCheck || null,
          qualityHasLimited: fresh.qualityHasLimited,
          isWeekendExpired: this._isReportExpired(result.data, this.data.weekendOffset),
          dataUpdateTime: uiHelper.timeAgo(result.fetchedAt || Date.now()),
          dataSourceLabel: this._dataSourceLabel(result.source, result.stale),
          freshnessLabel: this._computeFreshness(result.data, this.data.weekendOffset, this._isReportExpired(result.data, this.data.weekendOffset)),
          dataVersion: api.getDataVersion(),
          bakedAt: (result.data && result.data.bakedAt) || '',
          authSource: (result.data && result.data.authSource) || 'bundled',
          refreshing: false
        })
        this._refreshMarks()
        uiHelper.feedbackSuccess()
        util.showToast('攻略已更新', 'success')
      } else {
        this.setData({ refreshing: false })
        util.showToast('刷新失败，请重试')
      }
    } catch (e) {
      console.warn('[report] refreshReport failed:', e.message)
      this.setData({ refreshing: false })
      util.showToast('刷新失败，请重试')
    }
  },

  // 切换周末（本周末/下周末）
  switchWeekend(e) {
    const offset = Number(e.currentTarget.dataset.offset)
    if (offset === this.data.weekendOffset) return
    uiHelper.feedbackSwitch()
    util.showToast(offset === 1 ? '加载下周末攻略...' : '加载本周末攻略...', 'none')
    this.loadReport(this.data.cityCode, offset, this.data.preference)
    wx.pageScrollTo({ scrollTop: 0, duration: 200 })
  },

  // 切换偏好（通用/亲子/情侣/文艺/吃货）
  switchPreference(e) {
    const pref = e.currentTarget.dataset.pref || ''
    if (pref === this.data.preference) return
    uiHelper.feedbackSwitch()
    util.showToast('加载偏好攻略...', 'none')
    this.loadReport(this.data.cityCode, this.data.weekendOffset, pref)
    wx.pageScrollTo({ scrollTop: 0, duration: 200 })
  },

  // 查看路线详情
  viewRoute(e) {
    const routeId = e.currentTarget.dataset.route
    uiHelper.feedbackSwitch()
    const weekend = this.data.weekendOffset === 1 ? '1' : '0'
    const pref = this.data.preference || ''
    wx.navigateTo({
      url: '/pages/route/route?cityCode=' + this.data.cityCode + '&routeId=' + routeId + '&weekend=' + weekend + '&pref=' + pref
    })
  },

  // 查看分类详情
  viewCategory(e) {
    const cat = e.currentTarget.dataset.cat
    uiHelper.feedbackSwitch()
    const weekend = this.data.weekendOffset === 1 ? '1' : '0'
    const pref = this.data.preference || ''
    wx.navigateTo({
      url: '/pages/category/category?cityCode=' + this.data.cityCode + '&catId=' + cat + '&weekend=' + weekend + '&pref=' + pref
    })
  },

  // 复制报告摘要
  copySummary() {
    const r = this.data.report
    const text = this.data.cityName + '周末游攻略\n\n' +
      r.overview.summary + '\n\n' +
      '本周末：' + r.overview.weekend + ' ' + r.overview.weather + ' ' + r.overview.tempRange + '\n\n' +
      '亮点：\n' + r.overview.highlights.map(h => '• ' + h).join('\n') +
      '\n\n——由周末城市游生成'
    wx.setClipboardData({
      data: text,
      success: () => {
        uiHelper.feedbackSuccess()
        util.showToast('摘要已复制', 'success')
      }
    })
  },

  // 复制完整报告
  copyFullReport() {
    const r = this.data.report
    if (!r) return
    let text = '=== ' + this.data.cityName + '周末游攻略 ===\n'
    text += r.overview.weekend + ' ' + r.overview.weather + ' ' + r.overview.tempRange + '\n'
    text += '攻略质量: ' + (r.qualityCheck ? r.qualityCheck.overallScore : '暂无') + '分\n'
    text += '========================\n\n'

    r.sections.forEach(section => {
      text += '\n【' + catHelper.toChineseNumber(section.index) + '】' + section.title + '\n'
      text += section.content + '\n'

      if (section.type === 'overview' && section.tableData) {
        section.tableData.forEach(row => {
          text += '  ' + row.label + ': ' + row.value + '\n'
        })
      }

      if (section.type === 'activities' && section.groups) {
        section.groups.forEach(group => {
          text += '\n  [' + group.name + '] (' + group.items.length + '项)\n'
          group.items.forEach(item => {
            text += '    • ' + item.name
            if (item.time) text += ' | ' + item.time
            if (item.venue) text += ' | ' + item.venue
            if (item.price) text += ' | ' + item.price
            text += '\n'
          })
        })
      }

      if (section.items) {
        section.items.forEach(item => {
          text += '  • ' + item.name
          if (item.address) text += ' | ' + item.address
          if (item.price) text += ' | ' + item.price
          if (item.feature) text += ' | ' + item.feature
          text += '\n'
        })
      }

      if (section.type === 'routes' && section.routes) {
        section.routes.forEach(route => {
          text += '\n  路线' + route.id + ': ' + route.name + ' - ' + route.desc + '\n'
          route.timeline.forEach(t => {
            text += '    ' + t.time + ' ' + t.activity + (t.location ? '（' + t.location + '）' : '') + (t.note ? ' - ' + t.note : '') + '\n'
          })
        })
      }

      if (section.type === 'reliability' && section.notes) {
        section.notes.forEach(note => {
          text += '  • ' + note + '\n'
        })
      }
    })

    text += '\n========================\n'
    text += '出行前请二次确认关键信息\n'
    text += '——由周末城市游生成'

    wx.setClipboardData({
      data: text,
      success: () => {
        uiHelper.feedbackSuccess()
        util.showToast('完整攻略已复制', 'success')
      }
    })
  },

  // 保存报告到个人中心
  saveReport() {
    const app = getApp()
    if (this.data.report) {
      app.saveReportSync(this.data.report)
      uiHelper.feedbackSuccess()
      util.showToast('攻略已保存', 'success')
    }
  },

  // ===== 新增：个人标记（A3 借鉴 TREK Trip Notes）=====
  // 收集报告中可标记条目的 key（活动/门票/美食/茶饮/CityWalk）
  _collectMarkKeys(report) {
    const keys = []
    ;(report.sections || []).forEach(s => {
      if (s.type === 'activities' && s.groups) {
        s.groups.forEach(g => { (g.items || []).forEach(it => { if (it.name) keys.push(it.name) }) })
      }
      if (['ticket', 'tea', 'food', 'walk'].indexOf(s.type) > -1 && s.items) {
        s.items.forEach(it => { if (it.name) keys.push(it.name) })
      }
    })
    return keys
  },

  // 刷新标记状态（markMap + 汇总）
  _refreshMarks() {
    if (!this.data.report) return
    const cityMarks = userData.getCityMarks(this.data.cityCode)
    const keys = this._collectMarkKeys(this.data.report)
    const markMap = {}
    keys.forEach(k => {
      const m = cityMarks[k]
      if (m && m.status) markMap[k] = m.status
    })
    let want = 0, done = 0
    Object.keys(cityMarks).forEach(k => {
      const s = cityMarks[k].status
      if (s === 'want') want++
      else if (s === 'done') done++
    })
    this.setData({ markMap, marksSummary: { want, done } })
  },

  // 循环切换标记（无 -> 想去 -> 已去 -> 无）
  cycleMark(e) {
    const name = e.currentTarget.dataset.name
    if (!name) return
    uiHelper.feedbackSwitch()
    userData.cycleMark(this.data.cityCode, name)
    this._refreshMarks()
  },

  // 打开"我的标记"面板
  openMarkPanel() {
    uiHelper.feedbackSwitch()
    const cityMarks = userData.getCityMarks(this.data.cityCode)
    const list = Object.keys(cityMarks).map(k => ({
      key: k,
      status: cityMarks[k].status,
      note: cityMarks[k].note || ''
    })).sort((a, b) => (b.status === 'done' ? 1 : 0) - (a.status === 'done' ? 1 : 0))
    this.setData({ 'markPanel.visible': true, 'markPanel.list': list })
  },

  closeMarkPanel() {
    this.setData({ 'markPanel.visible': false })
  },

  noop() {},

  // 面板中移除某标记
  removeMarkFromPanel(e) {
    const key = e.currentTarget.dataset.key
    if (!key) return
    userData.setMarkStatus(this.data.cityCode, key, null)
    const list = this.data.markPanel.list.filter(i => i.key !== key)
    const markMap = Object.assign({}, this.data.markMap)
    delete markMap[key]
    let want = 0, done = 0
    const cityMarks = userData.getCityMarks(this.data.cityCode)
    Object.keys(cityMarks).forEach(k => {
      const s = cityMarks[k].status
      if (s === 'want') want++
      else if (s === 'done') done++
    })
    this.setData({ 'markPanel.list': list, markMap, marksSummary: { want, done } })
  },

  // 分享
  onShareAppMessage() {
    const r = this.data.report
    return {
      title: this.data.cityName + '周末游攻略 | ' + r.overview.concertCount + '场演出·' + r.overview.marketCount + '个市集·' + r.overview.foodStreetCount + '条美食街',
      path: '/pages/report/report?cityCode=' + this.data.cityCode + '&weekend=' + this.data.weekendOffset + '&pref=' + this.data.preference
    }
  },

  onShareTimeline() {
    return {
      title: this.data.cityName + '周末游攻略 - 周末城市游',
      query: 'cityCode=' + this.data.cityCode + '&weekend=' + this.data.weekendOffset + '&pref=' + this.data.preference
    }
  }
})

// 根据概览表格的 label 猜测分类 ID（用于指标卡片配色）
function _guessCategory(label) {
  const map = {
    '演出活动': 'concert', '演唱会': 'concert', '音乐会': 'concert',
    '创意市集': 'market', '市集': 'market', '夜市': 'market',
    '博物馆展': 'museum', '展览': 'museum', '博物馆': 'museum',
    '美食街': 'food', '老字号': 'food',
    'City Walk': 'walk', 'CityWalk': 'walk',
    '喜茶门店': 'tea', '喜茶': 'tea',
    '优惠门票': 'ticket', '门票': 'ticket',
    '购物中心': 'mall', '商场': 'mall',
    '地铁路线': 'metro', '地铁': 'metro',
    '5A景区': 'scenic', '景区': 'scenic',
    '体育赛事': 'sport', '球赛': 'sport'
  }
  return map[label] || ''
}
