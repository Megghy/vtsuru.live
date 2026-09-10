import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { ViolationTypes } from '@/api/api-models'
import { useQuestionBox } from '@/store/useQuestionBox'
import { createMockQuestion } from '@/test/testUtils'

describe('useQuestionBox store', () => {
  let store: ReturnType<typeof useQuestionBox>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useQuestionBox()
  })

  describe('过滤与检索', () => {
    it('支持仅查看未回复提问 (onlyUnreplied)', () => {
      store.recieveQuestions = [
        createMockQuestion({ id: 1, answer: { message: '已回复', createdAt: 1700000000 } }),
        createMockQuestion({ id: 2, answer: undefined }),
        createMockQuestion({ id: 3, answer: { message: '也回复了', createdAt: 1700000000 } }),
      ]

      store.onlyUnreplied = true
      expect(store.recieveQuestionsFiltered.map((q) => q.id)).toEqual([2])

      store.onlyUnreplied = false
      expect(store.recieveQuestionsFiltered.length).toBe(3)
    })

    it('支持复合筛选：未读 + 收藏 + 关键词', () => {
      store.recieveQuestions = [
        createMockQuestion({ id: 1, isReaded: false, isFavorite: true, question: { message: '今天开心吗？' } }),
        createMockQuestion({ id: 2, isReaded: true, isFavorite: true, question: { message: '今天吃什么？' } }),
        createMockQuestion({ id: 3, isReaded: false, isFavorite: false, question: { message: '今天玩游戏吗？' } }),
      ]

      store.onlyUnread = true
      store.onlyFavorite = true
      store.searchKeyword = '开心'

      expect(store.recieveQuestionsFiltered.map((q) => q.id)).toEqual([1])
    })
  })

  describe('排序功能', () => {
    it('支持按时间最新/最早排序', () => {
      store.recieveQuestions = [
        createMockQuestion({ id: 1, sendAt: 100 }),
        createMockQuestion({ id: 2, sendAt: 300 }),
        createMockQuestion({ id: 3, sendAt: 200 }),
      ]

      store.sortMode = 'newest'
      expect(store.recieveQuestionsFiltered.map((q) => q.id)).toEqual([2, 3, 1])

      store.sortMode = 'oldest'
      expect(store.recieveQuestionsFiltered.map((q) => q.id)).toEqual([1, 3, 2])
    })

    it('支持未读优先排序', () => {
      store.recieveQuestions = [
        createMockQuestion({ id: 1, isReaded: true, sendAt: 300 }),
        createMockQuestion({ id: 2, isReaded: false, sendAt: 200 }),
      ]

      store.sortMode = 'unreadFirst'
      expect(store.recieveQuestionsFiltered.map((q) => q.id)).toEqual([2, 1])
    })
  })

  describe('批量选择', () => {
    it('切换选择、全选与清空选择', () => {
      store.toggleSelect(10)
      store.toggleSelect(20)
      expect(store.selectedIds).toEqual([10, 20])

      store.toggleSelect(10)
      expect(store.selectedIds).toEqual([20])

      store.selectAll([1, 2, 3])
      expect(store.selectedIds).toContain(1)
      expect(store.selectedIds).toContain(2)
      expect(store.selectedIds).toContain(3)
      expect(store.selectedIds).toContain(20)

      store.clearSelection()
      expect(store.selectedIds).toEqual([])
    })
  })

  describe('违规类型标签字典', () => {
    it('正确解析违规枚举名称', () => {
      expect(store.getViolationString(ViolationTypes.SENSITIVE_TERM)).toBe('敏感词')
      expect(store.getViolationString(ViolationTypes.HATE)).toBe('辱骂')
      expect(store.getViolationString(ViolationTypes.ADVERTISING)).toBe('广告')
    })
  })
})
