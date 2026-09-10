import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import QuestionDisplayCard from '@/shared/components/QuestionDisplayCard.vue'
import { createMockQuestion, createMockQuestionDisplaySetting, createMockUploadFile } from '@/test/testUtils'

describe('QuestionDisplayCard.vue', () => {
  it('正确渲染提问正文、提问者昵称与品牌标识', () => {
    const question = createMockQuestion({
      question: { message: '你好！请问今晚播什么？' },
      sender: { id: 10, name: '热心观众小明', isBiliAuthed: false },
    })
    const setting = createMockQuestionDisplaySetting({
      showUserName: true,
      showBrand: true,
    })

    const wrapper = mount(QuestionDisplayCard, {
      props: {
        question,
        setting,
      },
    })

    expect(wrapper.text()).toContain('你好！请问今晚播什么？')
    expect(wrapper.text()).toContain('热心观众小明')
    expect(wrapper.text()).toContain('vtsuru.live')
  })

  it('无提问或 status 为 empty 时展示空状态指示器', () => {
    const setting = createMockQuestionDisplaySetting()
    const wrapper = mount(QuestionDisplayCard, {
      props: {
        question: undefined,
        setting,
        status: 'empty',
      },
    })

    expect(wrapper.find('.question-display-empty').exists()).toBe(true)
    expect(wrapper.find('.question-display-text').exists()).toBe(false)
  })

  it('关闭 showUserName 时不显示昵称栏', () => {
    const question = createMockQuestion({
      sender: { id: 10, name: '热心观众小明', isBiliAuthed: false },
    })
    const setting = createMockQuestionDisplaySetting({
      showUserName: false,
    })

    const wrapper = mount(QuestionDisplayCard, {
      props: {
        question,
        setting,
      },
    })

    expect(wrapper.find('.question-display-user-name').exists()).toBe(false)
  })

  it('渲染图片并在图片失败时触发隐藏容错', async () => {
    const question = createMockQuestion({
      questionImages: [
        createMockUploadFile({ id: 1, path: 'https://example.com/img1.png' }),
        createMockUploadFile({ id: 2, path: 'https://example.com/img2.png' }),
      ],
    })
    const setting = createMockQuestionDisplaySetting({
      showImage: true,
    })

    const wrapper = mount(QuestionDisplayCard, {
      props: {
        question,
        setting,
      },
    })

    const images = wrapper.findAll('.question-display-image')
    expect(images.length).toBe(2)

    // 模拟第一张图片加载失败
    await images[0].trigger('error')

    // 失败后仅保留第二张
    expect(wrapper.findAll('.question-display-image').length).toBe(1)
  })
})
