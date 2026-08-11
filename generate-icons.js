// generate-icons.js - 生成小程序tabBar图标（v5.0：真实图标）
const fs = require('fs')
const zlib = require('zlib')
const path = require('path')

const SIZE = 81
const GRAY = [153, 153, 153]
const BLUE = [74, 144, 217]

// 像素缓冲区：宽 * 高 * 4 字节（RGBA）
function newBuffer() {
  return Buffer.alloc(SIZE * SIZE * 4)
}

// 设置像素（含 alpha 混合）
function setPixel(buf, x, y, color, alpha = 255) {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return
  const idx = (y * SIZE + x) * 4
  // alpha blending over existing
  const srcA = alpha / 255
  const dstA = buf[idx + 3] / 255
  const outA = srcA + dstA * (1 - srcA)
  if (outA <= 0) return
  buf[idx]     = Math.round((color[0] * srcA + buf[idx]     * dstA * (1 - srcA)) / outA)
  buf[idx + 1] = Math.round((color[1] * srcA + buf[idx + 1] * dstA * (1 - srcA)) / outA)
  buf[idx + 2] = Math.round((color[2] * srcA + buf[idx + 2] * dstA * (1 - srcA)) / outA)
  buf[idx + 3] = Math.round(outA * 255)
}

// 画圆（实心 + 抗锯齿）
function fillCircle(buf, cx, cy, r, color, alpha = 255) {
  for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) {
    for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
      const dx = x - cx
      const dy = y - cy
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist <= r - 0.5) {
        setPixel(buf, x, y, color, alpha)
      } else if (dist <= r + 0.5) {
        // 抗锯齿边缘
        const a = Math.round((r + 0.5 - dist) * alpha)
        setPixel(buf, x, y, color, Math.min(255, Math.max(0, a)))
      }
    }
  }
}

// 画描边圆（仅描边 + 抗锯齿）
function strokeCircle(buf, cx, cy, r, color, thickness = 3, alpha = 255) {
  for (let y = Math.floor(cy - r - thickness); y <= Math.ceil(cy + r + thickness); y++) {
    for (let x = Math.floor(cx - r - thickness); x <= Math.ceil(cx + r + thickness); x++) {
      const dx = x - cx
      const dy = y - cy
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist >= r - thickness / 2 && dist <= r + thickness / 2) {
        const edge = thickness / 2
        let a = alpha
        if (dist < r - edge / 2) {
          a = Math.round((dist - (r - edge)) * alpha / (edge / 2))
        } else if (dist > r + edge / 2) {
          a = Math.round(((r + edge) - dist) * alpha / (edge / 2))
        }
        a = Math.max(0, Math.min(255, a))
        setPixel(buf, x, y, color, a)
      }
    }
  }
}

// 画矩形（实心）
function fillRect(buf, x0, y0, x1, y1, color, alpha = 255) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      setPixel(buf, x, y, color, alpha)
    }
  }
}

// 画描边矩形
function strokeRect(buf, x0, y0, x1, y1, color, thickness = 3, alpha = 255) {
  // 上边
  for (let y = y0; y < y0 + thickness; y++) {
    for (let x = x0; x <= x1; x++) setPixel(buf, x, y, color, alpha)
  }
  // 下边
  for (let y = y1 - thickness + 1; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) setPixel(buf, x, y, color, alpha)
  }
  // 左边
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x < x0 + thickness; x++) setPixel(buf, x, y, color, alpha)
  }
  // 右边
  for (let y = y0; y <= y1; y++) {
    for (let x = x1 - thickness + 1; x <= x1; x++) setPixel(buf, x, y, color, alpha)
  }
}

// 画线段（Bresenham）
function drawLine(buf, x0, y0, x1, y1, color, thickness = 2, alpha = 255) {
  const dx = Math.abs(x1 - x0)
  const dy = Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx - dy
  let x = x0, y = y0
  while (true) {
    // 画一个 thickness×thickness 的小方块
    for (let oy = -Math.floor(thickness / 2); oy <= Math.ceil(thickness / 2) - 1; oy++) {
      for (let ox = -Math.floor(thickness / 2); ox <= Math.ceil(thickness / 2) - 1; ox++) {
        setPixel(buf, x + ox, y + oy, color, alpha)
      }
    }
    if (x === x1 && y === y1) break
    const e2 = 2 * err
    if (e2 > -dy) { err -= dy; x += sx }
    if (e2 < dx)  { err += dx; y += sy }
  }
}

// 画三角形（实心，扫描线法）
function fillTriangle(buf, x0, y0, x1, y1, x2, y2, color, alpha = 255) {
  const minX = Math.max(0, Math.min(x0, x1, x2))
  const maxX = Math.min(SIZE - 1, Math.max(x0, x1, x2))
  const minY = Math.max(0, Math.min(y0, y1, y2))
  const maxY = Math.min(SIZE - 1, Math.max(y0, y1, y2))

  function sign(p1x, p1y, p2x, p2y, p3x, p3y) {
    return (p1x - p3x) * (p2y - p3y) - (p2x - p3x) * (p1y - p3y)
  }

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const d1 = sign(x, y, x0, y0, x1, y1)
      const d2 = sign(x, y, x1, y1, x2, y2)
      const d3 = sign(x, y, x2, y2, x0, y0)
      const hasNeg = d1 < 0 || d2 < 0 || d3 < 0
      const hasPos = d1 > 0 || d2 > 0 || d3 > 0
      if (!(hasNeg && hasPos)) {
        setPixel(buf, x, y, color, alpha)
      }
    }
  }
}

// ===== 图标绘制函数 =====

// 1. 首页（房子）：屋顶三角 + 主体矩形 + 门
function drawHome(buf, color, alpha = 255) {
  const cx = SIZE / 2

  // 屋顶（三角形）：从底边左右两个点向上汇聚
  fillTriangle(buf, 14, 42, 67, 42, cx, 14, color, alpha)
  // 主体（圆角矩形，用矩形近似）：从 y=38 到 y=66
  fillRect(buf, 18, 38, 63, 66, color, alpha)
  // 重新画屋顶在主体之上的部分（更清晰）
  fillTriangle(buf, 14, 42, 67, 42, cx, 14, color, alpha)

  // 屋檐遮挡线（让屋顶和主体衔接）
  fillRect(buf, 14, 40, 67, 44, color, alpha)

  // 门（白色镂空效果：实际是用背景色画一个矩形模拟）
  // 这里我们画一个不透明区域代表门，但实际是减色。简化：画深色门
  const door = [Math.max(0, color[0] - 60), Math.max(0, color[1] - 60), Math.max(0, color[2] - 60)]
  // 实际上不画门，看起来更像房子：用半透明圆角表现窗子
  // 简化：留一个缺口表示门
  // 顶部小窗
  fillRect(buf, 36, 46, 45, 52, [255, 255, 255], Math.round(alpha * 0.85))
  // 底部门
  fillRect(buf, 35, 56, 46, 66, [255, 255, 255], Math.round(alpha * 0.85))
}

// 2. 发现（放大镜 + 探索）：圆环镜身 + 斜向手柄
function drawDiscover(buf, color, alpha = 255) {
  const cx = 36
  const cy = 36
  const ringR = 20
  const thickness = 5

  // 镜身外圆（描边圆环）
  strokeCircle(buf, cx, cy, ringR, color, thickness, alpha)

  // 镜面中心小十字（增强"探索"语义）：一个小点
  fillCircle(buf, cx, cy, 3, color, alpha)

  // 手柄：从镜身右下角斜向右下
  // 起点：镜身边缘 (cx + r/√2, cy + r/√2)
  const handleStartX = cx + Math.round(ringR * 0.71)
  const handleStartY = cy + Math.round(ringR * 0.71)
  const handleEndX = 70
  const handleEndY = 70
  drawLine(buf, handleStartX, handleStartY, handleEndX, handleEndY, color, 6, alpha)
}

// 3. 地图（地图针）：水滴形 + 中心圆
function drawMap(buf, color, alpha = 255) {
  const cx = SIZE / 2

  // 水滴形：上方圆 + 下方尖角
  // 上方圆
  fillCircle(buf, cx, 30, 18, color, alpha)
  // 下方三角形（尖角朝下）
  fillTriangle(buf, cx - 14, 38, cx + 14, 38, cx, 68, color, alpha)

  // 中心圆（白色）
  fillCircle(buf, cx, 30, 7, [255, 255, 255], 255)
  // 中心圆内小点（用原色）
  fillCircle(buf, cx, 30, 3, color, alpha)
}

// 4. 我的（人）：头部圆 + 身体半圆
function drawProfile(buf, color, alpha = 255) {
  const cx = SIZE / 2
  const cy = SIZE / 2

  // 头部（圆）
  fillCircle(buf, cx, 24, 13, color, alpha)
  // 身体（半圆/梯形）：从 y=42 到 y=68，宽度渐变
  // 用一个大圆的下半部分
  const bodyR = 24
  for (let y = 42; y <= 68; y++) {
    const dy = y - 42
    // 半圆宽度：y=42时宽=0，y=68时宽=48
    const w = Math.sqrt(Math.max(0, bodyR * bodyR - (bodyR - dy) * (bodyR - dy))) * 2
    if (w > 0) {
      fillRect(buf, Math.round(cx - w), y, Math.round(cx + w), y, color, alpha)
    }
  }
}

// ===== PNG 编码 =====
function createPNG(width, height, pixels) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  const ihdrData = Buffer.alloc(13)
  ihdrData.writeUInt32BE(width, 0)
  ihdrData.writeUInt32BE(height, 4)
  ihdrData[8] = 8
  ihdrData[9] = 6
  ihdrData[10] = 0
  ihdrData[11] = 0
  ihdrData[12] = 0
  const ihdr = createChunk('IHDR', ihdrData)

  const rawData = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    rawData[y * (width * 4 + 1)] = 0
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      const offset = y * (width * 4 + 1) + 1 + x * 4
      rawData[offset] = pixels[idx]
      rawData[offset + 1] = pixels[idx + 1]
      rawData[offset + 2] = pixels[idx + 2]
      rawData[offset + 3] = pixels[idx + 3]
    }
  }
  const compressed = zlib.deflateSync(rawData)
  const idat = createChunk('IDAT', compressed)
  const iend = createChunk('IEND', Buffer.alloc(0))
  return Buffer.concat([signature, ihdr, idat, iend])
}

function createChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii')
  const lengthBuffer = Buffer.alloc(4)
  lengthBuffer.writeUInt32BE(data.length, 0)
  const crcInput = Buffer.concat([typeBuffer, data])
  const crc = crc32(crcInput)
  const crcBuffer = Buffer.alloc(4)
  crcBuffer.writeUInt32BE(crc >>> 0, 0)
  return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer])
}

function crc32(buf) {
  let crc = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) {
    crc = crc ^ buf[i]
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1))
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

// ===== 主流程 =====
function generateIcon(drawFn, color) {
  const buf = newBuffer()
  drawFn(buf, color, 230)
  return createPNG(SIZE, SIZE, buf)
}

const outputDir = path.join(__dirname, 'miniprogram', 'assets', 'tab')

// 确保输出目录存在
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

const icons = [
  { name: 'home.png',        draw: drawHome,     color: GRAY },
  { name: 'home_active.png', draw: drawHome,     color: BLUE },
  { name: 'discover.png',        draw: drawDiscover, color: GRAY },
  { name: 'discover_active.png', draw: drawDiscover, color: BLUE },
  { name: 'map.png',        draw: drawMap,     color: GRAY },
  { name: 'map_active.png', draw: drawMap,     color: BLUE },
  { name: 'profile.png',        draw: drawProfile, color: GRAY },
  { name: 'profile_active.png', draw: drawProfile, color: BLUE }
]

icons.forEach(icon => {
  const png = generateIcon(icon.draw, icon.color)
  const outPath = path.join(outputDir, icon.name)
  fs.writeFileSync(outPath, png)
  console.log(`Generated: ${icon.name} (${png.length} bytes)`)
})

console.log('\nAll tabBar icons regenerated!')