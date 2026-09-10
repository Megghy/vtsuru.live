import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import QuestionItem from '@/components/QuestionItem.vue'
import { useQuestionBox } from '@/store/useQuestionBox'
import { createMockQuestion } from '@/test/testUtils'

describe('QuestionItem.vue', () => {
  let store: ReturnType<typeof useQuestionBox>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useQuestionBox()
  })

  it('正确渲染提问正文、发信人昵称与标签', () => {
    const question = createMockQuestion({
      question: { message: '请问周末开歌回吗？' },
      sender: { id: 10, name: '歌友小李', isBiliAuthed: false },
      tag: '歌回',
    })

    const wrapper = mount(QuestionItem, {
      props: { item: question },
    })

    expect(wrapper.text()).toContain('请问周末开歌回吗？')
    expect(wrapper.text()).toContain('歌友小李')
    expect(wrapper.text()).toContain('歌回')
  })

  it('展示当前处于 OBS 展示中状态的高亮徽标', () => {
    const question = createMockQuestion({ id: 99 })
    store.displayQuestion = question

    const wrapper = mount(QuestionItem, {
      props: { item: question },
    })

    expect(wrapper.find('.displaying-tag').exists()).toBe(true)
    expect(wrapper.text()).toContain('OBS 展示中')
    expect(wrapper.classes()).toContain('is-displaying')
  })

  it('渲染已回复内容', () => {
    const question = createMockQuestion({
      answer: { message: '周六晚上八点开！', createdAt: 1700000000 },
    })

    const wrapper = mount(QuestionItem, {
      props: { item: question },
    })

    expect(wrapper.find('.question-item__answer-box').exists()).toBe(true)
    expect(wrapper.text()).toContain('周六晚上八点开！')
  })
})
