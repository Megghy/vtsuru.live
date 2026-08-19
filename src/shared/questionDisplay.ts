import type { QAInfo, Setting_QuestionDisplay } from '@/api/api-models'

import { createDefaultQuestionDisplaySetting } from './questionDisplayPresets'

export function questionSenderLabel(question: Pick<QAInfo, 'isAnonymous' | 'anonymousName' | 'sender'>) {
  if (question.isAnonymous) return question.anonymousName || '匿名用户'
  return question.sender?.name || question.anonymousName || '匿名用户'
}

export function isLegacyQuestionDisplaySetting(setting?: Partial<Setting_QuestionDisplay> | null) {
  if (!setting) return true
  const lineHeight = Number(setting.lineHeight)
  const imageMaxHeight = Number(setting.imageMaxHeight)
  return !Number.isFinite(lineHeight) || lineHeight < 1 || !Number.isFinite(imageMaxHeight) || imageMaxHeight < 80
}

export function normalizeQuestionDisplaySetting(
  setting?: Partial<Setting_QuestionDisplay> | null,
): Setting_QuestionDisplay {
  const fallback = createDefaultQuestionDisplaySetting()
  if (isLegacyQuestionDisplaySetting(setting)) {
    return { ...fallback, syncScroll: setting?.syncScroll ?? fallback.syncScroll }
  }
  return { ...fallback, ...setting }
}
