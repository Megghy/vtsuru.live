import { normalizeDanmujiConfig } from '@/shared/danmujiConfig'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'

import { DownloadConfig, GetConfigHash } from '@/api/account'
import { useDanmujiConfig } from '@/apps/obs/composables/useDanmujiConfig'
import * as messageTypes from '@/apps/obs/components/blivechat/constants'
import { buildDanmujiCss } from '@/shared/danmujiStyle'
import { EventDataTypes } from '@/api/api-models'
import Ticker from '@/apps/obs/components/blivechat/Ticker.vue'
import MessageRender from '@/apps/obs/components/blivechat/MessageRender.vue'
import DanmujiOBS from '@/apps/obs/pages/DanmujiOBS.vue'

vi.mock('@/composables/useRouteQueryParam', () => ({ useRouteQueryParam: () => ref(undefined) }))

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


describe('云端外观与消息生命周期', () => {
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })

  it('配置预览响应参数与自定义覆盖，切换预设不改写 CSS', async () => {
    setActivePinia(createPinia())
    const config = normalizeDanmujiConfig({ style: { customCss: '#message { color: red !important; }' } })
    const wrapper = mount(DanmujiOBS, { props: { preview: true, config } })
    const render = wrapper.findComponent(MessageRender)
    expect(render.props('customCss')).toBe(buildDanmujiCss(config.style))
    const changed = { ...config, style: { ...config.style, preset: 'bubble' as const, fontSize: 28, opacity: 0.5 } }
    await wrapper.setProps({ config: changed })
    expect(render.props('customCss')).toContain('--danmuji-font-size: 28px')
    expect(render.props('customCss')).toContain('border-radius: 12px')
    expect(render.props('customCss').trim().endsWith(config.style.customCss)).toBe(true)
    wrapper.unmount()
  })

  it('消息反序、礼物置顶阈值和到期清理复用同一消息源', async () => {
    vi.useFakeTimers()
    const appearance = normalizeDanmujiConfig({ style: { reverse: false, autoHide: 2, pinned: true, pinnedMinPrice: 30 } }).style
    const wrapper = mount(MessageRender, { props: { appearance } })
    for (const [id, type, price] of [['text', messageTypes.MESSAGE_TYPE_TEXT, 0], ['small', messageTypes.MESSAGE_TYPE_GIFT, 10], ['large', messageTypes.MESSAGE_TYPE_GIFT, 50]] as const) {
      wrapper.vm.handleAddMessage({ id, type, price, time: new Date(), content: id })
    }
    expect(wrapper.vm.paidMessages.map((m: any) => m.id)).toEqual(['large'])
    wrapper.vm.messages = [...wrapper.vm.messagesBuffer]
    wrapper.vm.messagesBuffer = []
    expect(wrapper.vm.displayMessages.map((m: any) => m.id)).toEqual(['large', 'small', 'text'])
    await vi.advanceTimersByTimeAsync(3000)
    expect(wrapper.vm.messages).toEqual([])
    expect(wrapper.vm.paidMessages).toEqual([])
    wrapper.unmount()
  })

  it('首次读取配置、五秒同步变更，哈希未变不重复下载，卸载停止轮询', async () => {
    vi.useFakeTimers()
    vi.mocked(GetConfigHash).mockResolvedValue('first')
    vi.mocked(DownloadConfig).mockResolvedValue({ status: 'success', msg: undefined, data: { style: { fontSize: 25 } } })
    const Host = defineComponent({ setup: () => ({ config: useDanmujiConfig({ preview: false }) }), template: '<div>{{ config.style.fontSize }}</div>' })
    const wrapper = mount(Host)
    await vi.advanceTimersByTimeAsync(0)
    expect(wrapper.text()).toBe('25')
    await vi.advanceTimersByTimeAsync(5000)
    expect(DownloadConfig).toHaveBeenCalledTimes(1)
    vi.mocked(GetConfigHash).mockResolvedValue('second')
    vi.mocked(DownloadConfig).mockResolvedValue({ status: 'success', msg: undefined, data: { style: { fontSize: 32 } } })
    await vi.advanceTimersByTimeAsync(5000)
    expect(wrapper.text()).toBe('32')
    wrapper.unmount()
    await vi.advanceTimersByTimeAsync(10000)
    expect(GetConfigHash).toHaveBeenCalledTimes(3)
  })
})


it('初次下载失败向 Vue 错误边界报错，下一周期同一哈希仍重新下载', async () => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  const errorHandler = vi.fn()
  vi.mocked(GetConfigHash).mockResolvedValue('unchanged')
  vi.mocked(DownloadConfig)
    .mockResolvedValueOnce({ status: 'error', msg: '暂时无法下载', data: undefined })
    .mockResolvedValue({ status: 'success', msg: undefined, data: { style: { fontSize: 36 } } })
  const Host = defineComponent({ setup: () => ({ config: useDanmujiConfig({ preview: false }) }), template: '<div>{{ config.style.fontSize }}</div>' })
  const wrapper = mount(Host, { global: { config: { errorHandler } } })
  try {
    await vi.advanceTimersByTimeAsync(0)
    expect(errorHandler).toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(5000)
    expect(DownloadConfig).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toBe('36')
  } finally { wrapper.unmount(); vi.useRealTimers() }
})


it('30 元礼物在置顶栏保留，源消息撤回后关闭已展开的详情', async () => {
  vi.useFakeTimers()
  const message = { id: 'gift-30', type: messageTypes.MESSAGE_TYPE_GIFT, price: 30, addTime: new Date(), time: new Date(), authorName: '观众', giftName: '礼物', num: 1 }
  const wrapper = mount(Ticker, { props: { messages: [message], minGiftPrice: 30 } })
  try {
    await vi.advanceTimersByTimeAsync(1000)
    const item = wrapper.find('yt-live-chat-ticker-paid-message-item-renderer')
    expect(item.exists()).toBe(true)
    await item.trigger('click')
    expect(wrapper.find('yt-live-chat-paid-message-renderer').exists()).toBe(true)
    await wrapper.setProps({ messages: [] })
    expect(wrapper.find('yt-live-chat-paid-message-renderer').exists()).toBe(false)
  } finally { wrapper.unmount(); vi.useRealTimers() }
})
