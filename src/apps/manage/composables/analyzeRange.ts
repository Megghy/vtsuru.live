export interface AnalyzeDayPoint {
  timestamp: number
  income: number
  giftIncome?: number
  scIncome?: number
  guardIncome?: number
  totalIncomeWithGuard?: number
  interactionCount: number
  danmakuCount: number
  payingUsers: number
  interactionUsers: number
  liveMinutes: number
  likeCount: number
  sessionCount?: number
}

export interface AnalyzeSessionItem {
  id: string
  title: string
  area: string
  parentArea: string
  coverUrl: string
  startTime: number
  endTime?: number | null
  liveMinutes: number
  totalIncome: number
  giftIncome: number
  scIncome: number
  guardIncome: number
  totalIncomeWithGuard: number
  danmakuCount: number
  interactionCount: number
  uniqueInteractionCount: number
  uniquePayingCount: number
  likeCount: number
}

export interface AnalyzeAreaStat {
  parentArea: string
  area: string
  sessionCount: number
  totalLiveMinutes: number
  totalIncome: number
  totalDanmakuCount: number
  totalInteractions: number
  avgIncome: number
  avgDanmaku: number
  avgMinutes: number
}

export interface AnalyzeTopUser {
  name: string
  totalPaid?: number
  payCount?: number
  danmakuCount?: number
  lastTime: number
}

export interface AnalyzeRangeSummary {
  totalIncome: number
  giftIncome: number
  scIncome: number
  guardIncome: number
  totalIncomeWithGuard: number
  totalInteractions: number
  totalDanmakuCount: number
  totalLikeCount: number
  totalLiveMinutes: number
  activeLiveDays: number
  totalSessions: number
  interactionUsers: number
  payingUsers: number
  dailyAvgIncome: number
  dailyAvgDanmaku: number
  dailyAvgInteractions: number
  payingRate: number
  avgDanmakuPerUser: number
  hourlyIncome: number
  avgLiveMinutesPerSession: number
  avgIncomePerPayingUser: number
}

export interface AnalyzeDayOfWeekStat {
  dayOfWeek: number // 0 (周日) ~ 6 (周六)
  dayName: string
  liveDaysCount: number
  totalIncome: number
  totalDanmaku: number
  totalMinutes: number
  avgIncome: number
  avgDanmaku: number
  avgMinutes: number
}

export interface AnalyzeMilestoneEntry {
  dateStr: string
  timestamp: number
  value: number
}

export interface AnalyzeMilestones {
  maxIncomeDay: AnalyzeMilestoneEntry | null
  maxDanmakuDay: AnalyzeMilestoneEntry | null
  maxDurationDay: AnalyzeMilestoneEntry | null
  maxInteractionDay: AnalyzeMilestoneEntry | null
  maxPayingRateDay: AnalyzeMilestoneEntry | null
}

const DAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

/** 按自定义时间戳区间过滤日级 chart 点（含端点） */
export function filterChartDataByRange(points: AnalyzeDayPoint[], startMs: number, endMs: number): AnalyzeDayPoint[] {
  const start = Math.min(startMs, endMs)
  const end = Math.max(startMs, endMs)
  return points.filter((p) => {
    const ts = p.timestamp < 10_000_000_000 && p.timestamp > 100_000_000 ? p.timestamp * 1_000 : p.timestamp
    return ts >= start && ts <= end
  })
}

/** 按时间戳区间过滤单场直播列表 */
export function filterSessionsByRange(
  sessions: AnalyzeSessionItem[],
  startMs: number,
  endMs: number,
): AnalyzeSessionItem[] {
  const start = Math.min(startMs, endMs)
  const end = Math.max(startMs, endMs)
  return sessions.filter((s) => {
    const sessionTime = s.startTime < 10_000_000_000 && s.startTime > 100_000_000 ? s.startTime * 1_000 : s.startTime
    return sessionTime >= start && sessionTime <= end
  })
}

/** 由日级 chart 点汇总区间指标 */
export function computeRangeSummary(points: AnalyzeDayPoint[]): AnalyzeRangeSummary {
  const totalIncome = points.reduce((s, p) => s + (p.income || 0), 0)
  const giftIncome = points.reduce((s, p) => s + (p.giftIncome ?? p.income ?? 0), 0)
  const scIncome = points.reduce((s, p) => s + (p.scIncome ?? 0), 0)
  const guardIncome = points.reduce((s, p) => s + (p.guardIncome ?? 0), 0)
  const totalIncomeWithGuard = points.reduce(
    (s, p) => s + (p.totalIncomeWithGuard ?? (p.income || 0) + (p.guardIncome || 0)),
    0,
  )
  const totalInteractions = points.reduce((s, p) => s + (p.interactionCount || 0), 0)
  const totalDanmakuCount = points.reduce((s, p) => s + (p.danmakuCount || 0), 0)
  const totalLikeCount = points.reduce((s, p) => s + (p.likeCount || 0), 0)
  const totalLiveMinutes = points.reduce((s, p) => s + (p.liveMinutes || 0), 0)
  const interactionUsers = points.reduce((s, p) => s + (p.interactionUsers || 0), 0)
  const payingUsers = points.reduce((s, p) => s + (p.payingUsers || 0), 0)
  const activeLiveDays = points.filter((p) => (p.liveMinutes || 0) > 0).length
  const totalSessions = points.reduce((s, p) => s + (p.sessionCount || ((p.liveMinutes || 0) > 0 ? 1 : 0)), 0)

  const safeActiveDays = activeLiveDays > 0 ? activeLiveDays : points.length > 0 ? points.length : 1
  const liveHours = totalLiveMinutes / 60
  const safeSessionCount = totalSessions > 0 ? totalSessions : safeActiveDays

  return {
    totalIncome,
    giftIncome,
    scIncome,
    guardIncome,
    totalIncomeWithGuard,
    totalInteractions,
    totalDanmakuCount,
    totalLikeCount,
    totalLiveMinutes,
    activeLiveDays,
    totalSessions,
    interactionUsers,
    payingUsers,
    dailyAvgIncome: totalIncome / safeActiveDays,
    dailyAvgDanmaku: totalDanmakuCount / safeActiveDays,
    dailyAvgInteractions: totalInteractions / safeActiveDays,
    payingRate: interactionUsers > 0 ? (payingUsers / interactionUsers) * 100 : 0,
    avgDanmakuPerUser: interactionUsers > 0 ? totalDanmakuCount / interactionUsers : 0,
    hourlyIncome: liveHours > 0 ? totalIncome / liveHours : 0,
    avgLiveMinutesPerSession: totalLiveMinutes / safeSessionCount,
    avgIncomePerPayingUser: payingUsers > 0 ? totalIncome / payingUsers : 0,
  }
}

/** 计算周一至周日的直播开播分布与平均指标 */
export function computeDayOfWeekStats(points: AnalyzeDayPoint[]): AnalyzeDayOfWeekStat[] {
  // 0: 周日, 1: 周一, ... 6: 周六
  const buckets: {
    liveDays: number
    totalIncome: number
    totalDanmaku: number
    totalMinutes: number
  }[] = Array.from({ length: 7 }, () => ({
    liveDays: 0,
    totalIncome: 0,
    totalDanmaku: 0,
    totalMinutes: 0,
  }))

  for (const p of points) {
    if (!p.timestamp) continue
    const date = new Date(p.timestamp)
    const day = date.getDay()
    const isLive = (p.liveMinutes || 0) > 0 || (p.income || 0) > 0 || (p.danmakuCount || 0) > 0

    if (isLive) {
      buckets[day].liveDays += 1
    }
    buckets[day].totalIncome += p.income || 0
    buckets[day].totalDanmaku += p.danmakuCount || 0
    buckets[day].totalMinutes += p.liveMinutes || 0
  }

  // 调整顺序为周一至周日 (1, 2, 3, 4, 5, 6, 0)
  const orderedDays = [1, 2, 3, 4, 5, 6, 0]

  return orderedDays.map((d) => {
    const b = buckets[d]
    const active = b.liveDays > 0 ? b.liveDays : 1
    return {
      dayOfWeek: d,
      dayName: DAY_NAMES[d],
      liveDaysCount: b.liveDays,
      totalIncome: b.totalIncome,
      totalDanmaku: b.totalDanmaku,
      totalMinutes: b.totalMinutes,
      avgIncome: b.liveDays > 0 ? b.totalIncome / active : 0,
      avgDanmaku: b.liveDays > 0 ? b.totalDanmaku / active : 0,
      avgMinutes: b.liveDays > 0 ? b.totalMinutes / active : 0,
    }
  })
}

/** 计算区间内的里程碑峰值（单日最高收入、最高弹幕、最长开播等） */
export function computeMilestones(points: AnalyzeDayPoint[]): AnalyzeMilestones {
  let maxIncome: AnalyzeMilestoneEntry | null = null
  let maxDanmaku: AnalyzeMilestoneEntry | null = null
  let maxDuration: AnalyzeMilestoneEntry | null = null
  let maxInteraction: AnalyzeMilestoneEntry | null = null
  let maxPayingRate: AnalyzeMilestoneEntry | null = null

  for (const p of points) {
    const d = new Date(p.timestamp)
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

    if ((p.income || 0) > 0 && (!maxIncome || p.income > maxIncome.value)) {
      maxIncome = { dateStr, timestamp: p.timestamp, value: p.income }
    }

    if ((p.danmakuCount || 0) > 0 && (!maxDanmaku || p.danmakuCount > maxDanmaku.value)) {
      maxDanmaku = { dateStr, timestamp: p.timestamp, value: p.danmakuCount }
    }

    if ((p.liveMinutes || 0) > 0 && (!maxDuration || p.liveMinutes > maxDuration.value)) {
      maxDuration = { dateStr, timestamp: p.timestamp, value: p.liveMinutes }
    }

    if ((p.interactionUsers || 0) > 0 && (!maxInteraction || p.interactionUsers > maxInteraction.value)) {
      maxInteraction = { dateStr, timestamp: p.timestamp, value: p.interactionUsers }
    }

    if ((p.interactionUsers || 0) >= 3 && (p.payingUsers || 0) > 0) {
      const rate = (p.payingUsers / p.interactionUsers) * 100
      if (!maxPayingRate || rate > maxPayingRate.value) {
        maxPayingRate = { dateStr, timestamp: p.timestamp, value: rate }
      }
    }
  }

  return {
    maxIncomeDay: maxIncome,
    maxDanmakuDay: maxDanmaku,
    maxDurationDay: maxDuration,
    maxInteractionDay: maxInteraction,
    maxPayingRateDay: maxPayingRate,
  }
}

/** 从场次列表动态聚合分区表现 */
export function computeAreaStatsFromSessions(sessions: AnalyzeSessionItem[]): AnalyzeAreaStat[] {
  const map = new Map<
    string,
    {
      parentArea: string
      area: string
      sessionCount: number
      totalLiveMinutes: number
      totalIncome: number
      totalDanmakuCount: number
      totalInteractions: number
    }
  >()

  for (const s of sessions) {
    const parentArea = s.parentArea || '其他'
    const area = s.area || '默认'
    const key = `${parentArea}::${area}`

    const existing = map.get(key) || {
      parentArea,
      area,
      sessionCount: 0,
      totalLiveMinutes: 0,
      totalIncome: 0,
      totalDanmakuCount: 0,
      totalInteractions: 0,
    }

    existing.sessionCount += 1
    existing.totalLiveMinutes += s.liveMinutes || 0
    existing.totalIncome += s.totalIncome || 0
    existing.totalDanmakuCount += s.danmakuCount || 0
    existing.totalInteractions += s.interactionCount || 0
    map.set(key, existing)
  }

  return Array.from(map.values())
    .map((item) => ({
      ...item,
      avgIncome: item.sessionCount > 0 ? item.totalIncome / item.sessionCount : 0,
      avgDanmaku: item.sessionCount > 0 ? item.totalDanmakuCount / item.sessionCount : 0,
      avgMinutes: item.sessionCount > 0 ? item.totalLiveMinutes / item.sessionCount : 0,
    }))
    .toSorted((a, b) => b.totalIncome - a.totalIncome)
}
