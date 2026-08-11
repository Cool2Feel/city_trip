// utils/categories.js - 11个调查方向配置

const CATEGORIES = [
  {
    id: 'concert',
    name: '演唱会',
    fullName: '演唱会/音乐会',
    letter: 'C',
    color: '#d32f2f',
    colorVar: '--cat-concert',
    icon: '\uD83C\uDFA4',
    bg: 'rgba(211,47,47,0.1)',
    timeSensitivity: 'strong',
    timeLabel: '强时效',
    desc: '演唱会、音乐节、Livehouse排期',
    value: '演出排期是周末出行的核心决策因素',
    queryKey: '演唱会 音乐会 排期'
  },
  {
    id: 'sport',
    name: '球赛',
    fullName: '体育赛事',
    letter: 'S',
    color: '#7b1fa2',
    colorVar: '--cat-sport',
    icon: '\u26BD',
    bg: 'rgba(123,31,162,0.1)',
    timeSensitivity: 'strong',
    timeLabel: '强时效',
    desc: '中超/CBA主场、马拉松等赛事',
    value: '主场比赛安排直接影响周末行程',
    queryKey: '中超 CBA 马拉松 赛程'
  },
  {
    id: 'market',
    name: '集市',
    fullName: '集市/夜市',
    letter: 'M',
    color: '#f9a825',
    colorVar: '--cat-market',
    icon: '\uD83C\uDFA0',
    bg: 'rgba(249,168,37,0.1)',
    timeSensitivity: 'medium',
    timeLabel: '中时效',
    desc: '创意市集、文创夜市、主题快闪',
    value: '创意市集是年轻人的新兴目的地',
    queryKey: '市集 创意 夜市 周末'
  },
  {
    id: 'museum',
    name: '博物馆',
    fullName: '博物馆/美术馆',
    letter: 'U',
    color: '#1565c0',
    colorVar: '--cat-museum',
    icon: '\uD83C\uDFDB',
    bg: 'rgba(21,101,192,0.1)',
    timeSensitivity: 'weak',
    timeLabel: '弱时效',
    desc: '博物馆、美术馆、特色展览',
    value: '长期资源 + 当前展览信息',
    queryKey: '博物馆 美术馆 展览 免费'
  },
  {
    id: 'scenic',
    name: '5A景区',
    fullName: '5A/4A景区',
    letter: '5',
    color: '#e65100',
    colorVar: '--cat-scenic',
    icon: '\uD83C\uDFD5',
    bg: 'rgba(230,81,0,0.1)',
    timeSensitivity: 'weak',
    timeLabel: '弱时效',
    desc: '城市核心景区清单与门票',
    value: '城市必去核心景区',
    queryKey: '5A景区 4A景区 门票'
  },
  {
    id: 'tea',
    name: '喜茶门店',
    fullName: '喜茶旗舰+购物中心',
    letter: 'H',
    color: '#ec407a',
    colorVar: '--cat-tea',
    icon: '\uD83C\uDF75',
    bg: 'rgba(236,64,122,0.1)',
    timeSensitivity: 'weak',
    timeLabel: '弱时效',
    desc: '喜茶旗舰店、主题门店、商场指引',
    value: '品牌文化打卡 + 商场指引',
    queryKey: '喜茶 旗舰店 购物中心'
  },
  {
    id: 'food',
    name: '美食街',
    fullName: '美食街/老字号',
    letter: 'F',
    color: '#ad1457',
    colorVar: '--cat-food',
    icon: '\uD83C\uDF5C',
    bg: 'rgba(173,20,87,0.1)',
    timeSensitivity: 'weak',
    timeLabel: '弱时效',
    desc: '本地人真正会去的美食街',
    value: '地道美食聚集地推荐',
    queryKey: '美食街 老字号 夜宵'
  },
  {
    id: 'walk',
    name: 'City Walk',
    fullName: 'City Walk路线',
    letter: 'W',
    color: '#00838f',
    colorVar: '--cat-walk',
    icon: '\uD83D\uDEB6',
    bg: 'rgba(0,131,143,0.1)',
    timeSensitivity: 'weak',
    timeLabel: '弱时效',
    desc: '经典步行路线与拍照点',
    value: '城市漫步探索路线',
    queryKey: 'city walk 步行路线 拍照'
  },
  {
    id: 'ticket',
    name: '优惠门票',
    fullName: '优惠门票/特惠',
    letter: 'T',
    color: '#2e7d32',
    colorVar: '--cat-ticket',
    icon: '\uD83C\uDF9F',
    bg: 'rgba(46,125,50,0.1)',
    timeSensitivity: 'medium',
    timeLabel: '中时效',
    desc: '暑期特惠、考生免费等省钱信息',
    value: '省钱攻略与限时优惠',
    queryKey: '优惠 特惠 免费 门票'
  },
  {
    id: 'mall',
    name: '购物中心',
    fullName: '商场/购物中心',
    letter: 'L',
    color: '#4527a0',
    colorVar: '--cat-mall',
    icon: '\uD83D\uDED2',
    bg: 'rgba(69,39,160,0.1)',
    timeSensitivity: 'weak',
    timeLabel: '弱时效',
    desc: '大型购物中心、百货商场',
    value: '购物休闲一站式目的地',
    queryKey: '购物中心 商场 百货'
  },
  {
    id: 'metro',
    name: '地铁路线',
    fullName: '地铁线网+站点',
    letter: 'D',
    color: '#546e7a',
    colorVar: '--cat-metro',
    icon: '\uD83D\uDE87',
    bg: 'rgba(84,110,122,0.1)',
    timeSensitivity: 'weak',
    timeLabel: '弱时效',
    desc: '线网总览 + 关键站点出口',
    value: '出行交通参考',
    queryKey: '地铁线路 出口 换乘'
  }
]

// 获取分类配置
function getCategory(id) {
  return CATEGORIES.find(c => c.id === id)
}

// 获取分类颜色
function getCategoryColor(id) {
  const cat = getCategory(id)
  return cat ? cat.color : '#999'
}

module.exports = {
  CATEGORIES,
  getCategory,
  getCategoryColor
}
