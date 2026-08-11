// data.js - 周末城市游 Web 版数据（从微信小程序 mockData.js + categories.js 转换）

// 11个调查方向配置
const CATEGORIES = [
  { id: 'concert', name: '演唱会', fullName: '演唱会/音乐会', letter: 'C', color: '#d32f2f', icon: '🎤', bg: 'rgba(211,47,47,0.1)', timeSensitivity: 'strong', timeLabel: '强时效', desc: '演唱会、音乐节、Livehouse排期', value: '演出排期是周末出行的核心决策因素', queryKey: '演唱会 音乐会 排期' },
  { id: 'sport', name: '球赛', fullName: '体育赛事', letter: 'S', color: '#7b1fa2', icon: '⚽', bg: 'rgba(123,31,162,0.1)', timeSensitivity: 'strong', timeLabel: '强时效', desc: '中超/CBA主场、马拉松等赛事', value: '主场比赛安排直接影响周末行程', queryKey: '中超 CBA 马拉松 赛程' },
  { id: 'market', name: '集市', fullName: '集市/夜市', letter: 'M', color: '#f9a825', icon: '🎠', bg: 'rgba(249,168,37,0.1)', timeSensitivity: 'medium', timeLabel: '中时效', desc: '创意市集、文创夜市、主题快闪', value: '创意市集是年轻人的新兴目的地', queryKey: '市集 创意 夜市 周末' },
  { id: 'museum', name: '博物馆', fullName: '博物馆/美术馆', letter: 'U', color: '#1565c0', icon: '🏛️', bg: 'rgba(21,101,192,0.1)', timeSensitivity: 'weak', timeLabel: '弱时效', desc: '博物馆、美术馆、特色展览', value: '长期资源 + 当前展览信息', queryKey: '博物馆 美术馆 展览 免费' },
  { id: 'scenic', name: '5A景区', fullName: '5A/4A景区', letter: '5', color: '#e65100', icon: '🏜️', bg: 'rgba(230,81,0,0.1)', timeSensitivity: 'weak', timeLabel: '弱时效', desc: '城市核心景区清单与门票', value: '城市必去核心景区', queryKey: '5A景区 4A景区 门票' },
  { id: 'tea', name: '喜茶门店', fullName: '喜茶旗舰+购物中心', letter: 'H', color: '#ec407a', icon: '🍵', bg: 'rgba(236,64,122,0.1)', timeSensitivity: 'weak', timeLabel: '弱时效', desc: '喜茶旗舰店、主题门店、商场指引', value: '品牌文化打卡 + 商场指引', queryKey: '喜茶 旗舰店 购物中心' },
  { id: 'food', name: '美食街', fullName: '美食街/老字号', letter: 'F', color: '#ad1457', icon: '🍝', bg: 'rgba(173,20,87,0.1)', timeSensitivity: 'weak', timeLabel: '弱时效', desc: '本地人真正会去的美食街', value: '地道美食聚集地推荐', queryKey: '美食街 老字号 夜宵' },
  { id: 'walk', name: 'City Walk', fullName: 'City Walk路线', letter: 'W', color: '#00838f', icon: '🚶', bg: 'rgba(0,131,143,0.1)', timeSensitivity: 'weak', timeLabel: '弱时效', desc: '经典步行路线与拍照点', value: '城市漫步探索路线', queryKey: 'city walk 步行路线 拍照' },
  { id: 'ticket', name: '优惠门票', fullName: '优惠门票/特惠', letter: 'T', color: '#2e7d32', icon: '🎟️', bg: 'rgba(46,125,50,0.1)', timeSensitivity: 'medium', timeLabel: '中时效', desc: '暑期特惠、考生免费等省钱信息', value: '省钱攻略与限时优惠', queryKey: '优惠 特惠 免费 门票' },
  { id: 'mall', name: '购物中心', fullName: '商场/购物中心', letter: 'L', color: '#4527a0', icon: '🛒', bg: 'rgba(69,39,160,0.1)', timeSensitivity: 'weak', timeLabel: '弱时效', desc: '大型购物中心、百货商场', value: '购物休闲一站式目的地', queryKey: '购物中心 商场 百货' },
  { id: 'metro', name: '地铁路线', fullName: '地铁线网+站点', letter: 'D', color: '#546e7a', icon: '🚇', bg: 'rgba(84,110,122,0.1)', timeSensitivity: 'weak', timeLabel: '弱时效', desc: '线网总览 + 关键站点出口', value: '出行交通参考', queryKey: '地铁线路 出口 换乘' }
];

// 城市列表
const CITIES = [
  { code: 'guangzhou', name: '广州', province: '广东', pinyin: 'Guangzhou', hot: true, desc: '花城羊城，食在广东' },
  { code: 'shenzhen', name: '深圳', province: '广东', pinyin: 'Shenzhen', hot: true, desc: '科技之都，滨海之城' },
  { code: 'chengdu', name: '成都', province: '四川', pinyin: 'Chengdu', hot: true, desc: '天府之国，闲适之城' },
  { code: 'shanghai', name: '上海', province: '上海', pinyin: 'Shanghai', hot: true, desc: '魔都风情，海派文化' },
  { code: 'beijing', name: '北京', province: '北京', pinyin: 'Beijing', hot: true, desc: '帝都风华，千年古都' },
  { code: 'hangzhou', name: '杭州', province: '浙江', pinyin: 'Hangzhou', hot: false, desc: '人间天堂，西湖印象' },
  { code: 'chongqing', name: '重庆', province: '重庆', pinyin: 'Chongqing', hot: false, desc: '山城雾都，8D魔幻' },
  { code: 'xiamen', name: '厦门', province: '福建', pinyin: 'Xiamen', hot: false, desc: '海上花园，文艺之城' },
  { code: 'nanjing', name: '南京', province: '江苏', pinyin: 'Nanjing', hot: false, desc: '六朝古都，金陵风韵' },
  { code: 'wuhan', name: '武汉', province: '湖北', pinyin: 'Wuhan', hot: false, desc: '江城武汉，九省通衢' },
  { code: 'xian', name: '西安', province: '陕西', pinyin: 'Xian', hot: true, desc: '千年古都，丝路起点' },
  { code: 'changsha', name: '长沙', province: '湖南', pinyin: 'Changsha', hot: true, desc: '星城长沙，网红美食' },
  { code: 'suzhou', name: '苏州', province: '江苏', pinyin: 'Suzhou', hot: false, desc: '东方威尼斯，园林之城' },
  { code: 'qingdao', name: '青岛', province: '山东', pinyin: 'Qingdao', hot: false, desc: '红瓦绿树，碧海蓝天' },
  { code: 'kunming', name: '昆明', province: '云南', pinyin: 'Kunming', hot: false, desc: '春城昆明，四季如春' },
  { code: 'dalian', name: '大连', province: '辽宁', pinyin: 'Dalian', hot: false, desc: '北方明珠，浪漫海滨' },
  { code: 'tianjin', name: '天津', province: '天津', pinyin: 'Tianjin', hot: false, desc: '津门故里，曲艺之乡' },
  { code: 'zhengzhou', name: '郑州', province: '河南', pinyin: 'Zhengzhou', hot: false, desc: '中原枢纽，黄帝故里' },
  { code: 'guilin', name: '桂林', province: '广西', pinyin: 'Guilin', hot: false, desc: '山水甲天下' }
];

// 广州完整报告
const GUANGZHOU_REPORT = {
  cityCode: 'guangzhou', cityName: '广州', generatedAt: '2026-07-30', totalCalls: 13, reportSize: '27.5KB',
  overview: {
    weather: '多云转晴', tempRange: '26-34°C', weekend: '8月1日-8月2日',
    metroLines: 16, scenic5A: 3, concertCount: 5, marketCount: 4, museumCount: 8,
    foodStreetCount: 5, cityWalkCount: 3, teaShopCount: 4,
    highlights: ['张韶涵「寓言」世界巡回演唱会广州站', '广州大剧院话剧《雷雨》', '天河城创意市集周末限定', '广东省博物馆敦煌特展']
  },
  sections: [
    { index: 0, title: '一图速览', type: 'overview', icon: '📈', content: '10秒拿到广州本周末核心情报',
      summary: '广州本周末多云转晴26-34°C，5场演出+4个市集+8个博物馆展览，3条CityWalk路线，4家喜茶旗舰店。',
      tableData: [
        { label: '天气', value: '多云转晴 26-34°C' }, { label: '周末', value: '8月1日(六)-8月2日(日)' },
        { label: '地铁线路', value: '16条运营' }, { label: '5A景区', value: '3个' },
        { label: '演出活动', value: '5场' }, { label: '创意市集', value: '4个' },
        { label: '博物馆展览', value: '8个' }, { label: '美食街', value: '5条' },
        { label: 'CityWalk', value: '3条路线' }, { label: '喜茶旗舰店', value: '4家' }
      ] },
    { index: 1, title: '活动全清单', type: 'activities', icon: '🎯', content: '演唱会/集市/球赛/博物馆/5A景区全汇总',
      groups: [
        { category: 'concert', name: '演唱会/演出', items: [
          { name: '张韶涵「寓言」世界巡回演唱会广州站', time: '8月1日 19:30', venue: '广州体育馆', price: '380-1280元', source: '大麦网' },
          { name: '广州大剧院话剧《雷雨》', time: '8月2日 19:30', venue: '广州大剧院', price: '180-680元', source: '大麦网' },
          { name: 'Livehouse | 棱镜乐队广州专场', time: '8月1日 20:00', venue: 'MAO Livehouse', price: '120元', source: '秀动' },
          { name: '草莓音乐节广州站', time: '8月2日 14:00', venue: '大学城体育中心', price: '299-599元', source: '大麦网' },
          { name: '广东音乐曲艺团周末专场', time: '8月2日 15:00', venue: '粤剧艺术博物馆', price: '50-120元', source: '大众点评' }
        ]},
        { category: 'market', name: '集市/夜市', items: [
          { name: '天河城创意市集', time: '8月1-2日 10:00-22:00', venue: '天河城北广场', price: '免费', source: '小红书' },
          { name: '永庆坊手作市集', time: '每周六日 11:00-20:00', venue: '永庆坊', price: '免费', source: '小红书' },
          { name: '琶醍夜市', time: '每晚18:00-凌晨', venue: '珠江琶醍', price: '免费', source: '大众点评' },
          { name: '东方宝泰周末市集', time: '8月2日 10:00-21:00', venue: '东方宝泰广场', price: '免费', source: '小红书' }
        ]},
        { category: 'sport', name: '球赛', items: [
          { name: '中超第18轮 广州队vs上海海港', time: '8月1日 19:35', venue: '越秀山体育场', price: '80-380元', source: '大麦网' },
          { name: 'CBA夏季联赛 广州龙狮vs深圳马可波罗', time: '8月2日 19:30', venue: '天河体育馆', price: '50-280元', source: '大麦网' }
        ]},
        { category: 'museum', name: '博物馆/展览', items: [
          { name: '广东省博物馆 - 敦煌艺术大展', time: '周二至日 9:00-17:00', venue: '珠江新城', price: '免费(需预约)', source: '粤博官网' },
          { name: '广州博物馆 - 海上丝绸之路特展', time: '周二至日 9:00-17:30', venue: '越秀山镇海楼', price: '10元', source: '大众点评' },
          { name: '广东美术馆 - 当代水墨展', time: '周二至日 9:00-17:00', venue: '二沙岛', price: '免费', source: '广东美术馆' },
          { name: '西汉南越王博物馆', time: '周二至日 9:00-17:30', venue: '解放北路', price: '12元', source: '大众点评' },
          { name: '广州艺术博物院', time: '周二至日 9:00-17:00', venue: '麓湖路', price: '免费', source: '大众点评' }
        ]},
        { category: 'scenic', name: '5A景区', items: [
          { name: '白云山风景名胜区', time: '全天开放', venue: '白云区', price: '5元(索道25元)', source: '高德地图' },
          { name: '长隆旅游度假区', time: '9:30-18:00', venue: '番禺区', price: '350元起', source: '长隆官网' },
          { name: '陈家祠(陈氏书院)', time: '8:30-17:30', venue: '中山七路', price: '10元', source: '大众点评' }
        ]}
      ] },
    { index: 2, title: '优惠门票', type: 'ticket', icon: '🎟️', content: '暑期特惠、考生免费等省钱信息',
      items: [
        { name: '长隆水上乐园暑期特惠', desc: '中高考生凭准考证享7折', price: '原350元→245元', source: '长隆官网', expiry: '8月31日' },
        { name: '白云山+云台花园联票', desc: '周末限时8折优惠', price: '原30元→24元', source: '美团', expiry: '8月2日' },
        { name: '广东省博物馆免费导览', desc: '周末免费人工讲解（需预约）', price: '免费', source: '粤博公众号', expiry: '长期' },
        { name: '广州塔登塔票晚场特惠', desc: '20:00后入场8折', price: '原150元→120元', source: '广州塔官网', expiry: '8月31日' },
        { name: '珠江夜游学生票', desc: '学生证半价', price: '原88元→44元', source: '大众点评', expiry: '9月1日' }
      ] },
    { index: 3, title: '喜茶门店热点', type: 'tea', icon: '🍵', content: '品牌文化打卡 + 商场指引',
      items: [
        { name: '喜茶广州首家旗舰店', address: '天河区天环广场L1', feature: '品牌旗舰店，设计感强', metro: '体育西路站D出口', source: '喜茶GO' },
        { name: '喜茶永庆坊主题店', address: '荔湾区永庆坊', feature: '岭南文化主题装修', metro: '黄沙站B出口', source: '小红书' },
        { name: '喜茶太古汇DP店', address: '天河区太古汇L3', feature: '灵感设计店，限定周边', metro: '石牌桥站D出口', source: '喜茶GO' },
        { name: '喜茶正佳广场店', address: '天河区正佳广场负一层', feature: '周边文创丰富', metro: '体育中心站A出口', source: '大众点评' }
      ] },
    { index: 4, title: '美食街', type: 'food', icon: '🍝', content: '本地人真正会去的美食街',
      items: [
        { name: '北京路美食街', address: '越秀区北京路', feature: '老字号集中，游客友好', metro: '北京路站', rating: 4.3, source: '大众点评' },
        { name: '上下九步行街', address: '荔湾区上下九路', feature: '广州传统美食地标', metro: '长寿路站', rating: 4.5, source: '大众点评' },
        { name: '体育西横街', address: '天河区体育西', feature: '年轻人美食聚集地', metro: '体育西路站', rating: 4.4, source: '小红书' },
        { name: '西关老街美食', address: '荔湾区宝源路', feature: '地道西关味，本地人推荐', metro: '长寿路站', rating: 4.6, source: '大众点评' },
        { name: '建设六马路', address: '越秀区建设六马路', feature: '异国风味一条街', metro: '淘金站A出口', rating: 4.2, source: '小红书' }
      ] },
    { index: 5, title: 'City Walk路线', type: 'walk', icon: '🚶', content: '经典步行路线与拍照点',
      items: [
        { name: '路线A：沙面→沿江西路→永庆坊', duration: '约3小时', distance: '4.5km', highlights: '沙面欧式建筑群、粤海关旧址、永庆坊文创', photoSpots: '沙面教堂前、沿江路夕阳、永庆坊拱门', metro: '黄沙站出发，长寿路站结束', source: '小红书' },
        { name: '路线B：二沙岛艺术环线', duration: '约2.5小时', distance: '3.2km', highlights: '广东美术馆、星海音乐厅、江边日落', photoSpots: '星海音乐厅外、二沙岛江边长椅', metro: '海心沙站出发', source: '小红书' },
        { name: '路线C：东山口洋楼区', duration: '约2小时', distance: '2.8km', highlights: '民国洋楼群、东山湖公园、庙前西街', photoSpots: '东山口红砖洋楼、庙前西街咖啡馆', metro: '东山口站F出口', source: '小红书' }
      ] },
    { index: 6, title: '地铁路线', type: 'metro', icon: '🚇', content: '线网总览 + 关键站点出口', metroLines: 16,
      keyStations: [
        { name: '体育西路站', lines: '1/3号线换乘', exit: 'D出口直达天河城', note: '广州最繁忙换乘站' },
        { name: '公园前站', lines: '1/2号线换乘', exit: 'E出口北京路步行街', note: '市中心核心换乘' },
        { name: '珠江新城站', lines: '3/5号线换乘', exit: 'B1出口广东省博物馆', note: 'CBD核心区' },
        { name: '广州塔站', lines: '3号线/APM线', exit: 'A出口广州塔入口', note: '地标直达' },
        { name: '陈家祠站', lines: '1号线', exit: 'D出口陈家祠', note: '景区直达' }
      ],
      scenicDirect: [
        { name: '白云山', station: '白云公园站B出口', note: '步行10分钟到南门' },
        { name: '陈家祠', station: '陈家祠站D出口', note: '直达' },
        { name: '广州塔', station: '广州塔站A出口', note: '直达' },
        { name: '广东省博物馆', station: '珠江新城站B1出口', note: '步行5分钟' },
        { name: '沙面', station: '黄沙站E出口', note: '步行8分钟' }
      ] },
    { index: 7, title: '周末组合路线', type: 'routes', icon: '🗺️', content: 'A/B/C三条主题路线，带时间表',
      routes: [
        { id: 'A', name: '文艺青年线', icon: '🎨', color: '#7b1fa2', coverImage: 'assets/images/route-art.jpg', desc: '博物馆+CityWalk+市集，文化深度体验',
          timeline: [
            { time: '09:30', activity: '广东省博物馆（敦煌特展）', location: '珠江新城', note: '提前预约' },
            { time: '12:00', activity: '珠江新城午餐（太古汇）', location: '天河', note: '喜茶太古汇DP店' },
            { time: '14:00', activity: '东山口CityWalk', location: '越秀', note: '民国洋楼拍照' },
            { time: '16:30', activity: '永庆坊手作市集', location: '荔湾', note: '喜茶永庆坊主题店' },
            { time: '18:30', activity: '永庆坊晚餐+夜景', location: '荔湾', note: '粤式茶楼' },
            { time: '20:00', activity: 'Livehouse | 棱镜乐队', location: 'MAO Livehouse', note: '需提前购票' }
          ] },
        { id: 'B', name: '情侣浪漫线', icon: '💕', color: '#ec407a', coverImage: 'assets/images/route-romance.jpg', desc: '广州塔+珠江夜景+音乐节，甜蜜周末',
          timeline: [
            { time: '10:00', activity: '沙面漫步+拍照', location: '荔湾', note: '欧式建筑群' },
            { time: '12:00', activity: '上下九午餐（广州老字号）', location: '荔湾', note: '银记肠粉/陶陶居' },
            { time: '14:00', activity: '陈家祠参观', location: '中山七路', note: '岭南建筑瑰宝' },
            { time: '16:00', activity: '广州塔登塔', location: '海珠', note: '晚场8折特惠' },
            { time: '18:30', activity: '珠江夜游', location: '天字码头', note: '学生半价' },
            { time: '20:00', activity: '琶醍夜市晚餐', location: '海珠', note: '江边啤酒+美食' }
          ] },
        { id: 'C', name: '亲子家庭线', icon: '👨‍👩‍👧', color: '#2e7d32', coverImage: 'assets/images/route-family.jpg', desc: '长隆+白云山+博物馆，老少皆宜',
          timeline: [
            { time: '09:30', activity: '长隆旅游度假区', location: '番禺', note: '中高考生7折' },
            { time: '13:00', activity: '长隆园区内午餐', location: '番禺', note: '园内餐厅' },
            { time: '15:00', activity: '白云山缆车上山', location: '白云区', note: '索道25元' },
            { time: '17:00', activity: '广州博物馆（镇海楼）', location: '越秀', note: '儿童免票' },
            { time: '18:00', activity: '北京路晚餐+逛街', location: '越秀', note: '老字号美食' },
            { time: '20:00', activity: '天河城创意市集', location: '天河', note: '免费逛市集' }
          ] }
      ] },
    { index: 8, title: '时效可靠性说明', type: 'reliability', icon: '⚠️', content: '出行前请二次确认',
      notes: [
        '演出/球赛时间请以大麦网/猫眼实时排期为准',
        '市集/夜市开放时间可能因天气调整',
        '博物馆免费展览需提前在官方公众号预约',
        '优惠门票信息有效期请以购票页面为准',
        '地铁出口信息基于近期数据，新站开通可能有变动',
        '本报告生成于2026年7月30日，建议出行前二次核实'
      ] },
    { index: 9, title: 'API调用统计', type: 'stats', icon: '📊', content: '透明展示每次调用', totalCalls: 13,
      batches: [
        { batch: 1, count: 5, queries: ['小红书近期活动', '演唱会排期', '集市球赛', '博物馆5A', '优惠门票'], duration: '18秒', results: 47 },
        { batch: 2, count: 4, queries: ['喜茶旗舰店', '喜茶主题店', '美食街', 'CityWalk路线'], duration: '15秒', results: 32 },
        { batch: 3, count: 2, queries: ['地铁线网', '地铁出口'], duration: '8秒', results: 18 },
        { batch: '补查1', count: 2, queries: ['演唱会补充查询', '美食街补充'], duration: '12秒', results: 8 }
      ], totalResults: 105, reportSize: '27.5KB' }
  ],
  qualityCheck: {
    overallScore: 92,
    dimensions: [
      { id: 'completeness', name: '完整性', icon: '✅', score: 100, status: 'pass', desc: '11个调查方向全部覆盖，10节结构齐全', issues: [] },
      { id: 'accuracy', name: '准确性', icon: '✅', score: 90, status: 'pass', desc: '时间/地点/价格已交叉验证', issues: ['部分市集时间需出行前确认'] },
      { id: 'richness', name: '丰富度', icon: '✅', score: 95, status: 'pass', desc: '每节信息密度达标', issues: [] },
      { id: 'feasibility', name: '可执行性', icon: '✅', score: 88, status: 'pass', desc: '周末路线时间无冲突', issues: ['路线C下午时段偏紧，建议适当调整'] },
      { id: 'sources', name: '信源多样性', icon: '⚠️', score: 85, status: 'warning', desc: '部分关键信息仅1个信源', issues: ['球赛票价仅大麦网1个信源，建议出行前核实'] }
    ],
    iterations: 1, maxIterations: 2,
    supplementQueries: [
      { query: '演唱会补充查询', reason: '建议补：演唱会场次<3场需补充', status: 'done' },
      { query: '美食街补充查询', reason: '建议补：美食街<3条需补充', status: 'done' }
    ]
  },
  sources: [
    { name: '大麦网', type: '演出票务', count: 18 }, { name: '小红书', type: '社交媒体', count: 25 },
    { name: '高德地图', type: '地图服务', count: 12 }, { name: '大众点评', type: '本地生活', count: 20 },
    { name: '喜茶GO', type: '品牌官方', count: 4 }, { name: '广东美术馆', type: '官方', count: 3 },
    { name: '粤博公众号', type: '官方', count: 5 }, { name: '美团', type: '本地生活', count: 8 },
    { name: '广州塔官网', type: '官方', count: 2 }, { name: '秀动', type: '演出票务', count: 3 }
  ],
  workflow: [
    { step: 1, name: '时间锁定', status: 'done', duration: '即时', detail: '本周末: 8月1日(六)-8月2日(日)' },
    { step: 2, name: '用户确认', status: 'done', duration: '即时', detail: '城市:广州 已确认' },
    { step: 3, name: '建任务+目录', status: 'done', duration: '即时', detail: '创建6个TodoTask + 工作目录' },
    { step: 4, name: '写query', status: 'done', duration: '1-2分钟', detail: '11个方向query body已就绪' },
    { step: 5, name: '并行搜索', status: 'done', duration: '41秒', detail: '11个query拆5+4+2三批次并行' },
    { step: 6, name: '解析响应', status: 'done', duration: '即时', detail: 'JSON-RPC文本流按标题切分' },
    { step: 7, name: '整合报告', status: 'done', duration: '4分钟', detail: '按10节标准结构输出初稿' },
    { step: 8, name: '质量检查', status: 'done', duration: '3分钟', detail: '5维度检查+1轮补查询(2次)' },
    { step: 9, name: 'HTML输出', status: 'skip', duration: '-', detail: '用户未要求HTML' },
    { step: 10, name: '地图面板', status: 'done', duration: '1分钟', detail: '11类标记已生成' }
  ]
};

const GUANGZHOU_PLACES = [
  { id: 1, name: '广州体育馆', category: 'concert', lat: 23.1863, lng: 113.2710, address: '白云区白云大道南783号', note: '张韶涵演唱会', price: '380-1280元' },
  { id: 2, name: '广州大剧院', category: 'concert', lat: 23.1205, lng: 113.3247, address: '天河区珠江西路1号', note: '话剧《雷雨》', price: '180-680元' },
  { id: 3, name: 'MAO Livehouse', category: 'concert', lat: 23.1318, lng: 113.2756, address: '海珠区工业大道北', note: '棱镜乐队专场', price: '120元' },
  { id: 4, name: '大学城体育中心', category: 'concert', lat: 23.0512, lng: 113.3978, address: '番禺区大学城', note: '草莓音乐节', price: '299-599元' },
  { id: 5, name: '越秀山体育场', category: 'sport', lat: 23.1435, lng: 113.2640, address: '越秀区解放北路', note: '中超广州队主场', price: '80-380元' },
  { id: 6, name: '天河体育馆', category: 'sport', lat: 23.1358, lng: 113.3253, address: '天河区天河路', note: 'CBA夏季联赛', price: '50-280元' },
  { id: 7, name: '天河城创意市集', category: 'market', lat: 23.1358, lng: 113.3253, address: '天河区天河路208号', note: '周末限定创意市集', price: '免费' },
  { id: 8, name: '永庆坊手作市集', category: 'market', lat: 23.1089, lng: 113.2456, address: '荔湾区恩宁路', note: '手作文创市集', price: '免费' },
  { id: 9, name: '琶醍夜市', category: 'market', lat: 23.1012, lng: 113.3234, address: '海珠区新港东路', note: '江边夜市+啤酒', price: '免费' },
  { id: 10, name: '广东省博物馆', category: 'museum', lat: 23.1200, lng: 113.3260, address: '天河区珠江新城', note: '敦煌艺术大展', price: '免费(需预约)' },
  { id: 11, name: '广州博物馆', category: 'museum', lat: 23.1408, lng: 113.2620, address: '越秀区镇海楼', note: '海上丝绸之路特展', price: '10元' },
  { id: 12, name: '广东美术馆', category: 'museum', lat: 23.1265, lng: 113.3098, address: '二沙岛烟雨路', note: '当代水墨展', price: '免费' },
  { id: 13, name: '西汉南越王博物馆', category: 'museum', lat: 23.1456, lng: 113.2567, address: '越秀区解放北路', note: '南越王墓原址', price: '12元' },
  { id: 14, name: '白云山', category: 'scenic', lat: 23.1865, lng: 113.2980, address: '白云区广园中路', note: '5A景区，门票5元', price: '5元(索道25元)' },
  { id: 15, name: '长隆度假区', category: 'scenic', lat: 22.9980, lng: 113.3280, address: '番禺区汉溪大道', note: '5A景区，水上乐园特惠', price: '350元起(学生7折)' },
  { id: 16, name: '陈家祠', category: 'scenic', lat: 23.1265, lng: 113.2530, address: '荔湾区中山七路', note: '岭南建筑瑰宝', price: '10元' },
  { id: 17, name: '喜茶天环旗舰店', category: 'tea', lat: 23.1350, lng: 113.3260, address: '天河区天环广场L1', note: '品牌旗舰店', price: '人均25元' },
  { id: 18, name: '喜茶永庆坊主题店', category: 'tea', lat: 23.1090, lng: 113.2458, address: '荔湾区永庆坊', note: '岭南文化主题', price: '人均25元' },
  { id: 19, name: '喜茶太古汇DP店', category: 'tea', lat: 23.1310, lng: 113.3210, address: '天河区太古汇L3', note: '灵感设计店', price: '人均28元' },
  { id: 20, name: '喜茶正佳店', category: 'tea', lat: 23.1358, lng: 113.3280, address: '天河区正佳广场B1', note: '周边文创丰富', price: '人均25元' },
  { id: 21, name: '北京路美食街', category: 'food', lat: 23.1285, lng: 113.2650, address: '越秀区北京路', note: '老字号集中', price: '人均50元' },
  { id: 22, name: '上下九步行街', category: 'food', lat: 23.1180, lng: 113.2490, address: '荔湾区上下九路', note: '广州美食地标', price: '人均45元' },
  { id: 23, name: '体育西横街', category: 'food', lat: 23.1358, lng: 113.3260, address: '天河区体育西', note: '年轻人美食', price: '人均60元' },
  { id: 24, name: '西关老街', category: 'food', lat: 23.1185, lng: 113.2450, address: '荔湾区宝源路', note: '地道西关味', price: '人均40元' },
  { id: 25, name: '建设六马路', category: 'food', lat: 23.1318, lng: 113.2730, address: '越秀区建设六马路', note: '异国风味', price: '人均70元' },
  { id: 26, name: '沙面', category: 'walk', lat: 23.1090, lng: 113.2360, address: '荔湾区沙面', note: 'CityWalk路线A起点，欧式建筑群', price: '免费' },
  { id: 27, name: '永庆坊', category: 'walk', lat: 23.1090, lng: 113.2458, address: '荔湾区恩宁路', note: 'CityWalk路线A终点，文创街区', price: '免费' },
  { id: 28, name: '二沙岛', category: 'walk', lat: 23.1240, lng: 113.3090, address: '越秀区二沙岛', note: 'CityWalk路线B，艺术环线', price: '免费' },
  { id: 29, name: '东山口', category: 'walk', lat: 23.1290, lng: 113.2820, address: '越秀区东山口', note: 'CityWalk路线C，民国洋楼', price: '免费' },
  { id: 30, name: '广州塔', category: 'ticket', lat: 23.1066, lng: 113.3245, address: '海珠区阅江西路222号', note: '晚场8折特惠', price: '120元(晚场)' },
  { id: 31, name: '珠江夜游天字码头', category: 'ticket', lat: 23.1260, lng: 113.2640, address: '越秀区沿江中路', note: '学生半价', price: '44元(学生)' },
  { id: 32, name: '天河城', category: 'mall', lat: 23.1360, lng: 113.3250, address: '天河区天河路208号', note: '大型购物中心', price: '免费逛' },
  { id: 33, name: '正佳广场', category: 'mall', lat: 23.1358, lng: 113.3280, address: '天河区天河路228号', note: '含极地海洋世界', price: '免费逛' },
  { id: 34, name: '太古汇', category: 'mall', lat: 23.1310, lng: 113.3210, address: '天河区天河路383号', note: '高端商场', price: '免费逛' },
  { id: 35, name: '天环广场', category: 'mall', lat: 23.1350, lng: 113.3260, address: '天河区天河路218号', note: '喜茶旗舰店所在', price: '免费逛' },
  { id: 36, name: '体育西路站', category: 'metro', lat: 23.1358, lng: 113.3253, address: '天河区', note: '1/3号线换乘，最繁忙站点', price: '-' },
  { id: 37, name: '公园前站', category: 'metro', lat: 23.1285, lng: 113.2650, address: '越秀区', note: '1/2号线换乘，北京路直达', price: '-' },
  { id: 38, name: '珠江新城站', category: 'metro', lat: 23.1200, lng: 113.3260, address: '天河区', note: '3/5号线换乘，CBD核心', price: '-' },
  { id: 39, name: '广州塔站', category: 'metro', lat: 23.1066, lng: 113.3245, address: '海珠区', note: '3号线/APM线，广州塔直达', price: '-' }
];

const REPORTS = {
  guangzhou: { report: GUANGZHOU_REPORT, places: GUANGZHOU_PLACES }
};

// 工具函数
function getCategory(id) { return CATEGORIES.find(c => c.id === id); }
function getCategoryColor(id) { const c = getCategory(id); return c ? c.color : '#999'; }
function getHotCities() { return CITIES.filter(c => c.hot); }
function getReport(code) { const d = REPORTS[code]; return d ? d.report : null; }
function getPlaces(code) { const d = REPORTS[code]; return d ? d.places : []; }
