import type { AnalyzeDayPoint, AnalyzeRangeSummary } from '@/apps/manage/composables/analyzeRange'

export interface ChartDayPoint extends AnalyzeDayPoint {
  date: string
}

export interface UnifiedSummary extends AnalyzeRangeSummary {
  titlePrefix: string
  incomeTrend?: number
  interactionTrend?: number
  danmakuTrend?: number
  offlineGuardCount?: number
}
