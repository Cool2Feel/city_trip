// utils/mockData.js - 城市Mock数据
// 包含11个调查方向数据、10节报告结构、3条周末路线、地图标记点、质量检查

// 阶段2：16 城「AI 基于公开知识整理的真实攻略」（由 gen_real_reports.js 生成）
// 若文件缺失，降级为模板生成，不影响小程序运行。
let REAL = { REAL_REPORTS: {} }
try { REAL = require('./realCityData.js') } catch (e) { REAL = { REAL_REPORTS: {} } }

// 试点：citymap.348349.xyz 抓取烘焙数据（上海/北京），优先于阶段2 bundled，验证端到端。
let CITYMAP = { REAL_REPORTS_CITYMAP: {} }
try { CITYMAP = require('./realCityData_citymap_pilot.js') } catch (e) { CITYMAP = { REAL_REPORTS_CITYMAP: {} } }

// P1：置信度加权合并（与 build_citydata.js 共用同一套逻辑，保证线上烘焙与离线兜底一致）
const { mergeCity } = require('./merge_citydata.js')

// 取合并后的单城数据：手写精校(hand) > 阶段2 REAL(bundled/authoritative) 为基，
// 再与 citymap 第三方抓取做 POI 级加权合并（同名取高置信坐标 + 冲突检测 + 互补追加）。
// 仅一路存在时直接返回该路。
function getMergedCity(cityCode) {
  const cm = CITYMAP.REAL_REPORTS_CITYMAP && CITYMAP.REAL_REPORTS_CITYMAP[cityCode]
  const realCity = REAL.REAL_REPORTS && REAL.REAL_REPORTS[cityCode]
  const hand = REPORTS[cityCode]
  // 基：优先手写精校（视为 hand 高置信），其次 REAL
  let base = null
  if (hand) base = withAuthSource(hand, 'hand')
  else if (realCity) base = realCity
  if (base && cm) return mergeCity(base, cm)
  if (cm) return cm
  if (base) return base
  return null
}
// 手写报告未带 authSource，合并时视为 hand（高置信 0.9），仅用于合并判定，不改原对象
function withAuthSource(city, auth) {
  if (city.report && city.report.authSource) return city
  return { report: Object.assign({}, city.report, { authSource: auth }), places: city.places }
}

const CITIES = [
  {
    code: 'guangzhou',
    name: '广州',
    province: '广东',
    pinyin: 'Guangzhou',
    hot: true,
    desc: '花城羊城，食在广东',
    center: { lat: 23.1291, lng: 113.2644 },
    keywords: {
      malls: '天河城、正佳广场、太古汇、万菱汇',
      foodArea: '北京路、上下九、体育西',
      landmark: '广州塔',
      scenic: '白云山、陈家祠、沙面'
    }
  },
  {
    code: 'shenzhen',
    name: '深圳',
    province: '广东',
    pinyin: 'Shenzhen',
    hot: true,
    desc: '科技之都，滨海之城',
    center: { lat: 22.5431, lng: 114.0579 },
    keywords: {
      malls: '万象天地、海岸城、壹方城',
      foodArea: '东门、蛇口、华强北',
      landmark: '平安金融中心',
      scenic: '世界之窗、大梅沙、梧桐山'
    }
  },
  {
    code: 'chengdu',
    name: '成都',
    province: '四川',
    pinyin: 'Chengdu',
    hot: true,
    desc: '天府之国，闲适之城',
    center: { lat: 30.5728, lng: 104.0668 },
    keywords: {
      malls: '太古里、IFS、万象城',
      foodArea: '锦里、宽窄巷子、建设路',
      landmark: '天府广场',
      scenic: '武侯祠、杜甫草堂、大熊猫基地'
    }
  },
  {
    code: 'shanghai',
    name: '上海',
    province: '上海',
    pinyin: 'Shanghai',
    hot: true,
    desc: '魔都风情，海派文化',
    center: { lat: 31.2304, lng: 121.4737 },
    keywords: {
      malls: '南京路、淮海路、静安嘉里中心',
      foodArea: '城隍庙、田子坊、云南南路',
      landmark: '东方明珠',
      scenic: '外滩、豫园、迪士尼'
    }
  },
  {
    code: 'beijing',
    name: '北京',
    province: '北京',
    pinyin: 'Beijing',
    hot: true,
    desc: '帝都风华，千年古都',
    center: { lat: 39.9042, lng: 116.4074 },
    keywords: {
      malls: '三里屯太古里、国贸商城、西单大悦城',
      foodArea: '簋街、牛街、南锣鼓巷',
      landmark: '天安门',
      scenic: '故宫、长城、颐和园'
    }
  },
  {
    code: 'hangzhou',
    name: '杭州',
    province: '浙江',
    pinyin: 'Hangzhou',
    hot: false,
    desc: '人间天堂，西湖印象',
    center: { lat: 30.2741, lng: 120.1551 },
    keywords: {
      malls: '万象城、湖滨银泰、嘉里中心',
      foodArea: '河坊街、胜利河、中山北路',
      landmark: '西湖',
      scenic: '西湖、灵隐寺、千岛湖'
    }
  },
  {
    code: 'chongqing',
    name: '重庆',
    province: '重庆',
    pinyin: 'Chongqing',
    hot: false,
    desc: '山城雾都，8D魔幻',
    center: { lat: 29.5630, lng: 106.5516 },
    keywords: {
      malls: '解放碑、观音桥、时代天街',
      foodArea: '磁器口、洪崖洞、八一路',
      landmark: '洪崖洞',
      scenic: '洪崖洞、磁器口、长江索道'
    }
  },
  {
    code: 'xiamen',
    name: '厦门',
    province: '福建',
    pinyin: 'Xiamen',
    hot: false,
    desc: '海上花园，文艺之城',
    center: { lat: 24.4798, lng: 118.0894 },
    keywords: {
      malls: 'SM城市广场、万象城、中华城',
      foodArea: '中山路、曾厝垵、八市',
      landmark: '鼓浪屿',
      scenic: '鼓浪屿、南普陀、环岛路'
    }
  },
  {
    code: 'nanjing',
    name: '南京',
    province: '江苏',
    pinyin: 'Nanjing',
    hot: false,
    desc: '六朝古都，金陵风韵',
    center: { lat: 32.0603, lng: 118.7969 },
    keywords: {
      malls: '德基广场、中央商场、金鹰世界',
      foodArea: '夫子庙、老门东、狮子桥',
      landmark: '紫金山',
      scenic: '中山陵、夫子庙、玄武湖'
    }
  },
  {
    code: 'wuhan',
    name: '武汉',
    province: '湖北',
    pinyin: 'Wuhan',
    hot: false,
    desc: '江城武汉，九省通衢',
    center: { lat: 30.5928, lng: 114.3055 },
    keywords: {
      malls: '楚河汉街、群星城、武商MALL',
      foodArea: '户部巷、吉庆街、粮道街',
      landmark: '黄鹤楼',
      scenic: '黄鹤楼、东湖、武汉大学'
    }
  },
  {
    code: 'xian',
    name: '西安',
    province: '陕西',
    pinyin: 'Xian',
    hot: true,
    desc: '千年古都，丝路起点',
    center: { lat: 34.3416, lng: 108.9398 },
    keywords: {
      malls: '赛格国际、大悦城、SKP',
      foodArea: '回民街、永兴坊、洒金桥',
      landmark: '钟楼',
      scenic: '兵马俑、大雁塔、城墙'
    }
  },
  {
    code: 'changsha',
    name: '长沙',
    province: '湖南',
    pinyin: 'Changsha',
    hot: true,
    desc: '星城长沙，网红美食',
    center: { lat: 28.2282, lng: 112.9388 },
    keywords: {
      malls: 'IFS国金中心、万象汇、海信广场',
      foodArea: '坡子街、太平街、文和友',
      landmark: '橘子洲',
      scenic: '橘子洲、岳麓山、湖南博物馆'
    }
  },
  {
    code: 'suzhou',
    name: '苏州',
    province: '江苏',
    pinyin: 'Suzhou',
    hot: false,
    desc: '东方威尼斯，园林之城',
    center: { lat: 31.2989, lng: 120.5853 },
    keywords: {
      malls: '苏州中心、久光百货、龙湖狮山',
      foodArea: '观前街、平江路、山塘街',
      landmark: '拙政园',
      scenic: '拙政园、虎丘、周庄古镇'
    }
  },
  {
    code: 'qingdao',
    name: '青岛',
    province: '山东',
    pinyin: 'Qingdao',
    hot: false,
    desc: '红瓦绿树，碧海蓝天',
    center: { lat: 36.0671, lng: 120.3826 },
    keywords: {
      malls: '万象城、海信广场、利群',
      foodArea: '劈柴院、台东、啤酒街',
      landmark: '栈桥',
      scenic: '栈桥、八大关、崂山'
    }
  },
  {
    code: 'kunming',
    name: '昆明',
    province: '云南',
    pinyin: 'Kunming',
    hot: false,
    desc: '春城昆明，四季如春',
    center: { lat: 25.0389, lng: 102.7183 },
    keywords: {
      malls: '恒隆广场、同德昆明广场、百大',
      foodArea: '南屏街、关上、篆新市场',
      landmark: '滇池',
      scenic: '滇池、石林、翠湖'
    }
  },
  {
    code: 'dalian',
    name: '大连',
    province: '辽宁',
    pinyin: 'Dalian',
    hot: false,
    desc: '北方明珠，浪漫海滨',
    center: { lat: 38.9140, lng: 121.6147 },
    keywords: {
      malls: '恒隆广场、柏威年、百年城',
      foodArea: '中山广场、西安路、友好广场',
      landmark: '星海广场',
      scenic: '星海广场、老虎滩、金石滩'
    }
  },
  {
    code: 'tianjin',
    name: '天津',
    province: '天津',
    pinyin: 'Tianjin',
    hot: false,
    desc: '津门故里，曲艺之乡',
    center: { lat: 39.0842, lng: 117.2009 },
    keywords: {
      malls: '大悦城、恒隆广场、天河城',
      foodArea: '古文化街、南市食品街、意式风情街',
      landmark: '天津之眼',
      scenic: '古文化街、五大道、盘山'
    }
  },
  {
    code: 'zhengzhou',
    name: '郑州',
    province: '河南',
    pinyin: 'Zhengzhou',
    hot: false,
    desc: '中原枢纽，黄帝故里',
    center: { lat: 34.7466, lng: 113.6254 },
    keywords: {
      malls: '丹尼斯大卫城、正弘城、万象城',
      foodArea: '二七广场、健康路、农科路',
      landmark: '二七纪念塔',
      scenic: '少林寺、嵩山、黄河风景区'
    }
  },
  {
    code: 'guilin',
    name: '桂林',
    province: '广西',
    pinyin: 'Guilin',
    hot: false,
    desc: '山水甲天下',
    center: { lat: 25.2734, lng: 110.2907 },
    keywords: {
      malls: '微笑堂、万象城、桂林百货',
      foodArea: '东西巷、正阳步行街、尚水街',
      landmark: '象鼻山',
      scenic: '漓江、阳朔、龙脊梯田'
    }
  }
]

// 广州完整报告数据
const GUANGZHOU_REPORT = {
  cityCode: 'guangzhou',
  cityName: '广州',
  generatedAt: '2026-07-30',
  totalCalls: 13,
  reportSize: '27.5KB',

  // 〇、一图速览
  overview: {
    weather: '多云转晴',
    tempRange: '26-34°C',
    weekend: '8月1日-8月2日',
    metroLines: 16,
    scenic5A: 3,
    concertCount: 5,
    marketCount: 4,
    museumCount: 8,
    foodStreetCount: 5,
    cityWalkCount: 3,
    teaShopCount: 4,
    highlights: [
      '张韶涵「寓言」世界巡回演唱会广州站',
      '广州大剧院话剧《雷雨》',
      '天河城创意市集周末限定',
      '广东省博物馆敦煌特展'
    ]
  },

  // 10节报告
  sections: [
    {
      index: 0,
      title: '一图速览',
      type: 'overview',
      icon: '\uD83D\uDCC8',
      content: '10秒拿到广州本周末核心情报',
      summary: '广州本周末多云转晴26-34°C，5场演出+4个市集+8个博物馆展览，3条CityWalk路线，4家喜茶旗舰店。',
      tableData: [
        { label: '天气', value: '多云转晴 26-34°C' },
        { label: '周末', value: '8月1日(六)-8月2日(日)' },
        { label: '地铁线路', value: '16条运营' },
        { label: '5A景区', value: '3个' },
        { label: '演出活动', value: '5场' },
        { label: '创意市集', value: '4个' },
        { label: '博物馆展览', value: '8个' },
        { label: '美食街', value: '5条' },
        { label: 'CityWalk', value: '3条路线' },
        { label: '喜茶旗舰店', value: '4家' }
      ]
    },
    {
      index: 1,
      title: '活动全清单',
      type: 'activities',
      icon: '\uD83C\uDFAF',
      content: '演唱会/集市/球赛/博物馆/5A景区全汇总',
      groups: [
        {
          category: 'concert',
          name: '演唱会/演出',
          items: [
            { name: '张韶涵「寓言」世界巡回演唱会广州站', time: '8月1日 19:30', venue: '广州体育馆', price: '380-1280元', source: '大麦网' },
            { name: '广州大剧院话剧《雷雨》', time: '8月2日 19:30', venue: '广州大剧院', price: '180-680元', source: '大麦网' },
            { name: 'Livehouse | 棱镜乐队广州专场', time: '8月1日 20:00', venue: 'MAO Livehouse', price: '120元', source: '秀动' },
            { name: '草莓音乐节广州站', time: '8月2日 14:00', venue: '大学城体育中心', price: '299-599元', source: '大麦网' },
            { name: '广东音乐曲艺团周末专场', time: '8月2日 15:00', venue: '粤剧艺术博物馆', price: '50-120元', source: '大众点评' }
          ]
        },
        {
          category: 'market',
          name: '集市/夜市',
          items: [
            { name: '天河城创意市集', time: '8月1-2日 10:00-22:00', venue: '天河城北广场', price: '免费', source: '小红书' },
            { name: '永庆坊手作市集', time: '每周六日 11:00-20:00', venue: '永庆坊', price: '免费', source: '小红书' },
            { name: '琶醍夜市', time: '每晚18:00-凌晨', venue: '珠江琶醍', price: '免费', source: '大众点评' },
            { name: '东方宝泰周末市集', time: '8月2日 10:00-21:00', venue: '东方宝泰广场', price: '免费', source: '小红书' }
          ]
        },
        {
          category: 'sport',
          name: '球赛',
          items: [
            { name: '中超第18轮 广州队vs上海海港', time: '8月1日 19:35', venue: '越秀山体育场', price: '80-380元', source: '大麦网' },
            { name: 'CBA夏季联赛 广州龙狮vs深圳马可波罗', time: '8月2日 19:30', venue: '天河体育馆', price: '50-280元', source: '大麦网' }
          ]
        },
        {
          category: 'museum',
          name: '博物馆/展览',
          items: [
            { name: '广东省博物馆 - 敦煌艺术大展', time: '周二至日 9:00-17:00', venue: '珠江新城', price: '免费(需预约)', source: '粤博官网' },
            { name: '广州博物馆 - 海上丝绸之路特展', time: '周二至日 9:00-17:30', venue: '越秀山镇海楼', price: '10元', source: '大众点评' },
            { name: '广东美术馆 - 当代水墨展', time: '周二至日 9:00-17:00', venue: '二沙岛', price: '免费', source: '广东美术馆' },
            { name: '西汉南越王博物馆', time: '周二至日 9:00-17:30', venue: '解放北路', price: '12元', source: '大众点评' },
            { name: '广州艺术博物院', time: '周二至日 9:00-17:00', venue: '麓湖路', price: '免费', source: '大众点评' }
          ]
        },
        {
          category: 'scenic',
          name: '5A景区',
          items: [
            { name: '白云山风景名胜区', time: '全天开放', venue: '白云区', price: '5元(索道25元)', source: '高德地图' },
            { name: '长隆旅游度假区', time: '9:30-18:00', venue: '番禺区', price: '350元起', source: '长隆官网' },
            { name: '陈家祠(陈氏书院)', time: '8:30-17:30', venue: '中山七路', price: '10元', source: '大众点评' }
          ]
        }
      ]
    },
    {
      index: 2,
      title: '优惠门票',
      type: 'ticket',
      icon: '\uD83C\uDF9F',
      content: '暑期特惠、考生免费等省钱信息',
      items: [
        { name: '长隆水上乐园暑期特惠', desc: '中高考生凭准考证享7折', price: '原350元→245元', source: '长隆官网', expiry: '8月31日' },
        { name: '白云山+云台花园联票', desc: '周末限时8折优惠', price: '原30元→24元', source: '美团', expiry: '8月2日' },
        { name: '广东省博物馆免费导览', desc: '周末免费人工讲解（需预约）', price: '免费', source: '粤博公众号', expiry: '长期' },
        { name: '广州塔登塔票晚场特惠', desc: '20:00后入场8折', price: '原150元→120元', source: '广州塔官网', expiry: '8月31日' },
        { name: '珠江夜游学生票', desc: '学生证半价', price: '原88元→44元', source: '大众点评', expiry: '9月1日' }
      ]
    },
    {
      index: 3,
      title: '喜茶门店热点',
      type: 'tea',
      icon: '\uD83C\uDF75',
      content: '品牌文化打卡 + 商场指引',
      items: [
        { name: '喜茶广州首家旗舰店', address: '天河区天环广场L1', feature: '品牌旗舰店，设计感强', metro: '体育西路站D出口', source: '喜茶GO' },
        { name: '喜茶永庆坊主题店', address: '荔湾区永庆坊', feature: '岭南文化主题装修', metro: '黄沙站B出口', source: '小红书' },
        { name: '喜茶太古汇DP店', address: '天河区太古汇L3', feature: '灵感设计店，限定周边', metro: '石牌桥站D出口', source: '喜茶GO' },
        { name: '喜茶正佳广场店', address: '天河区正佳广场负一层', feature: '周边文创丰富', metro: '体育中心站A出口', source: '大众点评' }
      ]
    },
    {
      index: 4,
      title: '美食街',
      type: 'food',
      icon: '\uD83C\uDF5C',
      content: '本地人真正会去的美食街',
      items: [
        { name: '北京路美食街', address: '越秀区北京路', feature: '老字号集中，游客友好', metro: '北京路站', rating: 4.3, source: '大众点评' },
        { name: '上下九步行街', address: '荔湾区上下九路', feature: '广州传统美食地标', metro: '长寿路站', rating: 4.5, source: '大众点评' },
        { name: '体育西横街', address: '天河区体育西', feature: '年轻人美食聚集地', metro: '体育西路站', rating: 4.4, source: '小红书' },
        { name: '西关老街美食', address: '荔湾区宝源路', feature: '地道西关味，本地人推荐', metro: '长寿路站', rating: 4.6, source: '大众点评' },
        { name: '建设六马路', address: '越秀区建设六马路', feature: '异国风味一条街', metro: '淘金站A出口', rating: 4.2, source: '小红书' }
      ]
    },
    {
      index: 5,
      title: 'City Walk路线',
      type: 'walk',
      icon: '\uD83D\uDEB6',
      content: '经典步行路线与拍照点',
      items: [
        {
          name: '路线A：沙面→沿江西路→永庆坊',
          duration: '约3小时',
          distance: '4.5km',
          highlights: '沙面欧式建筑群、粤海关旧址、永庆坊文创',
          photoSpots: '沙面教堂前、沿江路夕阳、永庆坊拱门',
          metro: '黄沙站出发，长寿路站结束',
          source: '小红书'
        },
        {
          name: '路线B：二沙岛艺术环线',
          duration: '约2.5小时',
          distance: '3.2km',
          highlights: '广东美术馆、星海音乐厅、江边日落',
          photoSpots: '星海音乐厅外、二沙岛江边长椅',
          metro: '海心沙站出发',
          source: '小红书'
        },
        {
          name: '路线C：东山口洋楼区',
          duration: '约2小时',
          distance: '2.8km',
          highlights: '民国洋楼群、东山湖公园、庙前西街',
          photoSpots: '东山口红砖洋楼、庙前西街咖啡馆',
          metro: '东山口站F出口',
          source: '小红书'
        }
      ]
    },
    {
      index: 6,
      title: '地铁路线',
      type: 'metro',
      icon: '\uD83D\uDE87',
      content: '线网总览 + 关键站点出口',
      metroLines: 16,
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
      ]
    },
    {
      index: 7,
      title: '周末组合路线',
      type: 'routes',
      icon: '\uD83D\uDDFA\uFE0F',
      content: 'A/B/C三条主题路线，带时间表',
      routes: [
        {
          id: 'A',
          name: '文艺青年线',
          icon: '\uD83C\uDFA8',
          color: '#7b1fa2',
          coverImage: '/assets/images/route-art.jpg',
          desc: '博物馆+CityWalk+市集，文化深度体验',
          timeline: [
            { time: '09:30', activity: '广东省博物馆（敦煌特展）', location: '珠江新城', note: '提前预约' },
            { time: '12:00', activity: '珠江新城午餐（太古汇）', location: '天河', note: '喜茶太古汇DP店' },
            { time: '14:00', activity: '东山口CityWalk', location: '越秀', note: '民国洋楼拍照' },
            { time: '16:30', activity: '永庆坊手作市集', location: '荔湾', note: '喜茶永庆坊主题店' },
            { time: '18:30', activity: '永庆坊晚餐+夜景', location: '荔湾', note: '粤式茶楼' },
            { time: '20:00', activity: 'Livehouse | 棱镜乐队', location: 'MAO Livehouse', note: '需提前购票' }
          ]
        },
        {
          id: 'B',
          name: '情侣浪漫线',
          icon: '\uD83D\uDC95',
          color: '#ec407a',
          coverImage: '/assets/images/route-romance.jpg',
          desc: '广州塔+珠江夜景+音乐节，甜蜜周末',
          timeline: [
            { time: '10:00', activity: '沙面漫步+拍照', location: '荔湾', note: '欧式建筑群' },
            { time: '12:00', activity: '上下九午餐（广州老字号）', location: '荔湾', note: '银记肠粉/陶陶居' },
            { time: '14:00', activity: '陈家祠参观', location: '中山七路', note: '岭南建筑瑰宝' },
            { time: '16:00', activity: '广州塔登塔', location: '海珠', note: '晚场8折特惠' },
            { time: '18:30', activity: '珠江夜游', location: '天字码头', note: '学生半价' },
            { time: '20:00', activity: '琶醍夜市晚餐', location: '海珠', note: '江边啤酒+美食' }
          ]
        },
        {
          id: 'C',
          name: '亲子家庭线',
          icon: '\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67',
          color: '#2e7d32',
          coverImage: '/assets/images/route-family.jpg',
          desc: '长隆+白云山+博物馆，老少皆宜',
          timeline: [
            { time: '09:30', activity: '长隆旅游度假区', location: '番禺', note: '中高考生7折' },
            { time: '13:00', activity: '长隆园区内午餐', location: '番禺', note: '园内餐厅' },
            { time: '15:00', activity: '白云山缆车上山', location: '白云区', note: '索道25元' },
            { time: '17:00', activity: '广州博物馆（镇海楼）', location: '越秀', note: '儿童免票' },
            { time: '18:00', activity: '北京路晚餐+逛街', location: '越秀', note: '老字号美食' },
            { time: '20:00', activity: '天河城创意市集', location: '天河', note: '免费逛市集' }
          ]
        }
      ]
    },
    {
      index: 8,
      title: '时效可靠性说明',
      type: 'reliability',
      icon: '\u26A0\uFE0F',
      content: '出行前请二次确认',
      notes: [
        '演出/球赛时间请以大麦网/猫眼实时排期为准',
        '市集/夜市开放时间可能因天气调整',
        '博物馆免费展览需提前在官方公众号预约',
        '优惠门票信息有效期请以购票页面为准',
        '地铁出口信息基于近期数据，新站开通可能有变动',
        '本报告生成于2026年7月30日，建议出行前二次核实'
      ]
    },
    {
      index: 9,
      title: 'API调用统计',
      type: 'stats',
      icon: '\uD83D\uDCCA',
      content: '透明展示每次调用',
      totalCalls: 13,
      batches: [
        { batch: 1, count: 5, queries: ['小红书近期活动', '演唱会排期', '集市球赛', '博物馆5A', '优惠门票'], duration: '18秒', results: 47 },
        { batch: 2, count: 4, queries: ['喜茶旗舰店', '喜茶主题店', '美食街', 'CityWalk路线'], duration: '15秒', results: 32 },
        { batch: 3, count: 2, queries: ['地铁线网', '地铁出口'], duration: '8秒', results: 18 },
        { batch: '补查1', count: 2, queries: ['演唱会补充查询', '美食街补充'], duration: '12秒', results: 8 }
      ],
      totalResults: 105,
      reportSize: '27.5KB'
    }
  ],

  // 质量检查
  qualityCheck: {
    overallScore: 92,
    dimensions: [
      {
        id: 'completeness',
        name: '完整性',
        icon: '\u2705',
        score: 100,
        status: 'pass',
        desc: '11个调查方向全部覆盖，10节结构齐全',
        issues: []
      },
      {
        id: 'accuracy',
        name: '准确性',
        icon: '\u2705',
        score: 90,
        status: 'pass',
        desc: '时间/地点/价格已交叉验证',
        issues: ['部分市集时间需出行前确认']
      },
      {
        id: 'richness',
        name: '丰富度',
        icon: '\u2705',
        score: 95,
        status: 'pass',
        desc: '每节信息密度达标',
        issues: []
      },
      {
        id: 'feasibility',
        name: '可执行性',
        icon: '\u2705',
        score: 88,
        status: 'pass',
        desc: '周末路线时间无冲突',
        issues: ['路线C下午时段偏紧，建议适当调整']
      },
      {
        id: 'sources',
        name: '信源多样性',
        icon: '\u26A0\uFE0F',
        score: 85,
        status: 'warning',
        desc: '部分关键信息仅1个信源',
        issues: ['球赛票价仅大麦网1个信源，建议出行前核实']
      }
    ],
    iterations: 1,
    maxIterations: 2,
    supplementQueries: [
      { query: '演唱会补充查询', reason: '建议补：演唱会场次<3场需补充', status: 'done' },
      { query: '美食街补充查询', reason: '建议补：美食街<3条需补充', status: 'done' }
    ]
  },

  // 引用源
  sources: [
    { name: '大麦网', type: '演出票务', count: 18 },
    { name: '小红书', type: '社交媒体', count: 25 },
    { name: '高德地图', type: '地图服务', count: 12 },
    { name: '大众点评', type: '本地生活', count: 20 },
    { name: '喜茶GO', type: '品牌官方', count: 4 },
    { name: '广东美术馆', type: '官方', count: 3 },
    { name: '粤博公众号', type: '官方', count: 5 },
    { name: '美团', type: '本地生活', count: 8 },
    { name: '广州塔官网', type: '官方', count: 2 },
    { name: '秀动', type: '演出票务', count: 3 }
  ],

  // 10步工作流进度
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
}

// 广州地图标记点
const GUANGZHOU_PLACES = [
  // 演唱会
  { id: 1, name: '广州体育馆', category: 'concert', lat: 23.1863, lng: 113.2710, address: '白云区白云大道南783号', note: '张韶涵演唱会', price: '380-1280元' },
  { id: 2, name: '广州大剧院', category: 'concert', lat: 23.1205, lng: 113.3247, address: '天河区珠江西路1号', note: '话剧《雷雨》', price: '180-680元' },
  { id: 3, name: 'MAO Livehouse', category: 'concert', lat: 23.1318, lng: 113.2756, address: '海珠区工业大道北', note: '棱镜乐队专场', price: '120元' },
  { id: 4, name: '大学城体育中心', category: 'concert', lat: 23.0512, lng: 113.3978, address: '番禺区大学城', note: '草莓音乐节', price: '299-599元' },
  // 球赛
  { id: 5, name: '越秀山体育场', category: 'sport', lat: 23.1435, lng: 113.2640, address: '越秀区解放北路', note: '中超广州队主场', price: '80-380元' },
  { id: 6, name: '天河体育馆', category: 'sport', lat: 23.1358, lng: 113.3253, address: '天河区天河路', note: 'CBA夏季联赛', price: '50-280元' },
  // 集市
  { id: 7, name: '天河城创意市集', category: 'market', lat: 23.1358, lng: 113.3253, address: '天河区天河路208号', note: '周末限定创意市集', price: '免费' },
  { id: 8, name: '永庆坊手作市集', category: 'market', lat: 23.1089, lng: 113.2456, address: '荔湾区恩宁路', note: '手作文创市集', price: '免费' },
  { id: 9, name: '琶醍夜市', category: 'market', lat: 23.1012, lng: 113.3234, address: '海珠区新港东路', note: '江边夜市+啤酒', price: '免费' },
  // 博物馆
  { id: 10, name: '广东省博物馆', category: 'museum', lat: 23.1200, lng: 113.3260, address: '天河区珠江新城', note: '敦煌艺术大展', price: '免费(需预约)' },
  { id: 11, name: '广州博物馆', category: 'museum', lat: 23.1408, lng: 113.2620, address: '越秀区镇海楼', note: '海上丝绸之路特展', price: '10元' },
  { id: 12, name: '广东美术馆', category: 'museum', lat: 23.1265, lng: 113.3098, address: '二沙岛烟雨路', note: '当代水墨展', price: '免费' },
  { id: 13, name: '西汉南越王博物馆', category: 'museum', lat: 23.1456, lng: 113.2567, address: '越秀区解放北路', note: '南越王墓原址', price: '12元' },
  // 5A景区
  { id: 14, name: '白云山', category: 'scenic', lat: 23.1865, lng: 113.2980, address: '白云区广园中路', note: '5A景区，门票5元', price: '5元(索道25元)' },
  { id: 15, name: '长隆度假区', category: 'scenic', lat: 22.9980, lng: 113.3280, address: '番禺区汉溪大道', note: '5A景区，水上乐园特惠', price: '350元起(学生7折)' },
  { id: 16, name: '陈家祠', category: 'scenic', lat: 23.1265, lng: 113.2530, address: '荔湾区中山七路', note: '岭南建筑瑰宝', price: '10元' },
  // 喜茶
  { id: 17, name: '喜茶天环旗舰店', category: 'tea', lat: 23.1350, lng: 113.3260, address: '天河区天环广场L1', note: '品牌旗舰店', price: '人均25元' },
  { id: 18, name: '喜茶永庆坊主题店', category: 'tea', lat: 23.1090, lng: 113.2458, address: '荔湾区永庆坊', note: '岭南文化主题', price: '人均25元' },
  { id: 19, name: '喜茶太古汇DP店', category: 'tea', lat: 23.1310, lng: 113.3210, address: '天河区太古汇L3', note: '灵感设计店', price: '人均28元' },
  { id: 20, name: '喜茶正佳店', category: 'tea', lat: 23.1358, lng: 113.3280, address: '天河区正佳广场B1', note: '周边文创丰富', price: '人均25元' },
  // 美食街
  { id: 21, name: '北京路美食街', category: 'food', lat: 23.1285, lng: 113.2650, address: '越秀区北京路', note: '老字号集中', price: '人均50元' },
  { id: 22, name: '上下九步行街', category: 'food', lat: 23.1180, lng: 113.2490, address: '荔湾区上下九路', note: '广州美食地标', price: '人均45元' },
  { id: 23, name: '体育西横街', category: 'food', lat: 23.1358, lng: 113.3260, address: '天河区体育西', note: '年轻人美食', price: '人均60元' },
  { id: 24, name: '西关老街', category: 'food', lat: 23.1185, lng: 113.2450, address: '荔湾区宝源路', note: '地道西关味', price: '人均40元' },
  { id: 25, name: '建设六马路', category: 'food', lat: 23.1318, lng: 113.2730, address: '越秀区建设六马路', note: '异国风味', price: '人均70元' },
  // City Walk
  { id: 26, name: '沙面', category: 'walk', lat: 23.1090, lng: 113.2360, address: '荔湾区沙面', note: 'CityWalk路线A起点，欧式建筑群', price: '免费' },
  { id: 27, name: '永庆坊', category: 'walk', lat: 23.1090, lng: 113.2458, address: '荔湾区恩宁路', note: 'CityWalk路线A终点，文创街区', price: '免费' },
  { id: 28, name: '二沙岛', category: 'walk', lat: 23.1240, lng: 113.3090, address: '越秀区二沙岛', note: 'CityWalk路线B，艺术环线', price: '免费' },
  { id: 29, name: '东山口', category: 'walk', lat: 23.1290, lng: 113.2820, address: '越秀区东山口', note: 'CityWalk路线C，民国洋楼', price: '免费' },
  // 优惠门票
  { id: 30, name: '广州塔', category: 'ticket', lat: 23.1066, lng: 113.3245, address: '海珠区阅江西路222号', note: '晚场8折特惠', price: '120元(晚场)' },
  { id: 31, name: '珠江夜游天字码头', category: 'ticket', lat: 23.1260, lng: 113.2640, address: '越秀区沿江中路', note: '学生半价', price: '44元(学生)' },
  // 购物中心
  { id: 32, name: '天河城', category: 'mall', lat: 23.1360, lng: 113.3250, address: '天河区天河路208号', note: '大型购物中心', price: '免费逛' },
  { id: 33, name: '正佳广场', category: 'mall', lat: 23.1358, lng: 113.3280, address: '天河区天河路228号', note: '含极地海洋世界', price: '免费逛' },
  { id: 34, name: '太古汇', category: 'mall', lat: 23.1310, lng: 113.3210, address: '天河区天河路383号', note: '高端商场', price: '免费逛' },
  { id: 35, name: '天环广场', category: 'mall', lat: 23.1350, lng: 113.3260, address: '天河区天河路218号', note: '喜茶旗舰店所在', price: '免费逛' },
  // 地铁
  { id: 36, name: '体育西路站', category: 'metro', lat: 23.1358, lng: 113.3253, address: '天河区', note: '1/3号线换乘，最繁忙站点', price: '-' },
  { id: 37, name: '公园前站', category: 'metro', lat: 23.1285, lng: 113.2650, address: '越秀区', note: '1/2号线换乘，北京路直达', price: '-' },
  { id: 38, name: '珠江新城站', category: 'metro', lat: 23.1200, lng: 113.3260, address: '天河区', note: '3/5号线换乘，CBD核心', price: '-' },
  { id: 39, name: '广州塔站', category: 'metro', lat: 23.1066, lng: 113.3245, address: '海珠区', note: '3号线/APM线，广州塔直达', price: '-' },
  { id: 40, name: 'Livehouse', category: 'concert', lat: 23.1318, lng: 113.2756, address: '海珠区工业大道北（MAO Livehouse）', note: '棱镜乐队专场', price: '120元' }
]

// 深圳报告数据（精简版）
const SHENZHEN_REPORT = {
  cityCode: 'shenzhen',
  cityName: '深圳',
  generatedAt: '2026-07-30',
  totalCalls: 12,
  reportSize: '24.8KB',
  overview: {
    weather: '晴', tempRange: '28-35°C', weekend: '8月1日-8月2日',
    metroLines: 14, scenic5A: 2, concertCount: 4, marketCount: 3,
    museumCount: 6, foodStreetCount: 4, cityWalkCount: 2, teaShopCount: 3,
    highlights: ['深圳湾音乐节', '万象天地创意市集', '深圳博物馆改革开放展']
  },
  sections: [
    {
      index: 0, title: '一图速览', type: 'overview', icon: '\uD83D\uDCC8',
      content: '10秒拿到深圳本周末核心情报',
      summary: '深圳本周末晴28-35°C，4场演出+3个市集+6个博物馆展览，2条CityWalk路线。',
      tableData: [
        { label: '天气', value: '晴 28-35°C' },
        { label: '周末', value: '8月1日(六)-8月2日(日)' },
        { label: '地铁线路', value: '14条运营' },
        { label: '5A景区', value: '2个' },
        { label: '演出活动', value: '4场' },
        { label: '创意市集', value: '3个' },
        { label: '博物馆展览', value: '6个' },
        { label: '美食街', value: '4条' },
        { label: 'CityWalk', value: '2条路线' },
        { label: '喜茶旗舰店', value: '3家' }
      ]
    },
    {
      index: 1, title: '活动全清单', type: 'activities', icon: '\uD83C\uDFAF',
      content: '演唱会/集市/球赛/博物馆/5A景区全汇总',
      groups: [
        {
          category: 'concert', name: '演唱会/演出',
          items: [
            { name: '深圳湾音乐节', time: '8月1日 16:00', venue: '深圳湾体育中心', price: '299-699元', source: '大麦网' },
            { name: '开心麻花《乌龙山伯爵》', time: '8月2日 19:30', venue: '深圳保利剧院', price: '180-580元', source: '大麦网' },
            { name: 'B10 Live | 声音玩具', time: '8月1日 20:30', venue: '华侨城创意园', price: '150元', source: '秀动' },
            { name: '深圳交响乐团周末音乐会', time: '8月2日 20:00', venue: '深圳音乐厅', price: '50-280元', source: '大麦网' }
          ]
        },
        {
          category: 'market', name: '集市/夜市',
          items: [
            { name: '万象天地创意市集', time: '8月1-2日 10:00-22:00', venue: '万象天地', price: '免费', source: '小红书' },
            { name: '华侨城创意市集', time: '每周六日 11:00-19:00', venue: 'OCT-LOFT', price: '免费', source: '小红书' },
            { name: '东门夜市', time: '每晚18:00-凌晨', venue: '罗湖区东门', price: '免费', source: '大众点评' }
          ]
        },
        {
          category: 'museum', name: '博物馆/展览',
          items: [
            { name: '深圳博物馆 - 改革开放40周年展', time: '周二至日 10:00-18:00', venue: '市民中心', price: '免费', source: '深博官网' },
            { name: '关山月美术馆', time: '周二至日 9:00-17:00', venue: '福田区红荔路', price: '免费', source: '大众点评' },
            { name: '南山博物馆', time: '周二至日 10:00-18:00', venue: '南山区', price: '免费', source: '大众点评' }
          ]
        },
        {
          category: 'scenic', name: '5A景区',
          items: [
            { name: '世界之窗', time: '9:00-22:00', venue: '南山区华侨城', price: '220元', source: '美团' },
            { name: '华侨城旅游度假区', time: '全天开放', venue: '南山区', price: '各景区单独售票', source: '高德地图' }
          ]
        }
      ]
    },
    {
      index: 2, title: '优惠门票', type: 'ticket', icon: '\uD83C\uDF9F',
      content: '暑期特惠、考生免费等省钱信息',
      items: [
        { name: '世界之窗暑期特惠', desc: '中高考生凭准考证享8折', price: '原220元→176元', source: '美团', expiry: '8月31日' },
        { name: '深圳博物馆免费讲解', desc: '周末免费人工讲解（需预约）', price: '免费', source: '深博公众号', expiry: '长期' },
        { name: '深圳湾游船学生票', desc: '学生证半价', price: '原120元→60元', source: '大众点评', expiry: '9月1日' }
      ]
    },
    {
      index: 3, title: '喜茶门店热点', type: 'tea', icon: '\uD83C\uDF75',
      content: '品牌文化打卡 + 商场指引',
      items: [
        { name: '喜茶万象天地旗舰店', address: '南山区万象天地L2', feature: '品牌旗舰店', metro: '高新园站C出口', source: '喜茶GO' },
        { name: '喜茶KKMALL主题店', address: '罗湖区KKMALL负一层', feature: '黑色主题店', metro: '大剧院站B出口', source: '喜茶GO' },
        { name: '喜茶海岸城店', address: '南山区海岸城3楼', feature: '海景门店', metro: '后海站D出口', source: '大众点评' }
      ]
    },
    {
      index: 4, title: '美食街', type: 'food', icon: '\uD83C\uDF5C',
      content: '本地人真正会去的美食街',
      items: [
        { name: '东门美食街', address: '罗湖区东门', feature: '深圳最热闹美食街', metro: '老街站', rating: 4.3, source: '大众点评' },
        { name: '蛇口美食街', address: '南山区蛇口', feature: '异国风味聚集', metro: '蛇口港站', rating: 4.5, source: '小红书' },
        { name: '华强北美食', address: '福田区华强北', feature: '科技园旁的美食天堂', metro: '华强路站', rating: 4.2, source: '大众点评' },
        { name: '水围村美食街', address: '福田区水围村', feature: '城中村美食代表', metro: '福民站', rating: 4.4, source: '小红书' }
      ]
    },
    {
      index: 5, title: 'City Walk路线', type: 'walk', icon: '\uD83D\uDEB6',
      content: '经典步行路线与拍照点',
      items: [
        { name: '路线A：华侨城创意园环线', duration: '约2.5小时', distance: '3km', highlights: '创意园区、艺术空间、咖啡馆', photoSpots: 'OCT-LOFT墙绘、旧工厂改造', metro: '侨城东站B出口', source: '小红书' },
        { name: '路线B：深圳湾公园海滨', duration: '约2小时', distance: '4km', highlights: '海滨栈道、红树林、日落', photoSpots: '深圳湾大桥远景、红树林日落', metro: '深圳湾公园站', source: '小红书' }
      ]
    },
    {
      index: 6, title: '地铁路线', type: 'metro', icon: '\uD83D\uDE87',
      content: '线网总览 + 关键站点出口', metroLines: 14,
      keyStations: [
        { name: '世界之窗站', lines: '1/2号线换乘', exit: 'H出口世界之窗', note: '景区直达' },
        { name: '福田站', lines: '2/3/11号线换乘', exit: '出口直达购物公园', note: 'CBD核心换乘' },
        { name: '老街站', lines: '1/3号线换乘', exit: 'D出口东门步行街', note: '老城区核心' },
        { name: '后海站', lines: '2/11号线换乘', exit: 'D出口海岸城', note: '南山商业核心' }
      ],
      scenicDirect: [
        { name: '世界之窗', station: '世界之窗站H出口', note: '直达' },
        { name: '深圳博物馆', station: '市民中心站C出口', note: '步行5分钟' },
        { name: '深圳湾公园', station: '深圳湾公园站A出口', note: '直达' }
      ]
    },
    {
      index: 7, title: '周末组合路线', type: 'routes', icon: '\uD83D\uDDFA\uFE0F',
      content: 'A/B/C三条主题路线，带时间表',
      routes: [
        { id: 'A', name: '文艺青年线', icon: '\uD83C\uDFA8', color: '#7b1fa2', coverImage: '/assets/images/route-art.jpg', desc: '创意园+博物馆+市集',
          timeline: [
            { time: '10:00', activity: '华侨城创意园CityWalk', location: '南山', note: '创意园区' },
            { time: '12:00', activity: '创意园午餐', location: '南山', note: 'B10周边咖啡馆', mappable: false },
            { time: '14:00', activity: '深圳博物馆改革开放展', location: '福田', note: '免费需预约' },
            { time: '16:00', activity: '万象天地创意市集', location: '南山', note: '喜茶旗舰店' },
            { time: '18:00', activity: '万象天地晚餐', location: '南山', note: '海底捞/太二' },
            { time: '20:30', activity: 'B10 Live | 声音玩具', location: '华侨城', note: '需提前购票' }
          ]
        },
        { id: 'B', name: '情侣浪漫线', icon: '\uD83D\uDC95', color: '#ec407a', coverImage: '/assets/images/route-romance.jpg', desc: '深圳湾+世界之窗+音乐节',
          timeline: [
            { time: '09:30', activity: '深圳湾公园海滨漫步', location: '南山', note: '看日出海景' },
            { time: '12:00', activity: '海岸城午餐', location: '南山', note: '喜茶海岸城店' },
            { time: '14:00', activity: '世界之窗', location: '南山', note: '暑期8折特惠' },
            { time: '17:00', activity: '回酒店休息', location: '-', note: '换装准备', mappable: false },
            { time: '16:00', activity: '深圳湾音乐节', location: '南山', note: '16:00开始' },
            { time: '21:00', activity: '蛇口夜市晚餐', location: '南山', note: '异国美食', mappable: false }
          ]
        },
        { id: 'C', name: '亲子家庭线', icon: '\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67', color: '#2e7d32', coverImage: '/assets/images/route-family.jpg', desc: '世界之窗+博物馆+公园',
          timeline: [
            { time: '09:30', activity: '世界之窗', location: '南山', note: '学生8折特惠' },
            { time: '13:00', activity: '园区内午餐', location: '南山', note: '主题餐厅', mappable: false },
            { time: '15:00', activity: '深圳博物馆', location: '福田', note: '儿童免票' },
            { time: '17:00', activity: '莲花山公园', location: '福田', note: '登顶看全城' },
            { time: '18:30', activity: '华强北晚餐', location: '福田', note: '美食天堂', mappable: false },
            { time: '20:00', activity: '东门夜市逛街', location: '罗湖', note: '免费逛', mappable: false }
          ]
        }
      ]
    },
    {
      index: 8, title: '时效可靠性说明', type: 'reliability', icon: '\u26A0\uFE0F',
      content: '出行前请二次确认',
      notes: ['演出时间请以大麦网为准', '市集开放时间可能因天气调整', '博物馆需提前预约', '本报告生成于2026年7月30日']
    },
    {
      index: 9, title: 'API调用统计', type: 'stats', icon: '\uD83D\uDCCA',
      content: '透明展示每次调用', totalCalls: 12,
      batches: [
        { batch: 1, count: 5, queries: ['活动主力', '演唱会', '集市', '博物馆', '门票'], duration: '16秒', results: 38 },
        { batch: 2, count: 4, queries: ['喜茶', '美食街', 'CityWalk', '商场'], duration: '14秒', results: 28 },
        { batch: 3, count: 2, queries: ['地铁线网', '地铁出口'], duration: '7秒', results: 15 },
        { batch: '补查1', count: 1, queries: ['美食街补充'], duration: '6秒', results: 4 }
      ],
      totalResults: 85, reportSize: '24.8KB'
    }
  ],
  qualityCheck: {
    overallScore: 88,
    dimensions: [
      { id: 'completeness', name: '完整性', icon: '\u2705', score: 95, status: 'pass', desc: '11个方向已覆盖', issues: [] },
      { id: 'accuracy', name: '准确性', icon: '\u2705', score: 90, status: 'pass', desc: '已交叉验证', issues: [] },
      { id: 'richness', name: '丰富度', icon: '\u2705', score: 85, status: 'pass', desc: '信息密度达标', issues: [] },
      { id: 'feasibility', name: '可执行性', icon: '\u2705', score: 90, status: 'pass', desc: '路线时间合理', issues: [] },
      { id: 'sources', name: '信源多样性', icon: '\u26A0\uFE0F', score: 80, status: 'warning', desc: '部分仅1信源', issues: ['球赛信息需核实'] }
    ],
    iterations: 1, maxIterations: 2,
    supplementQueries: [{ query: '美食街补充', reason: '建议补：美食街<3条', status: 'done' }]
  },
  sources: [
    { name: '大麦网', type: '演出票务', count: 12 },
    { name: '小红书', type: '社交媒体', count: 18 },
    { name: '大众点评', type: '本地生活', count: 15 },
    { name: '高德地图', type: '地图服务', count: 8 },
    { name: '喜茶GO', type: '品牌官方', count: 3 },
    { name: '美团', type: '本地生活', count: 6 },
    { name: '深博公众号', type: '官方', count: 3 }
  ],
  workflow: [
    { step: 1, name: '时间锁定', status: 'done', duration: '即时', detail: '本周末: 8月1日-8月2日' },
    { step: 2, name: '用户确认', status: 'done', duration: '即时', detail: '城市:深圳 已确认' },
    { step: 3, name: '建任务+目录', status: 'done', duration: '即时', detail: '创建6个TodoTask' },
    { step: 4, name: '写query', status: 'done', duration: '1分钟', detail: '11个方向已就绪' },
    { step: 5, name: '并行搜索', status: 'done', duration: '37秒', detail: '5+4+2三批次并行' },
    { step: 6, name: '解析响应', status: 'done', duration: '即时', detail: '文本流切分完成' },
    { step: 7, name: '整合报告', status: 'done', duration: '3分钟', detail: '10节结构初稿' },
    { step: 8, name: '质量检查', status: 'done', duration: '2分钟', detail: '1轮补查询(1次)' },
    { step: 9, name: 'HTML输出', status: 'skip', duration: '-', detail: '未要求HTML' },
    { step: 10, name: '地图面板', status: 'done', duration: '1分钟', detail: '标记已生成' }
  ]
}

const SHENZHEN_PLACES = [
  { id: 101, name: '深圳湾体育中心', category: 'concert', lat: 22.5151, lng: 113.9420, address: '南山区滨海大道', note: '深圳湾音乐节', price: '299-699元' },
  { id: 102, name: '深圳保利剧院', category: 'concert', lat: 22.5048, lng: 113.9360, address: '南山区文心五路', note: '开心麻花', price: '180-580元' },
  { id: 103, name: 'B10 Live', category: 'concert', lat: 22.5340, lng: 113.9710, address: '南山区华侨城创意园', note: '声音玩具', price: '150元' },
  { id: 104, name: '深圳音乐厅', category: 'concert', lat: 22.5450, lng: 114.0610, address: '福田区福中一路', note: '交响乐团', price: '50-280元' },
  { id: 105, name: '万象天地', category: 'market', lat: 22.5370, lng: 113.9470, address: '南山区深南大道', note: '创意市集', price: '免费' },
  { id: 106, name: '华侨城创意园', category: 'market', lat: 22.5340, lng: 113.9710, address: '南山区锦绣北街', note: '创意市集+CityWalk', price: '免费' },
  { id: 107, name: '深圳博物馆', category: 'museum', lat: 22.5431, lng: 114.0579, address: '福田区市民中心', note: '改革开放展', price: '免费(需预约)' },
  { id: 108, name: '世界之窗', category: 'scenic', lat: 22.5340, lng: 113.9720, address: '南山区华侨城', note: '5A景区', price: '220元(学生8折)' },
  { id: 109, name: '深圳湾公园', category: 'walk', lat: 22.5050, lng: 113.9420, address: '南山区滨海大道', note: 'CityWalk海滨路线', price: '免费' },
  { id: 110, name: '海岸城', category: 'mall', lat: 22.5048, lng: 113.9360, address: '南山区文心五路', note: '大型购物中心', price: '免费逛' },
  { id: 111, name: '喜茶万象天地店', category: 'tea', lat: 22.5370, lng: 113.9470, address: '南山区万象天地L2', note: '品牌旗舰店', price: '人均25元' },
  { id: 112, name: '莲花山公园', category: 'scenic', lat: 22.5603, lng: 114.0660, address: '福田区红荔路', note: '登顶看市中心全景', price: '免费' }
]

// 成都报告数据（精简版）
const CHENGDU_REPORT = {
  cityCode: 'chengdu',
  cityName: '成都',
  generatedAt: '2026-07-30',
  totalCalls: 13,
  reportSize: '26.2KB',
  overview: {
    weather: '阴转阵雨', tempRange: '24-32°C', weekend: '8月1日-8月2日',
    metroLines: 12, scenic5A: 3, concertCount: 3, marketCount: 4,
    museumCount: 7, foodStreetCount: 5, cityWalkCount: 3, teaShopCount: 3,
    highlights: ['成都草莓音乐节', '宽窄巷子夜市', '金沙遗址博物馆特展']
  },
  sections: [
    {
      index: 0, title: '一图速览', type: 'overview', icon: '\uD83D\uDCC8',
      content: '10秒拿到成都本周末核心情报',
      summary: '成都本周末阴转阵雨24-32°C，3场演出+4个市集+7个博物馆展览。',
      tableData: [
        { label: '天气', value: '阴转阵雨 24-32°C' },
        { label: '周末', value: '8月1日(六)-8月2日(日)' },
        { label: '地铁线路', value: '12条运营' },
        { label: '5A景区', value: '3个' },
        { label: '演出活动', value: '3场' },
        { label: '创意市集', value: '4个' },
        { label: '博物馆展览', value: '7个' },
        { label: '美食街', value: '5条' },
        { label: 'CityWalk', value: '3条路线' },
        { label: '喜茶旗舰店', value: '3家' }
      ]
    },
    {
      index: 1, title: '活动全清单', type: 'activities', icon: '\uD83C\uDFAF',
      content: '演唱会/集市/球赛/博物馆/5A景区全汇总',
      groups: [
        {
          category: 'concert', name: '演唱会/演出',
          items: [
            { name: '成都草莓音乐节', time: '8月2日 14:00', venue: '露天音乐公园', price: '299-599元', source: '大麦网' },
            { name: '开心麻花《贼想得到你》', time: '8月1日 19:30', venue: '成都城市音乐厅', price: '180-580元', source: '大麦网' },
            { name: '正火Live | 海龟先生', time: '8月2日 20:00', venue: '正火艺术中心', price: '180元', source: '秀动' }
          ]
        },
        {
          category: 'market', name: '集市/夜市',
          items: [
            { name: '宽窄巷子夜市', time: '每晚18:00-23:00', venue: '青羊区宽窄巷子', price: '免费', source: '小红书' },
            { name: '东郊记忆文创市集', time: '8月1-2日 11:00-20:00', venue: '成华区东郊记忆', price: '免费', source: '小红书' },
            { name: '铁像寺水街市集', time: '每周六日 10:00-21:00', venue: '高新区', price: '免费', source: '大众点评' },
            { name: '太古里周末市集', time: '8月2日 10:00-22:00', venue: '锦江区太古里', price: '免费', source: '小红书' }
          ]
        },
        {
          category: 'museum', name: '博物馆/展览',
          items: [
            { name: '金沙遗址博物馆', time: '8:00-18:00', venue: '青羊区金沙遗址路', price: '70元', source: '大众点评' },
            { name: '成都博物馆', time: '周二至日 9:00-17:00', venue: '天府广场', price: '免费', source: '成博官网' },
            { name: '四川博物院', time: '周二至日 9:00-17:00', venue: '浣花南路', price: '免费', source: '大众点评' }
          ]
        },
        {
          category: 'scenic', name: '5A景区',
          items: [
            { name: '都江堰', time: '8:00-17:30', venue: '都江堰市', price: '80元', source: '美团' },
            { name: '青城山', time: '8:00-17:00', venue: '都江堰市', price: '90元', source: '美团' },
            { name: '武侯祠', time: '8:00-18:00', venue: '武侯区武侯祠大街', price: '50元', source: '大众点评' }
          ]
        }
      ]
    },
    {
      index: 4, title: '美食街', type: 'food', icon: '\uD83C\uDF5C',
      content: '本地人真正会去的美食街',
      items: [
        { name: '建设路美食街', address: '成华区建设路', feature: '成都最火网红美食街', metro: '建设路站', rating: 4.5, source: '小红书' },
        { name: '锦里美食街', address: '武侯区锦里', feature: '游客友好的传统美食', metro: '高升桥站', rating: 4.2, source: '大众点评' },
        { name: '玉林路', address: '武侯区玉林路', feature: '赵雷歌里的成都', metro: '倪家桥站', rating: 4.6, source: '小红书' },
        { name: '魁星楼街', address: '青羊区魁星楼', feature: '隐藏的宝藏美食街', metro: '宽窄巷子站', rating: 4.7, source: '大众点评' },
        { name: '祥和里', address: '成华区祥和里', feature: '本地人的深夜食堂', metro: '建设路站', rating: 4.4, source: '小红书' }
      ]
    },
    {
      index: 5, title: 'City Walk路线', type: 'walk', icon: '\uD83D\uDEB6',
      content: '经典步行路线与拍照点',
      items: [
        { name: '路线A：宽窄巷子→奎星楼→小通巷', duration: '约3小时', distance: '4km', highlights: '宽窄巷子、魁星楼美食、小通巷文艺', photoSpots: '宽窄巷子入口、魁星楼街口', metro: '宽窄巷子站出发', source: '小红书' },
        { name: '路线B：东郊记忆→建设路', duration: '约2.5小时', distance: '3.5km', highlights: '工业遗址、文创市集、建设路美食', photoSpots: '东郊记忆大门、建设路夜市', metro: '东郊记忆站出发', source: '小红书' },
        { name: '路线C：玉林路→芳草街', duration: '约2小时', distance: '2.5km', highlights: '赵雷的成都、玉林美食、芳草街文艺', photoSpots: '玉林路口、小酒馆', metro: '倪家桥站出发', source: '小红书' }
      ]
    },
    {
      index: 7, title: '周末组合路线', type: 'routes', icon: '\uD83D\uDDFA\uFE0F',
      content: 'A/B/C三条主题路线，带时间表',
      routes: [
        { id: 'A', name: '文艺青年线', icon: '\uD83C\uDFA8', color: '#7b1fa2', coverImage: '/assets/images/route-art.jpg', desc: '博物馆+CityWalk+市集',
          timeline: [
            { time: '09:00', activity: '金沙遗址博物馆', location: '青羊', note: '70元门票' },
            { time: '12:00', activity: '奎星楼街午餐', location: '青羊', note: '隐藏美食街', mappable: false },
            { time: '14:00', activity: '宽窄巷子CityWalk', location: '青羊', note: '免费逛' },
            { time: '16:30', activity: '东郊记忆文创市集', location: '成华', note: '免费' },
            { time: '18:00', activity: '建设路晚餐', location: '成华', note: '网红美食街' },
            { time: '20:00', activity: '正火Live | 海龟先生', location: '成华', note: '需提前购票' }
          ]
        },
        { id: 'B', name: '情侣浪漫线', icon: '\uD83D\uDC95', color: '#ec407a', coverImage: '/assets/images/route-romance.jpg', desc: '宽窄巷子+九眼桥夜景，甜蜜周末',
          timeline: [
            { time: '10:00', activity: '宽窄巷子漫步+拍照', location: '青羊', note: '古风小巷' },
            { time: '12:00', activity: '奎星楼街午餐', location: '青羊', note: '网红美食', mappable: false },
            { time: '14:00', activity: '人民公园鹤鸣茶社', location: '青羊', note: '悠闲下午茶' },
            { time: '16:30', activity: '太古里逛街+喜茶', location: '锦江', note: '太古里旗舰店' },
            { time: '18:30', activity: '九眼桥晚餐+夜景', location: '武侯', note: '浪漫河景', mappable: false },
            { time: '20:00', activity: '锦里夜游', location: '武侯', note: '红灯笼古街' }
          ]
        },
        { id: 'C', name: '亲子家庭线', icon: '\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67', color: '#2e7d32', coverImage: '/assets/images/route-family.jpg', desc: '熊猫+博物馆+公园',
          timeline: [
            { time: '08:30', activity: '大熊猫繁育基地', location: '成华', note: '55元(需预约)' },
            { time: '12:00', activity: '建设路午餐', location: '成华', note: '网红美食' },
            { time: '14:00', activity: '成都博物馆', location: '青羊', note: '免费需预约' },
            { time: '16:00', activity: '人民公园喝茶', location: '青羊', note: '鹤鸣茶社', mappable: false },
            { time: '18:00', activity: '宽窄巷子晚餐', location: '青羊', note: '传统川菜' },
            { time: '20:00', activity: '宽窄巷子夜市', location: '青羊', note: '免费逛' }
          ]
        }
      ]
    }
  ],
  qualityCheck: {
    overallScore: 90,
    dimensions: [
      { id: 'completeness', name: '完整性', icon: '\u2705', score: 95, status: 'pass', desc: '11个方向已覆盖', issues: [] },
      { id: 'accuracy', name: '准确性', icon: '\u2705', score: 92, status: 'pass', desc: '已交叉验证', issues: [] },
      { id: 'richness', name: '丰富度', icon: '\u2705', score: 88, status: 'pass', desc: '信息密度达标', issues: [] },
      { id: 'feasibility', name: '可执行性', icon: '\u2705', score: 90, status: 'pass', desc: '路线合理', issues: [] },
      { id: 'sources', name: '信源多样性', icon: '\u2705', score: 85, status: 'pass', desc: '信源充足', issues: [] }
    ],
    iterations: 0, maxIterations: 2,
    supplementQueries: []
  },
  sources: [
    { name: '大麦网', type: '演出票务', count: 10 },
    { name: '小红书', type: '社交媒体', count: 22 },
    { name: '大众点评', type: '本地生活', count: 18 },
    { name: '高德地图', type: '地图服务', count: 10 },
    { name: '美团', type: '本地生活', count: 8 }
  ],
  workflow: [
    { step: 1, name: '时间锁定', status: 'done', duration: '即时', detail: '本周末: 8月1日-8月2日' },
    { step: 2, name: '用户确认', status: 'done', duration: '即时', detail: '城市:成都 已确认' },
    { step: 3, name: '建任务+目录', status: 'done', duration: '即时', detail: '创建6个TodoTask' },
    { step: 4, name: '写query', status: 'done', duration: '2分钟', detail: '11个方向已就绪' },
    { step: 5, name: '并行搜索', status: 'done', duration: '42秒', detail: '5+4+2三批次并行' },
    { step: 6, name: '解析响应', status: 'done', duration: '即时', detail: '文本流切分完成' },
    { step: 7, name: '整合报告', status: 'done', duration: '4分钟', detail: '10节结构初稿' },
    { step: 8, name: '质量检查', status: 'done', duration: '2分钟', detail: '通过，无需补查' },
    { step: 9, name: 'HTML输出', status: 'skip', duration: '-', detail: '未要求HTML' },
    { step: 10, name: '地图面板', status: 'done', duration: '1分钟', detail: '标记已生成' }
  ]
}

const CHENGDU_PLACES = [
  { id: 201, name: '露天音乐公园', category: 'concert', lat: 30.6850, lng: 104.0620, address: '金牛区北三环', note: '草莓音乐节', price: '299-599元' },
  { id: 202, name: '成都城市音乐厅', category: 'concert', lat: 30.6420, lng: 104.0750, address: '武侯区一环路', note: '开心麻花', price: '180-580元' },
  { id: 203, name: '宽窄巷子', category: 'market', lat: 30.6710, lng: 104.0490, address: '青羊区宽窄巷子', note: '夜市+CityWalk', price: '免费' },
  { id: 204, name: '东郊记忆', category: 'market', lat: 30.6720, lng: 104.1310, address: '成华区建设南路', note: '文创市集', price: '免费' },
  { id: 205, name: '金沙遗址博物馆', category: 'museum', lat: 30.6770, lng: 104.0180, address: '青羊区金沙遗址路', note: '太阳神鸟', price: '70元' },
  { id: 206, name: '成都博物馆', category: 'museum', lat: 30.6590, lng: 104.0650, address: '青羊区天府广场', note: '免费展览', price: '免费(需预约)' },
  { id: 207, name: '大熊猫基地', category: 'scenic', lat: 30.7370, lng: 104.1550, address: '成华区熊猫大道', note: '必去景点', price: '55元(需预约)' },
  { id: 208, name: '武侯祠', category: 'scenic', lat: 30.6380, lng: 104.0480, address: '武侯区武侯祠大街', note: '5A景区', price: '50元' },
  { id: 209, name: '锦里', category: 'food', lat: 30.6380, lng: 104.0470, address: '武侯区武侯祠旁', note: '传统美食街', price: '人均40元' },
  { id: 210, name: '建设路', category: 'food', lat: 30.6730, lng: 104.1200, address: '成华区建设路', note: '网红美食街', price: '人均50元' },
  { id: 211, name: '玉林路', category: 'food', lat: 30.6200, lng: 104.0700, address: '武侯区玉林路', note: '赵雷的成都', price: '人均60元' },
  { id: 212, name: '太古里', category: 'mall', lat: 30.6530, lng: 104.0850, address: '锦江区中纱帽街', note: '高端商场', price: '免费逛' },
  { id: 213, name: '喜茶太古里店', category: 'tea', lat: 30.6530, lng: 104.0850, address: '锦江区太古里', note: '品牌旗舰店', price: '人均25元' },
  { id: 214, name: '正火Live', category: 'concert', lat: 30.6690, lng: 104.1300, address: '成华区东郊记忆', note: '正火艺术中心·海龟先生专场', price: '180元' },
  { id: 215, name: '人民公园鹤鸣茶社', category: 'food', lat: 30.6626, lng: 104.0630, address: '青羊区人民公园', note: '百年茶社', price: '人均40元' }
]

// 数据仓库
const REPORTS = {
  guangzhou: { report: GUANGZHOU_REPORT, places: GUANGZHOU_PLACES },
  shenzhen: { report: SHENZHEN_REPORT, places: SHENZHEN_PLACES },
  chengdu: { report: CHENGDU_REPORT, places: CHENGDU_PLACES }
}

// ===== 报告生成器 =====
// 为没有手写报告的城市自动生成标准化报告数据

// 手写报告（广州/深圳/成都）的 weekend 固定为某周，跨周后会永久显示"已过期"。
// 返回克隆并按当前周末刷新周末锁定点，避免过期横幅长期误报。
// offset: 0=本周末, 1=下周末
function refreshStaticReportWeekend(report, offset = 0) {
  const weekendStr = getWeekendString(offset)
  const clone = JSON.parse(JSON.stringify(report))

  if (clone.overview) {
    clone.overview.weekend = weekendStr
  }
  if (clone.sections) {
    clone.sections.forEach(s => {
      if (!s) return
      if (s.type === 'overview' && s.tableData) {
        s.tableData.forEach(row => {
          if (row.label === '周末') row.value = weekendStr
        })
      }
    })
  }
  if (clone.workflow && clone.workflow.length) {
    const step = clone.workflow.find(st => st.name === '时间锁定')
    if (step && step.detail) {
      step.detail = (offset === 1 ? '下周末: ' : '本周末: ') + weekendStr
    }
  }
  return clone
}

function generateReport(cityCode, opts = {}) {
  const weekendOffset = opts.weekendOffset || 0
  const preference = opts.preference || ''

  // P1：置信度加权合并（手写精校 > REAL 为基，叠加 citymap 抓取；同名取高置信坐标 + 冲突检测）
  const merged = getMergedCity(cityCode)
  if (merged) {
    const report = refreshStaticReportWeekend(merged.report, weekendOffset)
    return applyPreferenceToReport(report, preference, weekendOffset)
  }

  const city = getCity(cityCode)
  if (!city) return null

  const kw = city.keywords
  const mallList = kw.malls.split('、')
  const foodList = kw.foodArea.split('、')
  const scenicList = kw.scenic.split('、')
  const weekend = getWeekendString(weekendOffset)

  // 生成活动数据
  const concerts = generateActivities('concert', city)
  const markets = generateActivities('market', city)
  const museums = generateActivities('museum', city)
  const scenics = generateActivities('scenic', city)
  const sports = generateActivities('sport', city)

  // 生成美食街数据
  const foodStreets = foodList.map((name, i) => ({
    name: name + (name.includes('街') ? '' : '美食街'),
    address: city.name + '市' + name,
    feature: ['老字号集中', '地道本地味', '年轻人聚集地', '网红打卡地'][i % 4],
    metro: '地铁直达',
    rating: parseFloat((4.2 + Math.random() * 0.5).toFixed(1)),
    source: '大众点评'
  }))

  // 生成 CityWalk 路线
  const walks = [
    {
      name: `路线A：${scenicList[0]}→${foodList[0]}`,
      duration: '约3小时', distance: '4km',
      highlights: `${scenicList[0]}、${foodList[0]}美食、城市探索`,
      photoSpots: `${scenicList[0]}入口、${foodList[0]}街景`,
      metro: '地铁直达', source: '小红书'
    },
    {
      name: `路线B：${kw.landmark}周边漫步`,
      duration: '约2.5小时', distance: '3km',
      highlights: `${kw.landmark}、城市风光、拍照打卡`,
      photoSpots: `${kw.landmark}广场`,
      metro: '地铁直达', source: '小红书'
    }
  ]

  // 生成3条周末路线
  const routes = [
    {
      id: 'A', name: '文艺青年线', icon: '\uD83C\uDFA8', color: '#7b1fa2',
      coverImage: '/assets/images/route-art.jpg',
      desc: '博物馆+CityWalk+市集，文化深度体验',
      timeline: [
        { time: '09:30', activity: `${museums[0]?.name || scenicList[0]}`, location: city.name, note: '建议预约' },
        { time: '12:00', activity: `${foodList[0]}午餐`, location: city.name, note: '本地美食' },
        { time: '14:00', activity: `${scenicList[0]}CityWalk`, location: city.name, note: '拍照打卡' },
        { time: '16:30', activity: `${markets[0]?.name || '创意市集'}`, location: city.name, note: '免费' },
        { time: '18:30', activity: `${foodList[1] || foodList[0]}晚餐`, location: city.name, note: '老字号' },
        { time: '20:00', activity: `${kw.landmark}夜景`, location: city.name, note: '免费观赏' }
      ]
    },
    {
      id: 'B', name: '情侣浪漫线', icon: '\uD83D\uDC95', color: '#ec407a',
      coverImage: '/assets/images/route-romance.jpg',
      desc: `${kw.landmark}+夜景+美食，甜蜜周末`,
      timeline: [
        { time: '10:00', activity: `${scenicList[0]}漫步+拍照`, location: city.name, note: '风景优美' },
        { time: '12:00', activity: `${foodList[0]}午餐`, location: city.name, note: '特色美食' },
        { time: '14:00', activity: `${scenicList[1] || scenicList[0]}参观`, location: city.name, note: '门票实惠' },
        { time: '16:00', activity: `${mallList[0]}逛街+下午茶`, location: city.name, note: '喜茶门店' },
        { time: '18:30', activity: `${foodList[1] || foodList[0]}晚餐`, location: city.name, note: '浪漫餐厅' },
        { time: '20:00', activity: `${kw.landmark}夜景`, location: city.name, note: '灯光璀璨' }
      ]
    },
    {
      id: 'C', name: '亲子家庭线', icon: '\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67', color: '#2e7d32',
      coverImage: '/assets/images/route-family.jpg',
      desc: `景区+博物馆+公园，老少皆宜`,
      timeline: [
        { time: '09:00', activity: `${scenicList[scenicList.length - 1] || scenicList[0]}`, location: city.name, note: '适合全家' },
        { time: '12:00', activity: `${mallList[0]}午餐`, location: city.name, note: '商场餐饮' },
        { time: '14:00', activity: `${museums[0]?.name || '市博物馆'}`, location: city.name, note: '免费/需预约' },
        { time: '16:00', activity: `城市公园休闲`, location: city.name, note: '免费' },
        { time: '18:00', activity: `${foodList[0]}晚餐`, location: city.name, note: '地道美食' },
        { time: '20:00', activity: `${kw.landmark}夜游`, location: city.name, note: '免费' }
      ]
    }
  ]

  const report = {
    cityCode: city.code,
    cityName: city.name,
    generatedAt: '2026-07-30',
    totalCalls: 11 + Math.floor(Math.random() * 3),
    reportSize: '22-28KB',
    overview: {
      weather: '晴转多云',
      tempRange: '25-33°C',
      weekend: weekend,
      metroLines: 8 + Math.floor(Math.random() * 8),
      scenic5A: scenicList.length,
      concertCount: concerts.length,
      marketCount: markets.length,
      museumCount: museums.length,
      foodStreetCount: foodStreets.length,
      cityWalkCount: walks.length,
      teaShopCount: 2 + Math.floor(Math.random() * 3),
      highlights: [
        `${concerts[0]?.name || city.name + '周末演出'}`,
        `${markets[0]?.name || '创意市集'}`,
        `${museums[0]?.name || '博物馆展览'}`
      ]
    },
    sections: [
      {
        index: 0, title: '一图速览', type: 'overview', icon: '\uD83D\uDCC8',
        content: `10秒拿到${city.name}本周末核心情报`,
        summary: `${city.name}本周末晴转多云，${concerts.length}场演出+${markets.length}个市集+${museums.length}个展览。`,
        tableData: [
          { label: '天气', value: '晴转多云 25-33°C' },
          { label: '周末', value: weekend },
          { label: '地铁线路', value: `${8 + Math.floor(Math.random() * 8)}条运营` },
          { label: '5A景区', value: `${scenicList.length}个` },
          { label: '演出活动', value: `${concerts.length}场` },
          { label: '创意市集', value: `${markets.length}个` },
          { label: '博物馆展览', value: `${museums.length}个` },
          { label: '美食街', value: `${foodStreets.length}条` },
          { label: 'CityWalk', value: `${walks.length}条路线` },
          { label: '喜茶旗舰店', value: `${2 + Math.floor(Math.random() * 3)}家` }
        ]
      },
      {
        index: 1, title: '活动全清单', type: 'activities', icon: '\uD83C\uDFAF',
        content: '演唱会/集市/球赛/博物馆/5A景区全汇总',
        groups: [
          { category: 'concert', name: '演唱会/演出', items: concerts },
          { category: 'market', name: '集市/夜市', items: markets },
          { category: 'museum', name: '博物馆/展览', items: museums },
          { category: 'scenic', name: '5A景区', items: scenics }
        ]
      },
      {
        index: 2, title: '优惠门票', type: 'ticket', icon: '\uD83C\uDF9F',
        content: '暑期特惠、考生免费等省钱信息',
        items: [
          { name: `${scenicList[0]}暑期特惠`, desc: '中高考生凭准考证享8折', price: '原价8折', source: '美团', expiry: '8月31日' },
          { name: `${museums[0]?.name || '博物馆'}免费讲解`, desc: '周末免费人工讲解（需预约）', price: '免费', source: '公众号', expiry: '长期' }
        ]
      },
      {
        index: 3, title: '喜茶门店热点', type: 'tea', icon: '\uD83C\uDF75',
        content: '品牌文化打卡 + 商场指引',
        items: mallList.slice(0, 3).map(mall => ({
          name: `喜茶${mall}店`, address: mall, feature: '品牌门店',
          metro: '地铁直达', source: '喜茶GO'
        }))
      },
      {
        index: 4, title: '美食街', type: 'food', icon: '\uD83C\uDF5C',
        content: '本地人真正会去的美食街',
        items: foodStreets
      },
      {
        index: 5, title: 'City Walk路线', type: 'walk', icon: '\uD83D\uDEB6',
        content: '经典步行路线与拍照点',
        items: walks
      },
      {
        index: 6, title: '地铁路线', type: 'metro', icon: '\uD83D\uDE87',
        content: '线网总览 + 关键站点出口',
        metroLines: 8 + Math.floor(Math.random() * 8),
        keyStations: [
          { name: `${kw.landmark}站`, lines: '1/2号线换乘', exit: 'A出口直达', note: '地标直达' },
          { name: '市中心站', lines: '1/3号线换乘', exit: 'B出口商圈', note: '核心换乘' }
        ],
        scenicDirect: scenicList.slice(0, 3).map(s => ({
          name: s, station: s + '站', note: '直达'
        }))
      },
      {
        index: 7, title: '周末组合路线', type: 'routes', icon: '\uD83D\uDDFA\uFE0F',
        content: 'A/B/C三条主题路线，带时间表',
        routes: routes
      },
      {
        index: 8, title: '时效可靠性说明', type: 'reliability', icon: '\u26A0\uFE0F',
        content: '出行前请二次确认',
        notes: [
          '演出时间请以大麦网为准',
          '市集开放时间可能因天气调整',
          '博物馆需提前在官方公众号预约',
          '本报告生成于2026年7月30日，建议出行前二次核实'
        ]
      },
      {
        index: 9, title: 'API调用统计', type: 'stats', icon: '\uD83D\uDCCA',
        content: '透明展示每次调用',
        totalCalls: 11 + Math.floor(Math.random() * 3),
        batches: [
          { batch: 1, count: 5, queries: ['活动主力', '演唱会', '集市', '博物馆', '门票'], duration: '16秒', results: 35 },
          { batch: 2, count: 4, queries: ['喜茶', '美食街', 'CityWalk', '商场'], duration: '14秒', results: 28 },
          { batch: 3, count: 2, queries: ['地铁线网', '地铁出口'], duration: '7秒', results: 12 }
        ],
        totalResults: 75 + Math.floor(Math.random() * 20),
        reportSize: '22-28KB'
      }
    ],
    qualityCheck: {
      overallScore: 88 + Math.floor(Math.random() * 5),
      dimensions: [
        { id: 'completeness', name: '完整性', icon: '\u2705', score: 95, status: 'pass', desc: '11个方向已覆盖', issues: [] },
        { id: 'accuracy', name: '准确性', icon: '\u2705', score: 88, status: 'pass', desc: '已交叉验证', issues: [] },
        { id: 'richness', name: '丰富度', icon: '\u2705', score: 90, status: 'pass', desc: '信息密度达标', issues: [] },
        { id: 'feasibility', name: '可执行性', icon: '\u2705', score: 85, status: 'pass', desc: '路线合理', issues: [] },
        { id: 'sources', name: '信源多样性', icon: '\u26A0\uFE0F', score: 80, status: 'warning', desc: '部分仅1信源', issues: ['建议出行前核实'] }
      ],
      iterations: 0, maxIterations: 2, supplementQueries: []
    },
    sources: [
      { name: '大麦网', type: '演出票务', count: 8 + Math.floor(Math.random() * 5) },
      { name: '小红书', type: '社交媒体', count: 15 + Math.floor(Math.random() * 10) },
      { name: '大众点评', type: '本地生活', count: 12 + Math.floor(Math.random() * 8) },
      { name: '高德地图', type: '地图服务', count: 6 + Math.floor(Math.random() * 5) },
      { name: '美团', type: '本地生活', count: 5 + Math.floor(Math.random() * 5) }
    ],
    workflow: [
      { step: 1, name: '时间锁定', status: 'done', duration: '即时', detail: `${weekendOffset === 1 ? '下周末' : '本周末'}: ${weekend}` },
      { step: 2, name: '用户确认', status: 'done', duration: '即时', detail: `城市:${city.name} 已确认` },
      { step: 3, name: '建任务+目录', status: 'done', duration: '即时', detail: '创建6个TodoTask' },
      { step: 4, name: '写query', status: 'done', duration: '1分钟', detail: '11个方向已就绪' },
      { step: 5, name: '并行搜索', status: 'done', duration: '35秒', detail: '5+4+2三批次并行' },
      { step: 6, name: '解析响应', status: 'done', duration: '即时', detail: '文本流切分完成' },
      { step: 7, name: '整合报告', status: 'done', duration: '3分钟', detail: '10节结构初稿' },
      { step: 8, name: '质量检查', status: 'done', duration: '2分钟', detail: '通过，无需补查' },
      { step: 9, name: 'HTML输出', status: 'skip', duration: '-', detail: '未要求HTML' },
      { step: 10, name: '地图面板', status: 'done', duration: '1分钟', detail: '标记已生成' }
    ]
  }

  return applyPreferenceToReport(report, preference, weekendOffset)
}

// 按用户偏好调整报告：将匹配的路线置顶、突出相关节
// preference: ''(默认) | family | couple | art | food
function applyPreferenceToReport(report, preference, weekendOffset) {
  if (!preference || !report) return report
  const prefMeta = {
    family: { routeId: 'C', name: '亲子家庭', tag: '亲子' },
    couple: { routeId: 'B', name: '情侣浪漫', tag: '情侣' },
    art: { routeId: 'A', name: '文艺青年', tag: '文艺' },
    food: { routeId: null, name: '美食', tag: '吃货' }
  }
  const meta = prefMeta[preference]
  if (!meta) return report

  // 1. 路线重排：目标路线置顶
  const routesSection = report.sections && report.sections.find(s => s.type === 'routes')
  if (routesSection && routesSection.routes && routesSection.routes.length) {
    let routes = routesSection.routes
    if (meta.routeId) {
      const idx = routes.findIndex(r => r.id === meta.routeId)
      if (idx > 0) {
        const target = routes.splice(idx, 1)[0]
        routes = [target].concat(routes)
      }
      // 标记推荐路线
      routesSection.routes = routes
      if (routes[0]) routes[0]._preferred = meta.tag
      routesSection._preferred = meta.tag
    } else if (preference === 'food') {
      // 吃货偏好：按含"美食/夜市/小吃"关键词数量降序排路线
      const foodScore = r => {
        const text = (r.desc || '') + (r.timeline || []).map(t => (t.activity || '') + (t.note || '')).join('')
        return (text.match(/美食|夜市|小吃|餐|食|茶/g) || []).length
      }
      routes = routes.slice().sort((a, b) => foodScore(b) - foodScore(a))
      routesSection.routes = routes
      if (routes[0]) routes[0]._preferred = meta.tag
      routesSection._preferred = meta.tag
    }
    if (meta.routeId && routes[0]) {
      routes[0]._preferred = meta.tag
      routesSection._preferred = meta.tag
    }
    // 更新节副标题
    const weekLabel = weekendOffset === 1 ? '下周末' : '本周末'
    routesSection.content = `${weekLabel}·${meta.tag}偏好 · A/B/C三条主题路线`
  }

  // 2. 概览摘要追加偏好标签
  const ovSection = report.sections && report.sections.find(s => s.type === 'overview')
  if (ovSection) {
    const suffix = ` · 已按「${meta.tag}」偏好整理`
    if (!ovSection.summary.includes(suffix)) {
      ovSection.summary += suffix
    }
  }

  // 3. 工作流"用户确认"补记偏好
  const wf = report.workflow
  if (wf && wf.length) {
    const step = wf.find(st => st.name === '用户确认')
    if (step && step.detail) {
      step.detail += ` · 偏好:${meta.tag}`
    }
  }

  return report
}

// 生成地图标记点
function generatePlaces(cityCode) {
  const merged = getMergedCity(cityCode)
  if (merged) {
    return merged.places
  }

  const city = getCity(cityCode)
  if (!city) return []

  const kw = city.keywords
  const center = city.center
  const places = []
  let id = cityCode.charCodeAt(0) * 1000

  // 在城市中心附近生成标记点
  function offsetLat() { return center.lat + (Math.random() - 0.5) * 0.08 }
  function offsetLng() { return center.lng + (Math.random() - 0.5) * 0.08 }

  // 演唱会
  places.push({
    id: id++, name: `${city.name}体育馆`, category: 'concert',
    lat: offsetLat(), lng: offsetLng(),
    address: city.name + '市体育馆', note: '周末演出', price: '180-680元'
  })

  // 集市
  kw.foodArea.split('、').slice(0, 2).forEach(name => {
    places.push({
      id: id++, name: name + (name.includes('市') ? '' : '市集'), category: 'market',
      lat: offsetLat(), lng: offsetLng(),
      address: city.name + name, note: '周末创意市集', price: '免费'
    })
  })

  // 博物馆
  places.push({
    id: id++, name: `${city.name}博物馆`, category: 'museum',
    lat: offsetLat(), lng: offsetLng(),
    address: city.name + '市中心', note: '免费(需预约)', price: '免费'
  })

  // 5A景区
  kw.scenic.split('、').forEach(name => {
    places.push({
      id: id++, name: name, category: 'scenic',
      lat: offsetLat(), lng: offsetLng(),
      address: city.name + name, note: '核心景区', price: '50-120元'
    })
  })

  // 喜茶
  kw.malls.split('、').slice(0, 2).forEach(mall => {
    places.push({
      id: id++, name: `喜茶${mall}店`, category: 'tea',
      lat: offsetLat(), lng: offsetLng(),
      address: mall, note: '品牌门店', price: '人均25元'
    })
  })

  // 美食街
  kw.foodArea.split('、').forEach(name => {
    places.push({
      id: id++, name: name, category: 'food',
      lat: offsetLat(), lng: offsetLng(),
      address: city.name + name, note: '地道美食', price: '人均40-60元'
    })
  })

  // CityWalk
  places.push({
    id: id++, name: kw.landmark, category: 'walk',
    lat: offsetLat(), lng: offsetLng(),
    address: city.name + kw.landmark, note: 'CityWalk推荐路线', price: '免费'
  })

  // 购物中心
  kw.malls.split('、').slice(0, 2).forEach(mall => {
    places.push({
      id: id++, name: mall, category: 'mall',
      lat: offsetLat(), lng: offsetLng(),
      address: mall, note: '大型购物中心', price: '免费逛'
    })
  })

  // 地铁
  places.push({
    id: id++, name: `${kw.landmark}站`, category: 'metro',
    lat: center.lat, lng: center.lng,
    address: city.name + '市中心', note: '核心换乘站', price: '-'
  })

  return places
}

// 生成活动数据
function generateActivities(type, city) {
  const kw = city.keywords
  const items = []

  if (type === 'concert') {
    items.push(
      { name: `${city.name}周末音乐会`, time: '周六 19:30', venue: city.name + '体育馆', price: '180-680元', source: '大麦网' },
      { name: `开心麻花剧场${city.name}站`, time: '周日 19:30', venue: city.name + '大剧院', price: '120-480元', source: '大麦网' },
      { name: `Livehouse ${city.name}专场`, time: '周六 20:00', venue: 'MAO Livehouse', price: '100-150元', source: '秀动' }
    )
  } else if (type === 'market') {
    kw.foodArea.split('、').slice(0, 2).forEach(name => {
      items.push({
        name: name + '创意市集', time: '周六日 10:00-22:00',
        venue: name, price: '免费', source: '小红书'
      })
    })
  } else if (type === 'museum') {
    items.push(
      { name: `${city.name}博物馆 - 主题特展`, time: '周二至日 9:00-17:00', venue: '市中心', price: '免费(需预约)', source: '官网' },
      { name: `${city.name}美术馆`, time: '周二至日 9:00-17:00', venue: '市中心', price: '免费', source: '大众点评' }
    )
  } else if (type === 'scenic') {
    kw.scenic.split('、').forEach(name => {
      items.push({
        name: name, time: '全天开放', venue: name,
        price: '50-120元', source: '美团'
      })
    })
  } else if (type === 'sport') {
    items.push({
      name: `${city.name}主场赛事`, time: '周六 19:35',
      venue: city.name + '体育场', price: '80-380元', source: '大麦网'
    })
  }

  return items
}

// 获取周末日期字符串，offset: 0=本周末, 1=下周末
function getWeekendString(offset = 0) {
  const now = new Date()
  const day = now.getDay()
  const sat = new Date(now)
  sat.setDate(now.getDate() + (6 - day) + offset * 7)
  const sun = new Date(sat)
  sun.setDate(sat.getDate() + 1)
  const days = ['日', '一', '二', '三', '四', '五', '六']
  return `${sat.getMonth() + 1}月${sat.getDate()}日(周${days[sat.getDay()]})-${sun.getMonth() + 1}月${sun.getDate()}日(周${days[sun.getDay()]})`
}

// 获取城市列表
function getCities() {
  return CITIES
}

// 获取城市信息
function getCity(code) {
  return CITIES.find(c => c.code === code)
}

// 获取热门城市
function getHotCities() {
  return CITIES.filter(c => c.hot)
}

// 获取报告数据（支持自动生成），opts: { weekendOffset, preference }
function getReport(cityCode, opts = {}) {
  return generateReport(cityCode, opts)
}

// 获取地图标记点（支持自动生成）
function getPlaces(cityCode) {
  return generatePlaces(cityCode)
}

// 获取城市中心坐标
function getCityCenter(cityCode) {
  const city = getCity(cityCode)
  return city ? city.center : { lat: 23.1291, lng: 113.2644 }
}

module.exports = {
  CITIES,
  REPORTS,
  realCityData: REAL.REAL_REPORTS,
  getCities,
  getCity,
  getHotCities,
  getReport,
  getPlaces,
  getCityCenter,
  generateReport,
  generatePlaces
}
