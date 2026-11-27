import type { ReponseVideoCollectVideo, VideoData, VideoStatus } from './generated/model'
import { vtsuruMutator } from './orval-mutator'

export interface BiliPartitionItem {
  id: number
  name: string
}

export interface BiliVideoZone {
  id: number
  name: string
  subs: BiliPartitionItem[]
}

export interface ResolvedVideoPreview {
  video: VideoData
  page: number
  pageCount: number
  eligible: boolean
  ruleError?: string | null
  alreadyExists: boolean
}

export interface BatchSetStatusResult {
  updated: number
  skipped: number
  failed: string[]
}

interface ApiEnvelope<T = undefined> {
  code: number
  message?: string
  data: T
}

const FALLBACK_BILI_ZONES: BiliVideoZone[] = [
  { id: 1001, name: '影视', subs: [{ id: 2001, name: '影视解读' }, { id: 2002, name: '影视剪辑' }, { id: 2003, name: '影视资讯' }, { id: 2004, name: '影视正片搬运' }, { id: 2005, name: '短剧短片' }, { id: 2006, name: 'AI影视' }, { id: 2007, name: '影视reaction' }, { id: 2008, name: '影视综合' }] },
  { id: 1002, name: '娱乐', subs: [{ id: 2009, name: '娱乐评论' }, { id: 2010, name: '明星剪辑' }, { id: 2011, name: '娱乐饭拍&现场' }, { id: 2012, name: '娱乐资讯' }, { id: 2013, name: '娱乐reaction' }, { id: 2014, name: '娱乐综艺正片' }, { id: 2015, name: '娱乐综合' }] },
  { id: 1003, name: '音乐', subs: [{ id: 2016, name: '原创音乐' }, { id: 2017, name: 'MV' }, { id: 2018, name: '音乐现场' }, { id: 2019, name: '乐迷饭拍' }, { id: 2020, name: '翻唱' }, { id: 2021, name: '演奏' }, { id: 2022, name: 'VOCALOID' }, { id: 2023, name: 'AI音乐' }, { id: 2024, name: '电台·歌单' }, { id: 2025, name: '音乐教学' }, { id: 2026, name: '乐评盘点' }, { id: 2027, name: '音乐综合' }] },
  { id: 1004, name: '舞蹈', subs: [{ id: 2028, name: '宅舞' }, { id: 2029, name: '街舞' }, { id: 2030, name: '颜值·网红舞' }, { id: 2031, name: '明星舞蹈' }, { id: 2032, name: '国风舞蹈' }, { id: 2033, name: '舞蹈教学' }, { id: 2034, name: '芭蕾舞' }, { id: 2035, name: 'wota艺' }, { id: 2036, name: '舞蹈综合' }] },
  { id: 1005, name: '动画', subs: [{ id: 2037, name: '同人动画' }, { id: 2038, name: '模玩周边' }, { id: 2039, name: 'cosplay' }, { id: 2040, name: '二次元线下' }, { id: 2041, name: '动漫剪辑' }, { id: 2042, name: '动漫评论' }, { id: 2043, name: '动漫速读' }, { id: 2044, name: '动漫配音' }, { id: 2045, name: '动漫资讯' }, { id: 2046, name: '网文解读' }, { id: 2047, name: '虚拟up主' }, { id: 2048, name: '特摄' }, { id: 2049, name: '布袋戏' }, { id: 2050, name: '漫画·动态漫' }, { id: 2051, name: '广播剧' }, { id: 2052, name: '动漫reaction' }, { id: 2053, name: '动漫教学' }, { id: 2054, name: '二次元其他' }] },
  { id: 1006, name: '绘画', subs: [{ id: 2055, name: '二次元绘画' }, { id: 2056, name: '非二次元绘画' }, { id: 2057, name: '绘画学习' }, { id: 2058, name: '绘画综合' }] },
  { id: 1007, name: '鬼畜', subs: [{ id: 2059, name: '鬼畜调教' }, { id: 2060, name: '鬼畜剧场' }, { id: 2061, name: '人力VOCALOID' }, { id: 2062, name: '音MAD' }, { id: 2063, name: '鬼畜综合' }] },
  { id: 1008, name: '游戏', subs: [{ id: 2064, name: '单人RPG游戏' }, { id: 2065, name: 'MMORPG游戏' }, { id: 2066, name: '单机主机类游戏' }, { id: 2067, name: 'SLG游戏' }, { id: 2068, name: '回合制策略游戏' }, { id: 2069, name: '即时策略游戏' }, { id: 2070, name: 'MOBA游戏' }, { id: 2071, name: '射击游戏' }, { id: 2072, name: '体育竞速游戏' }, { id: 2073, name: '动作竞技游戏' }, { id: 2074, name: '音游舞游' }, { id: 2075, name: '模拟经营游戏' }, { id: 2076, name: '女性向游戏' }, { id: 2077, name: '休闲/小游戏' }, { id: 2078, name: '沙盒类' }, { id: 2079, name: '其他游戏' }] },
  { id: 1009, name: '资讯', subs: [{ id: 2080, name: '时政资讯' }, { id: 2081, name: '海外资讯' }, { id: 2082, name: '社会资讯' }, { id: 2083, name: '综合资讯' }] },
  { id: 1010, name: '知识', subs: [{ id: 2084, name: '应试教育' }, { id: 2085, name: '非应试语言学习' }, { id: 2086, name: '大学专业知识' }, { id: 2087, name: '商业财经' }, { id: 2088, name: '社会观察' }, { id: 2089, name: '时政解读' }, { id: 2090, name: '人文历史' }, { id: 2091, name: '设计艺术' }, { id: 2092, name: '心理杂谈' }, { id: 2093, name: '职场发展' }, { id: 2094, name: '科学科普' }, { id: 2095, name: '其他知识杂谈' }] },
  { id: 1011, name: '人工智能', subs: [{ id: 2096, name: 'AI学习' }, { id: 2097, name: 'AI资讯' }, { id: 2098, name: 'AI杂谈' }] },
  { id: 1012, name: '科技数码', subs: [{ id: 2099, name: '电脑' }, { id: 2100, name: '手机' }, { id: 2101, name: '平板电脑' }, { id: 2102, name: '摄影摄像' }, { id: 2103, name: '工程机械' }, { id: 2104, name: '自制发明/设备' }, { id: 2105, name: '科技数码综合' }] },
  { id: 1013, name: '汽车', subs: [{ id: 2106, name: '汽车测评' }, { id: 2107, name: '汽车文化' }, { id: 2108, name: '汽车生活' }, { id: 2109, name: '汽车技术' }, { id: 2110, name: '汽车综合' }] },
  { id: 1014, name: '时尚美妆', subs: [{ id: 2111, name: '美妆' }, { id: 2112, name: '护肤' }, { id: 2113, name: '仿装cos' }, { id: 2114, name: '鞋服穿搭' }, { id: 2115, name: '箱包配饰' }, { id: 2116, name: '珠宝首饰' }, { id: 2117, name: '三坑' }, { id: 2118, name: '时尚解读' }, { id: 2119, name: '时尚综合' }] },
  { id: 1015, name: '家装房产', subs: [{ id: 2120, name: '买房租房' }, { id: 2121, name: '家庭装修' }, { id: 2122, name: '家居展示' }, { id: 2123, name: '家用电器' }] },
  { id: 1016, name: '户外潮流', subs: [{ id: 2124, name: '露营' }, { id: 2125, name: '徒步' }, { id: 2126, name: '户外探秘' }, { id: 2127, name: '户外综合' }] },
  { id: 1017, name: '健身', subs: [{ id: 2128, name: '健身科普' }, { id: 2129, name: '健身跟练教学' }, { id: 2130, name: '健身记录' }, { id: 2131, name: '健身身材展示' }, { id: 2132, name: '健身综合' }] },
  { id: 1018, name: '体育运动', subs: [{ id: 2133, name: '潮流运动' }, { id: 2134, name: '足球' }, { id: 2135, name: '篮球' }, { id: 2136, name: '跑步' }, { id: 2137, name: '武术' }, { id: 2138, name: '格斗' }, { id: 2139, name: '羽毛球' }, { id: 2140, name: '体育资讯' }, { id: 2141, name: '体育赛事' }, { id: 2142, name: '体育综合' }] },
  { id: 1019, name: '手工', subs: [{ id: 2143, name: '文具手帐' }, { id: 2144, name: '轻手作' }, { id: 2145, name: '传统手工艺' }, { id: 2146, name: '解压手工' }, { id: 2147, name: 'DIY玩具' }, { id: 2148, name: '其他手工' }] },
  { id: 1020, name: '美食', subs: [{ id: 2149, name: '美食制作' }, { id: 2150, name: '美食探店' }, { id: 2151, name: '美食测评' }, { id: 2152, name: '美食记录' }, { id: 2153, name: '美食综合' }] },
  { id: 1021, name: '小剧场', subs: [{ id: 2154, name: '剧情演绎' }, { id: 2155, name: '语言类小剧场' }, { id: 2156, name: 'UP主小综艺' }, { id: 2157, name: '街头采访' }] },
  { id: 1022, name: '旅游出行', subs: [{ id: 2158, name: '旅游记录' }, { id: 2159, name: '旅游攻略' }, { id: 2160, name: '城市出行' }, { id: 2161, name: '公共交通' }] },
  { id: 1023, name: '三农', subs: [{ id: 2162, name: '农村种植' }, { id: 2163, name: '赶海捕鱼' }, { id: 2164, name: '打野采摘' }, { id: 2165, name: '农业技术' }, { id: 2166, name: '农村生活' }] },
  { id: 1024, name: '动物', subs: [{ id: 2167, name: '猫' }, { id: 2168, name: '狗' }, { id: 2169, name: '小宠异宠' }, { id: 2170, name: '野生动物·动物解说科普' }, { id: 2171, name: '动物综合·二创' }] },
  { id: 1025, name: '亲子', subs: [{ id: 2172, name: '孕产护理' }, { id: 2173, name: '婴幼护理' }, { id: 2174, name: '儿童才艺' }, { id: 2175, name: '萌娃' }, { id: 2176, name: '亲子互动' }, { id: 2177, name: '亲子教育' }, { id: 2178, name: '亲子综合' }] },
  { id: 1026, name: '健康', subs: [{ id: 2179, name: '健康科普' }, { id: 2180, name: '养生' }, { id: 2181, name: '两性知识' }, { id: 2182, name: '心理健康' }, { id: 2183, name: '助眠视频·ASMR' }, { id: 2184, name: '医疗保健综合' }] },
  { id: 1027, name: '情感', subs: [{ id: 2185, name: '家庭关系' }, { id: 2186, name: '恋爱关系' }, { id: 2187, name: '人际关系' }, { id: 2188, name: '自我成长' }] },
  { id: 1028, name: '神秘学', subs: [{ id: 2189, name: '塔罗占卜' }, { id: 2190, name: '星座占星' }, { id: 2191, name: '传统玄学' }, { id: 2192, name: '疗愈成长' }, { id: 2193, name: '其他神秘学' }] },
  { id: 1029, name: 'vlog', subs: [{ id: 2194, name: '中外生活vlog' }, { id: 2195, name: '学生vlog' }, { id: 2196, name: '职业vlog' }, { id: 2197, name: '其他vlog' }] },
  { id: 1030, name: '生活兴趣', subs: [{ id: 2198, name: '休闲玩乐' }, { id: 2199, name: '线下演出' }, { id: 2200, name: '文玩文创' }, { id: 2201, name: '潮玩玩具' }, { id: 2202, name: '兴趣综合' }] },
  { id: 1031, name: '生活经验', subs: [{ id: 2203, name: '生活技能' }, { id: 2204, name: '办事流程' }, { id: 2205, name: '婚嫁' }] },
]

let cachedZones: BiliVideoZone[] | null = null

export async function fetchVideoCollectPartitions(): Promise<BiliVideoZone[]> {
  if (cachedZones) return cachedZones
  try {
    const res = await vtsuruMutator<ApiEnvelope<BiliVideoZone[]>>('/api/video-collect/partitions', {
      method: 'GET',
    })
    if (res.code === 200 && Array.isArray(res.data) && res.data.length > 0) {
      cachedZones = res.data
      return cachedZones
    }
  } catch {
    // 后端尚未更新接口时回退内置新版 v2 分区表
  }
  cachedZones = FALLBACK_BILI_ZONES
  return cachedZones
}

export async function resolveVideoCollectVideo(
  video: string,
  tableId?: string,
  signal?: AbortSignal,
): Promise<ResolvedVideoPreview> {
  const res = await vtsuruMutator<ApiEnvelope<ResolvedVideoPreview>>('/api/video-collect/resolve-video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ video, tableId }),
    signal,
  })
  if (res.code !== 200 || !res.data) {
    throw new Error(res.message || '解析视频信息失败')
  }
  return res.data
}

export async function batchSetVideoCollectStatus(payload: {
  id: string
  bvids: string[]
  status: VideoStatus
  rejectReason?: string
}): Promise<BatchSetStatusResult> {
  const res = await vtsuruMutator<ApiEnvelope<BatchSetStatusResult>>('/api/video-collect/batch-set-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (res.code !== 200 || !res.data) {
    throw new Error(res.message || '批量更新审核状态失败')
  }
  return res.data
}

export async function setVideoCollectWatched(payload: {
  id: string
  bvids: string[]
  watched: boolean
}): Promise<void> {
  const res = await vtsuruMutator<ApiEnvelope>('/api/video-collect/set-watched', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (res.code !== 200) {
    throw new Error(res.message || '同步观看状态失败')
  }
}

export async function removeVideoCollectVideo(id: string, bvid: string): Promise<void> {
  const params = new URLSearchParams({ id, bvid })
  const res = await vtsuruMutator<ApiEnvelope>(`/api/video-collect/remove-video?${params.toString()}`, {
    method: 'POST',
  })
  if (res.code !== 200) {
    throw new Error(res.message || '删除投稿记录失败')
  }
}

export async function removeVideoCollectSender(payload: {
  id: string
  bvid: string
  senderIndex: number
}): Promise<void> {
  const res = await vtsuruMutator<ApiEnvelope>('/api/video-collect/remove-sender', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (res.code !== 200) {
    throw new Error(res.message || '移除推荐记录失败')
  }
}

export async function fetchMyVideoCollectSubmissions(
  id: string,
  headers: Record<string, string>,
): Promise<ReponseVideoCollectVideo[]> {
  const params = new URLSearchParams({ id })
  const res = await vtsuruMutator<ApiEnvelope<ReponseVideoCollectVideo[]>>(
    `/api/video-collect/my-submissions?${params.toString()}`,
    {
      method: 'GET',
      headers,
    },
  )
  if (res.code !== 200) {
    throw new Error(res.message || '获取我的投稿失败')
  }
  return Array.isArray(res.data) ? res.data : []
}

export async function withdrawMyVideoCollectSubmission(
  id: string,
  bvid: string,
  headers: Record<string, string>,
): Promise<void> {
  const params = new URLSearchParams({ id, bvid })
  const res = await vtsuruMutator<ApiEnvelope>(`/api/video-collect/withdraw?${params.toString()}`, {
    method: 'POST',
    headers,
  })
  if (res.code !== 200) {
    throw new Error(res.message || '撤回投稿失败')
  }
}
