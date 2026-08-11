// utils/categoryHelper.js
// 消灭 WXML 中 11 级三元判断链，统一通过函数获取分类颜色/字母/图标

const categories = require('./categories.js')

// 分类 -> 颜色映射表（从 categories.js 自动生成，零硬编码）
const _colorMap = {}
const _letterMap = {}
const _iconMap = {}
categories.CATEGORIES.forEach(c => {
  _colorMap[c.id] = c.color
  _letterMap[c.id] = c.letter
  _iconMap[c.id] = c.icon
})

// 默认值
const DEFAULT_COLOR = '#999'
const DEFAULT_LETTER = '?'
const DEFAULT_ICON = ''

/**
 * 获取分类颜色
 */
function getColor(categoryId) {
  return _colorMap[categoryId] || DEFAULT_COLOR
}

/**
 * 获取分类字母
 */
function getLetter(categoryId) {
  return _letterMap[categoryId] || DEFAULT_LETTER
}

/**
 * 获取分类图标
 */
function getIcon(categoryId) {
  return _iconMap[categoryId] || DEFAULT_ICON
}

/**
 * 获取分类名称
 */
function getName(categoryId) {
  const cat = categories.getCategory(categoryId)
  return cat ? cat.name : '其他'
}

/**
 * 为地点列表批量注入分类信息（颜色+字母+图标）
 * 用于 WXML 渲染前预处理，消灭模板内三元判断
 * @param {Array} places - 地点数组
 * @returns {Array} 注入 _color/_letter/_icon 后的数组
 */
function enrichPlaces(places) {
  if (!Array.isArray(places)) return []
  return places.map(p => ({
    ...p,
    _color: getColor(p.category),
    _letter: getLetter(p.category),
    _icon: getIcon(p.category)
  }))
}

/**
 * 为单个地点注入分类信息
 */
function enrichPlace(place) {
  if (!place) return place
  return {
    ...place,
    _color: getColor(place.category),
    _letter: getLetter(place.category),
    _icon: getIcon(place.category)
  }
}

/**
 * 为活动分组注入颜色
 */
function enrichActivityGroups(groups) {
  if (!Array.isArray(groups)) return []
  return groups.map(g => ({
    ...g,
    _color: getColor(g.category)
  }))
}

/**
 * 中文数字映射（消灭 report.wxml 中的10级三元判断）
 */
const CN_NUMBERS = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十']

/**
 * 获取中文数字
 */
function toChineseNumber(index) {
  return CN_NUMBERS[index] || String(index)
}

/**
 * 为报告 sections 批量注入中文数字
 */
function enrichSections(sections) {
  if (!Array.isArray(sections)) return []
  return sections.map(s => ({
    ...s,
    _cnNumber: toChineseNumber(s.index)
  }))
}

module.exports = {
  getColor,
  getLetter,
  getIcon,
  getName,
  enrichPlaces,
  enrichPlace,
  enrichActivityGroups,
  toChineseNumber,
  enrichSections,
  CN_NUMBERS
}
