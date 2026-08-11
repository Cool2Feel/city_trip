// server/data.js - Data store for the API server
// Exports city data, reports, and places for all cities

const cities = [
  { code: 'guangzhou', name: '广州', province: '广东', pinyin: 'Guangzhou', hot: true, desc: '花城羊城，食在广东', center: { lat: 23.1291, lng: 113.2644 }, keywords: { malls: '天河城、正佳广场、太古汇、万菱汇', foodArea: '北京路、上下九、体育西', landmark: '广州塔', scenic: '白云山、陈家祠、沙面' } },
  { code: 'shenzhen', name: '深圳', province: '广东', pinyin: 'Shenzhen', hot: true, desc: '科技之都，滨海之城', center: { lat: 22.5431, lng: 114.0579 }, keywords: { malls: '万象天地、海岸城、壹方城', foodArea: '东门、蛇口、华强北', landmark: '平安金融中心', scenic: '世界之窗、大梅沙、梧桐山' } },
  { code: 'chengdu', name: '成都', province: '四川', pinyin: 'Chengdu', hot: true, desc: '天府之国，闲适之城', center: { lat: 30.5728, lng: 104.0668 }, keywords: { malls: '太古里、IFS、万象城', foodArea: '锦里、宽窄巷子、建设路', landmark: '天府广场', scenic: '武侯祠、杜甫草堂、大熊猫基地' } },
  { code: 'shanghai', name: '上海', province: '上海', pinyin: 'Shanghai', hot: true, desc: '魔都风情，海派文化', center: { lat: 31.2304, lng: 121.4737 }, keywords: { malls: '南京路、淮海路、静安嘉里中心', foodArea: '城隍庙、田子坊、云南南路', landmark: '东方明珠', scenic: '外滩、豫园、迪士尼' } },
  { code: 'beijing', name: '北京', province: '北京', pinyin: 'Beijing', hot: true, desc: '帝都风华，千年古都', center: { lat: 39.9042, lng: 116.4074 }, keywords: { malls: '三里屯太古里、国贸商城、西单大悦城', foodArea: '簋街、牛街、南锣鼓巷', landmark: '天安门', scenic: '故宫、长城、颐和园' } },
  { code: 'hangzhou', name: '杭州', province: '浙江', pinyin: 'Hangzhou', hot: false, desc: '人间天堂，西湖印象', center: { lat: 30.2741, lng: 120.1551 }, keywords: { malls: '万象城、湖滨银泰、嘉里中心', foodArea: '河坊街、胜利河、中山北路', landmark: '西湖', scenic: '西湖、灵隐寺、千岛湖' } },
  { code: 'chongqing', name: '重庆', province: '重庆', pinyin: 'Chongqing', hot: false, desc: '山城雾都，8D魔幻', center: { lat: 29.5630, lng: 106.5516 }, keywords: { malls: '解放碑、观音桥、时代天街', foodArea: '磁器口、洪崖洞、八一路', landmark: '洪崖洞', scenic: '洪崖洞、磁器口、长江索道' } },
  { code: 'xiamen', name: '厦门', province: '福建', pinyin: 'Xiamen', hot: false, desc: '海上花园，文艺之城', center: { lat: 24.4798, lng: 118.0894 }, keywords: { malls: 'SM城市广场、万象城、中华城', foodArea: '中山路、曾厝垵、八市', landmark: '鼓浪屿', scenic: '鼓浪屿、南普陀、环岛路' } },
  { code: 'nanjing', name: '南京', province: '江苏', pinyin: 'Nanjing', hot: false, desc: '六朝古都，金陵风韵', center: { lat: 32.0603, lng: 118.7969 }, keywords: { malls: '德基广场、中央商场、金鹰世界', foodArea: '夫子庙、老门东、狮子桥', landmark: '紫金山', scenic: '中山陵、夫子庙、玄武湖' } },
  { code: 'wuhan', name: '武汉', province: '湖北', pinyin: 'Wuhan', hot: false, desc: '江城武汉，九省通衢', center: { lat: 30.5928, lng: 114.3055 }, keywords: { malls: '楚河汉街、群星城、武商MALL', foodArea: '户部巷、吉庆街、粮道街', landmark: '黄鹤楼', scenic: '黄鹤楼、东湖、武汉大学' } },
  { code: 'xian', name: '西安', province: '陕西', pinyin: 'Xian', hot: true, desc: '千年古都，丝路起点', center: { lat: 34.3416, lng: 108.9398 }, keywords: { malls: '赛格国际、大悦城、SKP', foodArea: '回民街、永兴坊、洒金桥', landmark: '钟楼', scenic: '兵马俑、大雁塔、城墙' } },
  { code: 'changsha', name: '长沙', province: '湖南', pinyin: 'Changsha', hot: true, desc: '星城长沙，网红美食', center: { lat: 28.2282, lng: 112.9388 }, keywords: { malls: 'IFS国金中心、万象汇、海信广场', foodArea: '坡子街、太平街、文和友', landmark: '橘子洲', scenic: '橘子洲、岳麓山、湖南博物馆' } },
  { code: 'suzhou', name: '苏州', province: '江苏', pinyin: 'Suzhou', hot: false, desc: '东方威尼斯，园林之城', center: { lat: 31.2989, lng: 120.5853 }, keywords: { malls: '苏州中心、久光百货、龙湖狮山', foodArea: '观前街、平江路、山塘街', landmark: '拙政园', scenic: '拙政园、虎丘、周庄古镇' } },
  { code: 'qingdao', name: '青岛', province: '山东', pinyin: 'Qingdao', hot: false, desc: '红瓦绿树，碧海蓝天', center: { lat: 36.0671, lng: 120.3826 }, keywords: { malls: '万象城、海信广场、利群', foodArea: '劈柴院、台东、啤酒街', landmark: '栈桥', scenic: '栈桥、八大关、崂山' } },
  { code: 'kunming', name: '昆明', province: '云南', pinyin: 'Kunming', hot: false, desc: '春城昆明，四季如春', center: { lat: 25.0389, lng: 102.7183 }, keywords: { malls: '恒隆广场、同德昆明广场、百大', foodArea: '南屏街、关上、篆新市场', landmark: '滇池', scenic: '滇池、石林、翠湖' } },
  { code: 'dalian', name: '大连', province: '辽宁', pinyin: 'Dalian', hot: false, desc: '北方明珠，浪漫海滨', center: { lat: 38.9140, lng: 121.6147 }, keywords: { malls: '恒隆广场、柏威年、百年城', foodArea: '中山广场、西安路、友好广场', landmark: '星海广场', scenic: '星海广场、老虎滩、金石滩' } },
  { code: 'tianjin', name: '天津', province: '天津', pinyin: 'Tianjin', hot: false, desc: '津门故里，曲艺之乡', center: { lat: 39.0842, lng: 117.2009 }, keywords: { malls: '大悦城、恒隆广场、天河城', foodArea: '古文化街、南市食品街、意式风情街', landmark: '天津之眼', scenic: '古文化街、五大道、盘山' } },
  { code: 'zhengzhou', name: '郑州', province: '河南', pinyin: 'Zhengzhou', hot: false, desc: '中原枢纽，黄帝故里', center: { lat: 34.7466, lng: 113.6254 }, keywords: { malls: '丹尼斯大卫城、正弘城、万象城', foodArea: '二七广场、健康路、农科路', landmark: '二七纪念塔', scenic: '少林寺、嵩山、黄河风景区' } },
  { code: 'guilin', name: '桂林', province: '广西', pinyin: 'Guilin', hot: false, desc: '山水甲天下', center: { lat: 25.2734, lng: 110.2907 }, keywords: { malls: '微笑堂、万象城、桂林百货', foodArea: '东西巷、正阳步行街、尚水街', landmark: '象鼻山', scenic: '漓江、阳朔、龙脊梯田' } }
]

module.exports = { cities }
