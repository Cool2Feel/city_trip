// utils/auth.js - 微信用户系统
// 功能：wx.login 登录 + wx.getUserProfile 用户信息 + 收藏/报告云同步 + 本地降级

const api = require('./api.js')

// 用户状态
let userState = {
  isLogin: false,
  openid: '',
  unionid: '',
  userInfo: null,
  loginTime: 0,
  syncEnabled: false  // 是否启用云同步
}

// 从本地存储恢复
function restore() {
  try {
    const saved = wx.getStorageSync('user_state')
    if (saved) {
      userState = { ...userState, ...saved }
    }
  } catch (e) {}
}

restore()

// ===== 微信登录 =====

/**
 * 微信登录（静默登录，获取 code → 换取 openid）
 * @returns {Promise<Object>} loginResult
 */
function login() {
  return new Promise((resolve, reject) => {
    wx.login({
      success(res) {
        if (res.code) {
          console.log('[auth] wx.login success, code:', res.code.substring(0, 8) + '...')
          // 尝试通过云开发换取 openid
          if (api.CONFIG.useCloud) {
            cloudLogin(res.code).then(result => {
              userState.isLogin = true
              userState.openid = result.openid || ''
              userState.unionid = result.unionid || ''
              userState.loginTime = Date.now()
              saveState()
              resolve({ ...userState, code: res.code })
            }).catch(err => {
              console.warn('[auth] cloud login failed:', err.message)
              // 降级：仅本地登录
              userState.isLogin = true
              userState.loginTime = Date.now()
              saveState()
              resolve({ ...userState, code: res.code })
            })
          } else {
            // 无云开发：本地登录态
            userState.isLogin = true
            userState.loginTime = Date.now()
            saveState()
            resolve({ ...userState, code: res.code })
          }
        } else {
          reject(new Error('wx.login failed: ' + res.errMsg))
        }
      },
      fail(err) {
        reject(new Error(err.errMsg || 'wx.login error'))
      }
    })
  })
}

/**
 * 云开发登录（换取 openid）
 */
function cloudLogin(code) {
  return new Promise((resolve, reject) => {
    if (!wx.cloud) {
      reject(new Error('Cloud not available'))
      return
    }
    wx.cloud.callFunction({
      name: 'login',
      data: { code },
      success(res) {
        resolve(res.result || {})
      },
      fail(err) {
        reject(new Error(err.errMsg || 'Cloud login failed'))
      }
    })
  })
}

/**
 * 获取用户信息（需用户授权）
 * 注意：2021年后 wx.getUserProfile 已废弃，新版使用 button open-type="chooseAvatar"
 * 兼容方案：优先 getUserProfile，降级到 getUserInfo
 * @param {boolean} desc 授权描述
 */
function getUserProfile(desc) {
  return new Promise((resolve, reject) => {
    const descText = desc || '用于完善个人资料和收藏同步'

    // 检查 API 可用性
    if (wx.getUserProfile) {
      wx.getUserProfile({
        desc: descText,
        success(res) {
          const userInfo = res.userInfo
          userState.userInfo = userInfo
          saveState()
          console.log('[auth] getUserProfile success:', userInfo.nickName)
          resolve(userInfo)
        },
        fail(err) {
          console.warn('[auth] getUserProfile failed:', err.errMsg)
          reject(new Error(err.errMsg || '用户拒绝授权'))
        }
      })
    } else if (wx.getUserInfo) {
      // 旧版兼容
      wx.getUserInfo({
        desc: descText,
        success(res) {
          userState.userInfo = res.userInfo
          saveState()
          resolve(res.userInfo)
        },
        fail(err) {
          reject(new Error(err.errMsg || '获取用户信息失败'))
        }
      })
    } else {
      // 无 API 可用，返回默认信息
      const defaultUser = {
        nickName: '周末旅行家',
        avatarUrl: '',
        gender: 0
      }
      userState.userInfo = defaultUser
      saveState()
      resolve(defaultUser)
    }
  })
}

/**
 * 确保已登录（如未登录则静默登录）
 */
async function ensureLogin() {
  if (!userState.isLogin || isTokenExpired()) {
    try {
      await login()
    } catch (e) {
      console.warn('[auth] ensureLogin failed:', e.message)
      return false
    }
  }
  return userState.isLogin
}

/**
 * 检查登录态是否过期（2小时过期）
 */
function isTokenExpired() {
  const TWO_HOURS = 2 * 60 * 60 * 1000
  return Date.now() - userState.loginTime > TWO_HOURS
}

// ===== 收藏管理（支持云同步）=====

/**
 * 获取收藏城市列表
 */
async function getFavoriteCities() {
  if (!ensureLoginSync()) {
    return getLocalFavorites()
  }

  // 尝试云同步
  if (api.CONFIG.useCloud && userState.syncEnabled) {
    try {
      const result = await api.cloudCall('getFavorites', { openid: userState.openid })
      if (result && result.cities) {
        // 合并本地和云端
        const merged = mergeFavorites(getLocalFavorites(), result.cities)
        saveLocalFavorites(merged)
        return merged
      }
    } catch (e) {
      console.warn('[auth] cloud getFavorites failed:', e.message)
    }
  }

  return getLocalFavorites()
}

/**
 * 切换城市收藏状态
 */
async function toggleFavoriteCity(cityCode) {
  const favorites = getLocalFavorites()
  const idx = favorites.indexOf(cityCode)
  let isFav

  if (idx > -1) {
    favorites.splice(idx, 1)
    isFav = false
  } else {
    favorites.push(cityCode)
    isFav = true
  }

  saveLocalFavorites(favorites)

  // 云同步（异步，不阻塞）
  if (api.CONFIG.useCloud && userState.syncEnabled) {
    cloudSyncFavorites(favorites).catch(e => {
      console.warn('[auth] cloud sync favorites failed:', e.message)
    })
  }

  return isFav
}

/**
 * 检查城市是否已收藏
 */
function isFavorite(cityCode) {
  return getLocalFavorites().includes(cityCode)
}

// 本地收藏操作
function getLocalFavorites() {
  try {
    return wx.getStorageSync('favoriteCities') || []
  } catch (e) {
    return []
  }
}

function saveLocalFavorites(cities) {
  try {
    wx.setStorageSync('favoriteCities', cities)
  } catch (e) {}
}

function mergeFavorites(local, cloud) {
  const set = new Set([...local, ...cloud])
  return Array.from(set)
}

function cloudSyncFavorites(cities) {
  return api.cloudCall('syncFavorites', {
    openid: userState.openid,
    cities
  })
}

// ===== 报告收藏管理 =====

/**
 * 保存报告（本地 + 云同步）
 */
async function saveReport(report) {
  const reports = getLocalReports()
  const existIdx = reports.findIndex(r => r.cityCode === report.cityCode)

  if (existIdx > -1) {
    reports[existIdx] = report
  } else {
    reports.unshift(report)
  }

  saveLocalReports(reports)

  // 云同步
  if (api.CONFIG.useCloud && userState.syncEnabled) {
    api.cloudCall('saveReport', {
      openid: userState.openid,
      report
    }).catch(e => {
      console.warn('[auth] cloud saveReport failed:', e.message)
    })
  }
}

/**
 * 删除报告
 */
async function deleteReport(cityCode) {
  let reports = getLocalReports().filter(r => r.cityCode !== cityCode)
  saveLocalReports(reports)

  if (api.CONFIG.useCloud && userState.syncEnabled) {
    api.cloudCall('deleteReport', {
      openid: userState.openid,
      cityCode
    }).catch(e => {
      console.warn('[auth] cloud deleteReport failed:', e.message)
    })
  }
}

/**
 * 获取已保存报告列表
 */
async function getSavedReports() {
  if (api.CONFIG.useCloud && userState.syncEnabled) {
    try {
      const result = await api.cloudCall('getReports', { openid: userState.openid })
      if (result && result.reports) {
        const local = getLocalReports()
        const merged = mergeReports(local, result.reports)
        saveLocalReports(merged)
        return merged
      }
    } catch (e) {
      console.warn('[auth] cloud getReports failed:', e.message)
    }
  }
  return getLocalReports()
}

// 本地报告操作
function getLocalReports() {
  try {
    return wx.getStorageSync('savedReports') || []
  } catch (e) {
    return []
  }
}

function saveLocalReports(reports) {
  try {
    wx.setStorageSync('savedReports', reports)
  } catch (e) {}
}

function mergeReports(local, cloud) {
  const map = new Map()
  local.forEach(r => map.set(r.cityCode, r))
  cloud.forEach(r => {
    if (!map.has(r.cityCode) || (r.savedAt || 0) > (map.get(r.cityCode).savedAt || 0)) {
      map.set(r.cityCode, r)
    }
  })
  return Array.from(map.values())
}

// ===== 辅助方法 =====

function ensureLoginSync() {
  return userState.isLogin && !isTokenExpired()
}

function saveState() {
  try {
    wx.setStorageSync('user_state', {
      isLogin: userState.isLogin,
      openid: userState.openid,
      unionid: userState.unionid,
      userInfo: userState.userInfo,
      loginTime: userState.loginTime,
      syncEnabled: userState.syncEnabled
    })
  } catch (e) {}
}

function getUserInfo() {
  return userState.userInfo
}

/**
 * 保存用户资料（chooseAvatar 头像 + 昵称输入，替代已废弃的 wx.getUserProfile）
 * 合并到现有 userState，保留历史字段；已静默登录时同步 isLogin
 */
function saveUserInfo(partial) {
  const merged = Object.assign({}, userState.userInfo || {}, partial || {})
  userState.userInfo = merged
  if (!userState.isLogin) {
    userState.isLogin = true
    userState.loginTime = Date.now()
  }
  saveState()
  return merged
}

function isLoggedIn() {
  return userState.isLogin && !isTokenExpired()
}

function getOpenId() {
  return userState.openid
}

function enableSync(enabled) {
  userState.syncEnabled = enabled
  saveState()
}

function isSyncEnabled() {
  return userState.syncEnabled && api.CONFIG.useCloud
}

/**
 * 退出登录
 */
function logout() {
  userState.isLogin = false
  userState.openid = ''
  userState.userInfo = null
  userState.syncEnabled = false
  saveState()
}

module.exports = {
  login,
  ensureLogin,
  getUserProfile,
  getFavoriteCities,
  toggleFavoriteCity,
  isFavorite,
  saveReport,
  deleteReport,
  getSavedReports,
  getUserInfo,
  saveUserInfo,
  isLoggedIn,
  getOpenId,
  enableSync,
  isSyncEnabled,
  logout
}
