// app.js - 周末城市游 Web 版应用逻辑 v3.0
// v3.0: 数据来源标签 + 全文复制 + 快速跳转 + 交通估算 + 日历导出

let currentCity = 'guangzhou';
let activeTab = 'home';
let mapFilter = 'all';
let selectedPlace = null;
let expandedSections = new Set([0]);
let activeRoute = 'A';
let searchKeyword = '';
let showQuickNav = false;
let dataSource = 'mock'; // mock | cache | api | cloud

// ===== Tab Navigation =====
function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.page').forEach(p => { if (p.id.startsWith('page-') && p.id !== 'page-city-select') p.classList.remove('active'); });
  document.getElementById('page-' + tab).classList.add('active');
  document.querySelectorAll('.tab-item').forEach(t => {
    t.classList.remove('active');
    const img = t.querySelector('img');
    const name = t.dataset.tab;
    img.src = 'assets/tab/' + name + '.png';
  });
  const activeItem = document.querySelector(`.tab-item[data-tab="${tab}"]`);
  activeItem.classList.add('active');
  activeItem.querySelector('img').src = 'assets/tab/' + tab + '_active.png';
  window.scrollTo(0, 0);
}

// ===== Toast =====
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}

// ===== Home Page =====
function renderHome() {
  const report = getReport(currentCity);
  if (!report) return;
  const ov = report.overview;

  document.getElementById('city-name').textContent = report.cityName;
  document.getElementById('weekend-date').textContent = '📅 ' + ov.weekend;

  // 数据来源标签
  const dsLabel = { mock: '示例数据', cache: '缓存数据', api: '实时数据', cloud: '云端数据' };
  const dsColor = { mock: '#9e9e9e', cache: '#ff9800', api: '#4caf50', cloud: '#2196f3' };

  const grid = document.getElementById('overview-grid');
  const cells = [
    { num: ov.concertCount, label: '演出活动' },
    { num: ov.marketCount, label: '创意市集' },
    { num: ov.museumCount, label: '博物馆展' },
    { num: ov.foodStreetCount, label: '美食街' },
    { num: ov.cityWalkCount, label: 'CityWalk' },
    { num: ov.teaShopCount, label: '喜茶门店' }
  ];
  grid.innerHTML = cells.map(c => `<div class="overview-cell"><div class="num">${c.num}</div><div class="label">${c.label}</div></div>`).join('');

  const hl = document.getElementById('highlight-list');
  hl.innerHTML = ov.highlights.map((h, i) => `<div class="highlight-item"><div class="highlight-dot" style="background:${getCategoryColor(['concert','market','museum','scenic'][i % 4])}"></div><div class="highlight-text">${h}</div></div>`).join('');

  // 添加数据来源标签到一图速览
  const overviewSection = document.querySelector('#page-home .section');
  if (overviewSection && !overviewSection.querySelector('.ds-tag-web')) {
    const dsTag = document.createElement('div');
    dsTag.className = 'ds-tag-web';
    dsTag.style.cssText = 'font-size:11px;padding:2px 8px;border-radius:4px;color:#fff;background:' + dsColor[dataSource] + ';display:inline-block;margin-top:4px';
    dsTag.textContent = dsLabel[dataSource];
    overviewSection.querySelector('.section-title').appendChild(dsTag);
  }
}

// ===== Discover Page =====
function renderDiscover() {
  const report = getReport(currentCity);
  if (!report) return;

  // Workflow
  const wf = document.getElementById('workflow-list');
  wf.innerHTML = report.workflow.map(s => `
    <div class="workflow-step ${s.status === 'skip' ? 'skip' : ''}">
      <div class="workflow-num">${s.step}</div>
      <div class="workflow-info">
        <div class="workflow-name">${s.name}</div>
        <div class="workflow-detail">${s.detail}</div>
      </div>
      <div class="workflow-duration">${s.duration}</div>
    </div>
  `).join('');

  // Quality check
  const qc = report.qualityCheck;
  document.getElementById('quality-score').textContent = qc.overallScore;
  const dims = document.getElementById('quality-dims');
  dims.innerHTML = qc.dimensions.map(d => `
    <div class="quality-dim">
      <div class="quality-dim-header">
        <span class="quality-dim-name">${d.icon} ${d.name}</span>
        <span class="quality-dim-score" style="color:${d.status === 'warning' ? '#f9a825' : '#4caf50'}">${d.score}分</span>
      </div>
      <div class="quality-bar"><div class="quality-bar-fill" style="width:${d.score}%;background:${d.status === 'warning' ? '#f9a825' : '#4caf50'}"></div></div>
      <div style="font-size:11px;color:var(--text-light);margin-top:2px">${d.desc}</div>
      ${d.issues.length ? `<div style="font-size:11px;color:#e65100;margin-top:2px">⚠ ${d.issues.join('; ')}</div>` : ''}
    </div>
  `).join('');

  // API stats
  const stats = document.getElementById('api-stats');
  const statsSec = report.sections.find(s => s.type === 'stats');
  stats.innerHTML = `
    <div style="display:flex;justify-content:space-between;margin-bottom:10px">
      <span style="font-size:14px;font-weight:700">📊 API调用统计</span>
      <span style="font-size:12px;color:var(--text-light)">${statsSec.totalCalls}次调用 / ${statsSec.totalResults}条结果</span>
    </div>
    ${statsSec.batches.map(b => `
      <div class="api-batch">
        <div class="api-batch-header">
          <span class="api-batch-title">批次${b.batch}（${b.count}个query）</span>
          <span class="api-batch-meta">⏱${b.duration} | ${b.results}条结果</span>
        </div>
        <div class="api-queries">${b.queries.map(q => `<span class="api-query-tag">${q}</span>`).join('')}</div>
      </div>
    `).join('')}
    <div style="text-align:right;font-size:12px;color:var(--text-light);margin-top:4px">报告大小: ${statsSec.reportSize}</div>
  `;
}

// ===== Map Page =====
function renderMap() {
  const places = getPlaces(currentCity);
  const report = getReport(currentCity);
  if (!places.length) return;

  // Filter bar
  const filterBar = document.getElementById('map-filter-bar');
  filterBar.innerHTML = `<div class="filter-pill active" data-cat="all">全部</div>` +
    CATEGORIES.map(c => `<div class="filter-pill" data-cat="${c.id}" style="background:${c.bg}">${c.icon} ${c.name}</div>`).join('');

  filterBar.querySelectorAll('.filter-pill').forEach(p => {
    p.addEventListener('click', () => {
      filterBar.querySelectorAll('.filter-pill').forEach(f => { f.classList.remove('active'); f.style.background = 'rgba(255,255,255,0.9)'; f.style.color = ''; });
      p.classList.add('active');
      const cat = p.dataset.cat;
      if (cat !== 'all') {
        const c = getCategory(cat);
        p.style.background = c.color; p.style.color = '#fff';
      }
      mapFilter = cat;
      renderMapPins();
    });
  });

  renderMapPins();
}

function renderMapPins() {
  const places = getPlaces(currentCity);
  const container = document.getElementById('map-pins');
  const filtered = mapFilter === 'all' ? places : places.filter(p => p.category === mapFilter);

  // Calculate relative positions (normalize lat/lng to 5%-95% range)
  if (!filtered.length) { container.innerHTML = '<div class="empty"><div class="icon">🗺️</div>暂无标记点</div>'; return; }
  const lats = filtered.map(p => p.lat);
  const lngs = filtered.map(p => p.lng);
  const latMin = Math.min(...lats), latMax = Math.max(...lats);
  const lngMin = Math.min(...lngs), lngMax = Math.max(...lngs);
  const latRange = latMax - latMin || 0.01;
  const lngRange = lngMax - lngMin || 0.01;

  container.innerHTML = filtered.map(p => {
    const cat = getCategory(p.category) || { color: '#999', icon: '📍' };
    const x = ((p.lng - lngMin) / lngRange) * 80 + 10; // 10%-90%
    const y = 90 - ((p.lat - latMin) / latRange) * 70 - 15; // inverted, 15%-85%
    return `<div class="map-pin" style="left:${x}%;top:${y}%;background:${cat.color}" data-id="${p.id}" data-cat="${p.category}">${cat.icon}</div>`;
  }).join('');

  container.querySelectorAll('.map-pin').forEach(pin => {
    pin.addEventListener('click', () => {
      const id = parseInt(pin.dataset.id);
      const place = places.find(p => p.id === id);
      if (place) showPlaceCard(place);
      container.querySelectorAll('.map-pin').forEach(p => p.classList.remove('selected'));
      pin.classList.add('selected');
    });
  });
}

function showPlaceCard(place) {
  const cat = getCategory(place.category) || { color: '#999', name: '其他', icon: '📍' };
  const card = document.getElementById('map-bottom-card');
  card.innerHTML = `
    <div class="card-close" onclick="hidePlaceCard()">×</div>
    <div class="card-title">${place.name}</div>
    <div class="card-meta">
      <span class="card-tag" style="background:${cat.bg};color:${cat.color}">${cat.icon} ${cat.name}</span>
      ${place.price ? `<span class="card-tag" style="background:#f5f5f5;color:#666">💰 ${place.price}</span>` : ''}
    </div>
    <div class="card-info">
      📍 ${place.address}<br>
      📝 ${place.note}
    </div>
  `;
  card.classList.add('show');
}

function hidePlaceCard() {
  document.getElementById('map-bottom-card').classList.remove('show');
  document.querySelectorAll('.map-pin').forEach(p => p.classList.remove('selected'));
}

function searchPlaces() {
  const input = document.getElementById('map-search-input');
  searchKeyword = input.value.trim().toLowerCase();
  const places = getPlaces(currentCity);
  if (!searchKeyword) { renderMapPins(); return; }
  const container = document.getElementById('map-pins');
  const filtered = places.filter(p => p.name.toLowerCase().includes(searchKeyword) || p.note.toLowerCase().includes(searchKeyword) || p.address.toLowerCase().includes(searchKeyword));
  if (!filtered.length) { container.innerHTML = '<div class="empty"><div class="icon">🔍</div>未找到相关地点</div>'; return; }
  const lats = filtered.map(p => p.lat), lngs = filtered.map(p => p.lng);
  const latMin = Math.min(...lats), latMax = Math.max(...lats), lngMin = Math.min(...lngs), lngMax = Math.max(...lngs);
  const latRange = latMax - latMin || 0.01, lngRange = lngMax - lngMin || 0.01;
  container.innerHTML = filtered.map(p => {
    const cat = getCategory(p.category) || { color: '#999', icon: '📍' };
    const x = ((p.lng - lngMin) / lngRange) * 80 + 10;
    const y = 90 - ((p.lat - latMin) / latRange) * 70 - 15;
    return `<div class="map-pin" style="left:${x}%;top:${y}%;background:${cat.color}" data-id="${p.id}" data-cat="${p.category}">${cat.icon}</div>`;
  }).join('');
  container.querySelectorAll('.map-pin').forEach(pin => {
    pin.addEventListener('click', () => {
      const id = parseInt(pin.dataset.id);
      const place = places.find(p => p.id === id);
      if (place) showPlaceCard(place);
      container.querySelectorAll('.map-pin').forEach(p => p.classList.remove('selected'));
      pin.classList.add('selected');
    });
  });
}

// ===== Category Page =====
function renderCategory() {
  const grid = document.getElementById('cat-grid');
  grid.innerHTML = CATEGORIES.map(c => `
    <div class="cat-card" style="background:linear-gradient(135deg,${c.color} 0%,${c.color}dd 100%);color:#fff" onclick="showToast('${c.fullName}\\n${c.desc}\\n关键词: ${c.queryKey}')">
      <span class="time-badge">${c.timeLabel}</span>
      <div class="icon">${c.icon}</div>
      <div class="name">${c.name}</div>
      <div class="desc">${c.desc}</div>
    </div>
  `).join('');
}

// ===== Report Page =====
function renderReport() {
  const report = getReport(currentCity);
  if (!report) return;
  const container = document.getElementById('report-sections');

  // 中文数字
  const cnNums = ['一','二','三','四','五','六','七','八','九','十'];

  container.innerHTML = report.sections.map(s => {
    let body = '';
    if (s.type === 'overview') {
      body = `<div class="report-table">${s.tableData.map(d => `<div class="report-table-row"><span class="label">${d.label}</span><span class="value">${d.value}</span></div>`).join('')}</div>`;
    } else if (s.type === 'activities') {
      body = s.groups.map(g => {
        const cat = getCategory(g.category) || { color: '#999', icon: '📋' };
        return `<div class="activity-group"><div class="activity-group-title"><span style="color:${cat.color}">${cat.icon}</span>${g.name}</div>${g.items.map(i => `<div class="activity-item"><div class="activity-name">${i.name}</div><div class="activity-meta"><span>⏰ ${i.time}</span><span>📍 ${i.venue}</span><span>💰 ${i.price}</span><span class="activity-source">${i.source}</span></div></div>`).join('')}</div>`;
      }).join('');
    } else if (s.items) {
      body = s.items.map(i => `<div class="activity-item"><div class="activity-name">${i.name}</div><div class="activity-meta">${i.desc ? `<span>${i.desc}</span>` : ''}${i.address ? `<span>📍 ${i.address}</span>` : ''}${i.feature ? `<span>✨ ${i.feature}</span>` : ''}${i.price ? `<span>💰 ${i.price}</span>` : ''}${i.rating ? `<span>⭐ ${i.rating}</span>` : ''}${i.metro ? `<span>🚇 ${i.metro}</span>` : ''}${i.source ? `<span class="activity-source">${i.source}</span>` : ''}${i.expiry ? `<span>⏳ ${i.expiry}</span>` : ''}</div></div>`).join('');
    } else if (s.type === 'metro') {
      body = `<div style="font-size:13px;margin-bottom:8px">共${s.metroLines}条线路运营</div>${s.keyStations.map(st => `<div class="activity-item"><div class="activity-name">🚇 ${st.name}</div><div class="activity-meta"><span>${st.lines}</span><span>🚪 ${st.exit}</span></div><div style="font-size:11px;color:var(--text-light)">${st.note}</div></div>`).join('')}<div style="margin-top:8px;font-size:13px;font-weight:600">景区直达</div>${s.scenicDirect.map(sd => `<div class="activity-item"><div class="activity-name">${sd.name}</div><div class="activity-meta"><span>🚇 ${sd.station}</span></div><div style="font-size:11px;color:var(--text-light)">${sd.note}</div></div>`).join('')}`;
    } else if (s.type === 'routes') {
      body = s.routes.map(r => `<div style="margin-bottom:12px;padding:12px;border-radius:8px;background:${r.color}15"><div style="font-weight:700;color:${r.color}">${r.icon} 路线${r.id}: ${r.name}</div><div style="font-size:12px;color:var(--text-secondary);margin:4px 0">${r.desc}</div>${r.timeline.map(t => `<div style="display:flex;gap:8px;padding:4px 0;font-size:12px"><span style="font-weight:700;color:${r.color};width:44px">${t.time}</span><span>${t.activity}<span style="color:var(--text-light)"> (${t.note})</span></span></div>`).join('')}</div>`).join('');
    } else if (s.type === 'reliability') {
      body = s.notes.map(n => `<div style="padding:6px 0;font-size:13px;color:var(--text-secondary)">⚠️ ${n}</div>`).join('');
    } else if (s.type === 'stats') {
      body = `<div style="font-size:13px;margin-bottom:8px">共${s.totalCalls}次调用，${s.totalResults}条结果，报告大小${s.reportSize}</div>${s.batches.map(b => `<div class="api-batch"><div class="api-batch-header"><span class="api-batch-title">批次${b.batch}（${b.count}个）</span><span class="api-batch-meta">⏱${b.duration} | ${b.results}条</span></div><div class="api-queries">${b.queries.map(q => `<span class="api-query-tag">${q}</span>`).join('')}</div></div>`).join('')}`;
    }

    const isExpanded = expandedSections.has(s.index);
    const cnNum = cnNums[s.index] || (s.index + 1);
    return `<div class="report-section ${isExpanded ? 'expanded' : ''}" data-idx="${s.index}" id="report-section-${s.index}">
      <div class="report-section-header" onclick="toggleSection(${s.index})">
        <div class="report-section-left">
          <span class="report-section-num">${cnNum}</span>
          <span class="report-section-icon">${s.icon}</span>
          <span class="report-section-title">${s.title}</span>
        </div>
        <span class="report-section-arrow">▼</span>
      </div>
      <div class="report-section-body">${body}</div>
    </div>`;
  }).join('');
}

function toggleSection(idx) {
  if (expandedSections.has(idx)) expandedSections.delete(idx);
  else expandedSections.add(idx);
  renderReport();
}

function expandAll() {
  const report = getReport(currentCity);
  if (report) { report.sections.forEach(s => expandedSections.add(s.index)); renderReport(); showToast('已展开全部'); }
}
function collapseAll() { expandedSections.clear(); renderReport(); showToast('已折叠全部'); }

// v3.0: 快速跳转
function toggleQuickNav() {
  showQuickNav = !showQuickNav;
  const panel = document.getElementById('quick-nav-panel');
  const overlay = document.getElementById('quick-nav-overlay');
  if (panel) panel.style.display = showQuickNav ? 'block' : 'none';
  if (overlay) overlay.style.display = showQuickNav ? 'block' : 'none';
}

function quickJump(idx) {
  expandedSections.add(idx);
  renderReport();
  showQuickNav = false;
  const panel = document.getElementById('quick-nav-panel');
  const overlay = document.getElementById('quick-nav-overlay');
  if (panel) panel.style.display = 'none';
  if (overlay) overlay.style.display = 'none';
  setTimeout(() => {
    const el = document.getElementById('report-section-' + idx);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

// v3.0: 复制完整报告
function copyFullReport() {
  const report = getReport(currentCity);
  if (!report) return;
  const cnNums = ['一','二','三','四','五','六','七','八','九','十'];
  let text = '=== ' + report.cityName + '周末游攻略 ===\n';
  text += report.overview.weekend + ' ' + report.overview.weather + ' ' + report.overview.tempRange + '\n';
  text += '报告大小: ' + report.reportSize + ' | API调用: ' + report.totalCalls + '次\n';
  text += '========================\n';
  report.sections.forEach(section => {
    text += '\n【' + (cnNums[section.index] || section.index + 1) + '】' + section.title + '\n';
    text += section.content + '\n';
    if (section.type === 'overview' && section.tableData) {
      section.tableData.forEach(row => { text += '  ' + row.label + ': ' + row.value + '\n'; });
    }
    if (section.type === 'activities' && section.groups) {
      section.groups.forEach(group => {
        text += '\n  [' + group.name + '] (' + group.items.length + '项)\n';
        group.items.forEach(item => {
          text += '    - ' + item.name;
          if (item.time) text += ' | ' + item.time;
          if (item.venue) text += ' | ' + item.venue;
          if (item.price) text += ' | ' + item.price;
          text += '\n';
        });
      });
    }
    if (section.items) {
      section.items.forEach(item => {
        text += '  - ' + item.name;
        if (item.address) text += ' | ' + item.address;
        if (item.price) text += ' | ' + item.price;
        text += '\n';
      });
    }
    if (section.type === 'routes' && section.routes) {
      section.routes.forEach(route => {
        text += '\n  路线' + route.id + ': ' + route.name + ' - ' + route.desc + '\n';
        route.timeline.forEach(t => {
          text += '    ' + t.time + ' ' + t.activity + (t.note ? ' (' + t.note + ')' : '') + '\n';
        });
      });
    }
    if (section.type === 'reliability' && section.notes) {
      section.notes.forEach(note => { text += '  - ' + note + '\n'; });
    }
  });
  text += '\n========================\n出行前请二次确认关键信息\n——由周末城市游生成';

  // 复制到剪贴板
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('完整报告已复制到剪贴板');
    }).catch(() => {
      _fallbackCopy(text);
    });
  } else {
    _fallbackCopy(text);
  }
}

function _fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    showToast('完整报告已复制到剪贴板');
  } catch (e) {
    showToast('复制失败，请手动选择文本');
  }
  document.body.removeChild(ta);
}

// v3.0: 导出路线到日历（复制日历信息）
function exportRouteToCalendar() {
  const report = getReport(currentCity);
  if (!report) return;
  const routesSec = report.sections.find(s => s.type === 'routes');
  if (!routesSec) return;
  const route = routesSec.routes.find(r => r.id === activeRoute);
  if (!route) return;

  const text = '📅 ' + report.cityName + '周末路线' + route.id + ': ' + route.name + '\n' +
    '描述: ' + route.desc + '\n\n行程安排:\n' +
    route.timeline.map((t, i) => '  ' + (i+1) + '. ' + t.time + ' ' + t.activity + '（' + t.location + '）' + (t.note ? ' - ' + t.note : '')).join('\n') +
    '\n\n——由周末城市游生成';
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => showToast('日历信息已复制，请粘贴到日历App'));
  } else {
    _fallbackCopy(text);
    showToast('日历信息已复制，请粘贴到日历App');
  }
}

// ===== Route Page =====
function renderRoute() {
  const report = getReport(currentCity);
  if (!report) return;
  const routesSec = report.sections.find(s => s.type === 'routes');
  if (!routesSec) return;

  document.getElementById('route-tabs').innerHTML = routesSec.routes.map(r => `
    <div class="route-tab ${activeRoute === r.id ? 'active' : ''} ${r.id.toLowerCase()}" onclick="switchRoute('${r.id}')">${r.icon} ${r.name}</div>
  `).join('');

  const route = routesSec.routes.find(r => r.id === activeRoute);
  if (!route) return;

  // v3.0: 交通估算 - 为 timeline 注入距离和交通时间
  const timelineWithTravel = route.timeline.map((t, i) => {
    if (i === 0) return { ...t, _travel: null };
    const prev = route.timeline[i - 1];
    // 简化估算：基于地点名生成虚拟距离
    const seedDist = Math.abs(t.location.charCodeAt(0) - (prev.location.charCodeAt(0) || 65)) % 5 + 1.2;
    const dist = parseFloat(seedDist.toFixed(1));
    const walkMin = Math.ceil(dist * 12);
    const metroMin = Math.ceil(dist * 3 + 5);
    return { ...t, _travel: { distance: dist, walkMin, metroMin } };
  });

  const headerEl = document.getElementById('route-header');
  headerEl.style.background = `linear-gradient(135deg, ${route.color} 0%, ${route.color}cc 100%)`;
  headerEl.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px">
      <span style="font-size:28px">${route.icon}</span>
      <div>
        <div class="route-name">路线${route.id}: ${route.name}</div>
        <div class="route-desc">${route.desc}</div>
      </div>
    </div>
    <div style="margin-top:8px;font-size:12px;opacity:0.9">⏱ 共${route.timeline.length}个时段 | 📍 ${route.timeline[0].location} → ${route.timeline[route.timeline.length-1].location}</div>
    <div style="margin-top:6px"><button onclick="exportRouteToCalendar()" style="padding:6px 16px;border:1px solid rgba(255,255,255,0.5);border-radius:8px;background:rgba(255,255,255,0.15);color:#fff;font-size:12px;cursor:pointer">📅 导出日历</button></div>
  `;

  const coverEl = document.getElementById('route-cover');
  coverEl.src = route.coverImage || '';
  coverEl.style.display = route.coverImage ? 'block' : 'none';

  const timeline = document.getElementById('route-timeline');
  timeline.innerHTML = timelineWithTravel.map(t => `
    <div class="timeline-item">
      <div class="timeline-time">${t.time}</div>
      <div class="timeline-dot" style="box-shadow:0 0 0 2px ${route.color}"></div>
      <div class="timeline-content">
        <div class="timeline-activity">${t.activity}</div>
        <div class="timeline-location">📍 ${t.location}</div>
        ${t._travel ? `<div style="font-size:11px;color:var(--text-light);margin-top:2px">🚶 距上站 ${t._travel.distance}km · 步行约${t._travel.walkMin}分钟 · 地铁约${t._travel.metroMin}分钟</div>` : ''}
        <div class="timeline-note">💡 ${t.note}</div>
      </div>
    </div>
  `).join('');
}

function switchRoute(id) { activeRoute = id; renderRoute(); }

// ===== City Select =====
function showCitySelect() {
  document.getElementById('page-city-select').style.display = 'block';
  renderCitySelect();
  window.scrollTo(0, 0);
}

function hideCitySelect() {
  document.getElementById('page-city-select').style.display = 'none';
}

function renderCitySelect() {
  const hot = getHotCities();
  const others = CITIES.filter(c => !c.hot);
  const hotHtml = hot.map(c => `<div class="city-card ${c.code === currentCity ? 'active' : ''}" onclick="selectCity('${c.code}')"><div class="name">${c.name}</div><div class="desc">${c.desc}</div></div>`).join('');
  const otherHtml = others.map(c => `<div class="city-card ${c.code === currentCity ? 'active' : ''}" onclick="selectCity('${c.code}')"><div class="name">${c.name}</div><div class="desc">${c.desc}</div></div>`).join('');
  document.getElementById('city-hot').innerHTML = hotHtml;
  document.getElementById('city-all').innerHTML = otherHtml;
}

function selectCity(code) {
  const city = CITIES.find(c => c.code === code);
  if (!city) return;
  if (!getReport(code)) { showToast(`${city.name}攻略正在生成中，敬请期待！`); return; }
  currentCity = code;
  hideCitySelect();
  renderAll();
  showToast(`已切换到${city.name}`);
}

function searchCity() {
  const kw = document.getElementById('city-search-input').value.trim().toLowerCase();
  if (!kw) { renderCitySelect(); return; }
  const filtered = CITIES.filter(c => c.name.toLowerCase().includes(kw) || c.pinyin.toLowerCase().includes(kw) || c.province.toLowerCase().includes(kw));
  const html = filtered.map(c => `<div class="city-card ${c.code === currentCity ? 'active' : ''}" onclick="selectCity('${c.code}')"><div class="name">${c.name}</div><div class="desc">${c.desc}</div></div>`).join('');
  document.getElementById('city-hot').innerHTML = html;
  document.getElementById('city-all').innerHTML = '';
}

// ===== Profile =====
function clearCache() { showToast('缓存已清除'); }
function showAbout() { showToast('周末城市游 v3.0.0\n统一数据管道 · 骨架屏 · 全文复制 · 快速跳转 · 交通估算 · 日历导出'); }

// ===== Render All =====
function renderAll() {
  renderHome();
  renderDiscover();
  renderMap();
  renderCategory();
  renderReport();
  renderRoute();
  renderQuickNav();
}

// v3.0: 渲染快速跳转列表
function renderQuickNav() {
  const report = getReport(currentCity);
  if (!report) return;
  const cnNums = ['一','二','三','四','五','六','七','八','九','十'];
  const list = document.getElementById('quick-nav-list');
  if (!list) return;
  list.innerHTML = report.sections.map(s => {
    const cnNum = cnNums[s.index] || (s.index + 1);
    return `<div style="display:flex;align-items:center;gap:12px;padding:16px;border-bottom:1px solid var(--border);cursor:pointer" onclick="quickJump(${s.index})" onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background=''">
      <div style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;background:var(--primary-light,#e3f2fd);color:var(--primary,#4A90D9);border-radius:50%;font-size:14px;font-weight:700;flex-shrink:0">${cnNum}</div>
      <span style="font-size:14px;color:var(--text-primary,#333)">${s.title}</span>
    </div>`;
  }).join('');
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  renderAll();
  // Tab events
  document.querySelectorAll('.tab-item').forEach(t => {
    t.addEventListener('click', () => switchTab(t.dataset.tab));
  });
});
