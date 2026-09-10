import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import QuestionDisplayQueue from '@/apps/web/components/question-display/QuestionDisplayQueue.vue'
import { createMockQuestion } from '@/test/testUtils'

describe('QuestionDisplayQueue.vue', () => {
  it('正确渲染提问列表与当前展示高亮', () => {
    const q1 = createMockQuestion({ id: 1, isReaded: false, question: { message: '提问一' } })
    const q2 = createMockQuestion({ id: 2, isReaded: true, question: { message: '提问二' } })

    const wrapper = mount(QuestionDisplayQueue, {
      props: {
        questions: [q1, q2],
        currentId: 1,
        tags: ['杂谈', '游戏'],
        loading: false,
        search: '',
        'onUpdate:search': () => {},
        tag: undefined,
        'onUpdate:tag': () => {},
        onlyUnread: false,
        'onUpdate:onlyUnread': () => {},
        onlyFavorite: false,
        'onUpdate:onlyFavorite': () => {},
      },
    })

    expect(wrapper.text()).toContain('提问一')
    expect(wrapper.text()).toContain('提问二')
    expect(wrapper.text()).toContain('正在展示')

    const currentItem = wrapper.find('.queue-item.is-current')
    expect(currentItem.exists()).toBe(true)
    expect(currentItem.attributes('data-id')).toBe('1')
  })

  it('点击未展示的项触发 show 事件，点击已在展示的项触发 clear 事件', async () => {
    const q1 = createMockQuestion({ id: 1, question: { message: '提问一' } })
    const q2 = createMockQuestion({ id: 2, question: { message: '提问二' } })

    const wrapper = mount(QuestionDisplayQueue, {
      props: {
        questions: [q1, q2],
        currentId: 1,
        tags: [],
        loading: false,
        search: '',
        'onUpdate:search': () => {},
        tag: undefined,
        'onUpdate:tag': () => {},
        onlyUnread: false,
        'onUpdate:onlyUnread': () => {},
        onlyFavorite: false,
        'onUpdate:onlyFavorite': () => {},
      },
    })

    const buttons = wrapper.findAll('.question-main')
    // 点击已在展示的 q1 -> 触发 clear
    await buttons[0].trigger('click')
    expect(wrapper.emitted('clear')).toBeTruthy()

    // 点击未在展示的 q2 -> 触发 show
    await buttons[1].trigger('click')
    expect(wrapper.emitted('show')?.[0]).toEqual([q2])
  })
})
