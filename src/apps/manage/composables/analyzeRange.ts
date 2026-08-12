export interface AnalyzeDayPoint {
  timestamp: number
  income: number
  interactionCount: number
  danmakuCount: number
  payingUsers: number
  interactionUsers: number
  liveMinutes: number
  likeCount: number
}

export interface AnalyzeRangeSummary {
  totalIncome: number
  totalInteractions: number
  totalDanmakuCount: number
  totalLiveMinutes: number
  activeLiveDays: number
  interactionUsers: number
  payingUsers: number
  dailyAvgIncome: number
  dailyAvgDanmaku: number
}

/** 按自定义时间戳区间过滤日级 chart 点（含端点） */
export function filterChartDataByRange(
  points: AnalyzeDayPoint[],
  startMs: number,
  endMs: number,
): AnalyzeDayPoint[] {
  const start = Math.min(startMs, endMs)
  const end = Math.max(startMs, endMs)
  return points.filter((p) => p.timestamp >= start && p.timestamp <= end)
}

/** 由日级 chart 点汇总自定义区间指标 */
export function computeRangeSummary(points: AnalyzeDayPoint[]): AnalyzeRangeSummary {
  const totalIncome = points.reduce((s, p) => s + (p.income || 0), 0)
  const totalInteractions = points.reduce((s, p) => s + (p.interactionCount || 0), 0)
  const totalDanmakuCount = points.reduce((s, p) => s + (p.danmakuCount || 0), 0)
  const totalLiveMinutes = points.reduce((s, p) => s + (p.liveMinutes || 0), 0)
  const interactionUsers = points.reduce((s, p) => s + (p.interactionUsers || 0), 0)
  const payingUsers = points.reduce((s, p) => s + (p.payingUsers || 0), 0)
  const activeLiveDays = points.filter((p) => (p.liveMinutes || 0) > 0).length
  return {
    totalIncome,
    totalInteractions,
    totalDanmakuCount,
    totalLiveMinutes,
    activeLiveDays,
    interactionUsers,
    payingUsers,
    dailyAvgIncome: activeLiveDays > 0 ? totalIncome / activeLiveDays : 0,
    dailyAvgDanmaku: activeLiveDays > 0 ? totalDanmakuCount / activeLiveDays : 0,
  }
}
