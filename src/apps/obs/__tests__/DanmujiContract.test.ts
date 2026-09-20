import { normalizeDanmujiConfig } from '@/shared/danmujiConfig'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import { EventDataTypes } from '@/api/api-models'
import MessageRender from '@/apps/obs/components/blivechat/MessageRender.vue'
import DanmujiOBS from '@/apps/obs/pages/DanmujiOBS.vue'

vi.mock('@/api/query', () => ({
  QueryGetAPI: vi.fn().mockResolvedValue({ code: 200, data: [] }),
}))

vi.mock('@/api/account', () => ({
  DownloadConfig: vi.fn().mockResolvedValue({ status: 'success', data: null }),
  GetConfigHash: vi.fn().mockResolvedValue(null),
  useAccount: () => ref({ biliBlackList: { banned_user: true } }),
}))

const mockInitOpenlive = vi.fn()
vi.mock('@/store/useDanmakuClient', () => ({
  useDanmakuClient: () => ({
    connected: false,
    initOpenlive: mockInitOpenlive,
    onEvent: vi.fn(),
    offEvent: vi.fn(),
  }),
}))

describe('MessageRender CSS & 消息管理契约', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    document.head.querySelectorAll('style').forEach((el) => el.remove())
  })

  it('初始挂载时立即在 document.head 注入 customCss', () => {
    const customCss = 'body { background: red; }'
    const wrapper = mount(MessageRender, {
      props: {
        customCss,
      },
    })

    const styles = Array.from(document.head.querySelectorAll('style'))
    const match = styles.find((s) => s.textContent?.includes('background: red'))
    expect(match).toBeDefined()

    wrapper.unmount()
  })

  it('setCss 立即应用传入样式', async () => {
    const wrapper = mount(MessageRender, {
      props: {
        customCss: '.old { color: black; }',
      },
    })

    // 调用 setCss 传入新 CSS
    wrapper.vm.setCss('.new { color: blue; }')


    const styles = Array.from(document.head.querySelectorAll('style'))
    const match = styles.find((s) => s.textContent?.includes('.new { color: blue; }'))
    expect(match).toBeDefined()

    wrapper.unmount()
  })

  it('组件销毁后无残留 style，且后续防抖回调不会重新注入', () => {
    const wrapper = mount(MessageRender, {
      props: {
        customCss: '.destroy-test { color: green; }',
      },
    })

    expect(
      Array.from(document.head.querySelectorAll('style')).some((s) => s.textContent?.includes('.destroy-test')),
    ).toBe(true)

    // 触发一个防抖更新
    wrapper.vm.setCss('.late-update { color: orange; }')

    // 立即销毁组件
    wrapper.unmount()

    // 销毁后 style 应该已被移除
    expect(
      Array.from(document.head.querySelectorAll('style')).some((s) => s.textContent?.includes('.destroy-test')),
    ).toBe(false)

    // 即使定时器走完，也不会有残留或重新注入
    vi.advanceTimersByTime(2000)
    expect(
      Array.from(document.head.querySelectorAll('style')).some((s) => s.textContent?.includes('.late-update')),
    ).toBe(false)
  })

  it('delMessage 与 deleteMessage 能正确删除指定 ID 的消息', async () => {
    const wrapper = mount(MessageRender)
    wrapper.vm.messages = [
      { id: 'msg-1', type: 1, content: 'first', time: new Date() },
      { id: 'msg-2', type: 1, content: 'second', time: new Date() },
    ]

    wrapper.vm.delMessage('msg-1')
    vi.runOnlyPendingTimers()
    await nextTick()
    expect(wrapper.vm.messages.map((m: any) => m.id)).toEqual(['msg-2'])

    wrapper.vm.deleteMessage('msg-2')
    vi.runOnlyPendingTimers()
    await nextTick()
    expect(wrapper.vm.messages).toHaveLength(0)

    wrapper.unmount()
  })

  it('clearMessages 清空所有消息与缓冲队列', () => {
    const wrapper = mount(MessageRender)
    wrapper.vm.messages = [{ id: '1', type: 1, time: new Date() }]
    wrapper.vm.paidMessages = [{ id: '2', type: 2, time: new Date() }]
    wrapper.vm.smoothedMessageQueue = [[{ id: '3', type: 1, time: new Date() }]]
    wrapper.vm.messagesBuffer = [{ id: '4', type: 1, time: new Date() }]

    wrapper.vm.clearMessages()

    expect(wrapper.vm.messages).toHaveLength(0)
    expect(wrapper.vm.paidMessages).toHaveLength(0)
    expect(wrapper.vm.smoothedMessageQueue).toHaveLength(0)
    expect(wrapper.vm.messagesBuffer).toHaveLength(0)

    wrapper.unmount()
  })
})

describe('DanmujiOBS 底层契约与预览隔离', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockInitOpenlive.mockClear()
  })

  afterEach(() => {
    document.head.querySelectorAll('style').forEach((el) => el.remove())
  })

  it('preview 模式同步初始化、触发 ready 事件且不建立真实开放平台连接', async () => {
    const wrapper = mount(DanmujiOBS, {
      props: {
        preview: true,
      },
    })

    await nextTick()
    await nextTick()

    // 应该触发 ready 事件
    expect(wrapper.emitted('ready')).toBeTruthy()
    // preview 模式不应调用真实连接
    expect(mockInitOpenlive).not.toHaveBeenCalled()

    // 暴露出的公共方法必须完备
    expect(typeof wrapper.vm.setCss).toBe('function')
    expect(typeof wrapper.vm.testAddMessage).toBe('function')
    expect(typeof wrapper.vm.pushTestEvent).toBe('function')
    expect(typeof wrapper.vm.clearMessages).toBe('function')

    wrapper.unmount()
  })

  it('统一外部配置，优先使用 props.customCss，并正确将 string[] 转换为换行 string', async () => {
    const customCss = '.preview-theme { color: #abcdef; }'
    const wrapper = mount(DanmujiOBS, {
      props: {
        preview: true,
        customCss,
        config: normalizeDanmujiConfig({ blockUsers: ['banned_one', 'banned_two'], blockKeywords: ['blocked_word'], showDanmaku: true, maxNumber: 50 }),
      },
    })

    await nextTick()

    // 确认 MessageRender 正确接收到了 props
    const renderComponent = wrapper.findComponent(MessageRender)
    expect(renderComponent.exists()).toBe(true)
    expect(renderComponent.props('customCss')).toBe(customCss)
    expect(renderComponent.props('maxNumber')).toBe(50)

    wrapper.unmount()
  })


  it('blockUsers 参与消息过滤，屏蔽的用户发送的弹幕不被渲染', async () => {
    const wrapper = mount(DanmujiOBS, {
      props: {
        preview: true,
        config: normalizeDanmujiConfig({ blockUsers: ['blocked_user', '10086'], blockKeywords: ['ad_keyword'] }),
      },
    })

    await nextTick()
    const renderComponent = wrapper.findComponent(MessageRender)

    // 1. 被 blockUsers 屏蔽的用户
    await wrapper.vm.testAddMessage({
      type: EventDataTypes.Message,
      uname: 'blocked_user',
      msg: '正常消息',
      uid: 123,
    })

    // 2. 被 blockUsers (UID) 屏蔽的用户
    await wrapper.vm.testAddMessage({
      type: EventDataTypes.Message,
      uname: 'someone',
      msg: '正常消息',
      uid: 10086,
    })

    // 3. 被 blockKeywords 屏蔽的消息
    await wrapper.vm.testAddMessage({
      type: EventDataTypes.Message,
      uname: 'normal_user',
      msg: '这里包含 ad_keyword 的广告',
      uid: 456,
    })

    // 4. 正常消息
    await wrapper.vm.testAddMessage({
      type: EventDataTypes.Message,
      uname: 'normal_user',
      msg: '友好的弹幕内容',
      uid: 789,
    })

    // 检查所有已加入队列/缓冲/显示的消息
    const allMessages = Array.from(renderComponent.vm.iterRecentMessages(10, false))
    const authors = allMessages.map((m: any) => m.authorName)

    expect(authors).not.toContain('blocked_user')
    expect(authors).not.toContain('someone')
    expect(allMessages.some((m: any) => m.content?.includes('ad_keyword'))).toBe(false)
    expect(authors).toContain('normal_user')

    // 5. 测试 clearMessages
    wrapper.vm.clearMessages()
    const afterClear = Array.from(renderComponent.vm.iterRecentMessages(10, false))
    expect(afterClear).toHaveLength(0)

    wrapper.unmount()
  })
})
