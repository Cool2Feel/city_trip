// server/index.js - REST API server for weekend-city-trip
// Serves city data, reports, places, weather via REST endpoints

const express = require('express')
const cors = require('cors')
const https = require('https')
const mockData = require('../miniprogram/utils/mockData.js')

const app = express()
const PORT = process.env.PORT || 3001

// ===== Middleware =====
app.use(cors())
app.use(express.json())

// Request logger
app.use((req, res, next) => {
  const ts = new Date().toISOString()
  console.log(`[${ts}] ${req.method} ${req.url}`)
  next()
})

// Simulated network delay (50-200ms) to test loading states
app.use((req, res, next) => {
  const delay = 50 + Math.random() * 150
  setTimeout(next, delay)
})

// ===== Response envelope =====
function success(data, source = 'api') {
  return {
    success: true,
    data,
    source,
    timestamp: Date.now(),
    serverTime: new Date().toISOString()
  }
}

function error(message, code = 400) {
  return {
    success: false,
    error: { message, code },
    timestamp: Date.now()
  }
}

// ===== API Routes =====

// Health check
app.get('/v1/health', (req, res) => {
  res.json(success({
    status: 'ok',
    uptime: process.uptime(),
    version: '1.0.0',
    endpoints: [
      'GET /v1/cities',
      'GET /v1/cities/:code',
      'GET /v1/cities/hot',
      'GET /v1/reports/:cityCode',
      'GET /v1/places/:cityCode',
      'GET /v1/cities/:cityCode/center',
      'GET /v1/weather/:cityCode',
      'GET /v1/search?q=keyword',
      'GET /v1/searchContent?q=keyword',
      'GET /v1/wxacode?scene=&page='
    ]
  }))
})

// Get all cities
app.get('/v1/cities', (req, res) => {
  const cities = mockData.getCities()
  res.json(success(cities))
})

// Get hot cities
app.get('/v1/cities/hot', (req, res) => {
  const hot = mockData.getHotCities()
  res.json(success(hot))
})

// Get city detail
app.get('/v1/cities/:cityCode', (req, res) => {
  const { cityCode } = req.params
  const city = mockData.getCity(cityCode)
  if (!city) {
    return res.status(404).json(error(`City not found: ${cityCode}`, 404))
  }
  res.json(success(city))
})

// Get city center coordinates
app.get('/v1/cities/:cityCode/center', (req, res) => {
  const { cityCode } = req.params
  const center = mockData.getCityCenter(cityCode)
  if (!center) {
    return res.status(404).json(error(`City center not found: ${cityCode}`, 404))
  }
  res.json(success(center))
})

// Get city report (10-section structure)
app.get('/v1/reports/:cityCode', (req, res) => {
  const { cityCode } = req.params
  const weekendOffset = Number(req.query.weekendOffset) === 1 ? 1 : 0
  const preference = req.query.preference || ''
  const report = mockData.getReport(cityCode, { weekendOffset, preference })
  if (!report) {
    return res.status(404).json(error(`Report not found for city: ${cityCode}`, 404))
  }
  res.json(success(report))
})

// Get map places
app.get('/v1/places/:cityCode', (req, res) => {
  const { cityCode } = req.params
  const places = mockData.getPlaces(cityCode)
  if (!places || places.length === 0) {
    return res.status(404).json(error(`Places not found for city: ${cityCode}`, 404))
  }
  res.json(success(places))
})

// Get weather (mock with seasonal logic)
app.get('/v1/weather/:cityCode', (req, res) => {
  const { cityCode } = req.params
  const city = mockData.getCity(cityCode)
  if (!city) {
    return res.status(404).json(error(`City not found: ${cityCode}`, 404))
  }

  const month = new Date().getMonth() + 1
  let season = 'spring'
  if (month >= 6 && month <= 8) season = 'summer'
  else if (month >= 12 || month <= 2) season = 'winter'
  else if (month >= 9 && month <= 11) season = 'autumn'

  const seasons = {
    summer: { temp: '28-35°C', text: '晴', icon: '☀️' },
    winter: { temp: '5-12°C', text: '多云', icon: '⛅' },
    spring: { temp: '15-25°C', text: '晴转多云', icon: '🌤️' },
    autumn: { temp: '18-26°C', text: '晴', icon: '☀️' }
  }
  const w = seasons[season]

  res.json(success({
    city: city.name,
    temp: w.temp,
    text: w.text,
    icon: w.icon,
    forecast: [
      { day: '周六', weather: w.text, temp: w.temp },
      { day: '周日', weather: w.text, temp: w.temp }
    ]
  }))
})

// Search cities
app.get('/v1/search', (req, res) => {
  const q = (req.query.q || '').toLowerCase().trim()
  if (!q) {
    return res.json(success(mockData.getCities()))
  }
  const cities = mockData.getCities()
  const results = cities.filter(c =>
    c.name.includes(q) ||
    c.pinyin.toLowerCase().includes(q) ||
    c.province.includes(q)
  )
  res.json(success(results))
})

// ===== Cross-city content search =====
// Aggregates activities/tickets/food/tea/walk/metro content across all cities
// and matches against a keyword. Groups results by city + category.
const catConfig = require('../miniprogram/utils/categories.js')

function _itemSearchText(item) {
  const parts = []
  Object.keys(item || {}).forEach(k => {
    const v = item[k]
    if (typeof v === 'string' && v) parts.push(v)
  })
  return parts.join(' ')
}

function _itemSubText(item) {
  const skip = ['name', 'source']
  const parts = []
  Object.keys(item || {}).forEach(k => {
    if (skip.includes(k)) return
    const v = item[k]
    if (typeof v === 'string' && v) parts.push(v)
  })
  return parts.join(' · ')
}

function _pushMatch(bucket, category, item, city) {
  const key = `${city.code}_${category}`
  if (!bucket.has(key)) {
    const cat = catConfig.getCategory(category)
    bucket.set(key, {
      cityCode: city.code,
      cityName: city.name,
      category,
      categoryLabel: cat ? cat.name : category,
      items: []
    })
  }
  const group = bucket.get(key)
  if (group.items.length < 5) {
    group.items.push({
      name: item.name || item.title || '',
      sub: _itemSubText(item)
    })
  }
}

app.get('/v1/searchContent', (req, res) => {
  const q = (req.query.q || '').toLowerCase().trim()
  if (!q) {
    return res.json(success([]))
  }

  const bucket = new Map()
  const cities = mockData.getCities()

  cities.forEach(city => {
    const report = mockData.getReport(city.code)
    if (!report || !report.sections) return

    report.sections.forEach(section => {
      if (!section) return

      if (section.type === 'activities' && section.groups) {
        section.groups.forEach(group => {
          ;(group.items || []).forEach(item => {
            if (_itemSearchText(item).toLowerCase().includes(q)) {
              _pushMatch(bucket, group.category, item, city)
            }
          })
        })
      } else if (['ticket', 'tea', 'food', 'walk'].includes(section.type) && section.items) {
        section.items.forEach(item => {
          if (_itemSearchText(item).toLowerCase().includes(q)) {
            _pushMatch(bucket, section.type, item, city)
          }
        })
      } else if (section.type === 'metro' && section.keyStations) {
        section.keyStations.forEach(item => {
          if (_itemSearchText(item).toLowerCase().includes(q)) {
            _pushMatch(bucket, 'metro', item, city)
          }
        })
      }
    })
  })

  res.json(success(Array.from(bucket.values())))
})

// API stats
app.get('/v1/stats', (req, res) => {
  const cities = mockData.getCities()
  const reports = Object.keys(mockData.REPORTS)
  res.json(success({
    totalCities: cities.length,
    citiesWithFullReports: reports.length,
    totalPlaces: reports.reduce((sum, code) => {
      const places = mockData.getPlaces(code)
      return sum + (places ? places.length : 0)
    }, 0),
    serverVersion: '1.0.0',
    nodeVersion: process.version
  }))
})

// ===== WeChat Mini Program Code (wxacode) =====
// Generates an unlimited mini program code image for poster sharing.
// Requires WX_APPID and WX_APPSECRET env vars. Without them, returns 501.
const _wxToken = { value: null, expire: 0 }

function _wxRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (resp) => {
      const chunks = []
      resp.on('data', c => chunks.push(c))
      resp.on('end', () => {
        const buf = Buffer.concat(chunks)
        if (resp.headers['content-type'] && resp.headers['content-type'].includes('application/json')) {
          try {
            const data = JSON.parse(buf.toString())
            if (data.errcode) reject(new Error(data.errmsg || 'WeChat API error'))
            else resolve(data)
          } catch (e) {
            reject(e)
          }
        } else {
          resolve(buf)
        }
      })
    })
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

async function _getWxToken() {
  const now = Date.now()
  if (_wxToken.value && _wxToken.expire > now) return _wxToken.value
  const appid = process.env.WX_APPID
  const secret = process.env.WX_APPSECRET
  if (!appid || !secret) {
    const err = new Error('WX_APPID / WX_APPSECRET not configured')
    err.code = 501
    throw err
  }
  const data = await _wxRequest({
    hostname: 'api.weixin.qq.com',
    path: `/cgi-bin/token?grant_type=client_credential&appid=${appid}&secret=${secret}`,
    method: 'GET'
  })
  if (!data.access_token) {
    const err = new Error('Failed to get WeChat access_token')
    err.code = 502
    throw err
  }
  _wxToken.value = data.access_token
  _wxToken.expire = now + (data.expires_in || 7200) * 1000 - 60000
  return _wxToken.value
}

app.get('/v1/wxacode', async (req, res) => {
  const scene = (req.query.scene || 'home').slice(0, 32)
  const page = (req.query.page || 'pages/home/home').slice(0, 128)
  try {
    const token = await _getWxToken()
    const img = await _wxRequest({
      hostname: 'api.weixin.qq.com',
      path: `/wxa/getwxacodeunlimit?access_token=${token}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, JSON.stringify({
      scene,
      page,
      check_path: false,
      env_version: 'release',
      width: 430,
      auto_color: false,
      line_color: { r: 74, g: 144, b: 217 }
    }))
    if (!Buffer.isBuffer(img)) {
      return res.status(500).json(error('wxacode generation failed'))
    }
    res.set('Content-Type', 'image/png')
    res.set('Cache-Control', 'public, max-age=3600')
    res.send(img)
  } catch (e) {
    const status = e.code || 500
    res.status(status).json(error(e.message, status))
  }
})

// 404 handler
app.use((req, res) => {
  res.status(404).json(error(`Endpoint not found: ${req.method} ${req.url}`, 404))
})

// Error handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err)
  res.status(500).json(error('Internal server error', 500))
})

// ===== Start server =====
app.listen(PORT, () => {
  console.log(`\n========================================`)
  console.log(`  Weekend City Trip API Server`)
  console.log(`  Running at: http://localhost:${PORT}`)
  console.log(`  Health check: http://localhost:${PORT}/v1/health`)
  console.log(`========================================\n`)
})
