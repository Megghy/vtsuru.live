import type { QAInfo, Setting_QuestionDisplay } from '@/api/api-models'
import {
  QuestionDisplayAlign,
  QuestionDisplayImageLayout,
  QuestionDisplayShadow,
  QuestionDisplayTransition,
  QuestionDisplayVerticalAlign,
} from '@/api/api-models'
import { createDefaultQuestionDisplaySetting } from './questionDisplayPresets'

export function questionSenderLabel(question?: Pick<QAInfo, 'isAnonymous' | 'anonymousName' | 'sender'> | null): string {
  if (!question) return '匿名用户'
  if (question.isAnonymous) return question.anonymousName || '匿名用户'
  return question.sender?.name || question.anonymousName || '匿名用户'
}

export function formatColor(value?: string | null): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`
}

export function formatColorWithOpacity(value?: string | null, opacity = 100): string {
  if (!value) return 'transparent'
  const cleanHex = value.replace('#', '').trim()
  const safeOpacity = Math.max(0, Math.min(100, Number.isFinite(opacity) ? opacity : 100))

  // 3 位 HEX (#RGB -> #RRGGBB)
  if (/^[\da-f]{3}$/i.test(cleanHex)) {
    const r = Number.parseInt(cleanHex[0] + cleanHex[0], 16)
    const g = Number.parseInt(cleanHex[1] + cleanHex[1], 16)
    const b = Number.parseInt(cleanHex[2] + cleanHex[2], 16)
    return `rgb(${r} ${g} ${b} / ${safeOpacity}%)`
  }

  // 6 位 HEX
  if (/^[\da-f]{6}$/i.test(cleanHex)) {
    const r = Number.parseInt(cleanHex.slice(0, 2), 16)
    const g = Number.parseInt(cleanHex.slice(2, 4), 16)
    const b = Number.parseInt(cleanHex.slice(4, 6), 16)
    return `rgb(${r} ${g} ${b} / ${safeOpacity}%)`
  }

  // 8 位 HEX (#RRGGBBAA)
  if (/^[\da-f]{8}$/i.test(cleanHex)) {
    const r = Number.parseInt(cleanHex.slice(0, 2), 16)
    const g = Number.parseInt(cleanHex.slice(2, 4), 16)
    const b = Number.parseInt(cleanHex.slice(4, 6), 16)
    const a = Number.parseInt(cleanHex.slice(6, 8), 16) / 255
    const finalOpacity = (a * safeOpacity).toFixed(1)
    return `rgb(${r} ${g} ${b} / ${finalOpacity}%)`
  }

  return 'transparent'
}

export function formatShadow(value?: QuestionDisplayShadow): string {
  if (value === QuestionDisplayShadow.Strong) return '0 16px 48px rgb(0 0 0 / 35%)'
  if (value === QuestionDisplayShadow.Soft) return '0 8px 24px rgb(0 0 0 / 18%)'
  return 'none'
}

export function formatTextShadow(value?: QuestionDisplayShadow): string {
  if (value === QuestionDisplayShadow.Strong) return '0 2px 8px rgb(0 0 0 / 55%), 0 0 1px rgb(0 0 0 / 45%)'
  if (value === QuestionDisplayShadow.Soft) return '0 1px 3px rgb(0 0 0 / 40%)'
  return 'none'
}

export function isLegacyQuestionDisplaySetting(setting?: Partial<Setting_QuestionDisplay> | null): boolean {
  if (!setting || typeof setting !== 'object') return true
  // 若缺少核心视觉属性或关键尺寸异常，视为未初始化或 legacy，需要全量 fallback 到棉花糖
  if (!setting.fontColor || !setting.backgroundColor) return true
  const fontSize = Number(setting.fontSize)
  const lineHeight = Number(setting.lineHeight)
  const imageMaxHeight = Number(setting.imageMaxHeight)
  if (!Number.isFinite(fontSize) || fontSize < 12) return true
  if (!Number.isFinite(lineHeight) || lineHeight < 1) return true
  if (!Number.isFinite(imageMaxHeight) || imageMaxHeight < 80) return true
  return false
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  if (value === undefined || value === null) return fallback
  const num = Number(value)
  if (!Number.isFinite(num)) return fallback
  return Math.max(min, Math.min(max, num))
}

export function normalizeQuestionDisplaySetting(
  setting?: Partial<Setting_QuestionDisplay> | null,
): Setting_QuestionDisplay {
  const fallback = createDefaultQuestionDisplaySetting() // 默认棉花糖预设
  if (isLegacyQuestionDisplaySetting(setting)) {
    return {
      ...fallback,
      syncScroll: setting?.syncScroll ?? fallback.syncScroll,
    }
  }

  const s = setting!
  return {
    ...fallback,
    ...s,
    font: s.font || fallback.font,
    nameFont: s.nameFont || fallback.nameFont,
    fontSize: clamp(s.fontSize, 12, 160, fallback.fontSize),
    fontWeight: clamp(s.fontWeight, 100, 900, fallback.fontWeight),
    nameFontSize: clamp(s.nameFontSize, 12, 120, fallback.nameFontSize),
    nameFontWeight: s.nameFontWeight ? clamp(s.nameFontWeight, 100, 900, 700) : fallback.nameFontWeight,
    lineHeight: clamp(s.lineHeight, 1, 3, fallback.lineHeight),
    letterSpacing: clamp(s.letterSpacing, -0.1, 1, fallback.letterSpacing),
    nameLetterSpacing: clamp(s.nameLetterSpacing, -0.1, 1, fallback.nameLetterSpacing),
    contentMaxWidth: clamp(s.contentMaxWidth, 0, 80, fallback.contentMaxWidth),
    fontColor: s.fontColor || fallback.fontColor,
    nameFontColor: s.nameFontColor || fallback.nameFontColor,
    backgroundColor: s.backgroundColor || fallback.backgroundColor,
    backgroundOpacity: clamp(s.backgroundOpacity, 0, 100, fallback.backgroundOpacity),
    borderColor: s.borderColor || fallback.borderColor,
    borderWidth: clamp(s.borderWidth, 0, 32, fallback.borderWidth ?? 0),
    borderRadius: clamp(s.borderRadius, 0, 64, fallback.borderRadius),
    contentPadding: clamp(s.contentPadding, 0, 96, fallback.contentPadding),
    imageMaxHeight: clamp(s.imageMaxHeight, 80, 1080, fallback.imageMaxHeight),
    showUserName: s.showUserName !== false,
    showBrand: s.showBrand !== false,
    showImage: s.showImage !== false,
    align: s.align in QuestionDisplayAlign ? s.align : fallback.align,
    verticalAlign: s.verticalAlign in QuestionDisplayVerticalAlign ? s.verticalAlign : fallback.verticalAlign,
    transition: s.transition in QuestionDisplayTransition ? s.transition : fallback.transition,
    imageLayout: s.imageLayout in QuestionDisplayImageLayout ? s.imageLayout : fallback.imageLayout,
    shadow: s.shadow in QuestionDisplayShadow ? s.shadow : fallback.shadow,
    textShadow: s.textShadow in QuestionDisplayShadow ? s.textShadow : fallback.textShadow,
    syncScroll: s.syncScroll !== false,
  }
}

/**
 * 在给定的问题列表中，按方向查找相邻问题。
 * 支持循环遍历；若当前选中的问题不在当前过滤列表中，会根据方向平滑过渡到最接近项（不会突跳至 0）。
 */
export function getAdjacentQuestion(
  questions: QAInfo[],
  currentId?: number,
  direction: -1 | 1 = 1,
): QAInfo | undefined {
  if (!questions.length) return undefined
  const currentIndex = currentId ? questions.findIndex((q) => q.id === currentId) : -1

  if (currentIndex === -1) {
    return direction > 0 ? questions[0] : questions.at(-1)
  }

  const targetIndex = (currentIndex + direction + questions.length) % questions.length
  return questions[targetIndex]
}

/**
 * 查找下一条未读问题（按列表循环查找排除当前项）
 */
export function getNextUnreadQuestion(questions: QAInfo[], currentId?: number): QAInfo | undefined {
  if (!questions.length) return undefined
  const currentIndex = currentId ? questions.findIndex((q) => q.id === currentId) : -1
  const start = currentIndex >= 0 ? currentIndex : -1

  const ordered = [...questions.slice(start + 1), ...questions.slice(0, Math.max(0, start + 1))]
  return ordered.find((item) => !item.isReaded && item.id !== currentId)
}
