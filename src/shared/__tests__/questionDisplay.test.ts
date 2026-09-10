import { describe, expect, it } from 'vitest'

import type { Setting_QuestionDisplay } from '@/api/api-models'
import {
  QuestionDisplayAlign,
  QuestionDisplayImageLayout,
  QuestionDisplayShadow,
  QuestionDisplayTransition,
  QuestionDisplayVerticalAlign,
} from '@/api/api-models'
import {
  formatColor,
  formatColorWithOpacity,
  formatShadow,
  formatTextShadow,
  getAdjacentQuestion,
  getNextUnreadQuestion,
  normalizeQuestionDisplaySetting,
  questionSenderLabel,
} from '@/shared/questionDisplay'
import { createDefaultQuestionDisplaySetting, QUESTION_DISPLAY_PRESETS } from '@/shared/questionDisplayPresets'
import { createMockQuestion } from '@/test/testUtils'

describe('questionDisplay utils', () => {
  describe('questionSenderLabel', () => {
    it('处理普通实名用户', () => {
      const q = createMockQuestion({ isAnonymous: false, sender: { id: 1, name: '张三', isBiliAuthed: false } })
      expect(questionSenderLabel(q)).toBe('张三')
    })

    it('处理匿名用户（有自定义匿名昵称）', () => {
      const q = createMockQuestion({ isAnonymous: true, anonymousName: '神秘小猫' })
      expect(questionSenderLabel(q)).toBe('神秘小猫')
    })

    it('处理匿名用户（无自定义匿名昵称）', () => {
      const q = createMockQuestion({ isAnonymous: true, anonymousName: '' })
      expect(questionSenderLabel(q)).toBe('匿名用户')
    })

    it('处理空或未定义对象', () => {
      expect(questionSenderLabel(undefined)).toBe('匿名用户')
      expect(questionSenderLabel(null)).toBe('匿名用户')
    })
  })

  describe('formatColor & formatColorWithOpacity', () => {
    it('正确解析 6 位 hex', () => {
      expect(formatColor('FFFFFF')).toBe('#FFFFFF')
      expect(formatColor('#123456')).toBe('#123456')
      expect(formatColorWithOpacity('FFFFFF', 80)).toBe('rgb(255 255 255 / 80%)')
      expect(formatColorWithOpacity('#FF0000', 100)).toBe('rgb(255 0 0 / 100%)')
    })

    it('正确解析 3 位 hex', () => {
      expect(formatColorWithOpacity('F00', 50)).toBe('rgb(255 0 0 / 50%)')
    })

    it('容错空值与非法 hex', () => {
      expect(formatColor('')).toBeUndefined()
      expect(formatColorWithOpacity(null, 50)).toBe('transparent')
      expect(formatColorWithOpacity('invalid', 50)).toBe('transparent')
    })
  })

  describe('formatShadow & formatTextShadow', () => {
    it('返回正确的阴影 CSS 规则', () => {
      expect(formatShadow(QuestionDisplayShadow.None)).toBe('none')
      expect(formatShadow(QuestionDisplayShadow.Soft)).toContain('0 8px 24px')
      expect(formatShadow(QuestionDisplayShadow.Strong)).toContain('0 16px 48px')

      expect(formatTextShadow(QuestionDisplayShadow.None)).toBe('none')
      expect(formatTextShadow(QuestionDisplayShadow.Soft)).toContain('0 1px 3px')
      expect(formatTextShadow(QuestionDisplayShadow.Strong)).toContain('0 2px 8px')
    })
  })

  describe('normalizeQuestionDisplaySetting', () => {
    it('对完全空或 legacy 配置应用默认值', () => {
      const normalized = normalizeQuestionDisplaySetting(null)
      const def = createDefaultQuestionDisplaySetting()
      expect(normalized.fontSize).toBe(def.fontSize)
      expect(normalized.fontColor).toBe(def.fontColor)
      expect(normalized.align).toBe(QuestionDisplayAlign.Left)
    })

    it('对缺少关键字段的空结构自动 fallback 到棉花糖', () => {
      const normalized = normalizeQuestionDisplaySetting({
        fontSize: 0,
        fontColor: '',
        backgroundColor: '',
      } as any)

      const def = createDefaultQuestionDisplaySetting()
      expect(normalized.fontColor).toBe(def.fontColor)
      expect(normalized.backgroundColor).toBe(def.backgroundColor)
      expect(normalized.backgroundOpacity).toBe(def.backgroundOpacity)
    })
  })

  describe('getAdjacentQuestion', () => {
    const list = [
      createMockQuestion({ id: 1, isReaded: false }),
      createMockQuestion({ id: 2, isReaded: true }),
      createMockQuestion({ id: 3, isReaded: false }),
    ]

    it('向后寻找下一条，支持末尾循环', () => {
      expect(getAdjacentQuestion(list, 1, 1)?.id).toBe(2)
      expect(getAdjacentQuestion(list, 2, 1)?.id).toBe(3)
      expect(getAdjacentQuestion(list, 3, 1)?.id).toBe(1)
    })

    it('向前寻找上一条，支持首部循环', () => {
      expect(getAdjacentQuestion(list, 2, -1)?.id).toBe(1)
      expect(getAdjacentQuestion(list, 1, -1)?.id).toBe(3)
    })

    it('当当前展示项不在过滤列表中时平滑兜底', () => {
      expect(getAdjacentQuestion(list, 999, 1)?.id).toBe(1)
      expect(getAdjacentQuestion(list, 999, -1)?.id).toBe(3)
    })
  })

  describe('getNextUnreadQuestion', () => {
    it('跳过已读项，循环找到下一条未读', () => {
      const list = [
        createMockQuestion({ id: 1, isReaded: true }),
        createMockQuestion({ id: 2, isReaded: false }),
        createMockQuestion({ id: 3, isReaded: true }),
        createMockQuestion({ id: 4, isReaded: false }),
      ]

      expect(getNextUnreadQuestion(list, 1)?.id).toBe(2)
      expect(getNextUnreadQuestion(list, 2)?.id).toBe(4)
      expect(getNextUnreadQuestion(list, 4)?.id).toBe(2)
    })

    it('全部已读时返回 undefined', () => {
      const list = [
        createMockQuestion({ id: 1, isReaded: true }),
        createMockQuestion({ id: 2, isReaded: true }),
      ]
      expect(getNextUnreadQuestion(list, 1)).toBeUndefined()
    })
  })

  describe('QUESTION_DISPLAY_PRESETS', () => {
    it('所有预设均包含完整合法的排版与颜色定义', () => {
      expect(QUESTION_DISPLAY_PRESETS.length).toBeGreaterThanOrEqual(4)
      for (const preset of QUESTION_DISPLAY_PRESETS) {
        expect(preset.name).toBeTruthy()
        expect(preset.value.fontSize).toBeGreaterThanOrEqual(12)
        expect(preset.value.fontColor).toBeTruthy()
        expect(preset.value.backgroundColor).toBeTruthy()
      }
    })
  })
})
